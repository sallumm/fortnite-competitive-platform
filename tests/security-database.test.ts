import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
it("binds CAPTCHA tickets to user/cycle/expiry and consumes a successful proof exactly once", async () => {
  await db.exec("reset role");
  await db.exec(
    "update private.esports_launch_gate set reviewed=true;update public.esports_settings set recruitment_enabled=true;",
  );
  const cycle = (
    await db.query<{ id: string }>(
      "insert into public.esports_cycles(title,mode,format,criteria,rules,privacy_notice,policy_version,retention_days,starts_at,ends_at,published,is_open) values('Test cycle','build','solo','Test criteria','Test rules detailed','Test privacy notice','v1',30,now()-interval '1 day',now()+interval '1 day',true,true) returning id",
    )
  ).rows[0].id;
  await db.query(
    "insert into public.profiles(id,display_name,mode,level,objective,minutes,input) values($1,'Player','build','beginner','aim',30,'kbm') on conflict(id) do nothing",
    [user],
  );
  const ticket = (
    await db.query<{ id: string }>(
      "select public.issue_captcha_ticket($1,$2) id",
      [user, cycle],
    )
  ).rows[0].id;
  await as(admin, "aal2");
  await expect(
    db.query("select public.esports_submit($1,'{}',$2)", [cycle, ticket]),
  ).rejects.toThrow("CAPTCHA required");
  await as(user);
  await expect(
    db.query("select public.esports_submit($1,'{}',$2)", [user, ticket]),
  ).rejects.toThrow("CAPTCHA required");
  const payload = {
    nickname: "Player",
    epic_nick: "Epic",
    mode: "build",
    format: "solo",
    experience: "intermediate",
    objectives: "Learn",
    availability: "Saturday",
    region: "Brazil",
    motivation: "Improve",
    age_band: "adult",
    accepted: true,
    policy_version: "v1",
    rules_version: "1",
    links: [],
  };
  expect(
    (
      await db.query("select public.esports_submit($1,$2,$3)", [
        cycle,
        payload,
        ticket,
      ])
    ).rows,
  ).toHaveLength(1);
  await expect(
    db.query("select public.esports_submit($1,$2,$3)", [
      cycle,
      payload,
      ticket,
    ]),
  ).rejects.toThrow("CAPTCHA required");
  await db.exec("reset role");
  const expired = (
    await db.query<{ id: string }>(
      "select public.issue_captcha_ticket($1,$2) id",
      [user, cycle],
    )
  ).rows[0].id;
  await db.query(
    "update private.captcha_tickets set expires_at=now()-interval '1 second' where id=$1",
    [expired],
  );
  await as(user);
  await expect(
    db.query("select public.esports_submit($1,$2,$3)", [
      cycle,
      payload,
      expired,
    ]),
  ).rejects.toThrow("CAPTCHA required");
});
let db: PGlite;
const admin = "10000000-0000-4000-8000-000000000001",
  user = "10000000-0000-4000-8000-000000000002";
