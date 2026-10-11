import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
let db: PGlite,
  app: string,
  exam: string,
  question: string,
  discursive: string,
  attempt: any,
  scholarship: string,
  goal: string;
const learner = "20000000-0000-4000-8000-000000000001",
  other = "20000000-0000-4000-8000-000000000002",
  admin = "20000000-0000-4000-8000-000000000003",
  staff = "20000000-0000-4000-8000-000000000004";
async function as(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ aal: id === admin || id === staff ? "aal2" : "aal1" }),
  ]);
  await db.exec("set role " + role);
}
async function rpc(sql: string, args: unknown[] = []) {
  // Isolated fixture for the server-issued proof. Unauthorized issuance is tested separately.
  if (sql === "public.esports_submit($1,$2)") {
    const { rows } = await db.query<{ id: string }>("select auth.uid() id");
    if (rows[0].id) {
      await db.exec("reset role");
      const ticket = (
        await db.query<{ id: string }>(
          "select public.issue_captcha_ticket($1,$2) id",
          [rows[0].id, args[0]],
        )
      ).rows[0].id;
      await db.exec("set role authenticated");
      sql = "public.esports_submit($1,$2,$3)";
      args = [...args, ticket];
    }
  }
  return (await db.query<{ r: any }>("select " + sql + " as r", args)).rows[0]
    .r;
}
const action = (
  name: string,
  id: string | null = null,
  version = 0,
  p: unknown = {},
) =>
  rpc("public.esports_assessment_action($1,$2,$3,$4)", [name, id, version, p]);
const dev = (
  name: string,
  id: string | null = null,
  version = 0,
  p: unknown = {},
) =>
  rpc("public.esports_development_action($1,$2,$3,$4)", [name, id, version, p]);
