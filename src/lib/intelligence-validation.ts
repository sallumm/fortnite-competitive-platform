import { z } from "zod";
import type { Exercise, Goal } from "./types";
import { skills, type Skill } from "./performance-types";
import { vodCategories, type VodReview } from "./intelligence-types";
const skillEnum = z.enum(Object.keys(skills) as [Skill, ...Skill[]]);
const ids = z
  .array(z.uuid())
  .max(20)
  .refine((a) => new Set(a).size === a.length);
const date = z.iso.date();
export const vodSchema = z
  .object({
    id: z.uuid(),
    user_id: z.string().min(1),
    title: z.string().trim().min(1).max(160),
    match_date: date,
    tournament_id: z.uuid().nullable(),
    video_url: z
      .string()
      .max(500)
      .refine((v) => !v || authorizedVideo(v)),
    video_authorized: z.boolean(),
    duration_seconds: z.number().int().min(1).max(86400).nullable(),
    exercise_ids: ids,
    skills: z
      .array(skillEnum)
      .max(13)
      .refine((a) => new Set(a).size === a.length),
    notes: z.string().max(4000),
    markers: z
      .array(
        z.object({
          id: z.uuid(),
          seconds: z.number().int().min(0).max(86400),
          category: z.enum(
            Object.keys(vodCategories) as [
              keyof typeof vodCategories,
              ...(keyof typeof vodCategories)[],
            ],
          ),
          kind: z.enum(["mistake", "good", "question"]),
          note: z.string().trim().min(1).max(1000),
          skills: z.array(skillEnum).max(13),
        }),
      )
      .max(80),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
  })
  .superRefine((r, c) => {
    if (r.video_url && !r.video_authorized)
      c.addIssue({
        code: "custom",
        message: "Confirme que pode usar este vídeo.",
      });
    if (new Set(r.markers.map((m) => m.id)).size !== r.markers.length)
      c.addIssue({ code: "custom", message: "Marcadores repetidos." });
    if (
      r.duration_seconds &&
      r.markers.some((m) => m.seconds > r.duration_seconds!)
    )
      c.addIssue({
        code: "custom",
        message: "Timestamp além da duração informada.",
      });
  });
export function authorizedVideo(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      [
        "www.youtube.com",
        "youtube.com",
        "youtu.be",
        "www.twitch.tv",
        "twitch.tv",
        "clips.twitch.tv",
      ].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
export function validateVod(
  row: VodReview,
  exercises: Exercise[],
  tournaments: { id: string }[],
) {
  vodSchema.parse(row);
  if (new TextEncoder().encode(JSON.stringify(row.markers)).byteLength > 90000)
    throw new Error(
      "Clutchfolio: a revisão ultrapassa o limite de dados dos marcadores.",
    );
  if (
    row.exercise_ids.some(
      (id) => !exercises.some((e) => e.id === id && e.published),
    ) ||
    (row.tournament_id && !tournaments.some((t) => t.id === row.tournament_id))
  )
    throw new Error("Clutchfolio: vínculo indisponível.");
}
export function validateGoal(g: Goal, exercises: Exercise[]) {
  z.object({
    title: z.string().trim().min(1).max(100),
    status: z.enum(["active", "paused", "completed", "archived"]).optional(),
    criteria: z.string().max(500).optional(),
    skill: skillEnum.nullable().optional(),
    exercise_ids: ids.optional(),
    due_date: date.nullable().optional(),
    target: z.number().int().min(1).max(1000),
  }).parse(g);
  if (g.measurement) {
    const m = g.measurement,
      e = exercises.find((e) => e.id === m.exercise_id && e.published),
      protocol = e?.measurement;
    if (
      !protocol ||
      m.unit !== protocol.unit ||
      m.version !== protocol.version ||
      !m.configuration.trim() ||
      m.configuration.length > 200 ||
      [m.baseline, m.desired].some(
        (v) => !Number.isFinite(v) || v < protocol.min || v > protocol.max,
      ) ||
      (m.deadline && !date.safeParse(m.deadline).success)
    )
      throw new Error(
        "Clutchfolio: confira o protocolo, os limites e a configuração da meta.",
      );
  }
  if (
    g.exercise_ids?.some(
      (id) => !exercises.some((e) => e.id === id && e.published),
    )
  )
    throw new Error("Clutchfolio: exercício indisponível.");
}
