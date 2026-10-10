import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { uid } from "../src/lib/seed";
let db: PGlite;
const a = uid(9001),
  b = uid(9002),
  admin = uid(9003),
  pa = uid(9011),
  pb = uid(9012);
async function user(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("set role " + role);
}
const profile = (id: string) =>
  `insert into public.profiles values('${id}','Jogador','build','intermediate','aim',30,'kbm','America/Sao_Paulo',true,true)`;
const plan = (id: string, userId: string) =>
  `insert into public.training_plans values('${id}','${userId}','Rotina','[{"exercise_id":"${uid(1)}","minutes":10}]')`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610100001_core.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610100002_seed.sql", "utf8"),
  );
  await db.exec(
    `insert into auth.users values('${a}'),('${b}'),('${admin}');insert into private.user_roles values('${admin}','admin');`,
  );
  for (const id of [a, b, admin]) {
    await user(id);
    await db.exec(profile(id));
  }
  await user(a);
  await db.exec(plan(pa, a));
  await user(b);
  await db.exec(plan(pb, b));
});
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL: isolamento, autorização e transações", () => {
  it("usuário não vê nem altera rotinas alheias e não falsifica proprietário", async () => {
    await user(a);
    expect(
      (
        await db.query<{ user_id: string }>(
          "select * from public.training_plans",
        )
      ).rows.every((r) => r.user_id === a),
    ).toBe(true);
    expect(
      (
        await db.query(
          "update public.training_plans set title='Intrusão' where id=$1 returning id",
          [pb],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(db.exec(plan(uid(9013), b))).rejects.toThrow();
    await expect(
      db.query("select public.start_training($1)", [pb]),
    ).rejects.toThrow();
  });
  it("agenda não aceita plano de outro usuário", async () => {
    await user(a);
    await expect(
      db.exec(
        `insert into public.scheduled_sessions(id,user_id,plan_id,starts_at) values('${uid(9030)}','${a}','${pb}',now())`,
      ),
    ).rejects.toThrow();
  });
  it("anon lê somente conteúdo publicado e nenhum dado privado", async () => {
    await user(admin);
    await db.exec(
      `update public.exercises set published=false where id='${uid(8)}'`,
    );
    await user(null, "anon");
    expect(
      (await db.query("select id from public.exercises")).rows,
    ).toHaveLength(7);
    await expect(db.exec("select * from public.profiles")).rejects.toThrow();
    await expect(
      db.query("select public.start_training($1)", [pa]),
    ).rejects.toThrow();
    await user(admin);
    await db.exec(
      `update public.exercises set published=true where id='${uid(8)}'`,
    );
  });
  it("admin é definido fora do perfil; usuário comum não publica", async () => {
    await user(a);
    expect(
      (await db.query<{ admin: boolean }>("select public.is_admin() as admin"))
        .rows[0].admin,
    ).toBe(false);
    await expect(
      db.exec(
        `insert into public.articles select '${uid(9040)}', 'noticia-forjada',title,kind,category,summary,body,author,source_url,verified_at,published_at,valid_until,published from public.articles limit 1`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(`insert into private.user_roles values('${a}','admin')`),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          `update public.exercises set title='Ataque editorial' where id='${uid(1)}' returning id`,
        )
      ).rows,
    ).toHaveLength(0);
    await user(admin);
    expect(
      (await db.query<{ admin: boolean }>("select public.is_admin() as admin"))
        .rows[0].admin,
    ).toBe(true);
    expect(
      (await db.query("select * from public.content_revision_history")).rows
        .length,
    ).toBeGreaterThan(0);
  });
  it("conteúdo futuro e rascunho não vazam ao visitante", async () => {
    await user(admin);
    await db.exec(
      `update public.articles set published_at=now()+interval '1 day' where id='${uid(101)}'`,
    );
    await user(null, "anon");
    expect(
      (await db.query(`select * from public.articles where id='${uid(101)}'`))
        .rows,
    ).toHaveLength(0);
    await user(admin);
    await db.exec(
      `update public.articles set published_at=now() where id='${uid(101)}'`,
    );
  });
  it("rejeita duração ausente, duplicação de exercício e fonte não HTTPS", async () => {
    await user(a);
    await expect(
      db.exec(
        `insert into public.training_plans values('${uid(9018)}','${a}','Inválida','[{"exercise_id":"${uid(1)}"}]')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into public.training_plans values('${uid(9019)}','${a}','Duplicada','[{"exercise_id":"${uid(1)}","minutes":10},{"exercise_id":"${uid(1)}","minutes":10}]')`,
      ),
    ).rejects.toThrow();
    await user(admin);
    await expect(
      db.exec(
        `update public.exercises set source_url='javascript:alert(1)' where id='${uid(1)}'`,
      ),
    ).rejects.toThrow();
  });
  it("conclusão atômica é idempotente, protege resultados e limita XP diário", async () => {
    await user(a);
    const results = [{ exercise_id: uid(1), value: 75, note: "Mesmo cenário" }];
    for (let i = 0; i < 3; i++) {
      const started = await db.query<{ session: { id: string } }>(
        "select to_jsonb(public.start_training($1)) as session",
        [pa],
      );
      const id = started.rows[0].session.id;
      await expect(
        db.query("select public.start_training($1)", [pa]),
      ).rejects.toThrow();
      if (i === 0) {
        await user(b);
        await expect(
          db.query("select public.finish_training($1,$2,0,false)", [
            id,
            JSON.stringify(results),
          ]),
        ).rejects.toThrow();
        await user(a);
        await expect(
          db.query("select public.finish_training($1,$2,9999,false)", [
            id,
            JSON.stringify(results),
          ]),
        ).rejects.toThrow();
        await expect(
          db.query("select public.finish_training($1,$2,0,false)", [
            id,
            JSON.stringify([{ ...results[0], exercise_id: uid(2) }]),
          ]),
        ).rejects.toThrow();
      }
      const completed = await db.query<{ session: { xp: number } }>(
        "select to_jsonb(public.finish_training($1,$2,0,false)) as session",
        [id, JSON.stringify(results)],
      );
      expect(completed.rows[0].session.xp).toBe(i < 2 ? 100 : 0);
      await db.query("select public.finish_training($1,$2,0,false)", [
        id,
        JSON.stringify(results),
      ]);
    }
    expect(
      (
        await db.query<{ total: number }>(
          "select sum(amount)::int as total from public.xp_transactions",
        )
      ).rows[0].total,
    ).toBe(200);
    await expect(
      db.exec(
        `insert into public.xp_transactions(user_id,session_id,amount) select '${a}',id,100 from public.training_sessions limit 1`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(`update public.training_sessions set xp=100`),
    ).rejects.toThrow();
  });
  it("exclusão de conta faz cascade de dados privados", async () => {
    await user(b);
    await db.exec(
      `insert into public.personal_goals values('${uid(9080)}','${b}','Uma meta',3,false)`,
    );
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [b]);
    expect(
      (await db.query("select * from public.profiles where id=$1", [b])).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select * from public.training_plans where user_id=$1", [
          b,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select * from public.personal_goals where user_id=$1", [
          b,
        ])
      ).rows,
    ).toHaveLength(0);
  });
});