const future = () => new Date(Date.now() + 86400000).toISOString();
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
  );
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  for (const id of [learner, other, admin, staff]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query(
      "insert into public.profiles(id,display_name,mode,level,objective,minutes,input) values($1,'Player','build','beginner','aim',30,'kbm')",
      [id],
    );
  }
  await db.query("insert into private.user_roles values($1,'admin')", [admin]); // Synthetic owner-only fixture; never seeded into production.
  const c = (
    await db.query<{ id: string }>(
      "insert into public.esports_cycles(title,mode,format,criteria,rules,privacy_notice,policy_version,retention_days,starts_at,ends_at) values('Teste','both','solo','Critérios de teste','Regras de teste','Privacidade de teste','v1',30,now()-interval '1 day',now()+interval '1 day') returning id",
    )
  ).rows[0].id;
  app = (
    await db.query<{ id: string }>(
      'insert into public.esports_applications(user_id,cycle_id,status,payload,consent_snapshot) values($1,$2,\'trial_invited\',\'{"nickname":"Aluno","age_band":"adult"}\',\'{"retention_days":30}\') returning id',
      [learner, c],
    )
  ).rows[0].id;
  await db.query(
    "insert into private.esports_role_grants(user_id,application_id,role,ends_at,reason) values($1,$2,'trialist',now()+interval '1 day','Convite de teste'),($3,null,'esports_staff',now()+interval '1 day','Staff de teste')",
    [learner, app, staff],
  );
  await db.query("insert into private.esports_reviewers values($1,$2)", [
    app,
    staff,
  ]);
}, 30000);
afterAll(async () => db.close());
it("protects question bank and validates authoritative review metadata", async () => {
  await as(learner);
  await expect(
    db.query("select * from private.esports_questions"),
  ).rejects.toThrow();
  await expect(action("question")).rejects.toThrow();
  await as(admin);
  const base = {
    category: "Fundamentos",
    difficulty: "foundation",
    kind: "objective",
    prompt: "Qual hábito apoia a revisão de uma sessão?",
    options: ["Registrar objetivo e resultado", "Ignorar a sessão"],
    correct: 0,
    explanation: "Revisão com contexto ajuda a organizar o próximo treino.",
    references_list: ["/academy/objetivo-do-treino"],
    weight: 2,
    published: true,
    reviewed_at: new Date().toISOString(),
  };
  question = (await action("question", null, 0, base)).id;
  discursive = (
    await action("question", null, 0, {
      ...base,
      category: "Decisões",
      kind: "discursive",
      prompt: "Descreva como revisar uma decisão de rotação.",
      options: [],
      correct: null,
    })
  ).id;
  await expect(
    action("question", null, 0, { ...base, correct: 8 }),
  ).rejects.toThrow();
  await expect(
    action("question", null, 0, {
      ...base,
      references_list: ["javascript:alert(1)"],
    }),
  ).rejects.toThrow();
});
it("validates balanced blueprints, assignments and Trialist access", async () => {
  await as(admin);
  const definition = {
    title: "Avaliação de teste",
    instructions: "Leia as regras e responda com contexto.",
    rules: "Materiais permitidos conforme revisão. Sem garantia de seleção.",
    blueprint: [
      { category: "Fundamentos", difficulty: "foundation", count: 1 },
      { category: "Decisões", difficulty: "foundation", count: 1 },
    ],
    minutes: 10,
    max_attempts: 1,
    published: true,
  };
  exam = (await action("exam", null, 0, definition)).id;
  await expect(
    action("exam", null, 0, {
      ...definition,
      blueprint: [definition.blueprint[0], definition.blueprint[0]],
    }),
  ).rejects.toThrow();
  await action("assign", app, 0, { exam_id: exam, available_until: future() });
  await as(other);
  expect((await rpc("public.esports_trials()")).assignments).toHaveLength(0);
  await expect(
    rpc("public.esports_start_exam($1,$2,true)", [app, exam]),
  ).rejects.toThrow();
  await as(learner);
  await expect(
    rpc("public.esports_start_exam($1,$2,false)", [app, exam]),
  ).rejects.toThrow();
  attempt = await rpc("public.esports_start_exam($1,$2,true)", [app, exam]);
  expect(attempt.questions).toHaveLength(2);
  expect(
    attempt.questions.every(
      (q: any) => !("correct" in q) && !("explanation" in q),
    ),
  ).toBe(true);
  expect(attempt.result).toBeNull();
  expect(
    (await rpc("public.esports_start_exam($1,$2,true)", [app, exam])).id,
  ).toBe(attempt.id);
});
it("freezes versions and reproduces selection without leaking answers", async () => {
  await db.exec("reset role");
  const snapshot = await rpc(
    "(select questions from private.esports_attempts where id=$1)",
    [attempt.id],
  );
  const seed = await rpc(
    "(select seed from private.esports_attempts where id=$1)",
    [attempt.id],
  );
  const selected = await rpc(
    "(select id from private.esports_questions where category='Fundamentos' order by md5($1||id::text) limit 1)",
    [seed],
  );
  expect(snapshot[0].id).toBe(selected);
  await db.query(
    "update private.esports_questions set correct=1,prompt='Conteúdo posteriormente alterado' where id=$1",
    [question],
  );
  await as(learner);
  const t = (await rpc("public.esports_trials()")).attempts[0];
  expect(t.questions[0].prompt).not.toBe("Conteúdo posteriormente alterado");
  expect(JSON.stringify(t)).not.toContain("explanation");
});
it("saves with CAS, isolates accounts and rejects unknown or invalid answers", async () => {
  await as(learner);
  await expect(
    rpc("public.esports_answer_exam($1,'save',$2,$3)", [
      attempt.id,
      attempt.version,
      { fake: 0 },
    ]),
  ).rejects.toThrow();
  await expect(
    rpc("public.esports_answer_exam($1,'save',$2,$3)", [
      attempt.id,
      attempt.version,
      { [question]: 99 },
    ]),
  ).rejects.toThrow();
  attempt = await rpc("public.esports_answer_exam($1,'save',$2,$3)", [
    attempt.id,
    attempt.version,
    { [question]: 0, [discursive]: "Analiso recursos e momento da rotação." },
  ]);
  await expect(
    rpc("public.esports_answer_exam($1,'save',1,$2)", [attempt.id, {}]),
  ).rejects.toThrow(/Version/);
  await as(other);
  await expect(
    rpc("public.esports_answer_exam($1,'submit',$2,$3)", [
      attempt.id,
      attempt.version,
      attempt.answers,
    ]),
  ).rejects.toThrow();
  await as(learner);
  expect((await rpc("public.esports_trials()")).attempts[0].answers).toEqual(
    attempt.answers,
  );
});
it("submits idempotently, scores frozen answers, requires manual grading and never promotes", async () => {
  await as(learner);
  attempt = await rpc("public.esports_answer_exam($1,'submit',$2,$3)", [
    attempt.id,
    attempt.version,
    attempt.answers,
  ]);
  expect(attempt.status).toBe("submitted");
  expect(attempt.result).toBeNull();
  expect(
    (await rpc("public.esports_answer_exam($1,'submit',1,'{}')", [attempt.id]))
      .version,
  ).toBe(attempt.version);
  await expect(
    rpc("public.esports_start_exam($1,$2,true)", [app, exam]),
  ).rejects.toThrow(/limit/);
  await as(staff);
  const data = await rpc("public.esports_assessment_admin()");
  expect(data.questions).toHaveLength(0);
  expect(data.attempts[0].objective_points).toBe(2);
  await expect(
    action("grade", attempt.id, attempt.version, {
      grades: {},
      review_note: "Revisado",
    }),
  ).rejects.toThrow(/each/);
  await action("grade", attempt.id, attempt.version, {
    grades: { [discursive]: 1.5 },
    review_note: "Revisão interna humana",
    feedback: "Explique a relação entre recursos e timing.",
    released: true,
  });
  await as(learner);
  const t = (await rpc("public.esports_trials()")).attempts[0];
  expect(t.result.objective_points).toBe(2);
  expect(t.result.feedback).toContain("recursos");
  expect(JSON.stringify(t)).not.toContain("interna humana");
  expect((await rpc("public.esports_workspace()")).applications[0].status).toBe(
    "trial_invited",
  );
});
it("handles exceptional retakes and deadline using server time", async () => {
  await as(admin);
  await action("extra_attempt", app, 0, {
    exam_id: exam,
    reason: "Falha técnica verificada",
  });
  await as(learner);
  const t = await rpc("public.esports_start_exam($1,$2,true)", [app, exam]);
  await db.exec("reset role");
  await db.query(
    "update private.esports_attempts set deadline=now()-interval '1 second' where id=$1",
    [t.id],
  );
  await as(learner);
  const ended = await rpc("public.esports_answer_exam($1,'save',$2,$3)", [
    t.id,
    t.version,
    { [question]: 1 },
  ]);
  expect(ended.status).toBe("submitted");
  expect(ended.answers).toEqual({});
});
it("requires practical review and explicit offer, blocks unavailable Pro benefits", async () => {
  await db.exec("reset role");
  await db.query(
    "update public.esports_applications set status='trial_completed' where id=$1",
    [app],
  );
  await as(admin);
  const offer = {
    title: "Bolsa de desenvolvimento",
    terms:
      "Apoio temporário, sem cobrança, sem contratação e sem garantia de promoção.",
    benefits: ["development_workspace", "materials"],
    starts_at: new Date().toISOString(),
    ends_at: future(),
  };
  await expect(dev("offer", app, 1, offer)).rejects.toThrow(/Practical/);
  await rpc("public.esports_admin_action('practical',$1,1,$2)", [
    app,
    { note: "VOD observada, avaliação humana de decisões." },
  ]);
  await expect(
    dev("offer", app, 1, { ...offer, benefits: ["pro_access"] }),
  ).rejects.toThrow(/Unavailable/);
  scholarship = (await dev("offer", app, 1, offer)).id;
  await as(learner);
  expect(await rpc("public.esports_benefits()")).toEqual([]);
  await expect(dev("accept", scholarship, 1, {})).rejects.toThrow(/acceptance/);
  await as(other);
  await expect(
    dev("accept", scholarship, 1, { accepted: true }),
  ).rejects.toThrow();
  await as(learner);
  await dev("accept", scholarship, 1, { accepted: true });
  expect(
    (await rpc("public.esports_benefits()")).map((b: any) => b.capability),
  ).toContain("materials");
  expect((await rpc("public.esports_workspace()")).applications[0].status).toBe(
    "development_active",
  );
  expect(
    (await rpc("public.esports_workspace()")).roles.some(
      (r: any) => r.role === "academy_player",
    ),
  ).toBe(false);
});
it("shares only program goals and feedback, with owner progress and assigned evaluator access", async () => {
  await as(staff);
  goal = (
    await dev("goal", null, 0, {
      scholarship_id: scholarship,
      title: "Revisar rotação",
      description: "Estudar o contexto e registrar a decisão.",
      kind: "vod",
      due_at: future(),
      route: "/app/vod",
    })
  ).id;
  await dev("review", null, 0, {
    scholarship_id: scholarship,
    shared_feedback: "Revisar recursos antes da rotação.",
    internal_note: "Nota confidencial do orientador",
    next_step: "Comparar duas situações de jogo.",
  });
  await as(learner);
  const d = await rpc("public.esports_development()");
  expect(d.goals).toHaveLength(1);
  expect(JSON.stringify(d)).not.toContain("confidencial");
  await dev("progress", goal, 1, {
    state: "completed",
    learner_note: "Resultado autodeclarado",
  });
  await as(other);
  expect((await rpc("public.esports_development()")).goals).toHaveLength(0);
  await expect(
    dev("progress", goal, 2, { state: "completed" }),
  ).rejects.toThrow();
});
it("requires manual roster authorization, revokes benefits and preserves independent training data", async () => {
  await as(admin);
  const version = (await rpc("public.esports_admin_data()")).applications[0]
    .version;
  await expect(
    dev("roster_decision", app, version, {
      kind: "academy_player",
      requirements_confirmed: true,
      ends_at: future(),
      reason: "Decisão da direção",
      formalization_reference: "Revisão registrada",
    }),
  ).rejects.toThrow(/review/);
  await expect(
    dev("roster_decision", app, version, { kind: "roster_player" }),
  ).rejects.toThrow(/separate/);
  await dev("revoke", scholarship, 2, {
    reason: "Encerramento por decisão humana",
  });
  await as(learner);
  expect(await rpc("public.esports_benefits()")).toEqual([]);
  expect((await rpc("public.esports_development()")).goals).toHaveLength(0);
  await expect(
    dev("progress", goal, 2, { state: "planned" }),
  ).rejects.toThrow();
});
it("rejects incomplete balanced selection atomically and prevents lifecycle shortcuts", async () => {
  await as(admin);
  const insufficient = await action("exam", null, 0, {
    title: "Prova sem questões suficientes",
    instructions: "Leia as questões com atenção.",
    rules: "Regras transparentes de avaliação.",
    blueprint: [
      { category: "Fundamentos", difficulty: "foundation", count: 2 },
    ],
    minutes: 10,
    max_attempts: 1,
    published: true,
  });
  await action("assign", app, 0, {
    exam_id: insufficient.id,
    available_until: future(),
  });
  await expect(
    rpc("public.esports_admin_action('status',$1,0,$2)", [
      app,
      { status: "academy_selected" },
    ]),
  ).rejects.toThrow(/explicit/);
  await expect(
    rpc("private.esports_admin_action_internal('status',$1,0,'{}')", [app]),
  ).rejects.toThrow();
  await as(learner);
  await expect(
    rpc("public.esports_start_exam($1,$2,true)", [app, insufficient.id]),
  ).rejects.toThrow(/Insufficient/);
  expect((await rpc("public.esports_trials()")).attempts).toHaveLength(2);
  await as(other);
  await expect(rpc("public.esports_development(true)")).rejects.toThrow();
  await expect(rpc("public.esports_assessment_admin()")).rejects.toThrow();
});

