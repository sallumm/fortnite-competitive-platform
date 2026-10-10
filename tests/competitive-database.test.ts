import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { uid } from "../src/lib/seed";
let db: PGlite;
const a = uid(9800),
  b = uid(9801),
  editor = uid(9802),
  t = uid(4100),
  plan = uid(9803);
const future = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
async function user(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("set role " + role);
}
async function preview(payload: Record<string, unknown>) {
  return (
    await db.query<{
      v: { id: string; item: { starts_at: string; duration_minutes: number } };
    }>("select public.competition_preview($1,$2) v", [
      t,
      JSON.stringify(payload),
    ])
  ).rows[0].v;
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
    "202610100005_competitive.sql",
    "202610100006_competitive_seed.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.query("insert into auth.users values($1),($2),($3)", [a, b, editor]);
  for (const id of [a, b, editor]) {
    await user(id);
    await db.query(
      "insert into public.profiles values($1,'Jogador','build','intermediate','aim',30,'kbm','America/Sao_Paulo',true,true)",
      [id],
    );
  }
  await user(null, "postgres");
  await db.query("insert into private.user_roles values($1,'admin')", [editor]);
  await db.query(
    "update public.tournaments set valid_until=$1,end_date=$2 where id=$3",
    [future(10), future(20).slice(0, 10), t],
  );
  await user(a);
  await db.query(
    "insert into public.training_plans(id,user_id,title,steps) values($1,$2,$3,$4)",
    [
      plan,
      a,
      "Rotina teste",
      JSON.stringify([{ exercise_id: uid(1), minutes: 30 }]),
    ],
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
it("migrations preservam catálogo anterior e publicam fases verificadas", async () => {
  await user(null, "anon");
  expect(
    (await db.query("select id from public.exercises where id=$1", [uid(1)]))
      .rows,
  ).toHaveLength(1);
  const rows = (
    await db.query<{ phases: unknown[] }>(
      "select phases from public.tournaments where id=$1",
      [t],
    )
  ).rows;
  expect(rows[0].phases).toHaveLength(15);
  await expect(
    db.exec("select * from public.competition_preparations"),
  ).rejects.toThrow();
});
it("usuário comum não pode publicar, modificar fases ou ler revisões administrativas", async () => {
  await user(a);
  await expect(
    db.query(
      "insert into public.articles(id,title,slug,kind,category,summary,body,author,source_url,verified_at,published_at,valid_until,published) select $1,title,$2,kind,category,summary,body,author,source_url,verified_at,published_at,valid_until,true from public.articles limit 1",
      [uid(9870), "publicacao-invalida"],
    ),
  ).rejects.toThrow();
  await db.query("update public.tournaments set phases='[]' where id=$1", [t]);
  expect(
    (
      await db.query<{ phases: unknown[] }>(
        "select phases from public.tournaments where id=$1",
        [t],
      )
    ).rows[0].phases,
  ).toHaveLength(15);
  expect(
    (await db.query("select * from public.content_revision_history")).rows,
  ).toHaveLength(0);
});
it("checklist e regiões persistem isolados por usuário", async () => {
  await user(a);
  await db.query(
    "insert into public.competition_preparations values($1,$2,$3,$4)",
    [
      a,
      t,
      "Objetivo privado",
      JSON.stringify([{ title: "Revisar VOD", done: false }]),
    ],
  );
  await db.query(
    "insert into public.competitive_preferences values($1,array['BR','EU'],true)",
    [a],
  );
  await user(b);
  expect(
    (await db.query("select * from public.competition_preparations")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from public.competitive_preferences")).rows,
  ).toHaveLength(0);
  await expect(
    db.query(
      "insert into public.competition_preparations values($1,$2,'Outro','[]')",
      [a, t],
    ),
  ).rejects.toThrow();
  await user(a);
  expect(
    (
      await db.query<{ objective: string }>(
        "select objective from public.competition_preparations",
      )
    ).rows[0].objective,
  ).toBe("Objetivo privado");
  await expect(
    db.query(
      "update public.competitive_preferences set regions=array['REGIAO-INVENTADA']",
    ),
  ).rejects.toThrow();
});
it("prévia não grava agenda; confirmação específica e idempotente preserva vínculo", async () => {
  await user(a);
  const p = await preview({
    kind: "training",
    plan_id: plan,
    starts_at: future(2),
  });
  expect(
    (await db.query("select * from public.scheduled_sessions")).rows,
  ).toHaveLength(0);
  await expect(
    db.query("select public.competition_confirm($1,$2)", [p.id, "sim"]),
  ).rejects.toThrow();
  await user(b);
  await expect(
    db.query("select public.competition_confirm($1,'CONFIRMAR')", [p.id]),
  ).rejects.toThrow();
  await user(a);
  const first = (
    await db.query<{ v: string }>(
      "select public.competition_confirm($1,'CONFIRMAR') v",
      [p.id],
    )
  ).rows[0].v;
  const second = (
    await db.query<{ v: string }>(
      "select public.competition_confirm($1,'CONFIRMAR') v",
      [p.id],
    )
  ).rows[0].v;
  expect(second).toBe(first);
  const rows = (
    await db.query<{ tournament_id: string }>(
      "select * from public.scheduled_sessions",
    )
  ).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0].tournament_id).toBe(t);
});
it("plano de outra conta, intervalo inválido, sessão sem horário e tipo livre são rejeitados", async () => {
  await user(b);
  await expect(
    preview({ kind: "training", plan_id: plan, starts_at: future(3) }),
  ).rejects.toThrow();
  await user(a);
  await expect(
    preview({ kind: "training", plan_id: plan, starts_at: "não é data" }),
  ).rejects.toThrow();
  await expect(
    preview({ kind: "event", phase_key: "q2-r2" }),
  ).rejects.toThrow();
  await expect(
    preview({ kind: "delete", sql: "drop table profiles" }),
  ).rejects.toThrow();
});
it("confirmação reavalia conflitos criados após a prévia", async () => {
  await user(a);
  const start = future(4),
    p = await preview({ kind: "training", plan_id: plan, starts_at: start });
  await db.query(
    "insert into public.scheduled_sessions(user_id,title,kind,starts_at,duration_minutes) values($1,'Compromisso','personal',$2,40)",
    [a, start],
  );
  await expect(
    db.query("select public.competition_confirm($1,'CONFIRMAR')", [p.id]),
  ).rejects.toThrow(/conflito/);
});
it("sessão confirmada deriva hora e duração do catálogo, ignorando texto livre", async () => {
  await user(editor);
  const startsAt = future(5);
  const phase = {
    key: "sessao-verificada",
    title: "Sessão de teste",
    kind: "session",
    date: future(5).slice(0, 10),
    starts_at: startsAt,
    ends_at: new Date(Date.parse(startsAt) + 180 * 60000).toISOString(),
    status: "scheduled",
    source_url: "https://www.fortnite.com/competitive",
    verified_at: new Date().toISOString(),
    valid_until: future(10),
  };
  await db.query(
    "update public.tournaments set phases=phases || $1::jsonb where id=$2",
    [JSON.stringify([phase]), t],
  );
  await user(a);
  const p = await preview({
    kind: "event",
    phase_key: phase.key,
    starts_at: future(8),
    duration_minutes: 1,
  });
  expect(Date.parse(p.item.starts_at)).toBe(Date.parse(phase.starts_at));
  expect(p.item.duration_minutes).toBe(180);
  await db.query("select public.competition_confirm($1,'CONFIRMAR')", [p.id]);
});
it("cancelamento editorial após proposta impede gravação; mudança é auditada", async () => {
  await user(a);
  const p = await preview({
    kind: "training",
    plan_id: plan,
    starts_at: future(6),
  });
  await user(editor);
  await db.query(
    "update public.tournaments set status='cancelled' where id=$1",
    [t],
  );
  const audit = (
    await db.query<{ after_data: { status: string } }>(
      "select after_data from public.content_revision_history where record_id=$1 order by id desc limit 1",
      [t],
    )
  ).rows;
  expect(audit[0].after_data.status).toBe("cancelled");
  await user(a);
  await expect(
    db.query("select public.competition_confirm($1,'CONFIRMAR')", [p.id]),
  ).rejects.toThrow(/indisponível/);
  await user(editor);
  await db.query(
    "update public.tournaments set status='scheduled' where id=$1",
    [t],
  );
});
it("editor não consegue salvar fase inválida nem resultado sem fonte", async () => {
  await user(editor);
  await expect(
    db.query(
      'update public.tournaments set phases=\'[{"key":"x"}]\' where id=$1',
      [t],
    ),
  ).rejects.toThrow();
  await expect(
    db.query(
      "update public.tournaments set result_summary='Resultado inventado' where id=$1",
      [t],
    ),
  ).rejects.toThrow();
});
it("fontes expiradas e propostas expiradas bloqueiam confirmação", async () => {
  await user(a);
  const p = await preview({
    kind: "training",
    plan_id: plan,
    starts_at: future(7),
  });
  await user(null, "postgres");
  await db.query(
    "update public.competition_proposals set expires_at=now()-interval '1 minute' where id=$1",
    [p.id],
  );
  await user(a);
  await expect(
    db.query("select public.competition_confirm($1,'CONFIRMAR')", [p.id]),
  ).rejects.toThrow(/expired/);
  await user(editor);
  await db.query(
    "update public.tournaments set valid_until=verified_at where id=$1",
    [t],
  );
  await user(a);
  await expect(
    preview({ kind: "training", plan_id: plan, starts_at: future(8) }),
  ).rejects.toThrow();
  await user(editor);
  await db.query("update public.tournaments set valid_until=$1 where id=$2", [
    future(10),
    t,
  ]);
});
it("limite de propostas é aplicado atomicamente por conta", async () => {
  await user(null, "postgres");
  await db.query(
    "insert into public.competition_proposals(user_id,tournament_id,payload) select $1,$2,'{}'::jsonb from generate_series(1,60)",
    [b, t],
  );
  await user(b);
  await expect(
    preview({ kind: "event", phase_key: "sessao-verificada" }),
  ).rejects.toThrow(/limit/);
});
it("Coach recupera somente evento público selecionado e não vaza preparo privado", async () => {
  await user(b);
  const c = (
    await db.query<{ v: unknown }>(
      "select public.coach_competitive_event($1) v",
      [t],
    )
  ).rows[0].v;
  expect(JSON.stringify(c)).toContain("FNCS");
  expect(JSON.stringify(c)).not.toContain("Objetivo privado");
  await user(editor);
  await db.query("update public.tournaments set published=false where id=$1", [
    t,
  ]);
  await user(a);
  expect(
    (
      await db.query<{ v: unknown[] }>(
        "select public.coach_competitive_event($1) v",
        [t],
      )
    ).rows[0].v,
  ).toEqual([]);
  await user(editor);
  await db.query("update public.tournaments set published=true where id=$1", [
    t,
  ]);
});
it("publicação futura permanece oculta até a data, inclusive com metadados editoriais novos", async () => {
  await user(editor);
  const article = uid(4305);
  await db.query("update public.articles set published_at=$1 where id=$2", [
    future(3),
    article,
  ]);
  expect(
    (await db.query("select id from public.articles where id=$1", [article]))
      .rows,
  ).toHaveLength(1);
  await user(null, "anon");
  expect(
    (await db.query("select id from public.articles where id=$1", [article]))
      .rows,
  ).toHaveLength(0);
  await user(editor);
  await db.query(
    "update public.articles set published_at='2026-05-29T12:00:00Z' where id=$1",
    [article],
  );
});
it("checklist exige itens tipados para impedir dados inválidos na interface", async () => {
  await user(a);
  for (const invalid of [
    [null],
    [{ title: "", done: false }],
    [{ title: "Tarefa", done: "sim" }],
  ])
    await expect(
      db.query(
        "update public.competition_preparations set checklist=$1 where user_id=$2",
        [JSON.stringify(invalid), a],
      ),
    ).rejects.toThrow();
});
