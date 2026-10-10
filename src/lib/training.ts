import type { Exercise, Plan, Result, Step } from "./types";
export const trainingCategories: Record<string, string> = {
  aim: "Mira (Aim)",
  mechanics: "Mecânicas",
  piece: "Piece Control",
  combat: "Combate",
  decisions: "Noção de Jogo",
  endgame: "Endgame",
  competitive: "Preparação Competitiva",
  vod: "VOD Review",
  zero: "Construção Zero",
};
export function identifySteps(steps: Step[]): Step[] {
  return steps.map((step) => ({ ...step, id: step.id || crypto.randomUUID() }));
}
export function stepExercise(step: Step, exercises: Exercise[]) {
  return (
    step.exercise ||
    step.custom ||
    exercises.find((e) => e.id === step.exercise_id)
  );
}
export function validatePlan(plan: Plan, exercises: Exercise[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  if (
    plan.practice_format &&
    !["solo", "duo", "trio", "squad", "unspecified"].includes(
      plan.practice_format,
    )
  )
    errors.push("Formato de prática inválido.");
  if (!plan.title.trim() || plan.title.length > 80)
    errors.push("Informe um nome de até 80 caracteres.");
  if (plan.steps.length < 1 || plan.steps.length > 50)
    errors.push("Inclua entre 1 e 50 etapas.");
  if (
    (plan.description?.length || 0) > 1000 ||
    (plan.objective?.length || 0) > 500
  )
    errors.push("Descrição ou objetivo muito longo.");
  for (const step of plan.steps) {
    if (step.id && seen.has(step.id))
      errors.push("Cada etapa precisa de uma identidade própria.");
    if (step.id) seen.add(step.id);
    if (
      !Number.isInteger(step.minutes) ||
      step.minutes < 1 ||
      step.minutes > 120
    )
      errors.push("Cada duração deve estar entre 1 e 120 minutos inteiros.");
    if (
      (step.notes?.length || 0) > 1000 ||
      (step.block?.length || 0) > 80 ||
      (step.repetitions !== undefined &&
        (!Number.isInteger(step.repetitions) ||
          step.repetitions < 1 ||
          step.repetitions > 1000))
    )
      errors.push("Revise notas, bloco e repetições.");
    if (
      step.resource_url &&
      !/^https:\/\/(www\.)?(youtube\.com|youtu\.be|fortnite\.com|dev\.epicgames\.com)\/[^\s]{1,2000}$/.test(
        step.resource_url,
      )
    )
      errors.push(
        "O link deve usar HTTPS e apontar para Fortnite, Epic ou YouTube.",
      );
    const e = stepExercise({ ...step, exercise: undefined }, exercises);
    if (!e) errors.push("Exercício indisponível.");
    if (
      step.custom &&
      (step.custom.id !== step.exercise_id ||
        !step.custom.title.trim() ||
        step.custom.title.length > 160 ||
        step.custom.instructions.length < 20 ||
        step.custom.instructions.length > 10000 ||
        step.custom.map_code !== null ||
        step.custom.source_url !== "")
    )
      errors.push(
        "Atividade personalizada inválida. Use o catálogo para mapas verificados.",
      );
    if (e && plan.mode === "zero" && e.mode === "build")
      errors.push(
        "Uma rotina de Construção Zero não pode conter exercícios de construção.",
      );
  }
  if (plan.steps.reduce((n, step) => n + step.minutes, 0) > 240)
    errors.push("A rotina pode ter no máximo 240 minutos.");
  return [...new Set(errors)];
}
export function validateResults(
  steps: Step[],
  results: Result[],
  abandon = false,
): boolean {
  return (
    results.length === steps.length &&
    results.every((r, i) => {
      const step = steps[i],
        m = step.exercise?.measurement;
      return (
        (!r.conditions ||
          (typeof r.conditions.scenario === "string" &&
            r.conditions.scenario.length <= 120 &&
            typeof r.conditions.device === "string" &&
            r.conditions.device.length <= 80 &&
            typeof r.conditions.sensitivity === "string" &&
            r.conditions.sensitivity.length <= 80 &&
            (r.conditions.test_seconds === null ||
              (Number.isInteger(r.conditions.test_seconds) &&
                r.conditions.test_seconds >= 1 &&
                r.conditions.test_seconds <= 7200)))) &&
        r.exercise_id === step.exercise_id &&
        (!step.id || r.step_id === step.id) &&
        (abandon ||
          !step.id ||
          r.status === "completed" ||
          r.status === "skipped") &&
        typeof r.note === "string" &&
        r.note.length <= 1000 &&
        (!r.configuration ||
          (typeof r.configuration === "string" &&
            r.configuration.length <= 200)) &&
        (r.value === null ||
          (Number.isFinite(r.value) &&
            r.value >= (m?.min ?? 0) &&
            r.value <= (m?.max ?? 1000000))) &&
        (!m || (r.unit === m.unit && r.version === m.version))
      );
    })
  );
}

/** Drafts may be incomplete, but must remain safe to render from untrusted storage. */
export function readPlanDraft(
  value: unknown,
  owner: string,
  planId?: string,
): Plan | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Plan,
    uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    typeof p.id !== "string" ||
    !uuid.test(p.id) ||
    p.user_id !== owner ||
    (planId && p.id !== planId) ||
    typeof p.title !== "string" ||
    p.title.length > 80 ||
    !Array.isArray(p.steps) ||
    p.steps.length > 50
  )
    return null;
  if (
    (p.description !== undefined &&
      (typeof p.description !== "string" || p.description.length > 1000)) ||
    (p.objective !== undefined &&
      (typeof p.objective !== "string" || p.objective.length > 500)) ||
    (p.mode !== undefined && !["build", "zero", "both"].includes(p.mode)) ||
    (p.level !== undefined &&
      !["beginner", "intermediate", "advanced"].includes(p.level))
  )
    return null;
  for (const step of p.steps) {
    if (
      !step ||
      typeof step !== "object" ||
      typeof step.exercise_id !== "string" ||
      !uuid.test(step.exercise_id) ||
      (step.id !== undefined &&
        (typeof step.id !== "string" || !uuid.test(step.id))) ||
      !Number.isFinite(step.minutes) ||
      (step.notes !== undefined &&
        (typeof step.notes !== "string" || step.notes.length > 1000)) ||
      (step.block !== undefined &&
        (typeof step.block !== "string" || step.block.length > 80)) ||
      (step.resource_url !== undefined && typeof step.resource_url !== "string")
    )
      return null;
    const e = step.custom;
    if (
      e &&
      (typeof e !== "object" ||
        e.id !== step.exercise_id ||
        typeof e.title !== "string" ||
        e.title.length > 160 ||
        typeof e.instructions !== "string" ||
        e.instructions.length > 10000 ||
        typeof e.metric !== "string" ||
        e.metric.length > 200 ||
        e.published !== false ||
        e.source_url !== "" ||
        e.map_code !== null ||
        !["build", "zero", "both"].includes(e.mode))
    )
      return null;
  }
  return p;
}
