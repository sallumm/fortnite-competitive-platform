-- Incremental competitive editorial metadata; existing catalog and training data preserved.
alter table public.tournaments add column confirmation text not null default 'confirmed' check(confirmation in ('confirmed','unconfirmed')),
 add column season_label text not null default '' check(length(season_label)<=80),
 add column phases jsonb not null default '[]',
 add column result_summary text check(length(result_summary) between 10 and 4000),
 add column result_source_url text check(result_source_url ~ '^https://[^[:space:]]+$'),
 add column result_verified_at timestamptz check(result_verified_at<=now()+interval '5 minutes'),
 add constraint sourced_result check((result_summary is null and result_source_url is null and result_verified_at is null) or (result_summary is not null and result_source_url is not null and result_verified_at is not null));
create function private.valid_competitive_phases(p jsonb) returns boolean language plpgsql set search_path='' as $$
 declare x jsonb;keys text[]:='{}'; begin
 if jsonb_typeof(p)<>'array' or jsonb_array_length(p)>32 or pg_column_size(p)>60000 then return false;end if;
 for x in select value from jsonb_array_elements(p) loop
 if coalesce(x->>'key','') !~ '^[a-z0-9-]{1,60}$' or (x->>'key')=any(keys) or coalesce(length(x->>'title'),0) not between 3 and 160 or coalesce(x->>'kind','') not in ('registration','qualifier','session','final') or coalesce(x->>'status','') not in ('scheduled','finished','cancelled','postponed') or coalesce(x->>'date','')!~'^\d{4}-\d{2}-\d{2}$' or coalesce(x->>'source_url','')!~'^https://[^[:space:]]+$' or x->>'verified_at' is null or x->>'valid_until' is null then return false;end if;
 perform (x->>'date')::date;
 if (x->>'verified_at')::timestamptz>now()+interval '5 minutes' or (x->>'valid_until')::timestamptz<(x->>'verified_at')::timestamptz then return false;end if;
 if (x->>'starts_at' is null)<>(x->>'ends_at' is null) then return false;end if;
 if x->>'starts_at' is not null and (x->>'starts_at'!~'(Z|[+-][0-9]{2}:[0-9]{2})$' or x->>'ends_at'!~'(Z|[+-][0-9]{2}:[0-9]{2})$' or (x->>'ends_at')::timestamptz<=(x->>'starts_at')::timestamptz) then return false;end if;
 keys:=array_append(keys,x->>'key');
 end loop;return true;exception when others then return false;end;$$;
alter table public.tournaments add constraint valid_phases check(private.valid_competitive_phases(phases));
alter table public.articles add column topic text not null default 'competitive' check(topic in ('competitive','fncs','championships','results','updates','meta','players','organizations','analysis','guides')),
 add column tags text[] not null default '{}' check(cardinality(tags)<=12 and length(tags::text)<=600),
 add column evidence text not null default 'analysis' check(evidence in ('official','analysis','opinion')),
 add column source_published_at timestamptz;
alter table public.exercises add column skills text[] not null default '{}' check(cardinality(skills)<=12 and length(skills::text)<=600),
 add column competitive_goal text not null default '' check(length(competitive_goal)<=500),
 add column map_type text not null default '' check(length(map_type)<=80),
 add column requirements text not null default '' check(length(requirements)<=500);
