-- Additive public editorial knowledge. No player data, auth, XP or routines are modified.
create table public.meta_versions(id text primary key check(id ~ '^[a-z0-9][a-z0-9-]{1,99}$'),season text not null check(length(season) between 3 and 300),patch text not null check(length(patch) between 3 and 30),released_on date);
create table public.meta_modes(id text primary key,title text not null,construction boolean not null);
create table public.meta_formats(id text primary key,title text not null,size int check(size between 1 and 100));
create table public.meta_sources(id text primary key,title text not null check(length(title) between 3 and 3000),url text not null check(url ~ '^https://[^[:space:]]+$'),kind text not null check(kind in ('official','professional','analysis','editorial')),access text not null check(access in ('page','listing','metadata','transcript','audiovisual','unavailable')),published_on date,verified_at timestamptz not null check(isfinite(verified_at)),limitations text not null check(length(limitations) between 3 and 3000));
create table public.meta_contexts(id text primary key,version_id text not null references public.meta_versions(id),mode_id text not null references public.meta_modes(id),format_id text not null references public.meta_formats(id),play_context text not null check(play_context in ('casual','ranked','tournament')),region text not null check(length(region) between 2 and 100),event_key text,check((play_context='tournament')=(event_key is not null)),unique(version_id,mode_id,format_id,play_context,region,event_key));
create unique index meta_context_dimensions on public.meta_contexts(version_id,mode_id,format_id,play_context,region,coalesce(event_key,''));
create table public.meta_entries(
 id text primary key check(id ~ '^[a-z0-9][a-z0-9-]{1,99}$'),subject_key text not null check(subject_key ~ '^[a-z0-9][a-z0-9-]{1,99}$'),context_id text not null references public.meta_contexts(id),revision int not null check(revision between 1 and 10000),previous_id text references public.meta_entries(id),
 kind text not null check(kind in ('item','location','mechanic','strategy','analysis')),title text not null check(length(title) between 3 and 3000),category text not null check(category ~ '^[a-z0-9][a-z0-9-]{1,99}$'),body text not null check(length(body) between 3 and 3000),state text not null check(state in ('confirmed','under_analysis','unconfirmed','stale','archived')),availability text not null check(availability in ('available','vaulted','announced','unknown')),evidence text not null check(evidence in ('official','professional','analysis','editorial','hypothesis')),source_ids text[] not null check(cardinality(source_ids) between 1 and 12),verified_at timestamptz not null check(isfinite(verified_at)),valid_from timestamptz not null check(isfinite(valid_from)),review_due timestamptz not null check(isfinite(review_due) and review_due>verified_at),limitations text not null check(length(limitations) between 3 and 3000),change_note text not null check(length(change_note) between 3 and 3000),created_at timestamptz not null default now(),
 check((revision=1)=(previous_id is null)),check(state<>'confirmed' or evidence='official'),check(state<>'unconfirmed' or availability in ('unknown','announced')),unique(context_id,subject_key,revision)
);
create index meta_context_current on public.meta_entries(context_id,subject_key,revision desc);
create index meta_review_due on public.meta_entries(review_due);
create table public.meta_links(id text primary key,entry_id text not null references public.meta_entries(id),target_kind text not null check(target_kind in ('competency','exercise','article','tournament')),target_id text not null,reason text not null check(length(reason) between 3 and 3000),unique(entry_id,target_kind,target_id));
create index meta_links_target on public.meta_links(target_kind,target_id);
create function private.meta_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Meta knowledge is append-only: publish a new version or revision';end;$$;
create function private.meta_serialize() returns trigger language plpgsql security definer set search_path='' as $$begin lock table public.meta_entries in share row exclusive mode;return null;end;$$;
create trigger serialize_revisions before insert on public.meta_entries for each statement execute function private.meta_serialize();
create function private.validate_meta_entry() returns trigger language plpgsql set search_path='' as $$
declare p public.meta_entries; n int; s public.meta_sources;
begin
 if new.verified_at>clock_timestamp() then raise exception 'Future verification';end if;
 select * into p from public.meta_entries where context_id=new.context_id and subject_key=new.subject_key order by revision desc limit 1;
 if new.revision<>coalesce(p.revision,0)+1 or new.previous_id is distinct from p.id then raise exception 'Stale revision chain';end if;
 if p.id is not null and new.valid_from<p.valid_from then raise exception 'Revision validity cannot move backwards';end if;
 select count(distinct x) into n from unnest(new.source_ids) x;
 if n<>cardinality(new.source_ids) then raise exception 'Duplicate source';end if;
 foreach s.id in array new.source_ids loop
  select * into s from public.meta_sources where id=s.id;
  if not found or s.access in ('metadata','unavailable') then raise exception 'Unusable source';end if;
 end loop;
 if new.state='confirmed' and not exists(select 1 from public.meta_sources where id=any(new.source_ids) and kind='official') then raise exception 'Official source required';end if;
 return new;
