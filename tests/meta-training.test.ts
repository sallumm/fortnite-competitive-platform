import { it, expect } from "vitest";
import raw from "../src/data/meta-knowledge.json";
import type { MetaCatalog } from "../src/lib/meta";
import {
  currentEntries,
  contextSnapshot,
  exerciseRelations,
  contextAlerts,
  comparisonContext,
  metaAnswerData,
} from "../src/lib/meta-training/context";
import { demoPlayer, seed, uid } from "../src/lib/seed";
import { generateEvolution } from "../src/lib/skill-maxing/engine";
import { defaultEvolutionConfig } from "../src/lib/skill-maxing/config";
import { reportEvidence } from "../src/lib/intelligence-report";
import { resultGroups } from "../src/lib/performance";
import { appendMetaAnswer } from "../supabase/functions/_shared/coach/meta";
import { demoAnswer } from "../src/lib/coach";
import { defaults } from "../supabase/functions/_shared/coach/domain";
const catalog = raw as MetaCatalog,
  now = new Date("2026-10-10T23:00:00Z");
it("uses only exact current revisions with usable sources, rejecting expired/future/archived references", () => {
  const current = currentEntries(catalog, "br-4230", now);
  expect(current.length).toBeGreaterThan(0);
  expect(currentEntries(catalog, "unknown", now)).toEqual([]);
  expect(currentEntries(catalog, "br-4230", new Date("2026-10-18"))).toEqual(
    [],
  );
  const snap = contextSnapshot(
    catalog,
    { context_id: "br-4230", entry_ids: [current[0].id] },
    now,
  );
  expect(snap.entries[0].revision).toBe(current[0].revision);
  expect(() =>
    contextSnapshot(
      catalog,
      { context_id: "zero-4230", entry_ids: [current[0].id] },
      now,
    ),
  ).toThrow();
  expect(() =>
    contextSnapshot(
      catalog,
      { context_id: "br-4230", entry_ids: [current[0].id, current[0].id] },
      now,
    ),
  ).toThrow();
  const newer = {
    ...current[0],
    id: "test-revision",
    revision: current[0].revision + 1,
    previous_id: current[0].id,
  };
  const updated = { ...catalog, entries: [...catalog.entries, newer] };
  expect(contextAlerts(updated, snap, now)).toHaveLength(1);
  expect(snap.entries[0].id).toBe(current[0].id);
  expect(() =>
    contextSnapshot(
      updated,
      { context_id: "br-4230", entry_ids: [current[0].id] },
      now,
    ),
  ).toThrow();
});
it("explains meta links without borrowing information from another mode or promising improvement", () => {
  const relations = seed.exercises.flatMap((e) =>
    exerciseRelations(catalog, e, "br-4230", now),
  );
  expect(relations.length).toBeGreaterThan(0);
  expect(relations.every((r) => r.entry.context_id === "br-4230")).toBe(true);
  const d = demoPlayer();
  d.series = [];
  d.schedules = [];
  d.sessions = [];
  const config = defaultEvolutionConfig(d.profile!);
  config.mode = "build";
  config.skills = [{ id: "tracking", weight: 3 }];
  config.windows = [
    { id: uid(9901), weekday: 1, start: "17:00", end: "18:00", minutes: 30 },
  ];
  const selection = {
    context_id: "br-4230",
    entry_ids: currentEntries(catalog, "br-4230", now)
      .slice(0, 12)
      .map((e) => e.id),
  };
  const proposal = generateEvolution(config, d, seed, "2026-10-12", 1, now, {
    catalog,
    selection,
  });
  expect(proposal.sessions[0].plan.game_context?.context_id).toBe(
    selection.context_id,
  );
  expect(proposal.sessions[0].reasons.join(" ")).toContain("Fonte:");
  expect(() =>
    generateEvolution(
      { ...config, mode: "zero", skills: [{ id: "zero-aim", weight: 3 }] },
      d,
      seed,
      "2026-10-12",
      1,
      now,
      { catalog, selection },
    ),
  ).toThrow(/Modalidade/);
});
it("does not compare the same numeric protocol across versions/modes/formats or legacy records", () => {
  const e = seed.exercises.find((e) => e.measurement)!;
  const d = demoPlayer();
  const g = contextSnapshot(
    catalog,
    { context_id: "br-4230", entry_ids: [] },
    now,
  );
  const session = {
    ...d.sessions[0],
    id: uid(9951),
    status: "completed" as const,
    completed_at: "2026-10-09T12:00:00Z",
    steps: [{ exercise_id: e.id, minutes: 5, exercise: e }],
    results: [
      {
        exercise_id: e.id,
        value: 10,
        note: "",
        configuration: "same",
        unit: e.measurement!.unit,
        version: e.measurement!.version,
      },
    ],
    plan_snapshot: { title: "Test", game_context: g },
  };
  const variants = [
    g,
    { ...g, version_id: "different" },
    { ...g, mode_id: "br-zero" },
    { ...g, format_id: "duo" },
    null,
  ];
  const groups = resultGroups(
    variants.map((game_context, i) => ({
      ...session,
      id: uid(9951 + i),
      plan_snapshot: { title: "Test", game_context },
    })),
    e.id,
  );
  expect(groups).toHaveLength(5);
  expect(comparisonContext(g)).not.toBe(comparisonContext(null));
});
it("grounds rules assistance in dated public references, with explicit gaps and no text-driven actions", () => {
  const rows = metaAnswerData(catalog, "temporada", "br-4230", now);
  expect(rows.length).toBeGreaterThan(0);
  expect(metaAnswerData(catalog, "mecânica", "br-4200", now)).toEqual([]);
  const answer = demoAnswer(demoPlayer(), seed, "mira", defaults);
  appendMetaAnswer(answer, rows, "br-4230");
  expect(answer.mode).toBe("rules");
  expect(answer.references.some((r) => r.id.startsWith("meta:"))).toBe(true);
  const gap = demoAnswer(demoPlayer(), seed, "mecânica", defaults);
  appendMetaAnswer(gap, [], "no-data");
  expect(gap.sections.at(-1)?.items.join(" ")).toContain(
    "Não há informação atual",
  );
  expect(gap).not.toHaveProperty("actions");
});
it("respects Solo versus team practice without silently asserting a tournament format", () => {
  const d = demoPlayer();
  d.series = [];
  d.schedules = [];
  d.sessions = [];
  const config = defaultEvolutionConfig(d.profile!);
  config.mode = "build";
  config.competitive = true;
  config.skills = [
    { id: "duo", weight: 5 },
    { id: "shotgun", weight: 1 },
  ];
  config.windows = [
    { id: uid(9980), weekday: 1, start: "17:00", end: "18:00", minutes: 30 },
  ];
  const solo = generateEvolution(
      config,
      d,
      seed,
      "2026-10-12",
      1,
      now,
      undefined,
      "solo",
    ),
    duo = generateEvolution(
      config,
      d,
      seed,
      "2026-10-12",
      1,
      now,
      undefined,
      "duo",
    );
  expect(solo.sessions.every((s) => s.plan.practice_format === "solo")).toBe(
    true,
  );
  expect(
    solo.sessions.every((s) =>
      s.plan.steps.every((st) => {
        const e = seed.exercises.find((e) => e.id === st.exercise_id)!;
        return (
          e.research?.purpose === "review" ||
          !e.research?.competency_ids.includes("duo")
        );
      }),
    ),
  ).toBe(true);
  expect(duo.sessions[0].plan.practice_format).toBe("duo");
  expect(duo.sessions[0].reasons.join(" ")).toContain("não confirmação");
});

