-- Clutchfolio MVP: all timestamps UTC; ownership and editorial authorization in PostgreSQL.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.user_roles (user_id uuid primary key references auth.users(id) on delete cascade, role text not null check(role='admin'));
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from private.user_roles where user_id=auth.uid() and role='admin'); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(trim(display_name)) between 1 and 40),
 mode text not null check(mode in ('build','zero')), level text not null check(level in ('beginner','intermediate','advanced')),
 objective text not null check(objective in ('aim','mechanics','piece','competitive','decisions','vod','wellbeing')),
 minutes integer not null check(minutes in (30,45,60)), input text not null check(input in ('kbm','controller')),
 timezone text not null default 'America/Sao_Paulo', onboarded boolean not null default false, reminder_enabled boolean not null default true
);
create function private.validate_profile() returns trigger language plpgsql set search_path='' as $$ begin if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone'; end if; return new; end; $$;
create trigger profile_timezone before insert or update on public.profiles for each row execute function private.validate_profile();
create table public.exercises (
 id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title)) between 3 and 160),creator text not null check(length(creator) between 2 and 80),
 map_code text check(map_code ~ '^\d{4}-\d{4}-\d{4}$'), category text not null check(category in ('aim','mechanics','piece','competitive','decisions','vod','wellbeing')),
 mode text not null check(mode in ('build','zero','both')), level text not null check(level in ('beginner','intermediate','advanced')),
 description text not null check(length(description) between 10 and 500), instructions text not null check(length(instructions) between 20 and 10000),metric text not null check(length(metric) between 3 and 200),
 source_url text not null check(source_url ~ '^https://[^[:space:]]+$' and length(source_url)<2048),verified_at timestamptz not null check(verified_at<=now()+interval '5 minutes'), published boolean not null default false
);
create table public.articles (
 id uuid primary key default gen_random_uuid(),slug text unique not null check(slug ~ '^[a-z0-9-]{3,100}$'), title text not null check(length(trim(title)) between 3 and 160),
 kind text not null check(kind in ('news','analysis','lesson')),category text not null check(category in ('aim','mechanics','piece','competitive','decisions','vod','wellbeing','fncs')),
 summary text not null check(length(summary) between 10 and 500),body text not null check(length(body) between 30 and 30000),author text not null check(length(author) between 2 and 80),
 source_url text not null check(source_url ~ '^https://[^[:space:]]+$' and length(source_url)<2048),verified_at timestamptz not null check(verified_at<=now()+interval '5 minutes'),published_at timestamptz not null default now(),valid_until timestamptz,
 published boolean not null default false,check(kind<>'news' or valid_until is not null),check(valid_until is null or valid_until>=verified_at)
);
create table public.tournaments (
 id uuid primary key default gen_random_uuid(),slug text unique not null check(slug ~ '^[a-z0-9-]{3,100}$'),title text not null check(length(trim(title)) between 3 and 160),category text not null check(length(category) between 2 and 60),
 mode text not null check(mode in ('build','zero','both')),region text not null check(length(region) between 2 and 10),format text not null check(length(format) between 2 and 30),
 start_date date not null,end_date date not null,starts_at timestamptz,ends_at timestamptz,status text not null check(status in ('scheduled','finished','postponed','cancelled')),
 description text not null check(length(description) between 10 and 10000),rules text not null check(length(rules) between 10 and 10000),prize text not null check(length(prize) between 2 and 200),
 source_url text not null check(source_url ~ '^https://[^[:space:]]+$' and length(source_url)<2048),verified_at timestamptz not null check(verified_at<=now()+interval '5 minutes'),valid_until timestamptz not null, published boolean not null default false,
 check(end_date>=start_date),check((starts_at is null)=(ends_at is null)),check(starts_at is null or ends_at>starts_at),check(valid_until>=verified_at)
);
create table public.training_plans (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,title text not null check(length(trim(title)) between 1 and 80),steps jsonb not null,unique(id,user_id));
create function private.validate_steps() returns trigger language plpgsql security definer set search_path='' as $$
 declare step jsonb; total integer:=0; seen uuid[]:=array[]::uuid[]; ex uuid;
 begin
 if jsonb_typeof(new.steps)<>'array' or jsonb_array_length(new.steps) not between 1 and 20 then raise exception 'Invalid steps'; end if;
 for step in select value from jsonb_array_elements(new.steps) loop
 if jsonb_typeof(step->'exercise_id') is distinct from 'string' or jsonb_typeof(step->'minutes') is distinct from 'number' or (step->>'minutes') !~ '^[0-9]+$' then raise exception 'Invalid step'; end if;
 ex:=(step->>'exercise_id')::uuid;
 if not exists(select 1 from public.exercises where id=ex and published) or ex=any(seen) or (step->>'minutes')::integer not between 1 and 120 then raise exception 'Invalid exercise or duration'; end if;
 seen:=array_append(seen,ex);total:=total+(step->>'minutes')::integer;
 end loop;
 if total>240 then raise exception 'Plan exceeds four hours'; end if;return new;
 end; $$;
