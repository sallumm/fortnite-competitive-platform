-- Additive educational records; reading is never proof of practical skill or XP.
alter table public.articles add column academy_questions jsonb not null default '[]'::jsonb;
create function private.validate_academy_questions() returns trigger language plpgsql set search_path='' as $$
declare q jsonb; o jsonb;
begin
 if jsonb_typeof(new.academy_questions)<>'array' or jsonb_array_length(new.academy_questions)>12 or pg_column_size(new.academy_questions)>30000 then raise exception 'Invalid assessment';end if;
 if jsonb_array_length(new.academy_questions)>0 and (new.kind<>'lesson' or new.curriculum is null) then raise exception 'Assessment requires curriculum';end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(new.academy_questions) x)<>jsonb_array_length(new.academy_questions) then raise exception 'Duplicate question';end if;
 for q in select value from jsonb_array_elements(new.academy_questions) loop
  if jsonb_typeof(q)<>'object' or exists(select 1 from jsonb_object_keys(q) k where k not in ('id','prompt','options','answer','explanation')) or q->>'id' !~ '^[a-z0-9-]{3,60}$' or jsonb_typeof(q->'id') is distinct from 'string' then raise exception 'Invalid question';end if;
  if jsonb_typeof(q->'prompt') is distinct from 'string' or length(btrim(q->>'prompt')) not between 10 and 1000 or jsonb_typeof(q->'explanation') is distinct from 'string' or length(btrim(q->>'explanation')) not between 10 and 1000 then raise exception 'Missing explanation';end if;
  if jsonb_typeof(q->'options') is distinct from 'array' then raise exception 'Invalid options';end if;
  if jsonb_array_length(q->'options') not between 2 and 5 or jsonb_typeof(q->'answer') is distinct from 'number' or q->>'answer' !~ '^[0-4]$' or (q->>'answer')::int>=jsonb_array_length(q->'options') then raise exception 'Invalid answer';end if;
  for o in select value from jsonb_array_elements(q->'options') loop
   if jsonb_typeof(o)<>'string' or length(btrim(o#>>'{}')) not between 1 and 500 then raise exception 'Invalid option';end if;
  end loop;
 end loop;return new;
end;$$;
create trigger academy_questions_validation before insert or update on public.articles for each row execute function private.validate_academy_questions();
create table public.academy_records(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 lesson_id uuid not null, action text not null check(action in ('started','completed','reviewed','assessment')),
 snapshot jsonb not null, answers jsonb not null default '[]',created_at timestamptz not null default now()
);
-- lesson_id deliberately has no delete cascade: snapshots survive archival/deletion of source content.
create table public.academy_notes(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 lesson_id uuid not null,note text not null default '' check(length(note)<=4000),difficulty text not null default '' check(length(difficulty)<=1000),favorite boolean not null default false,updated_at timestamptz not null default now(),unique(user_id,lesson_id)
);
alter table public.academy_records enable row level security;
alter table public.academy_notes enable row level security;
create policy own_study on public.academy_records for select to authenticated using(user_id=(select auth.uid()));
create policy own_notes on public.academy_notes for select to authenticated using(user_id=(select auth.uid()));
grant select on public.academy_records,public.academy_notes to authenticated;
create index academy_records_user_date on public.academy_records(user_id,created_at desc);
create function public.record_academy_study(p_lesson uuid,p_action text,p_answers jsonb default '[]') returns uuid language plpgsql security definer set search_path='' as $$
declare a public.articles; u uuid:=auth.uid(); rid uuid; q jsonb; i int:=0; v jsonb;
begin
 if u is null then raise exception 'Authentication required';end if;
 select * into a from public.articles where id=p_lesson and kind='lesson' and curriculum is not null and published and published_at<=now() for share;
 if not found or p_action not in ('started','completed','reviewed','assessment') or p_action is null then raise exception 'Unavailable lesson or action';end if;
 -- Serialize each player's bounded operational quota, without exposing diagnostics.
 perform pg_advisory_xact_lock(hashtextextended(u::text,17017));
 if (select count(*) from public.academy_records where user_id=u and created_at>now()-interval '1 hour')>=120 then raise exception 'Study limit reached';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)>12 then raise exception 'Invalid answers';end if;
 if p_action='assessment' then
  if jsonb_array_length(a.academy_questions)=0 or jsonb_array_length(p_answers)<>jsonb_array_length(a.academy_questions) then raise exception 'Complete assessment required';end if;
  for q in select value from jsonb_array_elements(a.academy_questions) loop
   v:=p_answers->i;
   if jsonb_typeof(v)<>'number' or v#>>'{}' !~ '^[0-4]$' or (v#>>'{}')::int>=jsonb_array_length(q->'options') then raise exception 'Invalid answer';end if;i:=i+1;
  end loop;
 elsif jsonb_array_length(p_answers)<>0 then raise exception 'Unexpected answers';end if;
 insert into public.academy_records(user_id,lesson_id,action,snapshot,answers) values(u,a.id,p_action,jsonb_build_object('title',a.title,'slug',a.slug,'version',a.curriculum->>'version','questions',a.academy_questions,'body',a.body,'curriculum',a.curriculum,'verified_at',a.verified_at),p_answers) returning id into rid;
 return rid;
end;$$;
create function public.save_academy_note(p_lesson uuid,p_note text,p_difficulty text,p_favorite boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_note is null or length(p_note)>4000 or p_difficulty is null or length(p_difficulty)>1000 or p_favorite is null then raise exception 'Invalid note';end if;
 if not exists(select 1 from public.articles where id=p_lesson and kind='lesson' and published and published_at<=now() and curriculum is not null) then raise exception 'Unavailable lesson';end if;
 insert into public.academy_notes(user_id,lesson_id,note,difficulty,favorite) values(auth.uid(),p_lesson,p_note,p_difficulty,p_favorite) on conflict(user_id,lesson_id) do update set note=excluded.note,difficulty=excluded.difficulty,favorite=excluded.favorite,updated_at=now();
end;$$;
create function public.clear_academy_study() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 delete from public.academy_records where user_id=auth.uid();delete from public.academy_notes where user_id=auth.uid();
end;$$;
revoke all on function private.validate_academy_questions() from public,anon,authenticated;
revoke all on function public.record_academy_study(uuid,text,jsonb),public.save_academy_note(uuid,text,text,boolean),public.clear_academy_study() from public,anon;
grant execute on function public.record_academy_study(uuid,text,jsonb),public.save_academy_note(uuid,text,text,boolean),public.clear_academy_study() to authenticated;
