import { AcademyQuestionsEditor } from "../components/AcademyQuestionsEditor";
import type { Question } from "../lib/academy";
import { prerequisiteIssues } from "../lib/curriculum";
import { ExerciseResearchEditor } from "../components/ExerciseResearchEditor";
import { reviewPending, type ExerciseResearch } from "../lib/training-research";
import { EditorialRevisions } from "../components/EditorialRevisions";
import { topics } from "../lib/competitive";
import { isStale } from "../lib/logic";
import { Link } from "react-router-dom";
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
import { catalogIssues } from "../lib/development";
type Table = "exercises" | "articles" | "tournaments";
type Row = Exercise | Article | Tournament;
const names = {
  exercises: "Exercícios",
  articles: "Notícias e aulas",
  tournaments: "Campeonatos",
};
const fieldNames: Record<string, string> = {
  curriculum:
    "Currículo estruturado (JSON; nível 0–5, modalidades, pré-requisitos, fontes e avaliação)",
  topic: "Tema editorial",
  tags: "Tags separadas por vírgula",
  evidence: "Natureza da fonte",
  source_published_at: "Publicação original da fonte",
  confirmation: "Confirmação",
  season_label: "Temporada",
  phases:
    "Fases (JSON estruturado: key, title, kind, date, starts_at, ends_at, status, source_url, verified_at, valid_until)",
  result_summary: "Resultado confirmado (opcional)",
  result_source_url: "Fonte do resultado (opcional)",
  result_verified_at: "Verificação do resultado (opcional)",
  skills: "Habilidades separadas por vírgula",
  competitive_goal: "Objetivo competitivo",
  map_type: "Tipo de mapa",
  requirements: "Recursos necessários",
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
  topic: Object.keys(topics),
  evidence: ["official", "analysis", "opinion"],
  confirmation: ["confirmed", "unconfirmed"],
  mode: ["build", "zero", "both"],
  level: ["beginner", "intermediate", "advanced"],
  kind: ["news", "analysis", "lesson"],
  status: ["scheduled", "finished", "postponed", "cancelled"],
};
export default function Admin() {
  const s = useStore();
  const [dueOnly, setDueOnly] = useState(false);
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
  const integrity = catalogIssues(s.editorial);
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
            research: null,
            skills: [],
            competitive_goal: "",
            map_type: "",
            requirements: "",
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
              curriculum: null,
              academy_questions: [],
              topic: "competitive",
              tags: [],
              evidence: "official",
              source_published_at: null,
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
              confirmation: "unconfirmed",
              season_label: "",
              phases: [],
              result_summary: null,
              result_source_url: null,
              result_verified_at: null,
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
    let input = edit;
    try {
      if (edit) {
        input = { ...edit };
        for (const key of ["phases", "measurement", "curriculum"])
          if (typeof edit[key] === "string")
            input[key] = JSON.parse(edit[key] as string);
      }
    } catch {
      setValidation("Campo estruturado: JSON inválido. Não salvei o registro.");
      return;
    }
    const result = schema.safeParse(input);
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
    if (table === "articles") {
      const article = result.data as Article;
      const issues = prerequisiteIssues([
        ...s.catalog.articles.filter((a) => a.id !== article.id),
        article,
      ]);
      if (issues.length) {
        setValidation(issues.join(" "));
        return;
      }
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
      <Link className="button" to="/admin/academy">
        Organizar trilhas da Academy
      </Link>
      <Link className="button" to="/admin/ai">
        Inteligência Artificial
      </Link>
      <Link className="button" to="/admin/meta">
        Gerenciar Meta
      </Link>
      <div className="tabs page-tabs admin-section-index">
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
      {table === "exercises" && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(e) => setDueOnly(e.target.checked)}
          />
          Somente exercícios com revisão pendente ou vencida
        </label>
      )}
      <details className="panel">
        <summary>
          Integridade dos vínculos editoriais · {integrity.length} alertas
        </summary>
        <p>
          Diagnóstico do catálogo carregado: fontes, datas e vínculos entre
          aulas e exercícios. Não verifica disponibilidade de páginas externas
          nem altera registros automaticamente.
        </p>
        {integrity.length ? (
          <ul>
            {integrity.map((i) => (
              <li key={i.key}>
                <strong>{i.title}</strong>: {i.detail}{" "}
                <Link to={i.to}>Revisar conteúdo</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Nenhuma inconsistência encontrada nestes metadados. Isso não
            confirma a atualidade das fontes externas.
          </p>
        )}
      </details>
      <section className="panel">
        {s.editorial[table]
          .filter(
            (row) =>
              !dueOnly ||
              table !== "exercises" ||
              reviewPending(row as Exercise),
          )
          .map((row) => (
            <div className="list-row editorial-admin-record" key={row.id}>
              <div>
                <strong>{row.title}</strong>
                <small>
                  Verificação:{" "}
                  {new Date(row.verified_at).toLocaleDateString("pt-BR")}
                </small>
              </div>
              {(table === "exercises"
                ? reviewPending(row as Exercise)
                : isStale(
                    row.verified_at,
                    "valid_until" in row ? row.valid_until : null,
                  )) && <Badge>Revisão pendente</Badge>}
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
            {table === "articles" && !edit.curriculum && (
              <button
                type="button"
                className="button"
                onClick={() =>
                  setEdit({
                    ...edit,
                    kind: "lesson",
                    curriculum: {
                      version: "editorial-1",
                      level: 0,
                      domain: "foundations",
                      modes: ["build", "zero"],
                      experience: "all",
                      phase: "foundation",
                      prerequisites: [],
                      objectives: ["Descrever o objetivo desta aula."],
                      assessment: ["Explicar uma decisão observável."],
                      exercise_ids: [],
                      competency_ids: [],
                      classification: "editorial",
                      meta_scope:
                        "Defina modalidade, versão e limites de aplicação antes de publicar.",
                      sources: [
                        {
                          title: "Fonte a verificar",
                          url: "https://www.fortnite.com/competitive",
                          kind: "official",
                          access: "page",
                          supports:
                            "Substitua pela fonte e pelo alcance efetivamente consultados.",
                        },
                      ],
                    },
                  })
                }
              >
                Adicionar estrutura curricular à aula
              </button>
            )}
            {table === "articles" && Boolean(edit.curriculum) && (
              <AcademyQuestionsEditor
                questions={(edit.academy_questions || []) as Question[]}
                onChange={(academy_questions) =>
                  setEdit({ ...edit, academy_questions })
                }
              />
            )}
            <div className="form-grid">
              {Object.entries(edit)
                .filter(
                  ([key]) =>
                    ![
                      "id",
                      "published",
                      "research",
                      "academy_questions",
                    ].includes(key),
                )
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
                    "result_summary",
                    "body",
                    "instructions",
                    "rules",
                    "description",
                    "summary",
                  ].includes(key);
                  return (
                    <label key={key}>
                      {fieldNames[key] || key}
                      {["phases", "measurement", "curriculum"].includes(key) ? (
                        <textarea
                          rows={12}
                          value={
                            typeof value === "string"
                              ? value
                              : JSON.stringify(value, null, 2)
                          }
                          onChange={(e) =>
                            setEdit({ ...edit, [key]: e.target.value })
                          }
                        />
                      ) : ["tags", "skills", "categories"].includes(key) ? (
                        <input
                          value={
                            Array.isArray(value)
                              ? value.join(", ")
                              : String(value || "")
                          }
                          onChange={(e) =>
                            setEdit({
                              ...edit,
                              [key]: e.target.value
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      ) : choices ? (
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
                          required={key !== "result_summary"}
                          value={String(value ?? "")}
                          onChange={(e) =>
                            setEdit({
                              ...edit,
                              [key]:
                                key === "result_summary" && !e.target.value
                                  ? null
                                  : e.target.value,
                            })
                          }
                        />
                      ) : (
                        <input
                          required={
                            ![
                              "result_source_url",
                              "result_verified_at",
                              "source_published_at",
                              "season_label",
                              "competitive_goal",
                              "map_type",
                              "requirements",
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
                                  "result_source_url",
                                  "result_verified_at",
                                  "source_published_at",
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
            {table === "exercises" && (
              <ExerciseResearchEditor
                value={edit.research as ExerciseResearch | null}
                mode={String(edit.mode)}
                onChange={(research) => setEdit({ ...edit, research })}
              />
            )}
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
            <EditorialRevisions table={table} id={String(edit.id)} />
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
