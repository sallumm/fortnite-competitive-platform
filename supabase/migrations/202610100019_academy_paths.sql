-- Paths organize existing lessons without duplicating article content or curriculum prerequisites.
create table public.academy_paths (
 id text primary key check(id ~ '^[a-z0-9-]{3,60}$'),title text not null check(length(btrim(title)) between 3 and 160),
 description text not null check(length(btrim(description)) between 10 and 1000),
 slugs jsonb not null,published boolean not null default false,position integer not null default 0 check(position between 0 and 1000)
);
alter table public.academy_paths enable row level security;
create policy read_paths on public.academy_paths for select to anon,authenticated using(published or (select public.is_admin()));
create policy admin_paths on public.academy_paths for all to authenticated using((select public.is_admin())) with check((select public.is_admin()));
grant select on public.academy_paths to anon,authenticated;
grant insert,update,delete on public.academy_paths to authenticated;
create function private.validate_academy_path() returns trigger language plpgsql set search_path='' as $$
declare lesson_slug jsonb;
begin
 if jsonb_typeof(new.slugs) is distinct from 'array' or jsonb_array_length(new.slugs) not between 1 and 100 or pg_column_size(new.slugs)>15000 then raise exception 'Invalid path';end if;
 if (select count(distinct value) from jsonb_array_elements(new.slugs))<>jsonb_array_length(new.slugs) then raise exception 'Duplicate lesson';end if;
 for lesson_slug in select value from jsonb_array_elements(new.slugs) loop
  if jsonb_typeof(lesson_slug)<>'string' or not exists(select 1 from public.articles a where a.slug=lesson_slug#>>'{}' and a.kind='lesson' and a.curriculum is not null and (not new.published or (a.published and a.published_at<=now()))) then raise exception 'Unavailable lesson';end if;
 end loop;return new;
end;$$;
create trigger academy_path_validation before insert or update on public.academy_paths for each row execute function private.validate_academy_path();
revoke all on function private.validate_academy_path() from public,anon,authenticated;
insert into public.academy_paths(id,title,description,slugs,published,position) values('fundamentos','Primeiro contato','Percurso editorial parcial, com bases sugeridas e acesso livre às aulas.','["primeira-partida", "controles-interface", "inventario-tempestade", "mira-movimento"]',true,0) on conflict(id) do nothing;
insert into public.academy_paths(id,title,description,slugs,published,position) values('mecanicas','Mecânicas e materiais','Percurso editorial parcial, com bases sugeridas e acesso livre às aulas.','["materiais-mats", "pecas-edicao"]',true,1) on conflict(id) do nothing;
insert into public.academy_paths(id,title,description,slugs,published,position) values('combate','Combate e Piece Control','Percurso editorial parcial, com bases sugeridas e acesso livre às aulas.','["peeks-trocas", "piece-box-realistic"]',true,2) on conflict(id) do nothing;
insert into public.academy_paths(id,title,description,slugs,published,position) values('partida','Early e mid game','Percurso editorial parcial, com bases sugeridas e acesso livre às aulas.','["early-drop", "mid-rotacoes"]',true,3) on conflict(id) do nothing;
insert into public.academy_paths(id,title,description,slugs,published,position) values('endgame','Endgame','Percurso editorial parcial, com bases sugeridas e acesso livre às aulas.','["endgame-camadas", "tarp-refresh", "surge-contexto"]',true,4) on conflict(id) do nothing;
insert into public.academy_paths(id,title,description,slugs,published,position) values('zero','Construção Zero','Percurso editorial parcial, com bases sugeridas e acesso livre às aulas.','["primeira-partida", "mira-movimento", "zero-cobertura", "zero-endgame"]',true,5) on conflict(id) do nothing;
insert into public.academy_paths(id,title,description,slugs,published,position) values('equipe','Equipe, Reload e competitivo','Percurso editorial parcial, com bases sugeridas e acesso livre às aulas.','["equipe-funcoes", "reload-retornos", "ranked-scrims-torneios"]',true,6) on conflict(id) do nothing;
insert into public.academy_paths(id,title,description,slugs,published,position) values('vod','VOD Review','Percurso editorial parcial, com bases sugeridas e acesso livre às aulas.','["vod-hipoteses"]',true,7) on conflict(id) do nothing;
create table public.academy_path_history(
 id uuid primary key default gen_random_uuid(),path_id text not null,actor_id uuid references auth.users on delete set null,
 operation text not null,before_data jsonb,after_data jsonb,created_at timestamptz not null default now()
);
alter table public.academy_path_history enable row level security;
grant select on public.academy_path_history to authenticated;
create policy admin_path_history on public.academy_path_history for select to authenticated using((select public.is_admin()));
create function private.audit_academy_path() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.academy_path_history(path_id,actor_id,operation,before_data,after_data) values(coalesce(new.id,old.id),auth.uid(),tg_op,case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);return coalesce(new,old);
end;$$;
create trigger academy_path_audit after insert or update or delete on public.academy_paths for each row execute function private.audit_academy_path();
revoke all on function private.audit_academy_path() from public,anon,authenticated;