create trigger validate_training_plan before insert or update on public.training_plans for each row execute function private.validate_steps();
create table public.scheduled_sessions (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,plan_id uuid not null,starts_at timestamptz not null,tournament_id uuid references public.tournaments(id) on delete set null,foreign key(plan_id,user_id) references public.training_plans(id,user_id) on delete cascade);
create table public.training_sessions (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,plan_id uuid references public.training_plans(id) on delete set null,title text not null,steps jsonb not null,started_at timestamptz not null default now(),completed_at timestamptz,duration_seconds integer not null default 0 check(duration_seconds between 0 and 86400),results jsonb not null default '[]',status text not null default 'active' check(status in ('active','completed','abandoned')),xp integer not null default 0 check(xp in (0,100)),check((status='active')=(completed_at is null)));
create unique index one_active_session on public.training_sessions(user_id) where status='active';
create index sessions_user_started on public.training_sessions(user_id,started_at desc);
create index schedule_user_starts on public.scheduled_sessions(user_id,starts_at);
create table public.xp_transactions (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,session_id uuid not null unique references public.training_sessions(id) on delete cascade,amount integer not null check(amount=100),created_at timestamptz not null default now());
create index xp_user_created on public.xp_transactions(user_id,created_at);
create table public.personal_goals (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,title text not null check(length(trim(title)) between 1 and 100),target integer not null check(target between 1 and 1000),completed boolean not null default false);
create table public.bookmarks(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,kind text not null check(kind in ('exercise','tournament')),target_id uuid not null,unique(user_id,kind,target_id));
create table public.content_revision_history(id bigint generated always as identity primary key,table_name text not null,record_id uuid not null,actor_id uuid references auth.users(id) on delete set null,operation text not null,changed_at timestamptz not null default now(),before_data jsonb,after_data jsonb);
create function private.audit_editorial() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.content_revision_history(table_name,record_id,actor_id,operation,before_data,after_data) values(tg_table_name,coalesce(new.id,old.id),auth.uid(),tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end); return coalesce(new,old); end; $$;
create function public.start_training(p_plan uuid) returns public.training_sessions language plpgsql security definer set search_path='' as $$
 declare plan public.training_plans; session public.training_sessions; snapshot jsonb;
 begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into plan from public.training_plans where id=p_plan and user_id=auth.uid();
 if not found then raise exception 'Plan unavailable'; end if;
 if exists(select 1 from public.training_sessions where user_id=auth.uid() and status='active') then raise exception 'Active session exists'; end if;
 if (select count(*) from public.training_sessions where user_id=auth.uid() and started_at>=now()-interval '1 day')>=60 then raise exception 'Daily operation limit'; end if;
 select jsonb_agg(jsonb_build_object('exercise_id',e.id,'minutes',(step.value->>'minutes')::integer,'exercise',to_jsonb(e)) order by step.ordinality) into snapshot from jsonb_array_elements(plan.steps) with ordinality as step(value,ordinality) join public.exercises e on e.id=(step.value->>'exercise_id')::uuid;
 if jsonb_array_length(snapshot)<>jsonb_array_length(plan.steps) then raise exception 'Exercise unavailable'; end if;
 insert into public.training_sessions(user_id,plan_id,title,steps) values(auth.uid(),plan.id,plan.title,snapshot) returning * into session;return session;
 end; $$;
create function public.finish_training(p_session uuid,p_results jsonb,p_seconds integer,p_abandon boolean default false) returns public.training_sessions language plpgsql security definer set search_path='' as $$
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
revoke all on function public.start_training(uuid),public.finish_training(uuid,jsonb,integer,boolean) from public,anon;
grant execute on function public.start_training(uuid),public.finish_training(uuid,jsonb,integer,boolean) to authenticated;
-- Explicit grants and one ownership policy per operation. No private data for anon.
do $$ declare t text; begin
 foreach t in array array['profiles','training_plans','scheduled_sessions','personal_goals','bookmarks'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 if t='profiles' then
 execute format('create policy own_read on public.%I for select to authenticated using(id=(select auth.uid()))',t);
 execute format('create policy own_insert on public.%I for insert to authenticated with check(id=(select auth.uid()))',t);
 execute format('create policy own_update on public.%I for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()))',t);
 else
 execute format('create policy own_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 execute format('create policy own_insert on public.%I for insert to authenticated with check(user_id=(select auth.uid()))',t);
 execute format('create policy own_update on public.%I for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
 execute format('create policy own_delete on public.%I for delete to authenticated using(user_id=(select auth.uid()))',t);
 end if;
 end loop;
 -- Profile deletion only through authenticated server function, never direct database DELETE.
 revoke delete on public.profiles from authenticated;
 foreach t in array array['training_sessions','xp_transactions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy own_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 end loop;
 foreach t in array array['exercises','articles','tournaments'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to anon,authenticated',t);
 execute format('grant insert,update,delete on public.%I to authenticated',t);
 if t='articles' then execute 'create policy published_read on public.articles for select to anon,authenticated using((published and published_at<=now()) or (select public.is_admin()))';
 else execute format('create policy published_read on public.%I for select to anon,authenticated using(published or (select public.is_admin()))',t); end if;
 execute format('create policy admin_insert on public.%I for insert to authenticated with check((select public.is_admin()))',t);
 execute format('create policy admin_update on public.%I for update to authenticated using((select public.is_admin())) with check((select public.is_admin()))',t);
 execute format('create policy admin_delete on public.%I for delete to authenticated using((select public.is_admin()))',t);
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_editorial()',t);
 end loop;
 end; $$;
alter table public.content_revision_history enable row level security;
revoke all on public.content_revision_history from anon,authenticated;
grant select on public.content_revision_history to authenticated;
create policy admin_audit on public.content_revision_history for select to authenticated using((select public.is_admin()));
create index articles_publication on public.articles(published,published_at desc);
create index tournaments_region_date on public.tournaments(region,start_date);
