import type { Article, Catalog, Exercise, PlayerData } from "./types";
import type { StudyData, StudyRecord } from "./academy";
import { curriculumLessons } from "./curriculum";
import { ownedPerformanceData, goalState, analyze } from "./intelligence";
import { dateInZone, shiftDate } from "./calendar";

export interface LearningContext {
  owner_id: string;
  records: StudyRecord[];
}
export interface CatalogIssue {
  key: string;
  title: string;
  detail: string;
  to: string;
}
/** Audit metadata only; this does not claim to have opened or tested external resources. */
export function catalogIssues(
  catalog: Catalog,
  now = new Date(),
): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  for (const [type, rows] of Object.entries(catalog)) {
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.id))
        issues.push({
          key: `duplicate:${type}:${row.id}`,
          title: row.title,
          detail: "Identificador duplicado no catálogo carregado.",
          to: "/admin",
        });
      seen.add(row.id);
      if (!row.published) continue;
      if (!/^https:\/\//.test(row.source_url))
        issues.push({
          key: `source:${type}:${row.id}`,
          title: row.title,
          detail: "Fonte HTTPS ausente ou inválida.",
          to: "/admin",
        });
      if (
        !Number.isFinite(Date.parse(row.verified_at)) ||
        Date.parse(row.verified_at) > now.getTime()
      )
        issues.push({
          key: `date:${type}:${row.id}`,
          title: row.title,
          detail: "Data de verificação inválida ou futura.",
          to: "/admin",
        });
    }
  }
  const lessons = curriculumLessons(catalog.articles, now.getTime());
  for (const a of lessons) {
    if (!a.valid_until || Date.parse(a.valid_until) <= now.getTime())
      issues.push({
        key: `review:${a.id}`,
        title: a.title,
        detail: "Prazo de revisão da aula encerrado ou ausente.",
        to: "/admin/academy",
      });
    for (const slug of a.curriculum!.prerequisites)
      if (!lessons.some((b) => b.slug === slug))
        issues.push({
          key: `base:${a.id}:${slug}`,
          title: a.title,
          detail: `Base editorial indisponível: ${slug}.`,
          to: "/admin/academy",
        });
    for (const id of a.curriculum!.exercise_ids) {
      const e = catalog.exercises.find(
        (e) =>
          e.id === id && e.published && e.research?.review_status !== "retired",
      );
      if (!e)
        issues.push({
          key: `exercise:${a.id}:${id}`,
          title: a.title,
          detail: "Exercício vinculado indisponível ou retirado.",
          to: "/admin/academy",
        });
      else if (
        !a.curriculum!.modes.some((m) => e.mode === "both" || e.mode === m)
      )
        issues.push({
          key: `mode:${a.id}:${id}`,
          title: a.title,
          detail: `Modalidade incompatível no vínculo com ${e.title}.`,
          to: "/admin/academy",
        });
    }
  }
  return issues;
}

/** Links are editorial IDs, never title similarity or an inference of mastery. */
export function relatedLessons(
  exercise: Exercise,
  articles: Article[],
  now = new Date(),
) {
  return curriculumLessons(articles, now.getTime()).filter(
    (a) =>
      a.curriculum!.exercise_ids.includes(exercise.id) &&
      a.curriculum!.modes.some(
        (m) => exercise.mode === "both" || exercise.mode === m,
      ),
  );
}

export function currentStudy(
  articles: Article[],
  mode: "build" | "zero",
  records: StudyRecord[],
  now = new Date(),
) {
  return curriculumLessons(articles, now.getTime()).filter(
    (a) =>
      a.curriculum!.modes.includes(mode) &&
      Date.parse(a.verified_at) <= now.getTime() &&
      Boolean(a.valid_until && Date.parse(a.valid_until) > now.getTime()) &&
      records.some(
        (r) =>
          r.lesson_id === a.id &&
          ["completed", "reviewed"].includes(r.action) &&
          r.snapshot.version === a.curriculum!.version &&
          Date.parse(r.created_at) <= now.getTime(),
      ),
  );
}

