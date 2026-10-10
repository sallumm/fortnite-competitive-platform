-- Additive editorial workspace. Existing knowledge and revision chains remain immutable.
create table public.meta_seasons(id text primary key check(id ~ '^[a-z0-9][a-z0-9-]{1,99}$'),title text not null check(length(title) between 3 and 300),created_at timestamptz not null default now());
insert into public.meta_seasons(id,title) select 'season-'||row_number() over(order by season),season from public.meta_versions group by season;
alter table public.meta_seasons enable row level security;
revoke all on public.meta_seasons from public,anon,authenticated;
grant select on public.meta_seasons to anon,authenticated;
grant insert on public.meta_seasons to authenticated;
create policy seasons_read on public.meta_seasons for select using(true);
create policy seasons_editor on public.meta_seasons for insert to authenticated with check(public.is_admin());
create trigger season_immutable before update or delete on public.meta_seasons for each row execute function private.meta_immutable();
create trigger season_audit after insert on public.meta_seasons for each row execute function private.audit_meta();
create table public.meta_assets(id uuid primary key default gen_random_uuid(),path text unique not null check(path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(png|jpg|webp)$'),mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp')),size_bytes int not null check(size_bytes between 12 and 3145728),status text not null default 'active' check(status in ('active','deleting')),alt text not null check(length(alt) between 3 and 300),source_url text not null check(source_url ~ '^https://[^[:space:]@]+$'),rights text not null check(length(rights) between 10 and 1000),credit text not null check(length(credit) between 3 and 300),created_at timestamptz not null default now());
create table public.meta_drafts(id uuid primary key default gen_random_uuid(),payload jsonb not null,version int not null default 1,status text not null check(status in ('draft','review','published','archived')),editor_id uuid references auth.users on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),published_entry_id text references public.meta_entries);
create index meta_drafts_updated on public.meta_drafts(updated_at desc);
create table public.meta_draft_history(id bigint generated always as identity primary key,draft_id uuid not null references public.meta_drafts,payload jsonb not null,version int not null,status text not null,actor_id uuid references auth.users on delete set null,created_at timestamptz not null default now(),unique(draft_id,version));
create table public.meta_editions(entry_id text primary key references public.meta_entries,content jsonb not null,published_at timestamptz not null default now());
create table private.meta_editor_limits(actor_id uuid not null references auth.users on delete cascade,window_start timestamptz not null,count int not null,primary key(actor_id,window_start));
create function private.meta_editor_gate() returns void language plpgsql security definer set search_path='' as $$
declare hits int;begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrative role required' using errcode='42501';end if;
 insert into private.meta_editor_limits values(auth.uid(),date_trunc('hour',clock_timestamp()),1) on conflict(actor_id,window_start) do update set count=meta_editor_limits.count+1 returning count into hits;
 if hits>120 then raise exception 'Editorial hourly limit reached';end if;
 delete from private.meta_editor_limits where window_start<clock_timestamp()-interval '2 days';
