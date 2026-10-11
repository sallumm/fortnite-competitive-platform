import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

// Isolated catalog only: no credentials, network, hosted database or user data.
const db = new PGlite();
try {
  await db.exec(
    "create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;",
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  const tables = (
    await db.query(
      "select n.nspname schema,c.relname name,c.relrowsecurity rls,c.relforcerowsecurity force_rls,c.relacl::text grants from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p','v','m') order by 1,2",
    )
  ).rows;
  const policies = (
    await db.query(
      "select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','private') order by 1,2,3",
    )
  ).rows;
  const functions = (
    await db.query(
      "select p.oid::regprocedure::text signature,n.nspname schema,p.prosecdef security_definer,p.proconfig settings,p.proacl::text grants from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by 1",
    )
  ).rows;
  const unsafeTables = tables.filter((t) => !t.rls);
  const unsafeFunctions = functions.filter(
    (f) =>
      f.security_definer &&
      !(f.settings || []).some((s) => s === 'search_path=""'),
  );
  console.log(
    JSON.stringify(
      {
        environment: "PGlite isolated catalog; not Supabase hosted",
        tables,
        policies,
        functions,
        checks: {
          tablesWithoutRls: unsafeTables,
          definersWithoutEmptySearchPath: unsafeFunctions,
        },
      },
      null,
      2,
    ),
  );
  if (unsafeTables.length || unsafeFunctions.length) process.exitCode = 1;
} finally {
  await db.close();
}
