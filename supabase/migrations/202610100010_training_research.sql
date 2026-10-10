-- Additive, version-controlled public knowledge. No private player records or XP changes.
create table public.training_knowledge (
 id text not null check (id ~ '^[a-z0-9-]{1,60}$'),
 kind text not null check(kind in ('reference','competency','principle','path')),
 version text not null check(length(version) between 1 and 40),
 content jsonb not null check(jsonb_typeof(content)='object' and pg_column_size(content)<15000 and content->>'id'=id),
 primary key(kind,id)
);
alter table public.training_knowledge enable row level security;
grant select on public.training_knowledge to anon,authenticated;
create policy public_knowledge on public.training_knowledge for select to anon,authenticated using(true);
-- Corpus edits go through reviewed migrations, not arbitrary client writes.
revoke insert,update,delete on public.training_knowledge from anon,authenticated;
alter table public.exercises add column research jsonb;
create function private.validate_exercise_research() returns trigger language plpgsql set search_path='' as $$
declare r jsonb:=new.research; k text; x jsonb; n integer;
begin
 if r is null then return new; end if;
 if jsonb_typeof(r)<>'object' or pg_column_size(r)>8000 or
    coalesce(r->>'purpose','') not in ('warmup','technical','contextual','competitive','review') or
    coalesce(r->>'review_status','') not in ('pending','verified','retired') then raise exception 'Invalid exercise research';end if;
 if exists(select 1 from jsonb_object_keys(r) key where key not in ('competency_ids','evidence_ids','purpose','completion','transfer','limitations','review_status','review_due_at','review_notes')) then raise exception 'Unknown research field';end if;
 foreach k in array array['completion','transfer','limitations','review_notes'] loop
  if jsonb_typeof(r->k) is distinct from 'string' or length(trim(r->>k)) not between (case when k='review_notes' then 10 else 20 end) and 1000 then raise exception 'Missing research explanation';end if;
 end loop;
 foreach k in array array['competency_ids','evidence_ids'] loop
  if jsonb_typeof(r->k) is distinct from 'array' or jsonb_array_length(r->k) not between 1 and 12 then raise exception 'Missing research references';end if;
  select count(distinct value) into n from jsonb_array_elements(r->k);
  if n<>jsonb_array_length(r->k) then raise exception 'Duplicate research references';end if;
  for x in select value from jsonb_array_elements(r->k) loop
   if jsonb_typeof(x)<>'string' then raise exception 'Invalid reference ID';end if;
   if k='evidence_ids' then
    if not exists(select 1 from public.training_knowledge where kind='reference' and id=x#>>'{}' and content->>'access'<>'unavailable') then raise exception 'Unverified research reference';end if;
   else
    if not exists(select 1 from public.training_knowledge where kind='competency' and id=x#>>'{}' and (content->>'mode'='both' or content->>'mode'=new.mode)) then raise exception 'Incompatible competency';end if;
   end if;
  end loop;
 end loop;
 if coalesce(r->>'review_due_at','')!~'(Z|[+-][0-9]{2}:[0-9]{2})$' or (r->>'review_due_at')::timestamptz<new.verified_at then raise exception 'Invalid review date';end if;
 if new.published and r->>'review_status'='retired' then raise exception 'Unpublish retired exercise';end if;
 return new;
end;$$;
revoke all on function private.validate_exercise_research() from public,anon,authenticated;
create trigger validate_research before insert or update on public.exercises for each row execute function private.validate_exercise_research();
-- Existing editorial revisions trigger records research and review changes.
create index exercise_review_due on public.exercises ((research->>'review_due_at')) where research is not null;
