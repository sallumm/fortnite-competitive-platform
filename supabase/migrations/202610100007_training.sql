-- Incremental: existing plans and completed session snapshots remain valid.
alter table public.exercises add column categories text[] not null default '{}', add column tags text[] not null default '{}', add column measurement jsonb, add column video_url text check(video_url is null or video_url ~ '^https://(www\.)?(youtube\.com|youtu\.be)/[^[:space:]]+$');
alter table public.training_plans add column description text not null default '' check(length(description)<=1000), add column objective text not null default '' check(length(objective)<=500), add column mode text not null default 'both' check(mode in ('build','zero','both')), add column level text not null default 'intermediate' check(level in ('beginner','intermediate','advanced')), add column favorite boolean not null default false, add column archived boolean not null default false;
create or replace function private.validate_steps() returns trigger language plpgsql security definer set search_path='' as $$
 declare step jsonb; total integer:=0; seen uuid[]:=array[]::uuid[]; sid uuid; ex public.exercises; c jsonb; result jsonb:='[]';
 begin
 if jsonb_typeof(new.steps) is distinct from 'array' or jsonb_array_length(new.steps) not between 1 and 50 or pg_column_size(new.steps)>500000 then raise exception 'Invalid steps'; end if;
 for step in select value from jsonb_array_elements(new.steps) loop
 if jsonb_typeof(step->'exercise_id') is distinct from 'string' or jsonb_typeof(step->'minutes') is distinct from 'number' or (step->>'minutes') !~ '^[0-9]+$' or (step->>'minutes')::integer not between 1 and 120 then raise exception 'Invalid step'; end if;
 sid:=coalesce((step->>'id')::uuid,gen_random_uuid());
 if sid=any(seen) then raise exception 'Duplicate step identity';end if;seen:=array_append(seen,sid);
 if step ? 'custom' then
 c:=step->'custom';
 if jsonb_typeof(c) is distinct from 'object' or (c->>'id') is distinct from (step->>'exercise_id') or jsonb_typeof(c->'title') is distinct from 'string' or length(trim(c->>'title')) not between 1 and 160 or jsonb_typeof(c->'instructions') is distinct from 'string' or length(c->>'instructions') not between 20 and 10000 or c->'map_code' is distinct from 'null'::jsonb or (c->>'source_url') is distinct from '' or coalesce(c->>'mode','') not in ('build','zero','both') or c ? 'measurement' or c->'published' is distinct from 'false'::jsonb or exists(select 1 from public.exercises where id=(c->>'id')::uuid) then raise exception 'Invalid custom activity';end if;
 if new.mode='zero' and c->>'mode'='build' then raise exception 'Mode mismatch';end if;
 else
 select * into ex from public.exercises where id=(step->>'exercise_id')::uuid and published;
 if not found or (new.mode='zero' and ex.mode='build') then raise exception 'Exercise unavailable or mode mismatch';end if;
 end if;
 if step ? 'notes' and (jsonb_typeof(step->'notes') is distinct from 'string' or length(step->>'notes')>1000) then raise exception 'Invalid notes';end if;
 if step ? 'block' and (jsonb_typeof(step->'block') is distinct from 'string' or length(step->>'block')>80) then raise exception 'Invalid block';end if;
 if step ? 'repetitions' and (jsonb_typeof(step->'repetitions') is distinct from 'number' or (step->>'repetitions') !~ '^[0-9]+$' or (step->>'repetitions')::integer not between 1 and 1000) then raise exception 'Invalid repetitions';end if;
 if step ? 'resource_url' and (jsonb_typeof(step->'resource_url') is distinct from 'string' or length(step->>'resource_url')>2048 or ((step->>'resource_url')<>'' and (step->>'resource_url') !~ '^https://(www\.)?(youtube\.com|youtu\.be|fortnite\.com|dev\.epicgames\.com)/[^[:space:]]+$')) then raise exception 'Invalid resource link';end if;
 total:=total+(step->>'minutes')::integer;
 -- Discard caller-provided exercise snapshots; the server resolves the catalog.
 result:=result || jsonb_build_array((step-'exercise') || jsonb_build_object('id',sid));
 end loop;
 if total>240 then raise exception 'Plan exceeds four hours';end if;new.steps:=result;return new;
 end;$$;