end;$$;
create function public.meta_editor_media_quota() returns void language plpgsql security definer set search_path='' as $$begin perform private.meta_editor_gate();end;$$;
create function private.validate_meta_content(p jsonb,p_complete boolean default true) returns void language plpgsql set search_path='' as $$
declare k text; v jsonb; n int; u text;begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>150000 then raise exception 'Invalid editorial payload';end if;
 if exists(select 1 from jsonb_object_keys(p) as fields(field) where fields.field<>all(array['subject_key','context_id','kind','display_kind','title','slug','summary','body','category','tags','state','availability','evidence','source_ids','verified_at','review_due','limitations','change_note','author','objective','level','prerequisites','blocks','characteristics','media_ids','videos','links'])) then raise exception 'Unknown editorial field';end if;
 foreach k in array array['subject_key','context_id','kind','display_kind','title','slug','summary','body','category','state','availability','evidence','verified_at','review_due','limitations','change_note','author','objective','level','prerequisites'] loop
  if coalesce(jsonb_typeof(p->k),'')<>'string' then raise exception 'Invalid text field: %',k;end if;
 end loop;
 foreach k in array array['subject_key','context_id','category','slug'] loop
  if p->>k is null or p->>k !~ '^[a-z0-9][a-z0-9-]{1,99}$' then raise exception 'Invalid key: %',k;end if;
 end loop;
 foreach k in array array['title','author'] loop if (length(coalesce(p->>k,''))>300 or (p_complete and length(btrim(coalesce(p->>k,'')))<3)) then raise exception 'Invalid title or author';end if;end loop;
 foreach k in array array['body','limitations','change_note'] loop if (length(coalesce(p->>k,''))>3000 or (p_complete and length(btrim(coalesce(p->>k,'')))<3)) then raise exception 'Invalid editorial text';end if;end loop;
 if (length(coalesce(p->>'summary',''))>500 or (p_complete and length(btrim(coalesce(p->>'summary','')))<3)) or p->>'kind' is null or p->>'kind' not in ('item','location','mechanic','strategy','analysis') or p->>'display_kind' is null or p->>'display_kind' not in ('item','location','mechanic','strategy','analysis','article','video','drop') then raise exception 'Invalid editorial kind or summary';end if;
 if p->>'level' is null or p->>'level' not in ('all','beginner','intermediate','advanced') or length(coalesce(p->>'objective',''))>1000 or length(coalesce(p->>'prerequisites',''))>1000 then raise exception 'Invalid strategy fields';end if;
 if not exists(select 1 from public.meta_contexts where id=p->>'context_id') then raise exception 'Unknown context';end if;
 if p->>'state' is null or p->>'state' not in ('confirmed','under_analysis','unconfirmed','stale','archived') or p->>'availability' is null or p->>'availability' not in ('available','vaulted','announced','unknown') or p->>'evidence' is null or p->>'evidence' not in ('official','professional','analysis','editorial','hypothesis') then raise exception 'Invalid knowledge state';end if;
 if p_complete and p->>'state'='confirmed' and p->>'evidence'<>'official' then raise exception 'Official evidence required';end if;
 if p_complete and p->>'state'='unconfirmed' and p->>'availability' not in ('unknown','announced') then raise exception 'Unknown availability required';end if;
 if p->>'verified_at' is null or p->>'review_due' is null or not isfinite((p->>'verified_at')::timestamptz) or not isfinite((p->>'review_due')::timestamptz) or (p->>'verified_at')::timestamptz>clock_timestamp() or (p->>'review_due')::timestamptz<=(p->>'verified_at')::timestamptz then raise exception 'Invalid verification dates';end if;
 foreach k in array array['tags','source_ids','media_ids','videos','blocks','characteristics','links'] loop
  if coalesce(jsonb_typeof(p->k),'')<>'array' or jsonb_array_length(p->k)>(case when k='tags' then 20 when k in ('source_ids','media_ids','videos') then 12 else 30 end) then raise exception 'Invalid array: %',k;end if;
 end loop;
 foreach k in array array['tags','source_ids','media_ids'] loop
  select count(distinct x) into n from jsonb_array_elements_text(p->k) x;
  if n<>jsonb_array_length(p->k) then raise exception 'Duplicate values';end if;
 end loop;
 if p_complete and jsonb_array_length(p->'source_ids')<1 then raise exception 'Source required';end if;
 for u in select jsonb_array_elements_text(p->'source_ids') loop
  if not exists(select 1 from public.meta_sources where id=u and access not in ('metadata','unavailable')) then raise exception 'Unusable source';end if;
 end loop;
 if p_complete and p->>'state'='confirmed' and not exists(select 1 from public.meta_sources where id in(select jsonb_array_elements_text(p->'source_ids')) and kind='official') then raise exception 'Official source required';end if;
 for u in select jsonb_array_elements_text(p->'media_ids') loop
  perform 1 from public.meta_assets where id=u::uuid and status='active' for key share;
  if not found then raise exception 'Unverified media';end if;
 end loop;
 for v in select value from jsonb_array_elements(p->'tags') loop if jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 3 and 300 then raise exception 'Invalid tag';end if;end loop;
 for v in select value from jsonb_array_elements(p->'blocks') loop if coalesce(jsonb_typeof(v->'heading'),'')<>'string' or coalesce(jsonb_typeof(v->'text'),'')<>'string' or (length(coalesce(v->>'heading',''))>300 or (p_complete and length(btrim(coalesce(v->>'heading','')))<3)) or (length(coalesce(v->>'text',''))>3000 or (p_complete and length(btrim(coalesce(v->>'text','')))<3)) or exists(select 1 from jsonb_object_keys(v) as fields(field) where fields.field not in ('heading','text')) then raise exception 'Invalid content block';end if;end loop;
 for v in select value from jsonb_array_elements(p->'characteristics') loop if coalesce(jsonb_typeof(v->'name'),'')<>'string' or coalesce(jsonb_typeof(v->'value'),'')<>'string' or (length(coalesce(v->>'name',''))>300 or (p_complete and length(btrim(coalesce(v->>'name','')))<3)) or (length(coalesce(v->>'value',''))>500 or (p_complete and length(btrim(coalesce(v->>'value','')))<1)) or exists(select 1 from jsonb_object_keys(v) as fields(field) where fields.field not in ('name','value')) then raise exception 'Invalid characteristic';end if;end loop;
 for v in select value from jsonb_array_elements(p->'videos') loop
  foreach k in array array['title','creator','url','source_url','description','authorization'] loop if coalesce(jsonb_typeof(v->k),'')<>'string' then raise exception 'Invalid video text';end if;end loop;
  foreach k in array array['title','creator'] loop if (length(coalesce(v->>k,''))>300 or (p_complete and length(btrim(coalesce(v->>k,'')))<3)) then raise exception 'Invalid video identity';end if;end loop;
  if (length(coalesce(v->>'description',''))>1000 or (p_complete and length(btrim(coalesce(v->>'description','')))<3)) or (length(coalesce(v->>'authorization',''))>1000 or (p_complete and length(btrim(coalesce(v->>'authorization','')))<10)) or coalesce(jsonb_typeof(v->'embed_allowed'),'')<>'boolean' then raise exception 'Video rights required';end if;
  foreach k in array array['url','source_url'] loop if (p_complete or coalesce(v->>k,'')<>'') and (coalesce(v->>k,'') !~ '^https://[^[:space:]@]+$' or length(v->>k)>2048) then raise exception 'Invalid video URL';end if;end loop;
  if p_complete and (v->>'embed_allowed')::boolean and (v->>'url') !~ '^https://(www\.|m\.)?youtube\.com/(watch\?v=[A-Za-z0-9_-]{11}(&.*)?|(embed|shorts)/[A-Za-z0-9_-]{11}(\?.*)?)$' and (v->>'url') !~ '^https://youtu\.be/[A-Za-z0-9_-]{11}(\?.*)?$' then raise exception 'Unsupported video embed';end if;
  if coalesce(jsonb_typeof(v->'timestamps'),'')<>'array' or jsonb_array_length(v->'timestamps')>30 or coalesce(jsonb_typeof(v->'tags'),'')<>'array' or jsonb_array_length(v->'tags')>12 then raise exception 'Invalid video metadata';end if;
  if exists(select 1 from jsonb_array_elements(v->'timestamps') t where coalesce(jsonb_typeof(t->'label'),'')<>'string' or coalesce(jsonb_typeof(t->'seconds'),'')<>'number' or coalesce(t->>'seconds','') !~ '^[0-9]{1,5}$' or (t->>'seconds')::int>86400 or (length(coalesce(t->>'label',''))>300 or (p_complete and length(btrim(coalesce(t->>'label','')))<3))) then raise exception 'Invalid timestamp';end if;
  if exists(select 1 from jsonb_object_keys(v) as fields(field) where fields.field not in ('title','creator','url','description','source_url','authorization','embed_allowed','tags','timestamps')) then raise exception 'Unknown video field';end if;
 end loop;
 for v in select value from jsonb_array_elements(p->'links') loop
  foreach k in array array['target_kind','target_id','reason'] loop if coalesce(jsonb_typeof(v->k),'')<>'string' then raise exception 'Invalid relation text';end if;end loop;
  if coalesce(v->>'target_kind','') not in ('competency','exercise','article','tournament') or (length(coalesce(v->>'target_id',''))>100 or (p_complete and length(btrim(coalesce(v->>'target_id','')))<2)) or (length(coalesce(v->>'reason',''))>1000 or (p_complete and length(btrim(coalesce(v->>'reason','')))<3)) or exists(select 1 from jsonb_object_keys(v) as fields(field) where fields.field not in ('target_kind','target_id','reason')) then raise exception 'Invalid public content relation';end if;
 end loop;
