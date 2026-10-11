import { expect, it } from "vitest";
import { appDestination } from "../src/lib/navigation";
it("preserves exercise, Coach and calendar intent while rejecting external and normalized traversal redirects", () => {
  for (const path of [
    "/app/planner?exercise=123",
    "/be-kyrven",
    "/admin/esports/assessments",
    "/app/coach?q=rota%C3%A7%C3%A3o",
    "/app/reports#goals",
  ])
    expect(appDestination(path)).toBe(path);
  for (const path of [
    "https://example.com",
    "//example.com",
    "/application",
    "/admin/esports/../../auth",
    "/admin/esports-unrelated",
    "/be-kyrven/external",
    "/app/../../auth",
    "/app/\\example.com",
    "/app\n/secret",
    {},
    null,
  ])
    expect(appDestination(path)).toBe("/app");
});
