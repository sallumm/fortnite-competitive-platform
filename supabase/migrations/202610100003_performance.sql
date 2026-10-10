-- Incremental personal performance features. Existing plans, schedules and sessions stay intact.
alter table public.scheduled_sessions alter column plan_id drop not null;
alter table public.scheduled_sessions add column title text check(length(trim(title)) between 1 and 80);
alter table public.scheduled_sessions add column kind text not null default 'training' check(kind in ('training','personal','rest'));
alter table public.scheduled_sessions add column duration_minutes integer check(duration_minutes between 1 and 240);
alter table public.scheduled_sessions add column status text not null default 'planned' check(status in ('planned','cancelled','done'));
alter table public.scheduled_sessions add constraint activity_plan check((kind='training' and plan_id is not null) or (kind<>'training' and plan_id is null and title is not null));
alter table public.scheduled_sessions add constraint schedule_owner_unique unique(id,user_id);
alter table public.training_sessions add constraint training_owner_unique unique(id,user_id);
create function private.valid_weekdays(days integer[]) returns boolean language sql immutable set search_path='' as $$ select cardinality(days) between 1 and 7 and days <@ array[0,1,2,3,4,5,6] and cardinality(days)=(select count(distinct d) from unnest(days) d) and array_position(days,null) is null $$;
create table public.activity_series (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 80),kind text not null check(kind in ('training','personal','rest')),plan_id uuid,
 timezone text not null,local_time time not null check(local_time<'24:00:00'::time and extract(second from local_time)=0),start_date date not null,end_date date,weekdays integer[] not null check(private.valid_weekdays(weekdays)),
 duration_minutes integer not null check(duration_minutes between 1 and 240),tournament_id uuid references public.tournaments(id) on delete set null,
 unique(id,user_id),foreign key(plan_id,user_id) references public.training_plans(id,user_id) on delete cascade,
 check(end_date is null or end_date>=start_date),check((kind='training')=(plan_id is not null))
);
create trigger series_timezone before insert or update on public.activity_series for each row execute function private.validate_profile();
create table public.calendar_exceptions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,series_id uuid not null,
 occurrence_date date not null,starts_at timestamptz,duration_minutes integer check(duration_minutes between 1 and 240),title text check(length(trim(title)) between 1 and 80),status text not null default 'planned' check(status in ('planned','cancelled','done')),
 foreign key(series_id,user_id) references public.activity_series(id,user_id) on delete cascade,unique(series_id,occurrence_date)
);
create function private.validate_exception() returns trigger language plpgsql set search_path='' as $$ declare r public.activity_series;begin
 select * into r from public.activity_series where id=new.series_id and user_id=new.user_id;
 if not found or new.occurrence_date<r.start_date or (r.end_date is not null and new.occurrence_date>r.end_date) or not extract(dow from new.occurrence_date)::integer=any(r.weekdays) then raise exception 'Invalid occurrence';end if;
 return new;end;$$;
