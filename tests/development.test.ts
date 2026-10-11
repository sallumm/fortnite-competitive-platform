import { it, expect } from "vitest";
import { demoPlayer, seed, uid } from "../src/lib/seed";
import lessons from "../src/lib/mastery-catalog";
import {
  currentStudy,
  relatedLessons,
  developmentSummary,
  catalogIssues,
} from "../src/lib/development";
import { generateEvolution } from "../src/lib/skill-maxing/engine";
import { defaultEvolutionConfig } from "../src/lib/skill-maxing/config";
import { recommendations } from "../src/lib/logic";
import { resultState } from "../src/lib/training";
import { ownedPerformanceData } from "../src/lib/intelligence";
import type { StudyRecord } from "../src/lib/academy";
const now = new Date("2026-10-11T01:00:00Z");
const catalog = { ...seed, articles: [...seed.articles, ...lessons] };
const lesson = lessons.find((a) => a.slug === "piece-box-realistic")!;
const record = (patch: Partial<StudyRecord> = {}): StudyRecord => ({
  id: uid(92001),
  lesson_id: lesson.id,
  action: "completed",
  snapshot: {
    title: lesson.title,
    slug: lesson.slug,
    version: lesson.curriculum!.version,
    questions: [],
  },
  answers: [],
  created_at: "2026-10-10T20:00:00Z",
  ...patch,
});
it("only current declared study contributes; assessments, future records, obsolete versions and wrong modes do not", () => {
  expect(currentStudy(catalog.articles, "build", [record()], now)).toHaveLength(
    1,
  );
  for (const r of [
    record({ action: "assessment" }),
    record({ created_at: "2027-01-01T00:00:00Z" }),
    record({ snapshot: { ...record().snapshot, version: "old" } }),
  ])
    expect(currentStudy(catalog.articles, "build", [r], now)).toHaveLength(0);
  expect(currentStudy(catalog.articles, "zero", [record()], now)).toHaveLength(
    0,
  );
  expect(
    currentStudy(
      [{ ...lesson, valid_until: "2026-01-01T00:00:00Z" }],
      "build",
      [record()],
      now,
    ),
  ).toHaveLength(0);
});
it("links lessons by verified editorial IDs, never a similar title", () => {
  const e = seed.exercises.find((e) =>
    lesson.curriculum!.exercise_ids.includes(e.id),
  )!;
  expect(relatedLessons(e, catalog.articles, now).map((a) => a.id)).toContain(
    lesson.id,
  );
  expect(
    relatedLessons(
      { ...e, id: uid(999991), title: lesson.title },
      catalog.articles,
      now,
    ),
  ).toEqual([]);
});
it("offers application of studied content without inferring training or silently writing schedules", () => {
  const d = demoPlayer();
  d.sessions = [];
  d.goals = [];
  const before = JSON.stringify(d);
  const s = developmentSummary(
    d,
    catalog,
    { records: [record()], notes: [] },
    now,
  )!;
  expect(s.learned).toHaveLength(1);
  expect(s.apply?.lesson.id).toBe(lesson.id);
  expect(s.analysis.comparisons).toEqual([]);
  expect(JSON.stringify(d)).toBe(before);
  const old = record({ snapshot: { ...record().snapshot, version: "old" } });
  expect(
    developmentSummary(d, catalog, { records: [old], notes: [] }, now)!.review
      ?.id,
  ).toBe(lesson.id);
});
it("explains Academy influence in the deterministic engine and rejects a foreign learning context", () => {
  const d = demoPlayer();
  d.sessions = [];
  d.series = [];
  d.schedules = [];
  d.goals = [];
  const c = defaultEvolutionConfig(d.profile!);
  c.skills = [{ id: "piece-ownership", weight: 5 }];
  c.windows = [
    { id: uid(92002), weekday: 1, start: "18:00", end: "19:00", minutes: 20 },
  ];
  const p = generateEvolution(
    c,
    d,
    catalog,
    "2026-10-12",
    1,
    now,
    undefined,
    "solo",
    { owner_id: "demo", records: [record()] },
  );
  expect(p.sessions.length).toBeGreaterThan(0);
  expect(p.sessions.flatMap((s) => s.reasons).join(" ")).toContain(
    "estudo concluído ou revisado registrado",
  );
  const foreign = generateEvolution(
    c,
    d,
    catalog,
    "2026-10-12",
    1,
    now,
    undefined,
    "solo",
    { owner_id: "other", records: [record()] },
  );
  expect(foreign.sessions.flatMap((s) => s.reasons).join(" ")).not.toContain(
    "estudo concluído ou revisado registrado",
  );
});
it("excludes withdrawn, stale, future and advanced exercises from beginner suggestions", () => {
  const p = { ...demoPlayer().profile!, level: "beginner" as const };
  const e = seed.exercises.find((e) => e.research)!;
  const rows = [
    e,
    { ...e, id: uid(92101), published: false },
    { ...e, id: uid(92102), level: "advanced" as const },
    { ...e, id: uid(92103), verified_at: "2027-01-01T00:00:00Z" },
    {
      ...e,
      id: uid(92104),
      research: { ...e.research!, review_status: "retired" as const },
    },
  ];
  expect(recommendations(rows, p, now).map((e) => e.id)).toEqual([e.id]);
});
it("does not claim completion of missing results and filters foreign plans, XP and bookmarks", () => {
  expect(resultState(undefined)).toBe("Sem conclusão registrada");
  const d = demoPlayer();
  d.plans = [{ id: uid(92200), user_id: "other", title: "Privada", steps: [] }];
  d.bookmarks = [
    {
      id: uid(92105),
      user_id: "other",
      kind: "exercise",
      target_id: seed.exercises[0].id,
    },
  ];
  d.xp = [
    {
      id: uid(92106),
      user_id: "other",
      session_id: uid(92107),
      amount: 100,
      created_at: now.toISOString(),
    },
  ];
  const own = ownedPerformanceData(d);
  expect(own.plans.some((p) => p.user_id === "other")).toBe(false);
  expect(own.xp).toEqual([]);
  expect(own.bookmarks).toEqual([]);
});
it("reports actual broken editorial associations and validates the complete seeded Academy graph", () => {
  const gaps = catalogIssues(catalog, now).filter((i) =>
    /^(base|exercise|mode):/.test(i.key),
  );
  expect(gaps).toEqual([]);
  expect(
    catalogIssues({ ...catalog, exercises: [] }, now).some((i) =>
      i.key.startsWith("exercise:"),
    ),
  ).toBe(true);
  expect(
    catalogIssues(
      {
        ...catalog,
        articles: [
          { ...lesson, source_url: "", valid_until: "2026-01-01T00:00:00Z" },
        ],
      },
      now,
    ).some((i) => i.key.startsWith("source:")),
  ).toBe(true);
});
