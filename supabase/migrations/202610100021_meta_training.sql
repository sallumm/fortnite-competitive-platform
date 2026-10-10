alter table public.training_plans add column practice_format text check(practice_format in ('solo','duo','trio','squad','unspecified'));
-- Context is derived from append-only editorial records. No historical rows are backfilled.
alter table public.training_plans add column meta_context_id text references public.meta_contexts(id),add column meta_entry_ids text[] not null default '{}',add column game_context jsonb;
alter table public.vod_reviews add column meta_context_id text references public.meta_contexts(id),add column meta_entry_ids text[] not null default '{}',add column game_context jsonb;
create function private.game_context(p_context text,p_entries text[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.meta_contexts;v public.meta_versions;e public.meta_entries;records jsonb:='[]';eid text;
begin
 if p_context is null then if cardinality(p_entries)>0 then raise exception 'Context required';end if;return null;end if;
 select * into c from public.meta_contexts where id=p_context;if not found then raise exception 'Invalid context';end if;
 select * into v from public.meta_versions where id=c.version_id;
 if p_entries is null or cardinality(p_entries)>12 or cardinality(p_entries)<>(select count(distinct x) from unnest(p_entries) x) then raise exception 'Invalid context references';end if;
 foreach eid in array p_entries loop
  select * into e from public.meta_entries where id=eid and context_id=c.id and state='confirmed' and verified_at<=now() and valid_from<=now() and review_due>now();
  if not found or exists(select 1 from public.meta_entries n where n.context_id=c.id and n.subject_key=e.subject_key and n.revision>e.revision and n.valid_from<=now()) or exists(select 1 from unnest(e.source_ids) s left join public.meta_sources ms on ms.id=s where ms.id is null or ms.access in ('unavailable','metadata') or ms.verified_at>now()) then raise exception 'Meta requires verification or changed revision';end if;
  records:=records||jsonb_build_array(jsonb_build_object('id',e.id,'subject_key',e.subject_key,'revision',e.revision,'verified_at',e.verified_at,'review_due',e.review_due,'source_ids',e.source_ids));
 end loop;
 return jsonb_build_object('context_id',c.id,'version_id',c.version_id,'mode_id',c.mode_id,'format_id',c.format_id,'play_context',c.play_context,'region',c.region,'season',v.season,'patch',v.patch,'entries',records);
end;$$;
create function private.bind_game_context() returns trigger language plpgsql security definer set search_path='' as $$
declare construction boolean;st jsonb;begin
 if tg_op='INSERT' or new.meta_context_id is distinct from old.meta_context_id or new.meta_entry_ids is distinct from old.meta_entry_ids then
  new.game_context:=private.game_context(new.meta_context_id,new.meta_entry_ids);
 elsif new.game_context is distinct from old.game_context then raise exception 'Context snapshot is server-derived';end if;
 if tg_table_name='training_plans' and new.meta_context_id is not null then
  select m.construction into construction from public.meta_contexts c join public.meta_modes m on m.id=c.mode_id where c.id=new.meta_context_id;
  if to_jsonb(new)->>'mode' not in ('both',case when construction then 'build' else 'zero' end) then raise exception 'Incompatible meta mode';end if;
  for st in select value from jsonb_array_elements(new.steps) loop
   if st ? 'custom' then
    if st->'custom'->>'mode' not in ('both',case when construction then 'build' else 'zero' end) then raise exception 'Incompatible contextual custom exercise';end if;
   elsif exists(select 1 from public.exercises e where e.id=(st->>'exercise_id')::uuid and e.mode not in ('both',case when construction then 'build' else 'zero' end)) then raise exception 'Incompatible contextual exercise';end if;
  end loop;
 end if;return new;
end;$$;
create trigger bind_meta_context before insert or update on public.training_plans for each row execute function private.bind_game_context();
create trigger bind_meta_context before insert or update on public.vod_reviews for each row execute function private.bind_game_context();
create function private.snapshot_session_context() returns trigger language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;format text;begin
 if tg_op='INSERT' then
  select game_context,practice_format into snapshot,format from public.training_plans where id=new.plan_id and user_id=new.user_id;
  new.plan_snapshot:=coalesce(new.plan_snapshot,'{}'::jsonb)||jsonb_build_object('game_context',snapshot,'practice_format',format);
 elsif (new.plan_snapshot->'game_context') is distinct from (old.plan_snapshot->'game_context') or (new.plan_snapshot->'practice_format') is distinct from (old.plan_snapshot->'practice_format') then raise exception 'Historical game context is immutable';end if;return new;
end;$$;
create trigger snapshot_meta_context before insert or update on public.training_sessions for each row execute function private.snapshot_session_context();
create table public.meta_plan_approvals(id uuid primary key references public.evolution_batches(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,payload jsonb not null);
alter table public.meta_plan_approvals enable row level security;
grant select on public.meta_plan_approvals to authenticated;
create policy own_meta_approvals on public.meta_plan_approvals for select to authenticated using(user_id=(select auth.uid()));
-- Wrap the existing atomic calendar approval rather than duplicating scheduling rules.
create function public.confirm_meta_evolution_plan(p_token uuid,p_from date,p_weeks int,p_config jsonb,p_sessions jsonb,p_rules text,p_context text,p_entries text[],p_practice_format text default 'unspecified') returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;old public.meta_plan_approvals;result jsonb;row jsonb;snapshot jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 lock table public.scheduled_sessions,public.activity_series,public.calendar_exceptions in share row exclusive mode;
 perform 1 from public.profiles where id=auth.uid() for update;
 payload:=jsonb_build_object('from',p_from,'weeks',p_weeks,'config',p_config,'sessions',p_sessions,'rules',p_rules,'context',p_context,'entries',p_entries,'practice_format',p_practice_format);
 select * into old from public.meta_plan_approvals where id=p_token;
 if found then if old.user_id<>auth.uid() or old.payload<>payload then raise exception 'Approval token already used';end if;return (select b.result from public.evolution_batches b where b.id=p_token and b.user_id=auth.uid());end if;
 if exists(select 1 from public.evolution_batches where id=p_token) then raise exception 'Approval token already used';end if;
 if p_practice_format is null or p_practice_format not in ('solo','duo','trio','squad','unspecified') then raise exception 'Invalid practice format';end if;
 snapshot:=private.game_context(p_context,p_entries);
 result:=public.confirm_evolution_plan(p_token,p_from,p_weeks,p_config,p_sessions,p_rules);
 for row in select value from jsonb_array_elements(result) loop
  update public.training_plans set meta_context_id=p_context,meta_entry_ids=p_entries,practice_format=p_practice_format where id=(row->>'plan_id')::uuid and user_id=auth.uid();
 end loop;
 insert into public.meta_plan_approvals values(p_token,auth.uid(),payload);return result;
end;$$;
-- Private location notes refer to the original revision; edits do not rewrite editorial history.
create table public.meta_study_notes(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,entry_id text not null references public.meta_entries(id),favorite boolean not null default false,note text not null default '' check(length(note)<=4000),updated_at timestamptz not null default now(),unique(user_id,entry_id));
alter table public.meta_study_notes enable row level security;
grant select,insert,update,delete on public.meta_study_notes to authenticated;
create policy own_meta_notes on public.meta_study_notes for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
-- Extend existing region/reminder preferences without overwriting old values.
alter table public.competitive_preferences add column primary_mode text references public.meta_modes(id),add column secondary_modes text[] not null default '{}',add column format text references public.meta_formats(id),add column meta_context_id text references public.meta_contexts(id),add column team_preference text not null default 'mixed' check(team_preference in ('individual','team','mixed')),add column updated_at timestamptz not null default now();
create function private.validate_competitive_preferences() returns trigger language plpgsql set search_path='' as $$begin
 if cardinality(new.secondary_modes)>8 or cardinality(new.secondary_modes)<>(select count(distinct x) from unnest(new.secondary_modes)x) or exists(select 1 from unnest(new.secondary_modes)x where not exists(select 1 from public.meta_modes m where m.id=x)) or (new.meta_context_id is not null and not exists(select 1 from public.meta_contexts c where c.id=new.meta_context_id and c.mode_id=new.primary_mode)) then raise exception 'Invalid competitive preferences';end if;new.updated_at:=now();return new;end;$$;
create trigger validate_competitive_preferences before insert or update on public.competitive_preferences for each row execute function private.validate_competitive_preferences();
-- Coach reads only bounded public references, never any team's or another player's data.
create function public.coach_meta_context(p_context text,p_query text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_context is null or length(p_query)>2000 then raise exception 'Invalid meta query';end if;
 if exists(select 1 from public.meta_contexts c join public.meta_versions v on v.id=c.version_id join public.meta_contexts n on n.mode_id=c.mode_id join public.meta_versions nv on nv.id=n.version_id where c.id=p_context and nv.released_on>v.released_on and nv.released_on<=current_date) then return '[]'::jsonb;end if;
 return coalesce((select jsonb_agg(row) from (
 select jsonb_build_object('id',e.id,'title',e.title,'body',left(e.body,1500),'limitations',e.limitations,'sources',(select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'url',s.url,'verified_at',s.verified_at)) from public.meta_sources s where s.id=any(e.source_ids))) row
 from public.meta_entries e where e.context_id=p_context and e.state='confirmed' and e.verified_at<=now() and e.valid_from<=now() and e.review_due>now() and not exists(select 1 from public.meta_entries n where n.context_id=e.context_id and n.subject_key=e.subject_key and n.revision>e.revision and n.valid_from<=now()) and not exists(select 1 from unnest(e.source_ids)x left join public.meta_sources s on s.id=x where s.id is null or s.access in ('unavailable','metadata') or s.verified_at>now())
 order by (select count(*) from regexp_split_to_table(lower(left(p_query,300)),'[^[:alnum:]]+') t where length(t)>=4 and lower(e.title||' '||e.body) like '%'||t||'%') desc,e.id limit 4
 ) rows),'[]'::jsonb);
end;$$;
revoke all on function private.game_context(text,text[]),private.bind_game_context(),private.snapshot_session_context(),private.validate_competitive_preferences() from public,anon,authenticated;
revoke all on function public.confirm_meta_evolution_plan(uuid,date,int,jsonb,jsonb,text,text,text[],text),public.coach_meta_context(text,text) from public,anon;
grant execute on function public.confirm_meta_evolution_plan(uuid,date,int,jsonb,jsonb,text,text,text[],text),public.coach_meta_context(text,text) to authenticated;

-- Preserve private consent and bounded projection; separate report comparisons by game context.
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
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into records from (select id,plan_snapshot->'game_context' game_context,plan_snapshot->>'practice_format' practice_format,completed_at,duration_seconds,(select coalesce(jsonb_agg(jsonb_build_object('id',x->'id','exercise_id',x->'exercise_id','exercise',jsonb_build_object('category',x->'exercise'->'category','metric',x->'exercise'->'metric','title',x->'exercise'->'title','published',x->'exercise'->'published'))),'[]') from jsonb_array_elements(steps) x) steps,(select coalesce(jsonb_agg(jsonb_build_object('exercise_id',x->'exercise_id','value',x->'value','configuration',x->'configuration','step_id',x->'step_id','status',x->'status','unit',x->'unit','version',x->'version','conditions',x->'conditions')),'[]') from jsonb_array_elements(results) x) results from public.training_sessions where user_id=u and status='completed' and completed_at>=start_at and completed_at<=now() order by completed_at desc limit 200) t;
 result:=result||jsonb_build_object('sessions',records,'total',(select count(*) from public.training_sessions where user_id=u and status='completed' and completed_at>=start_at and completed_at<=now()),'goals',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from (select title,completed,status from public.personal_goals where user_id=u order by id limit 20) g),'journals',(select coalesce(jsonb_agg(to_jsonb(j)),'[]') from (select session_id,difficulties,left(next_focus,300) next_focus,left(difficult,300) difficult from public.training_journals where user_id=u and session_id in (select (x->>'id')::uuid from jsonb_array_elements(records) x) limit 200) j));

 result:=result||jsonb_build_object('focus',jsonb_build_object('primary_skill',(select primary_skill from public.planning_preferences where user_id=u),'secondary_skills',coalesce((select to_jsonb(secondary_skills) from public.planning_preferences where user_id=u),'[]'),'assessments',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select distinct on (skill) skill,goal,assessment,created_at from public.skill_reviews where user_id=u and created_at<=now() order by skill,created_at desc limit 13) a)),'vod_summary',jsonb_build_object('reviews',(select count(*) from public.vod_reviews where user_id=u and match_date between today-p_days+1 and today),'mistakes',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from (select (x->>'category')||' · '||coalesce(v.game_context->>'version_id','sem versão')||' · '||coalesce(v.game_context->>'mode_id','sem modalidade')||' · '||coalesce(v.game_context->>'format_id','sem formato') category,count(distinct v.id) count from public.vod_reviews v cross join lateral jsonb_array_elements(v.markers) x where v.user_id=u and v.match_date between today-p_days+1 and today and x->>'kind'='mistake' group by x->>'category',v.game_context->>'version_id',v.game_context->>'mode_id',v.game_context->>'format_id') m)));
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
-- Minimal opt-in profile projection, independent of private teammate information.
create function public.coach_competitive_profile() returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if not coalesce((select context_enabled from public.coach_preferences where id=auth.uid()),false) then return null;end if;
 return (select jsonb_build_object('mode',m.title,'format',f.title,'context_id',p.meta_context_id,'team_preference',p.team_preference) from public.competitive_preferences p left join public.meta_modes m on m.id=p.primary_mode left join public.meta_formats f on f.id=p.format where p.id=auth.uid());
