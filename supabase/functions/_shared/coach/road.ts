import type { Answer } from "./domain.ts";
export interface RoadSummary {
  mode: string;
  status: string;
  objective: string;
  studied: number;
  skipped: number;
  assessments: number;
  completed_sessions: number;
}
export function appendRoadAnswer(answer: Answer, summary: RoadSummary | null) {
  const safe =
    summary &&
    typeof summary.objective === "string" &&
    [
      summary.studied,
      summary.skipped,
      summary.assessments,
      summary.completed_sessions,
    ].every((n) => Number.isInteger(n) && n >= 0 && n <= 10000);
  answer.sections.push({
    title: "Minha jornada Road to Competitive",
    items: safe
      ? [
          `Modalidade: ${summary.mode === "zero" ? "Zero Build" : "Construção"}; estado: ${summary.status === "paused" ? "pausada" : summary.status === "completed" ? "encerrada" : "em andamento"}. Objetivo informado: ${summary.objective.slice(0, 200)}.`,
          `${summary.studied} aulas estudadas, ${summary.skipped} puladas por você, ${summary.assessments} avaliações conceituais e ${summary.completed_sessions} sessões concluídas. Conclusão de estudo não demonstra domínio prático.`,
          "Revise a próxima aula ou repita um exercício com as mesmas condições. Descanso não reduz progresso; alterações na agenda exigem prévia e confirmação na jornada.",
        ]
      : [
          "Nenhum ciclo acessível foi encontrado. Consulte sua jornada; os registros privados exigem consentimento de personalização.",
        ],
  });
  if (safe)
    answer.scope.push(
      "Resumo mínimo da própria jornada, autorizado pelo usuário",
    );
}
