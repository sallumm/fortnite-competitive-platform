import { spawn } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const db = `audit2421_${Date.now()}`,
  container = "kyrven-m24-1-pg",
  evidence = [];
const baseline = process.argv.includes("--baseline-031");
const dir = process.env.KYRVEN_NATIVE_EVIDENCE_DIR || "artifacts/mission2421";
mkdirSync(dir, { recursive: true });
const output =
  dir + "/native-" + (baseline ? "audited031" : "corrected031") + ".json";
evidence.push = function (item) {
  Array.prototype.push.call(this, item);
  writeFileSync(output, JSON.stringify({ db, evidence: this }, null, 2));
  console.log(item.case);
  return this.length;
};
function sql(q, d = db) {
  return new Promise((resolve, reject) => {
    const p = spawn(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "VERBOSITY=verbose",
        "-U",
        "postgres",
        "-h",
        "127.0.0.1",
        "-d",
        d,
      ],
      { windowsHide: true },
    );
    let out = "",
      err = "";
    p.stdout.on("data", (x) => (out += x));
    p.stderr.on("data", (x) => (err += x));
    p.on("error", reject);
    p.on("close", (c) => (c ? reject(new Error(err)) : resolve(out.trim())));
    p.stdin.end(q);
  });
}
const u = "24200000-0000-4000-8000-000000000001",
  b = "24200000-0000-4000-8000-000000000002",
  adm = "24200000-0000-4000-8000-000000000003",
  app = "24200000-0000-4000-8000-000000000010",
  sch = "24200000-0000-4000-8000-000000000011",
  cy = "24200000-0000-4000-8000-000000000012";
const auth = (q, id = u) =>
  sql(
    `begin;set local role authenticated;set local "request.jwt.claim.sub"='${id}';set local "request.jwt.claims"='{"aal":"${id === adm ? "aal2" : "aal1"}"}';set local statement_timeout='10s';${q};commit;`,
  );
const names =
  "'save_meta_draft','publish_meta_draft','esports_admin_action_internal','esports_answer_exam','esports_assessment_action_internal','esports_development_action_internal','esports_withdraw','esports_purge','esports_development_action','esports_request_erasure','esports_admin_action','esports_write_limit'";
async function functions() {
  return JSON.parse(
    await sql(
      `select json_agg(json_build_object('signature',p.oid::regprocedure::text,'oid',p.oid,'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'prosecdef',p.prosecdef,'proconfig',p.proconfig,'definition',pg_get_functiondef(p.oid)) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private') and p.proname in(${names})`,
    ),
  );
}
const record = () =>
  `select public.record_academy_study('${lesson}','started')`;
const propose =
  "select public.coach_propose(jsonb_build_object('kind','create','items',jsonb_build_array(jsonb_build_object('title','Synthetic rest','kind','rest','duration_minutes',10,'starts_at',now()+interval '2 days'))))";