create trigger valid_exception before insert or update on public.calendar_exceptions for each row execute function private.validate_exception();
alter table public.training_sessions add column schedule_id uuid references public.scheduled_sessions(id) on delete set null;
alter table public.training_sessions add column series_id uuid references public.activity_series(id) on delete set null;
alter table public.training_sessions add column occurrence_date date;
create unique index one_scheduled_completion on public.training_sessions(schedule_id) where schedule_id is not null and status in ('active','completed');
create unique index one_occurrence_completion on public.training_sessions(series_id,occurrence_date) where series_id is not null and status in ('active','completed');
create table public.training_journals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,session_id uuid not null unique,
 practiced text not null default '' check(length(practiced)<=1000),improved text not null default '' check(length(improved)<=1000),difficult text not null default '' check(length(difficult)<=1000),next_focus text not null default '' check(length(next_focus)<=1000),
 difficulties text[] not null default '{}' check(cardinality(difficulties)<=11 and difficulties <@ array['tracking','accuracy','editing','piece','movement','rotations','endgame','decisions','box_fights','focus','time'] and array_position(difficulties,null) is null),
 foreign key(session_id,user_id) references public.training_sessions(id,user_id) on delete cascade
);
create table public.skill_reviews (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 skill text not null check(skill in ('aim','tracking','shotgun','building','editing','piece','movement','decisions','rotations','endgame','vod')),
 goal text not null default '' check(length(goal)<=300),note text not null default '' check(length(note)<=1000),assessment text not null check(assessment in ('unassessed','needs_practice','developing','comfortable')),created_at timestamptz not null default now() check(created_at<=now()+interval '5 minutes')
);
create table public.planning_preferences (
 id uuid primary key references public.profiles(id) on delete cascade,user_id uuid not null unique references public.profiles(id) on delete cascade,weekdays integer[] not null check(private.valid_weekdays(weekdays)),
 local_time time not null check(local_time<'24:00:00'::time and extract(second from local_time)=0),minutes integer not null check(minutes between 15 and 120),focuses text[] not null check(cardinality(focuses) between 1 and 7 and focuses <@ array['aim','mechanics','piece','competitive','decisions','vod','wellbeing']),check(id=user_id)
);
create table public.weekly_reports (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,week_start date not null check(extract(isodow from week_start)=1),timezone text not null,
 generated_at timestamptz not null default now() check(generated_at<=now()+interval '5 minutes'),summary jsonb not null check(jsonb_typeof(summary)='object' and pg_column_size(summary)<100000 and summary ?& array['from','to','completed','planned','observations','suggestions']),unique(user_id,week_start)
);
create trigger report_timezone before insert or update on public.weekly_reports for each row execute function private.validate_profile();
create function public.start_scheduled_training(p_plan uuid,p_schedule uuid default null,p_series uuid default null,p_date date default null) returns public.training_sessions language plpgsql security definer set search_path='' as $$
 declare r public.activity_series;a public.scheduled_sessions;e public.calendar_exceptions;s public.training_sessions;instant timestamptz;
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if (p_schedule is not null and p_series is not null) or (p_series is null and p_date is not null) then raise exception 'Invalid calendar reference';end if;
 if p_schedule is not null then
 select * into a from public.scheduled_sessions where id=p_schedule and user_id=auth.uid() for update;
 if not found or a.plan_id is distinct from p_plan or a.kind<>'training' or a.status<>'planned' then raise exception 'Schedule unavailable';end if;
 end if;
 if p_series is not null then
 select * into r from public.activity_series where id=p_series and user_id=auth.uid() for update;
 if not found or p_date is null or r.plan_id is distinct from p_plan or r.kind<>'training' or p_date<r.start_date or (r.end_date is not null and p_date>r.end_date) or not extract(dow from p_date)::integer=any(r.weekdays) then raise exception 'Occurrence unavailable';end if;
 select * into e from public.calendar_exceptions where series_id=r.id and occurrence_date=p_date;
 if found and e.status<>'planned' then raise exception 'Occurrence unavailable';end if;
 if e.starts_at is null then
 instant:=(p_date+r.local_time) at time zone r.timezone;
 if (instant at time zone r.timezone)<>(p_date+r.local_time) then raise exception 'Nonexistent wall time';end if;
 end if;
 end if;
 s:=public.start_training(p_plan);
 update public.training_sessions set schedule_id=p_schedule,series_id=p_series,occurrence_date=p_date where id=s.id returning * into s;
 return s;end;$$;
revoke all on function public.start_scheduled_training(uuid,uuid,uuid,date) from public,anon;
grant execute on function public.start_scheduled_training(uuid,uuid,uuid,date) to authenticated;
-- Series edits split at a date, preserving prior planned history and detached exceptions.
create function public.revise_series(p_id uuid,p_from date,p_replacement jsonb) returns public.activity_series language plpgsql security definer set search_path='' as $$
 declare old public.activity_series;new_row public.activity_series;
 begin
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into old from public.activity_series where id=p_id and user_id=auth.uid() for update;
 if not found or p_from<=old.start_date or (old.end_date is not null and p_from>old.end_date) then raise exception 'Invalid revision date';end if;
 if exists(select 1 from public.training_sessions where series_id=p_id and occurrence_date>=p_from and status in ('active','completed')) then raise exception 'Clutchfolio: existe um treino iniciado nesse intervalo. Edite apenas ocorrências pendentes.';end if;
 -- Future overrides require individual review rather than silently deleting explicit history.
 if exists(select 1 from public.calendar_exceptions where series_id=p_id and occurrence_date>=p_from) then raise exception 'Clutchfolio: há exceções futuras. Edite cada ocorrência ou remova as exceções antes de revisar a série.';end if;
 update public.activity_series set end_date=p_from-1 where id=p_id;
 new_row:=jsonb_populate_record(null::public.activity_series,p_replacement);
 new_row.user_id:=auth.uid();new_row.start_date:=p_from;
 insert into public.activity_series select (new_row).* returning * into new_row;return new_row;
 end;$$;
