import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Heading, Empty, Modal } from "../components/ui";
import { KnowledgeAnswer } from "../components/KnowledgeAnswer";
import { useStore } from "../lib/store";
import {
  askKnowledge,
  providerStatus,
  loadAdmin,
  saveKnowledge,
  manageKnowledge,
  configureKnowledge,
  refreshKnowledge,
  teachingProposal,
  documentSchema,
  type KnowledgeDocument,
  type KnowledgeDraft,
  type KnowledgeAnswer as Answer,
  type KnowledgeSettings,
} from "../lib/knowledge/service";
type AdminData = Awaited<ReturnType<typeof loadAdmin>>;
const evidenceLabels: Record<string, string> = {
  official: "Informação oficial verificada",
  professional: "Experiência profissional documentada",
  analysis: "Análise técnica",
  editorial: "Interpretação editorial",
  administrator: "Informação do administrador",
  unconfirmed: "Ainda não confirmada",
};
export default function KnowledgeAdmin() {
  const s = useStore();
  const [data, setData] = useState<AdminData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("teach"),
    [text, setText] = useState(""),
    [proposal, setProposal] = useState<KnowledgeDocument | null>(null),
    [editing, setEditing] = useState<KnowledgeDraft | null>(null),
    [sourceText, setSourceText] = useState("[]"),
    [relatedText, setRelatedText] = useState("[]"),
    [filter, setFilter] = useState(""),
    [seasonFilter, setSeasonFilter] = useState(""),
    [modeFilter, setModeFilter] = useState("all"),
    [publicationFilter, setPublicationFilter] = useState("all"),
    [question, setQuestion] = useState(""),
    [testSeason, setTestSeason] = useState(""),
    [testVersion, setTestVersion] = useState(""),
    [testRegion, setTestRegion] = useState(""),
    [testMode, setTestMode] = useState<"build" | "zero" | "both">("both"),
    [before, setBefore] = useState<Answer | null>(null),
    [after, setAfter] = useState<Answer | null>(null),
    [preview, setPreview] = useState(true),
    [confirmation, setConfirmation] = useState<{
      d: KnowledgeDraft;
      action: "publish" | "withdraw" | "archive" | "restore";
      version?: number;
    } | null>(null),
    [config, setConfig] = useState<KnowledgeSettings | null>(null);
  const [provider, setProvider] = useState<Awaited<
    ReturnType<typeof providerStatus>
  > | null>(null);
  const [sourceTitle, setSourceTitle] = useState(""),
    [sourceUrl, setSourceUrl] = useState(""),
    [sourceKind, setSourceKind] = useState("editorial"),
    [sourceDate, setSourceDate] = useState("");
  const generation = useRef(0);
  const allowed = s.admin && !s.demo;
  const owner = s.session?.user.id;
  async function reload() {
    const r = await loadAdmin();
    setData(r);
    setConfig(r.settings);
  }
  useEffect(() => {
    generation.current++;
    setData(null);
    setProvider(null);
    setProposal(null);
    setBefore(null);
    setAfter(null);
    setError("");
    if (!allowed) return;
    const current = generation.current;
    loadAdmin()
      .then((r) => {
        if (current === generation.current) {
          setData(r);
          setConfig(r.settings);
        }
      })
      .catch(() => {
        if (current === generation.current)
          setError(
            "Não foi possível carregar o painel. Verifique sua sessão e as permissões.",
          );
      });
    return () => {
      generation.current++;
    };
  }, [allowed, owner]);
  if (!allowed)
    return (
      <Empty title="Acesso administrativo restrito">
        Somente administradores autenticados podem gerenciar a inteligência
        artificial. A demonstração não concede permissões.
      </Empty>
    );
  async function run(f: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operação não concluída.");
    } finally {
      setBusy(false);
    }
  }
  function edit(d: KnowledgeDraft | null, p: KnowledgeDocument) {
    setEditing(d);
    setProposal(structuredClone(p));
    setSourceText(JSON.stringify(p.sources, null, 2));
    setRelatedText(JSON.stringify(p.related, null, 2));
    setTab("teach");
  }
  function change<K extends keyof KnowledgeDocument>(
    key: K,
    value: KnowledgeDocument[K],
  ) {
    setProposal((p) => (p ? { ...p, [key]: value } : p));
  }
  const draftStatus = (d: KnowledgeDraft) =>
    d.archived
      ? "Arquivado"
      : d.published_revision === d.version
        ? "Publicado"
        : d.published_revision
          ? "Rascunho com versão pública anterior"
          : "Rascunho";
  return (
    <div className="knowledge-page knowledge-admin-workbench">
      <Heading
        title="Inteligência Artificial"
        description="Fortnite Knowledge: ensinar, revisar, testar e publicar. As mensagens administrativas não viram fatos automaticamente."
      />
      <div className="row">
        <Link className="button ghost" to="/admin">
          Painel editorial
        </Link>
        <Link className="button ghost" to="/admin/meta">
          Gerenciar Meta Center
        </Link>
        <Link className="button ghost" to="/knowledge">
          Visão do usuário
        </Link>
      </div>
      <nav className="row" aria-label="Ferramentas de inteligência artificial">
        {[
          ["teach", "Ensinar à IA"],
          ["records", "Base de conhecimento"],
          ["test", "Testar respostas"],
          ["operations", "Status e utilização"],
        ].map(([id, label]) => (
          <button
            className={"button " + (tab === id ? "" : "ghost")}
            key={id}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {!data ? (
        <button
          disabled={busy}
          className="button"
          onClick={() => void run(reload)}
        >
          Recarregar painel
        </button>
      ) : (
        <>
          {tab === "teach" && (
            <>
              <section className="card knowledge-admin-record">
                <h2>Ensinar à IA</h2>
                <p>
                  Explique o conceito ou a mudança. A organização inicial é
                  feita por regras, sem modelo generativo e sem salvar a
                  mensagem. Revise ambiguidades, fontes e contexto.
                </p>
                <label>
                  Sua explicação
                  <textarea
                    rows={5}
                    maxLength={3000}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Piece Control é…"
                  />
                </label>
                <button
                  className="button"
                  disabled={text.trim().length < 20 || busy}
                  onClick={() => edit(null, teachingProposal(text))}
                >
                  Organizar proposta sem publicar
                </button>
                <button
                  className="button ghost"
                  onClick={() =>
                    edit(
                      null,
                      teachingProposal(
                        "Novo conhecimento de Fortnite. Escreva aqui uma explicação completa.",
                      ),
                    )
                  }
                >
                  Criar manualmente
                </button>
              </section>
              {proposal && (
                <section className="card">
                  <h2>
                    Prévia editável ·{" "}
                    {editing ? "revisão " + editing.version : "novo rascunho"}
                  </h2>
                  <p>
                    Esta proposta não está disponível para usuários. A
                    verificação é responsabilidade editorial; uma mensagem
                    administrativa não é uma fonte oficial.
                  </p>
                  {proposal.scope === "season" && !proposal.season && (
                    <p role="status">
                      Ambiguidade: qual temporada e versão se aplicam? Informe o
                      contexto antes de salvar.
                    </p>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        const p = documentSchema.parse({
                          ...proposal,
                          sources: JSON.parse(sourceText),
                          related: JSON.parse(relatedText),
                        });
                        const saved = await saveKnowledge(p, editing);
                        await reload();
                        edit(saved, saved.payload);
                      });
                    }}
                  >
                    <div className="row">
                      <label>
                        Título
                        <input
                          value={proposal.title}
                          maxLength={200}
                          onChange={(e) => change("title", e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Identificador do assunto
                        <input
                          value={proposal.subject}
                          maxLength={100}
                          onChange={(e) => change("subject", e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Categoria
                        <input
                          value={proposal.category}
                          onChange={(e) => change("category", e.target.value)}
                          maxLength={100}
                        />
                      </label>
                    </div>
                    <label>
                      Conteúdo
                      <textarea
                        value={proposal.body}
                        rows={8}
                        maxLength={3000}
                        onChange={(e) => change("body", e.target.value)}
                      />
                    </label>
                    <label>
                      Termos de busca separados por vírgula
                      <input
                        value={proposal.aliases.join(", ")}
                        onChange={(e) =>
                          change(
                            "aliases",
                            e.target.value
                              .split(",")
                              .map((v) => v.trim())
                              .filter(Boolean),
                          )
                        }
                      />
                    </label>
                    <div className="row">
                      <label>
                        Modalidade
                        <select
                          value={proposal.mode}
                          onChange={(e) =>
                            change(
                              "mode",
                              e.target.value as KnowledgeDocument["mode"],
                            )
                          }
                        >
                          <option value="both">Ambas</option>
                          <option value="build">Construção</option>
                          <option value="zero">Construção Zero</option>
                        </select>
                      </label>
                      <label>
                        Temporalidade
                        <select
                          value={proposal.scope}
                          onChange={(e) => {
                            const scope = e.target
                              .value as KnowledgeDocument["scope"];
                            setProposal({
                              ...proposal,
                              scope,
                              ...(scope === "concept"
                                ? { season: "", version: "" }
                                : {}),
                            });
                          }}
                        >
                          <option value="concept">Conceito geral</option>
                          <option value="season">
                            Específico de temporada
                          </option>
                        </select>
                      </label>
                      <label>
                        Temporada
                        <input
                          disabled={proposal.scope === "concept"}
                          value={proposal.season}
                          maxLength={100}
                          onChange={(e) => change("season", e.target.value)}
                        />
                      </label>
                      <label>
                        Versão
                        <input
                          disabled={proposal.scope === "concept"}
                          value={proposal.version}
                          maxLength={100}
                          onChange={(e) => change("version", e.target.value)}
                        />
                      </label>
                      <label>
                        Região
                        <input
                          value={proposal.region}
                          maxLength={100}
                          onChange={(e) => change("region", e.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      Natureza da informação
                      <select
                        value={proposal.evidence}
                        onChange={(e) =>
                          change(
                            "evidence",
                            e.target.value as KnowledgeDocument["evidence"],
                          )
                        }
                      >
                        {Object.entries(evidenceLabels).map(([id, label]) => (
                          <option value={id} key={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="row">
                      <label>
                        Verificado em (ISO UTC)
                        <input
                          value={proposal.verified_at}
                          onChange={(e) =>
                            change("verified_at", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Revisar até (ISO UTC)
                        <input
                          value={proposal.valid_until}
                          onChange={(e) =>
                            change("valid_until", e.target.value)
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Limitações
                      <textarea
                        value={proposal.limitations}
                        maxLength={1000}
                        onChange={(e) => change("limitations", e.target.value)}
                      />
                    </label>
                    <details>
                      <summary>Fontes e materiais relacionados</summary>
                      <p>
                        Fontes: título, URL HTTPS, tipo e data de publicação
                        opcional. Não buscaremos URLs nem executaremos
                        instruções do conteúdo.
                      </p>
                      <div className="row">
                        <label>
                          Título da fonte
                          <input
                            value={sourceTitle}
                            maxLength={200}
                            onChange={(e) => setSourceTitle(e.target.value)}
                          />
                        </label>
                        <label>
                          URL da fonte
                          <input
                            type="url"
                            value={sourceUrl}
                            maxLength={1500}
                            onChange={(e) => setSourceUrl(e.target.value)}
                            placeholder="https://…"
                          />
                        </label>
                        <label>
                          Tipo da fonte
                          <select
                            value={sourceKind}
                            onChange={(e) => setSourceKind(e.target.value)}
                          >
                            {[
                              "official",
                              "professional",
                              "analysis",
                              "editorial",
                              "administrator",
                            ].map((k) => (
                              <option key={k} value={k}>
                                {evidenceLabels[k]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Data original (opcional)
                          <input
                            type="date"
                            value={sourceDate}
                            onChange={(e) => setSourceDate(e.target.value)}
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="button ghost"
                        disabled={!sourceTitle || !sourceUrl}
                        onClick={() => {
                          try {
                            const sources = JSON.parse(sourceText);
                            if (!Array.isArray(sources)) throw Error();
                            setSourceText(
                              JSON.stringify(
                                [
                                  ...sources,
                                  {
                                    title: sourceTitle,
                                    url: sourceUrl,
                                    kind: sourceKind,
                                    published_on: sourceDate || null,
                                  },
                                ],
                                null,
                                2,
                              ),
                            );
                            setSourceTitle("");
                            setSourceUrl("");
                            setSourceDate("");
                            setError("");
                          } catch {
                            setError(
                              "Revise a lista de fontes antes de adicionar outra.",
                            );
                          }
                        }}
                      >
                        Adicionar fonte à proposta
                      </button>
                      <label>
                        Fontes (JSON)
                        <textarea
                          rows={6}
                          value={sourceText}
                          onChange={(e) => setSourceText(e.target.value)}
                          placeholder={
                            '[{"title":"Fonte original","url":"https://www.fortnite.com/news/…","kind":"official","published_on":null}]'
                          }
                        />
                      </label>
                      <label>
                        Links internos (JSON)
                        <textarea
                          rows={3}
                          value={relatedText}
                          onChange={(e) => setRelatedText(e.target.value)}
                        />
                      </label>
                    </details>
                    <button className="button" disabled={busy}>
                      Salvar rascunho
                    </button>
                  </form>
                  {editing && (
                    <div className="row">
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          setConfirmation({ d: editing, action: "publish" })
                        }
                      >
                        Revisar publicação
                      </button>
                      <button
                        className="button ghost"
                        onClick={() => {
                          setQuestion(editing.payload.title);
                          setTestSeason(editing.payload.season);
                          setTestVersion(editing.payload.version);
                          setTestRegion(editing.payload.region);
                          setTestMode(editing.payload.mode);
                          setTab("test");
                        }}
                      >
                        Testar versão salva
                      </button>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          {tab === "records" && (
            <section className="card">
              <h2>Conhecimentos e histórico</h2>
              <div className="row">
                <label>
                  Pesquisar
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </label>
                <label>
                  Filtrar temporada
                  <input
                    value={seasonFilter}
                    onChange={(e) => setSeasonFilter(e.target.value)}
                  />
                </label>
                <label>
                  Modalidade
                  <select
                    value={modeFilter}
                    onChange={(e) => setModeFilter(e.target.value)}
                  >
                    <option value="all">Todas</option>
                    <option value="build">Construção</option>
                    <option value="zero">Zero Build</option>
                    <option value="both">Ambas</option>
                  </select>
                </label>
                <label>
                  Publicação
                  <select
                    value={publicationFilter}
                    onChange={(e) => setPublicationFilter(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="published">Com versão pública</option>
                    <option value="draft">Rascunhos</option>
                    <option value="archived">Arquivados</option>
                  </select>
                </label>
              </div>
              {data.drafts
                .filter(
                  (d) =>
                    (d.payload.title + " " + d.payload.body)
                      .toLowerCase()
                      .includes(filter.toLowerCase()) &&
                    d.payload.season
                      .toLowerCase()
                      .includes(seasonFilter.toLowerCase()) &&
                    (modeFilter === "all" || d.payload.mode === modeFilter) &&
                    (publicationFilter === "all" ||
                      (publicationFilter === "archived" && d.archived) ||
                      (publicationFilter === "draft" &&
                        !d.archived &&
                        d.version !== d.published_revision) ||
                      (publicationFilter === "published" &&
                        !d.archived &&
                        !!d.published_revision)),
                )
                .map((d) => (
                  <article className="card" key={d.id}>
                    <h3>{d.payload.title}</h3>
                    <p>
                      {draftStatus(d)} · revisão {d.version} ·{" "}
                      {d.payload.season || "Conceito geral"} ·{" "}
                      {evidenceLabels[d.payload.evidence]}
                    </p>
                    <div className="row">
                      <button
                        className="button ghost"
                        onClick={() => edit(d, d.payload)}
                      >
                        Editar
                      </button>
                      {!d.archived && (
                        <button
                          className="button ghost"
                          onClick={() =>
                            setConfirmation({ d, action: "archive" })
                          }
                        >
                          Arquivar
                        </button>
                      )}
                      {d.published_revision && (
                        <button
                          className="button ghost"
                          onClick={() =>
                            setConfirmation({ d, action: "withdraw" })
                          }
                        >
                          Despublicar
                        </button>
                      )}
                    </div>
                    <details>
                      <summary>Versões preservadas</summary>
                      {data.revisions
                        .filter((r) => r.id === d.id)
                        .map((r) => (
                          <div key={r.version}>
                            <p>
                              Revisão {r.version} · {r.action} ·{" "}
                              {new Date(r.created_at).toLocaleString("pt-BR")}
                            </p>
                            <details>
                              <summary>Consultar conteúdo</summary>
                              <p style={{ whiteSpace: "pre-line" }}>
                                {r.payload.body}
                              </p>
                            </details>
                            <button
                              className="button ghost"
                              onClick={() =>
                                setConfirmation({
                                  d,
                                  action: "restore",
                                  version: r.version,
                                })
                              }
                            >
                              Restaurar como rascunho
                            </button>
                          </div>
                        ))}
                    </details>
                  </article>
                ))}
              <p className="muted">
                Consulta limitada aos 500 registros e 1.000 revisões mais
                recentes. Nenhum histórico é apagado por esses filtros.
              </p>
            </section>
          )}
          {tab === "test" && (
            <section className="card">
              <h2>Laboratório privado</h2>
              <p>
                Compare uma resposta anterior com uma nova consulta. A prévia
                usa a versão salva do rascunho; editar campos sem salvar não
                altera a recuperação.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const a = await askKnowledge({
                      message: question,
                      mode: testMode,
                      season: testSeason,
                      version: testVersion,
                      region: testRegion,
                      preview,
                      external: false,
                      diagnostics: false,
                    });
                    setAfter(a);
                  });
                }}
              >
                <label>
                  Pergunta de teste
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={1500}
                    required
                  />
                </label>
                <div className="row">
                  <label>
                    Modalidade
                    <select
                      value={testMode}
                      onChange={(e) =>
                        setTestMode(e.target.value as typeof testMode)
                      }
                    >
                      <option value="both">Ambas</option>
                      <option value="build">Construção</option>
                      <option value="zero">Zero Build</option>
                    </select>
                  </label>
                  <label>
                    Temporada
                    <input
                      value={testSeason}
                      onChange={(e) => setTestSeason(e.target.value)}
                    />
                  </label>
                  <label>
                    Versão
                    <input
                      value={testVersion}
                      onChange={(e) => setTestVersion(e.target.value)}
                    />
                  </label>
                  <label>
                    Região
                    <input
                      value={testRegion}
                      onChange={(e) => setTestRegion(e.target.value)}
                    />
                  </label>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={preview}
                    onChange={(e) => setPreview(e.target.checked)}
                  />
                  Incluir rascunhos privados
                </label>
                <button className="button" disabled={busy}>
                  Testar resposta
                </button>
              </form>
              <div className="row">
                <button
                  className="button ghost"
                  disabled={!after}
                  onClick={() => {
                    setBefore(after);
                    setAfter(null);
                  }}
                >
                  Guardar resposta anterior
                </button>
                <button
                  className="button ghost"
                  onClick={() => {
                    setBefore(null);
                    setAfter(null);
                    setQuestion("");
                  }}
                >
                  Reiniciar sessão de teste
                </button>
              </div>
              <p className="muted">
                Reiniciar limpa somente as respostas desta tela. A base
                permanente e conversas dos usuários são preservadas.
              </p>
              {before && (
                <>
                  <h3>Antes</h3>
                  <KnowledgeAnswer answer={before} />
                </>
              )}
              {after && (
                <>
                  <h3>Depois</h3>
                  <KnowledgeAnswer answer={after} />
                </>
              )}
            </section>
          )}
          {tab === "operations" && config && (
            <>
              <section className="card">
                <h2>Status e controles</h2>
                <button
                  className="button ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => setProvider(await providerStatus()))
                  }
                >
                  Verificar provedor no servidor
                </button>
                {provider && (
                  <p role="status">
                    Provedor: {provider.provider || "nenhum configurado"} ·{" "}
                    {provider.provider_configured
                      ? "chave configurada; disponibilidade real depende da chamada"
                      : "modo determinístico"}
                    . {provider.limits}. {provider.billing}
                  </p>
                )}
                <p>
                  Disponibilidade: {config.enabled ? "ativado" : "desativado"} ·
                  versão de recarga {config.epoch}. Provedor real e
                  disponibilidade da chave são verificados pela função de
                  servidor ao consultar; não exibimos credenciais.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await configureKnowledge(config);
                      await reload();
                    });
                  }}
                >
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) =>
                        setConfig({ ...config, enabled: e.target.checked })
                      }
                    />
                    Assistente ativado
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={config.external_enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          external_enabled: e.target.checked,
                        })
                      }
                    />
                    Permitir modelo externo quando houver chave e consentimento
                    do usuário
                  </label>
                  <div className="row">
                    <label>
                      Consultas por dia
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={config.daily_limit}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            daily_limit: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Consultas por minuto
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={config.minute_limit}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            minute_limit: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Detalhamento autorizado
                      <select
                        value={config.detail}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            detail: e.target.value as typeof config.detail,
                          })
                        }
                      >
                        <option value="concise">Objetivo</option>
                        <option value="extended">Ampliado</option>
                      </select>
                    </label>
                  </div>
                  <p>
                    Regras de segurança, fontes obrigatórias e confirmação de
                    ações são fixas no servidor. O conteúdo editorial não altera
                    instruções internas.
                  </p>
                  <button className="button" disabled={busy}>
                    Aplicar configurações
                  </button>
                </form>
                <button
                  className="button ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await refreshKnowledge();
                      await reload();
                    })
                  }
                >
                  Recarregar base sem apagar dados
                </button>
                <p className="muted">
                  As consultas não usam cache persistente de respostas. A
                  recarga incrementa a versão de conhecimento; não apaga
                  sessões, configurações ou publicações.
                </p>
              </section>
              <section className="card">
                <h2>Diagnósticos mínimos · últimos 30 dias</h2>
                <p>
                  {data.diagnostics.filter((d) => d.kind === "served").length}{" "}
                  respostas ·{" "}
                  {data.diagnostics.filter((d) => d.kind === "missing").length}{" "}
                  lacunas ·{" "}
                  {
                    data.diagnostics.filter(
                      (d) => d.kind === "provider_failure",
                    ).length
                  }{" "}
                  falhas de provedor, nos até 500 diagnósticos mais recentes.
                  Não são métricas totais de faturamento.
                </p>
                <p>
                  Custos e latência reais não estão disponíveis sem integração
                  ao faturamento/monitoramento do provedor. A base
                  determinística não gera custo de tokens.
                </p>
                {data.diagnostics
                  .filter((d) => d.kind === "missing" && d.topic)
                  .map((d, i) => (
                    <p key={i}>
                      Lacuna autorizada: {d.topic} ·{" "}
                      {new Date(d.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  ))}
              </section>
            </>
          )}
        </>
      )}
      {confirmation && (
        <Modal
          title="Confirmar alteração de conhecimento"
          onClose={() => {
            if (!busy) setConfirmation(null);
          }}
        >
          <p>
            {confirmation.action === "publish"
              ? "Publicar a versão salva para consultas dos usuários. Revise fonte, validade e contexto antes de confirmar."
              : confirmation.action === "restore"
                ? "Restaurar a revisão como rascunho, sem substituir a versão pública."
                : confirmation.action === "archive"
                  ? "Arquivar e retirar das consultas atuais. As revisões serão preservadas."
                  : "Despublicar e preservar o histórico."}
          </p>
          <h3>{confirmation.d.payload.title}</h3>
          <p style={{ whiteSpace: "pre-line" }}>
            {confirmation.action === "restore"
              ? data?.revisions.find(
                  (r) =>
                    r.id === confirmation.d.id &&
                    r.version === confirmation.version,
                )?.payload.body
              : confirmation.d.payload.body}
          </p>
          <p>
            Revisão esperada: {confirmation.d.version} ·{" "}
            {confirmation.d.payload.season || "Conceito geral"} ·{" "}
            {evidenceLabels[confirmation.d.payload.evidence]}
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const saved = await manageKnowledge(
                  confirmation.d,
                  confirmation.action,
                  confirmation.version,
                );
                await reload();
                if (editing?.id === saved.id) edit(saved, saved.payload);
                setConfirmation(null);
              })
            }
          >
            Confirmar{" "}
            {confirmation.action === "publish"
              ? "publicação"
              : confirmation.action === "restore"
                ? "restauração"
                : confirmation.action === "archive"
                  ? "arquivamento"
                  : "despublicação"}
          </button>
        </Modal>
      )}
    </div>
  );
}
