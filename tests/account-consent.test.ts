import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
it("requires explicit current documents at onboarding; isolates and erases acknowledgements", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;",
    );
    for (const f of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
    const a = "30000000-0000-4000-8000-000000000001",
      b = "30000000-0000-4000-8000-000000000002";
    await db.query("insert into auth.users values($1),($2)", [a, b]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
    await db.exec("set role authenticated");
    const profile =
      "insert into public.profiles(id,display_name,mode,level,objective,minutes,input,onboarded) values(auth.uid(),'Player','build','beginner','aim',30,'kbm',true)";
    await expect(db.exec(profile)).rejects.toThrow(
      "Explicit current acceptance",
    );
    await expect(
      db.query("select public.accept_account_documents('old','old',true)"),
    ).rejects.toThrow();
    await expect(
      db.query(
        "select public.accept_account_documents('2026-10-11-prelaunch','2026-10-11-prelaunch',false)",
      ),
    ).rejects.toThrow();
    await db.query(
      "select public.accept_account_documents('2026-10-11-prelaunch','2026-10-11-prelaunch',true)",
    );
    await db.exec(profile);
    expect(
      (await db.query("select * from public.account_acceptances")).rows,
    ).toHaveLength(1);
    await expect(
      db.exec("update public.account_acceptances set accepted_at=now()"),
    ).rejects.toThrow();
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
    expect(
      (await db.query("select * from public.account_acceptances")).rows,
    ).toHaveLength(0);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [a]);
    expect(
      (await db.query("select * from public.account_acceptances")).rows,
    ).toHaveLength(0);
  } finally {
    await db.close();
  }
}, 60000);
