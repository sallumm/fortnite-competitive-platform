import { z } from "zod";
import corpus from "../data/training-knowledge-index.json" with { type: "json" };
const ids = z
  .array(z.string().regex(/^[a-z0-9-]{1,60}$/))
  .min(1)
  .max(12)
  .refine((a) => new Set(a).size === a.length, "IDs repetidos.");
export const researchSchema = z
  .object({
    competency_ids: ids.refine(
      (a) => a.every((id) => corpus.competencies.some((c) => c.id === id)),
      "Competência desconhecida.",
    ),
    evidence_ids: ids.refine(
      (a) =>
        a.every((id) =>
          corpus.references.some(
            (r) => r.id === id && r.access !== "unavailable",
          ),
        ),
      "Referência indisponível ou desconhecida.",
    ),
    purpose: z.enum([
      "warmup",
      "technical",
      "contextual",
      "competitive",
      "review",
    ]),
    completion: z.string().trim().min(20).max(1000),
    transfer: z.string().trim().min(20).max(1000),
    limitations: z.string().trim().min(20).max(1000),
    review_status: z.enum(["pending", "verified", "retired"]),
    review_due_at: z.iso.datetime({ offset: true }),
    review_notes: z.string().trim().min(10).max(1000),
  })
  .strict();
export type ExerciseResearch = z.infer<typeof researchSchema>;
export function compatibleCompetencies(mode: string, ids: string[]) {
  return ids.every((id) => {
    const c = corpus.competencies.find((c) => c.id === id);
    return (
      c &&
      (mode === "both"
        ? c.mode === "both"
        : c.mode === "both" || c.mode === mode)
    );
  });
}