-- Assign stable identities only to editable plans, never rewrite historical snapshots.
update public.training_plans set steps=steps;
create function private.validate_training_result(step jsonb,r jsonb,abandon boolean) returns void language plpgsql set search_path='' as $$
 declare m jsonb:=step->'exercise'->'measurement';
 begin
 if r ? 'conditions' and (jsonb_typeof(r->'conditions') is distinct from 'object' or jsonb_typeof(r->'conditions'->'scenario') is distinct from 'string' or length(r->'conditions'->>'scenario')>120 or jsonb_typeof(r->'conditions'->'device') is distinct from 'string' or length(r->'conditions'->>'device')>80 or jsonb_typeof(r->'conditions'->'sensitivity') is distinct from 'string' or length(r->'conditions'->>'sensitivity')>80 or not(r->'conditions' ? 'test_seconds')) then raise exception 'Invalid test conditions';end if;
 if r ? 'conditions' and r->'conditions'->'test_seconds'<>'null'::jsonb and (jsonb_typeof(r->'conditions'->'test_seconds') is distinct from 'number' or (r->'conditions'->>'test_seconds') !~ '^[0-9]+$' or (r->'conditions'->>'test_seconds')::integer not between 1 and 7200) then raise exception 'Invalid test duration';end if;
 if step ? 'id' and (r->>'step_id') is distinct from (step->>'id') then raise exception 'Wrong step identity';end if;
 if step ? 'id' and not abandon and coalesce(r->>'status','') not in ('completed','skipped') then raise exception 'Manual completion required';end if;
 if r ? 'status' and coalesce(r->>'status','') not in ('completed','skipped') then raise exception 'Invalid status';end if;
 if m is not null and m<>'null'::jsonb then
 if (r->>'unit') is distinct from (m->>'unit') or (r->>'version') is distinct from (m->>'version') then raise exception 'Incompatible metric';end if;
 if r->'value'<>'null'::jsonb and ((r->>'value')::numeric<(m->>'min')::numeric or (r->>'value')::numeric>(m->>'max')::numeric) then raise exception 'Metric outside limits';end if;
 end if;
 end;$$;
revoke all on function private.validate_training_result(jsonb,jsonb,boolean) from public,anon,authenticated;
alter table public.training_sessions add column plan_snapshot jsonb;
create or replace function public.start_training(p_plan uuid) returns public.training_sessions language plpgsql security definer set search_path='' as $$
 declare plan public.training_plans; session public.training_sessions; snapshot jsonb;
 begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into plan from public.training_plans where id=p_plan and user_id=auth.uid();
 if not found then raise exception 'Plan unavailable'; end if;
 if exists(select 1 from public.training_sessions where user_id=auth.uid() and status='active') then raise exception 'Active session exists'; end if;
 if (select count(*) from public.training_sessions where user_id=auth.uid() and started_at>=now()-interval '1 day')>=60 then raise exception 'Daily operation limit'; end if;
 select jsonb_agg(step.value || jsonb_build_object('exercise',coalesce(step.value->'custom',to_jsonb(e))) order by step.ordinality) into snapshot from jsonb_array_elements(plan.steps) with ordinality as step(value,ordinality) left join public.exercises e on e.id=(step.value->>'exercise_id')::uuid and e.published;
 if exists(select 1 from jsonb_array_elements(snapshot) s where s->'exercise'='null'::jsonb) then raise exception 'Exercise unavailable'; end if;
 insert into public.training_sessions(user_id,plan_id,title,steps,plan_snapshot) values(auth.uid(),plan.id,plan.title,snapshot,jsonb_build_object('title',plan.title,'objective',plan.objective,'description',plan.description,'mode',plan.mode,'level',plan.level)) returning * into session;return session;
 end; $$;
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
 perform private.validate_training_result(session.steps->n,r,p_abandon);
 n:=n+1;
 end loop;
 if not p_abandon and exists(select 1 from jsonb_array_elements(p_results) as entries(value) where coalesce(entries.value->>'status','completed')='completed') and (select coalesce(sum(amount),0) from public.xp_transactions where user_id=auth.uid() and created_at>=day_start)<200 then awarded:=100; end if;
 update public.training_sessions set status=case when p_abandon then 'abandoned' else 'completed' end,completed_at=now(),duration_seconds=p_seconds,results=p_results,xp=awarded where id=p_session returning * into session;
 if awarded>0 then insert into public.xp_transactions(user_id,session_id,amount) values(auth.uid(),session.id,awarded); end if;
 return session;
 end; $$;


