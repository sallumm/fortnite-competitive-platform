// @vitest-environment jsdom
import { it, expect, beforeEach, vi } from "vitest";
import { demoPlayer, seed, uid } from "../src/lib/seed";
import { defaultEvolutionConfig } from "../src/lib/skill-maxing/config";
import { generateEvolution } from "../src/lib/skill-maxing/engine";
import {
  confirmEvolution,
  loadEvolutionConfig,
} from "../src/lib/skill-maxing/service";
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
});
function fixture() {
  const data = demoPlayer();
  data.profile!.timezone = "UTC";
  localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data));
  const c = defaultEvolutionConfig(data.profile!);
  c.windows = [
    { id: uid(9840), weekday: 1, start: "17:00", end: "18:00", minutes: 30 },
  ];
  return { data, p: generateEvolution(c, data, seed, "2026-10-12") };
}
it("persists approval and preferences together, recovers after reload and prevents duplicates", async () => {
  const { p } = fixture();
  expect(await loadEvolutionConfig(true)).toBeNull();
  const a = await confirmEvolution(true, uid(9841), p, seed);
  expect(await confirmEvolution(true, uid(9841), p, seed)).toEqual(a);
  const saved = JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!);
  expect(saved.plans).toHaveLength(1);
  expect(saved.series).toHaveLength(1);
  expect(await loadEvolutionConfig(true)).toEqual(p.config);
  const changed = structuredClone(p);
  changed.sessions[0].time = "17:05";
  await expect(
    confirmEvolution(true, uid(9841), changed, seed),
  ).rejects.toThrow();
  vi.useRealTimers();
});
it("rejects changed agenda and another account without partial persistence", async () => {
  const { data, p } = fixture();
  data.series = [
    {
      id: uid(9850),
      user_id: "demo",
      title: "Reservado",
      kind: "personal",
      plan_id: null,
      timezone: "UTC",
      local_time: "17:00",
      start_date: "2026-10-12",
      end_date: "2026-10-12",
      weekdays: [1],
      duration_minutes: 30,
      tournament_id: null,
    },
  ];
  localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data));
  const before = localStorage.getItem("clutchfolio-demo-v1");
  await expect(confirmEvolution(true, uid(9851), p, seed)).rejects.toThrow();
  expect(localStorage.getItem("clutchfolio-demo-v1")).toBe(before);
  data.profile!.id = "other";
  localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data));
  await expect(confirmEvolution(true, uid(9852), p, seed)).rejects.toThrow(
    /demonstração/i,
  );
  vi.useRealTimers();
});
