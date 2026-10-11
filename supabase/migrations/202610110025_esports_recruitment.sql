-- Incremental esports domain. Launch authorization is private, false by default,
-- and cannot be changed by a browser RPC. No commercial or Discord integration.
create table private.esports_launch_gate (
 id boolean primary key default true check(id), reviewed boolean not null default false,
 minors_reviewed boolean not null default false, reviewed_at timestamptz,
 review_reference text not null default ''
);
insert into private.esports_launch_gate(id) values(true);
create table public.esports_settings (
 id boolean primary key default true check(id), version integer not null default 1,
 recruitment_enabled boolean not null default false,
 official_discord text not null default '' check(official_discord='' or official_discord ~ '^https://(discord[.]gg/[A-Za-z0-9-]+|discord[.]com/invite/[A-Za-z0-9-]+)$'),
 introduction text not null default 'Organização em desenvolvimento. Sem elenco anunciado.',
 trial_intro text not null default 'Avaliações privadas não representam contratação.',
 support_text text not null default 'O acompanhamento ocorre dentro da kyrven.',
 updated_at timestamptz not null default now()
);
insert into public.esports_settings(id) values(true);
create table public.esports_cycles (
 id uuid primary key default gen_random_uuid(), version integer not null default 1,
 title text not null check(length(trim(title)) between 3 and 120),
 mode text not null check(mode in('build','zero','both')), format text not null check(length(format) between 1 and 80),
 criteria text not null check(length(criteria) between 10 and 4000),
 rules text not null check(length(rules) between 10 and 8000),
 privacy_notice text not null check(length(privacy_notice) between 10 and 8000),
 policy_version text not null check(length(policy_version) between 1 and 80),
 retention_days integer not null check(retention_days between 30 and 730),
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
 published boolean not null default false, is_open boolean not null default false,
 allow_minors boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.esports_applications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 cycle_id uuid not null references public.esports_cycles(id),
 status text not null default 'submitted' check(status in('submitted','under_review','trial_invited','trial_in_progress','trial_completed','development_offered','development_active','academy_selected','not_selected','withdrawn')),
 version integer not null default 1, payload jsonb not null check(jsonb_typeof(payload)='object'),
 consent_snapshot jsonb not null, created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,cycle_id),unique(id,user_id)
);
create index esports_application_cycle on public.esports_applications(cycle_id,status,created_at);
create table private.esports_role_grants (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 application_id uuid references public.esports_applications(id) on delete cascade,
 role text not null check(role in('applicant','trialist','development_scholar','academy_player','roster_player','esports_staff','esports_admin')),
 starts_at timestamptz not null default now(), ends_at timestamptz not null check(ends_at>starts_at),
 revoked_at timestamptz, granted_by uuid references auth.users(id) on delete set null,
 reason text not null check(length(reason) between 3 and 1000)
);
create index esports_grant_user on private.esports_role_grants(user_id,role,ends_at);
create table private.esports_reviewers (
 application_id uuid not null references public.esports_applications(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,primary key(application_id,user_id)
);
create table private.esports_authorizations (
 user_id uuid not null references public.profiles(id) on delete cascade,
 cycle_id uuid not null references public.esports_cycles(id),
 verified_by uuid references auth.users(id) on delete set null, verified_at timestamptz not null default now(),
 expires_at timestamptz not null, policy_version text not null, reference text not null check(length(reference) between 3 and 200),
 revoked_at timestamptz, primary key(user_id,cycle_id)
);
create table private.esports_audit (
 id bigint generated always as identity primary key, actor_id uuid references auth.users(id) on delete set null,
 action text not null, target_id uuid, detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create table private.esports_reviews (
 id uuid primary key default gen_random_uuid(),application_id uuid not null references public.esports_applications(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null, kind text not null check(kind in('review','practical')),
 note text not null check(length(note) between 3 and 8000),created_at timestamptz not null default now()
);
create table public.esports_status_events (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.esports_applications(id) on delete cascade,
 status text not null, message text not null check(length(message)<=2000),created_at timestamptz not null default now()
);
create function private.esports_role(p_role text,p_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(select 1 from private.esports_role_grants where user_id=p_user and role=p_role and starts_at<=now() and ends_at>now() and revoked_at is null)
$$;
create function public.esports_is_admin() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and (public.is_admin() or private.esports_role('esports_admin'))$$;
create function public.esports_can_review(p_application uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.esports_is_admin() or (private.esports_role('esports_staff') and exists(select 1 from private.esports_reviewers where application_id=p_application and user_id=auth.uid())))
$$;
create function private.esports_audit(p_action text,p_target uuid,p_detail jsonb default '{}') returns void language sql security definer set search_path='' as $$insert into private.esports_audit(actor_id,action,target_id,detail) values(auth.uid(),p_action,p_target,p_detail)$$;
create function public.esports_portal() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('settings',to_jsonb(s)-'trial_intro','operational',s.recruitment_enabled and g.reviewed,'cycles',coalesce((select jsonb_agg(to_jsonb(c) order by c.starts_at desc) from (select * from public.esports_cycles where published order by starts_at desc limit 50)c),'[]'::jsonb)) from public.esports_settings s cross join private.esports_launch_gate g
$$;
create function public.esports_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 return jsonb_build_object('admin',public.esports_is_admin(),'staff',private.esports_role('esports_staff'),
 'applications',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.esports_applications a where user_id=auth.uid()),'[]'::jsonb),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('id',id,'role',role,'application_id',application_id,'ends_at',ends_at)) from private.esports_role_grants where user_id=auth.uid() and revoked_at is null and starts_at<=now() and ends_at>now()),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.esports_status_events e join public.esports_applications a on a.id=e.application_id where a.user_id=auth.uid()),'[]'::jsonb),
 'trial_intro',case when private.esports_role('trialist') then (select trial_intro from public.esports_settings) else null end);
 end;$$;
