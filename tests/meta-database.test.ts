import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { uid } from "../src/lib/seed";
import raw from "../src/data/meta-knowledge.json";
let db: PGlite;
const editor = uid(9951),
  player = uid(9952);
async function asUser(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ aal: id === editor ? "aal2" : "aal1" }),
  ]);
  await db.exec("set role " + role);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (file.includes("011"))
      await db.query(
        "update public.exercises set instructions=$1 where id=$2",
        [
          "Procedimento alterado pelo editor antes da nova pesquisa.",
          uid(1002),
        ],
      );
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  }
  await db.query("insert into auth.users values($1),($2)", [editor, player]);
  for (const id of [editor, player]) {
    await asUser(id);
    await db.query(
      "insert into public.profiles values($1,'Jogador','build','intermediate','aim',30,'kbm','America/Sao_Paulo',true,true)",
      [id],
    );
  }
  await asUser(null, "postgres");
  await db.query("insert into private.user_roles values($1,'admin')", [editor]);
}, 30000);
afterAll(async () => {
  await db.close();
});

async function append(row: Record<string, unknown>) {
  const keys = Object.keys(row),
    values = Object.values(row);
  return db.query(
    `insert into public.meta_entries(${keys.join(",")}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")})`,
    values,
  );
}
it("seeds the factual corpus without modifying existing lessons or exercises", async () => {
  await asUser(null, "anon");
  expect(
    (await db.query("select id from public.meta_entries")).rows,
  ).toHaveLength(raw.entries.length);
  expect(
    (
      await db.query(
        "select id from public.articles where curriculum is not null",
      )
    ).rows,
  ).toHaveLength(19);
  expect(
    (await db.query("select id from public.exercises")).rows.length,
  ).toBeGreaterThan(27);
  await expect(
    db.query("select id from public.meta_editorial_audit"),
  ).rejects.toThrow();
});
it("rejects noneditor writes and keeps private account isolation", async () => {
  await asUser(player);
  await expect(
    append({
      ...raw.entries[0],
      id: "unauthorized-entry",
      subject_key: "unauthorized-subject",
    }),
  ).rejects.toThrow();
  expect((await db.query("select id from public.profiles")).rows).toEqual([
    { id: player },
  ]);
  expect(
    (await db.query("select id from public.meta_editorial_audit")).rows,
  ).toEqual([]);
});
it("appends revisions, rejects overwrite and audits the actual editor", async () => {
  await asUser(editor);
  const first = raw.entries[0];
  const row = {
    ...first,
    id: "editor-revision",
    revision: 2,
    previous_id: first.id,
    change_note: "Nova revisão editorial verificada.",
  };
  await append(row);
  expect(
    (
      await db.query(
        "select id from public.meta_entries where subject_key=$1",
        [first.subject_key],
      )
    ).rows,
  ).toHaveLength(2);
  await expect(
    db.query("update public.meta_entries set body=$1 where id=$2", [
      "Overwrite",
      first.id,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("delete from public.meta_entries where id=$1", [first.id]),
  ).rejects.toThrow();
  expect(
    (
      await db.query(
        "select actor_id from public.meta_editorial_audit where record_id=$1",
        [row.id],
      )
    ).rows,
  ).toEqual([{ actor_id: editor }]);
  await expect(append({ ...row, id: "stale-editor-copy" })).rejects.toThrow();
});
it("validates sources, chronology and linked modes at the database boundary", async () => {
  await asUser(editor);
  const base = {
    ...raw.entries[1],
    id: "invalid-source",
    subject_key: "new-subject",
  };
  await expect(
    append({ ...base, source_ids: ["video-mechanics"] }),
  ).rejects.toThrow();
  await expect(
    append({ ...base, source_ids: ["missing-source"] }),
  ).rejects.toThrow();
  await expect(
    append({ ...base, source_ids: ["khanada-practice"] }),
  ).rejects.toThrow();
  await expect(
    append({
      ...raw.entries[0],
      id: "retroactive-revision",
      revision: 3,
      previous_id: "editor-revision",
      valid_from: "2026-10-09T00:00:00Z",
    }),
  ).rejects.toThrow();
  await expect(
    append({
      ...base,
      verified_at: "2099-01-01T00:00:00Z",
      review_due: "2099-01-08T00:00:00Z",
    }),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into public.meta_links values('bad-zero-link','meta-017','competency','freebuild','Incompatible construction exercise')",
    ),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into public.meta_links values('private-vod-link','meta-001','vod','private-id','No private targets allowed')",
    ),
  ).rejects.toThrow();
});
