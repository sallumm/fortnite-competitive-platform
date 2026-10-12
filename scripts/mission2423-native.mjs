const baseline = process.argv.includes("--baseline-2422");
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const repo = resolve("."),
  out = resolve(
    process.env.KYRVEN_NATIVE_EVIDENCE_DIR || "artifacts/mission2423",
  );
mkdirSync(out, { recursive: true });
const container = process.env.KYRVEN_LOCAL_CONTAINER || "kyrven-m24-1-pg",
  db = "a2423_" + Date.now(),
  evidence = [];
function sql(q, d = db) {
  return new Promise((res, rej) => {
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
    let s = "",
      e = "";
    p.stdout.on("data", (b) => (s += b));
    p.stderr.on("data", (b) => (e += b));
    p.on("error", rej);
    p.on("close", (c) => (c ? rej(Error(e)) : res(s.trim())));
    p.stdin.end(q);
  });
}
const u = "24220000-0000-4000-8000-000000000001",
  b = "24220000-0000-4000-8000-000000000002",
  adm = "24220000-0000-4000-8000-000000000003",
  adm2 = "24220000-0000-4000-8000-000000000004",
  a = "24220000-0000-4000-8000-000000000010",
  s = "24220000-0000-4000-8000-000000000011",
  cy = "24220000-0000-4000-8000-000000000012";
function auth(q, id = u, iso = "read committed") {
  return sql(
    `begin isolation level ${iso};set local role authenticated;set local "request.jwt.claim.sub"='${id}';set local "request.jwt.claims"='{"aal":"${id === adm || id === adm2 ? "aal2" : "aal1"}"}';set local statement_timeout='12s';${q};commit;`,
  );
}
const outcome = (p) =>
  p.then(
    (output) => ({ ok: true, output }),
    (e) => ({
      ok: false,
      sqlstate: (e.message.match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5}):/) || [])[1],
      error: e.message,
    }),
  );
