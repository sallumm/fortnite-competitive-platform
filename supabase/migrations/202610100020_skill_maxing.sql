-- Skill Maxing configuration + atomic approval, reusing plans and activity_series.
create table public.evolution_settings(id uuid primary key references public.profiles(id) on delete cascade,config jsonb not null,updated_at timestamptz not null default now());
create table public.evolution_batches(id uuid primary key,user_id uuid not null references public.profiles(id) on delete cascade,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now());
alter table public.evolution_settings enable row level security;
alter table public.evolution_batches enable row level security;
grant select on public.evolution_settings,public.evolution_batches to authenticated;
create policy own_evolution_settings on public.evolution_settings for select to authenticated using(id=(select auth.uid()));
create policy own_evolution_batches on public.evolution_batches for select to authenticated using(user_id=(select auth.uid()));
create index evolution_batches_user_date on public.evolution_batches(user_id,created_at desc);
create function private.validate_evolution_config(c jsonb) returns void language plpgsql set search_path='' as $$
declare k text;v jsonb;w jsonb;ids text[]:=array[]::text[];skill_ids text[]:=array[]::text[];
begin
 if c is null or jsonb_typeof(c)<>'object' or pg_column_size(c)>40000 or exists(select 1 from jsonb_object_keys(c) x where x not in ('mode','level','input','timezone','objective','skills','difficulties','windows','blocked','opposition','competitive','baseline','style','tournament_id')) then raise exception 'Invalid configuration';end if;
 if coalesce(c->>'mode','') not in ('build','zero') or coalesce(c->>'level','') not in ('beginner','intermediate','advanced') or coalesce(c->>'input','') not in ('kbm','controller') or coalesce(c->>'opposition','') not in ('solo','friends','opponents','mixed') or coalesce(c->>'style','') not in ('short','habitual','review') then raise exception 'Invalid preferences';end if;
 foreach k in array array['mode','level','input','opposition','style','timezone','objective','difficulties'] loop if jsonb_typeof(c->k) is distinct from 'string' then raise exception 'Invalid preference type';end if;end loop;
 if length(btrim(c->>'objective')) not between 3 and 200 or length(c->>'difficulties')>500 or length(c->>'timezone')>100 or not exists(select 1 from pg_catalog.pg_timezone_names where name=c->>'timezone') or jsonb_typeof(c->'competitive') is distinct from 'boolean' or jsonb_typeof(c->'baseline') is distinct from 'boolean' then raise exception 'Invalid configuration values';end if;
 if not(c ? 'tournament_id') or (c->'tournament_id'<>'null'::jsonb and (jsonb_typeof(c->'tournament_id')<>'string' or c->>'tournament_id' !~ '^[0-9a-f-]{36}$')) then raise exception 'Invalid tournament';end if;
 foreach k in array array['skills','windows','blocked'] loop if jsonb_typeof(c->k) is distinct from 'array' then raise exception 'Invalid list';end if;end loop;
 if jsonb_array_length(c->'skills') not between 1 and 12 or jsonb_array_length(c->'windows') not between 1 and 42 or jsonb_array_length(c->'blocked')>42 then raise exception 'Invalid list length';end if;
 for v in select value from jsonb_array_elements(c->'skills') loop
  if jsonb_typeof(v)<>'object' or exists(select 1 from jsonb_object_keys(v) x where x not in ('id','weight')) or jsonb_typeof(v->'id') is distinct from 'string' or jsonb_typeof(v->'weight') is distinct from 'number' or v->>'weight' !~ '^[1-5]$' or v->>'id'=any(skill_ids) then raise exception 'Invalid competency priority';end if;
  if not exists(select 1 from public.training_knowledge t where t.kind='competency' and t.id=v->>'id' and t.content->>'mode' in ('both',c->>'mode')) then raise exception 'Incompatible competency';end if;
  skill_ids:=array_append(skill_ids,v->>'id');
 end loop;
 foreach k in array array['windows','blocked'] loop
 for v in select value from jsonb_array_elements(c->k) loop
  if jsonb_typeof(v)<>'object' or exists(select 1 from jsonb_object_keys(v) x where x not in ('id','weekday','start','end','minutes')) or jsonb_typeof(v->'id') is distinct from 'string' or v->>'id' !~ '^[0-9a-f-]{36}$' or v->>'id'=any(ids) or jsonb_typeof(v->'weekday') is distinct from 'number' or v->>'weekday' !~ '^[0-6]$' then raise exception 'Invalid window';end if;
  if jsonb_typeof(v->'start') is distinct from 'string' or jsonb_typeof(v->'end') is distinct from 'string' or v->>'start' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v->>'end' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v->>'start'>=v->>'end' then raise exception 'Invalid window times';end if;
  if k='windows' then
   if jsonb_typeof(v->'minutes') is distinct from 'number' or v->>'minutes' !~ '^[0-9]+$' or (v->>'minutes')::int not between 1 and 120 or (v->>'minutes')::int>extract(epoch from ((v->>'end')::time-(v->>'start')::time))/60 then raise exception 'Invalid session budget';end if;
   for w in select value from jsonb_array_elements(c->'windows') loop
    if v->>'id'<w->>'id' and v->>'weekday'=w->>'weekday' and v->>'start'<w->>'end' and w->>'start'<v->>'end' then raise exception 'Overlapping windows';end if;
   end loop;
  elsif v ? 'minutes' then raise exception 'Unexpected blocked duration';end if;
  ids:=array_append(ids,v->>'id');
 end loop;end loop;
