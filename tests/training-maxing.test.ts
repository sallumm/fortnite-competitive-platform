import { describe, it, expect } from "vitest";
import { trainingCatalog } from "../src/lib/training-catalog";
import {
  identifySteps,
  validatePlan,
  validateResults,
  readPlanDraft,
} from "../src/lib/training";
import { resultGroups } from "../src/lib/performance";
import { seed, uid } from "../src/lib/seed";
import type { Plan, Training } from "../src/lib/types";
const steps = identifySteps(
  [
    "Freebuild",
    "Edit Course",
    "Piece Control",
    "Box Fight",
    "Zone Wars",
    "VOD Review",
    "Freebuild",
  ].map((title) => ({
    exercise_id: trainingCatalog.find((e) => e.title === title)!.id,
    minutes: 5,
  })),
);
const plan: Plan = {
  id: uid(8000),
  user_id: uid(8001),
  title: "Treino completo",
  steps,
};
describe("Training Maxing: integridade e comparação", () => {
  it("recupera rascunhos incompletos apenas do proprietário e rejeita formatos inseguros", () => {
    expect(
      readPlanDraft({ ...plan, title: "", steps: [] }, plan.user_id),
    ).not.toBeNull();
    expect(readPlanDraft(plan, uid(8099))).toBeNull();
    expect(readPlanDraft(plan, plan.user_id, uid(8098))).toBeNull();
    expect(readPlanDraft({ ...plan, steps: [null] }, plan.user_id)).toBeNull();
    expect(
      readPlanDraft(
        { ...plan, steps: [{ ...steps[0], notes: {} }] },
        plan.user_id,
      ),
    ).toBeNull();
  });
  it("combina seis habilidades com repetições identificadas e rejeita colisões e duração inválida", () => {
    expect(validatePlan(plan, seed.exercises)).toEqual([]);
    expect(new Set(steps.map((x) => x.id)).size).toBe(7);
    expect(
      validatePlan({ ...plan, steps: [steps[0], steps[0]] }, seed.exercises),
    ).not.toEqual([]);
    expect(
      validatePlan(
        { ...plan, steps: [{ ...steps[0], minutes: 1.5 }] },
        seed.exercises,
      ),
    ).not.toEqual([]);
  });
  it("Construção Zero não recebe exercícios de construção", () =>
    expect(validatePlan({ ...plan, mode: "zero" }, seed.exercises)).not.toEqual(
      [],
    ));
  it("timer não substitui conclusão manual; unidades e limites são obrigatórios", () => {
    const snapshot = steps.map((st) => ({
      ...st,
      exercise: trainingCatalog.find((e) => e.id === st.exercise_id),
    }));
    const results = snapshot.map((st) => ({
      exercise_id: st.exercise_id,
      step_id: st.id,
      value: null,
      note: "",
      unit: st.exercise?.measurement?.unit,
      version: st.exercise?.measurement?.version,
    }));
    expect(validateResults(snapshot, results)).toBe(false);
    const complete = results.map((r) => ({
      ...r,
      status: "completed" as const,
    }));
    expect(validateResults(snapshot, complete)).toBe(true);
    complete[2].value = 11 as never;
    expect(validateResults(snapshot, complete)).toBe(false);
  });
  it("não mistura unidades, versões ou exercícios pulados e mantém repetições", () => {
    const exercise = trainingCatalog[0];
    const base = {
      id: uid(8005),
      user_id: plan.user_id,
      plan_id: plan.id,
      title: "Teste",
      steps: [{ exercise_id: exercise.id, minutes: 5, exercise }],
      started_at: "2026-10-09T00:00:00Z",
      completed_at: "2026-10-09T00:01:00Z",
      duration_seconds: 60,
      status: "completed",
      xp: 100,
    } as Training;
    const r = {
      exercise_id: exercise.id,
      value: 4,
      note: "",
      configuration: "fixa",
      unit: "erros",
      version: "v1",
      status: "completed" as const,
    };
    const groups = resultGroups(
      [
        { ...base, results: [r, r] },
        { ...base, results: [{ ...r, version: "v2" }] },
        { ...base, results: [{ ...r, status: "skipped" }] },
      ],
      exercise.id,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].points).toHaveLength(2);
  });
});
