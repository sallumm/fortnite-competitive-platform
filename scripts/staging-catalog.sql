-- Read-only evidence. Run ONLY against the identified, authorized KYRVEN staging.
-- Contains no auth users, sessions, row payloads, object names or secret values.
begin read only;
select current_setting('server_version') as postgres_version;
select n.nspname as schema, count(*) as tables, count(*) filter (where not c.relrowsecurity) as without_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private') and c.relkind in ('r','p') group by n.nspname order by 1;
select schemaname, count(*) as policies from pg_policies where schemaname in ('public','private') group by schemaname order by 1;
select n.nspname as schema, count(*) as functions from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.prokind='f' group by n.nspname order by 1;
select n.nspname as schema, p.proname, pg_get_function_identity_arguments(p.oid) as arguments, p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.prosecdef
order by 1,2,3;
select routine_schema, routine_name, grantee, privilege_type from information_schema.routine_privileges
where routine_schema in ('public','private') and grantee in ('PUBLIC','anon','authenticated') order by 1,2,3;
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public','private','storage') order by 1,2,3;
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
commit;
