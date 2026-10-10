-- Incremental: reuse goals, skill reviews and planning preferences; private manual VOD and optional readiness.
alter table public.skill_reviews drop constraint skill_reviews_skill_check;
alter table public.skill_reviews add constraint skill_reviews_skill_check check(skill in ('aim','tracking','shotgun','building','editing','piece','movement','decisions','rotations','endgame','vod','box_fighting','positioning'));
create function private.valid_skills(v text[]) returns boolean language sql immutable set search_path='' as $$ select v is not null and cardinality(v)<=13 and array_position(v,null) is null and v <@ array['aim','tracking','shotgun','building','editing','piece','movement','decisions','rotations','endgame','vod','box_fighting','positioning'] and cardinality(v)=(select count(distinct x) from unnest(v) x) $$;
alter table public.planning_preferences add column primary_skill text check(primary_skill is null or private.valid_skills(array[primary_skill]));
alter table public.planning_preferences add column secondary_skills text[] not null default '{}' check(private.valid_skills(secondary_skills));
alter table public.personal_goals add column status text not null default 'active' check(status in ('active','paused','completed','archived'));
alter table public.personal_goals add column criteria text not null default '' check(length(criteria)<=500);
alter table public.personal_goals add column skill text check(skill is null or private.valid_skills(array[skill]));
alter table public.personal_goals add column exercise_ids uuid[] not null default '{}' check(cardinality(exercise_ids)<=20 and array_position(exercise_ids,null) is null);
alter table public.personal_goals add column due_date date;
update public.personal_goals set status='completed' where completed;
create table public.goal_revisions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,goal_id uuid not null references public.personal_goals(id) on delete cascade,before_value jsonb,after_value jsonb not null,created_at timestamptz not null default now());
alter table public.goal_revisions enable row level security;
create policy goal_revision_owner on public.goal_revisions for select to authenticated using(user_id=auth.uid());
grant select on public.goal_revisions to authenticated;
create index goal_revisions_owner on public.goal_revisions(user_id,goal_id,created_at desc);
create function private.goal_lifecycle() returns trigger language plpgsql set search_path='' as $$ begin
 if cardinality(new.exercise_ids)<>(select count(distinct x) from unnest(new.exercise_ids) x) or exists(select 1 from unnest(new.exercise_ids) x where not exists(select 1 from public.exercises e where e.id=x and e.published)) then raise exception 'Invalid goal exercises';end if;
 if tg_op='INSERT' then if new.completed and new.status='active' then new.status:='completed';end if;
 elsif new.completed is distinct from old.completed and new.status=old.status then new.status:=case when new.completed then 'completed' else 'active' end;end if;
 if new.status='archived' then if tg_op='UPDATE' then new.completed:=old.completed;end if;else new.completed:=new.status='completed';end if;return new;end;$$;
create trigger goal_lifecycle before insert or update on public.personal_goals for each row execute function private.goal_lifecycle();
create function private.audit_goal() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='INSERT' then insert into public.goal_revisions(user_id,goal_id,before_value,after_value) values(new.user_id,new.id,null,to_jsonb(new));
 elsif to_jsonb(old) is distinct from to_jsonb(new) then insert into public.goal_revisions(user_id,goal_id,before_value,after_value) values(new.user_id,new.id,to_jsonb(old),to_jsonb(new));end if;return new;end;$$;
