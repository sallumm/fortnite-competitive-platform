import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { uid } from "../src/lib/seed";
let db: PGlite;
const editor = uid(9971),
  player = uid(9972),
  other = uid(9973),
  lesson = uid(2201);
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
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.query("insert into auth.users values($1),($2),($3)", [
    editor,
    player,
    other,
  ]);
  await db.query("insert into private.user_roles values($1,'admin')", [editor]);
}, 30000);
afterAll(async () => {
  await db.close();
});
it("requires real authorization and isolates notes, study and snapshot history", async () => {
  await asUser(null, "anon");
  await expect(
    db.query("select public.record_academy_study($1,'completed')", [lesson]),
  ).rejects.toThrow();
  await asUser(player);
  await db.query("select public.record_academy_study($1,'started')", [lesson]);
  await db.query("select public.record_academy_study($1,'assessment','[1]')", [
    lesson,
  ]);
  await db.query(
    "select public.save_academy_note($1,'Minha dúvida','Revisar objetivo',true)",
    [lesson],
  );
  await expect(
    db.query(
      "insert into public.academy_records(user_id,lesson_id,action,snapshot) values($1,$2,'completed','{}')",
      [other, lesson],
    ),
  ).rejects.toThrow();
  await asUser(other);
  expect(
    (await db.query("select * from public.academy_records")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from public.academy_notes")).rows,
  ).toHaveLength(0);
  await db.query("select public.clear_academy_study()");
  await asUser(player);
  expect(
    (await db.query("select * from public.academy_records")).rows,
  ).toHaveLength(2);
  await asUser(editor);
  await db.query(
    "update public.articles set title='Primeira partida revisada',academy_questions='[]' where id=$1",
    [lesson],
  );
  await asUser(player);
  const r = (
    await db.query<{ snapshot: { title: string; questions: unknown[] } }>(
      "select snapshot from public.academy_records where action='assessment'",
    )
  ).rows[0];
  expect(r.snapshot.title).not.toBe("Primeira partida revisada");
  expect(r.snapshot.questions).toHaveLength(1);
});
it("rejects forged actions, incomplete answers, unpublished lessons and invalid editorial assessments", async () => {
  await asUser(player);
  for (const [action, answers] of [
    ["invented", []],
    ["completed", [1]],
    ["assessment", []],
  ])
    await expect(
      db.query("select public.record_academy_study($1,$2,$3)", [
        lesson,
        action,
        JSON.stringify(answers),
      ]),
    ).rejects.toThrow();
  await expect(
    db.query("select public.save_academy_note($1,$2,'',false)", [
      lesson,
      "x".repeat(4001),
    ]),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into public.academy_paths values('fake','Título válido','Descrição válida de estudo','[\"primeira-partida\"]',true,1)",
    ),
  ).rejects.toThrow();
  await asUser(editor);
  await expect(
    db.query("update public.articles set academy_questions=$1 where id=$2", [
      [
        {
          id: "q-1",
          prompt: "Uma pergunta válida",
          options: ["a", "b"],
          answer: 4,
          explanation: "Uma explicação válida",
        },
      ],
      lesson,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into public.academy_paths values('missing','Título válido','Descrição válida de estudo','[\"ausente\"]',true,1)",
    ),
  ).rejects.toThrow();
});
it("supports real path publishing and enforces per-player study bounds", async () => {
  await asUser(editor);
  await db.query(
    "insert into public.academy_paths values('novo-percurso','Novo percurso','Descrição editorial do percurso','[\"primeira-partida\"]',false,10)",
  );
  await asUser(null, "anon");
  expect(
    (
      await db.query(
        "select id from public.academy_paths where id='novo-percurso'",
      )
    ).rows,
  ).toHaveLength(0);
  await asUser(editor);
  await db.query(
    "update public.academy_paths set published=true where id='novo-percurso'",
  );
  await asUser(null, "anon");
  expect(
    (
      await db.query(
        "select id from public.academy_paths where id='novo-percurso'",
      )
    ).rows,
  ).toHaveLength(1);
  await asUser(other);
  for (let i = 0; i < 120; i++)
    await db.query("select public.record_academy_study($1,'reviewed')", [
      lesson,
    ]);
  await expect(
    db.query("select public.record_academy_study($1,'reviewed')", [lesson]),
  ).rejects.toThrow("limit");
  await db.query("select public.clear_academy_study()");
  expect(
    (await db.query("select * from public.academy_records")).rows,
  ).toHaveLength(0);
  await asUser(player);
  expect(
    (await db.query("select * from public.academy_records")).rows.length,
  ).toBeGreaterThan(0);
});
