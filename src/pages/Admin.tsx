import { useState, type FormEvent } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useStore } from "../lib/store";
import {
  articleSchema,
  exerciseSchema,
  tournamentSchema,
} from "../lib/validation";
import type { Article, Exercise, Tournament } from "../lib/types";
import { labels } from "../lib/types";
import { Badge, Empty, Heading, Modal } from "../components/ui";
type Table = "exercises" | "articles" | "tournaments";
type Row = Exercise | Article | Tournament;
const names = {
  exercises: "Exercícios",
  articles: "Notícias e aulas",
  tournaments: "Campeonatos",
};
const fieldNames: Record<string, string> = {
  title: "Título",
  slug: "Identificador da página",
  creator: "Criador",
  map_code: "Código da ilha (opcional)",
  category: "Categoria",
  mode: "Modalidade",
  level: "Dificuldade",
  description: "Descrição",
  instructions: "Instruções",
  metric: "Métrica de acompanhamento",
  source_url: "Fonte HTTPS",
  verified_at: "Data da verificação",
  kind: "Tipo de conteúdo",
  summary: "Resumo",
  body: "Conteúdo",
  author: "Autor",
  published_at: "Publicação (pode ser futura)",
  valid_until: "Revisar até",
  region: "Região",
  format: "Formato",
  start_date: "Data inicial",
  end_date: "Data final",
  starts_at: "Início com horário (opcional)",
  ends_at: "Fim com horário (opcional)",
  status: "Status",
  rules: "Regras e participação",
  prize: "Premiação",
};
const options: Record<string, string[]> = {
  mode: ["build", "zero", "both"],
  level: ["beginner", "intermediate", "advanced"],
  kind: ["news", "analysis", "lesson"],
  status: ["scheduled", "finished", "postponed", "cancelled"],
};
export default function Admin() {
  const s = useStore();
  const [table, setTable] = useState<Table>("exercises");
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null);
  const [validation, setValidation] = useState("");
  const [remove, setRemove] = useState<string | null>(null);
  if (!s.admin || s.demo)
    return (
      <Empty title="Acesso administrativo restrito">
        Uma conta com papel administrativo atribuído no banco é necessária.
      </Empty>
    );
  const create = () => {
    const now = new Date().toISOString();
    const common = {
      id: crypto.randomUUID(),
      title: "",
      published: false,
      source_url: "",
      verified_at: now,
    };
    const defaults =
      table === "exercises"
        ? {
            creator: "",
            map_code: null,
            category: "aim",
            mode: "both",
            level: "beginner",
            description: "",
            instructions: "",
            metric: "",
          }
        : table === "articles"
          ? {
              slug: "",
              kind: "news",
              category: "fncs",
              summary: "",
              body: "",
              author: "Redação",
              published_at: now,
              valid_until: new Date(Date.now() + 7 * 864e5).toISOString(),
            }
          : {
              slug: "",
              category: "FNCS",
              mode: "build",
              region: "BR",
              format: "Solo",
              start_date: now.slice(0, 10),
              end_date: now.slice(0, 10),
              starts_at: null,
              ends_at: null,
              status: "scheduled",
              description: "",
              rules: "",
              prize: "Não confirmada.",
              valid_until: new Date(Date.now() + 864e5).toISOString(),
            };
    setEdit({ ...common, ...defaults });
    setValidation("");
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const schema =
      table === "exercises"
        ? exerciseSchema
        : table === "articles"
          ? articleSchema
          : tournamentSchema;
    const result = schema.safeParse(edit);
    if (!result.success) {
      setValidation(
        result.error.issues
          .map(
            (x) =>
              `${fieldNames[String(x.path[0])] || "Registro"}: ${x.message}`,
          )
          .join(" "),
      );
      return;
    }
    s.run(async () => {
      await s.saveEditorial(table, result.data as Row);
      setEdit(null);
    });
  };
  return (
    <>
      <Heading
        eyebrow="PAINEL EDITORIAL"
        title="Informação que merece confiança."
        description="Gerencie catálogo, aulas e eventos. Alterações são autorizadas e auditadas no banco."
        action={
          <button className="button primary" onClick={create}>
            <Plus size={16} />
            Novo registro
          </button>
        }
      />
      <div className="tabs page-tabs">
        {(["exercises", "articles", "tournaments"] as Table[]).map((t) => (
          <button
            key={t}
            aria-pressed={table === t}
            onClick={() => {
              setTable(t);
              setEdit(null);
            }}
          >
            {names[t]}
          </button>
        ))}
      </div>
      <div className="alert">
        Publique somente após conferir a fonte. Data de revisão não significa
        sincronização automática. Não cadastre horários sem identificar o fuso
        de origem.
      </div>
      <section className="panel">
        {s.editorial[table].map((row) => (
          <div className="list-row" key={row.id}>
            <div>
              <strong>{row.title}</strong>
              <small>
                Verificação:{" "}
                {new Date(row.verified_at).toLocaleDateString("pt-BR")}
              </small>
            </div>
            <Badge tone={row.published ? "green" : "neutral"}>
              {row.published ? "Publicado / agendado" : "Rascunho"}
            </Badge>
            <button
              className="icon-button"
              aria-label={`Editar ${row.title}`}
              onClick={() => {
                setEdit(
                  structuredClone(row) as unknown as Record<string, unknown>,
                );
                setValidation("");
              }}
            >
              <Edit3 size={16} />
            </button>
            <button
              className="icon-button danger"
              aria-label={`Excluir ${row.title}`}
              onClick={() => setRemove(row.id)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Indicadores agregados</h2>
        <p>
          Não há coleta analítica agregada ativa nesta versão. O painel não
          acessa históricos privados de jogadores.
        </p>
        <p className="muted small-text">
          Configurações de comunidade e endereço público são definidas na
          instalação. Diretório profissional, resultados avançados e automação
          editorial estão previstos na arquitetura.
        </p>
      </section>
      {edit && (
        <Modal
          title={`Editar ${names[table].toLowerCase()}`}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={submit}>
            <div className="form-grid">
              {Object.entries(edit)
                .filter(([key]) => !["id", "published"].includes(key))
                .map(([key, value]) => {
                  const choices =
                    key === "category" && table !== "tournaments"
                      ? [
                          "aim",
                          "mechanics",
                          "piece",
                          "competitive",
                          "decisions",
                          "vod",
                          "wellbeing",
                          ...(table === "articles" ? ["fncs"] : []),
                        ]
                      : options[key];
                  const long = [
                    "body",
                    "instructions",
                    "rules",
                    "description",
                    "summary",
                  ].includes(key);
                  return (
                    <label key={key}>
                      {fieldNames[key] || key}
                      {choices ? (
                        <select
                          value={String(value)}
                          onChange={(e) =>
                            setEdit({ ...edit, [key]: e.target.value })
                          }
                        >
                          {choices.map((o) => (
                            <option value={o} key={o}>
                              {labels[o] ||
                                (
                                  {
                                    news: "Notícia",
                                    analysis: "Análise",
                                    lesson: "Aula",
                                    scheduled: "Programado",
                                    finished: "Finalizado",
                                    postponed: "Adiado",
                                    cancelled: "Cancelado",
                                  } as Record<string, string>
                                )[o] ||
                                o}
                            </option>
                          ))}
                        </select>
                      ) : long ? (
                        <textarea
                          rows={key === "body" ? 8 : 3}
                          required
                          value={String(value ?? "")}
                          onChange={(e) =>
                            setEdit({ ...edit, [key]: e.target.value })
                          }
                        />
                      ) : (
                        <input
                          required={
                            ![
                              "map_code",
                              "starts_at",
                              "ends_at",
                              "valid_until",
                            ].includes(key)
                          }
                          type={
                            key.endsWith("_date")
                              ? "date"
                              : key.endsWith("_at") || key === "valid_until"
                                ? "datetime-local"
                                : key === "source_url"
                                  ? "url"
                                  : "text"
                          }
                          value={
                            key.endsWith("_at") || key === "valid_until"
                              ? value
                                ? new Date(
                                    new Date(String(value)).getTime() -
                                      new Date(
                                        String(value),
                                      ).getTimezoneOffset() *
                                        60000,
                                  )
                                    .toISOString()
                                    .slice(0, 16)
                                : ""
                              : String(value ?? "")
                          }
                          onChange={(e) =>
                            setEdit({
                              ...edit,
                              [key]:
                                e.target.value === "" &&
                                [
                                  "map_code",
                                  "starts_at",
                                  "ends_at",
                                  "valid_until",
                                ].includes(key)
                                  ? null
                                  : key.endsWith("_at") || key === "valid_until"
                                    ? new Date(e.target.value).toISOString()
                                    : e.target.value,
                            })
                          }
                        />
                      )}
                    </label>
                  );
                })}
            </div>
            <p className="muted small-text">
              Campos com horário usam o fuso deste navegador e são salvos em
              UTC.
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(edit.published)}
                onChange={(e) =>
                  setEdit({ ...edit, published: e.target.checked })
                }
              />
              Registro revisado e autorizado para publicação
            </label>
            {validation && (
              <div role="alert" className="alert error">
                {validation}
              </div>
            )}
            <button className="button primary full" disabled={s.busy}>
              Salvar registro
            </button>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal
          title="Excluir registro editorial?"
          onClose={() => setRemove(null)}
        >
          <p>
            O histórico de alterações permanece no banco para auditoria.
            Registros referenciados podem exigir despublicação em vez de
            exclusão.
          </p>
          <button
            disabled={s.busy}
            className="button danger"
            onClick={() =>
              s.run(async () => {
                await s.deleteEditorial(table, remove);
                setRemove(null);
              })
            }
          >
            Excluir registro
          </button>
        </Modal>
      )}
    </>
  );
}
