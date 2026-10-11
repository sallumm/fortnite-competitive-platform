-- Scholarship access is independent from any future personal subscription.
alter table private.esports_launch_gate add column roster_reviewed boolean not null default false;
create table private.esports_scholarships (
 id uuid primary key default gen_random_uuid(),application_id uuid not null references public.esports_applications(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,version integer not null default 1,
 status text not null default 'offered' check(status in('offered','accepted','declined','revoked','ended')),
 title text not null check(length(title) between 3 and 120),terms text not null check(length(terms) between 20 and 8000),
 benefits jsonb not null check(jsonb_typeof(benefits)='array' and jsonb_array_length(benefits) between 1 and 10),
 human_availability text not null default '',starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),
 offered_by uuid references auth.users(id) on delete set null,accepted_at timestamptz,accepted_snapshot jsonb,
 created_at timestamptz not null default now(),check(length(human_availability)<=2000)
);
create index esports_scholar_owner on private.esports_scholarships(user_id,ends_at);
create unique index esports_scholar_current on private.esports_scholarships(application_id) where status in('offered','accepted');
create table private.esports_benefit_grants (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 scholarship_id uuid not null references private.esports_scholarships(id) on delete cascade,capability text not null,
 starts_at timestamptz not null,ends_at timestamptz not null,revoked_at timestamptz,
 unique(scholarship_id,capability)
);
create table private.esports_development_goals (
 id uuid primary key default gen_random_uuid(),scholarship_id uuid not null references private.esports_scholarships(id) on delete cascade,
 version integer not null default 1,title text not null check(length(title) between 3 and 120),
 description text not null check(length(description) between 3 and 8000),kind text not null check(kind in('study','exercise','vod','review','activity')),
 due_at timestamptz,route text not null default '' check(route='' or route ~ '^/(academy|library|app/(training|vod|week|planner|reports|road|evolution|evolution-plan|skills|progression))([/?#].*)?$'),
 state text not null default 'planned' check(state in('planned','in_progress','completed')),
 learner_note text not null default '' check(length(learner_note)<=4000),created_at timestamptz not null default now()
);
create table private.esports_development_reviews (
 id uuid primary key default gen_random_uuid(),scholarship_id uuid not null references private.esports_scholarships(id) on delete cascade,
 reviewer_id uuid references auth.users(id) on delete set null,shared_feedback text not null check(length(shared_feedback) between 3 and 8000),
 internal_note text not null check(length(internal_note) between 3 and 8000),next_step text not null check(length(next_step) between 3 and 4000),created_at timestamptz not null default now()
);
create table private.esports_roster_decisions (
 id uuid primary key default gen_random_uuid(),application_id uuid not null references public.esports_applications(id) on delete cascade,
 kind text not null check(kind in('academy_player','roster_player')),actor_id uuid references auth.users(id) on delete set null,
 reason text not null check(length(reason) between 3 and 2000),formalization_reference text not null check(length(formalization_reference) between 3 and 200),created_at timestamptz not null default now()
);
create table private.esports_erasure_requests (
 user_id uuid primary key references public.profiles(id) on delete cascade,status text not null default 'requested' check(status in('requested','handled')),
 requested_at timestamptz not null default now(),handled_at timestamptz,handled_by uuid references auth.users(id) on delete set null
);
create function private.esports_scholar(p_id uuid,p_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.esports_scholarships s where id=p_id and user_id=p_user and status='accepted' and starts_at<=now() and ends_at>now() and private.esports_participation(application_id,p_user) and exists(select 1 from private.esports_role_grants r where r.user_id=p_user and r.application_id=s.application_id and r.role='development_scholar' and r.revoked_at is null and r.starts_at<=now() and r.ends_at>now()))
$$;
create function public.esports_benefits() returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('capability',b.capability,'source','scholarship','scholarship_id',b.scholarship_id,'ends_at',least(b.ends_at,s.ends_at))) from private.esports_benefit_grants b join private.esports_scholarships s on s.id=b.scholarship_id where b.user_id=auth.uid() and b.revoked_at is null and b.starts_at<=now() and b.ends_at>now() and private.esports_scholar(s.id)),'[]'::jsonb);
 end;$$;
