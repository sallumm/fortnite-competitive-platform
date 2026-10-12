import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// No database URL, hosted connection, credentials or network. Only this disposable container.
const container = 'kyrven-m24-1-pg';
const baseline = process.argv.includes('--baseline');
const database = `mission24_${baseline ? 'baseline' : 'patched'}_${Date.now()}`;
const evidence = [];
function sql(query, db = database) {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db], { windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', x => out += x); p.stderr.on('data', x => err += x);
    p.on('error', reject);
    p.on('close', code => code ? reject(new Error(err.trim())) : resolve(out.trim()));
    p.stdin.end(query);
  });
}
const user = '24100000-0000-4000-8000-000000000001';
const other = '24100000-0000-4000-8000-000000000002';
const admin = '24100000-0000-4000-8000-000000000003';
const app = '24100000-0000-4000-8000-000000000010';
const scholarship = '24100000-0000-4000-8000-000000000011';
const cycle = '24100000-0000-4000-8000-000000000012';
let lesson;
const as = (query, id = user, aal = 'aal1', role = 'authenticated') => sql(`begin;set local role ${role};set local "request.jwt.claim.sub"='${id}';set local "request.jwt.claims"='{"aal":"${aal}"}';${query};commit;`);
const propose = `select public.coach_propose(jsonb_build_object('kind','create','items',jsonb_build_array(jsonb_build_object('title','Synthetic rest','kind','rest','duration_minutes',10,'starts_at',now()+interval '2 days'))))`;
async function denied(query, pattern, id = user, aal = 'aal1', role = 'authenticated') {
  await assert.rejects(as(query, id, aal, role), pattern);
}
async function fixture() {
  await sql(`delete from public.esports_applications where id='${app}';
    insert into public.esports_applications(id,user_id,cycle_id,status,payload,consent_snapshot) values('${app}','${user}','${cycle}','development_offered','{"age_band":"adult"}','{}');
    insert into private.esports_scholarships(id,application_id,user_id,title,terms,benefits,starts_at,ends_at) values('${scholarship}','${app}','${user}','Synthetic offer','Synthetic terms for local testing only','["materials"]',now()-interval '1 hour',now()+interval '1 day');`);
}
async function race(action) {
  await fixture();
  // Local-only instrumentation: pause AFTER participation/version checks, at the actual acceptance UPDATE.
  await sql(`create or replace function public.m24_pause() returns trigger language plpgsql as $$begin if new.status='accepted' and old.status='offered' then perform pg_sleep(2);end if;return new;end;$$;
    create trigger m24_pause before update on private.esports_scholarships for each row execute function public.m24_pause();`);
  const accepting = as(`set local application_name='m24_accept';select public.esports_development_action('accept','${scholarship}',1,'{"accepted":true}')`);
  let observed = false;
  for (let i = 0; i < 100; i++) {
    if (await sql("select exists(select 1 from pg_stat_activity where application_name='m24_accept' and wait_event='PgSleep')") === 't') { observed = true; break; }
    await new Promise(r => setTimeout(r, 20));
  }
  assert(observed, 'Acceptance must reach the instrumented interleaving');
  const withdrawing = as(action === 'withdraw' ? `select public.esports_withdraw('${app}')` : 'select public.esports_request_erasure()');
  await Promise.all([accepting, withdrawing]);
  const final = JSON.parse(await sql(`select json_build_object('status',(select status from public.esports_applications where id='${app}'),'live_roles',(select count(*) from private.esports_role_grants where application_id='${app}' and revoked_at is null),'live_benefits',(select count(*) from private.esports_benefit_grants where scholarship_id='${scholarship}' and revoked_at is null))`));
  const reproduced = baseline && action === 'withdraw';
  assert.equal(final.status, reproduced ? 'development_active' : 'withdrawn');
  assert.equal(final.live_roles, reproduced ? 1 : 0);
  assert.equal(final.live_benefits, reproduced ? 1 : 0);
  evidence.push({ scenario: `accept/${action}`, instrumentation: 'BEFORE scholarship UPDATE pg_sleep; two independent psql mutation sessions; actual pg_stat_activity barrier', final });
  console.log(JSON.stringify(evidence.at(-1)));
  await sql('drop trigger m24_pause on private.esports_scholarships;drop function public.m24_pause()');
}
await sql(`create database ${database}`, 'postgres');
await sql("create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
for (const f of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
  if (baseline && !/2026101[01]00/.test(f)) continue;
  await sql(readFileSync('supabase/migrations/' + f, 'utf8'));
}
await sql(`insert into auth.users values('${user}'),('${other}'),('${admin}');insert into public.profiles(id,display_name,mode,level,objective,minutes,input) select id,'Synthetic','build','beginner','aim',30,'kbm' from auth.users;insert into private.user_roles values('${admin}','admin');
insert into public.esports_cycles(id,title,mode,format,criteria,rules,privacy_notice,policy_version,retention_days,starts_at,ends_at) values('${cycle}','Synthetic','both','solo','Synthetic criteria','Synthetic local rules','Synthetic privacy notice','v1',30,now()-interval '1 day',now()+interval '1 day');`);
lesson = await sql("select id from public.articles where kind='lesson' and curriculum is not null and published and published_at<=now() order by id limit 1");
assert(lesson);
await as(`do $$begin for i in 1..120 loop perform public.record_academy_study('${lesson}','started');end loop;end;$$`);
await denied(`select public.record_academy_study('${lesson}','started')`, /Study limit/);
await as('select public.clear_academy_study()');
if (baseline) await as(`select public.record_academy_study('${lesson}','started')`);
else await denied(`select public.record_academy_study('${lesson}','started')`, /Study limit/);
evidence.push({ scenario: 'RPC-02: 121 after cleanup', result: baseline ? 'bypass reproduced' : 'denied' });
await as(`do $$begin for i in 1..60 loop perform public.coach_propose(jsonb_build_object('kind','create','items',jsonb_build_array(jsonb_build_object('title','Synthetic rest','kind','rest','duration_minutes',10,'starts_at',now()+interval '2 days'))));end loop;end;$$`);
await denied(propose, /Action limit/);
await as('delete from public.coach_actions');
if (baseline) await as(propose); else await denied(propose, /Action limit/);
evidence.push({ scenario: 'RPC-03: 61 after DELETE', result: baseline ? 'bypass reproduced' : 'denied' });
await fixture();
await as(`select public.esports_withdraw('${app}');select public.esports_withdraw('${app}')`);
assert.equal(await sql(`select count(*) from public.esports_status_events where application_id='${app}'`), baseline ? '2' : '1');
await denied(`select public.esports_withdraw('${app}')`, /Application unavailable/, other);
evidence.push({ scenario: 'RPC-01 repeat withdrawal', events: baseline ? 2 : 1, crossOwner: 'denied' });
await race('withdraw');await race('erasure');
if (baseline) {
  await as('select public.esports_purge(null,null)', admin, 'aal2');
  evidence.push({ scenario: 'purge NULL', result: 'confirmation bypass reproduced for existing admin+AAL2 only' });
} else {
  await denied('select public.esports_purge(null,null)', /explicit confirmation/, admin, 'aal2');
  await denied("select public.esports_purge(null,'EXCLUIR DADOS ESPORTS')", /Administrator/, admin, 'aal1');
  await as("select public.esports_purge(null,'EXCLUIR DADOS ESPORTS')", admin, 'aal2');
  evidence.push({ scenario: 'purge NULL/AAL1 rejected; valid AAL2 allowed', result: 'pass' });
}
mkdirSync('artifacts/mission24', { recursive: true });
writeFileSync(`artifacts/mission24/native-${baseline ? 'baseline' : 'patched'}.json`, JSON.stringify({ database, environment: await sql('select version()'), isolation: 'Docker --network none, no ports or host data volumes; minimal auth.uid fixture, no GoTrue/PostgREST or real JWT', evidence }, null, 2));
console.log(JSON.stringify(evidence, null, 2));