create function public.esports_submit(p_cycle uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
 declare c public.esports_cycles; a uuid; field text; entry jsonb; clean jsonb;
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into c from public.esports_cycles where id=p_cycle for share;
 if not found or not c.published or not c.is_open or now()<c.starts_at or now()>=c.ends_at or not exists(select 1 from public.esports_settings s cross join private.esports_launch_gate g where s.recruitment_enabled and g.reviewed) then raise exception 'Recruitment closed';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>20000 then raise exception 'Invalid application';end if;
 foreach field in array array['nickname','epic_nick','format','experience','objectives','availability','region','motivation'] loop
 if jsonb_typeof(p_payload->field) is distinct from 'string' or length(trim(p_payload->>field)) not between 1 and (case when field in('objectives','motivation','availability') then 2000 else 120 end) then raise exception 'Invalid field %',field;end if;end loop;
 if coalesce(p_payload->>'mode','') not in('build','zero') or (c.mode<>'both' and c.mode<>p_payload->>'mode') or coalesce(p_payload->>'age_band','') not in('adult','adolescent') or p_payload->>'accepted' is distinct from 'true' or p_payload->>'policy_version' is distinct from c.policy_version or p_payload->>'rules_version' is distinct from c.version::text then raise exception 'Rules, mode or authorization invalid';end if;
 if p_payload->>'age_band'='adolescent' and (not c.allow_minors or not exists(select 1 from private.esports_launch_gate where minors_reviewed) or not exists(select 1 from private.esports_authorizations where user_id=auth.uid() and cycle_id=c.id and policy_version=c.policy_version and revoked_at is null and expires_at>now())) then raise exception 'Responsible authorization pending';end if;
 if jsonb_typeof(p_payload->'links') is distinct from 'array' or jsonb_array_length(p_payload->'links')>5 then raise exception 'Invalid links';end if;
 for entry in select value from jsonb_array_elements(p_payload->'links') loop
 if jsonb_typeof(entry) is distinct from 'string' or length(entry#>>'{}')>500 or (entry#>>'{}') !~ '^https://[A-Za-z0-9][^[:space:]]*$' then raise exception 'Invalid link';end if;end loop;
 if exists(select 1 from public.esports_applications where user_id=auth.uid() and cycle_id=p_cycle) then raise exception 'Application already exists';end if;
 if (select count(*) from public.esports_applications where user_id=auth.uid() and created_at>now()-interval '1 day')>=5 then raise exception 'Daily application limit';end if;
 select jsonb_object_agg(key,value) into clean from jsonb_each(p_payload) where key=any(array['nickname','epic_nick','mode','format','experience','objectives','availability','region','motivation','links','age_band']);
 insert into public.esports_applications(user_id,cycle_id,payload,consent_snapshot) values(auth.uid(),p_cycle,clean,jsonb_build_object('policy_version',c.policy_version,'cycle_version',c.version,'rules',c.rules,'privacy_notice',c.privacy_notice,'retention_days',c.retention_days,'accepted_at',now())) returning id into a;
 insert into private.esports_role_grants(user_id,application_id,role,ends_at,reason) values(auth.uid(),a,'applicant',greatest(c.ends_at,now())+make_interval(days=>c.retention_days),'Candidatura confirmada');
 insert into public.esports_status_events(application_id,status,message) values(a,'submitted','Candidatura recebida. Aguarde a análise.');
 perform private.esports_audit('submitted',a);return a;
 end;$$;
create function public.esports_withdraw(p_application uuid) returns void language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform 1 from public.esports_applications where id=p_application and user_id=auth.uid() for update;
 if not found then raise exception 'Application unavailable';end if;
 update public.esports_applications set status='withdrawn',version=version+1,updated_at=now() where id=p_application and status<>'withdrawn';
 update private.esports_role_grants set revoked_at=now() where application_id=p_application and revoked_at is null;
 insert into public.esports_status_events(application_id,status,message) values(p_application,'withdrawn','Participação retirada pelo candidato.');perform private.esports_audit('withdrawn',p_application);
 end;$$;
create function public.esports_admin_data(p_query text default '',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin
 if auth.uid() is null or not (public.esports_is_admin() or private.esports_role('esports_staff')) then raise exception 'Administrative role required';end if;
 if length(p_query)>120 or p_offset<0 or p_offset>100000 then raise exception 'Invalid search';end if;
 return jsonb_build_object('settings',case when public.esports_is_admin() then (select to_jsonb(s) from public.esports_settings s) else null end,
 'gate',case when public.esports_is_admin() then (select jsonb_build_object('reviewed',reviewed,'minors_reviewed',minors_reviewed) from private.esports_launch_gate) else null end,
 'cycles',case when public.esports_is_admin() then coalesce((select jsonb_agg(to_jsonb(c)) from public.esports_cycles c),'[]'::jsonb) else '[]'::jsonb end,
 'applications',coalesce((select jsonb_agg(to_jsonb(a)) from (select * from public.esports_applications a where public.esports_can_review(a.id) and (p_query='' or a.payload->>'nickname' ilike '%'||p_query||'%' or a.user_id::text=p_query) order by created_at desc limit 50 offset p_offset)a),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(to_jsonb(r)) from (select * from private.esports_reviews where public.esports_can_review(application_id) order by created_at desc limit 200)r),'[]'::jsonb),
 'audit',case when public.esports_is_admin() then coalesce((select jsonb_agg(to_jsonb(r)) from (select * from private.esports_audit order by id desc limit 100 offset p_offset)r),'[]'::jsonb) else '[]'::jsonb end,
 'roles',case when public.esports_is_admin() then coalesce((select jsonb_agg(to_jsonb(r)) from (select * from private.esports_role_grants order by starts_at desc limit 100 offset p_offset)r),'[]'::jsonb) else '[]'::jsonb end,
 'users',case when public.esports_is_admin() and length(p_query)>=3 then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name)) from (select id,display_name from public.profiles where display_name ilike '%'||p_query||'%' or id::text=p_query order by id limit 25)p),'[]'::jsonb) else '[]'::jsonb end);
 end;$$;
