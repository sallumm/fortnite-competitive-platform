import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { uid, demoPlayer, seed as baseSeed } from "../src/lib/seed";
import lessons from "../src/lib/mastery-catalog";
import { defaultEvolutionConfig } from "../src/lib/skill-maxing/config";
import {
  snapshotProgram,
  stageProposal,
  type Journey,
} from "../src/lib/road/domain";
import { approvalPayload } from "../src/lib/skill-maxing/service";
import { dateInZone, shiftDate, weekday } from "../src/lib/calendar";
let db: PGlite,
  journey: string,
  zero: string,
  token: string,
  plan: string,
  session: string;
const a = uid(99001),
  b = uid(99002),
  editor = uid(99003),
  catalog = { ...baseSeed, articles: [...baseSeed.articles, ...lessons] };
async function asUser(id: string | null, role = "authenticated") {
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
function config(mode: "build" | "zero" = "build") {
  const p = demoPlayer().profile!;
  p.mode = mode;
  return {
    ...defaultEvolutionConfig(p),
    windows: [
      {
        id: crypto.randomUUID(),
        weekday: 1,
        start: "17:00",
        end: "18:00",
        minutes: 10,
      },
    ],
    opposition: "solo" as const,
  };
}
function setup(mode: "build" | "zero" = "build") {
  return {
    config: config(mode),
    experience: "first",
    familiarity: "Não conheço rotação",
    start_date: dateInZone(new Date(), "America/Sao_Paulo"),
  };
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
  for (const u of [a, b, editor]) {
    await db.query("insert into auth.users values($1)", [u]);
    await db.query(
      "insert into public.profiles(id,display_name,mode,level,objective,minutes,input) values($1,'Learner','build','beginner','aim',30,'kbm')",
      [u],
    );
  }
  await db.query("insert into private.user_roles values($1,'admin')", [editor]);
}, 30000);
afterAll(async () => db.close());
it("creates source-derived snapshots, requires authentication and isolates accounts", async () => {
  await asUser(null, "anon");
  await expect(
    rpc("public.create_learning_journey($1,$2)", [
      crypto.randomUUID(),
      setup(),
    ]),
  ).rejects.toThrow();
  await asUser(a);
  journey = crypto.randomUUID();
  const input = setup();
  await rpc("public.create_learning_journey($1,$2)", [journey, input]);
  expect(
    await rpc("public.create_learning_journey($1,$2)", [journey, input]),
  ).toBe(journey);
  const j = await rpc("(select to_jsonb(j) from public.learning_journeys j)");
  expect(j.snapshot.lessons.length).toBeGreaterThan(10);
  expect(j.snapshot.lessons[0].article.body.length).toBeGreaterThan(500);
  await expect(
    rpc("public.create_learning_journey($1,$2)", [crypto.randomUUID(), input]),
  ).rejects.toThrow(/open/);
  await expect(
    db.query("update public.learning_journeys set snapshot='{}' where id=$1", [
      journey,
    ]),
  ).rejects.toThrow();
  await asUser(b);
  expect(
    (await db.query("select * from public.learning_journeys")).rows,
  ).toHaveLength(0);
  await expect(
    rpc("public.record_learning_journey($1,'completed',$2)", [
      journey,
      uid(2201),
    ]),
  ).rejects.toThrow();
  zero = await rpc("public.create_learning_journey($1,$2)", [
    crypto.randomUUID(),
    setup("zero"),
  ]);
  const z = await rpc("(select snapshot from public.learning_journeys)");
  expect(
    z.lessons.every((l: any) => l.article.curriculum.modes.includes("zero")),
  ).toBe(true);
  expect(
    z.lessons.some((l: any) => l.article.slug === "piece-box-realistic"),
  ).toBe(false);
});
it("records optional assessments against enrolled versions and preserves Academy history", async () => {
  await asUser(a);
  await rpc("public.record_learning_journey($1,'completed',$2)", [
    journey,
    uid(2201),
  ]);
  await expect(
    rpc("public.record_learning_journey($1,'assessment',$2,'[]')", [
      journey,
      uid(2201),
    ]),
  ).rejects.toThrow(/Complete/);
  await expect(
    rpc("public.record_learning_journey($1,'assessment',$2,'[9]')", [
      journey,
      uid(2201),
    ]),
  ).rejects.toThrow(/answer/);
  await rpc(
    "public.record_learning_journey($1,'assessment',$2,'[1]','Não confundir conta com habilidade')",
    [journey, uid(2201)],
  );
  await expect(
    rpc("public.record_learning_journey($1,'completed',$2)", [
      journey,
      uid(2220),
    ]),
  ).rejects.toThrow(/outside/);
  await asUser(editor);
  await db.query(
    "update public.articles set title='Fonte revisada',academy_questions='[]' where id=$1",
    [uid(2201)],
  );
  await asUser(a);
  const before = await rpc(
    "(select snapshot from public.academy_records where action='assessment')",
  );
  expect(before.title).not.toBe("Fonte revisada");
  expect(before.questions).toHaveLength(1);
  await rpc("public.record_learning_journey($1,'assessment',$2,'[1]')", [
    journey,
    uid(2201),
  ]);
  expect(
    (await db.query("select * from public.academy_records")).rows,
  ).toHaveLength(3);
});
it("pause, resume and availability changes preserve all evidence and require valid transitions", async () => {
  await asUser(a);
  await rpc("public.record_learning_journey($1,'pause')", [journey]);
  await expect(
    rpc("public.record_learning_journey($1,'completed',$2)", [
      journey,
      uid(2202),
    ]),
  ).rejects.toThrow(/Resume/);
  expect(
    (await db.query("select * from public.academy_records")).rows,
  ).toHaveLength(3);
  await rpc("public.record_learning_journey($1,'resume')", [journey]);
  const c = await rpc("(select config from public.learning_journeys)");
  await expect(
    rpc("public.update_learning_journey($1,$2)", [
      journey,
      { ...c, mode: "zero" },
    ]),
  ).rejects.toThrow();
  c.windows[0].minutes = 5;
  await rpc("public.update_learning_journey($1,$2)", [journey, c]);
  expect(
    (await db.query("select * from public.academy_records")).rows,
  ).toHaveLength(3);
});
it("reuses atomic planning, rolls back invalid approvals and validates persisted availability", async () => {
  await asUser(a);
  const j = (await rpc(
    "(select to_jsonb(j) from public.learning_journeys j)",
  )) as Journey;
  const d = demoPlayer();
  d.profile!.id = a;
  d.profile!.level = "beginner";
  d.plans = [];
  d.sessions = [];
  d.series = [];
  d.schedules = [];
  d.exceptions = [];
  const today = dateInZone(new Date(), j.config.timezone),
    from = shiftDate(today, (8 - weekday(today)) % 7 || 7);
  const p = stageProposal(j, 1, j.config, d, catalog, from);
  const payload = approvalPayload(p);
  token = crypto.randomUUID();
  const args = [
    journey,
    1,
    token,
    from,
    p.config,
    payload.p_sessions,
    p.rules_version,
    "AGENDAR",
  ];
  await expect(
    rpc("public.confirm_learning_plan($1,$2,$3,$4,$5,$6,$7,$8)", [
      ...args.slice(0, 7),
      "SIM",
    ]),
  ).rejects.toThrow(/confirmation/);
  const bad = structuredClone(p.config);
  bad.windows[0].minutes = 10;
  await expect(
    rpc("public.confirm_learning_plan($1,$2,$3,$4,$5,$6,$7,$8)", [
      journey,
      1,
      crypto.randomUUID(),
      from,
      bad,
      payload.p_sessions,
      p.rules_version,
      "AGENDAR",
    ]),
  ).rejects.toThrow(/Availability/);
  expect(
    (await db.query("select * from public.training_plans")).rows,
  ).toHaveLength(0);
  const result = await rpc(
    "public.confirm_learning_plan($1,$2,$3,$4,$5,$6,$7,$8)",
    args,
  );
  plan = result[0].plan_id;
  expect(
    await rpc("public.confirm_learning_plan($1,$2,$3,$4,$5,$6,$7,$8)", args),
  ).toEqual(result);
  expect(
    (await db.query("select * from public.learning_journey_batches")).rows,
  ).toHaveLength(1);
  expect(
    await rpc(
      "(select learning_journey_id from public.training_plans where id=$1)",
      [plan],
    ),
  ).toBe(journey);
  expect(
    await rpc(
      "(select practice_format from public.training_plans where id=$1)",
      [plan],
    ),
  ).toBe("solo");
  await expect(
    rpc("public.confirm_learning_plan($1,$2,$3,$4,$5,$6,$7,$8)", [
      journey,
      2,
      crypto.randomUUID(),
      from,
      p.config,
      payload.p_sessions,
      p.rules_version,
      "AGENDAR",
    ]),
  ).rejects.toThrow(/conflict/i);
  expect(
    (await db.query("select * from public.training_plans")).rows,
  ).toHaveLength(result.length);
});
it("session snapshots stay linked after routine deletion; cross-user links cannot be forged", async () => {
  await asUser(a);
  const s = await rpc("to_jsonb(public.start_training($1))", [plan]);
  session = s.id;
  expect(s.learning_journey_id).toBe(journey);
  await expect(
    db.query(
      "update public.training_sessions set learning_journey_id=null where id=$1",
      [session],
    ),
  ).rejects.toThrow();
  await db.exec("reset role");
  await expect(
    db.query(
      "update public.training_sessions set learning_journey_id=null where id=$1",
      [session],
    ),
  ).rejects.toThrow(/immutable/);
  await asUser(a);
  await expect(
    db.query(
      "update public.training_plans set learning_journey_id=$1 where id=$2",
      [zero, plan],
    ),
  ).rejects.toThrow(/owner/);
  await db.query("delete from public.training_plans where id=$1", [plan]);
  expect(
    await rpc(
      "(select learning_journey_id from public.training_sessions where id=$1)",
      [session],
    ),
  ).toBe(journey);
  expect(
    await rpc("(select plan_id from public.training_sessions where id=$1)", [
      session,
    ]),
  ).toBeNull();
});
it("coach reads only a minimal consented own summary; final report records remain after new cycle", async () => {
  await asUser(a);
  expect(await rpc("public.coach_learning_journey($1)", [journey])).toBeNull();
  await db.query(
    "insert into public.coach_preferences(id,context_enabled) values($1,true)",
    [a],
  );
  const summary = await rpc("public.coach_learning_journey($1)", [journey]);
  expect(summary.studied).toBe(1);
  expect(summary).not.toHaveProperty("familiarity");
  expect(summary).not.toHaveProperty("notes");
  await asUser(b);
  expect(await rpc("public.coach_learning_journey($1)", [journey])).toBeNull();
  await asUser(a);
  await rpc("public.record_learning_journey($1,'finish')", [journey]);
  await expect(
    rpc("public.record_learning_journey($1,'resume')", [journey]),
  ).rejects.toThrow();
  const second = await rpc("public.create_learning_journey($1,$2)", [
    crypto.randomUUID(),
    setup(),
  ]);
  expect(second).not.toBe(journey);
  expect(
    (await db.query("select * from public.learning_journeys")).rows,
  ).toHaveLength(2);
  expect(
    (await db.query("select * from public.academy_records")).rows,
  ).toHaveLength(3);
});
it("enforces quota, explicit deletion and preserves separately owned training/Academy data", async () => {
  await asUser(a);
  await expect(
    rpc("public.delete_learning_journey($1,'SIM')", [journey]),
  ).rejects.toThrow(/confirmation/);
  await asUser(null, "anon");
  await expect(
    rpc("public.delete_learning_journey($1,'EXCLUIR JORNADA')", [journey]),
  ).rejects.toThrow();
  await asUser(b);
  await rpc("public.delete_learning_journey($1,'EXCLUIR JORNADA')", [journey]);
  await asUser(a);
  expect(
    (
      await db.query("select * from public.learning_journeys where id=$1", [
        journey,
      ])
    ).rows,
  ).toHaveLength(1);
  await rpc("public.delete_learning_journey($1,'EXCLUIR JORNADA')", [journey]);
  expect(
    await rpc(
      "(select learning_journey_id from public.training_sessions where id=$1)",
      [session],
    ),
  ).toBeNull();
  expect(
    (await db.query("select * from public.academy_records")).rows,
  ).toHaveLength(3);
});

it("bounds learning write quotas independently of private assessment and requires owner authorization", async () => {
  await asUser(a);
  const active = await rpc(
    "(select id from public.learning_journeys where status='active')",
  );
  await db.exec("reset role");
  await db.query(
    "insert into public.learning_journey_events(user_id,journey_id,action) select $1,$2,'preferences' from generate_series(1,120)",
    [a, active],
  );
  await asUser(a);
  await expect(
    rpc("public.record_learning_journey($1,'pause')", [active]),
  ).rejects.toThrow(/limit/);
  const c = await rpc(
    "(select config from public.learning_journeys where id=$1)",
    [active],
  );
  await expect(
    rpc("public.update_learning_journey($1,$2)", [active, c]),
  ).rejects.toThrow(/limit/);
  expect(
    await rpc("(select status from public.learning_journeys where id=$1)", [
      active,
    ]),
  ).toBe("active");
});