alter table public.training_sessions add column checkpoint jsonb, add column checkpoint_version integer not null default 0, add column result_revision integer not null default 0;
create table public.training_result_revisions(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 session_id uuid not null references public.training_sessions(id) on delete cascade, step_index integer not null,
 before_result jsonb not null, after_result jsonb not null, changed_at timestamptz not null default now()
);
create index training_revisions_owner on public.training_result_revisions(user_id,session_id);
alter table public.training_result_revisions enable row level security;
revoke all on public.training_result_revisions from public,anon,authenticated;
grant select on public.training_result_revisions to authenticated;
create policy own_read on public.training_result_revisions for select to authenticated using(user_id=(select auth.uid()));
create function public.save_training_checkpoint(p_session uuid,p_checkpoint jsonb,p_version integer) returns public.training_sessions language plpgsql security definer set search_path='' as $$
 declare s public.training_sessions; r jsonb; n integer:=0; active numeric;
 begin
 select * into s from public.training_sessions where id=p_session and user_id=auth.uid() for update;
 if not found or s.status<>'active' then raise exception 'Session unavailable';end if;
 if p_version is distinct from s.checkpoint_version then raise exception 'Clutchfolio: a sessão mudou em outra aba. Recarregue antes de continuar.';end if;
 if p_checkpoint is null or pg_column_size(p_checkpoint)>100000 or jsonb_typeof(p_checkpoint) is distinct from 'object' or jsonb_typeof(p_checkpoint->'elapsed') is distinct from 'number' or (p_checkpoint->>'elapsed') !~ '^[0-9]+$' or jsonb_typeof(p_checkpoint->'done') is distinct from 'array' or jsonb_typeof(p_checkpoint->'results') is distinct from 'array' or jsonb_array_length(p_checkpoint->'done')<>jsonb_array_length(s.steps) or jsonb_array_length(p_checkpoint->'results')<>jsonb_array_length(s.steps) then raise exception 'Invalid checkpoint';end if;
 if exists(select 1 from jsonb_array_elements(p_checkpoint->'done') d where jsonb_typeof(d)<>'boolean') then raise exception 'Invalid completion';end if;
 if p_checkpoint ? 'activeStep' and (jsonb_typeof(p_checkpoint->'activeStep') is distinct from 'number' or (p_checkpoint->>'activeStep') !~ '^[0-9]+$' or (p_checkpoint->>'activeStep')::integer not between 0 and jsonb_array_length(s.steps)-1) then raise exception 'Invalid active step';end if;
 if p_checkpoint ? 'stepElapsed' and (jsonb_typeof(p_checkpoint->'stepElapsed') is distinct from 'array' or jsonb_array_length(p_checkpoint->'stepElapsed')<>jsonb_array_length(s.steps)) then raise exception 'Invalid step clocks';end if;
 if p_checkpoint ? 'stepElapsed' and exists(select 1 from jsonb_array_elements(p_checkpoint->'stepElapsed') as clocks(value) where jsonb_typeof(clocks.value)<>'number' or clocks.value::text !~ '^[0-9]+$' or clocks.value::text::numeric not between 0 and 86400) then raise exception 'Invalid step clock';end if;
 if p_checkpoint ? 'stepSince' and p_checkpoint->'stepSince'<>'null'::jsonb and (jsonb_typeof(p_checkpoint->'stepSince') is distinct from 'number' or (p_checkpoint->>'stepSince')::numeric>extract(epoch from clock_timestamp())*1000+2000 or (p_checkpoint->>'stepSince')::numeric<extract(epoch from s.started_at)*1000-2000) then raise exception 'Invalid step clock origin';end if;
 active:=(p_checkpoint->>'elapsed')::numeric;
 if p_checkpoint->'since' is distinct from 'null'::jsonb then
 if jsonb_typeof(p_checkpoint->'since') is distinct from 'number' or (p_checkpoint->>'since')::numeric>extract(epoch from clock_timestamp())*1000+2000 or (p_checkpoint->>'since')::numeric<extract(epoch from s.started_at)*1000-2000 then raise exception 'Invalid clock';end if;
 active:=active+greatest(0,extract(epoch from clock_timestamp())-(p_checkpoint->>'since')::numeric/1000);
 end if;
 if active<0 or active>86400 or active>extract(epoch from clock_timestamp()-s.started_at)+2 then raise exception 'Invalid elapsed time';end if;
 for r in select value from jsonb_array_elements(p_checkpoint->'results') loop
 if (r->>'exercise_id') is distinct from (s.steps->n->>'exercise_id') or jsonb_typeof(r->'note') is distinct from 'string' or length(r->>'note')>1000 or not(r ? 'value') or (r->'value'<>'null'::jsonb and (jsonb_typeof(r->'value')<>'number' or (r->>'value')::numeric<0 or (r->>'value')::numeric>1000000)) or (r ? 'configuration' and (jsonb_typeof(r->'configuration')<>'string' or length(r->>'configuration')>200)) then raise exception 'Invalid checkpoint result';end if;
 perform private.validate_training_result(s.steps->n,r,true);n:=n+1;
 end loop;
 update public.training_sessions set checkpoint=p_checkpoint,checkpoint_version=checkpoint_version+1 where id=s.id returning * into s;return s;
 end;$$;
