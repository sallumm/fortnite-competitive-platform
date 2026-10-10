-- Voluntary private groups. No user directory, unsolicited messaging or access to personal records.
create table public.training_teams(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id) on delete cascade,title text not null check(length(btrim(title)) between 3 and 80),capacity int not null check(capacity between 2 and 8),created_at timestamptz not null default now());
create table public.training_team_members(team_id uuid not null references public.training_teams(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,alias text not null check(length(btrim(alias)) between 1 and 60),joined_at timestamptz not null default now(),primary key(team_id,user_id));
create table public.training_team_invites(id uuid primary key default gen_random_uuid(),team_id uuid not null references public.training_teams(id) on delete cascade,token_hash text not null unique,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '1 day',used_by uuid references public.profiles(id) on delete set null,revoked boolean not null default false);
create table public.training_team_sessions(id uuid primary key default gen_random_uuid(),team_id uuid not null references public.training_teams(id) on delete cascade,author_id uuid not null references public.profiles(id) on delete cascade,title text not null check(length(btrim(title)) between 3 and 160),objective text not null check(length(btrim(objective)) between 3 and 1000),starts_at timestamptz not null check(isfinite(starts_at)),duration_minutes int not null check(duration_minutes between 1 and 120),exercise_ids uuid[] not null check(cardinality(exercise_ids) between 1 and 30),meta_context_id text references public.meta_contexts(id),game_context jsonb,status text not null default 'planned' check(status in ('planned','cancelled')),created_at timestamptz not null default now());
create table public.training_team_participation(session_id uuid not null references public.training_team_sessions(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,status text not null check(status in ('accepted','declined','completed','interrupted')),notes text not null default '' check(length(notes)<=4000),updated_at timestamptz not null default now(),primary key(session_id,user_id));
create table public.training_team_resources(id uuid primary key default gen_random_uuid(),team_id uuid not null references public.training_teams(id) on delete cascade,author_id uuid not null references public.profiles(id) on delete cascade,kind text not null check(kind in ('goal','vod','note')),title text not null check(length(btrim(title)) between 3 and 160),body text not null check(length(body)<=4000),video_url text not null default '' check(length(video_url)<=500) check(video_url='' or video_url ~ '^https://(www\.)?(youtube\.com/|youtu\.be/|twitch\.tv/)'),video_authorized boolean not null default false,meta_context_id text references public.meta_contexts(id),game_context jsonb,created_at timestamptz not null default now(),check(video_url='' or (kind='vod' and video_authorized)));
create index training_team_sessions_start on public.training_team_sessions(team_id,starts_at);
create index training_team_member_user on public.training_team_members(user_id);
create function private.team_member(t uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.training_team_members where team_id=t and user_id=u and u=auth.uid()) $$;
revoke all on function private.team_member(uuid,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.team_member(uuid,uuid) to authenticated;
do $$declare t text;begin
 foreach t in array array['training_teams','training_team_members','training_team_invites','training_team_sessions','training_team_participation','training_team_resources'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end;$$;
create policy member_teams on public.training_teams for select to authenticated using(private.team_member(id,(select auth.uid())));
create policy member_roster on public.training_team_members for select to authenticated using(private.team_member(team_id,(select auth.uid())));
create policy owner_invites on public.training_team_invites for select to authenticated using(exists(select 1 from public.training_teams t where t.id=team_id and t.owner_id=(select auth.uid())));
create policy member_sessions on public.training_team_sessions for select to authenticated using(private.team_member(team_id,(select auth.uid())));
create policy member_participation on public.training_team_participation for select to authenticated using(exists(select 1 from public.training_team_sessions s where s.id=session_id and private.team_member(s.team_id,(select auth.uid()))));
create policy member_resources on public.training_team_resources for select to authenticated using(private.team_member(team_id,(select auth.uid())));
create function public.create_training_team(p_title text,p_capacity int,p_alias text) returns uuid language plpgsql security definer set search_path='' as $$declare id uuid;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;perform 1 from public.profiles where profiles.id=auth.uid() for update;
 if (select count(*) from public.training_teams where owner_id=auth.uid())>=5 then raise exception 'Team limit';end if;
 insert into public.training_teams(owner_id,title,capacity) values(auth.uid(),p_title,p_capacity) returning training_teams.id into id;
 insert into public.training_team_members(team_id,user_id,alias) values(id,auth.uid(),p_alias);return id;
end;$$;
create function public.invite_training_member(p_team uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare token text;inv uuid;begin
 perform 1 from public.training_teams where id=p_team and owner_id=auth.uid() for update;if not found then raise exception 'Permission denied';end if;
 if (select count(*) from public.training_team_invites where team_id=p_team and created_at>now()-interval '1 day')>=10 then raise exception 'Invite limit';end if;
 token:=gen_random_uuid()::text||gen_random_uuid()::text;
 insert into public.training_team_invites(team_id,token_hash) values(p_team,md5(token)) returning id into inv;
 return jsonb_build_object('id',inv,'token',token,'expires_at',now()+interval '1 day');
end;$$;
create function public.accept_training_invite(p_token text,p_alias text,p_confirmation text) returns uuid language plpgsql security definer set search_path='' as $$declare invite public.training_team_invites;t public.training_teams;begin
 if auth.uid() is null or p_confirmation is distinct from 'ACEITAR' or length(p_token)<>72 then raise exception 'Explicit acceptance required';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into invite from public.training_team_invites where token_hash=md5(p_token);if not found then raise exception 'Invalid invitation';end if;
 -- Lock team first for concurrent invites and capacity, then invite; same order as issuer/revocation.
 select * into t from public.training_teams where id=invite.team_id for update;
 select * into invite from public.training_team_invites where id=invite.id for update;
 if invite.revoked or invite.expires_at<=now() or invite.used_by is not null then raise exception 'Invitation expired or used';end if;
 if exists(select 1 from public.training_team_members where team_id=t.id and user_id=auth.uid()) then raise exception 'Already a member';end if;
 if (select count(*) from public.training_team_members where team_id=t.id)>=t.capacity or (select count(*) from public.training_team_members where user_id=auth.uid())>=10 then raise exception 'Team capacity limit';end if;
 insert into public.training_team_members(team_id,user_id,alias) values(t.id,auth.uid(),p_alias);
 update public.training_team_invites set used_by=auth.uid() where id=invite.id;return t.id;
end;$$;
create function public.revoke_training_invite(p_id uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$begin
 if p_confirmation is distinct from 'REVOGAR' then raise exception 'Explicit revocation required';end if;
 perform 1 from public.training_teams t join public.training_team_invites i on i.team_id=t.id where i.id=p_id and t.owner_id=auth.uid() for update of t;if not found then raise exception 'Permission denied';end if;
 update public.training_team_invites set revoked=true where id=p_id;
end;$$;
create function public.leave_training_team(p_team uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$begin
 if p_confirmation is distinct from 'SAIR' or not private.team_member(p_team,auth.uid()) then raise exception 'Explicit departure required';end if;
 perform 1 from public.training_teams where id=p_team for update;
 if exists(select 1 from public.training_teams where id=p_team and owner_id=auth.uid()) then raise exception 'Owner must close team';end if;
 delete from public.training_team_members where team_id=p_team and user_id=auth.uid();
 delete from public.training_team_participation p using public.training_team_sessions s where s.id=p.session_id and s.team_id=p_team and p.user_id=auth.uid();
 delete from public.training_team_resources where team_id=p_team and author_id=auth.uid();
end;$$;
create function public.close_training_team(p_team uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$begin
 if p_confirmation is distinct from 'EXCLUIR EQUIPE' then raise exception 'Explicit destructive confirmation required';end if;
 delete from public.training_teams where id=p_team and owner_id=auth.uid();if not found then raise exception 'Permission denied';end if;
end;$$;
create function public.schedule_training_team(p_team uuid,p_title text,p_objective text,p_starts timestamptz,p_minutes int,p_exercises uuid[],p_context text,p_confirmation text) returns uuid language plpgsql security definer set search_path='' as $$declare t public.training_teams;id uuid;snapshot jsonb;begin
 if p_confirmation is distinct from 'AGENDAR' or not private.team_member(p_team,auth.uid()) then raise exception 'Explicit scheduling confirmation required';end if;
 lock table public.scheduled_sessions,public.activity_series,public.calendar_exceptions in share row exclusive mode;
 select * into t from public.training_teams where training_teams.id=p_team for update;
 if p_starts<now() or p_starts>now()+interval '366 days' or (select count(*) from public.training_team_sessions where team_id=p_team and created_at>now()-interval '1 day')>=20 then raise exception 'Invalid time or schedule limit';end if;
 if p_minutes is null or p_minutes<cardinality(p_exercises) then raise exception 'Insufficient time for selected steps';end if;
 if p_exercises is null or cardinality(p_exercises) not between 1 and 30 or exists(select 1 from unnest(p_exercises)x where not exists(select 1 from public.exercises e where e.id=x and e.published and e.verified_at<=now() and e.research->>'review_status'='verified' and (e.research->>'review_due_at')::timestamptz>now())) then raise exception 'Unverified exercise';end if;
 snapshot:=private.game_context(p_context,'{}');
 if p_context is not null and exists(select 1 from public.exercises e join public.meta_modes m on m.id=snapshot->>'mode_id' where e.id=any(p_exercises) and e.mode not in ('both',case when m.construction then 'build' else 'zero' end)) then raise exception 'Incompatible exercise mode';end if;
 if exists(select 1 from public.training_team_sessions s where s.team_id=p_team and s.status='planned' and s.starts_at<p_starts+p_minutes*interval '1 minute' and s.starts_at+s.duration_minutes*interval '1 minute'>p_starts) then raise exception 'Team calendar conflict';end if;
 insert into public.training_team_sessions(team_id,author_id,title,objective,starts_at,duration_minutes,exercise_ids,meta_context_id,game_context) values(p_team,auth.uid(),p_title,p_objective,p_starts,p_minutes,p_exercises,p_context,snapshot) returning training_team_sessions.id into id;
 -- Invitation to a session is not attendance or a write to another member's private calendar.
 return id;
end;$$;
create function public.respond_training_session(p_session uuid,p_status text,p_notes text,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$declare s public.training_team_sessions;begin
 lock table public.scheduled_sessions,public.activity_series,public.calendar_exceptions in share row exclusive mode;
 select * into s from public.training_team_sessions where id=p_session for update;
 if not found or s.status='cancelled' or not private.team_member(s.team_id,auth.uid()) or p_confirmation is distinct from 'CONFIRMAR' then raise exception 'Permission or explicit confirmation required';end if;
 if p_status='accepted' then
  if exists(select 1 from private.evolution_agenda(auth.uid(),(s.starts_at at time zone 'UTC')::date-1,(s.starts_at at time zone 'UTC')::date+1) a where a.status<>'cancelled' and a.starts_at<s.starts_at+s.duration_minutes*interval '1 minute' and a.starts_at+a.duration_minutes*interval '1 minute'>s.starts_at) or exists(select 1 from public.training_team_sessions t join public.training_team_participation p on p.session_id=t.id where p.user_id=auth.uid() and p.status='accepted' and t.id<>s.id and t.status='planned' and t.starts_at<s.starts_at+s.duration_minutes*interval '1 minute' and t.starts_at+t.duration_minutes*interval '1 minute'>s.starts_at) then raise exception 'Personal calendar conflict; no private details disclosed';end if;
 elsif p_status in ('completed','interrupted') then
  if s.starts_at>now() or not exists(select 1 from public.training_team_participation where session_id=s.id and user_id=auth.uid() and status in ('accepted','completed','interrupted')) then raise exception 'Accept and start session before recording attendance';end if;
 elsif p_status<>'declined' then raise exception 'Invalid participation';end if;
 insert into public.training_team_participation values(s.id,auth.uid(),p_status,p_notes,now()) on conflict(session_id,user_id) do update set status=excluded.status,notes=excluded.notes,updated_at=now();
end;$$;
create function public.cancel_training_team_session(p_session uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$begin
 if p_confirmation is distinct from 'CANCELAR' then raise exception 'Explicit cancellation required';end if;
 update public.training_team_sessions s set status='cancelled' where s.id=p_session and private.team_member(s.team_id,auth.uid()) and (s.author_id=auth.uid() or exists(select 1 from public.training_teams t where t.id=s.team_id and t.owner_id=auth.uid()));if not found then raise exception 'Permission denied';end if;
end;$$;
create function public.save_training_team_resource(p_team uuid,p_kind text,p_title text,p_body text,p_video text,p_authorized boolean,p_context text,p_confirmation text) returns uuid language plpgsql security definer set search_path='' as $$declare id uuid;begin
 if not private.team_member(p_team,auth.uid()) or p_confirmation is distinct from 'COMPARTILHAR' then raise exception 'Explicit sharing permission required';end if;
 perform 1 from public.training_teams where training_teams.id=p_team for update;
 if (select count(*) from public.training_team_resources where team_id=p_team and author_id=auth.uid() and created_at>now()-interval '1 day')>=50 then raise exception 'Shared resource limit';end if;
 insert into public.training_team_resources(team_id,author_id,kind,title,body,video_url,video_authorized,meta_context_id,game_context) values(p_team,auth.uid(),p_kind,p_title,p_body,p_video,p_authorized,p_context,private.game_context(p_context,'{}')) returning training_team_resources.id into id;return id;
end;$$;
create function public.delete_training_team_resource(p_id uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$begin
 if p_confirmation is distinct from 'EXCLUIR' then raise exception 'Explicit deletion required';end if;
 delete from public.training_team_resources where id=p_id and author_id=auth.uid() and private.team_member(team_id,auth.uid());if not found then raise exception 'Permission denied';end if;
end;$$;
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_training_team','invite_training_member','accept_training_invite','revoke_training_invite','leave_training_team','close_training_team','schedule_training_team','respond_training_session','cancel_training_team_session','save_training_team_resource','delete_training_team_resource') loop
  execute format('revoke all on function %s from public,anon',f.signature);execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end;$$;


-- Reuse accepted shared participation in ALL existing Coach/planner/competition conflict checks.
create or replace function private.coach_agenda(p_user uuid,p_from date,p_to date) returns table(id text,title text,starts_at timestamptz,duration_minutes integer,status text,series_id uuid,occurrence_date date) language sql stable set search_path='' as $$
 select s.id::text,coalesce(s.title,p.title),s.starts_at,coalesce(s.duration_minutes,(select sum((x->>'minutes')::int)::int from jsonb_array_elements(p.steps) x),30),case when exists(select 1 from public.training_sessions ts where ts.user_id=p_user and ts.schedule_id=s.id and ts.status='completed') then 'done' else s.status end,null::uuid,null::date
 from public.scheduled_sessions s left join public.training_plans p on p.id=s.plan_id and p.user_id=p_user
 where s.user_id=p_user and s.starts_at>=(p_from-2)::timestamp at time zone 'UTC' and s.starts_at<(p_to+2)::timestamp at time zone 'UTC'
 union all
 select r.id::text||':'||d::date::text,coalesce(e.title,r.title),coalesce(e.starts_at,(d::date+r.local_time) at time zone r.timezone),coalesce(e.duration_minutes,r.duration_minutes),case when exists(select 1 from public.training_sessions ts where ts.user_id=p_user and ts.series_id=r.id and ts.occurrence_date=d::date and ts.status='completed') then 'done' else coalesce(e.status,'planned') end,r.id,d::date
 from public.activity_series r cross join lateral generate_series(greatest(r.start_date,p_from-2)::timestamp,least(coalesce(r.end_date,p_to+2),p_to+2)::timestamp,interval '1 day') d
 left join public.calendar_exceptions e on e.series_id=r.id and e.occurrence_date=d::date
 where r.user_id=p_user and extract(dow from d)::int=any(r.weekdays)
 union all
 select r.id::text||':'||e.occurrence_date::text,coalesce(e.title,r.title),e.starts_at,coalesce(e.duration_minutes,r.duration_minutes),case when exists(select 1 from public.training_sessions ts where ts.user_id=p_user and ts.series_id=r.id and ts.occurrence_date=e.occurrence_date and ts.status='completed') then 'done' else e.status end,r.id,e.occurrence_date
 from public.calendar_exceptions e join public.activity_series r on r.id=e.series_id and r.user_id=p_user
 where e.starts_at>=p_from::timestamp at time zone 'UTC' and e.starts_at<(p_to+2)::timestamp at time zone 'UTC' and (e.occurrence_date<p_from-2 or e.occurrence_date>p_to+2)

 union all
 select 'team:'||s.id::text,s.title,s.starts_at,s.duration_minutes,'planned',null::uuid,null::date from public.training_team_sessions s join public.training_team_participation p on p.session_id=s.id join public.training_team_members m on m.team_id=s.team_id and m.user_id=p.user_id where p.user_id=p_user and p.status='accepted' and s.status='planned' and s.starts_at>=(p_from-2)::timestamp at time zone 'UTC' and s.starts_at<(p_to+2)::timestamp at time zone 'UTC'
$$;
