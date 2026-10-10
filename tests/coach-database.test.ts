import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { uid } from "../src/lib/seed";
let db: PGlite;
const a = uid(9900),
  b = uid(9901);
let proposal: string;
const future = (days = 2) => new Date(Date.now() + days * 864e5).toISOString();
const payload = () => ({
  kind: "create",
  items: [
    {
      title: "Revisão de VOD",
      kind: "personal",
      plan_id: null,
      starts_at: future(),
      duration_minutes: 40,
    },
  ],
});
async function user(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("set role " + role);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
  );
  for (const file of [
    "202610100001_core.sql",
    "202610100002_seed.sql",
    "202610100003_performance.sql",
    "202610100004_coach.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [a, b]);
  for (const id of [a, b]) {
    await user(id);
    await db.query(
      "insert into public.profiles values($1,'Jogador','build','intermediate','aim',30,'kbm','America/Sao_Paulo',true,true)",
      [id],
    );
  }
}, 30000);
afterAll(async () => {
  await db.close();
});
it("obtém contexto somente após autorização e não aceita usuário como parâmetro", async () => {
  await user(a);
  const empty = await db.query<{ value: Record<string, unknown> }>(
    "select public.coach_context('report',30,'aim') value",
  );
  expect(empty.rows[0].value).toEqual({});
  await db.query(
    "insert into public.coach_preferences(id,context_enabled,history_enabled) values($1,true,true)",
    [a],
  );
  await db.query(
    "insert into public.personal_goals(user_id,title,target) values($1,'Minha meta',2)",
    [a],
  );
  await user(b);
  await db.query(
    "insert into public.coach_preferences(id,context_enabled) values($1,true)",
    [b],
  );
  await db.query(
    "insert into public.personal_goals(user_id,title,target) values($1,'Meta privada B',2)",
    [b],
  );
  await user(a);
  const context = (
    await db.query<{
      value: { goals: { title: string }[]; sessions: unknown[] };
    }>("select public.coach_context('report',30,'aim') value")
  ).rows[0].value;
  expect(context.goals).toEqual([{ title: "Minha meta", completed: false }]);
  expect(context.sessions).toEqual([]);
  expect(
    JSON.stringify(
      (await db.query("select public.coach_context('exercise',7,'aim')")).rows,
    ),
  ).not.toContain("Minha meta");
  await expect(
    db.exec("select public.coach_context('all',999,'aim')"),
  ).rejects.toThrow();
  await user(null, "anon");
  await expect(
    db.exec("select public.coach_context('report',30,'aim')"),
  ).rejects.toThrow();
});
it("prévia não escreve na agenda; confirmação específica, isolamento e idempotência", async () => {
  await user(a);
  const row = (
    await db.query<{ value: { id: string } }>(
      "select to_jsonb(public.coach_propose($1)) value",
      [JSON.stringify(payload())],
    )
  ).rows[0].value;
  proposal = row.id;
  expect(
    (await db.exec("select * from public.scheduled_sessions"))[0].rows,
  ).toHaveLength(0);
  await expect(
    db.query("select public.coach_confirm($1,$2)", [proposal, "sim"]),
  ).rejects.toThrow();
  await user(b);
  expect(
    (await db.query("select * from public.coach_actions")).rows,
  ).toHaveLength(0);
  await expect(
    db.query("select public.coach_confirm($1,'CONFIRMAR')", [proposal]),
  ).rejects.toThrow();
  await user(a);
  const first = (
    await db.query("select public.coach_confirm($1,$2) result", [
      proposal,
      "CONFIRMAR",
    ])
  ).rows[0];
  const second = (
    await db.query("select public.coach_confirm($1,$2) result", [
      proposal,
      "CONFIRMAR",
    ])
  ).rows[0];
  expect(second).toEqual(first);
  expect(
    (await db.query("select * from public.scheduled_sessions")).rows,
  ).toHaveLength(1);
  await expect(
    db.query("update public.coach_actions set payload='{}' where id=$1", [
      proposal,
    ]),
  ).rejects.toThrow();
});
it("rejeita ações inválidas, conflito avulso e conflito de recorrência", async () => {
  await user(a);
  await expect(
    db.query("select public.coach_propose($1)", [JSON.stringify(payload())]),
  ).rejects.toThrow(/conflito/);
  await expect(
    db.query("select public.coach_propose($1)", [
      JSON.stringify({ kind: "sql", query: "delete from profiles" }),
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("select public.coach_propose($1)", [
      JSON.stringify({
        kind: "create",
        items: [{ ...payload().items[0], duration_minutes: 999 }],
      }),
    ]),
  ).rejects.toThrow();
  const day = future(10).slice(0, 10),
    weekday = new Date(day + "T12:00:00Z").getUTCDay();
  const series = {
    kind: "series",
    title: "Estudos semanais",
    activity_kind: "personal",
    plan_id: null,
    timezone: "UTC",
    local_time: "18:00",
    start_date: day,
    end_date: future(17).slice(0, 10),
    weekdays: [weekday],
    duration_minutes: 30,
  };
  const id = (
    await db.query<{ id: string }>("select (public.coach_propose($1)).id", [
      JSON.stringify(series),
    ])
  ).rows[0].id;
  await db.query("select public.coach_confirm($1,'CONFIRMAR')", [id]);
  await expect(
    db.query("select public.coach_propose($1)", [
      JSON.stringify({
        kind: "create",
        items: [{ ...payload().items[0], starts_at: day + "T18:15:00Z" }],
      }),
    ]),
  ).rejects.toThrow(/conflito/);
});
it("revalida conflito ao confirmar e exige confirmação específica para cancelar", async () => {
  await user(a);
  const proposed = payload();
  proposed.items[0].starts_at = future(3);
  const id = (
    await db.query<{ id: string }>("select (public.coach_propose($1)).id", [
      JSON.stringify(proposed),
    ])
  ).rows[0].id;
  await db.query(
    "insert into public.scheduled_sessions(user_id,title,kind,starts_at,duration_minutes) values($1,'Conflito novo','personal',$2,30)",
    [a, proposed.items[0].starts_at],
  );
  await expect(
    db.query("select public.coach_confirm($1,'CONFIRMAR')", [id]),
  ).rejects.toThrow(/conflito/);
  const scheduled = (
    await db.query<{ id: string }>(
      "select id from public.scheduled_sessions order by starts_at limit 1",
    )
  ).rows[0].id;
  const cancel = (
    await db.query<{ id: string }>("select (public.coach_propose($1)).id", [
      JSON.stringify({ kind: "cancel", schedule_id: scheduled }),
    ])
  ).rows[0].id;
  await expect(
    db.query("select public.coach_confirm($1,'CONFIRMAR')", [cancel]),
  ).rejects.toThrow();
  await db.query("select public.coach_confirm($1,'CANCELAR')", [cancel]);
});
it("histórico opt-in, RLS, exclusão por cascade e nenhum acesso aos diagnósticos", async () => {
  await user(b);
  expect(
    (await db.query("select public.coach_save_turn('Não salvar','{}') id"))
      .rows[0].id,
  ).toBeNull();
  await user(a);
  const id = (
    await db.query<{ id: string }>(
      "select public.coach_save_turn('Meu relatório',$1) id",
      [JSON.stringify({ mode: "rules", sections: [] })],
    )
  ).rows[0].id;
  expect(
    (await db.query("select * from public.coach_messages")).rows,
  ).toHaveLength(1);
  await user(b);
  expect(
    (await db.query("select * from public.coach_messages")).rows,
  ).toHaveLength(0);
  await expect(
    db.query("select public.coach_save_turn('Intrusão','{}',$1)", [id]),
  ).resolves.toBeTruthy(); // disabled history never accesses foreign conversation
  await db.query(
    "update public.coach_preferences set history_enabled=true where id=$1",
    [b],
  );
  await expect(
    db.query("select public.coach_save_turn('Intrusão','{}',$1)", [id]),
  ).rejects.toThrow();
  await expect(db.exec("select * from private.coach_usage")).rejects.toThrow();
  await user(a);
  await db.query("delete from public.coach_conversations where id=$1", [id]);
  expect(
    (await db.query("select * from public.coach_messages")).rows,
  ).toHaveLength(0);
});
it("reserva limite por minuto e impede uso externo sem consentimento", async () => {
  await user(a);
  await expect(db.exec("select public.coach_reserve(true)")).rejects.toThrow();
  for (let i = 0; i < 6; i++)
    await db.exec("select public.coach_reserve(false)");
  await expect(db.exec("select public.coach_reserve(false)")).rejects.toThrow(
    /limite/,
  );
});
it("proposta expirada e orçamento global não são executados", async () => {
  await user(a);
  const row = payload();
  row.items[0].starts_at = future(5);
  const id = (
    await db.query<{ id: string }>("select (public.coach_propose($1)).id", [
      JSON.stringify(row),
    ])
  ).rows[0].id;
  await db.exec("reset role");
  await db.query(
    "update public.coach_actions set created_at=now()-interval '1 hour',expires_at=now()-interval '45 minutes' where id=$1",
    [id],
  );
  await user(a);
  await expect(
    db.query("select public.coach_confirm($1,'CONFIRMAR')", [id]),
  ).rejects.toThrow(/expired/);
  await user(b);
  await db.query(
    "update public.coach_preferences set external_enabled=true,consent_version='coach-v1' where id=$1",
    [b],
  );
  await db.exec("reset role");
  await db.exec(
    "insert into private.coach_global_usage values(current_date,500) on conflict(day) do update set calls=500",
  );
  await user(b);
  await expect(db.exec("select public.coach_reserve(true)")).rejects.toThrow(
    /orçamento/,
  );
});

it("limites diários de solicitações e geração são independentes da janela por minuto", async () => {
  await db.exec("reset role");
  await db.query(
    "update private.coach_usage set requests=60,minute=now()-interval '1 minute',minute_requests=0 where user_id=$1",
    [a],
  );
  await user(a);
  await expect(db.exec("select public.coach_reserve(false)")).rejects.toThrow(
    /limite/,
  );
  await db.exec("reset role");
  await db.query(
    "insert into private.coach_usage values($1,current_date,now()-interval '1 minute',20,0,20) on conflict(user_id,day) do update set requests=20,generative=20,minute_requests=0,minute=now()-interval '1 minute'",
    [b],
  );
  await db.exec("update private.coach_global_usage set calls=0");
  await user(b);
  await expect(db.exec("select public.coach_reserve(true)")).rejects.toThrow(
    /limite/,
  );
  await expect(
    db.exec("select public.coach_reserve(false)"),
  ).resolves.toBeTruthy();
});

it("não expõe artigos programados para publicação futura pelo contexto privilegiado", async () => {
  await db.exec("reset role");
  const article = (
    await db.query<{ id: string }>(
      "update public.articles set category='aim',published=true,published_at=now()+interval '1 day',valid_until=null where id=(select id from public.articles where kind='lesson' limit 1) returning id",
    )
  ).rows[0].id;
  await user(a);
  const data = (
    await db.query<{ value: { articles: { id: string }[] } }>(
      "select public.coach_context('exercise',7,'aim') value",
    )
  ).rows[0].value;
  expect(data.articles.some((t) => t.id === article)).toBe(false);
});