create function public.correct_training_result(p_session uuid,p_index integer,p_result jsonb,p_revision integer) returns public.training_sessions language plpgsql security definer set search_path='' as $$
 declare s public.training_sessions;
 begin
 select * into s from public.training_sessions where id=p_session and user_id=auth.uid() for update;
 if not found or s.status='active' or p_index is null or p_index<0 or p_index>=jsonb_array_length(s.steps) or p_revision is distinct from s.result_revision then raise exception 'Record unavailable or changed';end if;
 if p_result is null or pg_column_size(p_result)>10000 or (p_result->>'exercise_id') is distinct from (s.steps->p_index->>'exercise_id') or jsonb_typeof(p_result->'note') is distinct from 'string' or length(p_result->>'note')>1000 or not(p_result ? 'value') or (p_result->'value'<>'null'::jsonb and (jsonb_typeof(p_result->'value')<>'number' or (p_result->>'value')::numeric<0 or (p_result->>'value')::numeric>1000000)) or (p_result ? 'configuration' and (jsonb_typeof(p_result->'configuration')<>'string' or length(p_result->>'configuration')>200)) then raise exception 'Invalid correction';end if;
 perform private.validate_training_result(s.steps->p_index,p_result,false);
 insert into public.training_result_revisions(user_id,session_id,step_index,before_result,after_result) values(auth.uid(),s.id,p_index,s.results->p_index,p_result);
 update public.training_sessions set results=jsonb_set(results,array[p_index::text],p_result),result_revision=result_revision+1 where id=s.id returning * into s;return s;
 end;$$;
revoke all on function public.save_training_checkpoint(uuid,jsonb,integer),public.correct_training_result(uuid,integer,jsonb,integer) from public,anon;
grant execute on function public.save_training_checkpoint(uuid,jsonb,integer),public.correct_training_result(uuid,integer,jsonb,integer) to authenticated;

alter table public.personal_goals add column measurement jsonb;
create function private.validate_training_goal() returns trigger language plpgsql security definer set search_path='' as $$
 declare m jsonb:=new.measurement; e public.exercises;
 begin
 if m is null then return new;end if;
 if pg_column_size(m)>10000 or jsonb_typeof(m)<>'object' or jsonb_typeof(m->'baseline') is distinct from 'number' or jsonb_typeof(m->'desired') is distinct from 'number' or jsonb_typeof(m->'configuration') is distinct from 'string' or length(trim(m->>'configuration')) not between 1 and 200 then raise exception 'Invalid measurable goal';end if;
 select * into e from public.exercises where id=(m->>'exercise_id')::uuid and published;
 if not found or e.measurement is null or (m->>'unit') is distinct from (e.measurement->>'unit') or (m->>'version') is distinct from (e.measurement->>'version') or (m->>'baseline')::numeric<(e.measurement->>'min')::numeric or (m->>'baseline')::numeric>(e.measurement->>'max')::numeric or (m->>'desired')::numeric<(e.measurement->>'min')::numeric or (m->>'desired')::numeric>(e.measurement->>'max')::numeric then raise exception 'Incompatible goal';end if;
 if m ? 'deadline' then perform (m->>'deadline')::date;end if;
 return new;end;$$;
create trigger validate_training_goal before insert or update on public.personal_goals for each row execute function private.validate_training_goal();

-- The catalog may grow without restricting categories to a database enum.
create function private.validate_exercise_training_metadata() returns trigger language plpgsql set search_path='' as $$
 declare m jsonb:=new.measurement;
 begin
 if cardinality(new.categories)>12 or cardinality(new.tags)>12 or exists(select 1 from unnest(new.categories || new.tags) value where length(trim(value)) not between 1 and 40) then raise exception 'Invalid taxonomy';end if;
 if m is not null and (jsonb_typeof(m)<>'object' or pg_column_size(m)>10000 or jsonb_typeof(m->'unit') is distinct from 'string' or length(m->>'unit') not between 1 and 80 or jsonb_typeof(m->'min') is distinct from 'number' or jsonb_typeof(m->'max') is distinct from 'number' or (m->>'min')::numeric<0 or (m->>'max')::numeric<(m->>'min')::numeric or (m->>'max')::numeric>1000000 or coalesce(m->>'direction','') not in ('higher','lower') or jsonb_typeof(m->'version') is distinct from 'string' or length(m->>'version') not between 1 and 80 or jsonb_typeof(m->'procedure') is distinct from 'string' or length(m->>'procedure') not between 20 and 1000) then raise exception 'Invalid benchmark';end if;return new;end;$$;