create trigger goal_audit after insert or update on public.personal_goals for each row execute function private.audit_goal();
create table public.vod_reviews(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 160),match_date date not null,tournament_id uuid references public.tournaments(id) on delete set null,
 video_url text not null default '' check(video_url='' or video_url ~ '^https://(www\.)?(youtube\.com|youtu\.be|twitch\.tv|clips\.twitch\.tv)(/|$)' and length(video_url)<=500),video_authorized boolean not null default false,check(video_url='' or video_authorized),
 duration_seconds integer check(duration_seconds between 1 and 86400),exercise_ids uuid[] not null default '{}' check(cardinality(exercise_ids)<=20 and array_position(exercise_ids,null) is null),
 skills text[] not null default '{}' check(private.valid_skills(skills)),notes text not null default '' check(length(notes)<=4000),markers jsonb not null default '[]' check(jsonb_typeof(markers)='array' and pg_column_size(markers)<=100000),created_at timestamptz not null default now() check(created_at<=now()+interval '5 minutes'),updated_at timestamptz not null default now()
);
create function private.validate_vod() returns trigger language plpgsql security definer set search_path='' as $$ declare m jsonb;seen uuid[]:='{}';mid uuid;sec integer;begin
 if auth.uid() is null or new.user_id is distinct from auth.uid() then raise exception 'Authentication required';end if;
 if tg_op='INSERT' then
 perform 1 from public.profiles where id=new.user_id for update;
 if (select count(*) from public.vod_reviews where user_id=new.user_id and created_at>=date_trunc('day',now()))>=60 then raise exception 'Clutchfolio: limite diário de 60 revisões atingido';end if;new.created_at:=now();
 end if;
 if jsonb_array_length(new.markers)>80 or cardinality(new.exercise_ids)<>(select count(distinct x) from unnest(new.exercise_ids) x) or exists(select 1 from unnest(new.exercise_ids) x where not exists(select 1 from public.exercises e where e.id=x and e.published)) then raise exception 'Invalid VOD references';end if;
 if new.tournament_id is not null and not exists(select 1 from public.tournaments where id=new.tournament_id and published) then raise exception 'Tournament unavailable';end if;
 for m in select * from jsonb_array_elements(new.markers) loop
 if jsonb_typeof(m) is distinct from 'object' or jsonb_typeof(m->'seconds') is distinct from 'number' or (m->>'seconds')!~'^[0-9]{1,5}$' or jsonb_typeof(m->'id') is distinct from 'string' or jsonb_typeof(m->'note') is distinct from 'string' or length(btrim(m->>'note')) not between 1 and 1000 or jsonb_typeof(m->'category') is distinct from 'string' or (m->>'category') not in ('off_spawn','fight_selection','positioning','rotations','resources','endgame','mechanics','decisions') or jsonb_typeof(m->'kind') is distinct from 'string' or (m->>'kind') not in ('mistake','good','question') or jsonb_typeof(m->'skills') is distinct from 'array' then raise exception 'Invalid marker';end if;
 mid:=(m->>'id')::uuid;sec:=(m->>'seconds')::integer;
 if mid=any(seen) or sec>86400 or (new.duration_seconds is not null and sec>new.duration_seconds) or not private.valid_skills(array(select jsonb_array_elements_text(m->'skills'))) then raise exception 'Invalid marker conditions';end if;
 seen:=array_append(seen,mid);
 end loop;
 if tg_op='UPDATE' then if new.user_id<>old.user_id or new.id<>old.id or new.created_at<>old.created_at then raise exception 'Immutable VOD identity';end if;end if;
 new.updated_at:=now();return new;end;$$;
create trigger vod_validation before insert or update on public.vod_reviews for each row execute function private.validate_vod();
create table public.training_readiness(id uuid primary key,user_id uuid not null references public.profiles(id) on delete cascade,energy integer check(energy between 1 and 5),focus integer check(focus between 1 and 5),available_minutes integer not null check(available_minutes between 1 and 240),style text not null check(style in ('light','habitual')),created_at timestamptz not null default now() check(created_at<=now()+interval '5 minutes'),foreign key(id,user_id) references public.training_sessions(id,user_id) on delete cascade);
do $$ declare t text;begin foreach t in array array['vod_reviews','training_readiness'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_access on public.%I for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid())',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;end;$$;
create index vod_owner_date on public.vod_reviews(user_id,match_date desc);
-- Do not send VOD notes, marker text, readiness or goal revision history to external providers.

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
 result:=result||jsonb_build_object('sessions',records,'total',(select count(*) from public.training_sessions where user_id=u and status='completed' and completed_at>=start_at and completed_at<=now()),'goals',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from (select title,completed,status from public.personal_goals where user_id=u order by id limit 20) g),'journals',(select coalesce(jsonb_agg(to_jsonb(j)),'[]') from (select session_id,difficulties,left(next_focus,300) next_focus,left(difficult,300) difficult from public.training_journals where user_id=u and session_id in (select (x->>'id')::uuid from jsonb_array_elements(records) x) limit 200) j));

 result:=result||jsonb_build_object('focus',jsonb_build_object('primary_skill',(select primary_skill from public.planning_preferences where user_id=u),'secondary_skills',coalesce((select to_jsonb(secondary_skills) from public.planning_preferences where user_id=u),'[]'),'assessments',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select distinct on (skill) skill,goal,assessment,created_at from public.skill_reviews where user_id=u and created_at<=now() order by skill,created_at desc limit 13) a)),'vod_summary',jsonb_build_object('reviews',(select count(*) from public.vod_reviews where user_id=u and match_date between today-p_days+1 and today),'mistakes',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from (select x->>'category' category,count(distinct v.id) count from public.vod_reviews v cross join lateral jsonb_array_elements(v.markers) x where v.user_id=u and v.match_date between today-p_days+1 and today and x->>'kind'='mistake' group by x->>'category') m)));
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
