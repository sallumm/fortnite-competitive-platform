import { z } from "zod";
const uuid = z.uuid();
const instant = z.iso.datetime({ offset: true });
const activity = z
  .object({
    title: z.string().trim().min(1).max(80),
    starts_at: instant,
    duration_minutes: z.number().int().min(5).max(120),
    kind: z.enum(["training", "personal", "rest"]),
    plan_id: uuid.nullable(),
  })
  .strict()
  .refine(
    (a) => (a.kind === "training") === (a.plan_id !== null),
    "Plano obrigatório somente para treino",
  );
export const actionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("create"),
      items: z.array(activity).min(1).max(14),
    })
    .strict(),
  z
    .object({
      kind: z.literal("series"),
      title: z.string().trim().min(1).max(80),
      activity_kind: z.enum(["training", "personal", "rest"]),
      plan_id: uuid.nullable(),
      timezone: z.string().min(1).max(80),
      local_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      start_date: z.iso.date(),
      end_date: z.iso.date(),
      weekdays: z
        .array(z.number().int().min(0).max(6))
        .min(1)
        .max(7)
        .refine((a) => new Set(a).size === a.length),
      duration_minutes: z.number().int().min(5).max(120),
    })
    .strict()
    .refine((a) => (a.activity_kind === "training") === (a.plan_id !== null)),
  z
    .object({ kind: z.literal("move"), schedule_id: uuid, starts_at: instant })
    .strict(),
  z.object({ kind: z.literal("cancel"), schedule_id: uuid }).strict(),
]);
export type CoachAction = z.infer<typeof actionSchema>;
export const requestSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("ask"),
      message: z.string().trim().min(1).max(2000),
      exercise_id: uuid.optional(),
      conversation_id: uuid.optional(),
    })
    .strict(),
  z.object({ op: z.literal("propose"), payload: actionSchema }).strict(),
  z
    .object({
      op: z.literal("confirm"),
      id: uuid,
      confirmation: z.enum(["CONFIRMAR", "CANCELAR"]),
    })
    .strict(),
]);
export const guidanceSchema = z
  .object({
    guidance: z.string().trim().min(1).max(2400),
    citation_ids: z.array(z.string().max(100)).max(12),
  })
  .strict();
