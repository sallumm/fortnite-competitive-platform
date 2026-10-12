-- Mission 24.1. Local engineering only: hosted application needs separate authorization.
-- Rolling limits preserve 030 semantics (120/one hour and 60/24 hours), not UTC buckets.
begin;
-- A242-01: drain earlier writers, then exclude INSERT/UPDATE/DELETE until COMMIT.
-- Reads remain available. Abort instead of waiting indefinitely on a busy service.
set local lock_timeout='5s';
lock table public.academy_records,public.coach_actions in share row exclusive mode;
-- Exact 030 source contracts: abort transaction on any unexpected catalog drift.
do $contract$ declare item text[]; begin
 foreach item slice 1 in array array[
 array['public.esports_start_exam(uuid,uuid,boolean)','60c62f6db4baa157f1f639bf08ea70bb'],
 array['public.esports_submit(uuid,jsonb,uuid)','19c14a28b3414de8cfda6bfa40116178'],
 array['public.esports_expire_assessments()','83a778d1ae377c8b9afc6b8d0e7a2148'],
 array['private.esports_write_limit()','3143ebdf0206930ad62586b068054275'],
 array['public.esports_admin_action(text,uuid,integer,jsonb)','87844b9edbd219fbcbe9bd120c26f8da'],
 array['public.esports_answer_exam(uuid,text,integer,jsonb)','561c3c4d0d2313a2f787464df01e17dc'],
 array['public.esports_development_action(text,uuid,integer,jsonb)','26bc3455776205b473f534f0515f0f8c'],
 array['public.esports_purge(uuid,text)','14f90d00c39afc133ef1b1f6085ae975'],
 array['public.esports_request_erasure()','f33d6fb9f96a0de56649dad528920426'],
 array['public.esports_withdraw(uuid)','24e995b61a03f9d9c2b2a8a8e9279691'],
 array['private.esports_admin_action_internal(text,uuid,integer,jsonb)','b84c75103d4f6c84d1ffe1dbc6a35964'],
 array['private.esports_assessment_action_internal(text,uuid,integer,jsonb)','1cb5c16ac8c0b32c0af8a5ff60f28a50'],
 array['private.esports_development_action_internal(text,uuid,integer,jsonb)','295bc1eb73e33f647138e92b7c724a08'],
 array['public.publish_meta_draft(uuid,integer,boolean)','7393b9ad568db3e79647ce40f9e4af40'],
 array['public.save_meta_draft(jsonb,text,uuid,integer)','7839f87db7fa856eaa1655f493628c0b']
 ] loop
 if not exists(select 1 from pg_proc where oid=item[1]::regprocedure and
 md5(prosrc)=item[2] and prosecdef and proconfig=array['search_path=""'] and
 pg_get_userbyid(proowner)='postgres') then
 raise exception 'Unexpected 030 source contract: %',item[1];end if;
 end loop;
end;$contract$;
create table private.resource_quota (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('academy','coach_proposal')),
 consumed_at timestamptz[] not null default '{}',
 primary key(user_id,kind),
 check(cardinality(consumed_at)<=case kind when 'academy' then 120 else 60 end)
);
alter table private.resource_quota enable row level security;
revoke all on private.resource_quota from public,anon,authenticated;
comment on table private.resource_quota is 'Private bounded rolling resource counters; no content or payload. Survive history cleanup; auth-user erasure cascades. Expired timestamps pruned on next use or privileged maintenance.';
-- Seed only observable consumption. Deleted historical activity cannot be reconstructed.
insert into private.resource_quota(user_id,kind,consumed_at)
 select user_id,'academy',array_agg(created_at order by created_at)
 from (select user_id,created_at,row_number() over(partition by user_id order by created_at desc) n
 from public.academy_records where created_at>clock_timestamp()-interval '1 hour') r where n<=120 group by user_id;
