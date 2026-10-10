import { z } from "zod";
export const metaKey = z.string().regex(/^[a-z0-9][a-z0-9-]{1,99}$/);
const text = z.string().trim().min(3).max(3000);
const instant = z.iso.datetime({ offset: true });
export const metaSourceSchema = z
  .object({
    id: metaKey,
    title: text,
    url: z.url().startsWith("https://"),
    kind: z.enum(["official", "professional", "analysis", "editorial"]),
    access: z.enum([
      "page",
      "listing",
      "metadata",
      "transcript",
      "audiovisual",
      "unavailable",
    ]),
    published_on: z.iso.date().nullable(),
    verified_at: instant,
    limitations: text,
  })
  .strict();
export const metaEntrySchema = z
  .object({
    id: metaKey,
    subject_key: metaKey,
    context_id: metaKey,
    revision: z.number().int().min(1).max(10000),
    previous_id: metaKey.nullable(),
    kind: z.enum(["item", "location", "mechanic", "strategy", "analysis"]),
    title: text,
    category: metaKey,
    body: text,
    state: z.enum([
      "confirmed",
      "under_analysis",
      "unconfirmed",
      "stale",
      "archived",
    ]),
    availability: z.enum(["available", "vaulted", "announced", "unknown"]),
    evidence: z.enum([
      "official",
      "professional",
      "analysis",
      "editorial",
      "hypothesis",
    ]),
    source_ids: z
      .array(metaKey)
      .min(1)
      .max(12)
      .refine((a) => new Set(a).size === a.length, "Fontes duplicadas"),
    verified_at: instant,
    valid_from: instant,
    review_due: instant,
    limitations: text,
    change_note: text,
  })
  .strict()
  .superRefine((e, ctx) => {
    if (Date.parse(e.review_due) <= Date.parse(e.verified_at))
      ctx.addIssue({
        code: "custom",
        message: "Revisão deve ser posterior à verificação",
      });
    if ((e.revision === 1) !== (e.previous_id === null))
      ctx.addIssue({
        code: "custom",
        message: "Revisão exige edição anterior",
      });
    if (e.state === "confirmed" && e.evidence !== "official")
      ctx.addIssue({
        code: "custom",
        message: "Confirmação factual exige informação oficial",
      });
    if (
      e.state === "unconfirmed" &&
      e.availability !== "unknown" &&
      e.availability !== "announced"
    )
      ctx.addIssue({
        code: "custom",
        message: "Disponibilidade não comprovada",
      });
  });
