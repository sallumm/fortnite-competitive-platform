// @vitest-environment jsdom
import { expect, it } from "vitest";
import { exportPlayerData } from "../src/lib/export-data";
import { demoPlayer } from "../src/lib/seed";
import type { SupabaseClient } from "@supabase/supabase-js";
it("includes saved coach and competition data but never theme or credentials", async () => {
  const values: Record<string, string> = {
    "clutchfolio-coach-demo:demo": '{"history":["private"]}',
    "clutchfolio-preparation-demo:event": '{"checklist":[]}',
    "sb-token": '"credential"',
    "clutchfolio-theme": '"dark"',
  };
  const local = Object.assign(values, {
    getItem: (key: string) => values[key],
  }) as unknown as Storage;
  const result = await exportPlayerData(demoPlayer(), null, true, local);
  expect(Object.keys(result.additional)).toHaveLength(2);
  expect(JSON.stringify(result)).not.toContain("credential");
});
it("refuses anonymous or incomplete exports", async () => {
  await expect(
    exportPlayerData({ ...demoPlayer(), profile: null }, null, true),
  ).rejects.toThrow(/entre novamente/);
  await expect(exportPlayerData(demoPlayer(), null, false)).rejects.toThrow(
    /indisponível/,
  );
});
it("exports Skill Maxing settings and confirmations with owner filters and fails rather than dropping a subsystem", async () => {
  const calls: { table: string; key?: string; value?: string }[] = [];
  const client = {
    from(table: string) {
      const call = { table } as (typeof calls)[number];
      calls.push(call);
      const chain = {
        select: () => chain,
        eq(key: string, value: string) {
          call.key = key;
          call.value = value;
          return chain;
        },
        order: () => chain,
        range: async () => ({
          data:
            table === "evolution_settings"
              ? [{ id: "demo", config: { objective: "Meu objetivo" } }]
              : table === "evolution_batches"
                ? [{ user_id: "demo", result: ["minha confirmação"] }]
                : [],
          error: null,
        }),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  const out = await exportPlayerData(demoPlayer(), client, false);
  expect(out.additional.evolution_settings).toEqual([
    { id: "demo", config: { objective: "Meu objetivo" } },
  ]);
  expect(out.additional.evolution_batches).toEqual([
    { user_id: "demo", result: ["minha confirmação"] },
  ]);
  expect(calls.find((c) => c.table === "evolution_settings")).toMatchObject({
    key: "id",
    value: "demo",
  });
  expect(calls.find((c) => c.table === "evolution_batches")).toMatchObject({
    key: "user_id",
    value: "demo",
  });
  const failing = {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        range: async () => ({ data: null, error: new Error("offline") }),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  await expect(exportPlayerData(demoPlayer(), failing, false)).rejects.toThrow(
    /todos os registros/,
  );
});
