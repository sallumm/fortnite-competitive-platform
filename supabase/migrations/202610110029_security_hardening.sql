-- Incremental Prompt 20 hardening. Migrations 001–028 remain immutable.
begin;

-- PostgREST sets request.jwt.claims from its verified JWT, never user_metadata.
create function private.aal2() returns boolean language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'aal','aal1')='aal2'
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private.aal2() and exists(select 1 from private.user_roles where user_id=auth.uid() and role='admin')
$$;
create or replace function public.esports_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.aal2() and (public.is_admin() or private.esports_role('esports_admin'))
$$;
create function private.esports_staff_access() returns boolean language sql stable security definer set search_path='' as $$
 select private.aal2() and private.esports_role('esports_staff')
$$;
-- Replace only the current-actor staff authorization expression. The role lookup
-- for another user during reviewer assignment and non-staff roles stays unchanged.
do $$declare signature text; definition text; begin
 foreach signature in array array[
 'public.esports_can_review(uuid)', 'public.esports_workspace()',
 'public.esports_admin_data(text,integer)', 'private.esports_admin_action_internal(text,uuid,integer,jsonb)',
 'public.esports_assessment_admin()', 'private.esports_assessment_action_internal(text,uuid,integer,jsonb)',
 'public.esports_development(boolean)', 'private.esports_development_action_internal(text,uuid,integer,jsonb)'
 ] loop
 definition:=pg_get_functiondef(signature::regprocedure);
 if position('private.esports_role(''esports_staff'')' in definition)=0 then raise exception 'Expected staff boundary missing: %',signature;end if;
 execute replace(definition,'private.esports_role(''esports_staff'')','private.esports_staff_access()');
 end loop;
end;$$;
-- This reveals only the caller's requirement, never grants a privilege.
create function public.security_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('aal2',private.aal2(),'privileged',auth.uid() is not null and (
 exists(select 1 from private.user_roles where user_id=auth.uid()) or
 private.esports_role('esports_admin') or private.esports_role('esports_staff')))
$$;
revoke all on function public.security_status() from public,anon;
grant execute on function public.security_status() to authenticated;

-- Defense in depth: private records have no direct client policies/grants.
do $$declare t record;begin
 for t in select tablename from pg_tables where schemaname='private' loop
 execute format('alter table private.%I enable row level security',t.tablename);
 end loop;
end;$$;
revoke all on all tables in schema private from anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
-- Required by legitimate authenticated DML constraints and team RLS.
grant execute on function private.team_member(uuid,uuid),private.valid_weekdays(integer[]),
 private.valid_competitive_phases(jsonb),private.valid_competitive_checklist(jsonb),private.valid_skills(text[])
 to authenticated;
-- One bounded counter per user; committed before contacting CAPTCHA provider.
create table private.captcha_quota(user_id uuid primary key references auth.users(id) on delete cascade,window_at timestamptz not null default now(),requests integer not null default 0);
create table private.captcha_tickets(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,cycle_id uuid not null references public.esports_cycles(id) on delete cascade,expires_at timestamptz not null default now()+interval '2 minutes',unique(user_id,cycle_id));
alter table private.captcha_quota enable row level security;
alter table private.captcha_tickets enable row level security;
create function public.reserve_captcha_request() returns boolean language plpgsql security definer set search_path='' as $$
 declare allowed boolean;
 begin
 if auth.uid() is null then return false;end if;
 insert into private.captcha_quota(user_id,requests) values(auth.uid(),1)
 on conflict(user_id) do update set requests=case when captcha_quota.window_at<now()-interval '10 minutes' then 1 else captcha_quota.requests+1 end,
 window_at=case when captcha_quota.window_at<now()-interval '10 minutes' then now() else captcha_quota.window_at end
 returning requests<=10 into allowed;
 return allowed;
 end;$$;
create function public.issue_captcha_ticket(p_user uuid,p_cycle uuid) returns uuid language plpgsql security definer set search_path='' as $$
 declare ticket uuid;
 begin
 insert into private.captcha_tickets(user_id,cycle_id) values(p_user,p_cycle)
 on conflict(user_id,cycle_id) do update set id=gen_random_uuid(),expires_at=now()+interval '2 minutes'
 returning id into ticket;
 return ticket;
 end;$$;
alter function public.esports_submit(uuid,jsonb) set schema private;
alter function private.esports_submit(uuid,jsonb) rename to esports_submit_internal;
revoke all on function private.esports_submit_internal(uuid,jsonb) from public,anon,authenticated;
create function public.esports_submit(p_cycle uuid,p_payload jsonb,p_ticket uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
 begin
 delete from private.captcha_tickets where id=p_ticket and user_id=auth.uid() and cycle_id=p_cycle and expires_at>now();
 if not found then raise exception 'CAPTCHA required';end if;
 return private.esports_submit_internal(p_cycle,p_payload);
 end;$$;
revoke all on function public.issue_captcha_ticket(uuid,uuid),public.reserve_captcha_request(),public.esports_submit(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.reserve_captcha_request(),public.esports_submit(uuid,jsonb,uuid) to authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.issue_captcha_ticket(uuid,uuid) to service_role;end if;end;$$;
-- Versioned acknowledgement is not age assurance or a legal compliance claim.
create table public.account_acceptances (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 terms_version text not null,privacy_version text not null,accepted_at timestamptz not null default now(),
 unique(user_id,terms_version,privacy_version)
);
alter table public.account_acceptances enable row level security;
revoke all on public.account_acceptances from public,anon,authenticated;
grant select on public.account_acceptances to authenticated;
create policy own_acceptances on public.account_acceptances for select to authenticated using(user_id=auth.uid());
create function public.accept_account_documents(p_terms text,p_privacy text,p_accepted boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or p_accepted is distinct from true or p_terms is distinct from '2026-10-11-prelaunch' or p_privacy is distinct from '2026-10-11-prelaunch' then raise exception 'Explicit current acceptance required';end if;
 insert into public.account_acceptances(user_id,terms_version,privacy_version) values(auth.uid(),p_terms,p_privacy) on conflict(user_id,terms_version,privacy_version) do nothing;
end;$$;
revoke all on function public.accept_account_documents(text,text,boolean) from public,anon;
grant execute on function public.accept_account_documents(text,text,boolean) to authenticated;
create function private.require_account_acceptance() returns trigger language plpgsql set search_path='' as $$begin
 if current_user='authenticated' and new.onboarded and (tg_op='INSERT' or not old.onboarded) and not exists(select 1 from public.account_acceptances where user_id=auth.uid() and terms_version='2026-10-11-prelaunch' and privacy_version='2026-10-11-prelaunch') then raise exception 'Explicit current acceptance required';end if;
 return new;
end;$$;
revoke all on function private.require_account_acceptance() from public,anon,authenticated;
create trigger require_account_acceptance before insert or update on public.profiles for each row execute function private.require_account_acceptance();
commit;
