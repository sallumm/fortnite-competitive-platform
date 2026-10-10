import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { uid, demoPlayer, seed } from "../src/lib/seed";
import { defaultEvolutionConfig } from "../src/lib/skill-maxing/config";
import { generateEvolution } from "../src/lib/skill-maxing/engine";
import { approvalPayload } from "../src/lib/skill-maxing/service";
let db: PGlite;
const users = [uid(9701), uid(9702), uid(9703), uid(9704)];
let team: string, trio: string, invite: string, session: string;
async function asUser(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("set role " + role);
}
async function rpc(sql: string, args: unknown[] = []) {
  const r = await db.query<{ result: any }>(`select ${sql} as result`, args);
  return r.rows[0].result;
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
  for (const u of users) {
    await db.query("insert into auth.users values($1)", [u]);
    await db.query(
      "insert into public.profiles(id,display_name,mode,level,objective,minutes,input) values($1,'Private player','build','beginner','aim',30,'kbm')",
      [u],
    );
  }
  // Controlled editorial fixture only; no claim of newly researched live game mechanics.
  await db.exec(
    "insert into public.meta_sources values('test-source','Fixture official','https://www.fortnite.com/','official','page',null,now()-interval '1 day','Controlled test fixture');insert into public.meta_entries(id,subject_key,context_id,revision,previous_id,kind,title,category,body,state,availability,evidence,source_ids,verified_at,valid_from,review_due,limitations,change_note) values('test-meta','test-skill','br-4230',1,null,'mechanic','Fixture mechanics','test-category','Reference fixture for isolation and snapshots','confirmed','available','official',array['test-source'],now()-interval '1 day',now()-interval '1 day',now()+interval '7 days','Controlled test fixture','First fixture');",
  );
}, 30000);
afterAll(async () => db.close());
it("requires auth, preserves legacy regional preferences and validates competitive references", async () => {
  await asUser(null, "anon");
  await expect(
    rpc("public.create_training_team('Test',2,'Alias')"),
  ).rejects.toThrow();
  await asUser(users[0]);
  await db.query(
    "insert into public.competitive_preferences(id,regions,reminders_enabled) values($1,array['BR','EU'],true)",
    [users[0]],
  );
  await db.query(
    "update public.competitive_preferences set primary_mode='br-build',format='solo',meta_context_id='br-4230' where id=$1",
    [users[0]],
  );
  expect(
    (
      await db.query(
        "select regions,reminders_enabled from public.competitive_preferences",
      )
    ).rows[0],
  ).toMatchObject({ regions: ["BR", "EU"], reminders_enabled: true });
  await expect(
    db.query(
      "update public.competitive_preferences set secondary_modes=array['nonexistent']",
    ),
  ).rejects.toThrow();
  await expect(
    db.query(
      "update public.competitive_preferences set meta_context_id='zero-4230'",
    ),
  ).rejects.toThrow();
});
it("derives plan context on server, forbids forged snapshots and preserves session history", async () => {
  await asUser(users[0]);
  const id = uid(9720),
    steps = [{ id: uid(9721), exercise_id: seed.exercises[0].id, minutes: 5 }];
  await db.query(
    "insert into public.training_plans(id,user_id,title,steps,mode,level,meta_context_id,meta_entry_ids,game_context) values($1,$2,'Context practice',$3,'build','beginner','br-4230',array['test-meta'],'{\"patch\":\"forged\"}')",
    [id, users[0], steps],
  );
  const plan = await rpc(
    "(select game_context from public.training_plans where id=$1)",
    [id],
  );
  expect(plan.patch).toBe("42.30");
  expect(plan.entries[0].id).toBe("test-meta");
  await expect(
    db.query("update public.training_plans set game_context='{}' where id=$1", [
      id,
    ]),
  ).rejects.toThrow(/derived/);
  const started = await rpc("to_jsonb(public.start_training($1))", [id]);
  expect(started.plan_snapshot.game_context).toEqual(plan);
  await db.query(
    "update public.training_plans set title='Edited',meta_context_id='br-4220',meta_entry_ids='{}' where id=$1",
    [id],
  );
  const historical = await rpc(
    "(select plan_snapshot from public.training_sessions where id=$1)",
    [started.id],
  );
  expect(historical.game_context.patch).toBe("42.30");
  await expect(
    db.query(
      "update public.training_sessions set plan_snapshot=jsonb_set(plan_snapshot,'{game_context}','{}') where id=$1",
      [started.id],
    ),
  ).rejects.toThrow();
  await asUser(users[1]);
  expect(
    (await db.query("select * from public.training_plans")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from public.training_sessions")).rows,
  ).toHaveLength(0);
});
it("binds context to atomic calendar approval with idempotency and rollbacks", async () => {
  await asUser(users[1]);
  const d = demoPlayer();
  d.profile = { ...d.profile!, id: users[1], timezone: "UTC" };
  d.sessions = [];
  d.series = [];
  d.schedules = [];
  const c = defaultEvolutionConfig(d.profile!);
  c.windows = [
    { id: uid(9730), weekday: 1, start: "17:00", end: "18:00", minutes: 30 },
  ];
  const p = approvalPayload(
    generateEvolution(
      c,
      d,
      seed,
      "2026-10-12",
      1,
      new Date("2026-10-10T12:00:00Z"),
    ),
  );
  const args = [
    uid(9731),
    p.p_from,
    p.p_weeks,
    p.p_config,
    p.p_sessions,
    p.p_rules,
    "br-4230",
    ["test-meta"],
  ];
  const call = () =>
    rpc("public.confirm_meta_evolution_plan($1,$2,$3,$4,$5,$6,$7,$8)", args);
  const a = await call();
  expect(await call()).toEqual(a);
  args[6] = "zero-4230";
  await expect(call()).rejects.toThrow(/token/);
  args[0] = uid(9732);
  await expect(call()).rejects.toThrow();
  expect(
    (await db.query("select * from public.training_plans")).rows,
  ).toHaveLength(1);
});
it("requires both voluntary issuance and explicit acceptance, prevents outsiders and over-capacity", async () => {
  await asUser(users[0]);
  team = await rpc(
    "public.create_training_team('Duo practice',2,'Owner alias')",
  );
  const issued = await rpc("public.invite_training_member($1)", [team]);
  invite = issued.token;
  expect(issued.token).toHaveLength(72);
  expect(
    (await db.query("select token_hash from public.training_team_invites"))
      .rows[0],
  ).not.toHaveProperty("token");
  await asUser(users[1]);
  expect(
    (await db.query("select * from public.training_teams")).rows,
  ).toHaveLength(0);
  await expect(
    rpc("public.accept_training_invite($1,'Partner','NO')", [invite]),
  ).rejects.toThrow();
  expect(
    await rpc("public.accept_training_invite($1,'Partner alias','ACEITAR')", [
      invite,
    ]),
  ).toBe(team);
  expect(
    (await db.query("select * from public.training_team_members")).rows,
  ).toHaveLength(2);
  await expect(
    rpc("public.accept_training_invite($1,'Partner alias','ACEITAR')", [
      invite,
    ]),
  ).rejects.toThrow();
  await asUser(users[0]);
  const extra = await rpc("public.invite_training_member($1)", [team]);
  await asUser(users[2]);
  await expect(
    rpc("public.accept_training_invite($1,'Third','ACEITAR')", [extra.token]),
  ).rejects.toThrow(/capacity/);
  for (const table of [
    "training_teams",
    "training_team_members",
    "training_team_invites",
    "training_team_sessions",
    "training_team_resources",
  ]) {
    expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(
      0,
    );
  }
  await expect(
    rpc("public.invite_training_member($1)", [team]),
  ).rejects.toThrow();
  await expect(
    db.query(
      "insert into public.training_team_members values($1,$2,'Forged',now())",
      [team, users[2]],
    ),
  ).rejects.toThrow();
  expect(await rpc("private.team_member($1,$2)", [team, users[0]])).toBe(false);
});
it("supports a three-person practice group without changing tournament formats; handles revoked invites", async () => {
  await asUser(users[0]);
  trio = await rpc("public.create_training_team('Trio practice',3,'Captain')");
  const a = await rpc("public.invite_training_member($1)", [trio]);
  const b = await rpc("public.invite_training_member($1)", [trio]);
  await rpc("public.revoke_training_invite($1,'REVOGAR')", [a.id]);
  await asUser(users[1]);
  await expect(
    rpc("public.accept_training_invite($1,'Second','ACEITAR')", [a.token]),
  ).rejects.toThrow();
  await rpc("public.accept_training_invite($1,'Second','ACEITAR')", [b.token]);
  await asUser(users[0]);
  const c = await rpc("public.invite_training_member($1)", [trio]);
  await asUser(users[2]);
  await rpc("public.accept_training_invite($1,'Third','ACEITAR')", [c.token]);
  expect(
    (
      await db.query(
        "select * from public.training_team_members where team_id=$1",
        [trio],
      )
    ).rows,
  ).toHaveLength(3);
  expect(
    (
      await db.query(
        "select * from public.meta_contexts where format_id='trio'",
      )
    ).rows,
  ).toHaveLength(0);
});
it("schedules shared activities only on explicit confirmation; rejects conflicts without disclosing private agenda", async () => {
  await asUser(users[0]);
  const exercise = seed.exercises.find(
    (e) => e.mode !== "zero" && e.research?.review_status === "verified",
  )!.id;
  await expect(
    rpc(
      "public.schedule_training_team($1,'Practice','Shared objective',now()+interval '3 days',30,$2,'br-4230','NO')",
      [team, [exercise]],
    ),
  ).rejects.toThrow();
  session = await rpc(
    "public.schedule_training_team($1,'Practice','Shared objective',now()+interval '3 days',30,$2,'br-4230','AGENDAR')",
    [team, [exercise]],
  );
  expect(
    (await db.query("select * from public.training_team_participation")).rows,
  ).toHaveLength(0);
  await asUser(users[1]);
  await rpc(
    "public.respond_training_session($1,'accepted','Shared note','CONFIRMAR')",
    [session],
  );
  await expect(
    rpc("public.respond_training_session($1,'completed','','CONFIRMAR')", [
      session,
    ]),
  ).rejects.toThrow();
  expect(
    (await db.query("select * from public.training_team_participation"))
      .rows[0],
  ).toMatchObject({ user_id: users[1], status: "accepted" });
  await asUser(users[0]);
  await db.query(
    "insert into public.scheduled_sessions(id,user_id,title,kind,duration_minutes,starts_at) select $1,$2,'PRIVATE COMMITMENT','personal',30,starts_at from public.training_team_sessions where id=$3",
    [uid(9750), users[0], session],
  );
  await expect(
    rpc("public.respond_training_session($1,'accepted','','CONFIRMAR')", [
      session,
    ]),
  ).rejects.toThrow(/Personal calendar conflict/);
  expect(
    (
      await db.query(
        "select * from public.training_team_participation where user_id=$1",
        [users[0]],
      )
    ).rows,
  ).toHaveLength(0);
  await asUser(users[3]);
  await expect(
    rpc("public.respond_training_session($1,'accepted','','CONFIRMAR')", [
      session,
    ]),
  ).rejects.toThrow();
  expect(
    (await db.query("select * from public.scheduled_sessions")).rows,
  ).toHaveLength(0);
});
it("shares only authorized materials and allows author deletion; leaving revokes all team access", async () => {
  await asUser(users[1]);
  await expect(
    rpc(
      "public.save_training_team_resource($1,'vod','Collective review','Notes','https://www.youtube.com/watch?v=fixture',false,'br-4230','COMPARTILHAR')",
      [team],
    ),
  ).rejects.toThrow();
  const resource = await rpc(
    "public.save_training_team_resource($1,'vod','Collective review','Own authorized shared notes','https://www.youtube.com/watch?v=fixture',true,'br-4230','COMPARTILHAR')",
    [team],
  );
  await asUser(users[0]);
  expect(
    (
      await db.query(
        "select * from public.training_team_resources where team_id=$1",
        [team],
      )
    ).rows,
  ).toHaveLength(1);
  await expect(
    rpc("public.delete_training_team_resource($1,'EXCLUIR')", [resource]),
  ).rejects.toThrow();
  await asUser(users[1]);
  await rpc("public.leave_training_team($1,'SAIR')", [team]);
  expect(
    (
      await db.query(
        "select * from public.training_team_resources where team_id=$1",
        [team],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "select * from public.training_team_members where team_id=$1",
        [team],
      )
    ).rows,
  ).toHaveLength(0);
});
it("isolates private location notes and keeps old plan references when editorial revisions change", async () => {
  await asUser(users[0]);
  await db.query(
    "insert into public.meta_study_notes(user_id,entry_id,note,favorite) values($1,'test-meta','Private drop observation',true)",
    [users[0]],
  );
  await asUser(users[1]);
  expect(
    (await db.query("select * from public.meta_study_notes")).rows,
  ).toHaveLength(0);
  await db.exec("reset role");
  await db.exec(
    "insert into public.meta_entries(id,subject_key,context_id,revision,previous_id,kind,title,category,body,state,availability,evidence,source_ids,verified_at,valid_from,review_due,limitations,change_note) values('test-meta-revised','test-skill','br-4230',2,'test-meta','mechanic','Fixture mechanics revised','test-category','Changed reference fixture','confirmed','available','official',array['test-source'],now(),now(),now()+interval '7 days','Controlled test fixture','Updated fixture');",
  );
  await asUser(users[0]);
  await expect(
    db.query(
      "insert into public.training_plans(user_id,title,steps,mode,level,meta_context_id,meta_entry_ids) values($1,'Outdated plan',$2,'build','beginner','br-4230',array['test-meta'])",
      [users[0], [{ exercise_id: seed.exercises[0].id, minutes: 5 }]],
    ),
  ).rejects.toThrow(/revision/);
  const refs = await rpc(
    "public.coach_meta_context('br-4230','Fixture mechanics')",
  );
  expect(refs.some((r: any) => r.id === "test-meta-revised")).toBe(true);
  expect(refs.some((r: any) => r.id === "test-meta")).toBe(false);
});
