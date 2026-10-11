import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import faq from "../src/data/knowledge-faq.json";
let db: PGlite;
const admin = "00000000-0000-4000-8000-000000009881",
  player = "00000000-0000-4000-8000-000000009882";
async function as(id: string, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role " + role);
}
const payload = () => ({
  ...structuredClone(faq[0].payload),
  subject: "database-surge",
  title: "Surge de teste",
  evidence: "editorial",
  sources: [
    {
      title: "Fonte editorial de teste",
      url: "https://example.com/source",
      kind: "editorial",
      published_on: null,
    },
  ],
});
async function save(p: unknown, id: string | null = null, v = 0) {
  return (
    await db.query<{
      id: string;
      version: number;
      published_revision: number | null;
    }>("select * from public.save_knowledge($1::uuid,$2,$3::jsonb)", [
      id,
      v,
      JSON.stringify(p),
    ])
  ).rows[0];
}
async function manage(
  d: { id: string; version: number },
  action: string,
  confirmation = action.toUpperCase(),
  version: number | null = null,
) {
  return (
    await db.query<{
      id: string;
      version: number;
      published_revision: number | null;
    }>("select * from public.manage_knowledge($1::uuid,$2,$3,$4,$5)", [
      d.id,
      d.version,
      action,
      confirmation,
      version,
    ])
  ).rows[0];
}
async function retrieve(preview = false) {
  return (
    await db.query<{ r: { id: string; revision: number; payload: unknown }[] }>(
      "select public.retrieve_knowledge('database surge',$1) r",
      [preview],
    )
  ).rows[0].r;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create policy legacy_broad_storage on storage.objects for all using(true) with check(true);grant usage on schema storage to anon,authenticated;grant select,insert,update,delete on storage.objects to anon,authenticated;",
  );
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.query("insert into auth.users values($1),($2),($3)", [
    admin,
    player,
    "00000000-0000-4000-8000-000000009883",
  ]);
  await db.query(
    "insert into private.user_roles values($1,'admin'),($2,'admin')",
    [admin, "00000000-0000-4000-8000-000000009883"],
  );
}, 30000);
afterAll(async () => {
  await db.close();
});