end;$$;
create function public.save_meta_draft(p_payload jsonb,p_status text,p_id uuid default null,p_expected int default 0) returns public.meta_drafts language plpgsql security definer set search_path='' as $$
declare d public.meta_drafts;begin
 perform private.meta_editor_gate();perform private.validate_meta_content(p_payload,p_status='review');
 if p_status not in ('draft','review') then raise exception 'Invalid workflow transition';end if;
 if p_id is null then
  insert into public.meta_drafts(payload,status,editor_id,published_entry_id) values(p_payload,p_status,auth.uid(),(select id from public.meta_entries where subject_key=p_payload->>'subject_key' and context_id=p_payload->>'context_id' order by revision desc limit 1)) returning * into d;
 else
  select * into d from public.meta_drafts where id=p_id for update;
  if not found or d.version<>p_expected then raise exception 'Draft changed; reload before saving';end if;
  if d.payload->>'subject_key'<>p_payload->>'subject_key' or d.payload->>'context_id'<>p_payload->>'context_id' then raise exception 'Stable identity cannot change; create another context edition';end if;
  update public.meta_drafts set payload=p_payload,status=p_status,editor_id=auth.uid(),version=version+1,updated_at=clock_timestamp() where id=p_id returning * into d;
 end if;
 insert into public.meta_draft_history(draft_id,payload,version,status,actor_id) values(d.id,d.payload,d.version,d.status,auth.uid());return d;