it("purges expired retained applications without touching an active evaluation or personal profile", async () => {
  await db.exec("reset role");
  const cycleId = (
    await db.query<{ id: string }>(
      "insert into public.esports_cycles(title,mode,format,criteria,rules,privacy_notice,policy_version,retention_days,starts_at,ends_at) values('Ciclo antigo','both','solo','Critérios de teste','Regras de teste','Privacidade de teste','v1',30,now()-interval '60 days',now()-interval '40 days') returning id",
    )
  ).rows[0].id;
  await db.query(
    "insert into public.esports_applications(user_id,cycle_id,status,payload,consent_snapshot,created_at,updated_at) values($1,$2,'not_selected','{}','{\"retention_days\":30}',now()-interval '45 days',now()-interval '40 days')",
    [other, cycleId],
  );
  await as(admin);
  expect(await rpc("public.esports_purge(null,'EXCLUIR DADOS ESPORTS')")).toBe(
    1,
  );
  await as(learner);
  expect((await rpc("public.esports_workspace()")).applications).toHaveLength(
    1,
  );
  await as(other);
  expect(
    (await db.query("select * from public.profiles")).rows.some(
      (p: any) => p.id === other,
    ),
  ).toBe(true);
});

it("paginates questions and per-attempt reviews without leaking staff or ordinary-user data", async () => {
  await db.exec("reset role; begin");
  try {
    await db.query(
      "insert into private.esports_questions select (jsonb_populate_record(null::private.esports_questions,to_jsonb(q)||jsonb_build_object('id',gen_random_uuid(),'prompt','Page regression question '||lpad(i::text,3,'0')))).* from private.esports_questions q cross join generate_series(1,51) i where q.id=$1",
      [question],
    );
    await db.query(
      "insert into private.esports_attempt_reviews(attempt_id,reviewer_id,attempt_version,grades,review_note,feedback,released) select $1,$2,1,'{}','Paginated private review','Test feedback',false from generate_series(1,51)",
      [attempt.id, staff],
    );
    await as(admin);
    const first = await rpc(
      "public.esports_assessment_page(0,'Page regression',0,$1)",
      [attempt.id],
    );
    const second = await rpc(
      "public.esports_assessment_page(50,'Page regression',50,$1)",
      [attempt.id],
    );
    expect(first.questions).toHaveLength(50);
    expect(second.questions).toHaveLength(1);
    expect(first.review_history).toHaveLength(50);
    expect(second.review_history.length).toBeGreaterThan(0);
    expect(
      new Set([...first.questions, ...second.questions].map((q: any) => q.id))
        .size,
    ).toBe(51);
    expect(
      new Set(
        [...first.review_history, ...second.review_history].map(
          (r: any) => r.id,
        ),
      ).size,
    ).toBe(first.review_history.length + second.review_history.length);
    expect(
      (await rpc("public.esports_assessment_page()")).review_history,
    ).toEqual([]);
    await db.exec("savepoint denial");
    await expect(rpc("public.esports_assessment_page(-1)")).rejects.toThrow(
      "Invalid search",
    );
    await db.exec("rollback to savepoint denial");
    await as(staff);
    expect(
      (await rpc("public.esports_assessment_page(0,'',0,$1)", [attempt.id]))
        .questions,
    ).toEqual([]);
    await as(other);
    await db.exec("savepoint denial");
    await expect(
      rpc("public.esports_assessment_page(0,'',0,$1)", [attempt.id]),
    ).rejects.toThrow("Administrative role required");
    await db.exec("rollback to savepoint denial");
    await as(staff);
    await db.query(
      "select set_config('request.jwt.claims','{\"aal\":\"aal1\"}',false)",
    );
    await db.exec("savepoint denial");
    await expect(rpc("public.esports_assessment_page()")).rejects.toThrow(
      "Administrative role required",
    );
    await db.exec("rollback to savepoint denial");
  } finally {
    await db.exec("rollback; reset role");
  }
});
it("administrative reads preserve expired attempts until an authorized explicit expiration", async () => {
  await db.exec("reset role; begin");
  try {
    const id = crypto.randomUUID();
    await db.query(
      "insert into private.esports_attempts select (jsonb_populate_record(null::private.esports_attempts,to_jsonb(a)||jsonb_build_object('id',$1::text,'number',999,'status','active','deadline',now()-interval '1 second'))).* from private.esports_attempts a where a.id=$2",
      [id, attempt.id],
    );
    await as(admin);
    await rpc("public.esports_assessment_admin()");
    await rpc("public.esports_assessment_page()");
    await db.exec("reset role");
    expect(
      (
        await db.query<{ status: string }>(
          "select status from private.esports_attempts where id=$1",
          [id],
        )
      ).rows[0].status,
    ).toBe("active");
    await as(other);
    await db.exec("savepoint denial");
    await expect(rpc("public.esports_expire_assessments()")).rejects.toThrow(
      "Administrative role required",
    );
    await db.exec("rollback to savepoint denial");
    await as(staff);
    await db.query(
      "select set_config('request.jwt.claims','{\"aal\":\"aal1\"}',false)",
    );
    await db.exec("savepoint denial");
    await expect(rpc("public.esports_expire_assessments()")).rejects.toThrow(
      "Administrative role required",
    );
    await db.exec("rollback to savepoint denial");
    await as(admin);
    expect(await rpc("public.esports_expire_assessments()")).toBe(1);
    expect(await rpc("public.esports_expire_assessments()")).toBe(0);
    await db.exec("reset role");
    expect(
      (
        await db.query<{ status: string }>(
          "select status from private.esports_attempts where id=$1",
          [id],
        )
      ).rows[0].status,
    ).toBe("submitted");
    expect(
      (
        await db.query(
          "select id from private.esports_audit where target_id=$1 and action='exam_submitted'",
          [id],
        )
      ).rows,
    ).toHaveLength(1);
  } finally {
    await db.exec("rollback; reset role");
  }
});
it("exports only own shareable data and queues erasure with explicit administrative execution", async () => {
  await as(learner);
  const exported = await rpc("public.esports_export()");
  expect(exported.attempts).toHaveLength(2);
  expect(JSON.stringify(exported)).not.toContain("Nota confidencial");
  await rpc("public.esports_request_erasure()");
  await expect(
    rpc("public.esports_purge($1,'EXCLUIR DADOS ESPORTS')", [learner]),
  ).rejects.toThrow();
  await as(admin);
  await expect(
    rpc("public.esports_purge($1,'SIM')", [learner]),
  ).rejects.toThrow();
  expect(
    await rpc("public.esports_purge($1,'EXCLUIR DADOS ESPORTS')", [learner]),
  ).toBe(1);
  await as(learner);
  expect((await rpc("public.esports_export()")).attempts).toHaveLength(0);
  expect(
    (await db.query("select * from public.profiles")).rows.some(
      (p: any) => p.id === learner,
    ),
  ).toBe(true);
});