insert into private.resource_quota(user_id,kind,consumed_at)
 select user_id,'coach_proposal',array_agg(created_at order by created_at)
 from (select user_id,created_at,row_number() over(partition by user_id order by created_at desc) n
 from public.coach_actions where created_at>clock_timestamp()-interval '1 day') r where n<=60 group by user_id;
-- At the shared INSERT boundary, so learning journeys cannot escape the Academy limit.
-- AFTER INSERT: all validation succeeds first; any later failure rolls the reservation back.
create function private.resource_quota_insert() returns trigger language plpgsql security definer set search_path='' as $$
 declare k text;duration interval;cap integer;times timestamptz[];at_time timestamptz;
 begin
 if new.user_id is distinct from auth.uid() or auth.uid() is null then raise exception 'Authentication required';end if;
 if tg_table_schema='public' and tg_table_name='academy_records' then k:='academy';duration:=interval '1 hour';cap:=120;
 elsif tg_table_schema='public' and tg_table_name='coach_actions' then k:='coach_proposal';duration:=interval '1 day';cap:=60;
 else raise exception 'Invalid quota boundary';end if;
 -- A242-02: UPSERT owns the row lock until transaction end, including prune races.
 insert into private.resource_quota as quota(user_id,kind) values(new.user_id,k)
 on conflict(user_id,kind) do update set consumed_at=quota.consumed_at
 returning consumed_at into times;
 if not found or times is null then raise exception 'Quota reservation unavailable';end if;
 -- Wall clock AFTER waiting: a long-lived transaction cannot reuse its old now() window.
 at_time:=clock_timestamp();
 select coalesce(array_agg(t order by t),'{}'::timestamptz[]) into times from unnest(times) t where t>at_time-duration;
 if cardinality(times)>=cap then
 if k='academy' then raise exception 'Study limit reached';else raise exception 'Action limit';end if;
 end if;
 update private.resource_quota set consumed_at=array_append(times,at_time) where user_id=new.user_id and kind=k;
 if not found then raise exception 'Quota accounting unavailable';end if;
 return new;
 end;$$;
revoke all on function private.resource_quota_insert() from public,anon,authenticated;
create trigger academy_resource_quota after insert on public.academy_records for each row execute function private.resource_quota_insert();
create trigger coach_proposal_resource_quota after insert on public.coach_actions for each row execute function private.resource_quota_insert();
-- Bounded two rows/user. Privileged maintenance is deliberately not scheduled remotely.
-- Call this from an approved operator job if strict physical expiration is required.
create function private.prune_resource_quota() returns integer language plpgsql security definer set search_path='' as $$
 declare n integer;
 begin
 delete from private.resource_quota q where not exists(select 1 from unnest(q.consumed_at) t where t>clock_timestamp()-case q.kind when 'academy' then interval '1 hour' else interval '1 day' end);
 get diagnostics n=row_count;return n;
 end;$$;
revoke all on function private.prune_resource_quota() from public,anon,authenticated;

create or replace function public.esports_withdraw(p_application uuid) returns void language plpgsql security definer set search_path='' as $$
 declare a public.esports_applications;
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 -- Match development_action's actor profile lock before application/scholarship locks.
 perform 1 from public.profiles where id=auth.uid() for no key update;
 select * into a from public.esports_applications where id=p_application and user_id=auth.uid() for update;
 if not found then raise exception 'Application unavailable';end if;
 update private.esports_scholarships set status='revoked',version=version+1 where application_id=a.id and status in ('offered','accepted');
 update private.esports_role_grants set revoked_at=now() where application_id=a.id and revoked_at is null;
 update private.esports_benefit_grants set revoked_at=now() where scholarship_id in(select id from private.esports_scholarships where application_id=a.id) and revoked_at is null;
 if a.status='withdrawn' then return;end if;
 update public.esports_applications set status='withdrawn',version=version+1,updated_at=now() where id=a.id;
 insert into public.esports_status_events(application_id,status,message) values(a.id,'withdrawn','Participação retirada pelo candidato.');
 perform private.esports_audit('withdrawn',a.id);
 end;$$;
