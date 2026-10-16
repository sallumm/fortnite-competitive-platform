import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { loadMeta } from "../lib/meta-service";
import type { MetaCatalog } from "../lib/meta";
import { metaKinds, metaStates } from "../lib/meta";
import {
  newContent,
  cleanEntryContent,
  editorialSchema,
  editorialDraftSchema,
  type EditorialContent,
  type MetaDraft,
  type MetaAsset,
  type MetaEdition,
} from "../lib/meta-editorial";
import {
  loadEditorial,
  loadDrafts,
  saveDraft,
  publishDraft,
  draftHistory,
  restoreDraft,
  uploadImage,
  removeImage,
} from "../lib/meta-editorial-service";
import { MetaContent, MetaImage } from "../components/MetaContent";
import { MetaRegistry } from "../components/MetaRegistry";
import { Heading, Empty } from "../components/ui";
const workflow = {
  draft: "Rascunho",
  review: "Em revisão",
  published: "Publicado",
  archived: "Arquivado",
};
const displayNames = {
  ...metaKinds,
  article: "Artigo educativo",
  video: "Vídeo educativo",
  drop: "Guia de drop",
};
function localTime(s: string) {
  const d = new Date(s);
  return new Date(+d - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export default function MetaAdmin() {
  const s = useStore(),
    [params] = useSearchParams();
  const [skills, setSkills] = useState<
    { id: string; title: string; mode: string }[]
  >([]);
  useEffect(() => {
    let active = true;
    if (s.admin && !s.demo)
      import("../lib/training-research")
        .then((m) => {
          if (active) setSkills(m.knowledge.competencies);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [s.admin, s.demo]);
  const [c, setC] = useState<MetaCatalog | null>(null),
    [drafts, setDrafts] = useState<MetaDraft[]>([]),
    [assets, setAssets] = useState<MetaAsset[]>([]),
    [editions, setEditions] = useState<MetaEdition[]>([]),
    [d, setD] = useState<MetaDraft | null>(null),
    [p, setP] = useState<EditorialContent | null>(null),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(false),
    [confirm, setConfirm] = useState<"publish" | "withdraw" | null>(null),
    [revisions, setRevisions] = useState<
      Awaited<ReturnType<typeof draftHistory>>
    >([]),
    [upload, setUpload] = useState({
      alt: "",
      source_url: "",
      rights: "",
      credit: "",
    }),
    [dirty, setDirty] = useState(false);
  async function refresh() {
    const [c, ds, ed] = await Promise.all([
      loadMeta(),
      loadDrafts(),
      loadEditorial(),
    ]);
    setC(c);
    setDrafts(ds);
    setAssets(ed.assets);
    setEditions(ed.editions);
    return { c, ds, ed };
  }
  useEffect(() => {
    if (!s.admin || s.demo) return;
    let active = true;
    Promise.all([loadMeta(), loadDrafts(), loadEditorial()])
      .then(([c, ds, ed]) => {
        if (!active) return;
        setC(c);
        setDrafts(ds);
        setAssets(ed.assets);
        setEditions(ed.editions);
        const e = c.entries.find((x) => x.id === params.get("entry"));
        if (e)
          setP(
            ed.editions.find((x) => x.entry_id === e.id)?.content ||
              cleanEntryContent(e),
          );
      })
      .catch(() => {
        if (active)
          setNotice(
            "Não foi possível carregar o painel. Confira a conexão e as migrations.",
          );
      });
    return () => {
      active = false;
    };
  }, [s.admin, s.demo, s.session?.user.id, params]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  if (!s.admin || s.demo)
    return (
      <Empty title="Gerenciar Meta exige uma conta administrativa">
        O papel é conferido no servidor. A demonstração pública não tem acesso
        editorial.<Link to="/competitive/meta">Consultar Meta público</Link>
      </Empty>
    );
  if (!c)
    return (
      <Empty title="Carregando gestão editorial">
        <span role="status">{notice || "Consultando banco…"}</span>
        <button
          className="button"
          onClick={() =>
            void refresh().catch(() =>
              setNotice("Não foi possível recuperar o painel."),
            )
          }
        >
          Tentar novamente
        </button>
      </Empty>
    );
  const update = <K extends keyof EditorialContent>(
    k: K,
    v: EditorialContent[K],
  ) => {
    setP(
      p
        ? {
            ...p,
            [k]: v,
            ...(k === "display_kind"
              ? {
                  kind:
                    v === "drop"
                      ? "location"
                      : v === "article" || v === "video"
                        ? "analysis"
                        : (v as EditorialContent["kind"]),
                }
              : {}),
          }
        : p,
    );
    setDirty(true);
    setConfirm(null);
  };
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Operação não concluída.");
    } finally {
      setBusy(false);
    }
  }
  async function save(status: "draft" | "review") {
    if (!p) return;
    await action(async () => {
      const parsed = (
        status === "draft" ? editorialDraftSchema : editorialSchema
      ).safeParse(p);
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((x) => `${x.path.join(".")}: ${x.message}`)
            .join(" "),
        );
      const saved = await saveDraft(parsed.data, status, d);
      setD(saved);
      setP(saved.payload);
      setDirty(false);
      await refresh();
      setNotice(
        status === "review"
          ? "Conteúdo salvo e enviado para revisão."
          : "Rascunho salvo no banco.",
      );
    });
  }
  function open(draft: MetaDraft) {
    if (dirty) {
      setNotice(
        "Salve o rascunho ou descarte as alterações antes de trocar de conteúdo.",
      );
      return;
    }
    setD(draft);
    setP(draft.payload);
    setPreview(false);
    setRevisions([]);
    setConfirm(null);
  }
  const textField = (
    key: keyof EditorialContent,
    title: string,
    long = false,
  ) => (
    <label key={key}>
      {title}
      {long ? (
        <textarea
          rows={4}
          value={String(p?.[key] ?? "")}
          onChange={(e) => update(key, e.target.value as never)}
        />
      ) : (
        <input
          disabled={key === "subject_key" && !!d}
          value={String(p?.[key] ?? "")}
          maxLength={key === "title" || key === "author" ? 300 : undefined}
          onChange={(e) => update(key, e.target.value as never)}
        />
      )}
    </label>
  );
  const selectField = (
    key: keyof EditorialContent,
    title: string,
    options: Record<string, string>,
  ) => (
    <label key={key}>
      {title}
      <select
        value={String(p?.[key] ?? "")}
        onChange={(e) => update(key, e.target.value as never)}
      >
        {Object.entries(options).map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <Heading
        eyebrow="ADMINISTRAÇÃO EDITORIAL"
        title="Gerenciar Meta"
        description="Rascunhos privados, revisão e publicação com histórico preservado."
        action={
          <Link className="button" to="/admin">
            Painel administrativo
          </Link>
        }
      />
      <p role="status" className="meta-editor-notice">
        {notice}
      </p>
      <MetaRegistry
        catalog={c}
        onSaved={async () => {
          await refresh();
        }}
      />
      <div className="meta-admin-layout publishing-workbench">
        <aside className="panel">
          <h2>Conteúdos</h2>
          <button
            disabled={busy || dirty}
            className="button primary"
            onClick={() => {
              setD(null);
              setP(newContent(c.contexts[0]?.id || ""));
              setPreview(false);
              setRevisions([]);
            }}
          >
            Novo conteúdo
          </button>
          <label>
            Pesquisar conteúdos
            <input value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label>
            Estado editorial
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="due">Revisão vencida</option>
              {Object.entries(workflow).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {drafts
            .filter(
              (x) =>
                (filter === "all" ||
                  (filter === "due" &&
                    Date.parse(x.payload.review_due) <= Date.now()) ||
                  x.status === filter) &&
                `${x.payload.title} ${x.payload.category}`
                  .toLocaleLowerCase()
                  .includes(q.toLocaleLowerCase()),
            )
            .map((x) => (
              <button
                className="meta-draft-row"
                key={x.id}
                aria-pressed={d?.id === x.id}
                onClick={() => open(x)}
              >
                <strong>{x.payload.title || "Rascunho sem título"}</strong>
                <span>
                  {workflow[x.status]} · v{x.version}
                </span>
              </button>
            ))}
          <details>
            <summary>Conhecimento já publicado</summary>
            {c.entries
              .filter((e) =>
                `${e.title} ${e.category}`
                  .toLocaleLowerCase()
                  .includes(q.toLocaleLowerCase()),
              )
              .map((e) => (
                <button
                  key={e.id}
                  className="meta-draft-row"
                  disabled={dirty}
                  onClick={() => {
                    setD(null);
                    setP(
                      editions.find((x) => x.entry_id === e.id)?.content ||
                        cleanEntryContent(e),
                    );
                    setRevisions([]);
                  }}
                >
                  {e.title} · r{e.revision}
                </button>
              ))}
          </details>
        </aside>
        <section className="panel">
          {p ? (
            <>
              <div className="row between">
                <h2>{d ? "Editar conteúdo" : "Criar conteúdo"}</h2>
                <button
                  className="button"
                  onClick={() => setPreview((x) => !x)}
                >
                  {preview ? "Voltar à edição" : "Pré-visualizar"}
                </button>
              </div>
              {dirty && <p>Alterações locais ainda não salvas.</p>}
              {preview ? (
                <MetaContent content={p} catalog={c} assets={assets} />
              ) : (
                <>
                  <div className="meta-editor-fields">
                    {textField("title", "Título")}
                    {textField("slug", "Slug da página")}
                    {textField("subject_key", "Identidade estável do assunto")}
                    {selectField(
                      "display_kind",
                      "Tipo de página",
                      displayNames,
                    )}
                    {selectField("kind", "Tipo de conhecimento", metaKinds)}
                    {textField("category", "Categoria (identificador)")}
                    {textField("author", "Autor / editor público")}
                    <label>
                      Contexto: versão, modalidade e formato
                      <select
                        disabled={!!d}
                        value={p.context_id}
                        onChange={(e) => update("context_id", e.target.value)}
                      >
                        {c.contexts.map((x) => (
                          <option key={x.id} value={x.id}>
                            {
                              c.versions.find((v) => v.id === x.version_id)
                                ?.season
                            }{" "}
                            ·{" "}
                            {
                              c.versions.find((v) => v.id === x.version_id)
                                ?.patch
                            }{" "}
                            · {c.modes.find((v) => v.id === x.mode_id)?.title} ·{" "}
                            {c.formats.find((v) => v.id === x.format_id)?.title}{" "}
                            · {x.play_context} · {x.region} {x.event_key}
                          </option>
                        ))}
                      </select>
                    </label>
                    {textField("summary", "Resumo", true)}
                    {textField("body", "Descrição", true)}
                    <label>
                      Tags (separadas por vírgula)
                      <input
                        value={p.tags.join(", ")}
                        onChange={(e) =>
                          update(
                            "tags",
                            e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean),
                          )
                        }
                      />
                    </label>
                    {selectField("state", "Estado da informação", metaStates)}
                    {selectField("availability", "Disponibilidade", {
                      available: "Disponível na fonte",
                      vaulted: "No cofre",
                      announced: "Anunciado",
                      unknown: "Não confirmada",
                    })}
                    {selectField("evidence", "Tipo de evidência", {
                      official: "Oficial",
                      professional: "Experiência profissional",
                      analysis: "Análise",
                      editorial: "Editorial",
                      hypothesis: "Hipótese",
                    })}
                    {(["verified_at", "review_due"] as const).map((k) => (
                      <label key={k}>
                        {k === "verified_at"
                          ? "Data de verificação"
                          : "Próxima revisão"}
                        <input
                          type="datetime-local"
                          value={localTime(p[k])}
                          onChange={(e) => {
                            if (e.target.value)
                              update(k, new Date(e.target.value).toISOString());
                          }}
                        />
                      </label>
                    ))}
                    {textField("limitations", "Limitações", true)}
                    {textField("change_note", "Descrição da alteração", true)}
                    {textField("objective", "Objetivo", true)}
                    {selectField("level", "Nível recomendado", {
                      all: "Todos",
                      beginner: "Iniciante",
                      intermediate: "Intermediário",
                      advanced: "Avançado",
                    })}
                    {textField("prerequisites", "Pré-requisitos", true)}
                  </div>
                  <fieldset>
                    <legend>Fontes verificadas</legend>
                    <div className="meta-source-options">
                      {c.sources.map((x) => (
                        <label key={x.id}>
                          <input
                            type="checkbox"
                            checked={p.source_ids.includes(x.id)}
                            onChange={(e) =>
                              update(
                                "source_ids",
                                e.target.checked
                                  ? [...p.source_ids, x.id]
                                  : p.source_ids.filter((id) => id !== x.id),
                              )
                            }
                          />
                          {x.title} ·{" "}
                          {
                            {
                              page: "Texto de página",
                              listing: "Listagem",
                              metadata: "Somente metadados",
                              transcript: "Transcrição",
                              audiovisual: "Análise audiovisual",
                              unavailable: "Indisponível",
                            }[x.access]
                          }
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <section>
                    <h3>Blocos de conteúdo seguro</h3>
                    <p>
                      Texto e títulos são renderizados como texto. HTML e
                      scripts não são executados.
                    </p>
                    {p.blocks.map((b, i) => (
                      <div key={i} className="meta-edit-row">
                        <label>
                          Título do bloco
                          <input
                            value={b.heading}
                            onChange={(e) =>
                              update(
                                "blocks",
                                p.blocks.map((x, j) =>
                                  j === i
                                    ? { ...x, heading: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Texto do bloco
                          <textarea
                            value={b.text}
                            onChange={(e) =>
                              update(
                                "blocks",
                                p.blocks.map((x, j) =>
                                  j === i ? { ...x, text: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <button
                          className="button"
                          onClick={() =>
                            update(
                              "blocks",
                              p.blocks.filter((_, j) => j !== i),
                            )
                          }
                        >
                          Remover bloco {i + 1}
                        </button>
                      </div>
                    ))}
                    <button
                      className="button"
                      onClick={() =>
                        update("blocks", [
                          ...p.blocks,
                          { heading: "", text: "" },
                        ])
                      }
                    >
                      Adicionar bloco
                    </button>
                  </section>
                  <section>
                    <h3>Características verificadas</h3>
                    {p.characteristics.map((b, i) => (
                      <div className="meta-edit-row" key={i}>
                        <label>
                          Característica
                          <input
                            value={b.name}
                            onChange={(e) =>
                              update(
                                "characteristics",
                                p.characteristics.map((x, j) =>
                                  j === i ? { ...x, name: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Valor e unidade
                          <input
                            value={b.value}
                            onChange={(e) =>
                              update(
                                "characteristics",
                                p.characteristics.map((x, j) =>
                                  j === i ? { ...x, value: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <button
                          className="button"
                          onClick={() =>
                            update(
                              "characteristics",
                              p.characteristics.filter((_, j) => j !== i),
                            )
                          }
                        >
                          Remover característica {i + 1}
                        </button>
                      </div>
                    ))}
                    <button
                      className="button"
                      onClick={() =>
                        update("characteristics", [
                          ...p.characteristics,
                          { name: "", value: "" },
                        ])
                      }
                    >
                      Adicionar característica
                    </button>
                  </section>
                  <section>
                    <h3>Capa e galeria</h3>
                    <p>
                      A primeira imagem associada será a capa. Imagens
                      publicadas são preservadas no histórico; para substituir,
                      envie uma nova e altere a associação.
                    </p>
                    <div className="meta-editor-fields">
                      {Object.keys(upload).map((k) => (
                        <label key={k}>
                          {
                            {
                              alt: "Texto alternativo",
                              source_url: "Fonte da imagem (HTTPS)",
                              rights:
                                "Licença ou autorização de uso (registro público, sem dados privados)",
                              credit: "Crédito do autor",
                            }[k]
                          }
                          <input
                            value={upload[k as keyof typeof upload]}
                            onChange={(e) =>
                              setUpload({ ...upload, [k]: e.target.value })
                            }
                          />
                        </label>
                      ))}
                      <label>
                        Enviar imagem autorizada (PNG, JPEG, WebP até 3 MB)
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={busy}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f)
                              void action(async () => {
                                const a = await uploadImage(f, upload);
                                setAssets((x) => [...x, a]);
                                update("media_ids", [...p.media_ids, a.id]);
                                setNotice(
                                  "Imagem enviada. Salve o rascunho para associá-la.",
                                );
                              });
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {assets.map((a) => (
                      <div key={a.id} className="meta-asset-option">
                        <label>
                          <input
                            type="checkbox"
                            checked={p.media_ids.includes(a.id)}
                            onChange={(e) =>
                              update(
                                "media_ids",
                                e.target.checked
                                  ? [...p.media_ids, a.id]
                                  : p.media_ids.filter((id) => id !== a.id),
                              )
                            }
                          />
                          {a.alt}
                        </label>
                        {p.media_ids.includes(a.id) && <MetaImage asset={a} />}
                        <button
                          className="button"
                          disabled={busy || p.media_ids.includes(a.id)}
                          onClick={() =>
                            void action(async () => {
                              await removeImage(a);
                              await refresh();
                              setNotice("Imagem não publicada removida.");
                            })
                          }
                        >
                          Remover arquivo não utilizado
                        </button>
                      </div>
                    ))}
                  </section>
                  <section>
                    <h3>Vídeos e VODs</h3>
                    {p.videos.map((v, i) => (
                      <fieldset key={i}>
                        <legend>Vídeo {i + 1}</legend>
                        <div className="meta-editor-fields">
                          {(
                            [
                              "title",
                              "creator",
                              "url",
                              "description",
                              "source_url",
                              "authorization",
                            ] as const
                          ).map((k) => (
                            <label key={k}>
                              {
                                {
                                  title: "Título do vídeo",
                                  creator: "Criador",
                                  url: "URL do vídeo",
                                  description: "Descrição do vídeo",
                                  source_url: "Fonte do vídeo",
                                  authorization:
                                    "Autorização de uso / incorporação",
                                }[k]
                              }
                              <input
                                value={v[k]}
                                onChange={(e) =>
                                  update(
                                    "videos",
                                    p.videos.map((x, j) =>
                                      j === i
                                        ? { ...x, [k]: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                              />
                            </label>
                          ))}
                          <label>
                            <input
                              type="checkbox"
                              checked={v.embed_allowed}
                              onChange={(e) =>
                                update(
                                  "videos",
                                  p.videos.map((x, j) =>
                                    j === i
                                      ? {
                                          ...x,
                                          embed_allowed: e.target.checked,
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                            Incorporação autorizada (somente YouTube)
                          </label>
                          <label>
                            Tags do vídeo
                            <input
                              value={v.tags.join(", ")}
                              onChange={(e) =>
                                update(
                                  "videos",
                                  p.videos.map((x, j) =>
                                    j === i
                                      ? {
                                          ...x,
                                          tags: e.target.value
                                            .split(",")
                                            .map((t) => t.trim())
                                            .filter(Boolean),
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </label>
                        </div>
                        {v.timestamps.map((t, j) => (
                          <div className="meta-edit-row" key={j}>
                            <label>
                              Posição em segundos
                              <input
                                type="number"
                                min="0"
                                max="86400"
                                value={t.seconds}
                                onChange={(e) =>
                                  update(
                                    "videos",
                                    p.videos.map((x, k) =>
                                      k === i
                                        ? {
                                            ...x,
                                            timestamps: x.timestamps.map(
                                              (y, n) =>
                                                n === j
                                                  ? {
                                                      ...y,
                                                      seconds: Number(
                                                        e.target.value,
                                                      ),
                                                    }
                                                  : y,
                                            ),
                                          }
                                        : x,
                                    ),
                                  )
                                }
                              />
                            </label>
                            <label>
                              Descrição do trecho
                              <input
                                value={t.label}
                                onChange={(e) =>
                                  update(
                                    "videos",
                                    p.videos.map((x, k) =>
                                      k === i
                                        ? {
                                            ...x,
                                            timestamps: x.timestamps.map(
                                              (y, n) =>
                                                n === j
                                                  ? {
                                                      ...y,
                                                      label: e.target.value,
                                                    }
                                                  : y,
                                            ),
                                          }
                                        : x,
                                    ),
                                  )
                                }
                              />
                            </label>
                            <button
                              className="button"
                              onClick={() =>
                                update(
                                  "videos",
                                  p.videos.map((x, k) =>
                                    k === i
                                      ? {
                                          ...x,
                                          timestamps: x.timestamps.filter(
                                            (_, n) => n !== j,
                                          ),
                                        }
                                      : x,
                                  ),
                                )
                              }
                            >
                              Remover trecho
                            </button>
                          </div>
                        ))}
                        <button
                          className="button"
                          onClick={() =>
                            update(
                              "videos",
                              p.videos.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      timestamps: [
                                        ...x.timestamps,
                                        { seconds: 0, label: "" },
                                      ],
                                    }
                                  : x,
                              ),
                            )
                          }
                        >
                          Adicionar timestamp
                        </button>
                        <button
                          className="button"
                          onClick={() =>
                            update(
                              "videos",
                              p.videos.filter((_, j) => j !== i),
                            )
                          }
                        >
                          Remover vídeo {i + 1}
                        </button>
                      </fieldset>
                    ))}
                    <button
                      className="button"
                      onClick={() =>
                        update("videos", [
                          ...p.videos,
                          {
                            title: "",
                            creator: "",
                            url: "",
                            description: "",
                            source_url: "",
                            authorization: "",
                            embed_allowed: false,
                            tags: [],
                            timestamps: [],
                          },
                        ])
                      }
                    >
                      Adicionar vídeo
                    </button>
                  </section>
                  <section>
                    <h3>Vínculos com treinamento e artigos</h3>
                    {p.links.map((l, i) => (
                      <div className="meta-edit-row" key={i}>
                        <label>
                          Tipo de vínculo
                          <select
                            value={l.target_kind}
                            onChange={(e) =>
                              update(
                                "links",
                                p.links.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        target_kind: e.target
                                          .value as typeof l.target_kind,
                                        target_id: "",
                                      }
                                    : x,
                                ),
                              )
                            }
                          >
                            <option value="exercise">Exercício</option>
                            <option value="article">Artigo / aula</option>
                            <option value="tournament">Campeonato</option>
                            <option value="competency">Habilidade</option>
                          </select>
                        </label>
                        <label>
                          Conteúdo público
                          {l.target_kind === "competency" ? (
                            <select
                              value={l.target_id}
                              onChange={(e) =>
                                update(
                                  "links",
                                  p.links.map((x, j) =>
                                    j === i
                                      ? { ...x, target_id: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            >
                              <option value="">Selecionar habilidade</option>
                              {skills
                                .filter(
                                  (skill) =>
                                    skill.mode === "both" ||
                                    skill.mode ===
                                      (c.modes.find(
                                        (m) =>
                                          m.id ===
                                          c.contexts.find(
                                            (x) => x.id === p.context_id,
                                          )?.mode_id,
                                      )?.construction
                                        ? "build"
                                        : "zero"),
                                )
                                .map((skill) => (
                                  <option key={skill.id} value={skill.id}>
                                    {skill.title}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <select
                              value={l.target_id}
                              onChange={(e) =>
                                update(
                                  "links",
                                  p.links.map((x, j) =>
                                    j === i
                                      ? { ...x, target_id: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            >
                              <option value="">Selecionar</option>
                              {(l.target_kind === "exercise"
                                ? s.catalog.exercises
                                : l.target_kind === "article"
                                  ? s.catalog.articles
                                  : s.catalog.tournaments
                              )
                                .filter((x) => x.published)
                                .map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.title}
                                  </option>
                                ))}
                            </select>
                          )}
                        </label>
                        <label>
                          Relação e finalidade
                          <input
                            value={l.reason}
                            onChange={(e) =>
                              update(
                                "links",
                                p.links.map((x, j) =>
                                  j === i
                                    ? { ...x, reason: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                        <button
                          className="button"
                          onClick={() =>
                            update(
                              "links",
                              p.links.filter((_, j) => j !== i),
                            )
                          }
                        >
                          Remover vínculo {i + 1}
                        </button>
                      </div>
                    ))}
                    <button
                      className="button"
                      onClick={() =>
                        update("links", [
                          ...p.links,
                          {
                            target_kind: "exercise",
                            target_id: "",
                            reason: "",
                          },
                        ])
                      }
                    >
                      Adicionar vínculo
                    </button>
                  </section>
                </>
              )}
              <div className="meta-editor-actions publishing-actions">
                <button
                  disabled={busy}
                  className="button"
                  onClick={() => void save("draft")}
                >
                  Salvar rascunho
                </button>
                <button
                  disabled={busy}
                  className="button primary"
                  onClick={() => void save("review")}
                >
                  Enviar para revisão
                </button>
                <button
                  disabled={busy || dirty || d?.status !== "review"}
                  className="button primary"
                  onClick={() => setConfirm("publish")}
                >
                  Publicar conteúdo
                </button>
                {d?.status === "published" && (
                  <button
                    disabled={busy || dirty}
                    className="button"
                    onClick={() => setConfirm("withdraw")}
                  >
                    Retirar publicação e arquivar
                  </button>
                )}
                <button
                  disabled={busy}
                  className="button"
                  onClick={() => {
                    setP(d?.payload || null);
                    setDirty(false);
                    setConfirm(null);
                  }}
                >
                  Descartar alterações locais
                </button>
              </div>
              {confirm && d && (
                <section className="notice" role="alert">
                  <h3>
                    {confirm === "publish"
                      ? "Confirmar publicação"
                      : "Confirmar retirada específica"}
                  </h3>
                  <p>
                    {p.title} · {p.context_id}.{" "}
                    {confirm === "withdraw"
                      ? "A página pública será retirada e uma revisão arquivada será registrada."
                      : "A edição anterior será preservada e as relações serão validadas no servidor."}
                  </p>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const id = await publishDraft(
                          d,
                          confirm === "withdraw",
                        );
                        const r = await refresh();
                        const saved = r.ds.find((x) => x.id === d.id)!;
                        setD(saved);
                        setP(saved.payload);
                        setConfirm(null);
                        setDirty(false);
                        setNotice(
                          confirm === "withdraw"
                            ? "Publicação retirada e histórico preservado."
                            : "Conteúdo publicado.",
                        );
                        if (confirm === "publish")
                          setNotice("Conteúdo publicado: " + id);
                      })
                    }
                  >
                    Confirmar{" "}
                    {confirm === "publish" ? "publicação" : "retirada"}
                  </button>
                  <button className="button" onClick={() => setConfirm(null)}>
                    Cancelar
                  </button>
                </section>
              )}
              {d?.published_entry_id && d.status === "published" && (
                <Link
                  className="button"
                  to={"/competitive/meta/" + d.published_entry_id}
                >
                  Ver página pública
                </Link>
              )}
              {d && (
                <section>
                  <h3>Histórico editorial</h3>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void action(async () =>
                        setRevisions(await draftHistory(d.id)),
                      )
                    }
                  >
                    Consultar revisões
                  </button>
                  {revisions.map((r) => (
                    <div className="meta-edit-row" key={r.version}>
                      <p>
                        v{r.version} ·{" "}
                        {workflow[r.status as keyof typeof workflow]} ·{" "}
                        {new Date(r.created_at).toLocaleString("pt-BR")} ·
                        Editor {r.actor_id || "Conta excluída"}
                      </p>
                      <button
                        className="button"
                        disabled={busy || dirty}
                        onClick={() =>
                          void action(async () => {
                            const x = await restoreDraft(d, r.version);
                            setD(x);
                            setP(x.payload);
                            await refresh();
                            setNotice(
                              "Revisão recuperada como rascunho. Revise antes de publicar.",
                            );
                          })
                        }
                      >
                        Restaurar v{r.version} como rascunho
                      </button>
                    </div>
                  ))}
                </section>
              )}
            </>
          ) : (
            <Empty title="Selecione ou crie um conteúdo">
              O editor permite combinar texto, características, mídia, fontes e
              exercícios sem editar JSON.
            </Empty>
          )}
        </section>
      </div>
    </>
  );
}