create table public.competition_preparations(user_id uuid not null references public.profiles(id) on delete cascade,tournament_id uuid not null references public.tournaments(id),objective text not null default '' check(length(objective)<=500),checklist jsonb not null default '[]' check(jsonb_typeof(checklist)='array' and jsonb_array_length(checklist)<=20 and pg_column_size(checklist)<5000),primary key(user_id,tournament_id));
create function private.valid_competitive_checklist(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
 declare x jsonb;begin
 if jsonb_typeof(p)<>'array' or jsonb_array_length(p)>20 or pg_column_size(p)>=5000 then return false;end if;
 for x in select value from jsonb_array_elements(p) loop
 if jsonb_typeof(x)<>'object' or coalesce(length(trim(x->>'title')),0) not between 1 and 160 or jsonb_typeof(x->'done') is distinct from 'boolean' then return false;end if;
 end loop;return true;end;$$;
alter table public.competition_preparations add constraint valid_checklist check(private.valid_competitive_checklist(checklist));
create table public.competitive_preferences(id uuid primary key references public.profiles(id) on delete cascade,regions text[] not null default '{BR}' check(regions<@array['BR','NAC','NAW','EU','ASIA','ME','OCE','GLOBAL']::text[] and cardinality(regions) between 1 and 8),reminders_enabled boolean not null default false);
create table public.competition_proposals(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,tournament_id uuid not null references public.tournaments(id),payload jsonb not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',result uuid);
create index competition_proposal_owner on public.competition_proposals(user_id,created_at);
do $$ declare t text; begin
 foreach t in array array['competition_preparations','competitive_preferences','competition_proposals'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,delete on public.%I to authenticated',t);
 execute format('create policy owner_read on public.%I for select to authenticated using (%I=auth.uid())',t,case when t='competitive_preferences' then 'id' else 'user_id' end);
 execute format('create policy owner_delete on public.%I for delete to authenticated using (%I=auth.uid())',t,case when t='competitive_preferences' then 'id' else 'user_id' end);
 if t<>'competition_proposals' then
 execute format('grant insert,update on public.%I to authenticated',t);
 execute format('create policy owner_insert on public.%I for insert to authenticated with check (%I=auth.uid())',t,case when t='competitive_preferences' then 'id' else 'user_id' end);
 execute format('create policy owner_update on public.%I for update to authenticated using (%I=auth.uid()) with check (%I=auth.uid())',t,case when t='competitive_preferences' then 'id' else 'user_id' end,case when t='competitive_preferences' then 'id' else 'user_id' end);
 end if;end loop;end $$;
create function private.competition_activity(tid uuid,p jsonb,u uuid) returns jsonb language plpgsql set search_path='' as $$
 declare t public.tournaments;x jsonb;a timestamptz;d integer;item jsonb;begin
 if u is null or jsonb_typeof(p)<>'object' or pg_column_size(p)>2000 or coalesce(p->>'kind','') not in ('training','event') then raise exception 'Invalid proposal';end if;
 select * into t from public.tournaments where id=tid and published and confirmation='confirmed' and status='scheduled' and valid_until>=now();
 if not found then raise exception 'Clutchfolio: evento indisponível ou precisa de revisão.';end if;
 if p->>'kind'='training' then
 select coalesce(sum((value->>'minutes')::int),30) into d from public.training_plans tp cross join lateral jsonb_array_elements(tp.steps) where tp.id=(p->>'plan_id')::uuid and tp.user_id=u;
 if not exists(select 1 from public.training_plans where id=(p->>'plan_id')::uuid and user_id=u) then raise exception 'Plan unavailable';end if;
 a:=(p->>'starts_at')::timestamptz;
 if (a at time zone (select timezone from public.profiles where id=u))::date>t.end_date then raise exception 'Clutchfolio: escolha um treino anterior ao fim do campeonato.';end if;
 item:=jsonb_build_object('kind','training','title','Preparação · '||left(t.title,60),'plan_id',p->>'plan_id','starts_at',a,'duration_minutes',d);
 perform private.coach_validate_action(jsonb_build_object('kind','create','items',jsonb_build_array(item)),u);
 else
 select value into x from jsonb_array_elements(t.phases) where value->>'key'=p->>'phase_key';
 if x is null or x->>'kind'='registration' or x->>'status'<>'scheduled' or (x->>'valid_until')::timestamptz<now() or x->>'starts_at' is null then raise exception 'Clutchfolio: sessão sem horário confirmado ou indisponível.';end if;
 a:=(x->>'starts_at')::timestamptz;d:=ceil(extract(epoch from ((x->>'ends_at')::timestamptz-a))/60)::int;
 if a<now() or a>now()+interval '150 days' or d not between 1 and 240 then raise exception 'Invalid event interval';end if;
 if exists(select 1 from private.coach_agenda(u,(a at time zone 'UTC')::date-1,(a at time zone 'UTC')::date+1) e where e.status<>'cancelled' and e.starts_at<a+d*interval '1 minute' and e.starts_at+e.duration_minutes*interval '1 minute'>a) then raise exception 'Clutchfolio: conflito na agenda. Escolha outro horário.';end if;
 item:=jsonb_build_object('kind','personal','title',left(t.title||' · '||(x->>'title'),80),'plan_id',null,'starts_at',a,'duration_minutes',d);
 end if;return item;end;$$;
create function public.competition_preview(p_tournament uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare item jsonb;r public.competition_proposals;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if (select count(*) from public.competition_proposals where user_id=auth.uid() and created_at>now()-interval '1 day')>=60 then raise exception 'Proposal limit';end if;
 item:=private.competition_activity(p_tournament,p_payload,auth.uid());
 insert into public.competition_proposals(user_id,tournament_id,payload) values(auth.uid(),p_tournament,p_payload) returning * into r;
 return jsonb_build_object('id',r.id,'item',item,'expires_at',r.expires_at);end;$$;
create function public.competition_confirm(p_id uuid,p_confirmation text) returns uuid language plpgsql security definer set search_path='' as $$
 declare r public.competition_proposals;item jsonb;sid uuid;begin
 if auth.uid() is null or p_confirmation is distinct from 'CONFIRMAR' then raise exception 'Explicit confirmation required';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into r from public.competition_proposals where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Proposal unavailable';end if;
 if r.result is not null then return r.result;end if;
 if r.expires_at<now() then raise exception 'Proposal expired';end if;
 lock table public.scheduled_sessions,public.activity_series,public.calendar_exceptions in share row exclusive mode;
 -- Lock the editorial row too: a concurrent cancellation cannot race confirmation.
 perform 1 from public.tournaments where id=r.tournament_id for share;
 item:=private.competition_activity(r.tournament_id,r.payload,auth.uid());
 insert into public.scheduled_sessions(user_id,tournament_id,title,kind,plan_id,starts_at,duration_minutes) values(auth.uid(),r.tournament_id,item->>'title',item->>'kind',(item->>'plan_id')::uuid,(item->>'starts_at')::timestamptz,(item->>'duration_minutes')::int) returning id into sid;
 update public.competition_proposals set result=sid where id=r.id;return sid;end;$$;
revoke all on function private.competition_activity(uuid,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.competition_preview(uuid,jsonb),public.competition_confirm(uuid,text) from public,anon;
grant execute on function public.competition_preview(uuid,jsonb),public.competition_confirm(uuid,text) to authenticated;
-- The existing editorial audit trigger records all new columns without replacing history.
-- Public selected-event projection, no profile/favorites/history and no arbitrary URLs.
create function public.coach_competitive_event(p_tournament uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select id,slug,title,starts_at,start_date,status,valid_until,verified_at,source_url,format,left(rules,4000) rules,mode,region,confirmation,phases,result_summary,result_source_url,result_verified_at from public.tournaments where published and id=p_tournament and auth.uid() is not null limit 1) t
$$;
revoke all on function public.coach_competitive_event(uuid) from public,anon;
grant execute on function public.coach_competitive_event(uuid) to authenticated;
