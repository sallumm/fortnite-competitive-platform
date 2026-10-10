import { z } from "zod";
import { metaKey, metaEntrySchema, type MetaEntry } from "./meta";
export const safeHttps = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !/^(localhost|127\.|0\.|\[|10\.|192\.168\.|169\.254\.)/.test(u.hostname)
      );
    } catch {
      return false;
    }
  }, "Use uma URL HTTPS pública, sem credenciais");
const short = z.string().trim().min(3).max(300);
export function youtubeId(value: string): string | null {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const h = u.hostname;
    let id: string | null = null;
    if (h === "youtu.be") id = u.pathname.slice(1);
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(h)) {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (/^\/(embed|shorts)\//.test(u.pathname))
        id = u.pathname.split("/")[2];
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export const videoSchema = z
  .object({
    title: short,
    creator: short,
    url: safeHttps,
    description: z.string().trim().min(3).max(1000),
    source_url: safeHttps,
    authorization: z.string().trim().min(10).max(1000),
    embed_allowed: z.boolean(),
    tags: z.array(short).max(12),
    timestamps: z
      .array(
        z
          .object({ seconds: z.number().int().min(0).max(86400), label: short })
          .strict(),
      )
      .max(30),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.embed_allowed && !youtubeId(v.url))
      c.addIssue({
        code: "custom",
        message: "Incorporação permitida somente para URL válida do YouTube",
      });
  });
export const editorialSchema = z
  .object({
    subject_key: metaKey,
    context_id: metaKey,
    kind: metaEntrySchema.shape.kind,
    display_kind: z.enum([
      "item",
      "location",
      "mechanic",
      "strategy",
      "analysis",
      "article",
      "video",
      "drop",
    ]),
    title: short,
    slug: metaKey,
    summary: z.string().trim().min(3).max(500),
    body: z.string().trim().min(3).max(3000),
    category: metaKey,
    tags: z.array(short).max(20),
    state: metaEntrySchema.shape.state,
    availability: metaEntrySchema.shape.availability,
    evidence: metaEntrySchema.shape.evidence,
    source_ids: metaEntrySchema.shape.source_ids,
    verified_at: metaEntrySchema.shape.verified_at,
    review_due: metaEntrySchema.shape.review_due,
    limitations: metaEntrySchema.shape.limitations,
    change_note: metaEntrySchema.shape.change_note,
    author: short,
    objective: z.string().max(1000),
    level: z.enum(["all", "beginner", "intermediate", "advanced"]),
    prerequisites: z.string().max(1000),
    blocks: z
      .array(
        z
          .object({ heading: short, text: z.string().trim().min(3).max(3000) })
          .strict(),
      )
      .max(30),
    characteristics: z
      .array(
        z
          .object({ name: short, value: z.string().trim().min(1).max(500) })
          .strict(),
      )
      .max(30),
    media_ids: z.array(z.uuid()).max(12),
    videos: z.array(videoSchema).max(12),
    links: z
      .array(
        z
          .object({
            target_kind: z.enum([
              "exercise",
              "article",
              "competency",
              "tournament",
            ]),
            target_id: z.string().min(2).max(100),
            reason: z.string().trim().min(3).max(1000),
          })
          .strict(),
      )
      .max(30),
  })
  .strict()
  .superRefine((e, c) => {
    if (Date.parse(e.review_due) <= Date.parse(e.verified_at))
      c.addIssue({
        code: "custom",
        message: "Revisão deve ser posterior à verificação",
      });
    if (e.state === "confirmed" && e.evidence !== "official")
      c.addIssue({
        code: "custom",
        message: "Confirmação exige evidência oficial",
      });
    if (
      e.state === "unconfirmed" &&
      !["unknown", "announced"].includes(e.availability)
    )
      c.addIssue({ code: "custom", message: "Disponibilidade não confirmada" });
    for (const a of [e.tags, e.source_ids, e.media_ids])
      if (new Set(a).size !== a.length)
        c.addIssue({ code: "custom", message: "Valores duplicados" });
    if (
      new Set(e.links.map((l) => l.target_kind + ":" + l.target_id)).size !==
      e.links.length
    )
      c.addIssue({ code: "custom", message: "Relações duplicadas" });
  });
// Private drafts may be incomplete; review/publication still use the complete schema.
export const editorialDraftSchema = z
  .object({
    ...editorialSchema.shape,
    title: z.string().max(300),
    summary: z.string().max(500),
    body: z.string().max(3000),
    author: z.string().max(300),
    limitations: z.string().max(3000),
    change_note: z.string().max(3000),
    source_ids: z
      .array(metaKey)
      .max(12)
      .refine((a) => new Set(a).size === a.length, "Fontes duplicadas"),
    blocks: z
      .array(
        z
          .object({ heading: z.string().max(300), text: z.string().max(3000) })
          .strict(),
      )
      .max(30),
    characteristics: z
      .array(
        z
          .object({ name: z.string().max(300), value: z.string().max(500) })
          .strict(),
      )
      .max(30),
    videos: z
      .array(
        z
          .object({
            ...videoSchema.shape,
            title: z.string().max(300),
            creator: z.string().max(300),
            description: z.string().max(1000),
            authorization: z.string().max(1000),
            url: z.union([z.literal(""), safeHttps]),
            source_url: z.union([z.literal(""), safeHttps]),
            timestamps: z
              .array(
                z
                  .object({
                    seconds: z.number().int().min(0).max(86400),
                    label: z.string().max(300),
                  })
                  .strict(),
              )
              .max(30),
          })
          .strict(),
      )
      .max(12),
    links: z
      .array(
        z
          .object({
            target_kind: z.enum([
              "exercise",
              "article",
              "competency",
              "tournament",
            ]),
            target_id: z.string().max(100),
            reason: z.string().max(1000),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
export type EditorialContent = z.infer<typeof editorialSchema>;
export type MetaVideo = z.infer<typeof videoSchema>;
export type MetaDraft = {
  id: string;
  payload: EditorialContent;
  version: number;
  status: "draft" | "review" | "published" | "archived";
  updated_at: string;
  editor_id: string | null;
  published_entry_id: string | null;
};
export type MetaEdition = {
  entry_id: string;
  content: EditorialContent;
  published_at: string;
};
export type MetaAsset = {
  id: string;
  path: string;
  mime_type: string;
  size_bytes: number;
  alt: string;
  source_url: string;
  rights: string;
  credit: string;
  created_at: string;
};
export function cleanEntryContent(e: MetaEntry): EditorialContent {
  const {
    subject_key,
    context_id,
    kind,
    title,
    body,
    category,
    state,
    availability,
    evidence,
    source_ids,
    verified_at,
    review_due,
    limitations,
    change_note,
  } = e;
  return {
    subject_key,
    context_id,
    kind,
    title,
    body,
    category,
    state,
    availability,
    evidence,
    source_ids,
    verified_at,
    review_due,
    limitations,
    change_note,
    slug: subject_key,
    summary: body.slice(0, 500),
    display_kind: kind,
    tags: [],
    author: "Redação kyrven",
    objective: "",
    level: "all",
    prerequisites: "",
    blocks: [],
    characteristics: [],
    media_ids: [],
    videos: [],
    links: [],
  };
}
export function newContent(context: string): EditorialContent {
  const now = new Date();
  return {
    subject_key: "content-" + crypto.randomUUID(),
    context_id: context,
    kind: "item",
    display_kind: "item",
    title: "",
    slug: "content-" + crypto.randomUUID(),
    summary: "",
    body: "",
    category: "items",
    tags: [],
    state: "unconfirmed",
    availability: "unknown",
    evidence: "editorial",
    source_ids: [],
    verified_at: now.toISOString(),
    review_due: new Date(+now + 7 * 864e5).toISOString(),
    limitations: "Cobertura editorial limitada ao contexto selecionado.",
    change_note: "Primeira publicação editorial.",
    author: "Redação kyrven",
    objective: "",
    level: "all",
    prerequisites: "",
    blocks: [],
    characteristics: [],
    media_ids: [],
    videos: [],
    links: [],
  };
}
export function rasterType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 12 &&
    bytes[0] === 137 &&
    [80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i + 1] === v)
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}
