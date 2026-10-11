import type { Answer } from "../coach/domain.ts";
import { answerKnowledge, askSchema, type KnowledgeRow } from "./domain.ts";
export function appendKnowledgeToCoach(
  answer: Answer,
  message: string,
  rows: KnowledgeRow[],
) {
  if (!Array.isArray(rows)) return;
  const result = answerKnowledge(askSchema.parse({ message }), rows);
  if (result.missing || !result.sections.length) return;
  answer.sections.push(
    ...result.sections.map((s) => ({
      title: "Fortnite Knowledge · " + s.title,
      items: [s.text],
    })),
  );
  for (const r of result.references)
    if (!answer.references.some((x) => x.id === r.id))
      answer.references.push({
        id: r.id,
        title: r.title,
        url: r.url,
        verified_at: r.verified_at,
      });
  answer.scope.push("Base pública de Fortnite Knowledge, sem dados pessoais");
}
