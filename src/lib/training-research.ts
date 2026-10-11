import corpus from "../data/training-knowledge.json" with { type: "json" };
import type { Exercise } from "./types";

export const knowledge = corpus;
export const evidenceLabels: Record<string, string> = {
  scientific: "Evidência científica",
  official: "Informação oficial",
  professional: "Experiência documentada",
  editorial: "Recomendação editorial",
  hypothesis: "Hipótese / verificação pendente",
};
export const accessLabels: Record<string, string> = {
  indexed_excerpt: "Trecho primário indexado",
  abstract: "Resumo científico",
  text_sections: "Seções do texto",
  page: "Texto da página",
  listing: "Listagem do criador",
  original: "Conteúdo original",
  metadata: "Descrição pública",
  unavailable: "Conteúdo não acessível",
};
export const purposeLabels: Record<string, string> = {
  warmup: "Aquecimento",
  technical: "Treino técnico",
  contextual: "Prática contextual",
  competitive: "Prática competitiva",
  review: "Análise / VOD Review",
};
export { reviewPending } from "./exercise-review";
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function searchCompetencies(
  query: string,
  category = "all",
  mode = "all",
) {
  const terms = normalize(query.slice(0, 300)).split(/\s+/).filter(Boolean);
  return corpus.competencies.filter(
    (c) =>
      (category === "all" || c.category === category) &&
      (mode === "all" || c.mode === "both" || c.mode === mode) &&
      terms.every((t) =>
        normalize(`${c.title} ${c.subcategory} ${c.definition}`).includes(t),
      ),
  );
}
// Retrieval is deterministic public data, never instructions or a private user context.
// Callers must keep this object in an untrusted evidence channel when adding a provider.
export function retrieveTrainingKnowledge(
  query: string,
  mode: "build" | "zero",
  limit = 5,
) {
  const skills = (
    query.trim() ? searchCompetencies(query, "all", mode) : []
  ).slice(
    0,
    Math.max(0, Math.min(5, Number.isFinite(limit) ? Math.floor(limit) : 5)),
  );
  const refs = new Set(skills.flatMap((s) => s.evidence_ids));
  return {
    version: corpus.version,
    trust: "reference-data-only" as const,
    competencies: skills,
    references: corpus.references.filter(
      (r) => refs.has(r.id) && r.access !== "unavailable",
    ),
  };
}
export function pathExercises(pathId: string, catalog: Exercise[]) {
  const path = corpus.paths.find((p) => p.id === pathId);
  if (!path) return null;
  const exercises = path.exercise_ids.map((id) =>
    catalog.find(
      (e) =>
        e.id === id && e.published && e.research?.review_status !== "retired",
    ),
  );
  if (
    exercises.some(
      (e) =>
        !e ||
        (path.mode !== "both" && e.mode !== "both" && e.mode !== path.mode),
    )
  )
    return null;
  return { path, exercises: exercises as Exercise[] };
}

export {
  researchSchema,
  compatibleCompetencies,
  type ExerciseResearch,
} from "./training-research-validation";
