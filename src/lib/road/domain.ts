import { z } from "zod";
import programs from "../../data/road-programs.json";
import { curriculumLessons } from "../curriculum";
import type { Article, Catalog, PlayerData } from "../types";
import {
  evolutionConfigSchema,
  type EvolutionConfig,
} from "../skill-maxing/config";
import {
  generateEvolution,
  type EvolutionProposal,
} from "../skill-maxing/engine";
import { knowledge } from "../training-research";
import { resultGroups } from "../performance";
import { lessonState, type StudyRecord } from "../academy";

export const roadConfigSchema = z
  .object({
    config: evolutionConfigSchema,
    experience: z.enum(["first", "some", "regular"]),
    familiarity: z.string().trim().max(1000),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (d) =>
          Number.isFinite(Date.parse(d + "T12:00:00Z")) &&
          new Date(d + "T12:00:00Z").toISOString().slice(0, 10) === d,
      ),
  })
  .strict();
export type RoadConfig = z.infer<typeof roadConfigSchema>;
export type RoadProgram = (typeof programs)[number];
export interface RoadLesson {
  stage: number;
  article: Article;
}
export interface Journey extends RoadConfig {
  id: string;
  user_id: string;
  program_id: string;
  version: string;
  status: "active" | "paused" | "completed";
  created_at: string;
  snapshot: { program: RoadProgram; lessons: RoadLesson[] };
}
export interface RoadEvent {
  id: string;
  user_id: string;
  journey_id: string;
  created_at: string;
  action:
    | "started"
    | "completed"
    | "reviewed"
    | "assessment"
    | "skipped"
    | "pause"
    | "resume"
    | "finish"
    | "preferences";
  lesson_id: string | null;
  note: string;
  answers: number[];
  study_record_id?: string | null;
}
export interface RoadBatch {
  id: string;
  user_id: string;
  journey_id: string;
  stage: number;
  result: { plan_id: string; series_id: string }[];
  created_at: string;
}
export interface RoadData {
  journeys: Journey[];
  events: RoadEvent[];
  batches: RoadBatch[];
}
export const emptyRoad = (): RoadData => ({
  journeys: [],
  events: [],
  batches: [],
});
export function snapshotProgram(
  mode: "build" | "zero",
  catalog: Catalog,
  now = Date.now(),
) {
  const program = programs.find((p) => p.mode === mode)!;
  const available = curriculumLessons(catalog.articles, now);
  const lessons = program.modules.flatMap((m) =>
    m.slugs.map((slug) => {
      const article = available.find(
        (a) => a.slug === slug && a.curriculum!.modes.includes(mode),
      );
      if (!article)
        throw new Error(
          "Uma aula desta jornada está indisponível. Tente novamente após revisão editorial.",
        );
      return { stage: m.stage, article: structuredClone(article) };
    }),
  );
  return { program: structuredClone(program), lessons };
}
export function journeyRecords(j: Journey, events: RoadEvent[]): StudyRecord[] {
  return events
    .filter(
      (e) =>
        e.journey_id === j.id &&
        ["started", "completed", "reviewed", "assessment"].includes(e.action),
    )
    .flatMap((e) => {
      const a = j.snapshot.lessons.find(
        (l) => l.article.id === e.lesson_id,
      )?.article;
      return a
        ? [
            {
              id: e.study_record_id || e.id,
              lesson_id: a.id,
              action: e.action as StudyRecord["action"],
              snapshot: {
                title: a.title,
                slug: a.slug,
                version: a.curriculum!.version,
                questions: a.academy_questions || [],
                body: a.body,
                curriculum: a.curriculum,
              },
              answers: e.answers,
              created_at: e.created_at,
            },
          ]
        : [];
    });
}
export function journeyProgress(j: Journey, events: RoadEvent[]) {
  const own = events.filter((e) => e.journey_id === j.id),
    records = journeyRecords(j, events);
  const stages = j.snapshot.program.modules.map((m) => {
    const lessons = j.snapshot.lessons.filter((l) => l.stage === m.stage);
    const studied = lessons.filter((l) =>
      ["completed", "reviewed"].includes(
        lessonState(records, l.article.id) || "",
      ),
    );
    const skipped = lessons.filter(
      (l) =>
        !studied.includes(l) &&
        own.some((e) => e.lesson_id === l.article.id && e.action === "skipped"),
    );
    return {
      ...m,
      lessons,
      studied: studied.length,
      skipped: skipped.length,
      done: studied.length + skipped.length === lessons.length,
    };
  });
  return {
    stages,
    current: stages.find((s) => !s.done)?.stage || 4,
    studied: stages.reduce((n, s) => n + s.studied, 0),
    skipped: stages.reduce((n, s) => n + s.skipped, 0),
    total: j.snapshot.lessons.length,
    assessments: records.filter((r) => r.action === "assessment"),
  };
}
export function stageProposal(
  j: Journey,
  stage: number,
  config: EvolutionConfig,
  data: PlayerData,
  catalog: Catalog,
  from: string,
  now = new Date(),
  events: RoadEvent[] = [],
): EvolutionProposal {
  if (j.status !== "active")
    throw new Error("Retome a jornada antes de planejar.");
  if (config.mode !== j.config.mode || config.input !== j.config.input)
    throw new Error("Salve as preferências da jornada antes de planejar.");
  const lessons = j.snapshot.lessons.filter((l) => l.stage === stage);
  if (!lessons.length) throw new Error("Etapa inválida.");
  const ids = new Set(
    lessons.flatMap((l) => l.article.curriculum!.exercise_ids),
  );
  const competencies = new Set(
    lessons.flatMap((l) => l.article.curriculum!.competency_ids),
  );
  const compatible = knowledge.competencies.filter(
    (k) =>
      competencies.has(k.id) && (k.mode === "both" || k.mode === config.mode),
  );
  const fallback = config.mode === "zero" ? "zero-aim" : "crosshair";
  const skills = (compatible.length ? compatible.map((k) => k.id) : [fallback])
    .slice(0, 12)
    .map((id) => ({
      id,
      weight: config.skills.find((s) => s.id === id)?.weight || 3,
    }));
  const c = {
    ...config,
    skills,
    objective:
      `Etapa ${stage}: ${j.snapshot.program.modules.find((m) => m.stage === stage)!.objective}`.slice(
        0,
        200,
      ),
  };
  const exercises = catalog.exercises.filter(
    (e) =>
      ids.has(e.id) ||
      e.research?.competency_ids.some((id) => skills.some((s) => s.id === id)),
  );
  const p = generateEvolution(
    c,
    data,
    { ...catalog, exercises },
    from,
    1,
    now,
    undefined,
    "solo",
    {
      owner_id: j.user_id,
      records: journeyRecords(
        j,
        events.filter((e) => e.user_id === j.user_id),
      ),
    },
  );
  for (const s of p.sessions) {
    s.plan.title = `Road · Etapa ${stage} · ${s.plan.title}`.slice(0, 120);
    s.reasons.unshift(
      "Sequência editorial da etapa; duração definida pela sua disponibilidade, sem dose universal validada.",
    );
  }
  p.warnings.unshift(
    "A proposta agenda somente esta semana. Os 30 dias são uma referência flexível; descanso e repetição não apagam progresso.",
  );
  return p;
}
export function journeyReport(j: Journey, road: RoadData, data: PlayerData) {
  const batches = road.batches.filter(
    (b) => b.journey_id === j.id && b.user_id === j.user_id,
  );
  const ids = new Set(batches.flatMap((b) => b.result.map((r) => r.plan_id)));
  const sessions = data.sessions.filter(
    (s) =>
      s.user_id === j.user_id &&
      Date.parse(s.started_at) <= Date.now() &&
      (!s.completed_at || Date.parse(s.completed_at) <= Date.now()) &&
      (s.learning_journey_id === j.id ||
        Boolean(s.plan_id && ids.has(s.plan_id))),
  );
  const exercises = [
    ...new Set(
      sessions.flatMap((s) =>
        s.results
          .filter((r) => r.status === "completed")
          .map((r) => r.exercise_id),
      ),
    ),
  ];
  const comparisons = exercises.flatMap((id) =>
    resultGroups(sessions, id)
      .map((g) => ({
        ...g,
        points: [...new Map(g.points.map((p) => [p.date, p])).values()],
      }))
      .filter((g) => {
        if (g.points.length < 2) return false;
        const protocols = sessions.flatMap((s) =>
          s.steps
            .filter((st) => st.exercise_id === id)
            .flatMap((st) =>
              st.exercise?.measurement ? [st.exercise.measurement] : [],
            ),
        );
        return (
          !protocols.length ||
          protocols.some((p) => p.unit === g.unit && p.version === g.version)
        );
      })
      .map((g) => ({ exercise_id: id, ...g })),
  );
  const progress = journeyProgress(j, road.events);
  return {
    progress,
    sessions,
    completed: sessions.filter((s) => s.status === "completed").length,
    interrupted: sessions.filter((s) => s.status === "abandoned").length,
    comparisons,
    goals: data.goals.filter(
      (g) =>
        g.user_id === j.user_id &&
        g.completed &&
        g.exercise_ids?.some((id) => exercises.includes(id)),
    ),
    difficulties: [
      ...new Set([
        ...(j.config.difficulties ? [j.config.difficulties] : []),
        ...road.events
          .filter((e) => e.journey_id === j.id && e.lesson_id && e.note)
          .map((e) => e.note),
        ...sessions.flatMap((s) =>
          s.results.filter((r) => r.note.trim()).map((r) => r.note),
        ),
      ]),
    ],
    gaps: j.snapshot.lessons
      .filter(
        (l) =>
          !sessions.some((s) =>
            s.results.some(
              (r) =>
                r.status === "completed" &&
                l.article.curriculum!.exercise_ids.includes(r.exercise_id),
            ),
          ),
      )
      .map((l) => l.article.title),
    skills: [
      ...new Set([
        ...sessions.flatMap((s) =>
          s.steps
            .filter((st) =>
              s.results.some(
                (r) =>
                  r.status === "completed" &&
                  (r.step_id === st.id ||
                    (!r.step_id && r.exercise_id === st.exercise_id)),
              ),
            )
            .flatMap((st) => st.exercise?.research?.competency_ids || []),
        ),
        ...j.snapshot.lessons
          .filter((l) =>
            ["completed", "reviewed"].includes(
              lessonState(journeyRecords(j, road.events), l.article.id) || "",
            ),
          )
          .flatMap((l) => l.article.curriculum!.competency_ids),
      ]),
    ],
  };
}