create function public.esports_admin_action(p_action text,p_id uuid default null,p_expected integer default 0,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
 declare a public.esports_applications;c public.esports_cycles;u uuid;r text;expiry timestamptz;result jsonb:='{}';
 begin
 if auth.uid() is null or not(public.esports_is_admin() or private.esports_role('esports_staff')) then raise exception 'Administrative role required';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>30000 then raise exception 'Invalid administrative input';end if;
 if p_action in('note','practical','status') then
 select * into a from public.esports_applications where id=p_id for update;
 if not found or not public.esports_can_review(p_id) then raise exception 'Application unavailable';end if;
 if a.version<>p_expected then raise exception 'Version conflict';end if;
 if p_action in('note','practical') then
 insert into private.esports_reviews(application_id,actor_id,kind,note) values(p_id,auth.uid(),case when p_action='practical' then 'practical' else 'review' end,p_payload->>'note');
 else
 if not public.esports_is_admin() then raise exception 'Administrator decision required';end if;
 r:=p_payload->>'status';
 if not ((a.status='submitted' and r in('under_review','not_selected')) or (a.status='under_review' and r in('trial_invited','not_selected')) or (a.status='trial_invited' and r in('trial_in_progress','not_selected')) or (a.status='trial_in_progress' and r in('trial_completed','not_selected')) or (a.status='trial_completed' and r in('development_offered','academy_selected','not_selected','trial_invited')) or (a.status='development_offered' and r in('not_selected','trial_completed')) or (a.status='development_active' and r in('academy_selected','trial_completed','not_selected')) or (a.status='not_selected' and r='under_review')) then raise exception 'Invalid status transition';end if;
 if length(trim(coalesce(p_payload->>'message',''))) not between 3 and 2000 or length(trim(coalesce(p_payload->>'reason',''))) not between 3 and 1000 then raise exception 'Decision and reason required';end if;
 update public.esports_applications set status=r,version=version+1,updated_at=now() where id=p_id returning to_jsonb(esports_applications.*) into result;
 insert into public.esports_status_events(application_id,status,message) values(p_id,r,p_payload->>'message');
 if r='not_selected' then update private.esports_role_grants set revoked_at=now() where application_id=p_id and role='trialist' and revoked_at is null;end if;
 end if;
 else
 if not public.esports_is_admin() then raise exception 'Administrator required';end if;
 if p_action='settings' then
 if p_payload->>'recruitment_enabled'='true' and not exists(select 1 from private.esports_launch_gate where reviewed) then raise exception 'Launch review required';end if;
 update public.esports_settings set recruitment_enabled=(p_payload->>'recruitment_enabled')::boolean,official_discord=coalesce(p_payload->>'official_discord',''),introduction=p_payload->>'introduction',trial_intro=p_payload->>'trial_intro',support_text=p_payload->>'support_text',version=version+1,updated_at=now() where version=p_expected returning to_jsonb(esports_settings.*) into result;
 if result is null then raise exception 'Version conflict';end if;
 if length(result->>'introduction')>4000 or length(result->>'trial_intro')>8000 or length(result->>'support_text')>2000 then raise exception 'Invalid settings';end if;
 elsif p_action='cycle' then
 if p_payload->>'is_open'='true' and not exists(select 1 from private.esports_launch_gate where reviewed) then raise exception 'Launch review required';end if;
 if p_payload->>'allow_minors'='true' and not exists(select 1 from private.esports_launch_gate where minors_reviewed) then raise exception 'Minor protection review required';end if;
 if p_id is not null then select * into c from public.esports_cycles where id=p_id for update;if not found or c.version<>p_expected then raise exception 'Version conflict';end if;end if;
 insert into public.esports_cycles(id,title,mode,format,criteria,rules,privacy_notice,policy_version,retention_days,starts_at,ends_at,published,is_open,allow_minors)
 values(coalesce(p_id,gen_random_uuid()),p_payload->>'title',p_payload->>'mode',p_payload->>'format',p_payload->>'criteria',p_payload->>'rules',p_payload->>'privacy_notice',p_payload->>'policy_version',(p_payload->>'retention_days')::integer,(p_payload->>'starts_at')::timestamptz,(p_payload->>'ends_at')::timestamptz,(p_payload->>'published')::boolean,(p_payload->>'is_open')::boolean,(p_payload->>'allow_minors')::boolean)
 on conflict(id) do update set title=excluded.title,mode=excluded.mode,format=excluded.format,criteria=excluded.criteria,rules=excluded.rules,privacy_notice=excluded.privacy_notice,policy_version=excluded.policy_version,retention_days=excluded.retention_days,starts_at=excluded.starts_at,ends_at=excluded.ends_at,published=excluded.published,is_open=excluded.is_open,allow_minors=excluded.allow_minors,version=esports_cycles.version+1 returning to_jsonb(esports_cycles.*) into result;
 elsif p_action='grant_role' then
 u:=(p_payload->>'user_id')::uuid;r:=p_payload->>'role';expiry:=(p_payload->>'ends_at')::timestamptz;
 if u=auth.uid() or expiry<=now() or expiry>now()+interval '2 years' then raise exception 'Invalid grant or self assignment';end if;
 if r in('esports_admin','esports_staff') and not public.is_admin() then raise exception 'Platform administrator required';end if;
 if r in('applicant','development_scholar','academy_player','roster_player') then raise exception 'Use explicit scholarship or roster decision';end if;
 if r='trialist' and not exists(select 1 from public.esports_applications where id=p_id and user_id=u and status in('trial_invited','trial_in_progress','trial_completed')) then raise exception 'Trial invitation required';end if;
 insert into private.esports_role_grants(user_id,application_id,role,ends_at,granted_by,reason) values(u,case when r in('applicant','trialist') then p_id else null end,r,expiry,auth.uid(),p_payload->>'reason') returning jsonb_build_object('id',id) into result;
 elsif p_action='revoke_role' then
 perform 1 from private.esports_role_grants where id=p_id and (role not in('esports_admin','esports_staff') or public.is_admin()) for update;if not found then raise exception 'Grant unavailable';end if;
 if length(trim(coalesce(p_payload->>'reason',''))) not between 3 and 1000 then raise exception 'Reason required';end if;
 update private.esports_role_grants set revoked_at=now() where id=p_id;
 elsif p_action='assign_reviewer' then
 u:=(p_payload->>'user_id')::uuid;
 if not private.esports_role('esports_staff',u) or not exists(select 1 from public.esports_applications where id=p_id) then raise exception 'Active staff and application required';end if;
 if p_payload->>'revoke'='true' then delete from private.esports_reviewers where application_id=p_id and user_id=u;else insert into private.esports_reviewers values(p_id,u) on conflict do nothing;end if;
 elsif p_action='authorization' then
 if not exists(select 1 from private.esports_launch_gate where minors_reviewed) then raise exception 'Minor protection review required';end if;
 u:=(p_payload->>'user_id')::uuid;expiry:=(p_payload->>'expires_at')::timestamptz;
 if expiry<=now() then raise exception 'Invalid authorization expiry';end if;
 insert into private.esports_authorizations(user_id,cycle_id,verified_by,expires_at,policy_version,reference) values(u,p_id,auth.uid(),expiry,p_payload->>'policy_version',p_payload->>'reference') on conflict(user_id,cycle_id) do update set verified_by=auth.uid(),verified_at=now(),expires_at=excluded.expires_at,policy_version=excluded.policy_version,reference=excluded.reference,revoked_at=null;
 elsif p_action='revoke_authorization' then
 update private.esports_authorizations set revoked_at=now() where user_id=(p_payload->>'user_id')::uuid and cycle_id=p_id;
 else raise exception 'Unknown administrative action';end if;
 end if;
 perform private.esports_audit(p_action,coalesce(p_id,case when result->>'id' ~ '^[0-9a-f-]{36}$' then (result->>'id')::uuid else null end),p_payload);return coalesce(result,'{}');
 end;$$;
-- All mutation paths are authenticated RPCs; RLS adds read isolation.
alter table public.esports_settings enable row level security;
alter table public.esports_cycles enable row level security;
alter table public.esports_applications enable row level security;
alter table public.esports_status_events enable row level security;
revoke all on public.esports_settings,public.esports_cycles,public.esports_applications,public.esports_status_events from public,anon,authenticated;
grant select on public.esports_applications,public.esports_status_events to authenticated;
create policy esports_owner_or_reviewer on public.esports_applications for select to authenticated using(user_id=(select auth.uid()) or public.esports_can_review(id));
create policy esports_event_owner on public.esports_status_events for select to authenticated using(exists(select 1 from public.esports_applications a where a.id=application_id and (a.user_id=(select auth.uid()) or public.esports_can_review(a.id))));
revoke all on private.esports_launch_gate,private.esports_role_grants,private.esports_reviewers,private.esports_authorizations,private.esports_audit,private.esports_reviews from public,anon,authenticated;
revoke all on function private.esports_role(text,uuid),private.esports_audit(text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.esports_is_admin(),public.esports_can_review(uuid),public.esports_workspace(),public.esports_submit(uuid,jsonb),public.esports_withdraw(uuid),public.esports_admin_data(text,integer),public.esports_admin_action(text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.esports_is_admin(),public.esports_can_review(uuid),public.esports_workspace(),public.esports_submit(uuid,jsonb),public.esports_withdraw(uuid),public.esports_admin_data(text,integer),public.esports_admin_action(text,uuid,integer,jsonb) to authenticated;
revoke all on function public.esports_portal() from public;grant execute on function public.esports_portal() to anon,authenticated;