end;$$;
-- Matches the calendar client's IANA policy: first repeated wall time; no instant for a gap.
create function private.evolution_instant(p_date date,p_time time,p_timezone text) returns timestamptz language sql stable set search_path='' as $$
 with wall as (select (p_date+p_time) at time zone 'UTC' w), offsets as (
 select distinct (p at time zone p_timezone)-(p at time zone 'UTC') off from wall cross join lateral generate_series(w-interval '36 hours',w+interval '36 hours',interval '6 hours') p)
 select min(w-off) from wall cross join offsets where ((w-off) at time zone p_timezone)=p_date+p_time
$$;
create function private.evolution_agenda(p_user uuid,p_from date,p_to date) returns table(starts_at timestamptz,duration_minutes integer,status text) language sql stable set search_path='' as $$
 select case when a.series_id is not null and not exists(select 1 from public.calendar_exceptions e where e.series_id=a.series_id and e.occurrence_date=a.occurrence_date and e.starts_at is not null)
 then private.evolution_instant(a.occurrence_date,r.local_time,r.timezone) else a.starts_at end,a.duration_minutes,a.status
 from private.coach_agenda(p_user,p_from,p_to) a left join public.activity_series r on r.id=a.series_id and r.user_id=p_user
$$;
create function public.save_evolution_config(p_config jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;perform private.validate_evolution_config(p_config);
 insert into public.evolution_settings(id,config) values(auth.uid(),p_config) on conflict(id) do update set config=excluded.config,updated_at=now();
end;$$;
create function public.confirm_evolution_plan(p_token uuid,p_from date,p_weeks integer,p_config jsonb,p_sessions jsonb,p_rules text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();item jsonb;plan jsonb;st jsonb;d date;first_date date;last_date date;stamp timestamptz;finish timestamptz;total int;plan_id uuid;series_id uuid;result jsonb:='[]';payload jsonb;old public.evolution_batches;days int[]:=array[]::int[];ex public.exercises;target public.tournaments;tz text;
begin
 if u is null or p_token is null then raise exception 'Authentication required';end if;
 -- Same write lock as the existing Coach: conflicts cannot slip between validation and persistence.
 lock table public.scheduled_sessions,public.activity_series,public.calendar_exceptions in share row exclusive mode;
 perform 1 from public.profiles where id=u for update;
 payload:=jsonb_build_object('from',p_from,'weeks',p_weeks,'config',p_config,'sessions',p_sessions,'rules',p_rules);
 select * into old from public.evolution_batches where id=p_token;
 if found then if old.user_id<>u or old.payload<>payload then raise exception 'Approval token already used';end if;return old.result;end if;
 perform private.validate_evolution_config(p_config);tz:=p_config->>'timezone';
 if p_from is null or extract(dow from p_from)<>1 or p_from<(now() at time zone tz)::date or p_from>(now() at time zone tz)::date+366 or p_weeks is null or p_weeks not between 1 and 4 or p_rules is null or length(p_rules) not between 3 and 60 then raise exception 'Invalid planning period';end if;
 if p_sessions is null or jsonb_typeof(p_sessions)<>'array' or jsonb_array_length(p_sessions) not between 1 and 7 or pg_column_size(p_sessions)>500000 then raise exception 'Invalid session proposal';end if;
 if (select count(*) from public.evolution_batches where user_id=u and created_at>now()-interval '1 day')>=20 then raise exception 'Planning approval limit';end if;
 last_date:=p_from+(p_weeks*7-1);
 if p_config->'tournament_id'<>'null'::jsonb then
  select * into target from public.tournaments where id=(p_config->>'tournament_id')::uuid and published and status='scheduled' and confirmation='confirmed' and valid_until>now() and mode in ('both',p_config->>'mode');
  if not found then raise exception 'Tournament requires verification';end if;
 end if;
 for item in select value from jsonb_array_elements(p_sessions) loop
  if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where k not in ('date','time','plan')) or jsonb_typeof(item->'date') is distinct from 'string' or jsonb_typeof(item->'time') is distinct from 'string' or item->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid proposal';end if;
  first_date:=(item->>'date')::date;
  if first_date<p_from or first_date>p_from+6 or extract(dow from first_date)::int=any(days) then raise exception 'Invalid proposed day';end if;days:=array_append(days,extract(dow from first_date)::int);
  plan:=item->'plan';
  if jsonb_typeof(plan) is distinct from 'object' or exists(select 1 from jsonb_object_keys(plan) k where k not in ('title','steps','description','objective','mode','level')) or jsonb_typeof(plan->'title') is distinct from 'string' or jsonb_typeof(plan->'objective') is distinct from 'string' or jsonb_typeof(plan->'description') is distinct from 'string' or plan->>'mode' is distinct from p_config->>'mode' or plan->>'level' is distinct from p_config->>'level' or jsonb_typeof(plan->'steps') is distinct from 'array' or jsonb_array_length(plan->'steps') not between 1 and 50 then raise exception 'Invalid proposed routine';end if;
  total:=0;
  for st in select value from jsonb_array_elements(plan->'steps') loop
   if jsonb_typeof(st->'minutes') is distinct from 'number' or st->>'minutes' !~ '^[0-9]+$' or (st->>'minutes')::int not between 1 and 120 then raise exception 'Invalid duration';end if;
   total:=total+(st->>'minutes')::int;
   if not(st ? 'custom') then
    select * into ex from public.exercises where id=(st->>'exercise_id')::uuid and published and verified_at<=now() and mode in ('both',p_config->>'mode') and research->>'review_status'='verified' and (research->>'review_due_at')::timestamptz>now();
    if not found or ((p_config->>'input'='controller') and 'kbm-only'=any(ex.tags)) or ((p_config->>'input'='kbm') and 'controller-only'=any(ex.tags)) then raise exception 'Exercise requires verification or incompatible mode/device';end if;
   elsif st->'custom'->>'mode' not in ('both',p_config->>'mode') then raise exception 'Incompatible custom activity';end if;
  end loop;
  if total not between 1 and 120 then raise exception 'Invalid session duration';end if;
  for d in select generate_series(first_date::timestamp,last_date::timestamp,interval '7 days')::date loop
   stamp:=private.evolution_instant(d,(item->>'time')::time,tz);finish:=stamp+total*interval '1 minute';
   if stamp is null or stamp<now() or not exists(select 1 from jsonb_array_elements(p_config->'windows') w where (w->>'weekday')::int=extract(dow from d) and total<=(w->>'minutes')::int and stamp>=private.evolution_instant(d,(w->>'start')::time,tz) and finish<=private.evolution_instant(d,(w->>'end')::time,tz)) then raise exception 'Outside authorized availability';end if;
   if target.id is not null and d>=target.start_date then raise exception 'Preparation must precede tournament';end if;
   if exists(select 1 from jsonb_array_elements(p_config->'blocked') b where (b->>'weekday')::int=extract(dow from d) and private.evolution_instant(d,(b->>'start')::time,tz)<finish and private.evolution_instant(d,(b->>'end')::time,tz)>stamp) then raise exception 'Reserved personal commitment';end if;
   if exists(select 1 from private.evolution_agenda(u,d-1,d+1) a where a.status<>'cancelled' and a.starts_at<finish and a.starts_at+a.duration_minutes*interval '1 minute'>stamp) then raise exception 'Calendar conflict: review proposal';end if;
  end loop;
  -- Existing validate_steps resolves catalog data and validates every custom step transactionally.
  insert into public.training_plans(user_id,title,steps,description,objective,mode,level) values(u,plan->>'title',plan->'steps',plan->>'description',plan->>'objective',plan->>'mode',plan->>'level') returning id into plan_id;
  insert into public.activity_series(user_id,title,kind,plan_id,timezone,local_time,start_date,end_date,weekdays,duration_minutes,tournament_id) values(u,plan->>'title','training',plan_id,tz,(item->>'time')::time,first_date,last_date,array[extract(dow from first_date)::int],total,target.id) returning id into series_id;
  result:=result||jsonb_build_array(jsonb_build_object('plan_id',plan_id,'series_id',series_id));
 end loop;
 insert into public.evolution_settings(id,config) values(u,p_config) on conflict(id) do update set config=excluded.config,updated_at=now();
 insert into public.evolution_batches(id,user_id,payload,result) values(p_token,u,payload,result);
 return result;
end;$$;
revoke all on function private.validate_evolution_config(jsonb),private.evolution_instant(date,time,text),private.evolution_agenda(uuid,date,date) from public,anon,authenticated;
revoke all on function public.save_evolution_config(jsonb),public.confirm_evolution_plan(uuid,date,integer,jsonb,jsonb,text) from public,anon;
grant execute on function public.save_evolution_config(jsonb),public.confirm_evolution_plan(uuid,date,integer,jsonb,jsonb,text) to authenticated;
