import masteryLessons from "../src/data/mastery-lessons.json";
import type { Article } from "../src/lib/types";
import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { seed as baseSeed, uid } from "../src/lib/seed";
const seed = {
  ...baseSeed,
  articles: [...baseSeed.articles, ...(masteryLessons as Article[])],
};

let db: PGlite;
const editor = uid(9941),
  player = uid(9942);
async function asUser(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
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
const lesson = seed.articles.find((a) => a.slug === "primeira-partida")!;
it("publishes additive lessons and preserves old articles and private isolation", async () => {
  await asUser(null, "anon");
  expect(
    (
      await db.query(
        "select id from public.articles where curriculum is not null",
      )
    ).rows.length,
  ).toBe(19);
  expect(
    (await db.query("select id from public.articles where curriculum is null"))
      .rows.length,
  ).toBeGreaterThan(0);
  await asUser(player);
  expect(
    (
      await db.query(
        "update public.articles set curriculum=null where id=$1 returning id",
        [lesson.id],
      )
    ).rows,
  ).toEqual([]);
  expect((await db.query("select id from public.profiles")).rows).toEqual([
    { id: player },
  ]);
});
it("admin can create and publish another lesson without code; draft remains private and revisions persist", async () => {
  await asUser(editor);
  const draft = {
    ...lesson,
    id: uid(2299),
    slug: "nova-aula-editorial",
    title: "Uma nova aula editorial",
    published: false,
  };
  await db.query(
    "insert into public.articles(id,slug,title,kind,category,summary,body,author,source_url,verified_at,published_at,valid_until,published,curriculum) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
    [
      draft.id,
      draft.slug,
      draft.title,
      draft.kind,
      draft.category,
      draft.summary,
      draft.body,
      draft.author,
      draft.source_url,
      draft.verified_at,
      draft.published_at,
      draft.valid_until,
      false,
      draft.curriculum,
    ],
  );
  await asUser(null, "anon");
  expect(
    (await db.query("select id from public.articles where id=$1", [draft.id]))
      .rows,
  ).toEqual([]);
  await asUser(editor);
  await db.query("update public.articles set published=true where id=$1", [
    draft.id,
  ]);
  expect(
    (
      await db.query(
        "select id from public.content_revision_history where record_id=$1",
        [draft.id],
      )
    ).rows.length,
  ).toBeGreaterThan(0);
  await asUser(null, "anon");
  expect(
    (await db.query("select id from public.articles where id=$1", [draft.id]))
      .rows,
  ).toEqual([{ id: draft.id }]);
});
it("server rejects missing references, cycles, duplicate values and incompatible modality", async () => {
  await asUser(editor);
  const c = lesson.curriculum!;
  for (const patch of [
    { prerequisites: ["absent-lesson"] },
    { prerequisites: ["controles-interface"] },
    { sources: [] },
    { level: 6 },
    { modes: ["zero", "zero"] },
    { exercise_ids: [uid(1001)] },
    { competency_ids: ["building"] },
    { sources: [{ ...c.sources[0], url: "http://untrusted.test" }] },
  ]) {
    await expect(
      db.query("update public.articles set curriculum=$1 where id=$2", [
        { ...c, ...patch },
        lesson.id,
      ]),
    ).rejects.toThrow();
  }
  expect(
    (
      await db.query<{ curriculum: unknown }>(
        "select curriculum from public.articles where id=$1",
        [lesson.id],
      )
    ).rows[0].curriculum,
  ).toEqual(c);
});
it("cannot delete, unpublish or rename a prerequisite used by a published lesson", async () => {
  await asUser(editor);
  await expect(
    db.query("delete from public.articles where id=$1", [lesson.id]),
  ).rejects.toThrow("dependants");
  await expect(
    db.query("update public.articles set published=false where id=$1", [
      lesson.id,
    ]),
  ).rejects.toThrow("prerequisites");
  await expect(
    db.query("update public.articles set slug='changed-slug' where id=$1", [
      lesson.id,
    ]),
  ).rejects.toThrow("prerequisites");
});

it("cannot narrow a shared prerequisite to construction and break Zero Build study", async () => {
  await asUser(editor);
  await expect(
    db.query("update public.articles set curriculum=$1 where id=$2", [
      { ...lesson.curriculum!, modes: ["build"] },
      lesson.id,
    ]),
  ).rejects.toThrow("prerequisite modes");
});