export type MetaEntry = z.infer<typeof metaEntrySchema>;
export type MetaSource = z.infer<typeof metaSourceSchema>;
export type MetaContext = {
  id: string;
  version_id: string;
  mode_id: string;
  format_id: string;
  play_context: "casual" | "ranked" | "tournament";
  region: string;
  event_key: string | null;
};
export type MetaLink = {
  id: string;
  entry_id: string;
  target_kind: "competency" | "exercise" | "article" | "tournament";
  target_id: string;
  reason: string;
};
export type MetaCatalog = {
  investigated_at: string;
  versions: {
    id: string;
    season: string;
    patch: string;
    released_on: string | null;
  }[];
  modes: { id: string; title: string; construction: boolean }[];
  formats: { id: string; title: string; size: number | null }[];
  contexts: MetaContext[];
  sources: MetaSource[];
  entries: MetaEntry[];
  links: MetaLink[];
};
export const metaStates: Record<MetaEntry["state"], string> = {
  confirmed: "Confirmado",
  under_analysis: "Em análise",
  unconfirmed: "Não confirmado",
  stale: "Desatualizado",
  archived: "Arquivado",
};
export const metaKinds: Record<MetaEntry["kind"], string> = {
  item: "Itens",
  location: "Mapa e drops",
  mechanic: "Mecânicas",
  strategy: "Formatos e estratégias",
  analysis: "Análises",
};
export function metaStatus(
  entry: MetaEntry,
  entryVersion: string,
  requestedVersion: string,
  now = new Date(),
): MetaEntry["state"] {
  if (entry.state === "archived") return "archived";
  if (
    entryVersion !== requestedVersion ||
    Date.parse(entry.review_due) <= now.getTime()
  )
    return "stale";
  if (
    Date.parse(entry.valid_from) > now.getTime() ||
    Date.parse(entry.verified_at) > now.getTime()
  )
    return "unconfirmed";
  return entry.state;
}
export function latestMeta(entries: MetaEntry[], now = new Date()) {
  const latest = new Map<string, MetaEntry>();
  for (const e of entries)
    if (Date.parse(e.valid_from) <= now.getTime()) {
      const key = `${e.context_id}:${e.subject_key}`,
        prev = latest.get(key);
      if (!prev || prev.revision < e.revision) latest.set(key, e);
    }
  return [...latest.values()];
}
export function metaWriteIssues(
  e: MetaEntry,
  c: MetaCatalog,
  now = new Date(),
): string[] {
  const errors: string[] = [];
  if (!c.contexts.some((x) => x.id === e.context_id))
    errors.push("Contexto inexistente");
  const previous = c.entries
    .filter(
      (x) => x.context_id === e.context_id && x.subject_key === e.subject_key,
    )
    .sort((a, b) => b.revision - a.revision)[0];
  if (
    e.revision !== (previous?.revision || 0) + 1 ||
    e.previous_id !== (previous?.id || null)
  )
    errors.push("Histórico mudou; recarregue antes de salvar");
  if (previous && Date.parse(e.valid_from) < Date.parse(previous.valid_from))
    errors.push("A validade da revisão não pode retroceder");
  const sources = e.source_ids.map((id) => c.sources.find((s) => s.id === id));
  if (sources.some((s) => !s || ["metadata", "unavailable"].includes(s.access)))
    errors.push(
      "Fonte ausente ou acesso insuficiente para fundamentar conteúdo",
    );
  if (e.state === "confirmed" && !sources.some((s) => s?.kind === "official"))
    errors.push("Falta fonte oficial");
  if (Date.parse(e.verified_at) > now.getTime())
    errors.push("Verificação futura");
  return errors;
}
export function compareMeta(
  c: MetaCatalog,
  from: string,
  to: string,
  now = new Date(),
) {
  const latest = latestMeta(c.entries, now);
  const rows = (id: string) => latest.filter((e) => e.context_id === id);
  const a = rows(from),
    b = rows(to);
  return [...new Set([...a, ...b].map((e) => e.subject_key))].map((key) => ({
    key,
    before: a.find((e) => e.subject_key === key),
    after: b.find((e) => e.subject_key === key),
  }));
}
// Public editorial material is reference data, never instructions. Exact context only: no implicit mode/region/event fallback.
export function retrieveMeta(
  c: MetaCatalog,
  query: string,
  contextId: string,
  now = new Date(),
  limit = 4,
) {
  const context = c.contexts.find((x) => x.id === contextId);
  if (!context) return [];
  const terms = query
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .slice(0, 300)
    .split(/\s+/)
    .filter(Boolean);
  return latestMeta(c.entries, now)
    .filter(
      (e) =>
        e.context_id === contextId &&
        metaStatus(e, context.version_id, context.version_id, now) ===
          "confirmed" &&
        e.source_ids.every((id) =>
          c.sources.some(
            (s) =>
              s.id === id && !["metadata", "unavailable"].includes(s.access),
          ),
        ) &&
        terms.every((t) =>
          `${e.title} ${e.body}`
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase()
            .includes(t),
        ),
    )
    .slice(0, Math.max(0, Math.min(4, limit)))
    .map((e) => ({
      id: e.id,
      title: e.title,
      body: e.body.slice(0, 1500),
      availability: e.availability,
      context,
      sources: c.sources.filter((s) => e.source_ids.includes(s.id)),
      limitations: e.limitations,
      trust: "reference-data-only" as const,
    }));
}

export function relatedMetaLinks(c: MetaCatalog, entry: MetaEntry): MetaLink[] {
  let current: MetaEntry | undefined = entry;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    const own = c.links.filter((l) => l.entry_id === current!.id);
    if (own.length) return own;
    current = c.entries.find((e) => e.id === current!.previous_id);
  }
  return [];
}
