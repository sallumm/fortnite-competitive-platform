import { it, expect } from "vitest";
import { demoPlayer, seed, uid } from "../src/lib/seed";
import {
  defaultEvolutionConfig,
  evolutionConfigSchema,
} from "../src/lib/skill-maxing/config";
import {
  generateEvolution,
  proposalIssues,
  proposalOccurrences,
  weeklyEvolutionReview,
} from "../src/lib/skill-maxing/engine";
const now = new Date("2026-10-10T12:00:00Z");
function fixture() {
  const data = demoPlayer();
  data.profile = {
    ...data.profile!,
    level: "beginner",
    mode: "build",
    timezone: "America/Sao_Paulo",
  };
  data.series = [];
  data.schedules = [];
  data.sessions = [];
  const config = defaultEvolutionConfig(data.profile!);
  config.skills = [
    { id: "shotgun", weight: 3 },
    { id: "piece-ownership", weight: 4 },
    { id: "zone-wars", weight: 3 },
  ];
  config.windows = [1, 3, 6].map((weekday, i) => ({
    id: uid(9000 + i),
    weekday,
    start: i === 0 ? "17:00" : i === 1 ? "18:00" : "14:00",
    end: i === 0 ? "18:00" : i === 1 ? "19:30" : "16:00",
    minutes: [30, 45, 60][i],
  }));
  return { data, config };
}
it("generates an explained, reproducible multi-skill Monday Wednesday Saturday plan without persistence", () => {
  const { data, config } = fixture();
  const original = JSON.stringify(data);
  const p = generateEvolution(config, data, seed, "2026-10-12", 2, now);
  expect(p.sessions).toHaveLength(3);
  expect(proposalOccurrences(p, data)).toHaveLength(6);
  expect(p.sessions.map((s) => s.time)).toEqual(["17:00", "18:00", "14:00"]);
  expect(
    p.sessions.map((s) => s.plan.steps.reduce((n, x) => n + x.minutes, 0)),
  ).toEqual([30, 45, 60]);
  expect(new Set(p.sessions.flatMap((s) => s.skill_ids))).toEqual(
    new Set(config.skills.map((s) => s.id)),
  );
  expect(proposalIssues(p, data, seed, now)).toEqual([]);
  const p2 = generateEvolution(config, data, seed, "2026-10-12", 2, now);
  expect(
    p2.sessions.map((s) => s.plan.steps.map((x) => [x.exercise_id, x.minutes])),
  ).toEqual(
    p.sessions.map((s) => s.plan.steps.map((x) => [x.exercise_id, x.minutes])),
  );
  expect(p.sessions.every((s) => s.reasons.length > 0)).toBe(true);
  expect(JSON.stringify(data)).toBe(original);
});
it("enforces Zero Build, device restrictions and short user budgets", () => {
  const { data, config } = fixture();
  config.mode = "zero";
  config.input = "controller";
  config.style = "short";
  config.skills = [
    { id: "zero-aim", weight: 4 },
    { id: "zero-cover", weight: 2 },
  ];
  const p = generateEvolution(config, data, seed, "2026-10-12", 1, now);
  expect(p.sessions.length).toBeGreaterThan(0);
  for (const s of p.sessions) {
    expect(s.plan.steps.reduce((n, x) => n + x.minutes, 0)).toBeLessThanOrEqual(
      20,
    );
    for (const st of s.plan.steps)
      expect(
        seed.exercises.find((e) => e.id === st.exercise_id)?.mode,
      ).not.toBe("build");
  }
  const kbmOnly = {
    ...seed,
    exercises: seed.exercises.map((e) => ({
      ...e,
      tags: [...(e.tags || []), "kbm-only"],
    })),
  };
  expect(
    generateEvolution(config, data, kbmOnly, "2026-10-12", 1, now).sessions,
  ).toHaveLength(0);
  expect(
    evolutionConfigSchema.safeParse({
      ...config,
      skills: [{ id: "editing", weight: 3 }],
    }).success,
  ).toBe(false);
});
it("respects reserved commitments, recurring conflicts and disallows stale sources and forged owners", () => {
  const { data, config } = fixture();
  config.blocked = [
    { id: uid(9040), weekday: 1, start: "17:00", end: "17:30" },
  ];
  const p = generateEvolution(config, data, seed, "2026-10-12", 1, now);
  expect(p.sessions[0].time).toBe("17:30");
  const bad = structuredClone(p);
  bad.sessions[0].plan.user_id = "other";
  expect(proposalIssues(bad, data, seed, now).length).toBeGreaterThan(0);
  bad.sessions[0].plan.user_id = data.profile!.id;
  bad.sessions[0].plan.level = "advanced";
  expect(proposalIssues(bad, data, seed, now)).toContain(
    "Proprietário, modalidade ou nível da rotina inválidos.",
  );
  const stale = {
    ...seed,
    exercises: seed.exercises.map((e) => ({
      ...e,
      research: e.research
        ? { ...e.research, review_due_at: "2026-01-01T00:00:00Z" }
        : null,
    })),
  };
  expect(
    generateEvolution(config, data, stale, "2026-10-12", 1, now).sessions,
  ).toHaveLength(0);
  expect(proposalIssues(p, data, stale, now)).toContain(
    "Um exercício precisa de verificação editorial atual.",
  );
});
it("does not prescribe multiplayer in solo mode or infer improvement from an empty history", () => {
  const { data, config } = fixture();
  config.opposition = "solo";
  config.skills = [{ id: "zone-wars", weight: 3 }];
  expect(
    generateEvolution(config, data, seed, "2026-10-12", 1, now).sessions,
  ).toHaveLength(0);
  const review = weeklyEvolutionReview(
    data,
    seed,
    "2026-10-01",
    "2026-10-07",
    now,
  );
  expect(review.suggestions).toHaveLength(0);
});
it("rejects overlapping availability, duplicate competencies and excessive daily duration", () => {
  const { config } = fixture();
  expect(
    evolutionConfigSchema.safeParse({
      ...config,
      windows: [config.windows[0], { ...config.windows[0], id: uid(9990) }],
    }).success,
  ).toBe(false);
  expect(
    evolutionConfigSchema.safeParse({
      ...config,
      skills: [config.skills[0], config.skills[0]],
    }).success,
  ).toBe(false);
  expect(
    evolutionConfigSchema.safeParse({
      ...config,
      windows: [{ ...config.windows[0], minutes: 121 }],
    }).success,
  ).toBe(false);
});
it("reviews only owned comparable results and recurring difficulties without changing volume", () => {
  const { data, config } = fixture();
  const e = seed.exercises.find((e) => e.title === "Edit Course")!;
  data.sessions = [7, 8].map((day) => ({
    id: uid(9860 + day),
    user_id: "demo",
    plan_id: null,
    title: "Teste",
    started_at: `2026-10-0${day}T12:00:00Z`,
    completed_at: `2026-10-0${day}T12:01:00Z`,
    duration_seconds: 60,
    status: "completed" as const,
    xp: 0,
    steps: [
      { id: uid(9870 + day), exercise_id: e.id, minutes: 5, exercise: e },
    ],
    results: [
      {
        exercise_id: e.id,
        step_id: uid(9870 + day),
        value: day === 7 ? 50 : 45,
        note: "",
        status: "completed" as const,
        unit: e.measurement!.unit,
        version: e.measurement!.version,
        configuration: "percurso A / kbm",
      },
    ],
  }));
  data.journals = data.sessions.map((s) => ({
    id: crypto.randomUUID(),
    user_id: "demo",
    session_id: s.id,
    difficulties: ["box_fights" as const],
    practiced: "Combate",
    improved: "",
    difficult: "Escolha do peek",
    next_focus: "Box Fight",
  }));
  const before = JSON.stringify(data),
    minutes = config.windows.map((w) => w.minutes);
  const review = weeklyEvolutionReview(
    data,
    seed,
    "2026-10-01",
    "2026-10-09",
    now,
  );
  expect(review.completed).toBe(2);
  expect(review.comparisons).toHaveLength(1);
  expect(
    review.suggestions.some((s) => s.key === "difficulty:box_fights"),
  ).toBe(true);
  data.sessions[1].results[0].configuration = "outro percurso";
  expect(
    weeklyEvolutionReview(data, seed, "2026-10-01", "2026-10-09", now)
      .comparisons,
  ).toHaveLength(0);
  data.sessions[1].results[0].configuration = "percurso A / kbm";
  data.sessions[1].user_id = "other";
  expect(
    weeklyEvolutionReview(data, seed, "2026-10-01", "2026-10-09", now)
      .completed,
  ).toBe(1);
  data.sessions[1].user_id = "demo";
  expect(JSON.stringify(data)).toBe(before);
  expect(config.windows.map((w) => w.minutes)).toEqual(minutes);
});