async function as(id: string, aal = "aal1") {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [id, JSON.stringify({ sub: id, aal })],
  );
  await db.exec("set role authenticated");
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;",
  );
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  for (const id of [admin, user])
    await db.query("insert into auth.users values($1)", [id]);
  await db.query("insert into private.user_roles values($1,'admin')", [admin]);
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("requires AAL2 plus a server role and keeps MFA bootstrap reachable", async () => {
  await as(admin);
  expect(
    (await db.query<{ ok: boolean }>("select public.is_admin() ok")).rows[0].ok,
  ).toBe(false);
  expect(
    (await db.query<{ r: any }>("select public.security_status() r")).rows[0].r,
  ).toEqual({ aal2: false, privileged: true });
  await expect(
    db.query("select public.esports_admin_data()"),
  ).rejects.toThrow();
  await as(user, "aal2");
  expect(
    (await db.query<{ ok: boolean }>("select public.is_admin() ok")).rows[0].ok,
  ).toBe(false);
  await as(admin, "aal2");
  expect(
    (await db.query<{ ok: boolean }>("select public.is_admin() ok")).rows[0].ok,
  ).toBe(true);
  await expect(
    db.query("select public.esports_admin_data()"),
  ).resolves.toBeDefined();
});
it("RLS UPDATE at AAL1 changes zero rows; AAL2 can change the same editorial row", async () => {
  await db.exec("reset role");
  await db.exec(
    "create table public.mfa_regression(id int primary key, value text);insert into public.mfa_regression values(1,'original');alter table public.mfa_regression enable row level security;grant select,update on public.mfa_regression to authenticated;create policy admin_only on public.mfa_regression for all to authenticated using(public.is_admin()) with check(public.is_admin());",
  );
  await as(admin);
  const denied = await db.query(
    "update public.mfa_regression set value='forged' where id=1 returning *",
  );
  expect(denied.rows).toEqual([]);
  await as(admin, "aal2");
  expect(
    (
      await db.query<{ value: string }>(
        "select value from public.mfa_regression",
      )
    ).rows[0].value,
  ).toBe("original");
  expect(
    (
      await db.query(
        "update public.mfa_regression set value='legitimate' where id=1 returning *",
      )
    ).rows,
  ).toHaveLength(1);
});
it("denies private table/functions and retains authenticated constraint validators", async () => {
  await as(user);
  await expect(db.query("select * from private.user_roles")).rejects.toThrow();
  await expect(
    db.query("select private.esports_role('esports_staff')"),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ ok: boolean }>(
        "select private.valid_weekdays(array[1,2]) ok",
      )
    ).rows[0].ok,
  ).toBe(true);
});
it("denies direct CAPTCHA bypass and issuer access; bounds quota per authenticated account", async () => {
  await as(user);
  await expect(
    db.query("select public.esports_submit($1,'{}')", [user]),
  ).rejects.toThrow("CAPTCHA required");
  await expect(
    db.query("select public.issue_captcha_ticket($1,$1)", [user]),
  ).rejects.toThrow("permission denied");
  for (let i = 0; i < 10; i++)
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select public.reserve_captcha_request() ok",
        )
      ).rows[0].ok,
    ).toBe(true);
  expect(
    (
      await db.query<{ ok: boolean }>(
        "select public.reserve_captcha_request() ok",
      )
    ).rows[0].ok,
  ).toBe(false);
  await as(admin);
  expect(
    (
      await db.query<{ ok: boolean }>(
        "select public.reserve_captcha_request() ok",
      )
    ).rows[0].ok,
  ).toBe(true);
});
it("blocks staff shortcuts without MFA and preserves their AAL2 flow", async () => {
  await db.exec("reset role");
  await db.query(
    "insert into public.profiles(id,display_name,mode,level,objective,minutes,input) values($1,'Player','build','beginner','aim',30,'kbm') on conflict(id) do nothing",
    [user],
  );
  await db.query(
    "insert into private.esports_role_grants(user_id,role,starts_at,ends_at,reason) values($1,'esports_staff',now()-interval '1 day',now()+interval '1 day','test fixture')",
    [user],
  );
  await as(user);
  for (const sql of [
    "select public.esports_admin_data()",
    "select public.esports_assessment_admin()",
    "select public.esports_development(true)",
  ])
    await expect(db.query(sql)).rejects.toThrow();
  await expect(
    db.query("select public.esports_development(false)"),
  ).resolves.toBeDefined();
  await as(user, "aal2");
  await expect(
    db.query("select public.esports_admin_data()"),
  ).resolves.toBeDefined();
});
it("enables RLS on every application and private table", async () => {
  await db.exec("reset role");
  expect(
    (
      await db.query(
        "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private') and c.relkind='r' and not c.relrowsecurity",
      )
    ).rows,
  ).toEqual([]);
});
