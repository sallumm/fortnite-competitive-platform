import { z } from "zod";
import {
  latestMeta,
  metaStatus,
  relatedMetaLinks,
  type MetaCatalog,
  type MetaEntry,
} from "../meta";
import type { Exercise, Plan } from "../types";
export const selectionSchema = z
  .object({
    context_id: z.string().regex(/^[a-z0-9-]{2,100}$/),
    entry_ids: z
      .array(z.string().regex(/^[a-z0-9-]{2,100}$/))
      .max(12)
      .refine((a) => new Set(a).size === a.length),
  })
  .strict();
export type MetaSelection = z.infer<typeof selectionSchema>;
export interface GameContext {
  context_id: string;
  version_id: string;
  mode_id: string;
  format_id: string;
  play_context: string;
  region: string;
  season: string;
  patch: string;
  entries: {
    id: string;
    subject_key: string;
    revision: number;
    verified_at: string;
    review_due: string;
    source_ids: string[];
  }[];
}
export function currentEntries(
  c: MetaCatalog,
  contextId: string,
  now = new Date(),
) {
  const context = c.contexts.find((x) => x.id === contextId);
  if (!context) return [];
  return latestMeta(c.entries, now).filter(
    (e) =>
      e.context_id === contextId &&
      metaStatus(e, context.version_id, context.version_id, now) ===
        "confirmed" &&
      e.source_ids.every((id) =>
        c.sources.some(
          (s) =>
            s.id === id &&
            !["unavailable", "metadata"].includes(s.access) &&
            Date.parse(s.verified_at) <= now.getTime(),
        ),
      ),
  );
}
export function contextSnapshot(
  c: MetaCatalog,
  input: MetaSelection,
  now = new Date(),
): GameContext {
  const selection = selectionSchema.parse(input);
  const context = c.contexts.find((x) => x.id === selection.context_id),
    version = c.versions.find((v) => v.id === context?.version_id);
  if (!context || !version)
    throw new Error("kyrven: Contexto editorial indisponível.");
  const current = currentEntries(c, context.id, now);
  const entries = selection.entry_ids.map((id) =>
    current.find((e) => e.id === id),
  );
  if (entries.some((e) => !e))
    throw new Error(
      "kyrven: A revisão do meta mudou ou precisa de verificação. Refaça a prévia.",
    );
  return {
    context_id: context.id,
    version_id: context.version_id,
    mode_id: context.mode_id,
    format_id: context.format_id,
    play_context: context.play_context,
    region: context.region,
    season: version.season,
    patch: version.patch,
    entries: entries.map((e) => ({
      id: e!.id,
      subject_key: e!.subject_key,
      revision: e!.revision,
      verified_at: e!.verified_at,
      review_due: e!.review_due,
      source_ids: e!.source_ids,
    })),
  };
}
export function contextLabel(g?: GameContext | null) {
  return g
    ? `${g.season} · v${g.patch} · ${{ "br-build": "Battle Royale · Construção", "br-zero": "Battle Royale · Zero Build", "reload-build": "Reload · Construção", "reload-zero": "Reload · Zero Build", blitz: "Blitz Royale" }[g.mode_id] || g.mode_id} · ${{ solo: "Solo", duo: "Duplas", trio: "Trios", squad: "Esquadrões", unspecified: "Formato não especificado" }[g.format_id] || g.format_id} · ${{ casual: "Casual", ranked: "Ranked", tournament: "Torneio" }[g.play_context] || g.play_context}`
    : "Contexto do jogo não registrado";
}
export function comparisonContext(g?: GameContext | null) {
  // Different editorial revision is not necessarily a new game version. Do not infer causation.
  return g
    ? [g.version_id, g.mode_id, g.format_id, g.play_context, g.region].join(":")
    : "legacy-context";
}
export function contextAlerts(
  c: MetaCatalog,
  g: GameContext,
  now = new Date(),
) {
  const current = currentEntries(c, g.context_id, now);
  return g.entries.flatMap((e) =>
    current.some((x) => x.id === e.id)
      ? []
      : [
          `${c.entries.find((x) => x.id === e.id)?.title || e.subject_key}: há revisão posterior, retirada ou verificação vencida. Revise as próximas atividades; o histórico foi preservado.`,
        ],
  );
}
export function exerciseRelations(
  c: MetaCatalog,
  e: Exercise,
  contextId: string,
  now = new Date(),
) {
  return currentEntries(c, contextId, now).flatMap((entry) => {
    const links = relatedMetaLinks(c, entry).filter(
      (l) =>
        (l.target_kind === "exercise" && l.target_id === e.id) ||
        (l.target_kind === "competency" &&
          e.research?.competency_ids.includes(l.target_id)),
    );
    // Vaulted resources support study/review, not active practice using an unavailable item.
    if (entry.availability === "vaulted" && e.research?.purpose !== "review")
      return [];
    return links.map((link) => ({
      entry,
      reason: link.reason,
      inherited: link.entry_id !== entry.id,
    }));
  });
}
export function attachContext(
  plan: Plan,
  c: MetaCatalog,
  input: MetaSelection,
  now = new Date(),
): Plan {
  const game_context = contextSnapshot(c, input, now);
  const mode = c.modes.find((m) => m.id === game_context.mode_id);
  if (
    plan.mode &&
    plan.mode !== "both" &&
    plan.mode !== (mode?.construction ? "build" : "zero")
  )
    throw new Error(
      "kyrven: Modalidade incompatível com o contexto selecionado.",
    );
  return {
    ...plan,
    meta_context_id: input.context_id,
    meta_entry_ids: input.entry_ids,
    game_context,
  };
}
export function metaAnswerData(
  c: MetaCatalog,
  query: string,
  contextId: string,
  now = new Date(),
) {
  if (historicalContext(c, contextId, now)) return [];
  const terms = query
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/\W+/)
    .filter(
      (t) =>
        t.length >= 4 &&
        ![
          "quais",
          "sobre",
          "atual",
          "mudou",
          "temporada",
          "mecanica",
          "mostre",
          "treino",
        ].includes(t),
    );
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  return currentEntries(c, contextId, now)
    .map((entry) => ({
      entry,
      score: terms.filter((t) =>
        norm(entry.title + " " + entry.body).includes(t),
      ).length,
    }))
    .filter((x) => !terms.length || x.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, 4)
    .map(({ entry }) => ({
      id: entry.id,
      title: entry.title,
      body: entry.body,
      limitations: entry.limitations,
      sources: c.sources.filter((s) => entry.source_ids.includes(s.id)),
    }));
}
export type ContextualEntry = MetaEntry;

export function historicalContext(
  c: MetaCatalog,
  id: string,
  now = new Date(),
) {
  const context = c.contexts.find((x) => x.id === id);
  const version = c.versions.find((v) => v.id === context?.version_id);
  if (!context || !version?.released_on) return false;
  return c.contexts.some(
    (x) =>
      x.mode_id === context.mode_id &&
      c.versions.some(
        (v) =>
          v.id === x.version_id &&
          v.released_on &&
          v.released_on > version.released_on! &&
          Date.parse(v.released_on) <= now.getTime(),
      ),
  );
}

export function practiceLabel(format?: string | null) {
  return (
    (
      {
        solo: "Solo",
        duo: "Duplas",
        trio: "Trios",
        squad: "Esquadrões",
        unspecified: "Não especificado",
      } as Record<string, string>
    )[format || ""] || "Formato de prática não registrado"
  );
}
