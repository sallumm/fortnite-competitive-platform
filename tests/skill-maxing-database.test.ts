import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { uid, demoPlayer, seed } from "../src/lib/seed";
import { defaultEvolutionConfig } from "../src/lib/skill-maxing/config";
import { generateEvolution } from "../src/lib/skill-maxing/engine";
import { approvalPayload } from "../src/lib/skill-maxing/service";
import { dateInZone, shiftDate, weekStart } from "../src/lib/calendar";
let db: PGlite;
const owner = uid(9801),
  other = uid(9802);
const d = demoPlayer();
d.profile = { ...d.profile!, id: owner, timezone: "UTC", level: "beginner" };
d.series = [];
d.schedules = [];
d.sessions = [];
const c = defaultEvolutionConfig(d.profile!);
c.skills = [{ id: "shotgun", weight: 3 }];
c.windows = [
  { id: uid(9810), weekday: 1, start: "17:00", end: "18:00", minutes: 30 },
];
const p = generateEvolution(
  c,
  d,
  seed,
  shiftDate(weekStart(dateInZone(new Date(), "UTC")), 7),
  1,
  new Date(),
);
const payload = approvalPayload(p);
async function asUser(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("set role " + role);
}
async function confirm(token: string, body = payload) {
  return db.query(
    "select public.confirm_evolution_plan($1,$2,$3,$4,$5,$6) as result",
    [
      token,
      body.p_from,
      body.p_weeks,
      body.p_config,
      body.p_sessions,
      body.p_rules,
    ],
  );
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
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  await db.query(
    "insert into public.profiles(id,display_name,mode,level,objective,minutes,input) values($1,'Player','build','beginner','aim',30,'kbm'),($2,'Other','build','beginner','aim',30,'kbm')",
    [owner, other],
  );
}, 30000);
afterAll(async () => db.close());
it("requires authentication and validates configuration on the server", async () => {
  await asUser(null, "anon");
  await expect(confirm(uid(9820))).rejects.toThrow();
  await asUser(owner);
  await expect(
    db.query("select public.save_evolution_config($1)", [
      { ...c, windows: [{ ...c.windows[0], minutes: 121 }] },
    ]),
  ).rejects.toThrow();
  await db.query("select public.save_evolution_config($1)", [c]);
});
it("atomically saves routines and existing recurrence with idempotent explicit approval", async () => {
  await asUser(owner);
  const a = await confirm(uid(9821));
  expect(a.rows).toHaveLength(1);
  expect(
    (await db.query("select * from public.training_plans")).rows,
  ).toHaveLength(1);
  expect(
    (await db.query("select * from public.activity_series")).rows,
  ).toHaveLength(1);
  expect((await confirm(uid(9821))).rows).toEqual(a.rows);
  await expect(
    confirm(uid(9821), { ...payload, p_weeks: 2 }),
  ).rejects.toThrow();
});
it("rejects a newly conflicting agenda without partially saving any plan", async () => {
  await asUser(owner);
  await expect(confirm(uid(9822))).rejects.toThrow(/conflict/i);
  expect(
    (await db.query("select * from public.training_plans")).rows,
  ).toHaveLength(1);
  expect(
    (await db.query("select * from public.evolution_batches")).rows,
  ).toHaveLength(1);
});
it("isolates settings, approvals and routines between accounts and denies direct writes", async () => {
  await asUser(other);
  for (const table of [
    "evolution_settings",
    "evolution_batches",
    "training_plans",
    "activity_series",
  ])
    expect((await db.query("select * from public." + table)).rows).toHaveLength(
      0,
    );
  await expect(confirm(uid(9821))).rejects.toThrow();
  await expect(
    db.query("insert into public.evolution_settings values($1,$2,now())", [
      owner,
      c,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("update public.evolution_settings set config=$1 where id=$2", [
      c,
      owner,
    ]),
  ).rejects.toThrow();
});
it("matches first repeated DST time and rejects nonexistent wall times", async () => {
  await db.exec("reset role");
  const a = await db.query(
    "select private.evolution_instant('2026-11-01','01:30','America/New_York')::text as t, private.evolution_instant('2027-03-14','02:30','America/New_York') as gap",
  );
  expect(a.rows[0]).toMatchObject({ t: "2026-11-01 05:30:00+00", gap: null });
});
it("rolls back an earlier valid session when a later session is invalid", async () => {
  await asUser(other);
  const body = structuredClone(payload);
  body.p_config.windows.push({
    id: uid(9830),
    weekday: 3,
    start: "17:00",
    end: "18:00",
    minutes: 30,
  });
  body.p_sessions.push({
    ...structuredClone(body.p_sessions[0]),
    date: shiftDate(payload.p_from, 2),
  });
  body.p_sessions[1].plan.steps[0].minutes = 121;
  await expect(confirm(uid(9831), body)).rejects.toThrow();
  expect(
    (await db.query("select * from public.training_plans")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from public.activity_series")).rows,
  ).toHaveLength(0);
});
it("limits repeated approvals independently from agenda conflict checks", async () => {
  await db.exec("reset role");
  await db.query(
    "insert into public.evolution_batches(id,user_id,payload,result) select gen_random_uuid(),$1,'{}','[]' from generate_series(1,20)",
    [other],
  );
  await asUser(other);
  await expect(confirm(uid(9832))).rejects.toThrow(/limit/i);
});
