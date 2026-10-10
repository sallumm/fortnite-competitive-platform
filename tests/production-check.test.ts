import { expect, it } from "vitest";
// @ts-expect-error Build utility is native JavaScript, intentionally executable without TypeScript.
import { productionIssues } from "../scripts/production-check.mjs";
const publicEnv = {
  VITE_SITE_URL: "https://example.com",
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_example",
};
it("allows public keys and refuses frontend secrets without printing their values", () => {
  expect(productionIssues(publicEnv)).toEqual([]);
  const issues = productionIssues({
    ...publicEnv,
    VITE_SUPABASE_ANON_KEY: "sb_secret_PRIVATE",
    VITE_OPENAI_API_KEY: "PRIVATE",
  });
  expect(issues.length).toBe(2);
  expect(JSON.stringify(issues)).not.toContain("PRIVATE");
});
it("requires production origins and rejects unsafe invite URLs", () => {
  expect(productionIssues({}).length).toBe(3);
  expect(
    productionIssues({
      ...publicEnv,
      VITE_SITE_URL: "http://localhost",
      VITE_DISCORD_INVITE: "https://attacker.example",
    }).length,
  ).toBe(2);
});
