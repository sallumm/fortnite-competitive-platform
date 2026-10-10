-- Clutch Coach: additive, opt-in, no changes to existing training data.
create table public.coach_preferences (
 id uuid primary key references public.profiles(id) on delete cascade,
 context_enabled boolean not null default false,external_enabled boolean not null default false,
 history_enabled boolean not null default false,proactive_enabled boolean not null default false,
 consent_version text,check(not external_enabled or consent_version='coach-v1')
);
create table public.coach_conversations (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(length(title) between 1 and 80),created_at timestamptz not null default now(),unique(id,user_id)
);
create table public.coach_messages (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,conversation_id uuid not null,
 question text not null check(length(question) between 1 and 2000),answer jsonb not null check(pg_column_size(answer)<50000),created_at timestamptz not null default now(),
 foreign key(conversation_id,user_id) references public.coach_conversations(id,user_id) on delete cascade
);
create table public.coach_actions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 payload jsonb not null check(pg_column_size(payload)<12000),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',
 status text not null default 'pending' check(status in ('pending','confirmed')),result jsonb,
 check(expires_at=created_at+interval '15 minutes')
);
create table private.coach_usage (
 user_id uuid not null references public.profiles(id) on delete cascade,day date not null,minute timestamptz not null,requests integer not null default 0,minute_requests integer not null default 0,generative integer not null default 0,
 primary key(user_id,day)
);
create table private.coach_global_usage(day date primary key,calls integer not null default 0);
-- Complete occurrence view, including moved exceptions, bounded to the queried dates.
create function private.coach_agenda(p_user uuid,p_from date,p_to date) returns table(id text,title text,starts_at timestamptz,duration_minutes integer,status text,series_id uuid,occurrence_date date) language sql stable set search_path='' as $$
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
$$;
create function public.coach_context(p_intent text,p_days integer,p_category text,p_exercise uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
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
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into records from (select id,completed_at,duration_seconds,(select coalesce(jsonb_agg(jsonb_build_object('exercise_id',x->'exercise_id','exercise',jsonb_build_object('category',x->'exercise'->'category','metric',x->'exercise'->'metric','title',x->'exercise'->'title'))),'[]') from jsonb_array_elements(steps) x) steps,(select coalesce(jsonb_agg(jsonb_build_object('exercise_id',x->'exercise_id','value',x->'value','configuration',x->'configuration')),'[]') from jsonb_array_elements(results) x) results from public.training_sessions where user_id=u and status='completed' and completed_at>=start_at and completed_at<=now() order by completed_at desc limit 200) t;
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
-- Atomic quota reservation; failed provider calls still consume their reservation, without retries.
create function public.coach_reserve(p_external boolean default false) returns void language plpgsql security definer set search_path='' as $$
 declare u uuid:=auth.uid();d date:=(now() at time zone 'UTC')::date;m timestamptz:=date_trunc('minute',now());r private.coach_usage;g integer;
 begin
 if u is null then raise exception 'Authentication required';end if;
 delete from private.coach_usage where day<d-30;delete from private.coach_global_usage where day<d-30;
 if p_external and not exists(select 1 from public.coach_preferences where id=u and external_enabled and consent_version='coach-v1') then raise exception 'External consent required';end if;
 insert into private.coach_usage(user_id,day,minute) values(u,d,m) on conflict do nothing;
 select * into r from private.coach_usage where user_id=u and day=d for update;
 if r.requests>=60 or (r.minute=m and r.minute_requests>=6) or (p_external and r.generative>=20) then raise exception 'Clutchfolio: limite de uso atingido. Tente mais tarde.';end if;
 if p_external then
 insert into private.coach_global_usage values(d,0) on conflict do nothing;
 select calls into g from private.coach_global_usage where day=d for update;
 if g>=500 then raise exception 'Clutchfolio: orçamento diário de IA atingido.';end if;
 update private.coach_global_usage set calls=calls+1 where day=d;
 end if;
 update private.coach_usage set requests=requests+1,minute=m,minute_requests=case when r.minute=m then r.minute_requests+1 else 1 end,generative=generative+case when p_external then 1 else 0 end where user_id=u and day=d;
 end;$$;
create function public.coach_save_turn(p_question text,p_answer jsonb,p_conversation uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare u uuid:=auth.uid();c uuid:=p_conversation;
 begin
 perform 1 from public.profiles where id=u for update;
 if not exists(select 1 from public.coach_preferences where id=u and history_enabled) then return null;end if;
 if c is null then
 if (select count(*) from public.coach_conversations where user_id=u)>=100 then raise exception 'Clutchfolio: exclua conversas antigas antes de salvar novas.';end if;
 insert into public.coach_conversations(user_id,title) values(u,left(p_question,80)) returning id into c;
 elsif not exists(select 1 from public.coach_conversations where id=c and user_id=u) then raise exception 'Conversation unavailable';end if;
 if (select count(*) from public.coach_messages where conversation_id=c)>=100 then raise exception 'Clutchfolio: limite de mensagens desta conversa atingido.';end if;
 insert into public.coach_messages(user_id,conversation_id,question,answer) values(u,c,p_question,p_answer);
 return c;end;$$;
create function private.coach_validate_action(p jsonb,u uuid) returns void language plpgsql set search_path='' as $$
 declare item jsonb;a timestamptz;duration integer;target public.scheduled_sessions;dates timestamptz[]:='{}';ends timestamptz[]:='{}';i integer;series_end date;series_start date;day date;tz text;weekdays integer[];
 begin
 if u is null or jsonb_typeof(p)<>'object' or pg_column_size(p)>12000 or coalesce(p->>'kind','') not in ('create','series','move','cancel') then raise exception 'Invalid action';end if;
 if p ? 'exclude_id' then raise exception 'Invalid action parameter';end if;
 if p->>'kind' in ('move','cancel') then
 select * into target from public.scheduled_sessions where id=(p->>'schedule_id')::uuid and user_id=u;
 if not found or target.status<>'planned' or exists(select 1 from public.training_sessions where schedule_id=target.id and status in ('active','completed')) then raise exception 'Activity unavailable';end if;
 if p->>'kind'='cancel' then return;end if;
 p:=jsonb_build_object('kind','create','items',jsonb_build_array(jsonb_build_object('title',coalesce(target.title,'Treino'),'starts_at',p->>'starts_at','duration_minutes',coalesce(target.duration_minutes,30),'kind',target.kind,'plan_id',target.plan_id)),'exclude_id',target.id);
 end if;
 if p->>'kind'='series' then
 series_start:=(p->>'start_date')::date;series_end:=(p->>'end_date')::date;tz:=p->>'timezone';
 select array_agg(x::int) into weekdays from jsonb_array_elements_text(p->'weekdays') x;
 if series_start is null or series_end is null or series_end<series_start or series_end-series_start>55 or series_start<current_date or series_start>current_date+90 or not private.valid_weekdays(weekdays) or not exists(select 1 from pg_catalog.pg_timezone_names where name=tz) or (p->>'local_time')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid recurrence';end if;
 if p->>'kind'='series' then
 for day in select d::date from generate_series(series_start::timestamp,series_end::timestamp,interval '1 day') d where extract(dow from d)::int=any(weekdays) loop
 a:=(day+(p->>'local_time')::time) at time zone tz;
 if (a at time zone tz)::time<>(p->>'local_time')::time then raise exception 'Nonexistent wall time';end if;
 dates:=array_append(dates,a);ends:=array_append(ends,a+((p->>'duration_minutes')::integer)*interval '1 minute');
 end loop;end if;
 item:=p||jsonb_build_object('kind',p->>'activity_kind');
 else
 if jsonb_typeof(p->'items')<>'array' or jsonb_array_length(p->'items') not between 1 and 14 then raise exception 'Invalid activities';end if;
 end if;
 for item in select value from jsonb_array_elements(case when p->>'kind'='series' then jsonb_build_array(item) else p->'items' end) loop
 duration:=(item->>'duration_minutes')::int;
 if duration is null or duration not between 5 and 120 or coalesce(length(trim(item->>'title')),0) not between 1 and 80 or coalesce(item->>'kind','') not in ('training','personal','rest') then raise exception 'Invalid activity';end if;
 if item->>'kind'='training' then
 if not exists(select 1 from public.training_plans where id=(item->>'plan_id')::uuid and user_id=u) then raise exception 'Plan unavailable';end if;
 elsif item->>'plan_id' is not null then raise exception 'Invalid plan';end if;
 if p->>'kind'<>'series' then a:=(item->>'starts_at')::timestamptz;dates:=array_append(dates,a);ends:=array_append(ends,a+duration*interval '1 minute');end if;
 end loop;
 if cardinality(dates)=0 then raise exception 'No occurrences';end if;
 for i in 1..cardinality(dates) loop
 if dates[i] is null or dates[i]<now() or dates[i]>now()+interval '150 days' then raise exception 'Invalid date';end if;
 if exists(select 1 from private.coach_agenda(u,(dates[i] at time zone 'UTC')::date-1,(ends[i] at time zone 'UTC')::date+1) e where e.status<>'cancelled' and e.id is distinct from p->>'exclude_id' and e.starts_at<ends[i] and e.starts_at+e.duration_minutes*interval '1 minute'>dates[i]) then raise exception 'Clutchfolio: conflito na agenda. Escolha outro horário.';end if;
 if exists(select 1 from generate_subscripts(dates,1) j where j<i and dates[j]<ends[i] and ends[j]>dates[i]) then raise exception 'Overlapping proposal';end if;
 end loop;
 end;$$;
create function public.coach_propose(p_payload jsonb) returns public.coach_actions language plpgsql security definer set search_path='' as $$
 declare result public.coach_actions;
 begin
 perform 1 from public.profiles where id=auth.uid() for update;
 if (select count(*) from public.coach_actions where user_id=auth.uid() and created_at>now()-interval '1 day')>=60 then raise exception 'Action limit';end if;
 perform private.coach_validate_action(p_payload,auth.uid());
 insert into public.coach_actions(user_id,payload) values(auth.uid(),p_payload) returning * into result;return result;end;$$;
create function public.coach_confirm(p_id uuid,p_confirmation text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare r public.coach_actions;item jsonb;new_id uuid;ids uuid[]:='{}';confirmed_result jsonb;
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into r from public.coach_actions where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Proposal unavailable';end if;
 if p_confirmation is distinct from (case when r.payload->>'kind'='cancel' then 'CANCELAR' else 'CONFIRMAR' end) then raise exception 'Explicit confirmation required';end if;
 if r.status='confirmed' then return r.result;end if;
 if r.expires_at<now() then raise exception 'Proposal expired';end if;
 lock table public.scheduled_sessions,public.activity_series,public.calendar_exceptions in share row exclusive mode;
 perform private.coach_validate_action(r.payload,auth.uid());
 if r.payload->>'kind'='create' then
 for item in select value from jsonb_array_elements(r.payload->'items') loop
 insert into public.scheduled_sessions(user_id,title,kind,plan_id,starts_at,duration_minutes) values(auth.uid(),item->>'title',item->>'kind',(item->>'plan_id')::uuid,(item->>'starts_at')::timestamptz,(item->>'duration_minutes')::int) returning id into new_id;ids:=array_append(ids,new_id);
 end loop;
 elsif r.payload->>'kind'='series' then
 insert into public.activity_series(user_id,title,kind,plan_id,timezone,local_time,start_date,end_date,weekdays,duration_minutes) values(auth.uid(),r.payload->>'title',r.payload->>'activity_kind',(r.payload->>'plan_id')::uuid,r.payload->>'timezone',(r.payload->>'local_time')::time,(r.payload->>'start_date')::date,(r.payload->>'end_date')::date,array(select x::int from jsonb_array_elements_text(r.payload->'weekdays') x),(r.payload->>'duration_minutes')::int) returning id into new_id;ids:=array_append(ids,new_id);
 elsif r.payload->>'kind'='move' then
 update public.scheduled_sessions set starts_at=(r.payload->>'starts_at')::timestamptz where id=(r.payload->>'schedule_id')::uuid and user_id=auth.uid() returning id into new_id;ids:=array_append(ids,new_id);
 else
 update public.scheduled_sessions set status='cancelled' where id=(r.payload->>'schedule_id')::uuid and user_id=auth.uid() returning id into new_id;ids:=array_append(ids,new_id);
 end if;
 confirmed_result:=jsonb_build_object('ids',ids,'kind',r.payload->>'kind','status','confirmed');
 update public.coach_actions set status='confirmed',result=confirmed_result where id=r.id;
 return confirmed_result;end;$$;
-- RLS: clients can read/delete their history, but cannot forge answers or proposals.
do $$ declare t text;begin
 foreach t in array array['coach_preferences','coach_conversations','coach_messages','coach_actions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,delete on public.%I to authenticated',t);
 execute format('create policy owner_read on public.%I for select to authenticated using (%I=auth.uid())',t,case when t='coach_preferences' then 'id' else 'user_id' end);
 execute format('create policy owner_delete on public.%I for delete to authenticated using (%I=auth.uid())',t,case when t='coach_preferences' then 'id' else 'user_id' end);
 end loop;
end $$;
grant insert,update on public.coach_preferences to authenticated;
create policy owner_insert on public.coach_preferences for insert to authenticated with check(id=auth.uid());
create policy owner_update on public.coach_preferences for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
revoke all on function private.coach_agenda(uuid,date,date),private.coach_validate_action(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.coach_context(text,integer,text,uuid),public.coach_reserve(boolean),public.coach_save_turn(text,jsonb,uuid),public.coach_propose(jsonb),public.coach_confirm(uuid,text) from public,anon;
grant execute on function public.coach_context(text,integer,text,uuid),public.coach_reserve(boolean),public.coach_save_turn(text,jsonb,uuid),public.coach_propose(jsonb),public.coach_confirm(uuid,text) to authenticated;
create index coach_messages_conversation on public.coach_messages(conversation_id,created_at);
create index coach_actions_owner on public.coach_actions(user_id,created_at);
