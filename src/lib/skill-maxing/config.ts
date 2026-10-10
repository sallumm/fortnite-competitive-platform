import { z } from "zod";
import index from "../../data/training-knowledge-index.json";
import type { Profile } from "../types";
export const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const timeMinutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const minutesTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export const windowSchema = z
  .object({
    id: z.string().uuid(),
    weekday: z.number().int().min(0).max(6),
    start: timeSchema,
    end: timeSchema,
    minutes: z.number().int().min(1).max(120),
  })
  .strict()
  .refine(
    (w) =>
      timeMinutes(w.end) > timeMinutes(w.start) &&
      w.minutes <= timeMinutes(w.end) - timeMinutes(w.start),
    "A duração precisa caber em um intervalo do mesmo dia.",
  );
export const blockedSchema = z
  .object({
    id: z.string().uuid(),
    weekday: z.number().int().min(0).max(6),
    start: timeSchema,
    end: timeSchema,
  })
  .strict()
  .refine((w) => w.end > w.start, "Confira o intervalo do compromisso.");
export const evolutionConfigSchema = z
  .object({
    mode: z.enum(["build", "zero"]),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    input: z.enum(["kbm", "controller"]),
    timezone: z
      .string()
      .max(100)
      .refine((t) => {
        try {
          new Intl.DateTimeFormat("pt-BR", { timeZone: t });
          return true;
        } catch {
          return false;
        }
      }, "Fuso inválido."),
    objective: z
      .string()
      .trim()
      .min(3, "Descreva seu objetivo em pelo menos três caracteres.")
      .max(200),
    skills: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]{1,60}$/),
            weight: z.number().int().min(1).max(5),
          })
          .strict(),
      )
      .min(1, "Escolha pelo menos uma competência.")
      .max(12),
    difficulties: z.string().max(500),
    windows: z
      .array(windowSchema)
      .min(1, "Informe pelo menos uma janela de disponibilidade.")
      .max(42),
    blocked: z.array(blockedSchema).max(42),
    opposition: z.enum(["solo", "friends", "opponents", "mixed"]),
    competitive: z.boolean(),
    baseline: z.boolean(),
    style: z.enum(["short", "habitual", "review"]),
    tournament_id: z.string().uuid().nullable(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (new Set(c.skills.map((s) => s.id)).size !== c.skills.length)
      ctx.addIssue({
        code: "custom",
        path: ["skills"],
        message: "Escolha cada competência uma vez.",
      });
    for (const s of c.skills) {
      const k = index.competencies.find((k) => k.id === s.id);
      if (!k || (k.mode !== "both" && k.mode !== c.mode))
        ctx.addIssue({
          code: "custom",
          path: ["skills"],
          message: "Competência incompatível com a modalidade.",
        });
    }
    if (
      new Set([...c.windows, ...c.blocked].map((w) => w.id)).size !==
      c.windows.length + c.blocked.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["windows"],
        message: "Intervalos precisam de identidades diferentes.",
      });
    for (const a of c.windows)
      for (const b of c.windows)
        if (
          a.id < b.id &&
          a.weekday === b.weekday &&
          a.start < b.end &&
          b.start < a.end
        )
          ctx.addIssue({
            code: "custom",
            path: ["windows"],
            message: "Intervalos de disponibilidade sobrepostos.",
          });
  });
export type EvolutionConfig = z.infer<typeof evolutionConfigSchema>;
export const weekdays = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
export function defaultEvolutionConfig(p: Profile): EvolutionConfig {
  return {
    mode: p.mode,
    level: p.level,
    input: p.input,
    timezone: p.timezone,
    objective: "Praticar uma habilidade e observar decisões",
    skills: [{ id: p.mode === "zero" ? "zero-aim" : "shotgun", weight: 3 }],
    difficulties: "",
    windows: [],
    blocked: [],
    opposition: "mixed",
    competitive: false,
    baseline: false,
    style: "habitual",
    tournament_id: null,
  };
}