create trigger validate_exercise_training_metadata before insert or update on public.exercises for each row execute function private.validate_exercise_training_metadata();

-- Preserve comparison metadata in the consent-gated minimal context.
create or replace function public.coach_context(p_intent text,p_days integer,p_category text,p_exercise uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
 declare u uuid:=auth.uid();pref public.coach_preferences;tz text;start_at timestamptz;result jsonb:='{}';today date;records jsonb;
 begin
 if u is null then raise exception 'Authentication required';end if;
 if p_intent is null or p_days is null or p_category is null or p_intent not in ('report','agenda','exercise','competition','knowledge') or p_days not in (7,30,90) or p_category not in ('auto','aim','mechanics','piece','competitive','decisions','vod','wellbeing') then raise exception 'Invalid context request';end if;
 select * into pref from public.coach_preferences where id=u;
 select timezone into tz from public.profiles where id=u;
 today:=(now() at time zone coalesce(tz,'UTC'))::date;
 start_at:=(today-p_days+1)::timestamp at time zone coalesce(tz,'UTC');
 if pref.context_enabled then
 result:=jsonb_build_object('profile',(select jsonb_build_object('mode',mode,'level',level,'objective',objective,'timezone',timezone,'minutes',minutes) from public.profiles where id=u));
 if p_intent='report' then
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into records from (select id,completed_at,duration_seconds,(select coalesce(jsonb_agg(jsonb_build_object('id',x->'id','exercise_id',x->'exercise_id','exercise',jsonb_build_object('category',x->'exercise'->'category','metric',x->'exercise'->'metric','title',x->'exercise'->'title','published',x->'exercise'->'published'))),'[]') from jsonb_array_elements(steps) x) steps,(select coalesce(jsonb_agg(jsonb_build_object('exercise_id',x->'exercise_id','value',x->'value','configuration',x->'configuration','step_id',x->'step_id','status',x->'status','unit',x->'unit','version',x->'version','conditions',x->'conditions')),'[]') from jsonb_array_elements(results) x) results from public.training_sessions where user_id=u and status='completed' and completed_at>=start_at and completed_at<=now() order by completed_at desc limit 200) t;
 result:=result||jsonb_build_object('sessions',records,'total',(select count(*) from public.training_sessions where user_id=u and status='completed' and completed_at>=start_at and completed_at<=now()),'goals',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from (select title,completed from public.personal_goals where user_id=u order by id limit 20) g),'journals',(select coalesce(jsonb_agg(to_jsonb(j)),'[]') from (select session_id,difficulties,left(next_focus,300) next_focus,left(difficult,300) difficult from public.training_journals where user_id=u and session_id in (select (x->>'id')::uuid from jsonb_array_elements(records) x) limit 200) j));
 elsif p_intent='agenda' then
 result:=result||jsonb_build_object('agenda',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select * from private.coach_agenda(u,today,today+14) where (starts_at at time zone tz)::date between today and today+14 and status<>'cancelled' order by starts_at limit 100) a));
 elsif p_intent='competition' then
 result:=result||jsonb_build_object('tournaments',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select t.id,t.slug,t.title,t.starts_at,t.start_date,t.status,t.valid_until,t.verified_at,t.source_url from public.tournaments t where t.published and exists(select 1 from public.bookmarks b where b.user_id=u and b.kind='tournament' and b.target_id=t.id) order by t.start_date desc limit 10) t));
 end if;end if;
 if p_category='auto' then p_category:=case when pref.context_enabled then (select objective from public.profiles where id=u) else 'aim' end;end if;
 if p_intent in ('exercise','knowledge') then
 result:=result||jsonb_build_object('exercises',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from (select id,title,category,mode,level,description,instructions,metric,map_code,source_url,verified_at from public.exercises where published and ((p_exercise is null and category=p_category) or id=p_exercise) order by verified_at desc limit 10) e),'articles',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select id,slug,title,summary,source_url,verified_at from public.articles where published and published_at<=now() and category=p_category and (valid_until is null or valid_until>=now()) order by verified_at desc limit 3) a));
 end if;
 return result;end;$$;
