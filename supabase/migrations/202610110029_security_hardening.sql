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
commit;
