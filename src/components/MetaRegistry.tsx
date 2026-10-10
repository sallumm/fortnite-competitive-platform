import { useEffect, useState, type FormEvent } from "react";
import type { MetaCatalog } from "../lib/meta";
import { metaSourceSchema, metaKey } from "../lib/meta";
import { safeHttps } from "../lib/meta-editorial";
import { loadSeasons, registerMeta } from "../lib/meta-editorial-service";
const definitions = {
  seasons: ["title"],
  versions: ["season", "patch", "released_on"],
  modes: ["title", "construction"],
  formats: ["title", "size"],
  contexts: [
    "version_id",
    "mode_id",
    "format_id",
    "play_context",
    "region",
    "event_key",
  ],
  sources: [
    "title",
    "url",
    "kind",
    "access",
    "published_on",
    "verified_at",
    "limitations",
  ],
} as const;
const labels: Record<string, string> = {
  title: "Nome",
  season: "Temporada",
  patch: "Patch",
  released_on: "Data de lançamento (opcional)",
  construction: "Possui construção",
  size: "Jogadores por equipe (opcional)",
  version_id: "Versão",
  mode_id: "Modalidade",
  format_id: "Formato",
  play_context: "Contexto de jogo",
  region: "Região (unspecified quando ausente)",
  event_key: "Identificador do evento (somente torneios)",
  url: "URL da fonte",
  kind: "Natureza da fonte",
  access: "Material efetivamente consultado",
  published_on: "Publicação da fonte (opcional)",
  verified_at: "Verificação",
  limitations: "Limitações da fonte",
};
export function MetaRegistry({
  catalog,
  onSaved,
}: {
  catalog: MetaCatalog;
  onSaved: () => Promise<void>;
}) {
  const [seasons, setSeasons] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    let active = true;
    loadSeasons()
      .then((x) => {
        if (active) setSeasons(x);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [catalog]);
  const [table, setTable] = useState<keyof typeof definitions>("seasons"),
    [values, setValues] = useState<Record<string, string>>({}),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const selects: Record<string, { id: string; title: string }[]> = {
    version_id: catalog.versions.map((x) => ({
      id: x.id,
      title: x.season + " · " + x.patch,
    })),
    mode_id: catalog.modes,
    format_id: catalog.formats,
    play_context: ["casual", "ranked", "tournament"].map((id, i) => ({
      id,
      title: ["Casual", "Ranqueado", "Torneio"][i],
    })),
    kind: ["official", "professional", "analysis", "editorial"].map(
      (id, i) => ({
        id,
        title: ["Oficial", "Profissional", "Análise", "Editorial"][i],
      }),
    ),
    access: [
      "page",
      "listing",
      "metadata",
      "transcript",
      "audiovisual",
      "unavailable",
    ].map((id, i) => ({
      id,
      title: [
        "Texto de página",
        "Listagem",
        "Somente metadados",
        "Transcrição",
        "Análise audiovisual",
        "Indisponível",
      ][i],
    })),
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const row: Record<string, unknown> = { id: metaKey.parse(values.id) };
      for (const k of definitions[table])
        row[k] =
          k === "construction"
            ? values[k] === "true"
            : k === "size"
              ? values[k]
                ? Number(values[k])
                : null
              : ["released_on", "published_on", "event_key"].includes(k)
                ? values[k] || null
                : k === "verified_at"
                  ? new Date(values[k]).toISOString()
                  : values[k] || "";
      if (table === "sources") {
        metaSourceSchema.parse(row);
        safeHttps.parse(row.url);
      }
      await registerMeta(table, row);
      setValues({});
      setNotice("Cadastro salvo no banco.");
      await onSaved();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Cadastro não salvo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Temporadas, contextos e fontes</h2>
      <p>
        Cadastre apenas dados verificados. Use identificadores estáveis;
        correções de conhecimento são publicadas como novas revisões. Uma
        modalidade cadastrada não confirma que todo item existe nela.
      </p>
      <form onSubmit={submit} className="meta-editor-fields">
        <label>
          Cadastro
          <select
            value={table}
            onChange={(e) => {
              setTable(e.target.value as keyof typeof definitions);
              setValues({});
              setNotice("");
            }}
          >
            {Object.keys(definitions).map((k, i) => (
              <option key={k} value={k}>
                {
                  [
                    "Temporada",
                    "Atualização / versão",
                    "Modalidade",
                    "Formato de equipe",
                    "Contexto de consulta",
                    "Fonte",
                  ][i]
                }
              </option>
            ))}
          </select>
        </label>
        <label>
          Identificador estável
          <input
            required
            pattern="[a-z0-9][a-z0-9-]{1,99}"
            value={values.id || ""}
            onChange={(e) => setValues({ ...values, id: e.target.value })}
            placeholder="c7s4-override"
          />
        </label>
        {definitions[table].map((k) => (
          <label key={k}>
            {labels[k]}
            {k === "construction" ? (
              <select
                value={values[k] || "false"}
                onChange={(e) => setValues({ ...values, [k]: e.target.value })}
              >
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </select>
            ) : selects[k] ? (
              <select
                required
                value={values[k] || ""}
                onChange={(e) => setValues({ ...values, [k]: e.target.value })}
              >
                <option value="">Selecionar</option>
                {selects[k].map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            ) : k === "limitations" ? (
              <textarea
                required
                value={values[k] || ""}
                onChange={(e) => setValues({ ...values, [k]: e.target.value })}
              />
            ) : (
              <input
                required={
                  ![
                    "released_on",
                    "published_on",
                    "event_key",
                    "size",
                  ].includes(k)
                }
                type={
                  k === "verified_at"
                    ? "datetime-local"
                    : ["released_on", "published_on"].includes(k)
                      ? "date"
                      : k === "size"
                        ? "number"
                        : k === "url"
                          ? "url"
                          : "text"
                }
                value={values[k] || ""}
                onChange={(e) => setValues({ ...values, [k]: e.target.value })}
                list={k === "season" ? "meta-known-seasons" : undefined}
              />
            )}
          </label>
        ))}
        <datalist id="meta-known-seasons">
          {seasons.map((x) => (
            <option key={x.id} value={x.title} />
          ))}
        </datalist>
        <button disabled={busy} className="button primary">
          {busy ? "Salvando…" : "Salvar cadastro"}
        </button>
        <p role="status">{notice}</p>
      </form>
    </section>
  );
}