end;$$;
create function public.publish_meta_draft(p_id uuid,p_expected int,p_withdraw boolean default false) returns text language plpgsql security definer set search_path='' as $$
declare d public.meta_drafts;p jsonb;prev public.meta_entries;e text;v jsonb;begin
 perform private.meta_editor_gate();
 select * into d from public.meta_drafts where id=p_id for update;
 if not found or d.version<>p_expected then raise exception 'Draft changed; reload before publishing';end if;
 if (not p_withdraw and d.status<>'review') or (p_withdraw and (d.published_entry_id is null or d.status<>'published')) then raise exception 'Review or previous publication required';end if;
 p=d.payload;perform private.validate_meta_content(p);
 -- Serialize the entire read/build/insert chain, not just the final INSERT.
 lock table public.meta_entries in share row exclusive mode;
 select * into prev from public.meta_entries where subject_key=p->>'subject_key' and context_id=p->>'context_id' order by revision desc limit 1;
 if d.published_entry_id is distinct from prev.id then raise exception 'Publication changed; create revision from the latest edition';end if;
 if exists(select 1 from public.meta_editions ed join public.meta_entries me on me.id=ed.entry_id where me.context_id=p->>'context_id' and ed.content->>'slug'=p->>'slug' and me.subject_key<>p->>'subject_key') then raise exception 'Slug already used in this context';end if;
 e='meta-'||gen_random_uuid()::text;
 insert into public.meta_entries(id,subject_key,context_id,revision,previous_id,kind,title,category,body,state,availability,evidence,source_ids,verified_at,valid_from,review_due,limitations,change_note)
 values(e,p->>'subject_key',p->>'context_id',coalesce(prev.revision,0)+1,prev.id,p->>'kind',p->>'title',p->>'category',p->>'body',case when p_withdraw then 'archived' else p->>'state' end,p->>'availability',p->>'evidence',array(select jsonb_array_elements_text(p->'source_ids')),(p->>'verified_at')::timestamptz,clock_timestamp(),(p->>'review_due')::timestamptz,p->>'limitations',p->>'change_note');
 if not p_withdraw then
  insert into public.meta_editions(entry_id,content) values(e,p);
  for v in select value from jsonb_array_elements(p->'links') loop insert into public.meta_links values('link-'||gen_random_uuid()::text,e,v->>'target_kind',v->>'target_id',v->>'reason');end loop;
 end if;
 update public.meta_drafts set published_entry_id=e,status=case when p_withdraw then 'archived' else 'published' end,version=version+1,editor_id=auth.uid(),updated_at=clock_timestamp() where id=p_id returning * into d;
 insert into public.meta_draft_history(draft_id,payload,version,status,actor_id) values(d.id,d.payload,d.version,d.status,auth.uid());return e;
