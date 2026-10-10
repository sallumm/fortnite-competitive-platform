import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { uid } from "../src/lib/seed";
import { trainingCatalog } from "../src/lib/training-catalog";
let db: PGlite;
const a = uid(9100),
  b = uid(9101),
  goal = uid(9110),
  vod = uid(9120),
  plan = uid(9130),
  exercise = trainingCatalog[0];
let session: string;
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
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
  );
  for (const f of readdirSync("supabase/migrations")
    .sort()
    .filter((f) => f.endsWith(".sql")))
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.query("insert into auth.users values($1),($2)", [a, b]);
  for (const id of [a, b]) {
    await user(id);
    await db.query(
      "insert into public.profiles values($1,'Jogador','build','intermediate','aim',30,'kbm','America/Sao_Paulo',true,true)",
      [id],
    );
  }
  await user(a);
}, 30000);
afterAll(() => db.close());
it("metas mantêm ciclo de vida, compatibilidade e auditoria sem XP", async () => {
  await db.query(
    "insert into public.personal_goals(id,user_id,title,target,criteria,skill,exercise_ids) values($1,$2,'Freebuild observável',1,'Registrar um teste','building',$3)",
    [goal, a, [exercise.id]],
  );
  await db.query(
    "update public.personal_goals set status='paused' where id=$1",
    [goal],
  );
  expect(
    (
      await db.query<{ status: string; completed: boolean }>(
        "select status,completed from public.personal_goals where id=$1",
        [goal],
      )
    ).rows[0],
  ).toEqual({ status: "paused", completed: false });
  await db.query(
    "update public.personal_goals set completed=true where id=$1",
    [goal],
  );
  expect(
    (
      await db.query<{ status: string }>(
        "select status from public.personal_goals where id=$1",
        [goal],
      )
    ).rows[0].status,
  ).toBe("completed");
  expect(
    (
      await db.query("select * from public.goal_revisions where goal_id=$1", [
        goal,
      ])
    ).rows,
  ).toHaveLength(3);
  await db.query(
    "update public.personal_goals set status='archived',completed=false where id=$1",
    [goal],
  );
  expect(
    (
      await db.query(
        "select status,completed from public.personal_goals where id=$1",
        [goal],
      )
    ).rows[0],
  ).toEqual({ status: "archived", completed: true });
  await db.query(
    "update public.personal_goals set status='active' where id=$1",
    [goal],
  );
  expect(
    (
      await db.query(
        "select completed from public.personal_goals where id=$1",
        [goal],
      )
    ).rows[0],
  ).toEqual({ completed: false });
  expect(
    (await db.query("select * from public.xp_transactions")).rows,
  ).toHaveLength(0);
  await expect(
    db.exec("update public.goal_revisions set after_value='{}'"),
  ).rejects.toThrow();
});
it("meta rejeita exercício inexistente, vínculos duplicados, habilidade inválida e acesso de outra conta", async () => {
  await expect(
    db.query("update public.personal_goals set exercise_ids=$1 where id=$2", [
      [uid(9199)],
      goal,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("update public.personal_goals set exercise_ids=$1 where id=$2", [
      [exercise.id, exercise.id],
      goal,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("update public.personal_goals set skill='invented' where id=$1", [
      goal,
    ]),
  ).rejects.toThrow();
  await user(b);
  expect(
    (await db.query("select * from public.personal_goals")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from public.goal_revisions")).rows,
  ).toHaveLength(0);
  await expect(
    db.query(
      "insert into public.personal_goals(user_id,title,target) values($1,'Forjada',1)",
      [a],
    ),
  ).rejects.toThrow();
  await user(a);
});
const marker = () => ({
  id: uid(9121),
  seconds: 30,
  category: "mechanics",
  kind: "mistake",
  note: "SEGREDO VOD",
  skills: ["building"],
});
it("VOD manual persiste e valida autorização, timestamps e identidade", async () => {
  await db.query(
    "insert into public.vod_reviews(id,user_id,title,match_date,video_url,video_authorized,duration_seconds,markers,skills,exercise_ids) values($1,$2,'Partida',current_date,'https://www.youtube.com/watch?v=example',true,60,$3,array['building'],$4)",
    [vod, a, JSON.stringify([marker()]), [exercise.id]],
  );
  await expect(
    db.query(
      "update public.vod_reviews set video_authorized=false where id=$1",
      [vod],
    ),
  ).rejects.toThrow();
  await expect(
    db.query("update public.vod_reviews set markers=$1 where id=$2", [
      JSON.stringify([{ ...marker(), seconds: 61 }]),
      vod,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("update public.vod_reviews set markers=$1 where id=$2", [
      JSON.stringify([{ ...marker(), note: null }]),
      vod,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query("update public.vod_reviews set markers=$1 where id=$2", [
      JSON.stringify([marker(), marker()]),
      vod,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query(
      "update public.vod_reviews set video_url='https://youtube.com.evil.test/video' where id=$1",
      [vod],
    ),
  ).rejects.toThrow();
  await expect(
    db.query("update public.vod_reviews set id=$1 where id=$2", [
      uid(9122),
      vod,
    ]),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ markers: unknown[] }>(
        "select markers from public.vod_reviews where id=$1",
        [vod],
      )
    ).rows[0].markers,
  ).toHaveLength(1);
});
it("VOD privado não pode ser consultado ou forjado por outro usuário ou visitante", async () => {
  await user(b);
  expect(
    (await db.query("select * from public.vod_reviews")).rows,
  ).toHaveLength(0);
  await expect(
    db.query(
      "insert into public.vod_reviews(user_id,title,match_date) values($1,'Forjado',current_date)",
      [a],
    ),
  ).rejects.toThrow();
  await user(null, "anon");
  await expect(db.exec("select * from public.vod_reviews")).rejects.toThrow();
  await user(a);
});
it("readiness exige sessão própria e valida limites; não concede XP", async () => {
  await db.query(
    "insert into public.training_plans(id,user_id,title,steps) values($1,$2,'Rotina',$3)",
    [
      plan,
      a,
      JSON.stringify([{ id: uid(9131), exercise_id: exercise.id, minutes: 5 }]),
    ],
  );
  session = (
    await db.query<{ value: { id: string } }>(
      "select to_jsonb(public.start_training($1)) value",
      [plan],
    )
  ).rows[0].value.id;
  await db.query(
    "insert into public.training_readiness(id,user_id,energy,focus,available_minutes,style) values($1,$2,2,null,15,'light')",
    [session, a],
  );
  await expect(
    db.query("update public.training_readiness set energy=6 where id=$1", [
      session,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query(
      "update public.training_readiness set available_minutes=0 where id=$1",
      [session],
    ),
  ).rejects.toThrow();
  await user(b);
  expect(
    (await db.query("select * from public.training_readiness")).rows,
  ).toHaveLength(0);
  await expect(
    db.query(
      "insert into public.training_readiness(id,user_id,available_minutes,style) values($1,$2,15,'light')",
      [session, b],
    ),
  ).rejects.toThrow();
  await user(a);
  expect(
    (await db.query("select * from public.xp_transactions")).rows,
  ).toHaveLength(0);
});
it("contexto mínimo do Coach depende de consentimento e exclui notas VOD/readiness", async () => {
  expect(
    (
      await db.query<{ value: object }>(
        "select public.coach_context('report',7,'aim') value",
      )
    ).rows[0].value,
  ).toEqual({});
  await db.query(
    "insert into public.coach_preferences(id,context_enabled) values($1,true)",
    [a],
  );
  await db.query(
    "insert into public.planning_preferences values($1,$1,array[1,3],'18:00',30,array['aim'],'building',array['editing'])",
    [a],
  );
  const c = (
    await db.query<{
      value: {
        focus: { primary_skill: string };
        vod_summary: { reviews: number };
      };
    }>("select public.coach_context('report',7,'aim') value")
  ).rows[0].value;
  expect(c.focus.primary_skill).toBe("building");
  expect(c.vod_summary.reviews).toBe(1);
  expect(JSON.stringify(c)).not.toContain("SEGREDO VOD");
  expect(c).not.toHaveProperty("readiness");
  await user(b);
  await db.query(
    "insert into public.coach_preferences(id,context_enabled) values($1,true)",
    [b],
  );
  expect(
    (
      await db.query<{ value: { vod_summary: { reviews: number } } }>(
        "select public.coach_context('report',7,'aim') value",
      )
    ).rows[0].value.vod_summary.reviews,
  ).toBe(0);
  await user(a);
});
it("limite diário de VOD é por conta e não bloqueia edição", async () => {
  await user(a);
  await db.query(
    "insert into public.vod_reviews(id,user_id,title,match_date) select gen_random_uuid(),$1,'Revisão adicional',current_date from generate_series(1,59)",
    [a],
  );
  await expect(
    db.query(
      "insert into public.vod_reviews(user_id,title,match_date) values($1,'Excedente',current_date)",
      [a],
    ),
  ).rejects.toThrow(/limite diário/);
  await db.query(
    "update public.vod_reviews set notes='Edição permitida' where id=$1",
    [vod],
  );
  await user(b);
  await db.query(
    "insert into public.vod_reviews(user_id,title,match_date) values($1,'Outra conta',current_date)",
    [b],
  );
  await user(a);
});
it("exclusão da conta remove revisões, metas e preparação pessoal por cascade", async () => {
  await db.exec("reset role");
  await db.query("delete from public.profiles where id=$1", [a]);
  for (const table of ["vod_reviews", "goal_revisions", "training_readiness"])
    expect(
      (
        await db.query("select * from public." + table + " where user_id=$1", [
          a,
        ])
      ).rows,
    ).toHaveLength(0);
  expect(
    (await db.query("select * from public.profiles where id=$1", [b])).rows,
  ).toHaveLength(1);
});