end;$$;
revoke all on function public.coach_competitive_profile() from public,anon;
grant execute on function public.coach_competitive_profile() to authenticated;

-- A shared row lock keeps exercise and context snapshots from different concurrent edits from mixing.
create or replace function public.start_training(p_plan uuid) returns public.training_sessions language plpgsql security definer set search_path='' as $$
 declare plan public.training_plans; session public.training_sessions; snapshot jsonb;
 begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into plan from public.training_plans where id=p_plan and user_id=auth.uid() for share;
 if not found then raise exception 'Plan unavailable'; end if;
 if exists(select 1 from public.training_sessions where user_id=auth.uid() and status='active') then raise exception 'Active session exists'; end if;
 if (select count(*) from public.training_sessions where user_id=auth.uid() and started_at>=now()-interval '1 day')>=60 then raise exception 'Daily operation limit'; end if;
 select jsonb_agg(step.value || jsonb_build_object('exercise',coalesce(step.value->'custom',to_jsonb(e))) order by step.ordinality) into snapshot from jsonb_array_elements(plan.steps) with ordinality as step(value,ordinality) left join public.exercises e on e.id=(step.value->>'exercise_id')::uuid and e.published;
 if exists(select 1 from jsonb_array_elements(snapshot) s where s->'exercise'='null'::jsonb) then raise exception 'Exercise unavailable'; end if;
 insert into public.training_sessions(user_id,plan_id,title,steps,plan_snapshot) values(auth.uid(),plan.id,plan.title,snapshot,jsonb_build_object('title',plan.title,'objective',plan.objective,'description',plan.description,'mode',plan.mode,'level',plan.level,'game_context',plan.game_context,'practice_format',plan.practice_format)) returning * into session;return session;
 end; $$;
