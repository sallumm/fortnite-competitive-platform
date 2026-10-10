import { z } from "zod";
import type { Article } from "./types";
export const questionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{3,60}$/),
    prompt: z.string().trim().min(10).max(1000),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(5),
    answer: z.number().int().min(0).max(4),
    explanation: z.string().trim().min(10).max(1000),
  })
  .strict()
  .refine((q) => q.answer < q.options.length, "Resposta fora das opções.");
export const questionsSchema = z
  .array(questionSchema)
  .max(12)
  .refine(
    (q) => new Set(q.map((x) => x.id)).size === q.length,
    "Identificadores duplicados.",
  );
export type Question = z.infer<typeof questionSchema>;
export interface StudyRecord {
  id: string;
  lesson_id: string;
  action: "started" | "completed" | "reviewed" | "assessment";
  snapshot: {
    title: string;
    slug: string;
    version: string;
    questions: Question[];
    body?: string;
    curriculum?: Article["curriculum"];
  };
  answers: number[];
  created_at: string;
}
export interface StudyNote {
  lesson_id: string;
  note: string;
  difficulty: string;
  favorite: boolean;
  updated_at: string;
}
export interface StudyData {
  records: StudyRecord[];
  notes: StudyNote[];
}
export const emptyStudy = (): StudyData => ({ records: [], notes: [] });
export const studyLabels = {
  started: "Em estudo",
  completed: "Estudo concluído",
  reviewed: "Revisado",
  assessment: "Avaliação registrada",
};
export function lessonState(records: StudyRecord[], id: string) {
  const list = records.filter((r) => r.lesson_id === id);
  return list.some((r) => r.action === "reviewed")
    ? "reviewed"
    : list.some((r) => r.action === "completed")
      ? "completed"
      : list.length
        ? "started"
        : null;
}
export function assessmentResult(questions: Question[], answers: number[]) {
  if (
    !questions.length ||
    answers.length !== questions.length ||
    questions.some(
      (q, i) =>
        !Number.isInteger(answers[i]) ||
        answers[i] < 0 ||
        answers[i] >= q.options.length,
    )
  )
    throw new Error("Responda todas as perguntas.");
  return {
    correct: questions.filter((q, i) => q.answer === answers[i]).length,
    total: questions.length,
  };
}
export const tracks = [
  {
    id: "fundamentos",
    title: "Primeiro contato",
    slugs: [
      "primeira-partida",
      "controles-interface",
      "inventario-tempestade",
      "mira-movimento",
    ],
  },
  {
    id: "mecanicas",
    title: "Mecânicas e materiais",
    slugs: ["materiais-mats", "pecas-edicao"],
  },
  {
    id: "combate",
    title: "Combate e Piece Control",
    slugs: ["peeks-trocas", "piece-box-realistic"],
  },
  {
    id: "partida",
    title: "Early e mid game",
    slugs: ["early-drop", "mid-rotacoes"],
  },
  {
    id: "endgame",
    title: "Endgame",
    slugs: ["endgame-camadas", "tarp-refresh", "surge-contexto"],
  },
  {
    id: "zero",
    title: "Construção Zero",
    slugs: [
      "primeira-partida",
      "mira-movimento",
      "zero-cobertura",
      "zero-endgame",
    ],
  },
  {
    id: "equipe",
    title: "Equipe, Reload e competitivo",
    slugs: ["equipe-funcoes", "reload-retornos", "ranked-scrims-torneios"],
  },
  { id: "vod", title: "VOD Review", slugs: ["vod-hipoteses"] },
];
export function lessonsForTrack(articles: Article[], slugs: string[]) {
  return slugs.flatMap((slug) => {
    const a = articles.find((a) => a.slug === slug);
    return a ? [a] : [];
  });
}
// Restore only bounded educational state. Corrupt demo data is not account data.
export const studyDataSchema = z.object({
  records: z
    .array(
      z.object({
        id: z.string().uuid(),
        lesson_id: z.string().uuid(),
        action: z.enum(["started", "completed", "reviewed", "assessment"]),
        snapshot: z
          .object({
            title: z.string().max(300),
            slug: z.string().max(100),
            version: z.string().max(40),
            questions: questionsSchema,
          })
          .passthrough(),
        answers: z.array(z.number().int().min(0).max(4)).max(12),
        created_at: z.string().datetime(),
      }),
    )
    .max(10000),
  notes: z
    .array(
      z.object({
        lesson_id: z.string().uuid(),
        note: z.string().max(4000),
        difficulty: z.string().max(1000),
        favorite: z.boolean(),
        updated_at: z.string().datetime(),
      }),
    )
    .max(10000),
});