-- A repeated withdrawal produces no event or audit. No rate cap may prevent consent withdrawal.
-- Existing EXECUTE ACLs are preserved by CREATE OR REPLACE.

-- Harden only the proven expected-version/confirmation expressions; assert the source
-- contract, like migration 029. This preserves complete bodies, ACLs and internal AAL2 gates.
do $$declare signature text;definition text;before_text text;begin
 foreach signature in array array[
 'public.save_meta_draft(jsonb,text,uuid,integer)',
 'public.publish_meta_draft(uuid,integer,boolean)',
 'private.esports_admin_action_internal(text,uuid,integer,jsonb)',
 'public.esports_answer_exam(uuid,text,integer,jsonb)',
 'private.esports_assessment_action_internal(text,uuid,integer,jsonb)',
 'private.esports_development_action_internal(text,uuid,integer,jsonb)'
 ] loop
 definition:=pg_get_functiondef(signature::regprocedure);before_text:=definition;
 definition:=regexp_replace(definition,'([a-z]+[.]version)<>p_expected','\1 is distinct from p_expected','g');
 if definition=before_text then raise exception 'Expected version boundary missing: %',signature;end if;
 execute definition;
 end loop;
 definition:=pg_get_functiondef('public.esports_purge(uuid,text)'::regprocedure);
 if position('p_confirmation<>''EXCLUIR DADOS ESPORTS''' in definition)=0 then raise exception 'Expected purge confirmation missing';end if;
 execute replace(definition,'p_confirmation<>''EXCLUIR DADOS ESPORTS''','p_confirmation is distinct from ''EXCLUIR DADOS ESPORTS''');
 -- A242-03: every development writer locks application before scholarship/goal.
 definition:=pg_get_functiondef('private.esports_development_action_internal(text,uuid,integer,jsonb)'::regprocedure);
 before_text:='if p_action in(''accept'',''decline'') then';
 if position(before_text in definition)=0 then raise exception 'Expected acceptance boundary missing';end if;
 definition:=replace(definition,before_text,before_text||'
 perform 1 from public.esports_applications application_row join private.esports_scholarships scholarship_row on scholarship_row.application_id=application_row.id
 where scholarship_row.id=p_id and application_row.user_id=auth.uid() for update of application_row;
 if not found then raise exception ''Offer unavailable'';end if;');
 before_text:='elsif p_action in(''revoke'',''end'',''extend'') then';
 if position(before_text in definition)=0 then raise exception 'Expected administration boundary missing';end if;
 definition:=replace(definition,before_text,before_text||'
 perform 1 from public.esports_applications application_row join private.esports_scholarships scholarship_row on scholarship_row.application_id=application_row.id
 where scholarship_row.id=p_id for update of application_row;
 if not found then raise exception ''Scholarship unavailable'';end if;');
 before_text:='if p_action in(''goal'',''review'') then';
 if position(before_text in definition)=0 then raise exception 'Expected review boundary missing';end if;
 definition:=replace(definition,before_text,before_text||'
 perform 1 from public.esports_applications application_row join private.esports_scholarships scholarship_row on scholarship_row.application_id=application_row.id
 where scholarship_row.id=(p_payload->>''scholarship_id'')::uuid for update of application_row;');
 before_text:='elsif p_action=''progress'' then';
 if position(before_text in definition)=0 then raise exception 'Expected progress boundary missing';end if;
 definition:=replace(definition,before_text,before_text||'
 perform 1 from public.esports_applications application_row join private.esports_scholarships scholarship_row on scholarship_row.application_id=application_row.id
 join private.esports_development_goals goal_row on goal_row.scholarship_id=scholarship_row.id
 where goal_row.id=p_id and application_row.user_id=auth.uid() for update of application_row;');
 -- Do not append a misleading trial_completed event when no application transitioned.
 definition:=replace(definition,'insert into public.esports_status_events(application_id,status,message) values(s.application_id,''trial_completed'',''Bolsa encerrada ou revogada. Assinaturas pessoais não são alteradas.'');end if;',
 'if found then insert into public.esports_status_events(application_id,status,message) values(s.application_id,''trial_completed'',''Bolsa encerrada ou revogada. Assinaturas pessoais não são alteradas.'');end if;end if;');
 execute definition;
 -- Trial-role grants must recheck participation after the same application lock.
 definition:=pg_get_functiondef('private.esports_admin_action_internal(text,uuid,integer,jsonb)'::regprocedure);
 before_text:='elsif p_action=''grant_role'' then';
 if position(before_text in definition)=0 then raise exception 'Expected role grant boundary missing';end if;
 execute replace(definition,before_text,before_text||'
 if p_payload->>''role''=''trialist'' then
 perform 1 from public.esports_applications where id=p_id and user_id=(p_payload->>''user_id'')::uuid for update;
 if not found then raise exception ''Application unavailable'';end if;
 end if;');
 -- Purge must lock applications before deleting their audit/child rows.
 definition:=pg_get_functiondef('public.esports_purge(uuid,text)'::regprocedure);
 execute replace(definition,'-- Audit targets associated',
 'perform 1 from public.esports_applications where id=any(ids) order by id for update;
 -- Audit targets associated');
 -- Authorization revocation also touches multiple applications: lock in UUID order.
 definition:=pg_get_functiondef('public.esports_admin_action(text,uuid,integer,jsonb)'::regprocedure);
 execute replace(definition,'result:=private.esports_admin_action_internal',
 'if p_action=''revoke_authorization'' then
 perform 1 from public.esports_applications where cycle_id=p_id and user_id=(p_payload->>''user_id'')::uuid and payload->>''age_band''=''adolescent'' order by id for update;
 end if;
 result:=private.esports_admin_action_internal');
 -- Actor serialization does not change profile keys. Permit FK KEY SHARE from grants.
 -- FOR UPDATE would invert profile/app locks when an administrator inserts a grant.
 definition:=pg_get_functiondef('private.esports_write_limit()'::regprocedure);
 execute replace(definition,'perform 1 from public.profiles where id=auth.uid() for update;',
 'perform 1 from public.profiles where id=auth.uid() for no key update;');
end;$$;

-- Same owner actor lock; all applications in UUID order precede children and request.
-- Pending erasure never leaves an active scholarship status or live grants behind.
create or replace function public.esports_request_erasure() returns void language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform 1 from public.profiles where id=auth.uid() for no key update;
 perform 1 from public.esports_applications where user_id=auth.uid() order by id for update;
 update public.esports_applications set status='withdrawn',version=version+1,updated_at=now() where user_id=auth.uid() and status<>'withdrawn';
 update private.esports_scholarships set status='revoked',version=version+1 where user_id=auth.uid() and status in('offered','accepted');
 update private.esports_role_grants set revoked_at=now() where user_id=auth.uid() and revoked_at is null;
 update private.esports_benefit_grants set revoked_at=now() where user_id=auth.uid() and revoked_at is null;
 insert into private.esports_erasure_requests(user_id) values(auth.uid()) on conflict(user_id) do update set status='requested',requested_at=now(),handled_at=null,handled_by=null;
 perform private.esports_audit('erasure_requested',auth.uid());end;$$;

-- A2422-01: all supported esports writers enter a shared maintenance fence FIRST.
-- Purge/physical maintenance take its exclusive form before rows/FKs. Reserved key.
-- This is not permission to perform uncoordinated privileged SQL or hosted deletion.
do $fence$ declare signature text;definition text;begin
 foreach signature in array array[
 'private.esports_write_limit()',
 'public.esports_withdraw(uuid)',
 'public.esports_request_erasure()',
 'public.esports_start_exam(uuid,uuid,boolean)',
 'public.esports_answer_exam(uuid,text,integer,jsonb)',
 'public.esports_submit(uuid,jsonb,uuid)',
 'public.esports_expire_assessments()'
 ] loop
 definition:=pg_get_functiondef(signature::regprocedure);
 if position('begin' in definition)=0 then raise exception 'Missing writer entry: %',signature;end if;
 -- Fixed signatures and exact pre-upgrade contracts above. Insert once, at first BEGIN.
 definition:=regexp_replace(definition,'begin','begin perform pg_catalog.pg_advisory_xact_lock_shared(2423,31);');
 execute definition;
 end loop;
end;$fence$;

create or replace function public.esports_purge(p_user uuid default null,p_confirmation text default '') returns integer language plpgsql security definer set search_path='' as $$
 declare ids uuid[];cnt integer;
 begin
 if not public.esports_is_admin() or p_confirmation is distinct from 'EXCLUIR DADOS ESPORTS' then raise exception 'Administrator and explicit confirmation required';end if;
 -- New snapshots after lock waits are required. Stronger isolation must not reuse old eligibility.
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Purge requires READ COMMITTED';end if;
 if exists(select 1 from pg_catalog.pg_locks where pid=pg_catalog.pg_backend_pid() and locktype='advisory' and classid=2423 and objid=31 and objsubid=2 and mode='ShareLock' and granted) then raise exception 'Purge requires a fresh transaction without prior esports writes';end if;
 perform pg_catalog.pg_advisory_xact_lock(2423,31);
 -- Recheck the responsible actor AFTER waiting; privilege may have been revoked.
 if not public.esports_is_admin() then raise exception 'Administrator required after maintenance wait';end if;
 -- Supported writers, including cycle/authorization/grant mutations, are now drained.
 -- All candidate rows are locked in UUID order BEFORE any destructive eligibility decision.
 perform 1 from public.esports_applications where p_user is null or user_id=p_user order by id for update;
 if p_user is not null then
  perform 1 from private.esports_erasure_requests where user_id=p_user and status='requested' for update;
  if not found then raise exception 'Erasure request required';end if;
 end if;
 select coalesce(array_agg(a.id),'{}') into ids from public.esports_applications a join public.esports_cycles c on c.id=a.cycle_id
 where (p_user is not null and a.user_id=p_user) or
 (p_user is null and not exists(select 1 from private.esports_role_grants r where r.application_id=a.id and r.role<>'applicant' and r.revoked_at is null and r.ends_at>now())
 and not exists(select 1 from private.esports_scholarships ss where ss.application_id=a.id and ss.status in('offered','accepted') and ss.ends_at>now())
 and now()>greatest(c.ends_at,a.updated_at)+make_interval(days=>coalesce((a.consent_snapshot->>'retention_days')::integer,c.retention_days)));
 -- Explicit erasure intentionally removes own esports records even with a live grant.
 -- Bulk retention intentionally preserves current scholarships/grants/recent activity.
 delete from private.esports_audit where target_id=any(ids) or target_id in(select id from private.esports_attempts where application_id=any(ids)) or target_id in(select id from private.esports_scholarships where application_id=any(ids));
 delete from private.esports_authorizations where (p_user is not null and user_id=p_user) or (revoked_at is not null and expires_at<now()-interval '30 days');
 delete from public.esports_applications where id=any(ids);get diagnostics cnt=row_count;
 if p_user is not null then
  delete from private.esports_role_grants where user_id=p_user;
  delete from private.esports_audit where actor_id=p_user or target_id=p_user or detail->>'user_id'=p_user::text;
  update private.esports_erasure_requests set status='handled',handled_at=now(),handled_by=auth.uid() where user_id=p_user;
 end if;
 perform private.esports_audit('retention_purge',null,jsonb_build_object('records',cnt));return cnt;
 end;$$;

commit;
