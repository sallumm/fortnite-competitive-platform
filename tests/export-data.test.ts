// @vitest-environment jsdom
import { expect, it } from "vitest";
import { exportPlayerData } from "../src/lib/export-data";
import { demoPlayer } from "../src/lib/seed";
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