revoke all on function public.revise_series(uuid,date,jsonb) from public,anon;
grant execute on function public.revise_series(uuid,date,jsonb) to authenticated;
do $$ declare t text;begin
 foreach t in array array['activity_series','calendar_exceptions','training_journals','skill_reviews','planning_preferences','weekly_reports'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy own_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 execute format('create policy own_insert on public.%I for insert to authenticated with check(user_id=(select auth.uid()))',t);
 execute format('create policy own_update on public.%I for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
 execute format('create policy own_delete on public.%I for delete to authenticated using(user_id=(select auth.uid()))',t);
 execute format('create index on public.%I(user_id)',t);
 end loop;
 end;$$;
grant execute on function private.valid_weekdays(integer[]) to authenticated;
-- Constraint calls a pre-resolved function; no private schema/table access is granted.
create index reviews_user_date on public.skill_reviews(user_id,created_at desc);

-- Preserve completion/XP semantics while validating the optional comparability identifier.
create or replace function public.finish_training(p_session uuid,p_results jsonb,p_seconds integer,p_abandon boolean default false) returns public.training_sessions language plpgsql security definer set search_path='' as $$
 declare session public.training_sessions; r jsonb; n integer:=0; awarded integer:=0; day_start timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 -- Lock owner first: serialize XP cap across concurrent completions.
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into session from public.training_sessions where id=p_session and user_id=auth.uid() for update;
 if not found then raise exception 'Session unavailable'; end if;
 if session.status<>'active' then return session; end if;
 if p_seconds is null or p_seconds<0 or p_seconds>86400 or p_seconds>floor(extract(epoch from now()-session.started_at))+2 then raise exception 'Invalid active duration'; end if;
 if p_results is null or pg_column_size(p_results)>100000 or jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)<>jsonb_array_length(session.steps) then raise exception 'Invalid results'; end if;
 for r in select value from jsonb_array_elements(p_results) loop
 if (r->>'exercise_id') is distinct from (session.steps->n->>'exercise_id') or jsonb_typeof(r->'note') is distinct from 'string' or length(r->>'note')>1000 or not (r ? 'value') then raise exception 'Invalid result'; end if;
 if r ? 'configuration' and (jsonb_typeof(r->'configuration') is distinct from 'string' or length(r->>'configuration')>200) then raise exception 'Invalid configuration';end if;
 if r->'value'<>'null'::jsonb then
 if jsonb_typeof(r->'value')<>'number' or (r->>'value')::numeric<0 or (r->>'value')::numeric>1000000 then raise exception 'Invalid metric'; end if;
 end if;
 n:=n+1;
 end loop;
 if not p_abandon and (select coalesce(sum(amount),0) from public.xp_transactions where user_id=auth.uid() and created_at>=day_start)<200 then awarded:=100; end if;
 update public.training_sessions set status=case when p_abandon then 'abandoned' else 'completed' end,completed_at=now(),duration_seconds=p_seconds,results=p_results,xp=awarded where id=p_session returning * into session;
 if awarded>0 then insert into public.xp_transactions(user_id,session_id,amount) values(auth.uid(),session.id,awarded); end if;
 return session;
 end; $$;

create function private.validate_journal() returns trigger language plpgsql set search_path='' as $$ begin
 if not exists(select 1 from public.training_sessions where id=new.session_id and user_id=new.user_id and status<>'active') then raise exception 'Finish session before writing journal';end if;return new;end;$$;
create trigger journal_completed before insert or update on public.training_journals for each row execute function private.validate_journal();

-- Preserve explicit calendar history when rules are changed, including direct PostgREST writes.
create function private.protect_series_history() returns trigger language plpgsql set search_path='' as $$ begin
 if (new.title,new.kind,new.plan_id,new.timezone,new.local_time,new.start_date,new.weekdays,new.duration_minutes) is distinct from (old.title,old.kind,old.plan_id,old.timezone,old.local_time,old.start_date,old.weekdays,old.duration_minutes)
 and (exists(select 1 from public.training_sessions where series_id=old.id and status in ('active','completed')) or exists(select 1 from public.calendar_exceptions where series_id=old.id)) then raise exception 'Clutchfolio: preserve o histórico; revise a série a partir de uma ocorrência posterior.';end if;
 if new.end_date is not null and (exists(select 1 from public.training_sessions where series_id=old.id and occurrence_date>new.end_date and status in ('active','completed')) or exists(select 1 from public.calendar_exceptions where series_id=old.id and occurrence_date>new.end_date)) then raise exception 'Cannot truncate explicit history';end if;
 return new;end;$$;
create trigger preserve_series_history before update on public.activity_series for each row execute function private.protect_series_history();
