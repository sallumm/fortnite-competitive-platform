import { describe, it, expect } from "vitest";
import {
  analyze,
  recommend,
  validPeriod,
  goalState,
} from "../src/lib/intelligence";
import {
  validateVod,
  validateGoal,
  authorizedVideo,
} from "../src/lib/intelligence-validation";
import { compatibleExercises } from "../src/lib/skill-match";
import { trainingCatalog } from "../src/lib/training-catalog";
import { demoPlayer, uid, seed } from "../src/lib/seed";
import type { Training } from "../src/lib/types";
import type { VodReview } from "../src/lib/intelligence-types";
import { demoContext, classify, defaults } from "../src/lib/coach";
const exercise = trainingCatalog.find((e) => e.title === "Edit Course")!;
const now = new Date("2026-10-10T18:00:00Z");
function session(
  day: number,
  value: number,
  configuration = "percurso A",
): Training {
  return {
    id: uid(9400 + day),
    user_id: "demo",
    plan_id: null,
    title: "Teste",
    started_at: `2026-10-${String(day).padStart(2, "0")}T12:00:00Z`,
    completed_at: `2026-10-${String(day).padStart(2, "0")}T12:02:00Z`,
    duration_seconds: 120,
    status: "completed",
    xp: 100,
    steps: [
      { id: uid(9440 + day), exercise_id: exercise.id, minutes: 5, exercise },
    ],
    results: [
      {
        exercise_id: exercise.id,
        step_id: uid(9440 + day),
        value,
        note: "privado",
        status: "completed",
        unit: exercise.measurement!.unit,
        version: exercise.measurement!.version,
        configuration,
      },
    ],
  };
}
function player() {
  const data = demoPlayer();
  data.sessions = [session(7, 50), session(8, 45), session(9, 40)];
  return data;
}
const range = ["2026-10-01", "2026-10-10"] as const;
describe("Performance Intelligence: evidências e validação", () => {
  it("associa habilidades específicas e respeita Construção Zero", () => {
    const d = player();
    expect(
      compatibleExercises(trainingCatalog, "tracking", d.profile!).every((e) =>
        /tracking/i.test(e.title),
      ),
    ).toBe(true);
    expect(
      compatibleExercises(trainingCatalog, "building", {
        ...d.profile!,
        mode: "zero",
      }),
    ).toEqual([]);
    expect(
      compatibleExercises(trainingCatalog, "box_fighting", d.profile!).some(
        (e) => e.title === "Box Fight",
      ),
    ).toBe(true);
  });
  it("três sessões favoráveis mostram direção do protocolo, sem atribuir causa", () => {
    const a = analyze(player(), trainingCatalog, ...range, now);
    expect(a.comparisons[0]).toMatchObject({
      first: 50,
      last: 40,
      count: 3,
      direction: "lower",
    });
    expect(a.diagnostics.some((d) => d.key.startsWith("trend:"))).toBe(true);
    expect(JSON.stringify(a.diagnostics)).not.toMatch(
      /fadiga|ansiedade|falta de habilidade/,
    );
  });
  it("identifica oscilação e não mistura configuração, unidade ou versão", () => {
    const d = player();
    d.sessions[1].results[0].value = 60;
    expect(
      analyze(d, trainingCatalog, ...range, now).diagnostics.some((x) =>
        x.key.startsWith("osc:"),
      ),
    ).toBe(true);
    d.sessions[1].results[0].configuration = "outro percurso";
    d.sessions[2].results[0].version = "nova";
    const a = analyze(d, trainingCatalog, ...range, now);
    expect(a.comparisons).toEqual([]);
    expect(a.diagnostics.some((x) => x.key.startsWith("trend:"))).toBe(false);
  });
  it("repetições da mesma sessão não contam como avaliações independentes", () => {
    const d = player();
    d.sessions = [d.sessions[0]];
    d.sessions[0].results.push({ ...d.sessions[0].results[0], value: 30 });
    expect(analyze(d, trainingCatalog, ...range, now).comparisons).toEqual([]);
  });
  it("ignora etapas puladas, futuro e volume sem resultados numéricos", () => {
    const d = player();
    d.sessions[0].results[0].status = "skipped";
    d.sessions[1].results[0].value = null;
    d.sessions[2].completed_at = "2026-11-01T12:00:00Z";
    const a = analyze(d, trainingCatalog, ...range, now);
    expect(a.comparisons).toEqual([]);
    expect(a.sessions).toHaveLength(2);
  });
  it("conta dificuldades por diário e explica ausência de contexto", () => {
    const d = player();
    d.journals = d.sessions.slice(0, 2).map((s, i) => ({
      id: uid(9450 + i),
      user_id: "demo",
      session_id: s.id,
      practiced: "",
      improved: "",
      difficult: "",
      next_focus: "",
      difficulties: ["editing"],
    }));
    d.sessions[2].results[0].configuration = "";
    const a = analyze(d, trainingCatalog, ...range, now);
    expect(a.missing).toBe(1);
    expect(
      a.diagnostics.some(
        (x) => x.key === "difficulty:editing" && x.detail.includes("2 diários"),
      ),
    ).toBe(true);
  });
  it("recomenda com regras estáveis, modalidade e duração, sem salvar", () => {
    const d = player();
    const before = JSON.stringify(d);
    const a = recommend(d, trainingCatalog, "tracking", 15);
    expect(a).toEqual(recommend(d, trainingCatalog, "tracking", 15));
    expect(a.reduce((n, x) => n + x.minutes, 0)).toBeLessThanOrEqual(15);
    expect(a.every((x) => x.reason.includes("Tracking"))).toBe(true);
    expect(JSON.stringify(d)).toBe(before);
  });
  it("cálculos rejeitam registros de outra conta mesmo em dados misturados", () => {
    const d = player();
    d.sessions[0].user_id = "outra-conta";
    d.goals = [
      {
        id: uid(9490),
        user_id: "outra-conta",
        title: "SEGREDO",
        target: 1,
        completed: false,
      },
    ];
    const a = analyze(d, trainingCatalog, ...range, now);
    expect(a.sessions).toHaveLength(2);
    expect(JSON.stringify(a.diagnostics)).not.toContain("SEGREDO");
  });
  it("aceita datas exatas e limita intervalos; não penaliza ausência de registros", () => {
    expect(validPeriod("2026-02-30", "2026-03-01")).toBe(false);
    expect(validPeriod("2025-01-01", "2026-10-10")).toBe(false);
    const d = player();
    d.sessions = [];
    const a = analyze(d, trainingCatalog, ...range, now);
    expect(a.comparisons).toEqual([]);
    expect(a.diagnostics.some((x) => x.key === "empty")).toBe(true);
  });
  it("valida protocolos de metas sem concluir por pontuação", () => {
    const g = {
      id: uid(9460),
      user_id: "demo",
      title: "Teste",
      target: 1,
      completed: false,
      status: "paused" as const,
      measurement: {
        exercise_id: exercise.id,
        unit: exercise.measurement!.unit,
        version: exercise.measurement!.version,
        baseline: 50,
        desired: 40,
        configuration: "fixa",
      },
    };
    expect(goalState(g)).toBe("paused");
    expect(() => validateGoal(g, trainingCatalog)).not.toThrow();
    expect(() =>
      validateGoal(
        { ...g, measurement: { ...g.measurement, unit: "%" } },
        trainingCatalog,
      ),
    ).toThrow();
    expect(goalState({ ...g, status: undefined, completed: true })).toBe(
      "completed",
    );
  });
  it("VOD exige autorização de link e rejeita marcador fora da duração e instruções executáveis", () => {
    const r: VodReview = {
      id: uid(9470),
      user_id: "demo",
      title: "Partida",
      match_date: "2026-10-09",
      tournament_id: null,
      video_url: "https://www.youtube.com/watch?v=example",
      video_authorized: true,
      duration_seconds: 60,
      exercise_ids: [exercise.id],
      skills: ["editing"],
      notes: "manual",
      markers: [
        {
          id: uid(9471),
          seconds: 30,
          category: "mechanics",
          kind: "mistake",
          note: "Reset incompleto",
          skills: ["editing"],
        },
      ],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    expect(() => validateVod(r, trainingCatalog, [])).not.toThrow();
    expect(() =>
      validateVod({ ...r, video_authorized: false }, trainingCatalog, []),
    ).toThrow();
    expect(() =>
      validateVod(
        { ...r, markers: [{ ...r.markers[0], seconds: 61 }] },
        trainingCatalog,
        [],
      ),
    ).toThrow();
    expect(authorizedVideo("javascript:alert(1)")).toBe(false);
    expect(authorizedVideo("https://youtube.com.evil.test/video")).toBe(false);
  });
  it("Coach classifica perguntas de continuidade e projeta foco sem notas VOD ou readiness", () => {
    const d = player();
    d.planningPreferences = [
      {
        id: "demo",
        user_id: "demo",
        weekdays: [1],
        local_time: "18:00",
        minutes: 30,
        focuses: ["aim"],
        primary_skill: "tracking",
      },
    ];
    d.readiness = [
      {
        id: d.sessions[0].id,
        user_id: "demo",
        energy: 1,
        focus: 1,
        available_minutes: 10,
        style: "light",
        created_at: now.toISOString(),
      },
    ];
    expect(classify("Como foi minha semana?").intent).toBe("report");
    expect(classify("Qual habilidade estou acompanhando?").intent).toBe(
      "report",
    );
    const c = demoContext(
      d,
      seed,
      "Como foi minha semana?",
      { ...defaults, context_enabled: true },
      undefined,
      now,
    );
    expect(c.focus?.primary_skill).toBe("tracking");
    expect(c).not.toHaveProperty("readiness");
    expect(
      demoContext(d, seed, "Como foi minha semana?", defaults, undefined, now),
    ).not.toHaveProperty("focus");
  });
});
