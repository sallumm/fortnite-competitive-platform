import { z } from "zod";
export const sourceSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    url: z
      .string()
      .max(1500)
      .refine((v) => {
        try {
          const u = new URL(v);
          return (
            u.protocol === "https:" &&
            !u.username &&
            !u.password &&
            !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname)
          );
        } catch {
          return false;
        }
      }),
    kind: z.enum([
      "official",
      "professional",
      "analysis",
      "editorial",
      "administrator",
    ]),
    published_on: z.iso.date().nullable(),
  })
  .strict();
export const documentSchema = z
  .object({
    subject: z.string().regex(/^[a-z0-9][a-z0-9-]{1,99}$/),
    title: z.string().trim().min(3).max(200),
    category: z.string().trim().min(3).max(100),
    body: z.string().trim().min(20).max(3000),
    aliases: z.array(z.string().trim().min(2).max(100)).max(20),
    mode: z.enum(["build", "zero", "both"]),
    scope: z.enum(["concept", "season"]),
    season: z.string().trim().max(100),
    version: z.string().trim().max(100),
    region: z.string().trim().max(100),
    evidence: z.enum([
      "official",
      "professional",
      "analysis",
      "editorial",
      "administrator",
      "unconfirmed",
    ]),
    verified_at: z.iso.datetime({ offset: true }),
    valid_until: z.iso.datetime({ offset: true }),
    sources: z.array(sourceSchema).max(8),
    limitations: z.string().trim().min(3).max(1000),
    related: z
      .array(
        z
          .object({
            title: z.string().min(3).max(100),
            path: z
              .string()
              .regex(/^\/(academy|library|competitive)(\/[^\s?#]*)?$/),
          })
          .strict(),
      )
      .max(8),
  })
  .strict()
  .superRefine((d, c) => {
    if (d.scope === "season" && !d.season)
      c.addIssue({ code: "custom", message: "Informe a temporada aplicável." });
    if (d.scope === "concept" && (d.season || d.version))
      c.addIssue({
        code: "custom",
        message: "Conceitos permanentes não podem ter uma temporada implícita.",
      });
    if (Date.parse(d.valid_until) <= Date.parse(d.verified_at))
      c.addIssue({
        code: "custom",
        message: "Validade posterior à verificação.",
      });
    if (Date.parse(d.verified_at) > Date.now() + 1000)
      c.addIssue({ code: "custom", message: "Verificação futura." });
    if (
      d.evidence === "official" &&
      !d.sources.some(
        (s) =>
          s.kind === "official" &&
          [
            "fortnite.com",
            "www.fortnite.com",
            "epicgames.com",
            "www.epicgames.com",
            "dev.epicgames.com",
            "communities.epicgames.com",
          ].includes(new URL(s.url).hostname),
      )
    )
      c.addIssue({
        code: "custom",
        message: "Informação oficial exige uma fonte da Epic Games.",
      });
  });
export type KnowledgeDocument = z.infer<typeof documentSchema>;
export type KnowledgeRow = {
  id: string;
  revision: number;
  payload: KnowledgeDocument;
  origin: string;
};
export const askSchema = z
  .object({
    message: z.string().trim().min(2).max(1500),
    mode: z.enum(["build", "zero", "both"]).default("both"),
    season: z.string().max(100).default(""),
    version: z.string().max(100).default(""),
    region: z.string().max(100).default(""),
    external: z.boolean().default(false),
    consent: z.literal("knowledge-v1").optional(),
    diagnostics: z.boolean().default(false),
    preview: z.boolean().default(false),
  })
  .strict();
export type KnowledgeQuery = z.infer<typeof askSchema>;
export const normalize = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const stop = new Set([
  "que",
  "como",
  "qual",
  "quais",
  "para",
  "uma",
  "por",
  "dos",
  "das",
  "com",
  "sobre",
  "atual",
  "funciona",
  "significa",
  "isso",
  "fortnite",
]);
export const tokens = (v: string) =>
  [...new Set(normalize(v).match(/[a-z0-9-]{3,}/g) || [])]
    .filter((x) => !stop.has(x))
    .slice(0, 40);
export function isCurrentQuestion(s: string) {
  return /atua[il]|temporada|season|patch|hoje|agora|fncs|cash cup|regulamento|premia|classific|loot|nerf|buff|hor[aá]rio|eleg[ií]vel/i.test(
    s,
  );
}
export function scopeOf(message: string, rows: KnowledgeRow[] = []) {
  const t = normalize(message);
  if (
    /senha|credencial|token|api key|outra conta|dados privados|ignore.*instruc|system prompt|diagnost|remedio|hack|cheat/.test(
      t,
    )
  )
    return "blocked";
  if (
    /fortnite|aim|mira|build|edicao|piece|fight|rotacao|zona|endgame|surge|tarpar|tarp|refresh|deadside|igl|scrim|ranked|fncs|cash cup|\bmeta\b|loot|nerf|buff|shotgun|freebuild|retake|zone wars|controle|mapa|torneio|campeonato|treino|peek|vod|tracking|moviment|posicion|tempestade/.test(
      t,
    ) ||
    rows.some(
      (r) =>
        r &&
        r.payload &&
        typeof r.payload.title === "string" &&
        Array.isArray(r.payload.aliases) &&
        [r.payload.title, ...r.payload.aliases]
          .filter((a) => typeof a === "string")
          .some((a) => t.includes(normalize(a))),
    )
  )
    return "fortnite";
  return "outside";
}
export function retrieveKnowledge(
  q: KnowledgeQuery,
  rows: KnowledgeRow[],
  now = new Date(),
  preview = false,
) {
  const ts = tokens(q.message),
    current = isCurrentQuestion(q.message);
  return rows
    .flatMap((r) => {
      const p = documentSchema.safeParse(r?.payload);
      if (!p.success) return [];
      const d = p.data;
      if (d.mode !== "both" && q.mode !== "both" && d.mode !== q.mode)
        return [];
      if (
        d.scope === "season" &&
        (!q.season ||
          d.season !== q.season ||
          (d.version && d.version !== q.version) ||
          (d.region && d.region !== q.region))
      )
        return [];
      if (current && d.scope !== "season") return [];
      if (
        Date.parse(d.verified_at) > now.getTime() ||
        Date.parse(d.valid_until) < now.getTime()
      )
        return [];
      if (d.evidence === "unconfirmed" && !preview) return [];
      const names = normalize([d.subject, d.title, ...d.aliases].join(" "));
      const body = normalize(d.body);
      const score = ts.reduce(
        (n, t) => n + (names.includes(t) ? 4 : body.includes(t) ? 1 : 0),
        0,
      );
      return score ? [{ ...r, payload: d, score }] : [];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.revision - a.revision ||
        a.id.localeCompare(b.id),
    )
    .filter(
      (row, _index, ranked) =>
        row.score >= Math.max(2, (ranked[0]?.score || 0) * 0.35),
    )
    .slice(0, 4);
}
export type KnowledgeAnswer = {
  mode: "knowledge-base" | "generative";
  summary: string;
  sections: { title: string; text: string }[];
  references: {
    id: string;
    title: string;
    url: string;
    verified_at: string;
    revision: number;
    evidence: string;
  }[];
  related: { title: string; path: string }[];
  notice: string;
  missing: boolean;
  conflict: boolean;
  provider?: string;
};
export function answerKnowledge(
  q: KnowledgeQuery,
  rows: KnowledgeRow[],
  now = new Date(),
  preview = false,
): KnowledgeAnswer {
  const a: KnowledgeAnswer = {
    mode: "knowledge-base",
    summary: "",
    sections: [],
    references: [],
    related: [],
    notice: "Resposta baseada em recuperação de conteúdo; não é IA generativa.",
    missing: false,
    conflict: false,
  };
  const scope = scopeOf(q.message, rows);
  if (scope !== "fortnite") {
    a.summary =
      scope === "blocked"
        ? "Não solicito credenciais, não consulto dados privados e não executo instruções administrativas."
        : "Sou especializado em Fortnite e preparação competitiva. Faça uma pergunta relacionada ao jogo.";
    return a;
  }
  const found = retrieveKnowledge(q, rows, now, preview);
  if (!found.length) {
    a.missing = true;
    a.summary = isCurrentQuestion(q.message)
      ? "Não disponho de informação atual verificada suficiente para esse formato e contexto. Informe temporada, versão e região quando aplicáveis e consulte o regulamento oficial."
      : "Não encontrei uma explicação revisada suficiente. Tente especificar o conceito ou consulte a Academy.";
    return a;
  }
  const subjects = new Map<string, string>();
  for (const r of found) {
    const d = r.payload,
      key = d.subject + "|" + d.mode + "|" + d.season + "|" + d.version;
    const previous = subjects.get(key);
    if (previous && previous !== d.body) a.conflict = true;
    subjects.set(key, d.body);
  }
  if (a.conflict) {
    a.summary =
      "Há explicações conflitantes na base. É necessária revisão editorial antes de responder com segurança.";
    a.missing = true;
  } else {
    a.summary = found[0].payload.title;
    a.sections = found.map((r) => ({
      title:
        r.payload.title + ` · revisão ${r.revision} · ${r.payload.evidence}`,
      text:
        r.payload.body +
        "\nLimitações: " +
        r.payload.limitations +
        (r.payload.scope === "season"
          ? `\nContexto: ${r.payload.season} / ${r.payload.version || "versão não especificada"} / ${r.payload.region || "região não especificada"}`
          : ""),
    }));
  }
  for (const r of found) {
    for (const s of r.payload.sources)
      a.references.push({
        id: r.id + ":" + s.url,
        title: s.title,
        url: s.url,
        verified_at: r.payload.verified_at,
        revision: r.revision,
        evidence: r.payload.evidence,
      });
    a.related.push(...r.payload.related);
  }
  a.related = a.related.filter(
    (v, i, arr) => arr.findIndex((x) => x.path === v.path) === i,
  );
  return a;
}
/** Editorial parsing only. Untrusted prose remains data and never changes instructions. */
export function teachingProposal(text: string): KnowledgeDocument {
  const input = text.trim().slice(0, 3000),
    title = input.split(/[\n.!?]/)[0].slice(0, 160) || "Novo conhecimento";
  const seasonal =
    /temporada|season|patch|loot|removid|adicionad|balanceamento/i.test(input);
  const now = new Date();
  return {
    subject:
      normalize(title)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 90) || "novo-conhecimento",
    title,
    category: "conhecimento-fortnite",
    body: input,
    aliases: tokens(title),
    mode: "both",
    scope: seasonal ? "season" : "concept",
    season: "",
    version: "",
    region: "",
    evidence: "administrator",
    verified_at: now.toISOString(),
    valid_until: new Date(now.getTime() + 30 * 86400000).toISOString(),
    sources: [],
    limitations:
      "Informação fornecida pelo administrador; revisar fontes, contexto e ambiguidades antes da publicação.",
    related: [],
  };
}
