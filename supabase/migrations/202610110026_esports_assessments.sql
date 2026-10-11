-- Private assessment bank and frozen server-selected attempts. No surveillance.
create table private.esports_questions (
 id uuid primary key default gen_random_uuid(), version integer not null default 1,
 category text not null check(length(category) between 2 and 80),difficulty text not null check(difficulty in('foundation','intermediate','advanced')),
 kind text not null check(kind in('objective','discursive')), prompt text not null check(length(prompt) between 10 and 4000),
 options jsonb not null default '[]', correct integer, explanation text not null check(length(explanation) between 10 and 8000),
 references_list jsonb not null check(jsonb_typeof(references_list)='array' and jsonb_array_length(references_list) between 1 and 10),
 weight numeric not null check(weight>0 and weight<=100), published boolean not null default false, reviewed_at timestamptz not null,
 check(jsonb_typeof(options)='array'),check((kind='objective' and jsonb_array_length(options) between 2 and 8 and correct is not null and correct>=0 and correct<jsonb_array_length(options)) or (kind='discursive' and correct is null and options='[]'))
);
create table private.esports_exams (
 id uuid primary key default gen_random_uuid(), version integer not null default 1,
 title text not null check(length(title) between 3 and 120),instructions text not null check(length(instructions) between 10 and 8000),
 rules text not null check(length(rules) between 10 and 8000), blueprint jsonb not null check(jsonb_typeof(blueprint)='array' and jsonb_array_length(blueprint) between 1 and 20),
 minutes integer not null check(minutes between 5 and 180), max_attempts integer not null check(max_attempts between 1 and 5),
 published boolean not null default false
);
create table private.esports_exam_assignments (
 application_id uuid not null references public.esports_applications(id) on delete cascade,
 exam_id uuid not null references private.esports_exams(id),available_until timestamptz not null,
 extra_attempts integer not null default 0 check(extra_attempts between 0 and 5), revoked_at timestamptz,
 primary key(application_id,exam_id)
);
create table private.esports_attempts (
 id uuid primary key default gen_random_uuid(),application_id uuid not null references public.esports_applications(id) on delete cascade,
 exam_id uuid not null references private.esports_exams(id), user_id uuid not null references public.profiles(id) on delete cascade,
 number integer not null,version integer not null default 1,seed uuid not null,exam_snapshot jsonb not null,questions jsonb not null,
 answers jsonb not null default '{}',status text not null default 'active' check(status in('active','submitted','graded')),
 started_at timestamptz not null default now(),deadline timestamptz not null,submitted_at timestamptz,
 objective_points numeric not null default 0,objective_max numeric not null default 0,manual_grades jsonb not null default '{}',
 reviewer_id uuid references auth.users(id) on delete set null,review_note text not null default '',feedback text not null default '',released boolean not null default false,
 unique(application_id,exam_id,number)
);
create table private.esports_attempt_reviews (id uuid primary key default gen_random_uuid(),attempt_id uuid not null references private.esports_attempts(id) on delete cascade,reviewer_id uuid references auth.users(id) on delete set null,attempt_version integer not null,grades jsonb not null,review_note text not null,feedback text not null,released boolean not null,created_at timestamptz not null default now());
create index esports_attempt_owner on private.esports_attempts(user_id,started_at);
create function private.esports_participation(p_application uuid,p_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.esports_applications a where a.id=p_application and a.user_id=p_user and a.status not in('withdrawn','not_selected') and (a.payload->>'age_band'<>'adolescent' or exists(select 1 from private.esports_authorizations v cross join private.esports_launch_gate g where g.minors_reviewed and v.user_id=a.user_id and v.cycle_id=a.cycle_id and v.revoked_at is null and v.expires_at>now() and v.policy_version=a.consent_snapshot->>'policy_version')))
$$;
create function private.esports_trial(p_application uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.esports_participation(p_application) and exists(select 1 from private.esports_role_grants where user_id=auth.uid() and application_id=p_application and role='trialist' and starts_at<=now() and ends_at>now() and revoked_at is null)
$$;
create function private.esports_safe_attempt(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('server_now',now(),'id',a.id,'application_id',a.application_id,'exam_id',a.exam_id,'number',a.number,'version',a.version,'exam_snapshot',a.exam_snapshot,'answers',a.answers,'status',a.status,'started_at',a.started_at,'deadline',a.deadline,'submitted_at',a.submitted_at,
 'questions',(select jsonb_agg(q-'correct'-'explanation'-'references_list') from jsonb_array_elements(a.questions) q),
 'result',case when a.status='graded' and a.released then jsonb_build_object('objective_points',a.objective_points,'objective_max',a.objective_max,'manual_grades',a.manual_grades,'feedback',a.feedback) else null end)
 from private.esports_attempts a where id=p_id
$$;
create function private.esports_validate_answers(p_questions jsonb,p_answers jsonb) returns void language plpgsql set search_path='' as $$
 declare x record;q jsonb;
 begin
 if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>100000 then raise exception 'Invalid answers';end if;
 for x in select * from jsonb_each(p_answers) loop
 select value into q from jsonb_array_elements(p_questions) where value->>'id'=x.key;
 if not found then raise exception 'Question outside attempt';end if;
 if q->>'kind'='objective' then
 if jsonb_typeof(x.value) is distinct from 'number' or x.value::text !~ '^[0-9]+$' or x.value::text::integer<0 or x.value::text::integer>=jsonb_array_length(q->'options') then raise exception 'Invalid objective answer';end if;
 elsif jsonb_typeof(x.value) is distinct from 'string' or length(x.value#>>'{}')>8000 then raise exception 'Invalid discursive answer';end if;
 end loop;
 end;$$;
create function private.esports_finish_attempt(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare a private.esports_attempts;q jsonb;points numeric:=0;maximum numeric:=0;
 begin
 select * into a from private.esports_attempts where id=p_id for update;if a.status<>'active' then return;end if;
 for q in select value from jsonb_array_elements(a.questions) loop
 if q->>'kind'='objective' then maximum:=maximum+(q->>'weight')::numeric;
 if a.answers->>(q->>'id')=q->>'correct' then points:=points+(q->>'weight')::numeric;end if;end if;end loop;
 update private.esports_attempts set status='submitted',submitted_at=least(now(),deadline),version=version+1,objective_points=points,objective_max=maximum where id=p_id;
 perform private.esports_audit('exam_submitted',p_id,jsonb_build_object('timed_out',now()>=a.deadline));
 end;$$;
create function public.esports_trials() returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 return jsonb_build_object('assignments',coalesce((select jsonb_agg(jsonb_build_object('application_id',x.application_id,'exam_id',e.id,'title',e.title,'instructions',e.instructions,'rules',e.rules,'minutes',e.minutes,'max_attempts',e.max_attempts+x.extra_attempts,'available_until',x.available_until,'count',(select count(*) from private.esports_attempts where application_id=x.application_id and exam_id=e.id))) from private.esports_exam_assignments x join private.esports_exams e on e.id=x.exam_id where private.esports_trial(x.application_id) and x.revoked_at is null and e.published),'[]'::jsonb),
 'attempts',coalesce((select jsonb_agg(private.esports_safe_attempt(a.id) order by a.started_at desc) from private.esports_attempts a where user_id=auth.uid() and private.esports_trial(a.application_id)),'[]'::jsonb),
 'technical_notice','Registramos início, prazo, salvamentos, envio e revisões. Não monitoramos outras abas, foco, programas ou atividades privadas. Respostas ficam somente no servidor; confirme cada salvamento antes de sair.');
 end;$$;
create function public.esports_start_exam(p_application uuid,p_exam uuid,p_accepted boolean) returns jsonb language plpgsql security definer set search_path='' as $$
 declare e private.esports_exams;x private.esports_exam_assignments;a uuid;seed_value uuid:=gen_random_uuid();slot jsonb;q record;qs jsonb:='[]';n integer;selected integer;total integer:=0;
 begin
 perform 1 from public.esports_applications where id=p_application for update;
 if p_accepted is distinct from true or not private.esports_trial(p_application) then raise exception 'Active Trialist and acceptance required';end if;
 select * into x from private.esports_exam_assignments where application_id=p_application and exam_id=p_exam and revoked_at is null;
 if not found or x.available_until<=now() then raise exception 'Exam unavailable';end if;
 select * into e from private.esports_exams where id=p_exam and published;if not found then raise exception 'Exam unavailable';end if;
 select id into a from private.esports_attempts where application_id=p_application and exam_id=p_exam and status='active';if found then return private.esports_safe_attempt(a);end if;
 select count(*) into n from private.esports_attempts where application_id=p_application and exam_id=p_exam;
 if n>=e.max_attempts+x.extra_attempts then raise exception 'Attempt limit';end if;
 for slot in select value from jsonb_array_elements(e.blueprint) loop
 selected:=0;
 for q in select * from private.esports_questions where published and category=slot->>'category' and difficulty=slot->>'difficulty' order by md5(seed_value::text||id::text) limit (slot->>'count')::integer loop
 qs:=qs||jsonb_build_array(to_jsonb(q)-'published'-'reviewed_at');selected:=selected+1;end loop;
 if selected<>(slot->>'count')::integer then raise exception 'Insufficient reviewed questions';end if;total:=total+selected;
 end loop;
 if total<1 or total>40 then raise exception 'Invalid exam size';end if;
 insert into private.esports_attempts(application_id,exam_id,user_id,number,seed,exam_snapshot,questions,deadline) values(p_application,p_exam,auth.uid(),n+1,seed_value,jsonb_build_object('title',e.title,'version',e.version,'instructions',e.instructions,'rules',e.rules,'minutes',e.minutes,'blueprint',e.blueprint,'selection_algorithm','md5(seed UUID + question UUID), ascending per category/difficulty; frozen snapshot v1'),qs,least(now()+make_interval(mins=>e.minutes),x.available_until)) returning id into a;
 perform private.esports_audit('exam_started',a);return private.esports_safe_attempt(a);
 end;$$;
create function public.esports_answer_exam(p_attempt uuid,p_action text,p_expected integer,p_answers jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
 declare a private.esports_attempts;
 begin
 select * into a from private.esports_attempts where id=p_attempt for update;
 if not found or a.user_id is distinct from auth.uid() or not private.esports_trial(a.application_id) then raise exception 'Attempt unavailable';end if;
 if a.status='active' and not exists(select 1 from private.esports_exam_assignments where application_id=a.application_id and exam_id=a.exam_id and revoked_at is null) then raise exception 'Assignment revoked';end if;
 if p_action not in('save','submit','timeout') or p_action is null then raise exception 'Unknown exam action';end if;
 if a.status<>'active' then return private.esports_safe_attempt(a.id);end if;
 if now()>=a.deadline then perform private.esports_finish_attempt(a.id);return private.esports_safe_attempt(a.id);end if;
 if p_action='timeout' then raise exception 'Deadline not reached';end if;
 if a.version<>p_expected then raise exception 'Version conflict';end if;
 perform private.esports_validate_answers(a.questions,p_answers);
 if (select count(*) from private.esports_audit where actor_id=auth.uid() and action='exam_saved' and created_at>now()-interval '1 minute')>=30 then raise exception 'Save rate limit';end if;
 update private.esports_attempts set answers=p_answers,version=version+1 where id=p_attempt;
 if p_action='submit' then perform private.esports_finish_attempt(a.id);else perform private.esports_audit('exam_saved',a.id);end if;
 return private.esports_safe_attempt(a.id);
 end;$$;
create function public.esports_assessment_admin() returns jsonb language plpgsql security definer set search_path='' as $$
 declare expired record;
 begin
 if not(public.esports_is_admin() or private.esports_role('esports_staff')) or auth.uid() is null then raise exception 'Administrative role required';end if;
 for expired in select id from private.esports_attempts where status='active' and deadline<=now() and public.esports_can_review(application_id) order by deadline limit 100 loop perform private.esports_finish_attempt(expired.id);end loop;
 return jsonb_build_object('admin',public.esports_is_admin(),
 'questions',case when public.esports_is_admin() then coalesce((select jsonb_agg(to_jsonb(q)) from (select * from private.esports_questions order by category,prompt limit 500)q),'[]'::jsonb) else '[]'::jsonb end,
 'exams',case when public.esports_is_admin() then coalesce((select jsonb_agg(to_jsonb(e)) from private.esports_exams e),'[]'::jsonb) else '[]'::jsonb end,
 'assignments',coalesce((select jsonb_agg(to_jsonb(x)) from private.esports_exam_assignments x where public.esports_can_review(application_id)),'[]'::jsonb),
 'review_history',coalesce((select jsonb_agg(to_jsonb(r)) from private.esports_attempt_reviews r join private.esports_attempts a on a.id=r.attempt_id where public.esports_can_review(a.application_id)),'[]'::jsonb),
 'attempts',coalesce((select jsonb_agg(to_jsonb(a)) from (select * from private.esports_attempts where status<>'active' and public.esports_can_review(application_id) order by started_at desc limit 100)a),'[]'::jsonb));
 end;$$;
create function public.esports_assessment_action(p_action text,p_id uuid default null,p_expected integer default 0,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
 declare q private.esports_questions;e private.esports_exams;a private.esports_attempts;result jsonb;slot jsonb;x jsonb;k record;total integer:=0;seen text[]:='{}';ref jsonb;
 begin
 if auth.uid() is null or not(public.esports_is_admin() or private.esports_role('esports_staff')) then raise exception 'Administrative role required';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>100000 then raise exception 'Invalid assessment input';end if;
 if p_action='grade' then
 select * into a from private.esports_attempts where id=p_id for update;
 if not found or a.status='active' or not public.esports_can_review(a.application_id) then raise exception 'Submitted attempt unavailable';end if;
 if a.version<>p_expected then raise exception 'Version conflict';end if;
 if length(coalesce(p_payload->>'review_note','')) not between 3 and 8000 or length(coalesce(p_payload->>'feedback',''))>8000 or jsonb_typeof(p_payload->'grades') is distinct from 'object' then raise exception 'Review required';end if;
 for k in select * from jsonb_each(p_payload->'grades') loop
 select value into x from jsonb_array_elements(a.questions) where value->>'id'=k.key and value->>'kind'='discursive';
 if not found or jsonb_typeof(k.value) is distinct from 'number' or k.value::text::numeric<0 or k.value::text::numeric>(x->>'weight')::numeric then raise exception 'Invalid manual grade';end if;end loop;
 if exists(select 1 from jsonb_array_elements(a.questions) item where item->>'kind'='discursive' and not (p_payload->'grades' ? (item->>'id'))) then raise exception 'Grade each discursive question';end if;
 insert into private.esports_attempt_reviews(attempt_id,reviewer_id,attempt_version,grades,review_note,feedback,released) values(a.id,auth.uid(),a.version,p_payload->'grades',p_payload->>'review_note',coalesce(p_payload->>'feedback',''),coalesce((p_payload->>'released')::boolean,false));
 update private.esports_attempts set status='graded',version=version+1,manual_grades=p_payload->'grades',reviewer_id=auth.uid(),review_note=p_payload->>'review_note',feedback=coalesce(p_payload->>'feedback',''),released=coalesce((p_payload->>'released')::boolean,false) where id=p_id;
 elsif public.esports_is_admin() then
 if p_action='question' then
 if p_id is not null then select * into q from private.esports_questions where id=p_id for update;if not found or q.version<>p_expected then raise exception 'Version conflict';end if;end if;
 if (p_payload->>'reviewed_at')::timestamptz>now() or (p_payload->>'reviewed_at')::timestamptz<now()-interval '2 years' then raise exception 'Invalid review date';end if;
 if jsonb_typeof(p_payload->'references_list') is distinct from 'array' or jsonb_typeof(p_payload->'options') is distinct from 'array' then raise exception 'References and options required';end if;
 for ref in select value from jsonb_array_elements(p_payload->'references_list') loop
 if jsonb_typeof(ref) is distinct from 'string' or length(ref#>>'{}')>500 or (ref#>>'{}') !~ '^(https://[A-Za-z0-9][^[:space:]]*|/academy/[^[:space:]]+)$' then raise exception 'Invalid source reference';end if;end loop;
 for ref in select value from jsonb_array_elements(p_payload->'options') loop
 if jsonb_typeof(ref) is distinct from 'string' or length(trim(ref#>>'{}')) not between 1 and 1000 then raise exception 'Invalid answer option';end if;end loop;
 insert into private.esports_questions(id,category,difficulty,kind,prompt,options,correct,explanation,references_list,weight,published,reviewed_at) values(coalesce(p_id,gen_random_uuid()),p_payload->>'category',p_payload->>'difficulty',p_payload->>'kind',p_payload->>'prompt',p_payload->'options',(p_payload->>'correct')::integer,p_payload->>'explanation',p_payload->'references_list',(p_payload->>'weight')::numeric,coalesce((p_payload->>'published')::boolean,false),(p_payload->>'reviewed_at')::timestamptz)
 on conflict(id) do update set category=excluded.category,difficulty=excluded.difficulty,kind=excluded.kind,prompt=excluded.prompt,options=excluded.options,correct=excluded.correct,explanation=excluded.explanation,references_list=excluded.references_list,weight=excluded.weight,published=excluded.published,reviewed_at=excluded.reviewed_at,version=esports_questions.version+1 returning to_jsonb(esports_questions.*) into result;
 elsif p_action='exam' then
 if p_id is not null then select * into e from private.esports_exams where id=p_id for update;if not found or e.version<>p_expected then raise exception 'Version conflict';end if;end if;
 if jsonb_typeof(p_payload->'blueprint') is distinct from 'array' then raise exception 'Balanced blueprint required';end if;
 for slot in select value from jsonb_array_elements(p_payload->'blueprint') loop
 if length(coalesce(slot->>'category','')) not between 2 and 80 or coalesce(slot->>'difficulty','') not in('foundation','intermediate','advanced') or coalesce(slot->>'count','') !~ '^[0-9]{1,2}$' then raise exception 'Invalid blueprint';end if;
 if (slot->>'count')::integer not between 1 and 40 or ((slot->>'category')||'/'||(slot->>'difficulty'))=any(seen) then raise exception 'Duplicate or invalid blueprint slot';end if;
 seen:=array_append(seen,(slot->>'category')||'/'||(slot->>'difficulty'));total:=total+(slot->>'count')::integer;end loop;
 if total not between 1 and 40 then raise exception 'Invalid exam size';end if;
 insert into private.esports_exams(id,title,instructions,rules,blueprint,minutes,max_attempts,published) values(coalesce(p_id,gen_random_uuid()),p_payload->>'title',p_payload->>'instructions',p_payload->>'rules',p_payload->'blueprint',(p_payload->>'minutes')::integer,(p_payload->>'max_attempts')::integer,coalesce((p_payload->>'published')::boolean,false)) on conflict(id) do update set title=excluded.title,instructions=excluded.instructions,rules=excluded.rules,blueprint=excluded.blueprint,minutes=excluded.minutes,max_attempts=excluded.max_attempts,published=excluded.published,version=esports_exams.version+1 returning to_jsonb(esports_exams.*) into result;
 elsif p_action='assign' then
 if not exists(select 1 from public.esports_applications where id=p_id and status in('trial_invited','trial_in_progress','trial_completed')) then raise exception 'Trial invitation required';end if;
 if (p_payload->>'available_until')::timestamptz<=now() then raise exception 'Invalid exam deadline';end if;
 insert into private.esports_exam_assignments(application_id,exam_id,available_until) values(p_id,(p_payload->>'exam_id')::uuid,(p_payload->>'available_until')::timestamptz) on conflict(application_id,exam_id) do update set available_until=excluded.available_until,revoked_at=null;
 elsif p_action='extra_attempt' then
 if length(coalesce(p_payload->>'reason','')) not between 3 and 1000 then raise exception 'Exception reason required';end if;
 update private.esports_exam_assignments set extra_attempts=extra_attempts+1 where application_id=p_id and exam_id=(p_payload->>'exam_id')::uuid and extra_attempts<5;if not found then raise exception 'Assignment unavailable';end if;
 elsif p_action='revoke_assignment' then
 update private.esports_exam_assignments set revoked_at=now() where application_id=p_id and exam_id=(p_payload->>'exam_id')::uuid;
 else raise exception 'Unknown assessment action';end if;
 else raise exception 'Administrator required';end if;
 -- Answers/content are kept in protected versioned rows, audit only identifies operation.
 perform private.esports_audit('assessment_'||p_action,coalesce(p_id,(result->>'id')::uuid));return coalesce(result,'{}');
 end;$$;
revoke all on private.esports_questions,private.esports_exams,private.esports_exam_assignments,private.esports_attempts,private.esports_attempt_reviews from public,anon,authenticated;
revoke all on function private.esports_participation(uuid,uuid),private.esports_trial(uuid),private.esports_safe_attempt(uuid),private.esports_validate_answers(jsonb,jsonb),private.esports_finish_attempt(uuid) from public,anon,authenticated;
revoke all on function public.esports_trials(),public.esports_start_exam(uuid,uuid,boolean),public.esports_answer_exam(uuid,text,integer,jsonb),public.esports_assessment_admin(),public.esports_assessment_action(text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.esports_trials(),public.esports_start_exam(uuid,uuid,boolean),public.esports_answer_exam(uuid,text,integer,jsonb),public.esports_assessment_admin(),public.esports_assessment_action(text,uuid,integer,jsonb) to authenticated;
