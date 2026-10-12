-- Mission 24.1. Local engineering only: hosted application needs separate authorization.
-- Rolling limits preserve 030 semantics (120/one hour and 60/24 hours), not UTC buckets.
begin;
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
 insert into private.resource_quota(user_id,kind) values(new.user_id,k) on conflict do nothing;
 select consumed_at into times from private.resource_quota where user_id=new.user_id and kind=k for update;
 -- Wall clock AFTER waiting: a long-lived transaction cannot reuse its old now() window.
 at_time:=clock_timestamp();
 select coalesce(array_agg(t order by t),'{}'::timestamptz[]) into times from unnest(times) t where t>at_time-duration;
 if cardinality(times)>=cap then
 if k='academy' then raise exception 'Study limit reached';else raise exception 'Action limit';end if;
 end if;
 update private.resource_quota set consumed_at=array_append(times,at_time) where user_id=new.user_id and kind=k;
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
 perform 1 from public.profiles where id=auth.uid() for update;
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
 -- Acceptance must acquire/recheck the application before locking the scholarship.
 -- This also aligns with the existing admin offer/status application-first order.
 definition:=pg_get_functiondef('private.esports_development_action_internal(text,uuid,integer,jsonb)'::regprocedure);
 before_text:='if p_action in(''accept'',''decline'') then';
 if position(before_text in definition)=0 then raise exception 'Expected acceptance boundary missing';end if;
 execute replace(definition,before_text,before_text||'
 perform 1 from public.esports_applications application_row join private.esports_scholarships scholarship_row on scholarship_row.application_id=application_row.id
 where scholarship_row.id=p_id and application_row.user_id=auth.uid() for update of application_row;
 if not found then raise exception ''Offer unavailable'';end if;');
end;$$;
commit;
