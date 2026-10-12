import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import raw from "../src/data/meta-knowledge.json";
import { cleanEntryContent } from "../src/lib/meta-editorial";
import type { MetaEntry } from "../src/lib/meta";
const editor = "00000000-0000-4000-8000-000000009961",
  player = "00000000-0000-4000-8000-000000009962",
  other = "00000000-0000-4000-8000-000000009963",
  asset = "00000000-0000-4000-8000-000000009964";
let db: PGlite;
let serial = 0;
async function as(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ aal: id === editor || id === other ? "aal2" : "aal1" }),
  ]);
  await db.exec("set role " + role);
}
function payload() {
  const p = cleanEntryContent(raw.entries[0] as MetaEntry);
  p.subject_key = "editorial-test-" + ++serial;
  p.slug = p.subject_key;
  p.title = "Item de teste editorial";
  return p;
}
async function save(
  p: unknown,
  status = "review",
  id: string | null = null,
  version = 0,
) {
  const r = await db.query<{
    id: string;
    version: number;
    published_entry_id: string;
    status: string;
  }>("select * from public.save_meta_draft($1::jsonb,$2,$3::uuid,$4)", [
    JSON.stringify(p),
    status,
    id,
    version,
  ]);
  return r.rows[0];
}
async function publish(id: string, version: number, withdraw = false) {
  return (
    await db.query<{ id: string }>(
      "select public.publish_meta_draft($1::uuid,$2,$3) id",
      [id, version, withdraw],
    )
  ).rows[0].id;
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
    editor,
    player,
    other,
  ]);
  await db.query(
    "insert into private.user_roles values($1,'admin'),($2,'admin')",
    [editor, other],
  );
  await db.query(
    "insert into public.meta_assets(id,path,mime_type,size_bytes,alt,source_url,rights,credit) values($1,$2,'image/png',80,'Imagem original de teste','https://example.com/original','Imagem original: autoria e autorização de teste.','Equipe de teste')",
    [asset, editor + "/" + asset + ".png"],
  );
  await db.query(
    "insert into storage.objects(bucket_id,name) values('meta-images',$1)",
    [editor + "/" + asset + ".png"],
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
it("requires role and AAL2 for real editorial RPCs, including a downgrade after draft creation", async () => {
  await as(editor);
  const draft = await save(payload(), "review");
  for (const [id, aal] of [
    [player, "aal1"],
    [player, "aal2"],
    [editor, "aal1"],
  ]) {
    await as(id);
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ aal }),
    ]);
    await expect(save(payload(), "draft")).rejects.toThrow();
    await expect(publish(draft.id, draft.version)).rejects.toThrow();
  }
  await as(editor);
  const unchanged = (
    await db.query<{ version: number; status: string }>(
      "select version,status from public.meta_drafts where id=$1",
      [draft.id],
    )
  ).rows[0];
  expect(unchanged).toEqual({ version: draft.version, status: "review" });
  const published = await publish(draft.id, draft.version);
  expect(published).toBeTruthy();
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ aal: "aal1" }),
  ]);
  await expect(save(payload(), "draft")).rejects.toThrow();
  await as(editor);
  expect(
    (
      await db.query("select id from public.meta_entries where id=$1", [
        published,
      ])
    ).rows,
  ).toHaveLength(1);
});
it("keeps drafts, unpublished media and editor identities private; rejects all ordinary-user mutations", async () => {
  await as(editor);
  const d = await save(payload(), "draft");
  expect(d.version).toBe(1);
  await as(player);
  expect((await db.query("select id from public.meta_drafts")).rows).toEqual(
    [],
  );
  expect(
    (await db.query("select id from public.meta_draft_history")).rows,
  ).toEqual([]);
  expect((await db.query("select id from public.meta_assets")).rows).toEqual(
    [],
  );
  expect((await db.query("select id from storage.objects")).rows).toEqual([]);
  await expect(save(payload())).rejects.toThrow("Administrative role");
  await expect(publish(d.id, 1)).rejects.toThrow("Administrative role");
  await expect(
    db.query(
      "insert into public.meta_seasons values('bad-season','Forbidden')",
    ),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into storage.objects(bucket_id,name) values('meta-images','evil.svg')",
    ),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into public.meta_assets(path,mime_type,size_bytes,alt,source_url,rights,credit) values('bad','image/png',80,'bad','https://example.com','Not permitted','User')",
    ),
  ).rejects.toThrow();
  await as(null, "anon");
  await expect(db.query("select id from public.meta_drafts")).rejects.toThrow();
  await expect(save(payload())).rejects.toThrow();
});
it("persists season, mode, version, reviewed item, media, video/drop/article links and revision history", async () => {
  await as(editor);
  await db.query(
    "insert into public.meta_seasons(id,title) values('test-season','Temporada de teste')",
  );
  await db.query(
    "insert into public.meta_modes values('test-build','Modo de teste',true)",
  );
  await db.query(
    "insert into public.meta_versions values('test-version','Temporada de teste','test-1',null)",
  );
  await db.query(
    "insert into public.meta_contexts values('test-context','test-version','test-build','solo','casual','unspecified',null)",
  );
  const p = payload();
  p.context_id = "test-context";
  p.media_ids = [asset];
  p.links = [
    {
      target_kind: "exercise",
      target_id: "00000000-0000-4000-8000-000000001027",
      reason: "Exercício compatível para revisar decisões.",
    },
  ];
  p.videos = [
    {
      title: "Vídeo de teste",
      creator: "Criador de teste",
      url: "https://www.youtube.com/watch?v=7qQFLL_DJ7Q",
      description: "Registro de teste, sem alegação de análise audiovisual.",
      source_url:
        "https://www.fortnite.com/news/the-corruption-spreads-in-fortnitemares-2026",
      authorization:
        "Teste de cadastro do link oficial; incorporação não habilitada.",
      embed_allowed: false,
      tags: [],
      timestamps: [{ seconds: 30, label: "Trecho de teste" }],
    },
  ];
  let d = await save(p, "draft");
  await expect(
    db.query("select public.save_meta_draft($1,'draft',$2,null)", [
      JSON.stringify(p),
      d.id,
    ]),
  ).rejects.toThrow("Draft changed");
  await expect(
    db.query("select public.publish_meta_draft($1,null)", [d.id]),
  ).rejects.toThrow("Draft changed");
  await expect(publish(d.id, 1)).rejects.toThrow("Review");
  d = await save(p, "review", d.id, 1);
  const first = await publish(d.id, d.version);
  await as(null, "anon");
  expect(
    (
      await db.query(
        "select entry_id from public.meta_editions where entry_id=$1",
        [first],
      )
    ).rows,
  ).toHaveLength(1);
  expect((await db.query("select id from public.meta_assets")).rows).toEqual([
    { id: asset },
  ]);
  expect((await db.query("select id from storage.objects")).rows).toHaveLength(
    1,
  );
  expect(
    (
      await db.query("select id from public.meta_links where entry_id=$1", [
        first,
      ])
    ).rows,
  ).toHaveLength(1);
  await as(editor);
  p.title = "Item revisado";
  d = await save(p, "review", d.id, 3);
  const second = await publish(d.id, 4);
  expect(second).not.toBe(first);
  expect(
    (
      await db.query("select title from public.meta_entries where id=$1", [
        first,
      ])
    ).rows,
  ).toEqual([{ title: "Item de teste editorial" }]);
  await expect(
    db.query("update public.meta_editions set content=$1 where entry_id=$2", [
      JSON.stringify(p),
      first,
    ]),
  ).rejects.toThrow();
  await publish(d.id, 5, true);
  await as(null, "anon");
  expect(
    (
      await db.query(
        "select entry_id from public.meta_editions where entry_id in($1,$2)",
        [first, second],
      )
    ).rows,
  ).toEqual([]);
  expect((await db.query("select id from storage.objects")).rows).toEqual([]);
  await as(editor);
  const restored = (
    await db.query<{ version: number }>(
      "select * from public.restore_meta_draft($1,6,1)",
      [d.id],
    )
  ).rows[0];
  expect(restored.version).toBe(7);
  expect(
    (
      await db.query(
        "select version from public.meta_draft_history where draft_id=$1",
        [d.id],
      )
    ).rows,
  ).toHaveLength(7);
  expect(
    (await db.query("select public.meta_asset_removable($1) ok", [asset])).rows,
  ).toEqual([{ ok: false }]);
  for (const display_kind of ["drop", "article"] as const) {
    const guide = payload();
    guide.display_kind = display_kind;
    guide.kind = display_kind === "drop" ? "location" : "analysis";
    guide.links = [
      {
        target_kind: "article",
        target_id: "00000000-0000-4000-8000-000000002203",
        reason: "Conteúdo público relacionado.",
      },
    ];
    const gd = await save(guide);
    expect(await publish(gd.id, 1)).toMatch(/^meta-/);
  }
});
it("rejects stale drafts/publications, bad sources, incompatible/private links, invalid blocks and executable embeds atomically", async () => {
  await as(editor);
  const p = payload(),
    a = await save(p),
    b = await save(p);
  await publish(a.id, 1);
  await expect(publish(b.id, 1)).rejects.toThrow("Publication changed");
  await expect(save(p, "review", a.id, 1)).rejects.toThrow("Draft changed");
  await expect(save({ ...payload(), source_ids: [] })).rejects.toThrow(
    "Source",
  );
  await expect(
    save({ ...payload(), source_ids: ["missing-source"] }),
  ).rejects.toThrow();
  await expect(
    save({
      ...payload(),
      blocks: [{ heading: "Title", text: "Safe", html: "<script>" }],
    }),
  ).rejects.toThrow("Invalid content block");
  await expect(
    save({
      ...payload(),
      videos: [
        {
          title: "Title",
          creator: "Creator",
          description: "Description",
          source_url: "https://example.com",
          url: "https://youtube.com.evil.example/watch?v=12345678901",
          authorization: "Test authorization",
          embed_allowed: true,
          tags: [],
          timestamps: [],
        },
      ],
    }),
  ).rejects.toThrow("Unsupported");
  const incompatible = payload();
  incompatible.context_id = "zero-4230";
  incompatible.links = [
    {
      target_kind: "exercise",
      target_id: "00000000-0000-4000-8000-000000001002",
      reason: "This should be rejected for Zero Build",
    },
  ];
  const draft = await save(incompatible);
  await expect(publish(draft.id, 1)).rejects.toThrow("incompatible");
  expect(
    (
      await db.query(
        "select id from public.meta_entries where subject_key=$1",
        [incompatible.subject_key],
      )
    ).rows,
  ).toEqual([]);
  await expect(
    save({
      ...payload(),
      links: [
        { target_kind: "vod", target_id: player, reason: "Private target" },
      ],
    }),
  ).rejects.toThrow("Invalid public");
  await expect(
    db.query(
      "insert into public.meta_sources values('unsafe-source','Unsafe','https://user:secret@example.com','official','page',null,now(),'Unsafe URL')",
    ),
  ).rejects.toThrow("Unsafe");
});
it("reserves unused media deletion and rejects concurrent-style draft associations with that asset", async () => {
  await as(null, "postgres");
  const unused = "00000000-0000-4000-8000-000000009965";
  await db.query(
    "insert into public.meta_assets(id,path,mime_type,size_bytes,alt,source_url,rights,credit) values($1,$2,'image/png',80,'Imagem removível','https://example.com/original','Autorização original de teste.','Equipe de teste')",
    [unused, editor + "/" + unused + ".png"],
  );
  await as(editor);
  const reserve = await db.query<{ status: string }>(
    "select * from public.reserve_meta_asset_remove($1)",
    [unused],
  );
  expect(reserve.rows[0].status).toBe("deleting");
  await expect(save({ ...payload(), media_ids: [unused] })).rejects.toThrow(
    "Unverified media",
  );
  await expect(
    db.query("select * from public.reserve_meta_asset_remove($1)", [asset]),
  ).rejects.toThrow("Referenced media");
});
it("registers media metadata and actual actor atomically through a service-only RPC", async () => {
  const path = editor + "/00000000-0000-4000-8000-000000009966.png",
    info = {
      alt: "Imagem original auditada",
      source_url: "https://example.com/source",
      rights: "Autorização original da equipe.",
      credit: "Equipe editorial",
    };
  await as(player);
  await expect(
    db.query("select * from public.register_meta_asset($1,80,$2,$3)", [
      path,
      JSON.stringify(info),
      editor,
    ]),
  ).rejects.toThrow();
  expect(
    (await db.query("select id from public.meta_media_audit")).rows,
  ).toEqual([]);
  await as(null, "service_role");
  const registered = (
    await db.query<{ id: string }>(
      "select * from public.register_meta_asset($1,80,$2,$3)",
      [path, JSON.stringify(info), editor],
    )
  ).rows[0];
  await as(editor);
  expect(
    (
      await db.query(
        "select actor_id,action from public.meta_media_audit where asset_id=$1",
        [registered.id],
      )
    ).rows,
  ).toEqual([{ actor_id: editor, action: "upload" }]);
});
it("persists incomplete private drafts while refusing their review and publication", async () => {
  await as(editor);
  const p = payload();
  p.title = "";
  p.summary = "";
  p.body = "";
  p.source_ids = [];
  p.blocks = [{ heading: "", text: "" }];
  p.videos = [
    {
      title: "",
      creator: "",
      url: "",
      source_url: "",
      description: "",
      authorization: "",
      embed_allowed: false,
      tags: [],
      timestamps: [],
    },
  ];
  await expect(
    save({ ...p, title: { html: "<script>" } }, "draft"),
  ).rejects.toThrow("Invalid text field");
  const draft = await save(p, "draft");
  expect(draft.status).toBe("draft");
  await expect(save(p, "review", draft.id, 1)).rejects.toThrow();
  await expect(publish(draft.id, 1)).rejects.toThrow("Review");
  await as(null, "anon");
  expect(
    (
      await db.query(
        "select entry_id from public.meta_editions where content->>'subject_key'=$1",
        [p.subject_key],
      )
    ).rows,
  ).toEqual([]);
});
it("enforces a server-side hourly editorial budget", async () => {
  await as(other);
  for (let i = 0; i < 120; i++)
    await db.query("select public.meta_editor_media_quota()");
  await expect(
    db.query("select public.meta_editor_media_quota()"),
  ).rejects.toThrow("hourly limit");
  await expect(save(payload())).rejects.toThrow("hourly limit");
});
