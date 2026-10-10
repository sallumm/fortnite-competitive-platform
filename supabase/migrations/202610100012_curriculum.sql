-- Extend the existing editorial CMS. Historical articles and private records remain intact.
alter table public.articles add column curriculum jsonb;
create function private.lock_curriculum_graph() returns trigger language plpgsql set search_path='' as $$
begin
 lock table public.articles in share row exclusive mode;
 return null;
end;$$;
create trigger curriculum_graph_lock before insert or update or delete on public.articles for each statement execute function private.lock_curriculum_graph();
create function private.validate_curriculum() returns trigger language plpgsql set search_path='' as $$
declare c jsonb; k text; x jsonb; p public.articles; n integer;
begin
 if tg_op='DELETE' then
  if exists(select 1 from public.articles a where a.id<>old.id and a.curriculum->'prerequisites' ? old.slug) then raise exception 'Lesson has dependants';end if;
  return old;
 end if;
 if tg_op='UPDATE' and (new.slug<>old.slug or new.curriculum is null or new.kind<>'lesson' or not new.published or new.published_at>old.published_at) then
  if exists(select 1 from public.articles a where a.id<>old.id and a.curriculum->'prerequisites' ? old.slug and (new.slug<>old.slug or new.curriculum is null or new.kind<>'lesson' or (a.published and (not new.published or new.published_at>a.published_at)))) then raise exception 'Update would break prerequisites';end if;
 end if;
 c:=new.curriculum;
 if c is null then return new;end if;
 if jsonb_typeof(c)<>'object' or pg_column_size(c)>12000 or new.kind<>'lesson' or new.valid_until is null or
    c->>'classification' is distinct from 'editorial' or coalesce(c->>'phase','') not in ('foundation','early','mid','endgame','review') or coalesce(c->>'experience','') not in ('br','reload','all') or
    jsonb_typeof(c->'level') is distinct from 'number' or c->>'level' !~ '^[0-5]$' then raise exception 'Invalid curriculum';end if;
 if exists(select 1 from jsonb_object_keys(c) key where key not in ('version','level','domain','modes','experience','phase','prerequisites','objectives','assessment','exercise_ids','competency_ids','meta_scope','classification','sources')) then raise exception 'Unknown curriculum field';end if;
 foreach k in array array['version','domain','meta_scope'] loop
  if jsonb_typeof(c->k) is distinct from 'string' or length(trim(c->>k)) not between (case when k='meta_scope' then 20 else 1 end) and (case when k='version' then 40 when k='domain' then 100 else 500 end) then raise exception 'Invalid curriculum text';end if;
 end loop;
 if c->>'domain' !~ '^[a-z0-9-]{3,100}$' then raise exception 'Invalid domain';end if;
 foreach k in array array['modes','prerequisites','objectives','assessment','exercise_ids','competency_ids','sources'] loop
  if jsonb_typeof(c->k) is distinct from 'array' then raise exception 'Missing curriculum list';end if;
  n:=jsonb_array_length(c->k);
  if n>(case when k='modes' then 2 when k in ('objectives','assessment') then 6 when k='sources' then 8 else 12 end) or (k in ('modes','objectives','assessment','sources') and n=0) then raise exception 'Invalid list length';end if;
 end loop;
 foreach k in array array['modes','prerequisites','exercise_ids','competency_ids'] loop
  if (select count(distinct value) from jsonb_array_elements(c->k))<>jsonb_array_length(c->k) then raise exception 'Duplicate curriculum entries';end if;
 end loop;
 foreach k in array array['objectives','assessment'] loop
  for x in select value from jsonb_array_elements(c->k) loop
   if jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 10 and 500 then raise exception 'Invalid learning criterion';end if;
  end loop;
 end loop;
 for x in select value from jsonb_array_elements(c->'modes') loop
  if jsonb_typeof(x)<>'string' or x#>>'{}' not in ('build','zero') then raise exception 'Invalid learning mode';end if;
 end loop;
 if tg_op='UPDATE' and exists(select 1 from public.articles a where a.id<>new.id and a.curriculum->'prerequisites' ? old.slug and not ((c->'modes') @> (a.curriculum->'modes'))) then raise exception 'Update would break prerequisite modes';end if;
 for x in select value from jsonb_array_elements(c->'exercise_ids') loop
  if jsonb_typeof(x)<>'string' or not exists(select 1 from public.exercises e where e.id::text=x#>>'{}' and (not new.published or e.published) and (e.mode='both' or (jsonb_array_length(c->'modes')=1 and c->'modes' ? e.mode))) then raise exception 'Missing or incompatible exercise';end if;
 end loop;
 for x in select value from jsonb_array_elements(c->'competency_ids') loop
  if jsonb_typeof(x)<>'string' or not exists(select 1 from public.training_knowledge t where t.kind='competency' and t.id=x#>>'{}' and (t.content->>'mode'='both' or (jsonb_array_length(c->'modes')=1 and c->'modes' ? (t.content->>'mode')))) then raise exception 'Missing or incompatible competency';end if;
 end loop;
 for x in select value from jsonb_array_elements(c->'sources') loop
  if jsonb_typeof(x)<>'object' or exists(select 1 from jsonb_object_keys(x) key where key not in ('title','url','kind','access','supports')) or
     coalesce(x->>'kind','') not in ('official','professional','scientific') or coalesce(x->>'access','') not in ('page','listing','abstract','metadata','text_sections') then raise exception 'Invalid learning source';end if;
  foreach k in array array['title','url','supports'] loop
   if jsonb_typeof(x->k) is distinct from 'string' or length(trim(x->>k)) not between (case when k='title' then 3 when k='supports' then 10 else 8 end) and (case when k='title' then 160 when k='supports' then 500 else 2048 end) then raise exception 'Missing source explanation';end if;
  end loop;
  if x->>'url' !~ '^https://[^[:space:]]+$' then raise exception 'Source must use HTTPS';end if;
 end loop;
 for x in select value from jsonb_array_elements(c->'prerequisites') loop
  if jsonb_typeof(x)<>'string' or x#>>'{}' !~ '^[a-z0-9-]{3,100}$' or x#>>'{}'=new.slug then raise exception 'Invalid prerequisite';end if;
  select * into p from public.articles a where a.slug=x#>>'{}' and a.id<>new.id;
  if not found or p.curriculum is null or (new.published and (not p.published or p.published_at>new.published_at)) or not ((p.curriculum->'modes') @> (c->'modes')) then raise exception 'Unavailable prerequisite';end if;
 end loop;
 if exists(with recursive reachable(slug) as (
  select value#>>'{}' from jsonb_array_elements(c->'prerequisites')
  union
  select x.value#>>'{}' from reachable r join public.articles a on a.slug=r.slug cross join lateral jsonb_array_elements(a.curriculum->'prerequisites') x
 ) select 1 from reachable where slug=new.slug) then raise exception 'Curriculum cycle';end if;
 return new;
end;$$;
create trigger curriculum_validation before insert or update or delete on public.articles for each row execute function private.validate_curriculum();
-- Existing published_read/admin_write RLS and editorial revision triggers cover this column.
create index articles_curriculum_level on public.articles((curriculum->>'level')) where curriculum is not null;
revoke all on function private.lock_curriculum_graph(),private.validate_curriculum() from public,anon,authenticated;