end;$$;
create trigger validate_entry before insert on public.meta_entries for each row execute function private.validate_meta_entry();
create function private.validate_meta_link() returns trigger language plpgsql set search_path='' as $$
declare m boolean; ok boolean;begin
 select mm.construction into m from public.meta_entries e join public.meta_contexts c on c.id=e.context_id join public.meta_modes mm on mm.id=c.mode_id where e.id=new.entry_id;
 if new.target_kind='competency' then
  select exists(select 1 from public.training_knowledge where kind='competency' and id=new.target_id and (content->>'mode'='both' or content->>'mode'=case when m then 'build' else 'zero' end)) into ok;
 elsif new.target_kind='exercise' then
  select exists(select 1 from public.exercises where id=new.target_id::uuid and published and (mode='both' or mode=case when m then 'build' else 'zero' end)) into ok;
 elsif new.target_kind='article' then
  select exists(select 1 from public.articles where id=new.target_id::uuid and published and published_at<=now() and (curriculum is null or curriculum->'modes' ? case when m then 'build' else 'zero' end)) into ok;
 else
  select exists(select 1 from public.tournaments where id=new.target_id::uuid and published and (mode='both' or mode=case when m then 'build' else 'zero' end)) into ok;
 end if;
 if not coalesce(ok,false) then raise exception 'Missing or incompatible public training target';end if;return new;
end;$$;
create trigger validate_link before insert on public.meta_links for each row execute function private.validate_meta_link();
-- Existing audit uses UUID record IDs. This text-key corpus needs a complementary private audit.
create table public.meta_editorial_audit(id bigint generated always as identity primary key,table_name text not null,record_id text not null,actor_id uuid references auth.users(id) on delete set null,created_at timestamptz not null default now());
alter table public.meta_editorial_audit enable row level security;
revoke all on public.meta_editorial_audit from public,anon,authenticated;
grant select on public.meta_editorial_audit to authenticated;
create policy editorial_audit on public.meta_editorial_audit for select to authenticated using((select public.is_admin()));
create function private.audit_meta() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.meta_editorial_audit(table_name,record_id,actor_id) values(tg_table_name,new.id,auth.uid());return new;end;$$;
revoke all on function private.audit_meta() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['meta_versions','meta_modes','meta_formats','meta_sources','meta_contexts','meta_entries','meta_links'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to anon,authenticated',t);
  execute format('grant insert on public.%I to authenticated',t);
  execute format('create policy public_knowledge on public.%I for select to anon,authenticated using(true)',t);
  execute format('create policy editor_append on public.%I for insert to authenticated with check((select public.is_admin()))',t);
  execute format('create trigger immutable before update or delete on public.%I for each row execute function private.meta_immutable()',t);
  execute format('create trigger audit_change after insert on public.%I for each row execute function private.audit_meta()',t);
 end loop;
end;$$;
revoke all on function private.meta_immutable(),private.meta_serialize(),private.validate_meta_entry(),private.validate_meta_link() from public,anon,authenticated;