end;$$;
create function public.restore_meta_draft(p_id uuid,p_expected int,p_version int) returns public.meta_drafts language plpgsql security definer set search_path='' as $$
declare p jsonb;d public.meta_drafts;begin
 if not public.is_admin() then raise exception 'Administrative role required' using errcode='42501';end if;
 select payload into p from public.meta_draft_history where draft_id=p_id and version=p_version;
 if p is null then raise exception 'Missing revision';end if;
 select * into d from public.save_meta_draft(p,'draft',p_id,p_expected);return d;
end;$$;
-- Public media and extended pages are visible only while the latest contextual edition is active.
create function public.meta_entry_visible(e text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.meta_entries a where a.id=e and a.valid_from<=now() and a.state<>'archived' and not exists(select 1 from public.meta_entries b where b.context_id=a.context_id and b.subject_key=a.subject_key and b.revision>a.revision and b.valid_from<=now() and b.state='archived'));
$$;
create function public.meta_asset_visible(a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.meta_assets where id=a and status='active') and (public.is_admin() or exists(select 1 from public.meta_editions e where public.meta_entry_visible(e.entry_id) and e.content->'media_ids' ? a::text));
$$;
alter table public.meta_assets enable row level security;
alter table public.meta_drafts enable row level security;
alter table public.meta_draft_history enable row level security;
alter table public.meta_editions enable row level security;
revoke all on public.meta_assets,public.meta_drafts,public.meta_draft_history,public.meta_editions from public,anon,authenticated;
grant select on public.meta_assets,public.meta_editions to anon,authenticated;
grant select on public.meta_drafts,public.meta_draft_history to authenticated;
create policy assets_read on public.meta_assets for select using(public.meta_asset_visible(id));
create policy drafts_admin on public.meta_drafts for select to authenticated using(public.is_admin());
create policy draft_history_admin on public.meta_draft_history for select to authenticated using(public.is_admin());
create policy editions_read on public.meta_editions for select using(public.is_admin() or public.meta_entry_visible(entry_id));
create trigger edition_immutable before update or delete on public.meta_editions for each row execute function private.meta_immutable();
-- The Edge Function is the only writer of validated binary metadata.
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then
 execute 'grant select,insert,update,delete on public.meta_assets to service_role';
 end if;end;$$;
revoke all on function private.meta_editor_gate(),private.validate_meta_content(jsonb,boolean) from public,anon,authenticated;
revoke all on function public.save_meta_draft(jsonb,text,uuid,int),public.publish_meta_draft(uuid,int,boolean),public.restore_meta_draft(uuid,int,int),public.meta_editor_media_quota() from public,anon;
grant execute on function public.save_meta_draft(jsonb,text,uuid,int),public.publish_meta_draft(uuid,int,boolean),public.restore_meta_draft(uuid,int,int),public.meta_editor_media_quota() to authenticated;
revoke all on function public.meta_entry_visible(text),public.meta_asset_visible(uuid) from public;
grant execute on function public.meta_entry_visible(text),public.meta_asset_visible(uuid) to anon,authenticated;
-- Real Supabase has Storage; PGlite schema-only tests intentionally do not emulate its HTTP server.
do $$begin if to_regclass('storage.buckets') is not null then
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('meta-images','meta-images',false,3145728,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
 execute $policy$create policy meta_image_read on storage.objects for select to anon,authenticated using(bucket_id='meta-images' and exists(select 1 from public.meta_assets a where a.path=name and public.meta_asset_visible(a.id)))$policy$;

 execute $policy$create policy meta_image_read_guard on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'meta-images' or exists(select 1 from public.meta_assets a where a.path=name and public.meta_asset_visible(a.id)))$policy$;
 execute $policy$create policy meta_image_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'meta-images')$policy$;
 execute $policy$create policy meta_image_update_guard on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'meta-images') with check(bucket_id<>'meta-images')$policy$;
 execute $policy$create policy meta_image_delete_guard on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'meta-images')$policy$;
 -- No client INSERT/UPDATE/DELETE: only the verified server upload endpoint can mutate objects.
 end if;end;$$;

