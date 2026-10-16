import { it, expect } from "vitest";
import { brandText, brandCatalog } from "../src/lib/brand";
import { readFileSync } from "node:fs";
it("displays historical editorial branding with the public name", () => {
  expect(brandText("Curadoria Clutchfolio / Clutch Coach")).toBe(
    "Curadoria kyrven / kyrven coach",
  );
});
it("retains historical local preference and deployment keys", () => {
  expect(
    readFileSync("src/components/experience/MotionSystem.tsx", "utf8"),
  ).toContain("clutchfolio-motion");
  expect(readFileSync("src/components/experience/Appearance.tsx", "utf8")).toContain(
    "clutchfolio-theme",
  );
  expect(readFileSync("supabase/config.toml", "utf8")).toContain(
    "clutch-coach",
  );
});

it("normalizes historical public exercise authors without mutating the source", () => {
  const e = {
    title: "Treino",
    creator: "Clutchfolio · protocolo editorial",
    description: "Editorial",
    instructions: "Observe a tarefa",
    id: "stable",
    source_url: "https://example.com",
  };
  const catalog = { exercises: [e], articles: [], tournaments: [] };
  const output = brandCatalog(catalog as any);
  expect(output.exercises[0].creator).toBe("kyrven · protocolo editorial");
  expect(e.creator).toContain("Clutchfolio");
  expect(output.exercises[0].id).toBe(e.id);
});