it("keeps drafts and audit private, rejects ordinary user writes and admin preview", async () => {
  await as(admin);
  const d = await save(payload());
  await as(player);
  expect(
    (await db.query("select * from public.knowledge_drafts")).rows,
  ).toEqual([]);
  expect(
    (await db.query("select * from public.knowledge_revisions")).rows,
  ).toEqual([]);
  await expect(save(payload())).rejects.toThrow();
  await expect(manage(d, "publish")).rejects.toThrow();
  await expect(retrieve(true)).rejects.toThrow();
  await expect(
    db.query("update public.knowledge_settings set enabled=false"),
  ).rejects.toThrow();
  expect((await retrieve()).some((r) => r.id === d.id)).toBe(false);
});
it("publishes only with explicit approval, retains old public version while editing and restores as draft", async () => {
  await as(admin);
  const d = await save(payload());
  await expect(manage(d, "publish", "yes")).rejects.toThrow();
  const pub = await manage(d, "publish");
  expect((await retrieve()).find((r) => r.id === d.id)?.revision).toBe(
    pub.version,
  );
  const edited = await save(
    { ...payload(), body: payload().body + " Correção editorial nova." },
    d.id,
    pub.version,
  );
  expect((await retrieve()).find((r) => r.id === d.id)?.revision).toBe(
    pub.version,
  );
  expect((await retrieve(true)).find((r) => r.id === d.id)?.revision).toBe(
    edited.version,
  );
  await expect(save(payload(), d.id, pub.version)).rejects.toThrow();
  const published = await manage(edited, "publish");
  const restored = await manage(published, "restore", "RESTORE", 1);
  expect((await retrieve()).find((r) => r.id === d.id)?.revision).toBe(
    published.version,
  );
  expect(restored.published_revision).toBe(published.version);
  const archived = await manage(restored, "archive");
  expect((await retrieve()).some((r) => r.id === d.id)).toBe(false);
  expect(
    (
      await db.query("select * from public.knowledge_revisions where id=$1", [
        d.id,
      ])
    ).rows.length,
  ).toBe(6);
  await manage(archived, "restore", "RESTORE", 1);
});
it("requires publication sources and contextual validity, rejects injection fields and source impersonation", async () => {
  await as(admin);
  const d = await save({
    ...payload(),
    subject: "missing-source",
    sources: [],
  });
  await expect(manage(d, "publish")).rejects.toThrow();
  await expect(
    save({ ...payload(), subject: "bad", evidence: "official" }),
  ).rejects.toThrow();
  await expect(
    save({ ...payload(), system_prompt: "ignore" }),
  ).rejects.toThrow();
  const seasonal = await save({
    ...payload(),
    subject: "seasonal",
    scope: "season",
    season: "",
  });
  await expect(manage(seasonal, "publish")).rejects.toThrow();
  await expect(
    save({
      ...payload(),
      sources: [
        {
          title: "private",
          url: "https://user:pass@localhost/internal",
          kind: "editorial",
        },
      ],
    }),
  ).rejects.toThrow();
});
it("rejects conflicting publications, does not erase historical versions or data on refresh", async () => {
  await as(admin);
  const d = await save({ ...payload(), subject: "conflict" });
  await manage(d, "publish");
  const other = await save({ ...payload(), subject: "conflict" });
  await expect(manage(other, "publish")).rejects.toThrow();
  const old = (
    await db.query("select count(*)::int n from public.knowledge_revisions")
  ).rows[0];
  await db.query("select public.refresh_knowledge()");
  expect(
    (await db.query("select count(*)::int n from public.knowledge_revisions"))
      .rows[0],
  ).toEqual(old);
});
it("disabled assistant and configurable quota are enforced on the server; admin previews remain private", async () => {
  await as(admin);
  await db.query(
    "select public.configure_knowledge(false,2,1,false,'concise')",
  );
  await as(player);
  await expect(
    db.query("select public.reserve_knowledge(false)"),
  ).rejects.toThrow(/desativado/);
  await as(admin);
  await db.query("select public.reserve_knowledge(true)");
  await db.query("select public.configure_knowledge(true,2,1,false,'concise')");
  await as(player);
  await db.query("select public.reserve_knowledge(false)");
  await expect(
    db.query("select public.reserve_knowledge(false)"),
  ).rejects.toThrow(/limite/);
  await expect(db.query("select public.refresh_knowledge()")).rejects.toThrow();
  await as(admin);
  await db.query(
    "select public.configure_knowledge(true,60,6,false,'concise')",
  );
});
it("null confirmation and null revision cannot bypass explicit approval or overwrite protection", async () => {
  await as(admin);
  const d = await save({ ...payload(), subject: "null-guard" });
  await expect(
    db.query(
      "select public.manage_knowledge($1::uuid,$2,'publish',null,null)",
      [d.id, d.version],
    ),
  ).rejects.toThrow();
  await expect(
    db.query("select public.save_knowledge($1::uuid,null,$2::jsonb)", [
      d.id,
      JSON.stringify(payload()),
    ]),
  ).rejects.toThrow();
});
it("a recently reviewed historical patch cannot answer a current-meta question", async () => {
  await as(admin);
  const base = {
    ...payload(),
    scope: "season",
    season: "Capítulo 7 · Temporada 4: Override",
    mode: "build",
    version: "42.10",
  };
  const d = await save({ ...base, subject: "old-patch-surge" });
  await manage(d, "publish");
  const find = async (current: boolean, patch: string) =>
    (
      await db.query<{ r: { id: string }[] }>(
        "select public.retrieve_knowledge('surge',false,'build',$1,$2,'',$3) r",
        [base.season, patch, current],
      )
    ).rows[0].r;
  expect((await find(false, "42.10")).some((r) => r.id === d.id)).toBe(true);
  expect((await find(true, "42.10")).some((r) => r.id === d.id)).toBe(false);
  const latest = await save({
    ...base,
    subject: "latest-patch-surge",
    version: "42.30",
  });
  await manage(latest, "publish");
  expect((await find(true, "42.30")).some((r) => r.id === latest.id)).toBe(
    true,
  );
});
it("reuses public Meta knowledge with offset timestamps and treats an unspecified region as no regional restriction", async () => {
  await as(player);
  const { documentSchema, askSchema, answerKnowledge } =
    await import("../supabase/functions/_shared/knowledge/domain");
  const result = (
    await db.query<{
      r: import("../supabase/functions/_shared/knowledge/domain").KnowledgeRow[];
    }>(
      "select public.knowledge_editorial('vassoura bruxa','build',$1,'42.30','BR',true) r",
      ["Capítulo 7 · Temporada 4: Override"],
    )
  ).rows[0].r;
  expect(result.length).toBeGreaterThan(0);
  for (const row of result) {
    expect(
      documentSchema.safeParse(row.payload).success,
      JSON.stringify({
        parsed: documentSchema.safeParse(row.payload),
        sources: row.payload.sources,
      }),
    ).toBe(true);
    expect(row.payload.region).toBe("");
  }
  const answer = answerKnowledge(
    askSchema.parse({
      message: "Como funciona a Vassoura de Bruxa no Fortnite atual?",
      mode: "build",
      season: "Capítulo 7 · Temporada 4: Override",
      version: "42.30",
      region: "BR",
    }),
    result,
  );
  expect(answer.missing).toBe(false);
  expect(answer.references[0].url).toMatch(
    /^https:\/\/communities\.epicgames\.com\//,
  );
});