create function public.meta_asset_removable(a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() and not exists(select 1 from public.meta_editions where content->'media_ids' ? a::text) and not exists(select 1 from public.meta_drafts where payload->'media_ids' ? a::text);
$$;
revoke all on function public.meta_asset_removable(uuid) from public,anon;
grant execute on function public.meta_asset_removable(uuid) to authenticated;

alter table public.meta_seasons add constraint meta_season_title_unique unique(title);
alter table public.meta_versions add constraint meta_registered_season foreign key(season) references public.meta_seasons(title);
create function private.meta_registry_gate() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null then perform private.meta_editor_gate();end if;
 if new.id !~ '^[a-z0-9][a-z0-9-]{1,99}$' then raise exception 'Invalid registry key';end if;
 if tg_table_name='meta_modes' or tg_table_name='meta_formats' then
  if length(new.title) not between 3 and 300 then raise exception 'Invalid registry title';end if;
 end if;
 if tg_table_name='meta_sources' then
  if new.url !~ '^https://[^[:space:]@]+$' or new.url ~ '^https://(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)' or length(new.url)>2048 or new.verified_at>clock_timestamp() then raise exception 'Unsafe or future source';end if;
 end if;
 return new;
end;$$;
revoke all on function private.meta_registry_gate() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['meta_seasons','meta_versions','meta_modes','meta_formats','meta_contexts','meta_sources'] loop execute format('create trigger registry_gate before insert on public.%I for each row execute function private.meta_registry_gate()',t);end loop;end;$$;

-- Reserve deletion under a row lock. Draft validation acquires the matching key-share lock,
-- so a concurrent association cannot race a server-side file removal.
create table public.meta_media_audit(id bigint generated always as identity primary key,asset_id uuid not null,action text not null check(action in ('upload','removal_reserved')),actor_id uuid references auth.users on delete set null,created_at timestamptz not null default now());
alter table public.meta_media_audit enable row level security;
revoke all on public.meta_media_audit from public,anon,authenticated;
grant select on public.meta_media_audit to authenticated;
create policy media_audit_admin on public.meta_media_audit for select to authenticated using(public.is_admin());
create function public.register_meta_asset(p_path text,p_size int,p_info jsonb,p_actor uuid) returns public.meta_assets language plpgsql security definer set search_path='' as $$
declare m public.meta_assets;begin
 if not exists(select 1 from private.user_roles where user_id=p_actor and role='admin') then raise exception 'Administrative actor required';end if;
 if split_part(p_path,'/',1)<>p_actor::text then raise exception 'Invalid upload ownership';end if;
 insert into public.meta_assets(path,mime_type,size_bytes,alt,source_url,rights,credit) values(p_path,'image/png',p_size,p_info->>'alt',p_info->>'source_url',p_info->>'rights',p_info->>'credit') returning * into m;
 insert into public.meta_media_audit(asset_id,action,actor_id) values(m.id,'upload',p_actor);return m;
end;$$;
revoke all on function public.register_meta_asset(text,int,jsonb,uuid) from public,anon,authenticated;
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant execute on function public.register_meta_asset(text,int,jsonb,uuid) to service_role';end if;end;$$;
create function public.reserve_meta_asset_remove(a uuid) returns public.meta_assets language plpgsql security definer set search_path='' as $$
declare m public.meta_assets;begin
 perform private.meta_editor_gate();
 select * into m from public.meta_assets where id=a for update;
 if not found or not public.meta_asset_removable(a) then raise exception 'Referenced media cannot be removed';end if;
 update public.meta_assets set status='deleting' where id=a returning * into m;
 insert into public.meta_media_audit(asset_id,action,actor_id) values(a,'removal_reserved',auth.uid());return m;
end;$$;

revoke all on function public.reserve_meta_asset_remove(uuid) from public,anon;
grant execute on function public.reserve_meta_asset_remove(uuid) to authenticated;
