import { describe, it, expect } from "vitest";
import {
  progression,
  starterSteps,
  comparableResults,
  eventStatus,
  tournamentICS,
  isStale,
  stats,
} from "../src/lib/logic";
import { seed, demoPlayer } from "../src/lib/seed";
import {
  articleSchema,
  exerciseSchema,
  tournamentSchema,
} from "../src/lib/validation";
import type { Training } from "../src/lib/types";
describe("Planejamento e informação confiável", () => {
  it("adapta Zero Build sem exercícios exclusivos de Construção e preserva duração", () => {
    const p = { ...demoPlayer().profile!, mode: "zero" as const };
    for (const minutes of [30, 45, 60]) {
      const steps = starterSteps(seed.exercises, p, minutes);
      expect(steps.reduce((a, s) => a + s.minutes, 0)).toBe(minutes);
      expect(
        steps.every(
          (s) =>
            seed.exercises.find((e) => e.id === s.exercise_id)?.mode !==
            "build",
        ),
      ).toBe(true);
    }
  });
  it("não mistura exercícios em uma série de resultados", () => {
    const session = {
      status: "completed",
      completed_at: "2026-10-10T03:00:00Z",
      duration_seconds: 60,
      xp: 100,
      results: [
        { exercise_id: seed.exercises[0].id, value: 70, note: "" },
        { exercise_id: seed.exercises[1].id, value: 3, note: "" },
      ],
    } as Training;
    expect(comparableResults([session], seed.exercises[0].id)).toEqual([
      { date: session.completed_at, value: 70 },
    ]);
    expect(stats([{ ...session, status: "abandoned" }]).count).toBe(0);
  });
  it("não compara uma definição de métrica alterada editorialmente", () => {
    const original = seed.exercises[0];
    const session = {
      status: "completed",
      completed_at: "2026-10-10T03:00:00Z",
      steps: [{ exercise_id: original.id, minutes: 10, exercise: original }],
      results: [{ exercise_id: original.id, value: 80, note: "" }],
    } as Training;
    expect(
      comparableResults([session], original.id, original.metric),
    ).toHaveLength(1);
    expect(
      comparableResults([session], original.id, "Outra unidade"),
    ).toHaveLength(0);
  });
  it("limita ranks e diferencia revisão editorial de status temporal", () => {
    expect(progression(-20).rank).toBe("Rookie");
    expect(progression(500).rank).toBe("Contender");
    expect(progression(99999).rank).toBe("Legend");
    expect(eventStatus(seed.tournaments[0], new Date("2026-10-12"))).toBe(
      "finished",
    );
    expect(
      isStale(
        "2026-10-10T00:00:00Z",
        "2026-10-11T00:00:00Z",
        new Date("2026-10-12"),
      ),
    ).toBe(true);
  });
  it("exporta dia inteiro quando não há horário e UTC quando há", () => {
    const t = { ...seed.tournaments[0], title: "Teste; mapa, torneio\nNota" };
    const ics = tournamentICS(t);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261010");
    expect(ics).toContain("DTEND;VALUE=DATE:20261011");
    expect(ics).toContain("Teste\\; mapa\\, torneio\\nNota");
    expect(
      tournamentICS({
        ...t,
        starts_at: "2026-10-10T17:00:00-03:00",
        ends_at: "2026-10-10T18:00:00-03:00",
      }),
    ).toContain("DTSTART:20261010T200000Z");
  });
  it("valida todos os registros iniciais e rejeita link ativo inválido", () => {
    seed.exercises.forEach((x) =>
      expect(exerciseSchema.safeParse(x).success).toBe(true),
    );
    seed.articles.forEach((x) =>
      expect(articleSchema.safeParse(x).success).toBe(true),
    );
    seed.tournaments.forEach((x) =>
      expect(tournamentSchema.safeParse(x).success).toBe(true),
    );
    expect(
      articleSchema.safeParse({
        ...seed.articles[0],
        source_url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});
