import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { seed, uid } from "../src/lib/seed";
import { knowledge } from "../src/lib/training-research";
let db: PGlite;
const editor = uid(9951),
  player = uid(9952),
  exercise = uid(1001);
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
      "select public.accept_account_documents('2026-10-11-prelaunch','2026-10-11-prelaunch',true)",
    );
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
it("exposes only public corpus; anonymous and players cannot modify it", async () => {
  for (const [id, role] of [
    [null, "anon"],
    [player, "authenticated"],
  ] as const) {
    await asUser(id, role);
    const rows = await db.query("select * from public.training_knowledge");
    expect(rows.rows.length).toBe(
      knowledge.references.length +
        knowledge.competencies.length +
        knowledge.principles.length +
        knowledge.paths.length,
    );
    await expect(
      db.exec("update public.training_knowledge set version='injected'"),
    ).rejects.toThrow();
    await expect(
      db.exec("delete from public.training_knowledge"),
    ).rejects.toThrow();
  }
  expect((await db.query("select id from public.profiles")).rows).toEqual([
    { id: player },
  ]);
});
it("seed persists real protocols and public review metadata", async () => {
  const row = (
    await db.query<{ research: unknown; measurement: unknown }>(
      "select research,measurement from public.exercises where id=$1",
      [exercise],
    )
  ).rows[0];
  const expected = seed.exercises.find((e) => e.id === exercise)!;
  expect(row.research).toEqual(expected.research);
  expect(row.measurement).toEqual(expected.measurement);
});
it("player cannot change editorial review; admin changes are persisted and audited", async () => {
  await asUser(player);
  expect(
    (
      await db.query(
        "update public.exercises set research=null where id=$1 returning id",
        [exercise],
      )
    ).rows,
  ).toEqual([]);
  await asUser(editor);
  const research = {
    ...seed.exercises.find((e) => e.id === exercise)!.research!,
    review_notes: "Revisão manual documentada pelo editor.",
  };
  await db.query("update public.exercises set research=$1 where id=$2", [
    JSON.stringify(research),
    exercise,
  ]);
  expect(
    (
      await db.query<{ research: unknown }>(
        "select research from public.exercises where id=$1",
        [exercise],
      )
    ).rows[0].research,
  ).toEqual(research);
  const revisions = await db.query<{
    actor_id: string;
    after_data: { research: unknown };
  }>(
    "select actor_id,after_data from public.content_revision_history where table_name='exercises' and record_id=$1 order by id desc limit 1",
    [exercise],
  );
  expect(revisions.rows[0].actor_id).toBe(editor);
  expect(revisions.rows[0].after_data.research).toEqual(research);
});
it("server rejects unknown evidence, mismatched modality, duplicate IDs and retirement without unpublishing", async () => {
  await asUser(editor);
  const r = seed.exercises.find((e) => e.id === exercise)!.research!;
  for (const patch of [
    { evidence_ids: ["missing"] },
    { evidence_ids: ["video-pending"] },
    { competency_ids: ["zero-cover"] },
    { competency_ids: ["freebuild", "freebuild"] },
    { review_status: "retired" },
    { completion: "done" },
    { review_due_at: "2020-01-01T00:00:00Z" },
    { evil: "instructions" },
  ])
    await expect(
      db.query("update public.exercises set research=$1 where id=$2", [
        JSON.stringify({ ...r, ...patch }),
        exercise,
      ]),
    ).rejects.toThrow();
  await expect(
    db.query("update public.exercises set mode='zero' where id=$1", [exercise]),
  ).rejects.toThrow();
  await expect(
    db.query("update public.exercises set mode='both' where id=$1", [exercise]),
  ).rejects.toThrow();
  await db.query(
    "update public.exercises set published=false,research=$1 where id=$2",
    [JSON.stringify({ ...r, review_status: "retired" }), exercise],
  );
  await asUser(null, "anon");
  expect(
    (await db.query("select id from public.exercises where id=$1", [exercise]))
      .rows,
  ).toEqual([]);
});

it("migration does not label an independently edited exercise as reviewed", async () => {
  await asUser(editor);
  const row = (
    await db.query<{ instructions: string; research: unknown }>(
      "select instructions,research from public.exercises where id=$1",
      [uid(1002)],
    )
  ).rows[0];
  expect(row.instructions).toBe(
    "Procedimento alterado pelo editor antes da nova pesquisa.",
  );
  expect(row.research).toBeNull();
});
