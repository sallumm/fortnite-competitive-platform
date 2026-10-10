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
const tags = z.array(z.string().trim().min(1).max(40)).max(12);
export const phaseSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9-]{1,60}$/),
    title,
    kind: z.enum(["registration", "qualifier", "session", "final"]),
    date: z.iso.date(),
    starts_at: z.iso.datetime({ offset: true }).nullable(),
    ends_at: z.iso.datetime({ offset: true }).nullable(),
    status: z.enum(["scheduled", "finished", "postponed", "cancelled"]),
    source_url: https,
    verified_at: timestamp,
    valid_until: timestamp,
  })
  .refine(
    (x) =>
      (x.starts_at === null) === (x.ends_at === null) &&
      (!x.starts_at || Date.parse(x.ends_at!) > Date.parse(x.starts_at)),
    "Preencha um intervalo válido com fuso ou deixe ambos vazios.",
  )
  .refine(
    (x) => Date.parse(x.valid_until) >= Date.parse(x.verified_at),
    "Validade anterior à verificação.",
  );
export const exerciseSchema = z.object({
  ...base,
  title,
  skills: tags.optional(),
  competitive_goal: z.string().max(500).optional(),
  map_type: z.string().max(80).optional(),
  requirements: z.string().max(500).optional(),
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
  topic: z
    .enum([
      "competitive",
      "fncs",
      "championships",
      "results",
      "updates",
      "meta",
      "players",
      "organizations",
      "analysis",
      "guides",
    ])
    .optional(),
  tags: tags.optional(),
  evidence: z.enum(["official", "analysis", "opinion"]).optional(),
  source_published_at: timestamp.nullable().optional(),
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
    confirmation: z.enum(["confirmed", "unconfirmed"]).optional(),
    season_label: z.string().max(80).optional(),
    phases: z
      .array(phaseSchema)
      .max(32)
      .refine(
        (xs) => new Set(xs.map((x) => x.key)).size === xs.length,
        "Fases duplicadas.",
      )
      .optional(),
    result_summary: z.string().min(10).max(4000).nullable().optional(),
    result_source_url: https.nullable().optional(),
    result_verified_at: timestamp.nullable().optional(),
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
  .refine(
    (x) =>
      !x.result_summary || (!!x.result_source_url && !!x.result_verified_at),
    "Resultados exigem fonte e verificação.",
  )
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