export function learningForExercise(exercise: Exercise, lessons: Article[]) {
  return lessons.filter((a) =>
    a.curriculum!.exercise_ids.includes(exercise.id),
  );
}

/** Read-only synthesis. Calendar changes continue through existing confirmed flows. */
export function developmentSummary(
  data: PlayerData,
  catalog: Catalog,
  study: StudyData,
  now = new Date(),
) {
  data = ownedPerformanceData(data);
  const p = data.profile;
  if (!p) return null;
  const today = dateInZone(now, p.timezone);
  const lessons = curriculumLessons(catalog.articles, now.getTime()).filter(
    (a) => a.curriculum!.modes.includes(p.mode),
  );
  const learned = currentStudy(lessons, p.mode, study.records, now);
  const learnedIds = new Set(learned.map((a) => a.id));
  const studiedIds = new Set(
    study.records
      .filter(
        (r) =>
          ["completed", "reviewed"].includes(r.action) &&
          Date.parse(r.created_at) <= now.getTime(),
      )
      .map((r) => r.lesson_id),
  );
  const practiced = new Set(
    data.sessions
      .filter(
        (s) =>
          s.status === "completed" &&
          s.completed_at &&
          Date.parse(s.completed_at) <= now.getTime(),
      )
      .flatMap((s) =>
        s.results
          .filter((r) => r.status === "completed")
          .map((r) => r.exercise_id),
      ),
  );
  const apply = learned.flatMap((a) =>
    a.curriculum!.exercise_ids.flatMap((id) => {
      const e = catalog.exercises.find(
        (e) =>
          e.id === id &&
          e.published &&
          (e.mode === "both" || e.mode === p.mode) &&
          e.research?.review_status === "verified" &&
          Date.parse(e.research.review_due_at) > now.getTime() &&
          Date.parse(e.verified_at) <= now.getTime(),
      );
      return e && !practiced.has(e.id) ? [{ lesson: a, exercise: e }] : [];
    }),
  )[0];
  const targetSkills = new Set(
    data.goals
      .filter((g) => goalState(g) === "active")
      .flatMap(
        (g) =>
          g.exercise_ids?.flatMap(
            (id) =>
              catalog.exercises.find((e) => e.id === id)?.research
                ?.competency_ids || [],
          ) || [],
      ),
  );
  const maxLevel =
    p.level === "beginner" ? 1 : p.level === "intermediate" ? 3 : 5;
  const startingLevel =
    p.level === "beginner" ? 0 : p.level === "intermediate" ? 2 : 4;
  const next = lessons
    .filter(
      (a) =>
        !learnedIds.has(a.id) &&
        a.curriculum!.level <= maxLevel &&
        a.valid_until &&
        Date.parse(a.valid_until) > now.getTime() &&
        Date.parse(a.verified_at) <= now.getTime(),
    )
    .sort(
      (a, b) =>
        Number(
          b.curriculum!.competency_ids.some((id) => targetSkills.has(id)),
        ) -
          Number(
            a.curriculum!.competency_ids.some((id) => targetSkills.has(id)),
          ) ||
        Math.abs(a.curriculum!.level - startingLevel) -
          Math.abs(b.curriculum!.level - startingLevel) ||
        a.slug.localeCompare(b.slug),
    )[0];
  const review = lessons.find(
    (a) => studiedIds.has(a.id) && !learnedIds.has(a.id),
  );
  const difficulties = study.notes.filter(
    (n) => n.difficulty.trim() && lessons.some((a) => a.id === n.lesson_id),
  );
  const analysis = analyze(
    data,
    catalog.exercises,
    shiftDate(today, -29),
    today,
    now,
  );
  return {
    lessons,
    learned,
    apply,
    next,
    review,
    difficulties,
    analysis,
    goals: data.goals.filter((g) => goalState(g) === "active"),
  };
}
