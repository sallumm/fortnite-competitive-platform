import { z } from "zod";
import type { Article } from "./types";
const key = z.string().regex(/^[a-z0-9-]{3,100}$/);
const strings = (min: number, max: number) =>
  z.array(z.string().trim().min(min).max(500)).min(1).max(max);
export const curriculumSchema = z
  .object({
    version: z.string().min(1).max(40),
    level: z.number().int().min(0).max(5),
    domain: key,
    modes: z
      .array(z.enum(["build", "zero"]))
      .min(1)
      .max(2),
    experience: z.enum(["br", "reload", "all"]),
    phase: z.enum(["foundation", "early", "mid", "endgame", "review"]),
    prerequisites: z.array(key).max(12),
    objectives: strings(10, 6),
    assessment: strings(10, 6),
    exercise_ids: z.array(z.string().uuid()).max(12),
    competency_ids: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(12),
    meta_scope: z.string().trim().min(20).max(500),
    classification: z.literal("editorial"),
    sources: z
      .array(
        z
          .object({
            title: z.string().trim().min(3).max(160),
            url: z
              .string()
              .url()
              .refine((u) => /^https:\/\/[^\s]+$/.test(u)),
            kind: z.enum(["official", "professional", "scientific"]),
            access: z.enum([
              "page",
              "listing",
              "abstract",
              "metadata",
              "text_sections",
            ]),
            supports: z.string().trim().min(10).max(500),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()
  .superRefine((c, ctx) => {
    for (const k of [
      "modes",
      "prerequisites",
      "exercise_ids",
      "competency_ids",
    ] as const)
      if (new Set(c[k]).size !== c[k].length)
        ctx.addIssue({
          code: "custom",
          path: [k],
          message: "Remova valores duplicados.",
        });
  });
export type Curriculum = z.infer<typeof curriculumSchema>;
export const levelNames = [
  "Primeiro contato",
  "Fundamentos",
  "Desenvolvimento mecânico",
  "Aplicação em partidas",
  "Estratégia competitiva",
  "Aperfeiçoamento avançado",
];
export const phaseNames = {
  foundation: "Fundamentos",
  early: "Early game",
  mid: "Mid game",
  endgame: "Endgame",
  review: "Revisão",
};
export function curriculumLessons(articles: Article[], now = Date.now()) {
  return articles.filter(
    (a) =>
      a.kind === "lesson" &&
      a.published &&
      Date.parse(a.published_at) <= now &&
      curriculumSchema.safeParse(a.curriculum).success,
  );
}
// Pedagogical graph only. No unlocking, ranking, private progress or writes.
export function prerequisiteIssues(articles: Article[]) {
  const lessons = articles.filter((a) => a.curriculum);
  const bySlug = new Map(lessons.map((a) => [a.slug, a]));
  const issues: string[] = [];
  for (const a of lessons) {
    const active = new Set<string>();
    const visited = new Set<string>();
    const visit = (slug: string) => {
      if (active.has(slug)) {
        issues.push(`Ciclo: ${a.slug}`);
        return;
      }
      if (visited.has(slug)) return;
      const current = bySlug.get(slug);
      if (!current) {
        issues.push(`Pré-requisito ausente: ${slug}`);
        return;
      }
      active.add(slug);
      for (const p of current.curriculum!.prerequisites) {
        const parent = bySlug.get(p);
        if (
          parent &&
          current.curriculum!.modes.some(
            (m) => !parent.curriculum!.modes.includes(m),
          )
        )
          issues.push(`Modalidade incompatível: ${slug} → ${p}`);
        visit(p);
      }
      active.delete(slug);
      visited.add(slug);
    };
    visit(a.slug);
  }
  return [...new Set(issues)];
}
export function searchLessons(
  articles: Article[],
  filters: {
    query?: string;
    level?: string;
    mode?: string;
    experience?: string;
    phase?: string;
  },
) {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const terms = normalize((filters.query || "").slice(0, 300))
    .split(/\s+/)
    .filter(Boolean);
  return curriculumLessons(articles)
    .filter((a) => {
      const c = a.curriculum!;
      return (
        (!filters.level ||
          filters.level === "all" ||
          c.level === Number(filters.level)) &&
        (!filters.mode ||
          filters.mode === "all" ||
          c.modes.includes(filters.mode as "build" | "zero")) &&
        (!filters.experience ||
          filters.experience === "all" ||
          c.experience === "all" ||
          c.experience === filters.experience) &&
        (!filters.phase ||
          filters.phase === "all" ||
          c.phase === filters.phase) &&
        terms.every((t) =>
          normalize(
            `${a.title} ${a.summary} ${a.body} ${a.tags?.join(" ")}`,
          ).includes(t),
        )
      );
    })
    .sort(
      (a, b) =>
        a.curriculum!.level - b.curriculum!.level ||
        a.title.localeCompare(b.title, "pt-BR"),
    );
}

// Public editorial retrieval for future contextual assistants. Never execute text or fetch arbitrary URLs.
export function retrieveCurriculum(
  query: string,
  mode: "build" | "zero",
  articles: Article[],
  limit = 3,
  now = Date.now(),
) {
  const bound = Number.isFinite(limit)
    ? Math.max(0, Math.min(3, Math.floor(limit)))
    : 3;
  return {
    trust: "reference-data-only" as const,
    lessons: (query.trim() ? searchLessons(articles, { query, mode }) : [])
      .slice(0, bound)
      .map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        body: a.body.slice(0, 3000),
        verified_at: a.verified_at,
        valid_until: a.valid_until,
        stale: !a.valid_until || Date.parse(a.valid_until) <= now,
        classification: a.curriculum!.classification,
        meta_scope: a.curriculum!.meta_scope,
        sources: a.curriculum!.sources,
      })),
  };
}
