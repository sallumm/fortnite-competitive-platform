import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { uid, demoPlayer, seed } from "../src/lib/seed";
import lessons from "../src/lib/mastery-catalog";
import { developmentSummary } from "../src/lib/development";
import type { StudyData } from "../src/lib/academy";
let db: PGlite;
const a = uid(93001),
  b = uid(93002),
  plan = uid(93003),
  schedule = uid(93004),
  step = uid(93005);
const catalog = { ...seed, articles: [...seed.articles, ...lessons] };
const lesson = lessons.find((a) => a.slug === "pecas-edicao")!;
const e = seed.exercises.find(
  (e) => lesson.curriculum!.exercise_ids.includes(e.id) && e.measurement,
)!;
async function user(id: string | null, role = "authenticated") {
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
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
  );
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  for (const id of [a, b]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query(
      "insert into public.profiles(id,display_name,mode,level,objective,minutes,input,onboarded) values($1,'Jogador','build','beginner','aim',30,'kbm',true)",
      [id],
    );
  }
}, 30000);
afterAll(async () => db.close());
it("all application tables are protected by RLS after the complete migration sequence", async () => {
  const missing = await db.query(
    "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
  );
  expect(missing.rows).toEqual([]);
});
it("Academy → routine → schedule → session → results → dashboard/report preserves independent evidence and history", async () => {
  await user(a);
  await rpc("public.record_academy_study($1,'completed')", [lesson.id]);
  const steps = [{ id: step, exercise_id: e.id, minutes: 5 }];
  await db.query(
    "insert into public.training_plans(id,user_id,title,mode,steps) values($1,$2,'Aplicação da aula','build',$3)",
    [plan, a, JSON.stringify(steps)],
  );
  await db.query(
    "insert into public.scheduled_sessions(id,user_id,plan_id,starts_at) values($1,$2,$3,now()+interval '1 hour')",
    [schedule, a, plan],
  );
  const session = await rpc(
    "to_jsonb(public.start_scheduled_training($1,$2))",
    [plan, schedule],
  );
  const results = [
    {
      exercise_id: e.id,
      step_id: step,
      status: "completed",
      value: e.measurement!.min,
      unit: e.measurement!.unit,
      version: e.measurement!.version,
      configuration: "mesmo cenário / kbm",
      note: "Registro autodeclarado",
    },
  ];
  await rpc("public.finish_training($1,$2,0,false)", [session.id, results]);
  await rpc("public.finish_training($1,$2,0,false)", [session.id, results]);
  const data = demoPlayer();
  data.profile = { ...data.profile!, id: a, onboarded: true };
  data.sessions = (
    await db.query<any>("select * from public.training_sessions")
  ).rows;
  data.plans = (
    await db.query<any>("select * from public.training_plans")
  ).rows;
  data.schedules = (
    await db.query<any>("select * from public.scheduled_sessions")
  ).rows;
  const study: StudyData = {
    records: (await db.query<any>("select * from public.academy_records")).rows,
    notes: [],
  };
  const summary = developmentSummary(data, catalog, study)!;
  expect(summary.learned.map((a) => a.id)).toContain(lesson.id);
  expect(summary.analysis.sessions).toHaveLength(1);
  expect(summary.analysis.comparisons).toHaveLength(0);
  expect(
    (await db.query("select * from public.xp_transactions")).rows,
  ).toHaveLength(1);
  expect(data.sessions[0].schedule_id).toBe(schedule);
  await db.query("delete from public.training_plans where id=$1", [plan]);
  expect(
    await rpc(
      "(select steps->0->'exercise'->>'title' from public.training_sessions where id=$1)",
      [session.id],
    ),
  ).toBe(e.title);
  expect(
    (await db.query("select * from public.academy_records")).rows,
  ).toHaveLength(1);
});
it("another account cannot read, edit, conclude or export the learner's records, nor publish editorial content", async () => {
  await user(b);
  for (const table of [
    "academy_records",
    "academy_notes",
    "training_plans",
    "scheduled_sessions",
    "training_sessions",
    "xp_transactions",
    "evolution_settings",
    "evolution_batches",
    "coach_messages",
    "learning_journeys",
  ])
    expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(
      0,
    );
  await expect(
    db.query(
      "insert into public.training_plans(id,user_id,title,steps) values($1,$2,'Intrusão',$3)",
      [
        uid(93010),
        a,
        JSON.stringify([{ id: uid(93011), exercise_id: e.id, minutes: 5 }]),
      ],
    ),
  ).rejects.toThrow();
  expect(
    (
      await db.query(
        "update public.articles set published=false where id=$1 returning id",
        [lesson.id],
      )
    ).rows,
  ).toEqual([]);
  await user(null, "anon");
  await expect(
    db.query("select * from public.academy_records"),
  ).rejects.toThrow();
  await expect(
    rpc("public.record_academy_study($1,'completed')", [lesson.id]),
  ).rejects.toThrow();
});
