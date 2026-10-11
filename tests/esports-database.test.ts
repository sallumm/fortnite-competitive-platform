import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite, cycle: string, application: string;
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002",
  admin = "10000000-0000-4000-8000-000000000003",
  staff = "10000000-0000-4000-8000-000000000004";
async function as(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("set role " + role);
}
async function rpc(sql: string, args: unknown[] = []) {
  return (await db.query<{ r: any }>("select " + sql + " as r", args)).rows[0]
    .r;
}
const settings = {
  recruitment_enabled: true,
  official_discord: "",
  introduction: "Organização em desenvolvimento",
  trial_intro: "Avaliação privada",
  support_text: "Contato dentro da plataforma",
};
const payload = {
  nickname: "Jogador",
  epic_nick: "Epic",
  mode: "build",
  format: "solo",
  experience: "intermediário",
  objectives: "Desenvolver habilidades",
  availability: "Sábados",
  region: "Brasil",
  motivation: "Aprender",
  age_band: "adult",
  accepted: true,
  policy_version: "v1",
  rules_version: "1",
  links: [],
};
async function action(
  name: string,
  id: string | null = null,
  version = 0,
  data: unknown = {},
) {
  return rpc("public.esports_admin_action($1,$2,$3,$4)", [
    name,
    id,
    version,
    data,
  ]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
  );
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  for (const id of [a, b, admin, staff]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query(
      "insert into public.profiles(id,display_name,mode,level,objective,minutes,input) values($1,'Player','build','beginner','aim',30,'kbm')",
      [id],
    );
  }
  await db.query("insert into private.user_roles values($1,'admin')", [admin]);
}, 30000);
afterAll(async () => db.close());
it("keeps launch closed, hides trial guidance and denies anonymous writes", async () => {
  await as(null, "anon");
  const p = await rpc("public.esports_portal()");
  expect(p.operational).toBe(false);
  expect(p.settings).not.toHaveProperty("trial_intro");
  await expect(rpc("public.esports_workspace()")).rejects.toThrow();
  await expect(
    db.query("select * from private.esports_launch_gate"),
  ).rejects.toThrow();
  await as(admin);
  await expect(action("settings", null, 1, settings)).rejects.toThrow(/review/);
  const c = await action("cycle", null, 0, {
    title: "Seleção de teste",
    mode: "both",
    format: "solo",
    criteria: "Critérios publicados completos",
    rules: "Regras publicadas completas",
    privacy_notice: "Aviso privado de teste completo",
    policy_version: "v1",
    retention_days: 30,
    starts_at: new Date(Date.now() - 3600000).toISOString(),
    ends_at: new Date(Date.now() + 86400000).toISOString(),
    published: true,
    is_open: false,
    allow_minors: false,
  });
  cycle = c.id;
  await as(a);
  await expect(
    rpc("public.esports_submit($1,$2)", [cycle, payload]),
  ).rejects.toThrow(/closed/);
});
it("validates mandatory fields, whitelist, consent versions and duplicate submissions", async () => {
  await db.exec("reset role");
  await db.exec("update private.esports_launch_gate set reviewed=true");
  await as(admin);
  await action("settings", null, 1, settings);
  await db.exec("reset role");
  await db.query("update public.esports_cycles set is_open=true where id=$1", [
    cycle,
  ]);
  await as(a);
  for (const p of [
    { ...payload, mode: null },
    { ...payload, age_band: null },
    { ...payload, policy_version: "old" },
    { ...payload, links: ["javascript:alert(1)"] },
    { ...payload, nickname: "" },
  ])
    await expect(
      rpc("public.esports_submit($1,$2)", [cycle, p]),
    ).rejects.toThrow();
  application = await rpc("public.esports_submit($1,$2)", [
    cycle,
    { ...payload, secret_document: "never store" },
  ]);
  const w = await rpc("public.esports_workspace()");
  expect(w.applications[0].payload).not.toHaveProperty("secret_document");
  expect(w.applications[0].consent_snapshot.rules).toContain("Regras");
  expect(w.roles[0].role).toBe("applicant");
  await expect(
    rpc("public.esports_submit($1,$2)", [cycle, payload]),
  ).rejects.toThrow(/already/);
  await expect(
    db.query(
      "update public.esports_applications set status='academy_selected'",
    ),
  ).rejects.toThrow();
});
it("isolates applicants and internal notes at RPC and table boundaries", async () => {
  await as(b);
  expect(
    (await db.query("select * from public.esports_applications")).rows,
  ).toHaveLength(0);
  await expect(
    rpc("public.esports_withdraw($1)", [application]),
  ).rejects.toThrow();
  await expect(rpc("public.esports_admin_data()")).rejects.toThrow();
  await as(admin);
  await action("note", application, 1, { note: "Anotação confidencial" });
  await as(a);
  const w = await rpc("public.esports_workspace()");
  expect(JSON.stringify(w)).not.toContain("confidencial");
  await expect(
    db.query("select * from private.esports_reviews"),
  ).rejects.toThrow();
});
it("limits staff to assigned applications and reserves decisions to admins", async () => {
  await as(admin);
  await action("grant_role", null, 0, {
    user_id: staff,
    role: "esports_staff",
    ends_at: new Date(Date.now() + 86400000).toISOString(),
    reason: "Avaliador designado",
  });
  await as(staff);
  expect((await rpc("public.esports_admin_data()")).applications).toHaveLength(
    0,
  );
  await expect(
    action("note", application, 1, { note: "Sem vínculo" }),
  ).rejects.toThrow();
  await as(admin);
  await action("assign_reviewer", application, 0, { user_id: staff });
  await as(staff);
  expect((await rpc("public.esports_admin_data()")).applications).toHaveLength(
    1,
  );
  await action("practical", application, 1, {
    note: "VOD analisado: movimentação",
  });
  await expect(
    action("status", application, 1, {
      status: "under_review",
      message: "Analisando candidatura",
      reason: "Triagem humana",
    }),
  ).rejects.toThrow(/decision/);
});
it("enforces transitions, optimistic versions and explicit scoped role grants", async () => {
  await as(admin);
  await expect(
    action("status", application, 1, {
      status: "academy_selected",
      message: "Escolhido",
      reason: "Escolhido",
    }),
  ).rejects.toThrow(/explicit scholarship or roster/);
  await action("status", application, 1, {
    status: "under_review",
    message: "Analisando candidatura",
    reason: "Triagem humana",
  });
  await expect(
    action("status", application, 1, {
      status: "trial_invited",
      message: "Convite",
      reason: "Convite",
    }),
  ).rejects.toThrow(/Version/);
  await action("status", application, 2, {
    status: "trial_invited",
    message: "Convite para avaliação privada",
    reason: "Critérios atendidos",
  });
  await expect(
    action("grant_role", application, 0, {
      user_id: admin,
      role: "trialist",
      ends_at: new Date(Date.now() + 86400000).toISOString(),
      reason: "Convite",
    }),
  ).rejects.toThrow();
  await expect(
    action("grant_role", application, 0, {
      user_id: b,
      role: "trialist",
      ends_at: new Date(Date.now() + 86400000).toISOString(),
      reason: "Convite",
    }),
  ).rejects.toThrow();
  await action("grant_role", application, 0, {
    user_id: a,
    role: "trialist",
    ends_at: new Date(Date.now() + 86400000).toISOString(),
    reason: "Convite humano",
  });
  await as(a);
  expect((await rpc("public.esports_workspace()")).trial_intro).toBe(
    "Avaliação privada",
  );
});
it("requires reviewed minor protection and valid per-cycle authorization", async () => {
  await as(b);
  await expect(
    rpc("public.esports_submit($1,$2)", [
      cycle,
      { ...payload, age_band: "adolescent" },
    ]),
  ).rejects.toThrow(/authorization/);
  await db.exec("reset role");
  await db.exec("update private.esports_launch_gate set minors_reviewed=true");
  await db.query(
    "update public.esports_cycles set allow_minors=true where id=$1",
    [cycle],
  );
  await as(admin);
  await action("authorization", cycle, 0, {
    user_id: b,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    policy_version: "wrong",
    reference: "Verificação externa pendente",
  });
  await as(b);
  await expect(
    rpc("public.esports_submit($1,$2)", [
      cycle,
      { ...payload, age_band: "adolescent" },
    ]),
  ).rejects.toThrow(/authorization/);
  await as(admin);
  await action("authorization", cycle, 0, {
    user_id: b,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    policy_version: "v1",
    reference: "Referência verificada fora da plataforma",
  });
  await as(b);
  expect(
    await rpc("public.esports_submit($1,$2)", [
      cycle,
      { ...payload, age_band: "adolescent" },
    ]),
  ).toBeTruthy();
});
it("removes trial access immediately on withdrawal and records audit", async () => {
  await as(a);
  await rpc("public.esports_withdraw($1)", [application]);
  const w = await rpc("public.esports_workspace()");
  expect(w.roles).toHaveLength(0);
  expect(w.trial_intro).toBeNull();
  expect(w.applications[0].status).toBe("withdrawn");
  await as(admin);
  expect(
    (await rpc("public.esports_admin_data()")).audit.some(
      (x: any) => x.action === "withdrawn",
    ),
  ).toBe(true);
});
