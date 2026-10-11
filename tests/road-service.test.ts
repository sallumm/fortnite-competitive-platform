// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { demoPlayer, seed as baseSeed } from "../src/lib/seed";
import lessons from "../src/lib/mastery-catalog";
import { defaultEvolutionConfig } from "../src/lib/skill-maxing/config";
import {
  createRoad,
  loadRoad,
  recordRoad,
  confirmRoad,
  updateRoad,
  deleteRoad,
} from "../src/lib/road/service";
import { stageProposal } from "../src/lib/road/domain";
import { demoStudy } from "../src/lib/academy-service";
const catalog = { ...baseSeed, articles: [...baseSeed.articles, ...lessons] };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T23:00:00Z"));
  localStorage.clear();
  const d = demoPlayer();
  d.profile!.onboarded = true;
  d.plans = [];
  d.sessions = [];
  d.schedules = [];
  d.series = [];
  d.exceptions = [];
  localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(d));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function create() {
  const d = JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!);
  const config = {
    ...defaultEvolutionConfig(d.profile),
    windows: [
      {
        id: crypto.randomUUID(),
        weekday: 1,
        start: "17:00",
        end: "18:00",
        minutes: 5,
      },
    ],
  };
  await createRoad(
    true,
    {
      config,
      experience: "first",
      familiarity: "Ainda aprendendo",
      start_date: "2026-10-10",
    },
    catalog,
  );
  return (await loadRoad(true)).journeys[0];
}
it("restores study, assessments and status without turning declared familiarity into a measured result", async () => {
  let j = await create();
  const id = j.snapshot.lessons[0].article.id;
  await recordRoad(true, j, "completed", id, [], "Minha dúvida");
  await recordRoad(true, j, "assessment", id, [1]);
  await recordRoad(true, j, "pause");
  j = (await loadRoad(true)).journeys[0];
  expect(j.status).toBe("paused");
  expect(demoStudy().records).toHaveLength(2);
  expect(
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).sessions,
  ).toHaveLength(0);
  await expect(recordRoad(true, j, "completed", id)).rejects.toThrow(/Retome/);
  await recordRoad(true, j, "resume");
  expect((await loadRoad(true)).events).toHaveLength(4);
});
it("rolls back study and journey writes when browser storage fails", async () => {
  const j = await create(),
    before = localStorage.getItem("clutchfolio-road-demo-v1");
  const original = Storage.prototype.setItem;
  let fail = true;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (k, v) {
    if (k === "clutchfolio-academy-demo-v1" && fail) {
      fail = false;
      throw new Error("Quota fixture");
    }
    return original.call(this, k, v);
  });
  await expect(
    recordRoad(true, j, "completed", j.snapshot.lessons[0].article.id),
  ).rejects.toThrow("Quota fixture");
  expect(localStorage.getItem("clutchfolio-road-demo-v1")).toBe(before);
  expect(demoStudy().records).toHaveLength(0);
});
it("persists confirmed routines/calendar with an idempotent receipt and no duplicate agenda on retry", async () => {
  const j = await create(),
    d = JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!),
    p = stageProposal(j, 1, j.config, d, catalog, "2026-10-12"),
    token = crypto.randomUUID();
  expect(d.plans).toHaveLength(0);
  const result = await confirmRoad(true, j, 1, p, token, catalog);
  expect(await confirmRoad(true, j, 1, p, token, catalog)).toEqual(result);
  const saved = JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!);
  expect(saved.plans).toHaveLength(1);
  expect(saved.series).toHaveLength(1);
  expect(saved.plans[0].learning_journey_id).toBe(j.id);
  expect((await loadRoad(true)).batches).toHaveLength(1);
  await expect(confirmRoad(true, j, 2, p, token, catalog)).rejects.toThrow(
    /inválida/,
  );
});
it("rolls back the complete calendar proposal if linking the learning batch cannot persist", async () => {
  const j = await create(),
    before = localStorage.getItem("clutchfolio-demo-v1")!,
    p = stageProposal(
      j,
      1,
      j.config,
      JSON.parse(before),
      catalog,
      "2026-10-12",
    );
  const original = Storage.prototype.setItem;
  let fail = true;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (k, v) {
    if (k === "clutchfolio-road-demo-v1" && fail) {
      fail = false;
      throw new Error("Quota fixture");
    }
    return original.call(this, k, v);
  });
  await expect(
    confirmRoad(true, j, 1, p, crypto.randomUUID(), catalog),
  ).rejects.toThrow("Quota fixture");
  expect(localStorage.getItem("clutchfolio-demo-v1")).toBe(before);
  expect((await loadRoad(true)).batches).toHaveLength(0);
});
it("updates availability without silently moving existing appointments and deletes only the cycle", async () => {
  let j = await create(),
    d = JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!),
    p = stageProposal(j, 1, j.config, d, catalog, "2026-10-12");
  await confirmRoad(true, j, 1, p, crypto.randomUUID(), catalog);
  await updateRoad(true, j, {
    ...j.config,
    windows: j.config.windows.map((w) => ({
      ...w,
      start: "18:00",
      end: "19:00",
    })),
  });
  j = (await loadRoad(true)).journeys[0];
  expect(j.config.windows[0].start).toBe("18:00");
  expect(
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).series[0]
      .local_time,
  ).toBe("17:00");
  await recordRoad(true, j, "completed", j.snapshot.lessons[0].article.id);
  await deleteRoad(true, j);
  expect((await loadRoad(true)).journeys).toHaveLength(0);
  expect(demoStudy().records).toHaveLength(1);
  expect(
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans,
  ).toHaveLength(1);
});
