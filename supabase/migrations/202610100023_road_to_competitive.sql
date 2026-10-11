-- Additive learning cycles reuse Academy records, Skill Maxing and the real calendar/player.
create table public.road_programs(id text primary key,version text not null,mode text not null check(mode in ('build','zero')),definition jsonb not null);
alter table public.road_programs enable row level security;
create policy public_road_programs on public.road_programs for select to anon,authenticated using(true);
grant select on public.road_programs to anon,authenticated;
-- These versioned editorial definitions are reviewed in code; no client can publish or overwrite them.
create table public.learning_journeys(
 id uuid primary key,user_id uuid not null references public.profiles(id) on delete cascade,
 program_id text not null references public.road_programs(id),version text not null,
 config jsonb not null,experience text not null check(experience in ('first','some','regular')),
 familiarity text not null default '' check(length(familiarity)<=1000),start_date date not null,
 status text not null default 'active' check(status in ('active','paused','completed')),
 snapshot jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index one_open_journey on public.learning_journeys(user_id) where status<>'completed';
alter table public.training_plans add column learning_journey_id uuid references public.learning_journeys(id) on delete set null;
alter table public.training_sessions add column learning_journey_id uuid references public.learning_journeys(id) on delete set null;
create function private.bind_learning_session() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.learning_journey_id:=(select p.learning_journey_id from public.training_plans p where p.id=new.plan_id and p.user_id=new.user_id);
 elsif new.learning_journey_id is distinct from old.learning_journey_id and (new.learning_journey_id is not null or exists(select 1 from public.learning_journeys where id=old.learning_journey_id)) then raise exception 'Learning session context is immutable';end if;
 return new;
end;$$;
create trigger learning_session_binding before insert or update on public.training_sessions for each row execute function private.bind_learning_session();
revoke all on function private.bind_learning_session() from public,anon,authenticated;
create function private.bind_learning_plan() returns trigger language plpgsql set search_path='' as $$
begin
 if new.learning_journey_id is not null and not exists(select 1 from public.learning_journeys j where j.id=new.learning_journey_id and j.user_id=new.user_id) then raise exception 'Private journey owner mismatch';end if;return new;
end;$$;
create trigger learning_plan_binding before insert or update on public.training_plans for each row execute function private.bind_learning_plan();
revoke all on function private.bind_learning_plan() from public,anon,authenticated;
create table public.learning_journey_events(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 journey_id uuid not null references public.learning_journeys(id) on delete cascade,
 action text not null check(action in ('started','completed','reviewed','assessment','skipped','pause','resume','finish','preferences')),
 lesson_id uuid,study_record_id uuid references public.academy_records(id) on delete set null,
 note text not null default '' check(length(note)<=1000),answers jsonb not null default '[]',created_at timestamptz not null default now()
);
create table public.learning_journey_batches(
 id uuid primary key references public.evolution_batches(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,
 journey_id uuid not null references public.learning_journeys(id) on delete cascade,stage integer not null check(stage between 1 and 4),
 result jsonb not null,created_at timestamptz not null default now()
);
alter table public.learning_journeys enable row level security;
alter table public.learning_journey_events enable row level security;
alter table public.learning_journey_batches enable row level security;
create policy own_journeys on public.learning_journeys for select to authenticated using(user_id=(select auth.uid()));
create policy own_journey_events on public.learning_journey_events for select to authenticated using(user_id=(select auth.uid()));
create policy own_journey_batches on public.learning_journey_batches for select to authenticated using(user_id=(select auth.uid()));
grant select on public.learning_journeys,public.learning_journey_events,public.learning_journey_batches to authenticated;
create index journey_events_owner on public.learning_journey_events(user_id,created_at,id);
create index journey_batches_owner on public.learning_journey_batches(user_id,created_at,id);
create function public.create_learning_journey(p_token uuid,p_setup jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();p public.road_programs;m jsonb;s jsonb;a public.articles;lessons jsonb:='[]';old public.learning_journeys;d date;
begin
 if u is null or p_token is null then raise exception 'Authentication required';end if;
 perform 1 from public.profiles where id=u for update;
 if p_setup is null or jsonb_typeof(p_setup)<>'object' or exists(select 1 from jsonb_object_keys(p_setup) k where k not in ('config','experience','familiarity','start_date')) then raise exception 'Invalid setup';end if;
 perform private.validate_evolution_config(p_setup->'config');
 if coalesce(p_setup->>'experience','') not in ('first','some','regular') or jsonb_typeof(p_setup->'familiarity') is distinct from 'string' or length(p_setup->>'familiarity')>1000 or coalesce(p_setup->>'start_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid starting point';end if;
 d:=(p_setup->>'start_date')::date;
 select * into old from public.learning_journeys where id=p_token;
 if found then
  if old.user_id<>u or old.config<>p_setup->'config' or old.experience<>p_setup->>'experience' or old.familiarity<>p_setup->>'familiarity' or old.start_date<>d then raise exception 'Token already used';end if;return old.id;
 end if;
 if d<(now() at time zone (p_setup->'config'->>'timezone'))::date-1 or d>(now() at time zone (p_setup->'config'->>'timezone'))::date+366 then raise exception 'Invalid start date';end if;
 if exists(select 1 from public.learning_journeys where user_id=u and status<>'completed') then raise exception 'An open journey already exists';end if;
 if (select count(*) from public.learning_journeys where user_id=u and created_at>now()-interval '1 day')>=5 then raise exception 'Journey limit';end if;
 select * into p from public.road_programs where mode=p_setup->'config'->>'mode';
 if not found then raise exception 'Unavailable program';end if;
 for m in select value from jsonb_array_elements(p.definition->'modules') loop
  for s in select value from jsonb_array_elements(m->'slugs') loop
   select * into a from public.articles where slug=s#>>'{}' and kind='lesson' and published and published_at<=now() and curriculum is not null and curriculum->'modes' ? p.mode for share;
   if not found then raise exception 'Unavailable lesson';end if;
   lessons:=lessons||jsonb_build_array(jsonb_build_object('stage',(m->>'stage')::int,'article',to_jsonb(a)));
  end loop;
 end loop;
 insert into public.learning_journeys(id,user_id,program_id,version,config,experience,familiarity,start_date,snapshot)
 values(p_token,u,p.id,p.version,p_setup->'config',p_setup->>'experience',p_setup->>'familiarity',d,jsonb_build_object('program',p.definition,'lessons',lessons));
 return p_token;
end;$$;
create function public.update_learning_journey(p_journey uuid,p_config jsonb,p_note text default '') returns void language plpgsql security definer set search_path='' as $$
declare j public.learning_journeys;
begin
 select * into j from public.learning_journeys where id=p_journey and user_id=auth.uid() for update;
 if not found or j.status='completed' then raise exception 'Unavailable journey';end if;
 perform private.validate_evolution_config(p_config);
 if p_config->>'mode' is distinct from j.config->>'mode' or p_note is null or length(p_note)>1000 then raise exception 'Start another cycle to change modality';end if;
 if (select count(*) from public.learning_journey_events where user_id=auth.uid() and created_at>now()-interval '1 hour')>=120 then raise exception 'Journey limit';end if;
 update public.learning_journeys set config=p_config,updated_at=now() where id=j.id;
 insert into public.learning_journey_events(user_id,journey_id,action,note) values(auth.uid(),j.id,'preferences',p_note);
end;$$;
create function public.record_learning_journey(p_journey uuid,p_action text,p_lesson uuid default null,p_answers jsonb default '[]',p_note text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare j public.learning_journeys;a jsonb;q jsonb;v jsonb;i int:=0;rid uuid;eid uuid;
begin
 select * into j from public.learning_journeys where id=p_journey and user_id=auth.uid() for update;
 if not found or p_action is null or p_action not in ('started','completed','reviewed','assessment','skipped','pause','resume','finish') then raise exception 'Unavailable journey or action';end if;
 if p_note is null or length(p_note)>1000 or p_answers is null or jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)>12 then raise exception 'Invalid record';end if;
 if (select count(*) from public.learning_journey_events where user_id=auth.uid() and created_at>now()-interval '1 hour')>=120 then raise exception 'Journey limit';end if;
 if p_action in ('pause','resume','finish') then
  if p_lesson is not null or p_answers<>'[]'::jsonb or j.status='completed' or (p_action='pause' and j.status<>'active') or (p_action='resume' and j.status<>'paused') then raise exception 'Invalid status transition';end if;
  update public.learning_journeys set status=case p_action when 'pause' then 'paused' when 'resume' then 'active' else 'completed' end,updated_at=now() where id=j.id;
 else
  if j.status<>'active' then raise exception 'Resume the journey first';end if;
  select l->'article' into a from jsonb_array_elements(j.snapshot->'lessons') l where l->'article'->>'id'=p_lesson::text;
  if a is null then raise exception 'Lesson outside journey';end if;
  if p_action='assessment' then
   if jsonb_array_length(a->'academy_questions')=0 or jsonb_array_length(p_answers)<>jsonb_array_length(a->'academy_questions') then raise exception 'Complete assessment required';end if;
   for q in select value from jsonb_array_elements(a->'academy_questions') loop
    v:=p_answers->i;
    if jsonb_typeof(v) is distinct from 'number' or v#>>'{}' !~ '^[0-4]$' or (v#>>'{}')::int>=jsonb_array_length(q->'options') then raise exception 'Invalid answer';end if;i:=i+1;
   end loop;
  elsif p_answers<>'[]'::jsonb then raise exception 'Unexpected answers';end if;
  if p_action<>'skipped' then
   -- Same private Academy ledger and quota; snapshot comes from the immutable enrolled curriculum.
   perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,17017));
   if (select count(*) from public.academy_records where user_id=auth.uid() and created_at>now()-interval '1 hour')>=120 then raise exception 'Study limit';end if;
   insert into public.academy_records(user_id,lesson_id,action,snapshot,answers)
   values(auth.uid(),p_lesson,p_action,jsonb_build_object('title',a->>'title','slug',a->>'slug','version',a->'curriculum'->>'version','questions',a->'academy_questions','body',a->>'body','curriculum',a->'curriculum','verified_at',a->>'verified_at'),p_answers) returning id into rid;
  end if;
 end if;
 insert into public.learning_journey_events(user_id,journey_id,action,lesson_id,study_record_id,note,answers) values(auth.uid(),j.id,p_action,p_lesson,rid,p_note,p_answers) returning id into eid;
 return eid;
end;$$;
create function public.confirm_learning_plan(p_journey uuid,p_stage integer,p_token uuid,p_from date,p_config jsonb,p_sessions jsonb,p_rules text,p_confirmation text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.learning_journeys;b public.learning_journey_batches;r jsonb;k text;
begin
 if auth.uid() is null or p_confirmation is distinct from 'AGENDAR' or p_stage is null or p_stage not between 1 and 4 then raise exception 'Explicit confirmation required';end if;
 -- Keep the existing calendar -> profile -> learning-row lock order.
 lock table public.scheduled_sessions,public.activity_series,public.calendar_exceptions in share row exclusive mode;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into j from public.learning_journeys where id=p_journey and user_id=auth.uid() for update;
 if not found then raise exception 'Unavailable journey';end if;
 select * into b from public.learning_journey_batches where id=p_token;
 if found then
  if b.user_id<>auth.uid() or b.journey_id<>j.id or b.stage<>p_stage then raise exception 'Token already used';end if;
  return public.confirm_meta_evolution_plan(p_token,p_from,1,p_config,p_sessions,p_rules,null,'{}'::text[],'solo');
 end if;
 if j.status<>'active' then raise exception 'Resume journey first';end if;
 foreach k in array array['mode','level','input','timezone','windows','blocked'] loop
  if p_config->k is distinct from j.config->k then raise exception 'Availability changed: recreate preview';end if;
 end loop;
 if p_config->>'mode' is distinct from j.config->>'mode' then raise exception 'Incompatible modality';end if;
 r:=public.confirm_meta_evolution_plan(p_token,p_from,1,p_config,p_sessions,p_rules,null,'{}'::text[],'solo');
 update public.training_plans set learning_journey_id=j.id where user_id=auth.uid() and id in (select (x->>'plan_id')::uuid from jsonb_array_elements(r) x);
 insert into public.learning_journey_batches(id,user_id,journey_id,stage,result) values(p_token,auth.uid(),j.id,p_stage,r);
 return r;
end;$$;
create function public.delete_learning_journey(p_journey uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_confirmation is distinct from 'EXCLUIR JORNADA' then raise exception 'Explicit confirmation required';end if;
 delete from public.learning_journeys where id=p_journey and user_id=auth.uid();
 -- Training/calendar/Academy records are separately managed and never cascaded from a learning cycle.
end;$$;
revoke all on function public.create_learning_journey(uuid,jsonb),public.update_learning_journey(uuid,jsonb,text),public.record_learning_journey(uuid,text,uuid,jsonb,text),public.confirm_learning_plan(uuid,integer,uuid,date,jsonb,jsonb,text,text),public.delete_learning_journey(uuid,text) from public,anon;
grant execute on function public.create_learning_journey(uuid,jsonb),public.update_learning_journey(uuid,jsonb,text),public.record_learning_journey(uuid,text,uuid,jsonb,text),public.confirm_learning_plan(uuid,integer,uuid,date,jsonb,jsonb,text,text),public.delete_learning_journey(uuid,text) to authenticated;

insert into public.road_programs values('road-build','road-2026-10-10.1','build','{"id": "road-build", "version": "road-2026-10-10.1", "mode": "build", "sources": [{"title": "Epic: apresentação de Construção Zero (histórico, 2022)", "url": "https://www.fortnite.com/news/fortnite-zero-build-take-the-offensive-in-this-no-build-battle-royale?lang=pt-BR", "kind": "official", "access": "page", "limitation": "Apresentação histórica da modalidade, não confirma itens ou regras da temporada atual."}, {"title": "Trumble et al., revisão sistemática de prática distribuída e recuperação", "url": "https://pubmed.ncbi.nlm.nih.gov/37615780/", "kind": "scientific", "access": "abstract", "limitation": "Educação em saúde; não valida prática motora nem um programa de 30 dias para Fortnite."}, {"title": "Prática concentrada e aprendizagem de habilidades motoras seriais", "url": "https://pubmed.ncbi.nlm.nih.gov/40778584/", "kind": "scientific", "access": "abstract", "limitation": "Tarefa motora específica; ressalta que espaçamento ideal depende da tarefa, sem prescrição universal."}], "modules": [{"stage": 1, "title": "Fundamentos", "objective": "Entender os controles e experimentar uma habilidade por vez.", "slugs": ["primeira-partida", "controles-interface", "inventario-tempestade", "mira-movimento", "materiais-mats", "pecas-edicao"], "review": "Antes de reler, explique uma decisão com suas próprias palavras. Compare com a aula e registre uma dúvida.", "completion": "Marque somente o estudo realmente feito. Uma prática só conta quando você a conclui manualmente no player.", "next": "Use os registros desta etapa para escolher uma habilidade para revisar; avance ou repita quando preferir."}, {"stage": 2, "title": "Controle e aplicação", "objective": "Combinar proteção, mira e uma decisão simples em situações controladas.", "slugs": ["peeks-trocas", "piece-box-realistic"], "review": "Antes de reler, explique uma decisão com suas próprias palavras. Compare com a aula e registre uma dúvida.", "completion": "Marque somente o estudo realmente feito. Uma prática só conta quando você a conclui manualmente no player.", "next": "Use os registros desta etapa para escolher uma habilidade para revisar; avance ou repita quando preferir."}, {"stage": 3, "title": "Tomada de decisão", "objective": "Explicar escolhas de rota, confronto e Endgame usando informações disponíveis.", "slugs": ["early-drop", "mid-rotacoes", "endgame-camadas"], "review": "Antes de reler, explique uma decisão com suas próprias palavras. Compare com a aula e registre uma dúvida.", "completion": "Marque somente o estudo realmente feito. Uma prática só conta quando você a conclui manualmente no player.", "next": "Use os registros desta etapa para escolher uma habilidade para revisar; avance ou repita quando preferir."}, {"stage": 4, "title": "Integração e avaliação", "objective": "Repetir um procedimento comparável, revisar uma partida e escolher o próximo objetivo.", "slugs": ["vod-hipoteses", "ranked-scrims-torneios"], "review": "Antes de reler, explique uma decisão com suas próprias palavras. Compare com a aula e registre uma dúvida.", "completion": "Marque somente o estudo realmente feito. Uma prática só conta quando você a conclui manualmente no player.", "next": "Use os registros desta etapa para escolher uma habilidade para revisar; avance ou repita quando preferir."}]}'::jsonb);

insert into public.road_programs values('road-zero','road-2026-10-10.1','zero','{"id": "road-zero", "version": "road-2026-10-10.1", "mode": "zero", "sources": [{"title": "Epic: apresentação de Construção Zero (histórico, 2022)", "url": "https://www.fortnite.com/news/fortnite-zero-build-take-the-offensive-in-this-no-build-battle-royale?lang=pt-BR", "kind": "official", "access": "page", "limitation": "Apresentação histórica da modalidade, não confirma itens ou regras da temporada atual."}, {"title": "Trumble et al., revisão sistemática de prática distribuída e recuperação", "url": "https://pubmed.ncbi.nlm.nih.gov/37615780/", "kind": "scientific", "access": "abstract", "limitation": "Educação em saúde; não valida prática motora nem um programa de 30 dias para Fortnite."}, {"title": "Prática concentrada e aprendizagem de habilidades motoras seriais", "url": "https://pubmed.ncbi.nlm.nih.gov/40778584/", "kind": "scientific", "access": "abstract", "limitation": "Tarefa motora específica; ressalta que espaçamento ideal depende da tarefa, sem prescrição universal."}], "modules": [{"stage": 1, "title": "Fundamentos", "objective": "Entender os controles e experimentar uma habilidade por vez.", "slugs": ["primeira-partida", "controles-interface", "inventario-tempestade", "mira-movimento", "zero-cobertura"], "review": "Antes de reler, explique uma decisão com suas próprias palavras. Compare com a aula e registre uma dúvida.", "completion": "Marque somente o estudo realmente feito. Uma prática só conta quando você a conclui manualmente no player.", "next": "Use os registros desta etapa para escolher uma habilidade para revisar; avance ou repita quando preferir."}, {"stage": 2, "title": "Controle e aplicação", "objective": "Combinar proteção, mira e uma decisão simples em situações controladas.", "slugs": ["peeks-trocas", "early-drop"], "review": "Antes de reler, explique uma decisão com suas próprias palavras. Compare com a aula e registre uma dúvida.", "completion": "Marque somente o estudo realmente feito. Uma prática só conta quando você a conclui manualmente no player.", "next": "Use os registros desta etapa para escolher uma habilidade para revisar; avance ou repita quando preferir."}, {"stage": 3, "title": "Tomada de decisão", "objective": "Explicar escolhas de rota, confronto e Endgame usando informações disponíveis.", "slugs": ["mid-rotacoes", "zero-endgame"], "review": "Antes de reler, explique uma decisão com suas próprias palavras. Compare com a aula e registre uma dúvida.", "completion": "Marque somente o estudo realmente feito. Uma prática só conta quando você a conclui manualmente no player.", "next": "Use os registros desta etapa para escolher uma habilidade para revisar; avance ou repita quando preferir."}, {"stage": 4, "title": "Integração e avaliação", "objective": "Repetir um procedimento comparável, revisar uma partida e escolher o próximo objetivo.", "slugs": ["vod-hipoteses", "ranked-scrims-torneios"], "review": "Antes de reler, explique uma decisão com suas próprias palavras. Compare com a aula e registre uma dúvida.", "completion": "Marque somente o estudo realmente feito. Uma prática só conta quando você a conclui manualmente no player.", "next": "Use os registros desta etapa para escolher uma habilidade para revisar; avance ou repita quando preferir."}]}'::jsonb);
create function public.coach_learning_journey(p_journey uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.learning_journeys;studied int;skipped int;assessments int;done int;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if not exists(select 1 from public.coach_preferences where id=auth.uid() and context_enabled) then return null;end if;
 select * into j from public.learning_journeys where id=p_journey and user_id=auth.uid();
 if not found then return null;end if;
 select count(distinct lesson_id) into studied from public.learning_journey_events where journey_id=j.id and user_id=auth.uid() and action in ('completed','reviewed');
 select count(distinct e.lesson_id) into skipped from public.learning_journey_events e where e.journey_id=j.id and e.user_id=auth.uid() and e.action='skipped' and not exists(select 1 from public.learning_journey_events x where x.journey_id=j.id and x.lesson_id=e.lesson_id and x.action in ('completed','reviewed'));
 select count(*) into assessments from public.learning_journey_events where journey_id=j.id and user_id=auth.uid() and action='assessment';
 select count(*) into done from public.training_sessions where user_id=auth.uid() and learning_journey_id=j.id and status='completed';
 return jsonb_build_object('mode',j.config->>'mode','status',j.status,'objective',left(j.config->>'objective',200),'studied',studied,'skipped',skipped,'assessments',assessments,'completed_sessions',done);
end;$$;
revoke all on function public.coach_learning_journey(uuid) from public,anon;
grant execute on function public.coach_learning_journey(uuid) to authenticated;