it("reports context counts without losing or combining practice formats", () => {
  const d = demoPlayer();
  const base = {
    id: uid(9962),
    user_id: d.profile!.id,
    plan_id: null,
    title: "Fixture session",
    steps: [],
    results: [],
    duration_seconds: 30,
    xp: 0,
    started_at: "2026-10-10T11:00:00Z",
    completed_at: "2026-10-10T12:00:00Z",
    status: "completed" as const,
  };
  const context = contextSnapshot(
    catalog,
    { context_id: "br-4230", entry_ids: [] },
    now,
  );
  d.sessions = [
    {
      ...base,
      status: "completed",
      id: uid(9960),
      user_id: d.profile!.id,
      completed_at: "2026-10-10T12:00:00Z",
      plan_snapshot: {
        title: "Solo",
        game_context: context,
        practice_format: "solo",
      },
    },
    {
      ...base,
      status: "completed",
      id: uid(9961),
      user_id: d.profile!.id,
      completed_at: "2026-10-10T12:00:00Z",
      plan_snapshot: {
        title: "Dupla",
        game_context: context,
        practice_format: "duo",
      },
    },
  ];
  const report = reportEvidence(d, seed.exercises, "2026-10-10", "2026-10-10");
  expect(report.contexts).toHaveLength(2);
  expect(report.contexts.reduce((n, c) => n + c.count, 0)).toBe(2);
  expect(report.contexts.map((c) => c.practice)).toEqual(["Solo", "Duplas"]);
});