create function public.esports_development(p_admin boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_admin and not(public.esports_is_admin() or private.esports_role('esports_staff')) then raise exception 'Administrative role required';end if;
 return jsonb_build_object('admin',p_admin and public.esports_is_admin(),
 'scholarships',coalesce((select jsonb_agg(to_jsonb(s)-'accepted_snapshot') from (select * from private.esports_scholarships where (p_admin and public.esports_can_review(application_id)) or (not p_admin and user_id=auth.uid()) order by created_at desc limit 100)s),'[]'::jsonb),
 'goals',coalesce((select jsonb_agg(to_jsonb(g) order by due_at nulls last) from private.esports_development_goals g join private.esports_scholarships s on s.id=g.scholarship_id where (p_admin and public.esports_can_review(s.application_id)) or (not p_admin and private.esports_scholar(s.id))),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(case when p_admin then to_jsonb(r) else to_jsonb(r)-'internal_note'-'reviewer_id' end order by r.created_at desc) from private.esports_development_reviews r join private.esports_scholarships s on s.id=r.scholarship_id where (p_admin and public.esports_can_review(s.application_id)) or (not p_admin and private.esports_scholar(s.id))),'[]'::jsonb),
 'benefits',case when not p_admin then public.esports_benefits() else '[]'::jsonb end,
 'erasure_requests',case when p_admin and public.esports_is_admin() then coalesce((select jsonb_agg(to_jsonb(r)) from private.esports_erasure_requests r where status='requested'),'[]'::jsonb) else '[]'::jsonb end);
 end;$$;
