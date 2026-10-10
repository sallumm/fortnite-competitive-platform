import type { Answer } from "./domain.ts";
export interface MetaReferenceData {
  id: string;
  title: string;
  body: string;
  limitations: string;
  sources: { id: string; title: string; url: string; verified_at: string }[];
}
// The editorial corpus is untrusted reference data, never system instructions or executable actions.
export function appendMetaAnswer(
  answer: Answer,
  rows: MetaReferenceData[],
  context: string,
) {
  const valid = Array.isArray(rows)
    ? rows.slice(0, 4).filter(
        (r) =>
          r &&
          typeof r.id === "string" &&
          typeof r.title === "string" &&
          typeof r.body === "string" &&
          typeof r.limitations === "string" &&
          Array.isArray(r.sources) &&
          r.sources.length > 0 &&
          r.sources.length <= 12 &&
          r.sources.every((s) => {
            try {
              const u = new URL(s.url);
              return (
                s.url.length <= 1500 &&
                typeof s.id === "string" &&
                typeof s.title === "string" &&
                u.protocol === "https:" &&
                !u.username &&
                !u.password &&
                Number.isFinite(Date.parse(s.verified_at))
              );
            } catch {
              return false;
            }
          }),
      )
    : [];
  answer.sections.push({
    title: `Meta verificado · contexto ${context}`,
    items: valid.length
      ? valid.map(
          (r) =>
            `${r.title.slice(0, 160)}: ${r.body.slice(0, 1500)} Limitações: ${r.limitations.slice(0, 800)}`,
        )
      : [
          "Não há informação atual revisada suficiente neste contexto. Conteúdo histórico não confirma a temporada atual.",
        ],
  });
  for (const r of valid)
    for (const source of r.sources)
      if (!answer.references.some((s) => s.id === `meta:${source.id}`))
        answer.references.push({
          id: `meta:${source.id}`,
          title: source.title.slice(0, 160),
          url: source.url,
          verified_at: source.verified_at,
        });
  answer.scope.push(
    "Referências editoriais públicas · contexto exato selecionado",
  );
}
