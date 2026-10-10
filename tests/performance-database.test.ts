import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { uid } from "../src/lib/seed";
let db: PGlite;
const a = uid(9100),
  b = uid(9101),
  plan = uid(9110),
  series = uid(9120),
  other = uid(9121),
  schedule = uid(9130);
async function user(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("set role " + role);
}
async function insertSeries(id: string, owner: string, planId = plan) {
  await db.query(
    "insert into public.activity_series(id,user_id,title,kind,plan_id,timezone,local_time,start_date,weekdays,duration_minutes) values($1,$2,'Tracking','training',$3,'America/New_York','18:00','2026-03-01',array[1,3],30)",
    [id, owner, planId],
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
  );
  for (const file of ["202610100001_core.sql", "202610100002_seed.sql"])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.exec(`insert into auth.users values('${a}'),('${b}');`);
  for (const id of [a, b]) {
    await user(id);
    await db.query(
      "insert into public.profiles values($1,'Jogador','build','intermediate','aim',30,'kbm','America/Sao_Paulo',true,true)",
      [id],
    );
  }
  await user(a);
  await db.query("insert into public.training_plans values($1,$2,'Plano',$3)", [
    plan,
    a,
    JSON.stringify([{ exercise_id: uid(1), minutes: 10 }]),
  ]);
  await db.query(
    "insert into public.scheduled_sessions(id,user_id,plan_id,starts_at) values($1,$2,$3,'2026-03-02T23:00:00Z')",
    [schedule, a, plan],
  );
  const started = (
    await db.query<{ id: string }>("select (public.start_training($1)).id", [
      plan,
    ])
  ).rows[0].id;
  await db.query("select public.finish_training($1,$2,0,false)", [
    started,
    JSON.stringify([{ exercise_id: uid(1), value: 70, note: "Legado" }]),
  ]);
  await db.exec("reset role");
  await db.exec(
    readFileSync("supabase/migrations/202610100003_performance.sql", "utf8"),
  );
  await user(a);
  await insertSeries(series, a);
  await user(b);
  await db.query(
    "insert into public.activity_series(id,user_id,title,kind,timezone,local_time,start_date,weekdays,duration_minutes) values($1,$2,'Estudos','personal','UTC','10:00','2026-03-01',array[1],30)",
    [other, b],
  );
}, 20000);
afterAll(async () => {
  await db.close();
});
describe("Migração incremental, RLS e integridade", () => {
  it("preserva agenda e sessão existentes ao atualizar o banco", async () => {
    await user(a);
    expect(
      (
        await db.query("select * from public.scheduled_sessions where id=$1", [
          schedule,
        ])
      ).rows,
    ).toMatchObject([
      { kind: "training", status: "planned", duration_minutes: null },
    ]);
    expect(
      (await db.query("select * from public.training_sessions")).rows,
    ).toMatchObject([{ status: "completed", xp: 100, schedule_id: null }]);
  });
  it("isola todas as novas tabelas e não permite falsificar proprietário", async () => {
    await user(a);
    expect(
      (await db.query("select * from public.activity_series")).rows,
    ).toHaveLength(1);
    await expect(
      db.query(
        "insert into public.skill_reviews(user_id,skill,assessment) values($1,'aim','unassessed')",
        [b],
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "update public.activity_series set title='Intrusão' where id=$1 returning id",
          [other],
        )
      ).rows,
    ).toHaveLength(0);
    for (const t of [
      "activity_series",
      "calendar_exceptions",
      "training_journals",
      "skill_reviews",
      "planning_preferences",
      "weekly_reports",
    ]) {
      await user(null, "anon");
      await expect(db.exec("select * from public." + t)).rejects.toThrow();
    }
    await user(a);
    await expect(db.exec("select * from private.user_roles")).rejects.toThrow();
  });
  it("valida IANA timezone, weekdays, vínculo de plano e ocorrência", async () => {
    await user(a);
    await expect(
      db.query(
        "update public.activity_series set timezone='Inventado' where id=$1",
        [series],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "update public.activity_series set weekdays=array[1,1] where id=$1",
        [series],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.calendar_exceptions(user_id,series_id,occurrence_date) values($1,$2,'2026-03-03')",
        [a, series],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.calendar_exceptions(user_id,series_id,occurrence_date) values($1,$2,'2026-03-02')",
        [a, other],
      ),
    ).rejects.toThrow();
  });
  it("vínculo explícito de sessão rejeita conta alheia e não duplica conclusão", async () => {
    await user(b);
    await expect(
      db.query(
        "select public.start_scheduled_training($1,null,$2,'2026-03-02')",
        [plan, series],
      ),
    ).rejects.toThrow();
    await user(a);
    await expect(
      db.query(
        "select public.start_scheduled_training($1,null,$2,'2026-03-03')",
        [plan, series],
      ),
    ).rejects.toThrow();
    const started = (
      await db.query<{ id: string }>(
        "select (public.start_scheduled_training($1,null,$2,'2026-03-02')).id",
        [plan, series],
      )
    ).rows[0].id;
    await expect(
      db.query(
        "insert into public.training_journals(user_id,session_id) values($1,$2)",
        [a, started],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("select public.finish_training($1,$2,0,false)", [
        started,
        JSON.stringify([
          {
            exercise_id: uid(1),
            value: 1,
            note: "",
            configuration: "x".repeat(201),
          },
        ]),
      ]),
    ).rejects.toThrow();
    await db.query("select public.finish_training($1,$2,0,false)", [
      started,
      JSON.stringify([
        {
          exercise_id: uid(1),
          value: 75,
          note: "",
          configuration: "Cenário A",
        },
      ]),
    ]);
    await expect(
      db.query(
        "select public.start_scheduled_training($1,null,$2,'2026-03-02')",
        [plan, series],
      ),
    ).rejects.toThrow();
    await db.query(
      "insert into public.training_journals(user_id,session_id,improved,difficulties) values($1,$2,$3,$4)",
      [a, started, "Mais consistência", ["tracking"]],
    );
    await user(b);
    expect(
      (await db.query("select * from public.training_journals")).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into public.training_journals(user_id,session_id) values($1,$2)",
        [b, started],
      ),
    ).rejects.toThrow();
  });
  it("recorrência cancelada e hora inexistente não podem iniciar treino", async () => {
    await user(a);
    await db.query(
      "insert into public.calendar_exceptions(user_id,series_id,occurrence_date,status) values($1,$2,'2026-03-04','cancelled')",
      [a, series],
    );
    await expect(
      db.query(
        "select public.start_scheduled_training($1,null,$2,'2026-03-04')",
        [plan, series],
      ),
    ).rejects.toThrow();
    const gap = uid(9150);
    await insertSeries(gap, a);
    await db.query(
      "update public.activity_series set weekdays=array[0],local_time='02:30' where id=$1",
      [gap],
    );
    await expect(
      db.query(
        "select public.start_scheduled_training($1,null,$2,'2026-03-08')",
        [plan, gap],
      ),
    ).rejects.toThrow();
  });
  it("revisão transacional preserva passado e reverte alterações inválidas", async () => {
    await user(a);
    const id = uid(9160);
    await insertSeries(id, a);
    const row = {
      id: uid(9161),
      user_id: a,
      title: "Nova distribuição",
      kind: "training",
      plan_id: plan,
      timezone: "America/New_York",
      local_time: "19:00",
      start_date: "2026-03-09",
      end_date: null,
      weekdays: [2, 4],
      duration_minutes: 40,
      tournament_id: null,
    };
    await expect(
      db.query("select public.revise_series($1,'2026-03-09',$2)", [
        id,
        JSON.stringify({ ...row, weekdays: [9] }),
      ]),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ end_date: string | null }>(
          "select end_date from public.activity_series where id=$1",
          [id],
        )
      ).rows[0].end_date,
    ).toBeNull();
    await db.query("select public.revise_series($1,'2026-03-09',$2)", [
      id,
      JSON.stringify(row),
    ]);
    expect(
      (
        await db.query<{ end_date: string }>(
          "select end_date::text from public.activity_series where id=$1",
          [id],
        )
      ).rows[0].end_date,
    ).toBe("2026-03-08");
    expect(
      (
        await db.query("select * from public.activity_series where id=$1", [
          row.id,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("persistência de preferências e relatório é privada e respeita constraints", async () => {
    await user(a);
    await db.query(
      "insert into public.planning_preferences values($1,$1,array[1,3],'18:00',45,array['aim','vod'])",
      [a],
    );
    await db.query(
      "insert into public.weekly_reports(user_id,week_start,timezone,summary) values($1,'2026-03-02','America/Sao_Paulo',$2)",
      [
        a,
        JSON.stringify({
          from: "2026-03-02",
          to: "2026-03-08",
          completed: 1,
          planned: 2,
          observations: [],
          suggestions: [],
        }),
      ],
    );
    await expect(
      db.query(
        "insert into public.weekly_reports(user_id,week_start,timezone,summary) values($1,'2026-03-03','UTC','{}')",
        [a],
      ),
    ).rejects.toThrow();
    await user(b);
    expect(
      (await db.query("select * from public.planning_preferences")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.weekly_reports")).rows,
    ).toHaveLength(0);
  });
  it("exclusão de conta remove os novos registros por cascade", async () => {
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [a]);
    for (const t of [
      "activity_series",
      "calendar_exceptions",
      "training_journals",
      "skill_reviews",
      "planning_preferences",
      "weekly_reports",
    ])
      expect(
        (await db.query("select * from public." + t + " where user_id=$1", [a]))
          .rows,
      ).toHaveLength(0);
  });
});