create function public.esports_development_action(p_action text,p_id uuid default null,p_expected integer default 0,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
 declare s private.esports_scholarships;g private.esports_development_goals;a public.esports_applications;benefit jsonb;result jsonb;expiry timestamptz;start_at timestamptz;u uuid;
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>30000 then raise exception 'Invalid development input';end if;
 if p_action in('accept','decline') then
 select * into s from private.esports_scholarships where id=p_id for update;
 if not found or s.user_id<>auth.uid() or not private.esports_participation(s.application_id) then raise exception 'Offer unavailable';end if;
 if p_action='accept' and s.status='accepted' then return jsonb_build_object('id',s.id);end if;
 if s.version<>p_expected then raise exception 'Version conflict';end if;
 if s.status<>'offered' or s.ends_at<=now() then raise exception 'Offer unavailable';end if;
 if p_action='accept' then
 if p_payload->>'accepted' is distinct from 'true' then raise exception 'Explicit acceptance required';end if;
 update private.esports_scholarships set status='accepted',version=version+1,accepted_at=now(),accepted_snapshot=jsonb_build_object('terms',s.terms,'benefits',s.benefits,'human_availability',s.human_availability,'starts_at',s.starts_at,'ends_at',s.ends_at,'version',s.version) where id=p_id;
 insert into private.esports_role_grants(user_id,application_id,role,starts_at,ends_at,granted_by,reason) values(auth.uid(),s.application_id,'development_scholar',greatest(s.starts_at,now()),s.ends_at,s.offered_by,'Bolsa aceita expressamente');
 for benefit in select value from jsonb_array_elements(s.benefits) loop insert into private.esports_benefit_grants(user_id,scholarship_id,capability,starts_at,ends_at) values(auth.uid(),s.id,benefit#>>'{}',s.starts_at,s.ends_at);end loop;
 update public.esports_applications set status='development_active',version=version+1,updated_at=now() where id=s.application_id;
 insert into public.esports_status_events(application_id,status,message) values(s.application_id,'development_active','Bolsa de desenvolvimento aceita. Não representa ingresso no elenco.');
 else update private.esports_scholarships set status='declined',version=version+1 where id=p_id;update public.esports_applications set status='trial_completed',version=version+1,updated_at=now() where id=s.application_id;end if;
 elsif p_action='progress' then
 select * into g from private.esports_development_goals where id=p_id for update;
 if not found or not private.esports_scholar(g.scholarship_id) then raise exception 'Goal unavailable';end if;
 if g.version<>p_expected then raise exception 'Version conflict';end if;
 update private.esports_development_goals set state=p_payload->>'state',learner_note=coalesce(p_payload->>'learner_note',''),version=version+1 where id=p_id;
 elsif public.esports_is_admin() or private.esports_role('esports_staff') then
 if p_action in('goal','review') then
 select * into s from private.esports_scholarships where id=(p_payload->>'scholarship_id')::uuid for share;
 if not found or not public.esports_can_review(s.application_id) then raise exception 'Scholarship unavailable';end if;
 if p_action='goal' then
 if p_id is not null then select * into g from private.esports_development_goals where id=p_id for update;if not found or g.scholarship_id<>s.id or g.version<>p_expected then raise exception 'Version conflict';end if;end if;
 insert into private.esports_development_goals(id,scholarship_id,title,description,kind,due_at,route) values(coalesce(p_id,gen_random_uuid()),s.id,p_payload->>'title',p_payload->>'description',p_payload->>'kind',(p_payload->>'due_at')::timestamptz,coalesce(p_payload->>'route','')) on conflict(id) do update set title=excluded.title,description=excluded.description,kind=excluded.kind,due_at=excluded.due_at,route=excluded.route,version=esports_development_goals.version+1 returning jsonb_build_object('id',id) into result;
 else insert into private.esports_development_reviews(scholarship_id,reviewer_id,shared_feedback,internal_note,next_step) values(s.id,auth.uid(),p_payload->>'shared_feedback',p_payload->>'internal_note',p_payload->>'next_step') returning jsonb_build_object('id',id) into result;end if;
 else
 if not public.esports_is_admin() then raise exception 'Administrator required';end if;
 if p_action='offer' then
 select * into a from public.esports_applications where id=p_id for update;
 if not found or a.user_id=auth.uid() or a.status<>'trial_completed' or a.version<>p_expected then raise exception 'Completed human evaluation required';end if;
 if not exists(select 1 from private.esports_reviews where application_id=a.id and kind='practical') then raise exception 'Practical review required';end if;
 start_at:=(p_payload->>'starts_at')::timestamptz;expiry:=(p_payload->>'ends_at')::timestamptz;
 if expiry<=now() or expiry>now()+interval '2 years' or start_at<now()-interval '1 day' then raise exception 'Invalid scholarship period';end if;
 if jsonb_typeof(p_payload->'benefits') is distinct from 'array' then raise exception 'Benefits required';end if;
 for benefit in select value from jsonb_array_elements(p_payload->'benefits') loop
 if jsonb_typeof(benefit) is distinct from 'string' or (benefit#>>'{}') not in('plan_tools','materials','periodic_review','development_workspace','human_feedback') then raise exception 'Unavailable benefit: Pro/commercial resources are not activated';end if;
 if benefit#>>'{}'='human_feedback' and length(trim(coalesce(p_payload->>'human_availability',''))) not between 10 and 2000 then raise exception 'Human feedback availability required';end if;end loop;
 insert into private.esports_scholarships(application_id,user_id,title,terms,benefits,human_availability,starts_at,ends_at,offered_by) values(a.id,a.user_id,p_payload->>'title',p_payload->>'terms',p_payload->'benefits',coalesce(p_payload->>'human_availability',''),start_at,expiry,auth.uid()) returning jsonb_build_object('id',id) into result;
 update public.esports_applications set status='development_offered',version=version+1,updated_at=now() where id=a.id;
 insert into public.esports_status_events(application_id,status,message) values(a.id,'development_offered','Uma bolsa temporária foi oferecida. Leia as condições no espaço de desenvolvimento.');
 elsif p_action in('revoke','end','extend') then
 select * into s from private.esports_scholarships where id=p_id for update;if not found or s.version<>p_expected then raise exception 'Version conflict';end if;
 if length(coalesce(p_payload->>'reason','')) not between 3 and 1000 then raise exception 'Reason required';end if;
 if p_action='extend' then
 expiry:=(p_payload->>'ends_at')::timestamptz;
 if s.status<>'accepted' or s.ends_at<=now() or expiry<=s.ends_at or expiry>now()+interval '2 years' then raise exception 'Active scholarship and later expiry required';end if;
 update private.esports_scholarships set ends_at=expiry,version=version+1 where id=s.id;
 update private.esports_benefit_grants set ends_at=expiry where scholarship_id=s.id and revoked_at is null;
 update private.esports_role_grants set ends_at=expiry where application_id=s.application_id and role='development_scholar' and revoked_at is null;
 else
 update private.esports_scholarships set status=case when p_action='end' then 'ended' else 'revoked' end,version=version+1 where id=s.id;
 update private.esports_benefit_grants set revoked_at=now() where scholarship_id=s.id;
 update private.esports_role_grants set revoked_at=now() where application_id=s.application_id and role='development_scholar' and revoked_at is null;
 update public.esports_applications set status='trial_completed',version=version+1,updated_at=now() where id=s.application_id and status in('development_active','development_offered');
 insert into public.esports_status_events(application_id,status,message) values(s.application_id,'trial_completed','Bolsa encerrada ou revogada. Assinaturas pessoais não são alteradas.');end if;
 elsif p_action='roster_decision' then
 select * into a from public.esports_applications where id=p_id for update;
 if not found or a.user_id=auth.uid() or a.version<>p_expected or a.status not in('trial_completed','development_active') then raise exception 'Explicit reviewed decision required';end if;
 if p_payload->>'kind'='roster_player' then raise exception 'Professional roster requires a separate formalization workflow, not available';end if;
 if p_payload->>'kind' is distinct from 'academy_player' or p_payload->>'requirements_confirmed' is distinct from 'true' or not exists(select 1 from private.esports_launch_gate where roster_reviewed) then raise exception 'Roster requirements review required';end if;
 expiry:=(p_payload->>'ends_at')::timestamptz;if expiry<=now() or expiry>now()+interval '2 years' then raise exception 'Invalid roster period';end if;
 insert into private.esports_roster_decisions(application_id,kind,actor_id,reason,formalization_reference) values(a.id,'academy_player',auth.uid(),p_payload->>'reason',p_payload->>'formalization_reference');
 insert into private.esports_role_grants(user_id,application_id,role,ends_at,granted_by,reason) values(a.user_id,a.id,'academy_player',expiry,auth.uid(),p_payload->>'reason');
 update public.esports_applications set status='academy_selected',version=version+1,updated_at=now() where id=a.id;
 insert into public.esports_status_events(application_id,status,message) values(a.id,'academy_selected','Seleção expressa para Academy Roster registrada. Publicação de dados depende de autorização própria.');
 else raise exception 'Unknown development action';end if;
 end if;
 else raise exception 'Administrative role required';end if;
 perform private.esports_audit('development_'||p_action,coalesce(p_id,(result->>'id')::uuid),case when p_action in('revoke','end','extend','roster_decision') then jsonb_build_object('reason',p_payload->>'reason') else '{}'::jsonb end);
 return coalesce(result,'{}');
 end;$$;
create function public.esports_export() returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 return jsonb_build_object('exported_at',now(),'workspace',public.esports_workspace(),
 'scholarships',coalesce((select jsonb_agg(to_jsonb(s)-'offered_by') from private.esports_scholarships s where user_id=auth.uid()),'[]'::jsonb),
 'goals',coalesce((select jsonb_agg(to_jsonb(g)) from private.esports_development_goals g join private.esports_scholarships s on s.id=g.scholarship_id where s.user_id=auth.uid()),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(to_jsonb(r)-'internal_note'-'reviewer_id') from private.esports_development_reviews r join private.esports_scholarships s on s.id=r.scholarship_id where s.user_id=auth.uid()),'[]'::jsonb),
 'attempts',coalesce((select jsonb_agg(private.esports_safe_attempt(id)) from private.esports_attempts where user_id=auth.uid()),'[]'::jsonb));
 end;$$;
create function public.esports_request_erasure() returns void language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 insert into private.esports_erasure_requests(user_id) values(auth.uid()) on conflict(user_id) do update set status='requested',requested_at=now(),handled_at=null,handled_by=null;
 update public.esports_applications set status='withdrawn',version=version+1,updated_at=now() where user_id=auth.uid();
 update private.esports_role_grants set revoked_at=now() where user_id=auth.uid();
 update private.esports_benefit_grants set revoked_at=now() where user_id=auth.uid();
 perform private.esports_audit('erasure_requested',auth.uid());end;$$;
create function public.esports_purge(p_user uuid default null,p_confirmation text default '') returns integer language plpgsql security definer set search_path='' as $$
 declare ids uuid[];cnt integer;
 begin
 if not public.esports_is_admin() or p_confirmation<>'EXCLUIR DADOS ESPORTS' then raise exception 'Administrator and explicit confirmation required';end if;
 if p_user is not null and not exists(select 1 from private.esports_erasure_requests where user_id=p_user and status='requested') then raise exception 'Erasure request required';end if;
 select coalesce(array_agg(a.id),'{}') into ids from public.esports_applications a join public.esports_cycles c on c.id=a.cycle_id where (p_user is not null and a.user_id=p_user) or (p_user is null and not exists(select 1 from private.esports_role_grants r where r.application_id=a.id and r.role<>'applicant' and r.revoked_at is null and r.ends_at>now()) and not exists(select 1 from private.esports_scholarships ss where ss.application_id=a.id and ss.status in('offered','accepted') and ss.ends_at>now()) and now()>greatest(c.ends_at,a.updated_at)+make_interval(days=>coalesce((a.consent_snapshot->>'retention_days')::integer,c.retention_days)));
 -- Audit targets associated with erased records are removed; no candidate payload in audit.
 delete from private.esports_audit where target_id=any(ids) or target_id in(select id from private.esports_attempts where application_id=any(ids)) or target_id in(select id from private.esports_scholarships where application_id=any(ids));
 delete from private.esports_authorizations where (p_user is not null and user_id=p_user) or (revoked_at is not null and expires_at<now()-interval '30 days');
 delete from public.esports_applications where id=any(ids);get diagnostics cnt=row_count;
 if p_user is not null then
 delete from private.esports_role_grants where user_id=p_user;
 delete from private.esports_audit where actor_id=p_user or target_id=p_user or detail->>'user_id'=p_user::text;
 update private.esports_erasure_requests set status='handled',handled_at=now(),handled_by=auth.uid() where user_id=p_user;
 end if;
 perform private.esports_audit('retention_purge',null,jsonb_build_object('records',cnt));return cnt;
 end;$$;
revoke all on private.esports_scholarships,private.esports_benefit_grants,private.esports_development_goals,private.esports_development_reviews,private.esports_roster_decisions,private.esports_erasure_requests from public,anon,authenticated;
revoke all on function private.esports_scholar(uuid,uuid) from public,anon,authenticated;
revoke all on function public.esports_benefits(),public.esports_development(boolean),public.esports_development_action(text,uuid,integer,jsonb),public.esports_export(),public.esports_request_erasure(),public.esports_purge(uuid,text) from public,anon,authenticated;
grant execute on function public.esports_benefits(),public.esports_development(boolean),public.esports_development_action(text,uuid,integer,jsonb),public.esports_export(),public.esports_request_erasure(),public.esports_purge(uuid,text) to authenticated;
