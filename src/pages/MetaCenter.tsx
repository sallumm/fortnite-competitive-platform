import { KnowledgeAccess } from "../components/KnowledgeAccess";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Empty, Heading } from "../components/ui";
import { useStore } from "../lib/store";
import { loadMeta } from "../lib/meta-service";
import {
  relatedMetaLinks,
  compareMeta,
  latestMeta,
  metaKinds,
  metaStates,
  metaStatus,
  type MetaCatalog,
} from "../lib/meta";
import { useSEO } from "../lib/seo";
import { loadEditorial } from "../lib/meta-editorial-service";
import type { MetaEdition, MetaAsset } from "../lib/meta-editorial";
import { MetaImage } from "../components/MetaContent";
const evidenceNames: Record<string, string> = {
  official: "Informação oficial",
  professional: "Experiência profissional",
  analysis: "Análise",
  editorial: "Recomendação editorial",
  hypothesis: "Hipótese",
};
const accessNames: Record<string, string> = {
  page: "Texto da página",
  listing: "Listagem",
  metadata: "Metadados",
  transcript: "Transcrição",
  audiovisual: "Audiovisual",
  unavailable: "Indisponível",
};
const playNames: Record<string, string> = {
  casual: "Casual",
  ranked: "Ranqueado",
  tournament: "Torneio",
};
const eventNames: Record<string, string> = {
  "solo-victory-cup-c7s4": "Solo Victory Cup C7S4",
  "fncs-2026-duos": "FNCS 2026 Duplas",
  "fncs-solos-2026": "FNCS Solos 2026",
};
const available: Record<string, string> = {
  available: "Disponível na fonte",
  vaulted: "No cofre",
  announced: "Anunciado",
  unknown: "Disponibilidade não confirmada",
};
export default function MetaCenter() {
  const s = useStore();
  const [catalog, setCatalog] = useState<MetaCatalog | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [context, setContext] = useState("br-4230"),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [history, setHistory] = useState(false),
    [compare, setCompare] = useState(""),
    [section, setSection] = useState("all"),
    [sort, setSort] = useState("verified"),
    [dimensions, setDimensions] = useState<Record<string, string>>({}),
    [editions, setEditions] = useState<MetaEdition[]>([]),
    [assets, setAssets] = useState<MetaAsset[]>([]);
  useSEO(
    "Meta Center",
    "Informação de Fortnite com versão, contexto, fontes e relações com treinamento.",
  );
  useEffect(() => {
    let active = true;
    setCatalog(null);
    setError("");
    Promise.all([
      loadMeta(s.demo),
      s.demo ? Promise.resolve({ editions: [], assets: [] }) : loadEditorial(),
    ])
      .then(([c, e]) => {
        if (active) {
          setCatalog(c);
          setEditions(e.editions);
          setAssets(e.assets);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [s.demo, s.session?.user.id, retry]);
  if (error)
    return (
      <Empty title="Meta indisponível">
        <span>{error}</span>
        <button className="button" onClick={() => setRetry((x) => x + 1)}>
          Tentar novamente
        </button>
      </Empty>
    );
  if (!catalog) return <p role="status">Carregando base de meta…</p>;
  const selected = catalog.contexts.find((c) => c.id === context);
  const version = catalog.versions.find((v) => v.id === selected?.version_id);
  const now = new Date();
  const latestVersion = catalog.versions
    .filter(
      (v) =>
        catalog.contexts.some(
          (ctx) => ctx.mode_id === selected?.mode_id && ctx.version_id === v.id,
        ) &&
        v.released_on &&
        Date.parse(v.released_on) <= now.getTime(),
    )
    .sort((a, b) => Date.parse(b.released_on!) - Date.parse(a.released_on!))[0];
  const rows = (
    history ? catalog.entries : latestMeta(catalog.entries, now)
  ).filter(
    (e) =>
      e.context_id === context &&
      (kind === "all" || kind === e.kind) &&
      (section === "all" ||
        section === "history" ||
        (section === "training" && relatedMetaLinks(catalog, e).length > 0) ||
        (section === "videos" &&
          (editions.find((x) => x.entry_id === e.id)?.content.videos.length ||
            0) > 0) ||
        section === e.kind ||
        section ===
          (editions.find((x) => x.entry_id === e.id)?.content.display_kind ||
            e.kind)) &&
      (history || e.state !== "archived") &&
      `${e.title} ${e.body} ${e.category}`
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .includes(
          query
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase(),
        ),
  );
  rows.sort((a, b) =>
    sort === "title"
      ? a.title.localeCompare(b.title, "pt-BR")
      : Date.parse(b.verified_at) - Date.parse(a.verified_at),
  );
  const contextLabel = (id: string) => {
    const c = catalog.contexts.find((x) => x.id === id);
    const v = catalog.versions.find((x) => x.id === c?.version_id);
    return c
      ? `${catalog.modes.find((x) => x.id === c.mode_id)?.title} · ${v?.patch} · ${playNames[c.play_context]} · ${catalog.formats.find((x) => x.id === c.format_id)?.title} · ${c.region === "unspecified" ? "Região não especificada" : c.region}${c.event_key ? " · " + (eventNames[c.event_key] || "Evento específico") : ""}`
      : id;
  };
  const setDimension = (key: string, value: string) => {
    const next = { ...dimensions, [key]: value };
    setDimensions(next);
    setCompare("");
    const candidate = catalog.contexts.find((c) =>
      Object.entries(next).every(
        ([k, v]) =>
          !v ||
          (k === "season"
            ? catalog.versions.find((x) => x.id === c.version_id)?.season === v
            : k === "construction"
              ? String(
                  catalog.modes.find((x) => x.id === c.mode_id)?.construction,
                ) === v
              : k === "family"
                ? (c.mode_id.startsWith("reload-")
                    ? "reload"
                    : c.mode_id.startsWith("br-")
                      ? "br"
                      : "other") === v
                : String(c[k as keyof typeof c] ?? "") === v),
      ),
    );
    setContext(candidate?.id || "");
  };
  const contextRows = latestMeta(catalog.entries, now).filter(
    (e) => e.context_id === context && e.state !== "archived",
  );
  const filterOptions: Record<string, { id: string; title: string }[]> = {
    season: [...new Set(catalog.versions.map((v) => v.season))].map((id) => ({
      id,
      title: id,
    })),
    version_id: catalog.versions.map((v) => ({
      id: v.id,
      title: v.patch + " · " + v.season,
    })),
    mode_id: catalog.modes,
    format_id: catalog.formats,
    construction: [
      { id: "true", title: "Construção" },
      { id: "false", title: "Construção Zero" },
    ],
    family: [
      { id: "br", title: "Battle Royale" },
      { id: "reload", title: "Reload / Trocação" },
      { id: "other", title: "Outras modalidades" },
    ],
    play_context: Object.entries(playNames).map(([id, title]) => ({
      id,
      title,
    })),
    region: [...new Set(catalog.contexts.map((c) => c.region))].map((id) => ({
      id,
      title: id === "unspecified" ? "Não especificada" : id,
    })),
    event_key: [
      ...new Set(catalog.contexts.map((c) => c.event_key).filter(Boolean)),
    ].map((id) => ({ id: id!, title: eventNames[id!] || id! })),
  };
  return (
    <>
      <KnowledgeAccess />
      <Heading
        eyebrow="COMPETITIVE INTELLIGENCE"
        title="Meta com contexto."
        description="Uma base editorial verificável para estudar mudanças e revisar seu treinamento."
        action={
          <Link className="button" to="/competitive">
            Central competitiva
          </Link>
        }
      />
      <nav
        className="tabs page-tabs meta-section-nav"
        aria-label="Seções do Meta"
      >
        {Object.entries({
          all: "Visão geral",
          item: "Itens",
          location: "Mapa e drops",
          strategy: "Estratégias",
          analysis: "Análises profissionais",
          videos: "Vídeos",
          history: "Atualizações e histórico",
          training: "Treinos relacionados",
        }).map(([id, title]) => (
          <button
            key={id}
            aria-pressed={section === id}
            onClick={() => {
              setSection(id);
              setHistory(id === "history");
            }}
          >
            {title}
          </button>
        ))}
      </nav>
      {s.admin && !s.demo && (
        <Link className="button" to="/admin/meta">
          Gerenciar Meta
        </Link>
      )}
      <div className="panel meta-context">
        <Badge>Pesquisa inicial · 10/10/2026</Badge>
        <h2>{version?.season || "Selecione um contexto"}</h2>
        <p>
          Patch {version?.patch || "não confirmado"}. Última verificação neste
          recorte:{" "}
          {contextRows.length
            ? new Date(
                Math.max(...contextRows.map((e) => Date.parse(e.verified_at))),
              ).toLocaleString("pt-BR")
            : "sem dados"}
          .{" "}
          {version?.released_on &&
            latestVersion?.released_on &&
            version.released_on < latestVersion.released_on &&
            "Contexto histórico: não representa o patch mais recente investigado."}{" "}
          Cobertura parcial: não há inventário completo, mapa visual licenciado
          ou análise audiovisual integral. Consulte a fonte antes de preparar
          uma competição.
        </p>
        <p>
          Modalidade, formato, região e evento são independentes. Um item no
          casual não comprova presença no Ranked ou num torneio.
        </p>
      </div>
      <div className="filters meta-filters">
        <label>
          Contexto de consulta
          <select
            value={context}
            onChange={(e) => {
              setDimensions({});
              setContext(e.target.value);
              setCompare("");
            }}
          >
            <option value="">Nenhuma combinação selecionada</option>
            {catalog.contexts.map((c) => (
              <option key={c.id} value={c.id}>
                {contextLabel(c.id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar no meta
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Item, local ou mecânica"
          />
        </label>
        <label>
          Tipo de conhecimento
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">Todos</option>
            {Object.entries(metaKinds).map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={history}
            onChange={(e) => setHistory(e.target.checked)}
          />{" "}
          Mostrar revisões históricas
        </label>
      </div>
      <details className="panel meta-context">
        <summary>Combinar filtros de modalidade, versão e equipe</summary>
        <p>
          Somente contextos cadastrados são selecionados. Combinações sem
          registro permanecem vazias.
        </p>
        <div className="meta-editor-fields">
          {Object.entries(filterOptions).map(([key, options]) => (
            <label key={key}>
              {
                {
                  season: "Temporada",
                  version_id: "Versão",
                  mode_id: "Modalidade",
                  format_id: "Equipe",
                  construction: "Construção",
                  family: "Experiência",
                  play_context: "Tipo de partida",
                  region: "Região",
                  event_key: "Competição",
                }[key]
              }
              <select
                aria-label={
                  "Filtrar " +
                  {
                    season: "temporada",
                    version_id: "versão",
                    mode_id: "modalidade",
                    format_id: "equipe",
                    construction: "construção",
                    family: "experiência",
                    play_context: "partida",
                    region: "região",
                    event_key: "competição",
                  }[key]
                }
                value={dimensions[key] || ""}
                onChange={(e) => setDimension(key, e.target.value)}
              >
                <option value="">Todas</option>
                {options.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button
          className="button"
          onClick={() => {
            setDimensions({});
            setContext(catalog.contexts[0]?.id || "");
          }}
        >
          Limpar filtros
        </button>
      </details>
      <label>
        Ordenar registros
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="verified">Verificação mais recente</option>
          <option value="title">Nome</option>
        </select>
      </label>
      <p role="status">{rows.length} registros neste contexto.</p>
      {!rows.length && (
        <Empty title="Ainda não há registros para este recorte">
          Isso não significa que o recurso esteja ausente do Fortnite. A
          verificação está pendente.
        </Empty>
      )}
      <div className="meta-grid">
        {rows.map((e) => {
          const status = metaStatus(
            e,
            selected!.version_id,
            selected!.version_id,
            now,
          );
          return (
            <article className="panel meta-record" key={e.id}>
              <div className="row between">
                <Badge tone={status === "confirmed" ? "green" : "neutral"}>
                  {metaStates[status]}
                </Badge>
                <span className="small-text">Revisão {e.revision}</span>
              </div>
              {(() => {
                const assetId = editions.find((x) => x.entry_id === e.id)
                    ?.content.media_ids[0],
                  a = assets.find((x) => x.id === assetId);
                return a ? <MetaImage asset={a} /> : null;
              })()}
              <h2>{e.title}</h2>
              <p>
                {editions.find((x) => x.entry_id === e.id)?.content.summary ||
                  e.body}
              </p>
              <p className="small-text">
                {e.category} ·{" "}
                {catalog.modes.find((m) => m.id === selected?.mode_id)?.title} ·{" "}
                {version?.season}
              </p>
              <Link
                className="button"
                to={
                  editions.find((x) => x.entry_id === e.id)?.content.slug
                    ? `/competitive/meta/${e.context_id}/${editions.find((x) => x.entry_id === e.id)!.content.slug}`
                    : "/competitive/meta/" + e.id
                }
              >
                Abrir página detalhada
              </Link>
              <p className="small-text">
                {available[e.availability]} · Evidência:{" "}
                {evidenceNames[e.evidence]}
              </p>
              <details>
                <summary>Fontes, limites e treinamento</summary>
                <p>{e.limitations}</p>
                <p>
                  Verificado:{" "}
                  {new Date(e.verified_at).toLocaleDateString("pt-BR")} ·
                  Revisar até:{" "}
                  {new Date(e.review_due).toLocaleDateString("pt-BR")}
                </p>
                <p>{e.change_note}</p>
                <ul>
                  {e.source_ids.map((id) => {
                    const source = catalog.sources.find((x) => x.id === id);
                    return source ? (
                      <li key={id}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {source.title}
                        </a>
                        <p className="small-text">
                          {evidenceNames[source.kind]} · Acesso:{" "}
                          {accessNames[source.access]}. {source.limitations}
                        </p>
                      </li>
                    ) : (
                      <li key={id}>Fonte não disponível</li>
                    );
                  })}
                </ul>
                <h3>Relações editoriais</h3>
                <ul>
                  {relatedMetaLinks(catalog, e).map((l) => {
                    const article = s.catalog.articles.find(
                      (a) => a.id === l.target_id && a.published,
                    );
                    const exercise = s.catalog.exercises.find(
                      (a) => a.id === l.target_id && a.published,
                    );
                    const tournament = s.catalog.tournaments.find(
                      (a) => a.id === l.target_id && a.published,
                    );
                    const to =
                      l.target_kind === "competency"
                        ? "/academy/research"
                        : article
                          ? "/academy/" + article.slug
                          : exercise
                            ? "/library/" + exercise.id
                            : tournament
                              ? "/competitive/" + tournament.slug
                              : null;
                    return (
                      <li key={l.id}>
                        {to ? (
                          <Link to={to}>
                            {article?.title ||
                              exercise?.title ||
                              tournament?.title ||
                              "Habilidade: " + l.target_id}
                          </Link>
                        ) : (
                          "Conteúdo relacionado indisponível"
                        )}
                        <p className="small-text">{l.reason}</p>
                      </li>
                    );
                  })}
                </ul>
              </details>
              {s.admin && !s.demo && (
                <Link className="button" to={"/admin/meta?entry=" + e.id}>
                  Preparar nova revisão
                </Link>
              )}
            </article>
          );
        })}
      </div>
      <section className="panel meta-context">
        <h2>Comparar contextos e identificar revisões</h2>
        <label>
          Comparar com
          <select
            aria-label="Comparar com"
            value={compare}
            onChange={(e) => setCompare(e.target.value)}
          >
            <option value="">Escolha outro contexto</option>
            {catalog.contexts
              .filter((c) => c.id !== context)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {contextLabel(c.id)}
                </option>
              ))}
          </select>
        </label>
        {compare && (
          <>
            <p>
              Ausência de registro significa lacuna editorial, não retirada do
              jogo. Contextos diferentes não comprovam diferenças de loot.
            </p>
            <ul>
              {compareMeta(catalog, context, compare).map((row) => (
                <li key={row.key}>
                  <strong>{row.after?.title || row.before?.title}</strong>:{" "}
                  {row.before
                    ? available[row.before.availability]
                    : "Sem registro"}{" "}
                  →{" "}
                  {row.after
                    ? available[row.after.availability]
                    : "Sem registro"}
                </li>
              ))}
            </ul>
            <p>
              Revisar conteúdos relacionados:{" "}
              {
                catalog.links.filter((l) =>
                  compareMeta(catalog, context, compare).some(
                    (r) =>
                      r.before?.id === l.entry_id || r.after?.id === l.entry_id,
                  ),
                ).length
              }{" "}
              relações editoriais. Nenhuma rotina pessoal é alterada.
            </p>
          </>
        )}
      </section>
      <section className="panel meta-context">
        <h2>Fontes ainda insuficientes</h2>
        <p>
          Metadados de vídeo não equivalem a análise de gameplay. Não
          fundamentam os registros aprovados.
        </p>
        {catalog.sources
          .filter((x) => ["metadata", "unavailable"].includes(x.access))
          .map((x) => (
            <p key={x.id}>
              <a href={x.url} target="_blank" rel="noopener noreferrer">
                {x.title}
              </a>{" "}
              — {x.limitations}
            </p>
          ))}
      </section>
    </>
  );
}