async function fixture() {
  await sql(
    `delete from public.esports_applications where id='${app}';insert into public.esports_applications(id,user_id,cycle_id,status,payload,consent_snapshot) values('${app}','${u}','${cy}','development_offered','{"age_band":"adult"}','{}');insert into private.esports_scholarships(id,application_id,user_id,title,terms,benefits,starts_at,ends_at) values('${sch}','${app}','${u}','Synthetic offer','Synthetic terms for isolated audit','["materials"]',now()-interval '1 hour',now()+interval '1 day');`,
  );
}
async function barrier(name, event = "PgSleep") {
  for (let i = 0; i < 100; i++) {
    if (
      (await sql(
        `select exists(select 1 from pg_stat_activity where datname=current_database() and application_name='${name}' and wait_event='${event}')`,
      )) === "t"
    )
      return;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw Error("Barrier not reached: " + name);
}
async function barrierDB(name, d) {
  for (let i = 0; i < 100; i++) {
    if (
      (await sql(
        `select exists(select 1 from pg_stat_activity where datname=current_database() and application_name='${name}' and wait_event='PgSleep')`,
        d,
      )) === "t"
    )
      return;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw Error("Barrier not reached");
}
async function state() {
  return JSON.parse(
    await sql(
      `select json_build_object('application',(select status from public.esports_applications where id='${app}'),'scholarship',(select status from private.esports_scholarships where id='${sch}'),'roles',(select count(*) from private.esports_role_grants where application_id='${app}' and revoked_at is null),'benefits',(select count(*) from private.esports_benefit_grants where scholarship_id='${sch}' and revoked_at is null))`,
    ),
  );
}
for (let i = 0; ; i++) {
  try {
    await sql("select 1", "postgres");
    break;
  } catch (e) {
    if (i > 30) throw e;
    await new Promise((r) => setTimeout(r, 500));
  }
}
await sql(`create database ${db}`, "postgres");
await sql(
  "create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
);
for (const f of readdirSync("supabase/migrations")
  .sort()
  .filter((f) => f.endsWith(".sql") && f.slice(8, 12) <= "0030"))
  await sql(readFileSync("supabase/migrations/" + f, "utf8"));
// Loaded by mission2421-native.mjs after an isolated 001-030 fixture is installed.
const original = readFileSync(
  baseline
    ? "tests/fixtures/migration031-audited.sql"
    : "supabase/migrations/202610120031_rpc_quotas_auth_readiness.sql",
  "utf8",
);
if (baseline)
  assert.equal(
    createHash("sha256").update(original).digest("hex"),
    "e0009a17efa8095170f249b5bff4dd7579ac7a499db866db42f4b433a3ee6955",
  );
const hosted = JSON.parse(
  readFileSync("tests/fixtures/hosted030-functions.json", "utf8"),
);
for (const h of hosted) {
  const local = (await functions()).find((x) => x.signature === h.signature);
  assert.equal(local.definition, h.definition);
  if (h.acl.includes("service_role=X/postgres"))
    await sql(`grant execute on function ${h.signature} to service_role`);
  const normalized = (x) => x.replace(/[{}]/g, "").split(",").sort();
  assert.deepEqual(
    normalized(
      (await functions()).find((x) => x.signature === h.signature).acl,
    ),
    normalized(h.acl),
  );
}
// Model observed public defaults/ACLs without granting anything in the hosted project.
await sql(
  "grant all on public.academy_records to anon,authenticated,service_role;grant all on public.coach_actions to authenticated,service_role",
);
const before = await functions();
await sql(
  `insert into auth.users values('${u}'),('${b}'),('${adm}');insert into public.profiles(id,display_name,mode,level,objective,minutes,input) select id,'Synthetic','build','beginner','aim',30,'kbm' from auth.users;insert into private.user_roles values('${adm}','admin');insert into public.esports_cycles(id,title,mode,format,criteria,rules,privacy_notice,policy_version,retention_days,starts_at,ends_at) values('${cy}','Synthetic','both','solo','Synthetic criteria','Synthetic local rules','Synthetic privacy notice','v1',30,now()-interval '1 day',now()+interval '1 day');`,
);
const lesson = await sql(
  "select id from public.articles where kind='lesson' and curriculum is not null and published and published_at<=now() order by id limit 1",
);
await auth(record());
await auth(propose);
// Backfill pause is after the read, exactly where the original audit exposed the gap.
const upgrading = sql(
  "set application_name='a242_backfill';" +
    original.replace(
      "-- At the shared INSERT boundary",
      "select pg_sleep(2);\n-- At the shared INSERT boundary",
    ),
);
await barrier("a242_backfill");
const start = Date.now();
const writers = [
  auth("set local application_name='a242_academy_writer';" + record()),
  auth("set local application_name='a242_coach_writer';" + propose),
];
if (!baseline) {
  await barrier("a242_academy_writer", "relation");
  await barrier("a242_coach_writer", "relation");
}
await Promise.all([upgrading, ...writers]);
const counters = await sql(
  `select string_agg(cardinality(consumed_at)::text,',' order by kind) from private.resource_quota where user_id='${u}'`,
);
assert.equal(counters, baseline ? "1,1" : "2,2");
evidence.push({
  case: "A242-01 Academy + Coach concurrent API writers during backfill",
  counters,
  committed: "2,2",
  writerElapsedMs: Date.now() - start,
  result: baseline
    ? "FAIL reproduced: undercount"
    : "PASS: both blocked then counted",
});
const after = await functions();
for (const old of before) {
  const next = after.find((x) => x.oid === old.oid);
  assert(next);
  for (const key of ["owner", "acl", "prosecdef", "proconfig"])
    assert.deepEqual(next[key], old[key]);
}
evidence.push({
  case: "upgrade with existing data and observed hosted function/table ACLs",
  functions: before.length,
  result: "PASS; OID/owner/ACL/security/path retained",
});
await auth("select public.clear_academy_study()");
await sql(
  `update private.resource_quota set consumed_at=array[clock_timestamp()-interval '2 hours'] where user_id='${u}' and kind='academy'`,
);
const triggerDef = await sql(
  "select pg_get_functiondef('private.resource_quota_insert()'::regprocedure)",
);
const pausePoint = baseline
  ? "select consumed_at into times"
  : "if not found or times is null";
assert(triggerDef.includes(pausePoint));
await sql(triggerDef.replace(pausePoint, "perform pg_sleep(2);" + pausePoint));
const insertion = auth("set local application_name='a242_prune';" + record());
await barrier("a242_prune");
const pruning = sql(
  "set application_name='a242_pruning';select private.prune_resource_quota()",
);
if (!baseline) await barrier("a242_pruning", "transactionid");
await Promise.all([insertion, pruning]);
await sql(triggerDef);
const counterRows = await sql(
  `select count(*) from private.resource_quota where user_id='${u}' and kind='academy'`,
);
assert.equal(counterRows, baseline ? "0" : "1");
if (!baseline)
  assert.equal(
    await sql(
      `select cardinality(consumed_at) from private.resource_quota where user_id='${u}' and kind='academy'`,
    ),
    "1",
  );
evidence.push({
  case: "A242-02 prune after upsert before timestamp filtering",
  counterRows,
  result: baseline
    ? "FAIL reproduced: committed unmetered action"
    : "PASS: prune waits, reevaluates, retains live row",
});
if (!baseline) {
  const saved = await sql(
    `select consumed_at from private.resource_quota where user_id='${u}' and kind='academy'`,
  );
  await assert.rejects(auth(record() + ";select 1/0"), /division by zero/);
  await auth(record() + ";rollback");
  assert.equal(
    await sql(
      `select consumed_at from private.resource_quota where user_id='${u}' and kind='academy'`,
    ),
    saved,
  );
  await sql(
    `update private.resource_quota set consumed_at=array[clock_timestamp()-interval '2 hours'] where user_id='${u}' and kind='academy'`,
  );
  const firstPrune = sql(
    "set application_name='a242_prune_first';begin;select private.prune_resource_quota();select pg_sleep(2);commit;",
  );
  await barrier("a242_prune_first");
  const newRow = auth("set local application_name='a242_recreate';" + record());
  await barrier("a242_recreate", "transactionid");
  await Promise.all([firstPrune, newRow]);
  assert.equal(
    await sql(
      `select cardinality(consumed_at) from private.resource_quota where user_id='${u}' and kind='academy'`,
    ),
    "1",
  );
  await sql(
    "create function public.a242_suppress_quota() returns trigger language plpgsql as $$begin return null;end;$$;create trigger a242_suppress_quota before update on private.resource_quota for each row execute function public.a242_suppress_quota()",
  );
  await assert.rejects(auth(record()), /Quota reservation unavailable/);
  await sql(
    "drop trigger a242_suppress_quota on private.resource_quota;drop function public.a242_suppress_quota()",
  );
  await assert.rejects(
    auth("select private.prune_resource_quota()"),
    /permission denied/,
  );
  assert.equal(
    await sql(
      "select bool_or(has_table_privilege(r,'private.resource_quota',p)) from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) p",
    ),
    "f",
  );
  await auth(record(), b);
  assert.equal(
    await sql(
      `select cardinality(consumed_at) from private.resource_quota where user_id='${b}' and kind='academy'`,
    ),
    "1",
  );
  evidence.push({
    case: "prune-first recreation, rollback/error, forced missing RETURNING fail-closed, ACL isolation",
    result: "PASS",
  });
}
const outcome = (p) =>
  p.then(
    () => ({ ok: true }),
    (err) => ({
      ok: false,
      deadlock: /deadlock detected/.test(err.message),
      version: /Version conflict|scholarship|Scholarship/.test(err.message),
    }),
  );
// Each mutation is an authenticated RPC in its own psql connection. No direct admin SQL writes.
for (const action of baseline ? ["revoke"] : ["revoke", "end", "extend"])
  for (const direction of ["admin-first", "withdraw-first"]) {
    await fixture();
    if (action === "extend")
      await auth(
        `select public.esports_development_action('accept','${sch}',1,'{"accepted":true}')`,
      );
    const expected = action === "extend" ? 2 : 1;
    const payload = JSON.stringify({
      reason: "Synthetic local decision",
      ends_at: new Date(Date.now() + 2 * 864e5).toISOString(),
    }).replaceAll("'", "''");
    let results;
    if (direction === "admin-first") {
      await sql(
        "create function public.a242_admin_pause() returns trigger language plpgsql as $$begin if current_setting('application_name')='a242_admin_first' then perform pg_sleep(2);end if;return new;end;$$;create trigger a242_admin_pause before update on private.esports_scholarships for each row execute function public.a242_admin_pause()",
      );
      const admin = outcome(
        auth(
          `set local application_name='a242_admin_first';select public.esports_development_action('${action}','${sch}',${expected},'${payload}')`,
          adm,
        ),
      );
      await barrier("a242_admin_first");
      const owner = outcome(
        auth(
          `set local application_name='a242_withdraw_second';select public.esports_withdraw('${app}')`,
        ),
      );
      await barrier("a242_withdraw_second", "transactionid");
      results = await Promise.all([admin, owner]);
      await sql(
        "drop trigger a242_admin_pause on private.esports_scholarships;drop function public.a242_admin_pause()",
      );
    } else {
      const wd = await sql(
        "select pg_get_functiondef('public.esports_withdraw(uuid)'::regprocedure)",
      );
      await sql(
        wd.replace(
          "update private.esports_scholarships",
          "perform pg_sleep(2);update private.esports_scholarships",
        ),
      );
      const owner = outcome(
        auth(
          `set local application_name='a242_withdraw_first';select public.esports_withdraw('${app}')`,
        ),
      );
      await barrier("a242_withdraw_first");
      const admin = outcome(
        auth(
          `set local application_name='a242_admin_second';select public.esports_development_action('${action}','${sch}',${expected},'${payload}')`,
          adm,
        ),
      );
      await barrier("a242_admin_second", "transactionid");
      results = await Promise.all([admin, owner]);
      await sql(wd);
    }
    if (baseline) assert(results.some((r) => r.deadlock));
    else {
      assert(!results.some((r) => r.deadlock));
      assert(results[1].ok);
      assert.equal((await state()).application, "withdrawn");
      assert.equal((await state()).roles, 0);
      assert.equal((await state()).benefits, 0);
    }
    evidence.push({
      case: `A242-03 ${action} / withdrawal ${direction}`,
      results,
      final: await state(),
      result: baseline
        ? "FAIL reproduced: deadlock"
        : "PASS: withdrawal committed; stale admin decision rejected if needed; no retry",
    });
  }
// FK KEY SHARE variant: admin holds A before inserting a profile-linked roster grant.
await fixture();
await auth(
  `select public.esports_development_action('accept','${sch}',1,'{"accepted":true}')`,
);
await sql(
  "update private.esports_launch_gate set roster_reviewed=true;create function public.a242_roster_pause() returns trigger language plpgsql as $$begin if current_setting('application_name')='a242_roster_first' then perform pg_sleep(2);end if;return new;end;$$;create trigger a242_roster_pause before insert on private.esports_role_grants for each row execute function public.a242_roster_pause()",
);
const rosterFirst = outcome(
  auth(
    `set local application_name='a242_roster_first';select public.esports_development_action('roster_decision','${app}',2,'{"kind":"academy_player","requirements_confirmed":true,"ends_at":"${new Date(Date.now() + 2 * 864e5).toISOString()}","reason":"Synthetic decision","formalization_reference":"Synthetic reference"}')`,
    adm,
  ),
);
await barrier("a242_roster_first");
const rosterWithdraw = outcome(
  auth(
    `set local application_name='a242_roster_withdraw';select public.esports_withdraw('${app}')`,
  ),
);
await barrier("a242_roster_withdraw", "transactionid");
const rosterOutcomes = await Promise.all([rosterFirst, rosterWithdraw]);
if (baseline) assert(rosterOutcomes.some((x) => x.deadlock));
else {
  assert(rosterOutcomes.every((x) => x.ok));
  assert.equal((await state()).application, "withdrawn");
  assert.equal((await state()).roles, 0);
}
await sql(
  "drop trigger a242_roster_pause on private.esports_role_grants;drop function public.a242_roster_pause();update private.esports_launch_gate set roster_reviewed=false",
);
evidence.push({
  case: "admin roster / withdrawal: profile FK KEY SHARE versus actor lock",
  result: baseline
    ? "FAIL reproduced: FK/profile lock deadlock"
    : "PASS: NO KEY UPDATE serializes actors while allowing FK checks",
  rosterOutcomes,
});
if (!baseline) {
  await fixture();
  // Multiple scholarships: terminal history plus current active scholarship, distinct IDs.
  await sql(
    `insert into private.esports_scholarships(application_id,user_id,status,title,terms,benefits,starts_at,ends_at) values('${app}','${u}','ended','Historical','Synthetic historical scholarship terms','["materials"]',now()-interval '2 days',now()-interval '1 day')`,
  );
  await auth(
    `select public.esports_withdraw('${app}');select public.esports_withdraw('${app}')`,
  );
  assert.equal(
    await sql(
      `select count(*) from public.esports_status_events where application_id='${app}' and status='withdrawn'`,
    ),
    "1",
  );
  await assert.rejects(
    auth(
      `select public.esports_development_action('accept','${sch}',1,'{"accepted":true}')`,
    ),
    /Offer unavailable/,
  );
  await assert.rejects(
    auth(`select public.esports_withdraw('${app}')`, b),
    /Application unavailable/,
  );
  await assert.rejects(
    sql(
      `begin;set local role authenticated;set local "request.jwt.claim.sub"='${adm}';set local "request.jwt.claims"='{"aal":"aal1"}';select public.esports_development_action('revoke','${sch}',2,'{"reason":"Synthetic"}');commit;`,
    ),
    /Administrative role required/,
  );
  await sql(
    `insert into private.esports_erasure_requests(user_id,status) values('${u}','handled') on conflict(user_id) do update set status='handled'`,
  );
  await fixture();
  const accept = auth(
    `set local application_name='a242_accept_hold';select public.esports_development_action('accept','${sch}',1,'{"accepted":true}');select pg_sleep(2)`,
  );
  await barrier("a242_accept_hold");
  const erasure = auth("select public.esports_request_erasure()");
  await Promise.all([accept, erasure]);
  assert.equal((await state()).scholarship, "revoked");
  assert.equal((await state()).roles, 0);
  assert.equal((await state()).application, "withdrawn");
  evidence.push({
    case: "terminal scholarship history, idempotence, ownership, AAL1 negative, accept/repeated erasure",
    result: "PASS",
    final: await state(),
  });
  // Review/goal/roster/progress variants acquire A first (owner progress also waits on actor).
  await sql(
    `update private.esports_erasure_requests set status='handled' where user_id='${u}'`,
  );
  for (const action of ["review", "goal", "roster_decision", "progress"]) {
    await fixture();
    await auth(
      `select public.esports_development_action('accept','${sch}',1,'{"accepted":true}')`,
    );
    const created = JSON.parse(
      await auth(
        `select public.esports_development_action('goal',null,0,'{"scholarship_id":"${sch}","title":"Synthetic goal","description":"Synthetic description","kind":"study"}')`,
        adm,
      ),
    );
    const payload = {
      review: {
        scholarship_id: sch,
        shared_feedback: "Synthetic feedback",
        internal_note: "Synthetic internal note",
        next_step: "Synthetic next step",
      },
      goal: {
        scholarship_id: sch,
        title: "Synthetic goal",
        description: "Synthetic description",
        kind: "study",
      },
      roster_decision: {
        kind: "academy_player",
        requirements_confirmed: true,
        ends_at: new Date(Date.now() + 2 * 864e5).toISOString(),
        reason: "Synthetic reason",
        formalization_reference: "Synthetic reference",
      },
      progress: { state: "completed", learner_note: "Synthetic note" },
    }[action];
    const target =
      action === "roster_decision"
        ? app
        : action === "review"
          ? "null"
          : created.id;
    const wd = await sql(
      "select pg_get_functiondef('public.esports_withdraw(uuid)'::regprocedure)",
    );
    await sql(
      wd.replace(
        "update private.esports_scholarships",
        "perform pg_sleep(2);update private.esports_scholarships",
      ),
    );
    const owner = outcome(
      auth(
        `set local application_name='a242_variant_withdraw';select public.esports_withdraw('${app}')`,
      ),
    );
    await barrier("a242_variant_withdraw");
    const other = outcome(
      auth(
        `set local application_name='a242_variant_second';select public.esports_development_action('${action}',${target === "null" ? "null" : "'" + target + "'"},1,'${JSON.stringify(payload)}')`,
        action === "progress" ? u : adm,
      ),
    );
    await barrier("a242_variant_second", "transactionid");
    const outcomes = await Promise.all([owner, other]);
    assert(outcomes[0].ok);
    assert(!outcomes.some((x) => x.deadlock));
    await sql(wd);
    assert.equal((await state()).application, "withdrawn");
    assert.equal((await state()).roles, 0);
    if (["progress", "roster_decision"].includes(action))
      assert(!outcomes[1].ok);
    evidence.push({
      case: `withdraw-first / ${action}`,
      outcomes,
      result:
        "PASS; no reactivation; review/goal may retain administrative history",
    });
  }
  // A direct trialist grant must not commit live after a consent withdrawal.
  for (const direction of ["admin-first", "withdraw-first"]) {
    await fixture();
    await sql(
      `update public.esports_applications set status='trial_invited' where id='${app}'`,
    );
    const wd = await sql(
      "select pg_get_functiondef('public.esports_withdraw(uuid)'::regprocedure)",
    );
    if (direction === "withdraw-first")
      await sql(
        wd.replace(
          "update private.esports_scholarships",
          "perform pg_sleep(2);update private.esports_scholarships",
        ),
      );
    else
      await sql(
        "create function public.a242_trialist_pause() returns trigger language plpgsql as $$begin if current_setting('application_name')='a242_trialist_admin' then perform pg_sleep(2);end if;return new;end;$$;create trigger a242_trialist_pause before insert on private.esports_role_grants for each row execute function public.a242_trialist_pause()",
      );
    const grant = () =>
      outcome(
        auth(
          `set local application_name='a242_trialist_admin';select public.esports_admin_action('grant_role','${app}',0,'{"user_id":"${u}","role":"trialist","ends_at":"${new Date(Date.now() + 864e5).toISOString()}","reason":"Synthetic trial invitation"}')`,
          adm,
        ),
      );
    const withdraw = () =>
      outcome(
        auth(
          `set local application_name='a242_trialist_owner';select public.esports_withdraw('${app}')`,
        ),
      );
    const first = direction === "admin-first" ? grant() : withdraw();
    await barrier(
      direction === "admin-first"
        ? "a242_trialist_admin"
        : "a242_trialist_owner",
    );
    const second = direction === "admin-first" ? withdraw() : grant();
    await barrier(
      direction === "admin-first"
        ? "a242_trialist_owner"
        : "a242_trialist_admin",
      "transactionid",
    );
    const outcomes = await Promise.all([first, second]);
    assert(outcomes[direction === "admin-first" ? 1 : 0].ok);
    assert(!outcomes.some((x) => x.deadlock));
    assert.equal((await state()).roles, 0);
    if (direction === "admin-first")
      await sql(
        "drop trigger a242_trialist_pause on private.esports_role_grants;drop function public.a242_trialist_pause()",
      );
    else await sql(wd);
    evidence.push({
      case: `trialist grant / withdrawal ${direction}`,
      result: "PASS; no live grant after withdrawal",
      outcomes,
    });
  }
  // Two applications in separate cycles: erasure locks their UUIDs in order.
  await fixture();
  const app2 = "24200000-0000-4000-8000-000000000020",
    sch2 = "24200000-0000-4000-8000-000000000021",
    cy2 = "24200000-0000-4000-8000-000000000022";
  await sql(
    `insert into public.esports_cycles(id,title,mode,format,criteria,rules,privacy_notice,policy_version,retention_days,starts_at,ends_at) values('${cy2}','Synthetic second','both','solo','Synthetic criteria','Synthetic rules','Synthetic notice','v1',30,now()-interval '1 day',now()+interval '1 day');insert into public.esports_applications(id,user_id,cycle_id,status,payload,consent_snapshot) values('${app2}','${u}','${cy2}','development_offered','{"age_band":"adult"}','{}');insert into private.esports_scholarships(id,application_id,user_id,title,terms,benefits,starts_at,ends_at) values('${sch2}','${app2}','${u}','Synthetic second','Synthetic scholarship terms','["materials"]',now()-interval '1 hour',now()+interval '1 day');`,
  );
  await sql(
    "create function public.a242_multi_pause() returns trigger language plpgsql as $$begin if current_setting('application_name')='a242_multi_admin' then perform pg_sleep(2);end if;return new;end;$$;create trigger a242_multi_pause before update on private.esports_scholarships for each row execute function public.a242_multi_pause()",
  );
  const multiAdmin = outcome(
    auth(
      `set local application_name='a242_multi_admin';select public.esports_development_action('revoke','${sch2}',1,'{"reason":"Synthetic multi"}')`,
      adm,
    ),
  );
  await barrier("a242_multi_admin");
  const multiErasure = outcome(
    auth(
      "set local application_name='a242_multi_erasure';select public.esports_request_erasure()",
    ),
  );
  await barrier("a242_multi_erasure", "transactionid");
  const multi = await Promise.all([multiAdmin, multiErasure]);
  assert(multi.every((x) => x.ok));
  await sql(
    "drop trigger a242_multi_pause on private.esports_scholarships;drop function public.a242_multi_pause()",
  );
  assert.equal(
    await sql(
      `select count(*) from private.esports_scholarships where user_id='${u}' and status in('offered','accepted')`,
    ),
    "0",
  );
  evidence.push({
    case: "multiple applications/scholarships: admin second application / erasure all applications",
    result: "PASS; no active scholarships; no deadlock",
  });
  // Catalog drift aborts the entire migration, even when version patterns still exist.
  const testdb = db + "_contracts";
  await sql(`create database ${testdb}`, "postgres");
  await sql(
    "create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
    testdb,
  );
  for (const f of readdirSync("supabase/migrations")
    .sort()
    .filter((f) => f.endsWith(".sql") && f.slice(8, 12) <= "0030"))
    await sql(readFileSync("supabase/migrations/" + f, "utf8"), testdb);
  const wd = await sql(
    "select pg_get_functiondef('public.esports_withdraw(uuid)'::regprocedure)",
    testdb,
  );
  await sql(wd.replace(" begin", " begin\n -- unexpected drift"), testdb);
  await assert.rejects(sql(original, testdb), /Unexpected 030 source contract/);
  assert.equal(
    await sql("select to_regclass('private.resource_quota') is null", testdb),
    "t",
  );
  await sql(wd, testdb);
  await assert.rejects(
    sql(original.replace("commit;", "select 1/0;commit;"), testdb),
    /division by zero/,
  );
  assert.equal(
    await sql("select to_regclass('private.resource_quota') is null", testdb),
    "t",
  );
  const holding = sql(
    "set application_name='a242_old_writer';begin;lock public.academy_records in row exclusive mode;select pg_sleep(7);commit;",
    testdb,
  );
  await barrierDB("a242_old_writer", testdb);
  const started = Date.now();
  await assert.rejects(sql(original, testdb), /lock timeout/);
  const elapsed = Date.now() - started;
  await holding;
  assert(elapsed >= 4900 && elapsed < 6500);
  assert.equal(
    await sql("select to_regclass('private.resource_quota') is null", testdb),
    "t",
  );
  await sql(original, testdb);
  evidence.push({
    case: "unexpected 030 body drift, migration rollback, earlier writer 5s timeout and subsequent successful upgrade",
    timeoutElapsedMs: elapsed,
    result: "PASS; no partial counter/triggers on failed upgrade",
  });
}
writeFileSync(
  output,
  JSON.stringify(
    {
      mode: baseline ? "audited031" : "corrected031",
      db,
      environment: await sql("select version()"),
      scope: "isolated native PostgreSQL; synthetic UID/AAL; no hosted Auth",
      evidence,
    },
    null,
    2,
  ),
);