it("bounds administrative writes and expires assigned evaluator access immediately", async () => {
  await db.exec("reset role");
  await db.query(
    "insert into private.esports_audit(actor_id,action) select $1,'quota_fixture' from generate_series(1,120)",
    [staff],
  );
  await as(staff);
  await expect(action("grade", attempt.id, 1, {})).rejects.toThrow(
    /rate limit/,
  );
  await expect(rpc("public.esports_expire_assessments()")).rejects.toThrow(
    /rate limit/,
  );
  await db.exec("reset role");
  await db.query(
    "update private.esports_role_grants set ends_at=starts_at+interval '1 millisecond' where user_id=$1",
    [staff],
  );
  await as(staff);
  await expect(rpc("public.esports_assessment_admin()")).rejects.toThrow(
    /role required/,
  );
});

it("clears linked audit and private cascades during account deletion", async () => {
  await db.exec("reset role");
  const cycle = (
    await db.query<{ id: string }>(
      "select id from public.esports_cycles limit 1",
    )
  ).rows[0].id;
  const application = (
    await db.query<{ id: string }>(
      "insert into public.esports_applications(user_id,cycle_id,payload,consent_snapshot) values($1,$2,'{}','{}') returning id",
      [other, cycle],
    )
  ).rows[0].id;
  await db.query(
    "insert into private.esports_audit(actor_id,action,target_id,detail) values($1,'submitted',$2,'{\"note\":\"private candidate context\"}'),($1,'grant_role',gen_random_uuid(),jsonb_build_object('user_id',$3::text))",
    [admin, application, other],
  );
  await db.query("delete from auth.users where id=$1", [other]);
  expect(
    (
      await db.query("select id from public.esports_applications where id=$1", [
        application,
      ])
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "select id from private.esports_audit where target_id=$1 or detail->>'user_id'=$2",
        [application, other],
      )
    ).rows,
  ).toHaveLength(0);
});
