import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { uid } from "../src/lib/seed";
import { trainingCatalog } from "../src/lib/training-catalog";
let db: PGlite;
const a = uid(9800),
  b = uid(9801),
  plan = uid(9810),
  legacy = uid(9811);
async function user(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("set role " + role);
}
const steps = [...trainingCatalog.slice(0, 6), trainingCatalog[0]].map(
  (e, i) => ({
    id: uid(9820 + i),
    exercise_id: e.id,
    minutes: 5,
    block: "Prática",
    notes: "Observar execução",
    repetitions: 10,
  }),
);
const results = steps.map((st) => {
  const e = trainingCatalog.find((e) => e.id === st.exercise_id)!;
  return {
    exercise_id: e.id,
    step_id: st.id,
    value: 5,
    note: "Observado",
    status: "completed",
    unit: e.measurement!.unit,
    version: e.measurement!.version,
    configuration: "cenário fixo / kbm / 60s",
  };
});
let session: { id: string; steps: unknown[]; checkpoint_version: number };
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
  );
  for (const file of readdirSync("supabase/migrations")
    .sort()
    .filter((f) => f.endsWith(".sql"))) {
    if (file.includes("007")) {
      await db.exec(`insert into auth.users values('${a}'),('${b}');`);
      for (const id of [a, b]) {
        await user(id);
        await db.query(
          "insert into public.profiles values($1,'Jogador','build','intermediate','aim',30,'kbm','America/Sao_Paulo',true,true)",
          [id],
        );
      }
      await user(a);
      await db.query(
        "insert into public.training_plans(id,user_id,title,steps) values($1,$2,'Legado',$3)",
        [legacy, a, JSON.stringify([{ exercise_id: uid(1), minutes: 10 }])],
      );
      await db.exec("reset role");
    }
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  }
  await user(a);
}, 30000);
afterAll(async () => {
  await db.close();
});
it("migração preserva plano antigo e atribui identidades sem apagar etapas", async () => {
  const row = (
    await db.query<{ steps: { id: string; exercise_id: string }[] }>(
      "select steps from public.training_plans where id=$1",
      [legacy],
    )
  ).rows[0];
  expect(row.steps[0].exercise_id).toBe(uid(1));
  expect(row.steps[0].id).toMatch(/^[a-f0-9-]{36}$/);
});
it("salva seis habilidades e repetições; rejeita IDs repetidos, mapas personalizados e modalidade incompatível", async () => {
  await db.query(
    "insert into public.training_plans(id,user_id,title,steps) values($1,$2,'Completo',$3)",
    [plan, a, JSON.stringify(steps)],
  );
  await expect(
    db.query("update public.training_plans set steps=$1 where id=$2", [
      JSON.stringify([steps[0], steps[0]]),
      plan,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("update public.training_plans set mode='zero' where id=$1", [
      plan,
    ]),
  ).rejects.toThrow();
  const custom = {
    ...steps[0],
    exercise_id: uid(9870),
    custom: {
      id: uid(9870),
      title: "Privado",
      instructions: "Revisar decisões de uma partida própria.",
      map_code: "1234-1234-1234",
      source_url: "",
      mode: "both",
      published: false,
    },
  };
  await expect(
    db.query("update public.training_plans set steps=$1 where id=$2", [
      JSON.stringify([custom]),
      plan,
    ]),
  ).rejects.toThrow();
  custom.custom.map_code = null as never;
  await db.query(
    "insert into public.training_plans(id,user_id,title,steps) values($1,$2,'Personalizado',$3)",
    [uid(9871), a, JSON.stringify([custom])],
  );
});
it("RLS impede ler, editar, iniciar e falsificar dados de outra conta", async () => {
  await user(b);
  expect(
    (await db.query("select id from public.training_plans where id=$1", [plan]))
      .rows,
  ).toHaveLength(0);
  await expect(
    db.query("select public.start_training($1)", [plan]),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into public.training_plans(id,user_id,title,steps) values($1,$2,'Ataque',$3)",
      [uid(9872), a, JSON.stringify(steps)],
    ),
  ).rejects.toThrow();
  await user(a);
});
it("execução usa snapshot real e rejeita resultados falsos, incompatíveis e conclusão implícita", async () => {
  session = (
    await db.query<{ s: typeof session }>(
      "select to_jsonb(public.start_training($1)) s",
      [plan],
    )
  ).rows[0].s;
  expect(session.steps).toHaveLength(7);
  const wrong = results.map((r) => ({ ...r }));
  delete (wrong[0] as { status?: string }).status;
  await expect(
    db.query("select public.finish_training($1,$2,0,false)", [
      session.id,
      JSON.stringify(wrong),
    ]),
  ).rejects.toThrow();
  wrong[0] = results[0];
  wrong[2] = { ...wrong[2], value: 11 };
  await expect(
    db.query("select public.finish_training($1,$2,0,false)", [
      session.id,
      JSON.stringify(wrong),
    ]),
  ).rejects.toThrow();
  await user(b);
  await expect(
    db.query("select public.finish_training($1,$2,0,false)", [
      session.id,
      JSON.stringify(results),
    ]),
  ).rejects.toThrow();
  await user(a);
});
it("checkpoint validado isola conta, limita relógio e rejeita aba desatualizada", async () => {
  const checkpoint = {
    elapsed: 0,
    since: null,
    done: steps.map(() => false),
    results,
    activeStep: 2,
  };
  await db.query("select public.save_training_checkpoint($1,$2,0)", [
    session.id,
    JSON.stringify(checkpoint),
  ]);
  await expect(
    db.query("select public.save_training_checkpoint($1,$2,0)", [
      session.id,
      JSON.stringify(checkpoint),
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("select public.save_training_checkpoint($1,$2,1)", [
      session.id,
      JSON.stringify({ ...checkpoint, elapsed: 86400 }),
    ]),
  ).rejects.toThrow();
  await user(b);
  await expect(
    db.query("select public.save_training_checkpoint($1,$2,1)", [
      session.id,
      JSON.stringify(checkpoint),
    ]),
  ).rejects.toThrow();
  await user(a);
});
it("conclusão idempotente, correção auditada, histórico após exclusão e proteção do XP", async () => {
  await db.query("select public.finish_training($1,$2,0,false)", [
    session.id,
    JSON.stringify(results),
  ]);
  await db.query("select public.finish_training($1,$2,0,false)", [
    session.id,
    JSON.stringify(results),
  ]);
  expect(
    (await db.query("select id from public.xp_transactions")).rows,
  ).toHaveLength(1);
  await db.query("select public.correct_training_result($1,0,$2,0)", [
    session.id,
    JSON.stringify({ ...results[0], value: 3 }),
  ]);
  expect(
    (await db.query("select * from public.training_result_revisions")).rows,
  ).toHaveLength(1);
  await expect(
    db.query("select public.correct_training_result($1,0,$2,0)", [
      session.id,
      JSON.stringify(results[0]),
    ]),
  ).rejects.toThrow();
  await user(b);
  expect(
    (await db.query("select * from public.training_result_revisions")).rows,
  ).toHaveLength(0);
  await expect(
    db.query("select public.correct_training_result($1,0,$2,1)", [
      session.id,
      JSON.stringify(results[0]),
    ]),
  ).rejects.toThrow();
  await user(a);
  await db.query("delete from public.training_plans where id=$1", [plan]);
  const row = (
    await db.query<{ plan_id: null; steps: unknown[]; xp: number }>(
      "select plan_id,steps,xp from public.training_sessions where id=$1",
      [session.id],
    )
  ).rows[0];
  expect(row.plan_id).toBeNull();
  expect(row.steps).toHaveLength(7);
  expect(row.xp).toBe(100);
  await user(null, "anon");
  await expect(
    db.exec("select * from public.training_result_revisions"),
  ).rejects.toThrow();
});

it("metas mensuráveis exigem unidade, limites e configuração, sem alterar metas antigas", async () => {
  await user(a);
  const e = trainingCatalog[1];
  const measurement = {
    exercise_id: e.id,
    unit: e.measurement!.unit,
    version: e.measurement!.version,
    baseline: 50,
    desired: 40,
    configuration: "percurso A",
    deadline: "2026-12-01",
  };
  await db.query(
    "insert into public.personal_goals(id,user_id,title,target,measurement) values($1,$2,'Tempo de edição',1,$3)",
    [uid(9880), a, JSON.stringify(measurement)],
  );
  await expect(
    db.query("update public.personal_goals set measurement=$1 where id=$2", [
      JSON.stringify({ ...measurement, unit: "%" }),
      uid(9880),
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("update public.personal_goals set measurement=$1 where id=$2", [
      JSON.stringify({ ...measurement, desired: -1 }),
      uid(9880),
    ]),
  ).rejects.toThrow();
  await user(b);
  expect(
    (await db.query("select * from public.personal_goals")).rows,
  ).toHaveLength(0);
  await user(a);
});
it("fontes ativas inválidas são rejeitadas antes de salvar", async () => {
  await expect(
    db.query(
      "insert into public.training_plans(id,user_id,title,steps) values($1,$2,'Link inválido',$3)",
      [
        uid(9881),
        a,
        JSON.stringify([{ ...steps[0], resource_url: "javascript:alert(1)" }]),
      ],
    ),
  ).rejects.toThrow();
});
it("Coach recebe identidades e condições comparáveis com consentimento, sem notas privadas e sem outra conta", async () => {
  await user(a);
  expect(
    (
      await db.query<{ value: object }>(
        "select public.coach_context('report',30,'aim') value",
      )
    ).rows[0].value,
  ).toEqual({});
  await db.query(
    "insert into public.coach_preferences(id,context_enabled) values($1,true)",
    [a],
  );
  const context = (
    await db.query<{
      value: {
        sessions: { steps: { id: string }[]; results: typeof results }[];
      };
    }>("select public.coach_context('report',30,'aim') value")
  ).rows[0].value;
  expect(context.sessions).toHaveLength(1);
  expect(context.sessions[0].steps[0].id).toBe(steps[0].id);
  expect(context.sessions[0].results[0]).toMatchObject({
    step_id: steps[0].id,
    status: "completed",
    unit: results[0].unit,
    version: results[0].version,
  });
  expect(context.sessions[0].results[0]).not.toHaveProperty("note");
  expect(context.sessions[0].steps[0]).not.toHaveProperty("notes");
  await user(b);
  await db.query(
    "insert into public.coach_preferences(id,context_enabled) values($1,true)",
    [b],
  );
  const other = (
    await db.query<{ value: { sessions: unknown[] } }>(
      "select public.coach_context('report',30,'aim') value",
    )
  ).rows[0].value;
  expect(other.sessions).toEqual([]);
});
