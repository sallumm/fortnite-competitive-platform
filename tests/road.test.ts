import { describe, it, expect } from "vitest";
import { demoPlayer, seed as baseSeed } from "../src/lib/seed";
import { defaultEvolutionConfig } from "../src/lib/skill-maxing/config";
import {
  journeyProgress,
  journeyReport,
  snapshotProgram,
  stageProposal,
  roadConfigSchema,
  type Journey,
  type RoadEvent,
  emptyRoad,
} from "../src/lib/road/domain";
import { proposalIssues } from "../src/lib/skill-maxing/engine";
import { appendRoadAnswer } from "../supabase/functions/_shared/coach/road";
import {
  rulesAnswer,
  classify,
} from "../supabase/functions/_shared/coach/domain";
import lessons from "../src/lib/mastery-catalog";
const seed = { ...baseSeed, articles: [...baseSeed.articles, ...lessons] };
const now = new Date("2026-10-10T23:00:00Z");
function fixture(mode: "build" | "zero" = "build", minutes = 10) {
  const data = demoPlayer();
  data.profile!.mode = mode;
  data.plans = [];
  data.sessions = [];
  data.schedules = [];
  data.series = [];
  data.exceptions = [];
  const config = {
    ...defaultEvolutionConfig(data.profile!),
    windows: [
      {
        id: crypto.randomUUID(),
        weekday: 1,
        start: "17:00",
        end: "18:00",
        minutes,
      },
    ],
    opposition: "solo" as const,
  };
  const j: Journey = {
    id: crypto.randomUUID(),
    user_id: "demo",
    config,
    experience: "first",
    familiarity: "",
    start_date: "2026-10-10",
    status: "active",
    program_id: "road-" + mode,
    version: "test",
    snapshot: snapshotProgram(mode, seed, now.getTime()),
    created_at: now.toISOString(),
  };
  return { data, j };
}
describe("Road to Competitive editorial cycles", () => {
  it("preserves complete source lessons and independent build/zero routes", () => {
    for (const mode of ["build", "zero"] as const) {
      const { j } = fixture(mode);
      expect(j.snapshot.program.modules).toHaveLength(4);
      expect(j.snapshot.lessons.length).toBeGreaterThan(10);
      for (const l of j.snapshot.lessons) {
        expect(l.article.body.length).toBeGreaterThan(500);
        expect(l.article.curriculum!.modes).toContain(mode);
        expect(l.article.curriculum!.sources.length).toBeGreaterThan(0);
      }
      if (mode === "zero")
        expect(
          j.snapshot.lessons.some(
            (l) => l.article.slug === "piece-box-realistic",
          ),
        ).toBe(false);
    }
  });
  it("rejects missing/unpublished lessons instead of filling empty lessons", () => {
    const broken = {
      ...seed,
      articles: seed.articles.filter((a) => a.slug !== "primeira-partida"),
    };
    expect(() => snapshotProgram("build", broken, now.getTime())).toThrow(
      /indisponível/,
    );
  });
  it("separates self-declared skip, study and conceptual assessment; rest never resets progress", () => {
    const { j } = fixture();
    const event: RoadEvent = {
      id: crypto.randomUUID(),
      user_id: "demo",
      journey_id: j.id,
      lesson_id: j.snapshot.lessons[0].article.id,
      action: "skipped",
      answers: [],
      note: "Já conheço",
      created_at: now.toISOString(),
    };
    const events = [event];
    expect(journeyProgress(j, events)).toMatchObject({
      studied: 0,
      skipped: 1,
    });
    events.push({ ...event, id: crypto.randomUUID(), action: "completed" });
    expect(journeyProgress({ ...j, status: "paused" }, events)).toMatchObject({
      studied: 1,
      skipped: 0,
    });
    expect(journeyProgress(j, events).assessments).toHaveLength(0);
  });
  it.each(["build", "zero"] as const)(
    "plans %s within a reduced window, no writes and no incompatible exercises",
    (mode) => {
      const { j, data } = fixture(mode, 5);
      for (let stage = 1; stage <= 4; stage++) {
        const p = stageProposal(
          j,
          stage,
          j.config,
          data,
          seed,
          "2026-10-12",
          now,
        );
        expect(p.weeks).toBe(1);
        expect(p.sessions.length).toBeGreaterThan(0);
        expect(proposalIssues(p, data, seed, now)).toEqual([]);
        expect(
          p.sessions.every(
            (s) => s.plan.steps.reduce((n, st) => n + st.minutes, 0) <= 5,
          ),
        ).toBe(true);
        for (const s of p.sessions)
          for (const st of s.plan.steps) {
            const e = seed.exercises.find((e) => e.id === st.exercise_id)!;
            expect([mode, "both"]).toContain(e.mode);
          }
      }
      expect(data.plans).toHaveLength(0);
    },
  );
  it("requires a valid configuration and explicit resume before planning", () => {
    const { j, data } = fixture();
    expect(
      roadConfigSchema.safeParse({
        config: j.config,
        experience: "first",
        familiarity: "",
        start_date: "2026-99-99",
      }).success,
    ).toBe(false);
    expect(() =>
      stageProposal(
        { ...j, status: "paused" },
        1,
        j.config,
        data,
        seed,
        "2026-10-12",
        now,
      ),
    ).toThrow(/Retome/);
  });
  it("reports absence of evidence without inventing learning or improvement", () => {
    const { j, data } = fixture();
    const road = emptyRoad();
    road.journeys = [j];
    const r = journeyReport(j, road, data);
    expect(r.completed).toBe(0);
    expect(r.comparisons).toEqual([]);
    expect(r.gaps.length).toBe(j.snapshot.lessons.length);
    expect(r.progress.studied).toBe(0);
  });
  it("coach summary is bounded and distinguishes study from practical learning", () => {
    const a = rulesAnswer(classify("minha jornada"), {}, [], []);
    appendRoadAnswer(a, {
      mode: "zero",
      status: "paused",
      objective: "Objetivo",
      studied: 2,
      skipped: 1,
      assessments: 0,
      completed_sessions: 0,
    });
    expect(a.sections.at(-1)!.items.join(" ")).toContain(
      "não demonstra domínio",
    );
    expect(a.sections.at(-1)!.items.join(" ")).toContain("confirmação");
  });
});
