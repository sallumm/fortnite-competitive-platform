import { z } from "zod";
const https = z
  .string()
  .url()
  .refine((x) => x.startsWith("https://"), "Use uma URL HTTPS.");
const timestamp = z
  .string()
  .refine((x) => !Number.isNaN(Date.parse(x)), "Data inválida.");
const id = z.string().uuid();
const title = z.string().trim().min(3).max(160);
const mode = z.enum(["build", "zero", "both"]);
const category = z.enum([
  "aim",
  "mechanics",
  "piece",
  "competitive",
  "decisions",
  "vod",
  "wellbeing",
]);
const base = {
  id,
  source_url: https,
  verified_at: timestamp,
  published: z.boolean(),
};
export const exerciseSchema = z.object({
  ...base,
  title,
  creator: z.string().min(2).max(80),
  map_code: z
    .string()
    .regex(/^\d{4}-\d{4}-\d{4}$/)
    .nullable(),
  category,
  mode,
  level: z.enum(["beginner", "intermediate", "advanced"]),
  description: z.string().min(10).max(500),
  instructions: z.string().min(20).max(10000),
  metric: z.string().min(3).max(200),
});
export const articleSchema = z.object({
  ...base,
  title,
  slug: z.string().regex(/^[a-z0-9-]{3,100}$/),
  kind: z.enum(["news", "analysis", "lesson"]),
  category: z.enum([...category.options, "fncs"]),
  summary: z.string().min(10).max(500),
  body: z.string().min(30).max(30000),
  author: z.string().min(2).max(80),
  published_at: timestamp,
  valid_until: timestamp.nullable(),
});
export const tournamentSchema = z
  .object({
    ...base,
    title,
    slug: z.string().regex(/^[a-z0-9-]{3,100}$/),
    category: z.string().min(2).max(60),
    mode,
    region: z.string().min(2).max(10),
    format: z.string().min(2).max(30),
    start_date: z.iso.date(),
    end_date: z.iso.date(),
    starts_at: timestamp.nullable(),
    ends_at: timestamp.nullable(),
    status: z.enum(["scheduled", "finished", "postponed", "cancelled"]),
    description: z.string().min(10).max(10000),
    rules: z.string().min(10).max(10000),
    prize: z.string().min(2).max(200),
    valid_until: timestamp,
  })
  .refine((x) => x.end_date >= x.start_date, "Fim anterior ao início.")
  .refine(
    (x) => (x.starts_at === null) === (x.ends_at === null),
    "Preencha ambos os horários ou nenhum.",
  )
  .refine(
    (x) =>
      !x.starts_at || !x.ends_at || new Date(x.ends_at) > new Date(x.starts_at),
    "Horário final precisa vir após o inicial.",
  );