async function barrier(name, event = "PgSleep", d = db) {
  for (let i = 0; i < 130; i++) {
    if (
      (await sql(
        `select exists(select 1 from pg_stat_activity where datname=current_database() and application_name='${name}' and wait_event='${event}')`,
        d,
      )) === "t"
    )
      return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw Error("Barrier missing " + name + " " + event);
}
function record(item) {
  evidence.push(item);
  writeFileSync(
    resolve(out, "native-" + (baseline ? "before" : "after") + ".json"),
    JSON.stringify(
      {
        container,
        db,
        scope:
          "Local synthetic SQL auth.uid/AAL settings, not JWT or hosted Auth",
        evidence,
      },
      null,
      2,
    ),
  );
  console.log(item.case);
}
// Hold a real transaction until the controller explicitly commits it. Observe
// the final sentinel query, not a scheduling-dependent fixed sleep interval.
async function hold(q, name, id = null) {
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
      db,
    ],
    { windowsHide: true },
  );
  let output = "",
    error = "";
  p.stdout.on("data", (b) => (output += b));
  p.stderr.on("data", (b) => (error += b));
  p.stdin.on("error", () => {});
  const done = outcome(
    new Promise((res, rej) => {
      p.on("error", rej);
      p.on("close", (code) =>
        code
          ? rej(Error(error))
          : res(
              output
                .trim()
                .replace(/\n?HOLD_READY$/, "")
                .trim(),
            ),
      );
    }),
  );
  const identity = id
    ? `set local role authenticated;set local "request.jwt.claim.sub"='${id}';set local "request.jwt.claims"='{"aal":"${id === adm || id === adm2 ? "aal2" : "aal1"}"}';`
    : "";
  p.stdin.write(
    `begin isolation level read committed;set local statement_timeout='20s';set local idle_in_transaction_session_timeout='30s';set local application_name='${name}';${identity}${q};select 'HOLD_READY';\n`,
  );
  let ready = false;
  for (let i = 0; i < 130; i++) {
    if (
      (await sql(
        `select exists(select 1 from pg_stat_activity where datname=current_database() and application_name='${name}' and state='idle in transaction' and wait_event='ClientRead' and query like '%HOLD_READY%')`,
      )) === "t"
    ) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  if (!ready) {
    p.stdin.end("rollback;\n");
    throw Error("Held transaction not ready " + name);
  }
  return { done, release: () => p.stdin.end("commit;\n") };
}
async function installBase(d) {
  await sql(
    "create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;",
    d,
  );
  for (const f of readdirSync(resolve(repo, "supabase/migrations"))
    .sort()
    .filter((f) => f.endsWith(".sql") && f.slice(8, 12) <= "0030"))
    await sql(readFileSync(resolve(repo, "supabase/migrations", f), "utf8"), d);
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
await sql("create database " + db, "postgres");
await installBase(db);
const catalog = () =>
  sql(
    "select json_agg(json_build_object('signature',p.oid::regprocedure::text,'oid',p.oid,'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'definer',p.prosecdef,'config',p.proconfig,'definition',pg_get_functiondef(p.oid)) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private')",
  ).then(JSON.parse);
const hosted = JSON.parse(
  readFileSync(resolve(repo, "tests/fixtures/hosted030-functions-2423.json")),
);
for (const h of hosted) {
  const f = (await catalog()).find((x) => x.signature === h.signature);
  assert.equal(f.definition, h.definition);
  assert.equal(f.owner, h.owner);
  if (h.acl.includes("service_role=X/postgres"))
    await sql("grant execute on function " + h.signature + " to service_role");
}
const before = await catalog();
const securityCatalog = () =>
  sql(
    "select json_agg(json_build_object('name',n.nspname||'.'||c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'policies',(select json_agg(json_build_object('name',p.polname,'roles',p.polroles,'command',p.polcmd,'permissive',p.polpermissive,'qual',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname) from pg_policy p where p.polrelid=c.oid)) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'",
  ).then(JSON.parse);
const tableSecurityBefore = await securityCatalog();
const file = resolve(
    repo,
    baseline
      ? "tests/fixtures/migration031-audited2422.sql"
      : "supabase/migrations/202610120031_rpc_quotas_auth_readiness.sql",
  ),
  migration = readFileSync(file, "utf8");
if (baseline)
  assert.equal(
    (await import("node:crypto"))
      .createHash("sha256")
      .update(migration)
      .digest("hex"),
    "1523a229d8e61d9bd5dcbe1c791c67c47f4f750c1c4df8759ba70004fe67b530",
  );
await sql(migration);
const after = await catalog();
const tableSecurityAfter = await securityCatalog();
for (const table of tableSecurityBefore)
  assert.deepEqual(
    tableSecurityAfter.find((x) => x.name === table.name),
    table,
  );
for (const f of after.filter((x) => x.definer))
  assert.deepEqual(f.config, ['search_path=""']);
for (const f of before) {
  const n = after.find((x) => x.oid === f.oid);
  assert(n);
  for (const k of ["owner", "acl", "definer", "config"])
    assert.deepEqual(n[k], f[k]);
}
record({
  case: "030 upgrade preserves owners ACLs OIDs RLS/security path",
  result: "PASS",
  functions: before.length,
  hostedContracts: hosted.length,
  historicalTablesSecurity: tableSecurityBefore.length,
});
await sql(
  "insert into auth.users values('" +
    u +
    "'),('" +
    b +
    "'),('" +
    adm +
    "'),('" +
    adm2 +
    "');insert into public.profiles(id,display_name,mode,level,objective,minutes,input) select id,'Synthetic','build','beginner','aim',30,'kbm' from auth.users;insert into private.user_roles values('" +
    adm +
    "','admin'),('" +
    adm2 +
    "','admin');insert into public.esports_cycles(id,title,mode,format,criteria,rules,privacy_notice,policy_version,retention_days,starts_at,ends_at) values('" +
    cy +
    "','Synthetic','both','solo','Synthetic criteria','Synthetic rules','Synthetic privacy','v1',30,now()-interval '60 days',now()-interval '40 days')",
);
async function retired(status = "trial_completed") {
  await sql(
    "delete from public.esports_applications;insert into public.profiles(id,display_name,mode,level,objective,minutes,input) select '" +
      u +
      "','Synthetic','build','beginner','aim',30,'kbm' where not exists(select 1 from public.profiles where id='" +
      u +
      "');insert into public.esports_applications(id,user_id,cycle_id,status,payload,consent_snapshot,updated_at) values('" +
      a +
      "','" +
      u +
      "','" +
      cy +
      "','" +
      status +
      "','{\"age_band\":\"adult\"}','{}',now()-interval '35 days');insert into private.esports_reviews(application_id,actor_id,kind,note) values('" +
      a +
      "','" +
      adm +
      "','practical','Synthetic complete evaluation');update private.esports_erasure_requests set status='handled' where user_id='" +
      u +
      "'",
  );
}
const purge = "select public.esports_purge(null,'EXCLUIR DADOS ESPORTS')",
  offer =
    "select public.esports_development_action('offer','" +
    a +
    "',1,jsonb_build_object('title','Synthetic offer','terms','Synthetic audited scholarship terms','benefits',jsonb_build_array('materials'),'starts_at',now(),'ends_at',now()+interval '2 days'))";
for (const action of ["offer", "grant", "roster"]) {
  await retired(action === "grant" ? "trial_invited" : "trial_completed");
  await sql(
    "insert into public.esports_applications(user_id,cycle_id,status,payload,consent_snapshot,updated_at) values('" +
      b +
      "','" +
      cy +
      "','not_selected','{}','{}',now()-interval '35 days');update private.esports_launch_gate set roster_reviewed=true",
  );
  const mutation =
    action === "offer"
      ? offer
      : action === "grant"
        ? "select public.esports_admin_action('grant_role','" +
          a +
          "',0,jsonb_build_object('user_id','" +
          u +
          "','role','trialist','ends_at',now()+interval '2 days','reason','Synthetic grant'))"
        : "select public.esports_development_action('roster_decision','" +
          a +
          "',1,jsonb_build_object('kind','academy_player','requirements_confirmed',true,'ends_at',now()+interval '2 days','reason','Synthetic roster','formalization_reference','Synthetic proof'))";
  const writing = await hold(mutation, "rights_first", adm);
  const purging = outcome(
    auth("set local application_name='retention_wait';" + purge, adm2),
  );
  await barrier("retention_wait", baseline ? "transactionid" : "advisory");
  writing.release();
  const rows = await Promise.all([writing.done, purging]);
  assert(rows.every((x) => x.ok));
  const left = await sql(
    "select count(*) from public.esports_applications where id='" + a + "'",
  );
  assert.equal(left, baseline ? "0" : "1");
  assert.equal(rows[1].output, baseline ? "2" : "1");
  record({
    case: "A2422-01 " + action + " first / bulk purge; another eligible owner",
    result: baseline
      ? "FAIL reproduced: new rights deleted"
      : "PASS new rights retained, other eligible record purged",
    rows,
    protectedApplications: Number(left),
  });
}
await sql("update private.esports_launch_gate set roster_reviewed=false");
await retired();
const deleting = await hold(purge, "purge_first", adm2);
const later = outcome(
  auth("set application_name='offer_second';" + offer, adm),
);
await barrier("offer_second", baseline ? "transactionid" : "advisory");
deleting.release();
const inverse = await Promise.all([deleting.done, later]);
assert(inverse[0].ok && !inverse[1].ok);
assert(!inverse.some((x) => x.sqlstate === "40P01"));
record({
  case: "A2422-01 bulk purge first / offer",
  result: "PASS deleted candidate unavailable",
  inverse,
});
// Mutating the retention policy during waiting is covered by the same fence.
await retired();
const cyclePayload = (
  await sql(
    "select (to_jsonb(c)||'{\"retention_days\":730}')::text from public.esports_cycles c where id='" +
      cy +
      "'",
  )
).replaceAll("'", "''");
const cycleChange = await hold(
  "select public.esports_admin_action('cycle','" +
    cy +
    "',1,'" +
    cyclePayload +
    "'::jsonb)",
  "cycle_first",
  adm,
);
const cyclePurge = outcome(
  auth("set application_name='cycle_purge';" + purge, adm2),
);
// Historical purge can complete without waiting on the cycle; corrected purge
// must wait for the participating writer before reading its changed retention.
if (!baseline) await barrier("cycle_purge", "advisory");
else await cyclePurge;
cycleChange.release();
const crows = await Promise.all([cycleChange.done, cyclePurge]);
assert(crows.every((x) => x.ok));
const kept = await sql(
  "select count(*) from public.esports_applications where id='" + a + "'",
);
assert.equal(kept, baseline ? "0" : "1");
record({
  case: "A2422-01 cycle retention increased during waiting",
  result: baseline
    ? "FAIL reproduced: obsolete retention"
    : "PASS current retention preserved",
  crows,
  kept: Number(kept),
});
await sql(
  "update public.esports_cycles set retention_days=30 where id='" + cy + "'",
);
// Privileged synthetic mutations follow the documented writer fence. These
// exercise mutable participation and consent independently of cycle changes.
for (const [name, mutation] of [
  ["recent activity", "updated_at=now()"],
  ["consent retention", "consent_snapshot='{\"retention_days\":730}'::jsonb"],
]) {
  await retired();
  const writer = await hold(
    "select pg_advisory_xact_lock_shared(2423,31);update public.esports_applications set " +
      mutation +
      " where id='" +
      a +
      "'",
    "eligibility_writer",
  );
  const consumer = outcome(
    auth("set application_name='eligibility_purge';" + purge, adm2),
  );
  await barrier("eligibility_purge", baseline ? "transactionid" : "advisory");
  writer.release();
  const rows = await Promise.all([writer.done, consumer]);
  assert(rows.every((x) => x.ok));
  assert.equal(
    await sql(
      "select count(*) from public.esports_applications where id='" + a + "'",
    ),
    baseline ? "0" : "1",
  );
  record({
    case: "A2422-01 " + name + " changes while purge waits",
    result: baseline
      ? "FAIL reproduced: obsolete eligibility"
      : "PASS current eligibility preserved",
    rows,
  });
}
if (!baseline) {
  await retired();
  await sql(
    "insert into public.esports_applications(user_id,cycle_id,status,payload,consent_snapshot,updated_at) values('" +
      b +
      "','" +
      cy +
      "','not_selected','{}','{}',now()-interval '35 days')",
  );
  const firstAdmin = await hold(purge, "bulk_admin_first", adm);
  const secondAdmin = outcome(
    auth("set application_name='bulk_admin_second';" + purge, adm2),
  );
  await barrier("bulk_admin_second", "advisory");
  firstAdmin.release();
  const admins = await Promise.all([firstAdmin.done, secondAdmin]);
  assert(admins.every((x) => x.ok));
  assert.equal(
    await sql("select count(*) from public.esports_applications"),
    "0",
  );
  record({
    case: "A2422-01 two administrators / multiple eligible applications",
    result: "PASS serialized purges, no duplicated destructive decision",
    admins,
  });
  await retired();
  await assert.rejects(auth(purge, adm, "repeatable read"), /READ COMMITTED/);
  await assert.rejects(auth(purge, adm, "serializable"), /READ COMMITTED/);
  await assert.rejects(
    auth(
      "select public.esports_admin_action('note','" +
        a +
        '\',1,\'{"note":"Synthetic note"}\');' +
        purge,
      adm,
    ),
    /fresh transaction/,
  );
  // Revoke the responsible actor while its purge waits for the maintenance fence.
  await retired();
  const revoking = await hold(
    "select pg_advisory_xact_lock_shared(2423,31);delete from private.user_roles where user_id='" +
      adm +
      "'",
    "revoke_actor",
  );
  const lost = outcome(
    auth("set application_name='revoked_purge';" + purge, adm),
  );
  await barrier("revoked_purge", "advisory");
  revoking.release();
  const revoked = await Promise.all([revoking.done, lost]);
  assert(!revoked[1].ok && /after maintenance wait/.test(revoked[1].error));
  assert.equal(
    await sql(
      "select count(*) from public.esports_applications where id='" + a + "'",
    ),
    "1",
  );
  await sql("insert into private.user_roles values('" + adm + "','admin')");
  record({
    case: "A2422-01 post-wait authority rechecked / incompatible isolation and lock upgrade rejected",
    result: "PASS",
    lost: revoked[1],
  });
  await auth("select public.esports_request_erasure()");
  const explicit = await auth(
    "select public.esports_purge('" + u + "','EXCLUIR DADOS ESPORTS')",
    adm,
  );
  assert.equal(explicit, "1");
  assert.equal(
    await sql(
      "select status from private.esports_erasure_requests where user_id='" +
        u +
        "'",
    ),
    "handled",
  );
  await assert.rejects(
    auth(
      "select public.esports_purge('" + b + "','EXCLUIR DADOS ESPORTS')",
      adm,
    ),
    /Erasure request required/,
  );
  await assert.rejects(
    auth("select public.esports_purge(null,null)", adm),
    /explicit confirmation/,
  );
  await assert.rejects(
    sql(
      'begin;set role authenticated;set "request.jwt.claim.sub"=\'' +
        adm +
        '\';set "request.jwt.claims"=\'{"aal":"aal1"}\';' +
        purge,
    ),
    /Administrator/,
  );
  record({
    case: "Explicit erasure versus bulk retention; null/AAL1/no-request negative",
    result: "PASS",
    explicit,
  });
}
// Original 40P01 first. Corrected mode uses documented maintenance fence + NOWAIT tables.
const maintenance =
  "select pg_advisory_xact_lock(2423,31);do $locks$ declare r record;begin if exists(select 1 from pg_locks where locktype='advisory' and classid=2423 and objid=31 and objsubid=2 and mode='ShareLock' and granted and pid<>pg_backend_pid()) then raise exception 'Writers not drained';end if; for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private') and c.relkind='r' order by n.nspname,c.relname loop execute format('lock table %I.%I in access exclusive mode nowait',r.nspname,r.relname);end loop;end;$locks$;";
await retired("trial_invited");
await sql(
  "create function public.a2423_grant_pause() returns trigger language plpgsql as $$begin if current_setting('application_name')='grant_first' then perform pg_advisory_xact_lock(2423,32);end if;return new;end;$$;create trigger a2423_grant_pause before insert on private.esports_role_grants for each row execute function public.a2423_grant_pause();",
);
const grant =
  "select public.esports_admin_action('grant_role','" +
  a +
  "',0,jsonb_build_object('user_id','" +
  u +
  "','role','trialist','ends_at',now()+interval '1 day','reason','Synthetic grant'))";
const grantController = await hold(
  "select pg_advisory_xact_lock(2423,32)",
  "grant_controller",
);
const grantFirst = outcome(
  auth("set local application_name='grant_first';" + grant, adm),
);
await barrier("grant_first", "advisory");
const deleteSecond = outcome(
  sql(
    "begin;set local statement_timeout='10s';set local application_name='physical_delete';" +
      (baseline ? "" : maintenance) +
      "delete from public.profiles where id='" +
      u +
      "';commit;",
  ),
);
await barrier("physical_delete", baseline ? "transactionid" : "advisory");
grantController.release();
assert((await grantController.done).ok);
const physical = await Promise.all([grantFirst, deleteSecond]);
if (baseline) assert(physical.some((x) => x.sqlstate === "40P01"));
else assert(physical.every((x) => x.ok));
record({
  case: "R2422-04 grant first / physical deletion",
  result: baseline
    ? "FAIL reproduced: 40P01"
    : "PASS maintenance drained writer before DELETE",
  physical,
});
await retired("trial_invited");
const deleteFirst = await hold(
  (baseline ? "" : maintenance) +
    "delete from public.profiles where id='" +
    u +
    "'",
  "delete_first",
);
const grantSecond = outcome(
  auth("set application_name='grant_second';" + grant, adm),
);
await barrier("grant_second", baseline ? "transactionid" : "advisory");
deleteFirst.release();
const reverse = await Promise.all([deleteFirst.done, grantSecond]);
assert(
  reverse[0].ok &&
    !reverse[1].ok &&
    !reverse.some((x) => x.sqlstate === "40P01"),
);
record({
  case: "R2422-04 physical deletion first / grant",
  result: "PASS removed profile/application grant denied",
  reverse,
});
await sql(
  "drop trigger a2423_grant_pause on private.esports_role_grants;drop function public.a2423_grant_pause()",
);
if (!baseline) {
  // Any unrelated SQL reader/writer prevents exclusive NOWAIT maintenance; no deletion.
  await retired("trial_invited");
  const active = await hold(
    "select 1 from public.profiles limit 1",
    "uncoordinated",
  );
  const blocked = await outcome(
    sql(
      "begin;" +
        maintenance +
        "delete from public.profiles where id='" +
        u +
        "';commit",
    ),
  );
  assert(!blocked.ok && blocked.sqlstate === "55P03");
  active.release();
  assert((await active.done).ok);
  assert.equal(
    await sql("select count(*) from public.profiles where id='" + u + "'"),
    "1",
  );
  record({
    case: "R2422-04 uncoordinated session prevents NOWAIT maintenance and rolls back",
    result: "PASS fail-closed",
    blocked,
  });
  // Late failure must rollback the fence transformations and every new object.
  const rbdb = db + "_rollback";
  await sql("create database " + rbdb, "postgres");
  await installBase(rbdb);
  const fail = await outcome(
    sql(migration.replace("commit;", "select 1/0;commit;"), rbdb),
  );
  assert(!fail.ok);
  assert.equal(
    await sql("select to_regclass('private.resource_quota') is null", rbdb),
    "t",
  );
  assert.equal(
    await sql(
      "select position('2423,31' in pg_get_functiondef('private.esports_write_limit()'::regprocedure))",
      rbdb,
    ),
    "0",
  );
  record({
    case: "Partial failure rolls back 031 objects and maintenance fence",
    result: "PASS",
    fail,
  });
}
record({
  case: "Environment",
  result: "COMPLETE",
  mode: baseline ? "audited2422" : "corrected2423",
  postgres: await sql("select version()"),
});
