import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Heading, Badge, Modal, Empty } from "../components/ui";
import { Brand } from "../components/brand/Brand";
import { ProgressIndicator } from "../components/experience/primitives";
import {
  Field,
  CheckField,
  Form,
  formObject,
  localDate,
  isoDate,
} from "./EsportsAdmin";
import { useStore } from "../lib/store";
import { useEsportsQuery } from "../lib/esports/useEsportsQuery";
import {
  benefitLabels,
  loadDevelopment,
  loadDevelopmentAdmin,
  developmentAction,
  type Scholarship,
  type Goal,
} from "../lib/esports/development";
import { esportsRPC } from "../lib/esports/service";
const goalLabels = {
  study: "Estudo",
  exercise: "Exercício",
  vod: "VOD Review",
  review: "Avaliação",
  activity: "Atividade organizada",
};
const states = {
  planned: "Planejada",
  in_progress: "Em andamento",
  completed: "Concluída (autodeclarada)",
};
export default function EsportsDevelopment() {
  const location = useLocation(),
    adminView = location.pathname.startsWith("/admin/"),
    query = new URLSearchParams(location.search),
    s = useStore();
  const { data, error, loading, refresh } = useEsportsQuery(
    adminView ? loadDevelopmentAdmin : loadDevelopment,
  );
  const [selected, setSelected] = useState<Scholarship | null>(null),
    [goal, setGoal] = useState<Goal | null | undefined>(),
    [goalScholar, setGoalScholar] = useState(""),
    [filter, setFilter] = useState("");
  const act = async (
    action: string,
    id: string | null,
    version: number,
    p: unknown,
  ) => {
    await developmentAction(action, id, version, p);
    await refresh();
    setSelected(null);
  };
  return (
    <>
      <Heading
        eyebrow="kyrven development"
        title={adminView ? "Gestão de desenvolvimento" : "Meu desenvolvimento"}
        description="Apoio temporário, metas individuais e avaliação humana. Bolsa não é contratação, assinatura paga ou garantia de ingresso no elenco."
      />
      <div className="row wrap">
        <Link
          className="text-link"
          to={adminView ? "/admin/esports" : "/app/esports"}
        >
          Voltar ao espaço esports
        </Link>
        <Link className="button" to="/app/planner">
          Planejador pessoal
        </Link>
        <Link className="button" to="/app/week">
          Meu calendário
        </Link>
        <Link className="button" to="/app/vod">
          VOD Review pessoal
        </Link>
        <Link className="button" to="/app/reports">
          Meus relatórios
        </Link>
      </div>
      {loading && <p role="status">Consultando desenvolvimento…</p>}
      {error && (
        <p role="alert" className="alert">
          {error}
          <button onClick={() => void refresh()}>Tentar novamente</button>
        </p>
      )}
      {data && (
        <>
          <section className="panel">
            <Brand division="development" />
            <h2>
              {adminView
                ? "Acompanhamento com responsabilidade"
                : "Condições e acesso"}
            </h2>
            <p>
              Somente informações do programa são compartilhadas com avaliadores
              designados. Treinos pessoais, diário, conversas com IA e
              relatórios individuais não são abertos por este cargo.
            </p>
            <p>
              Trialist, bolsa, Academy Roster e elenco profissional têm decisões
              diferentes. Não existem pagamentos ou assinaturas geradas por uma
              bolsa.
            </p>
            {!adminView &&
              data.benefits.map((b) => (
                <p key={b.scholarship_id + b.capability}>
                  <Badge>{benefitLabels[b.capability]}</Badge> Até{" "}
                  {new Date(b.ends_at).toLocaleString("pt-BR")} · Origem: bolsa
                </p>
              ))}
          </section>
          {adminView && data.admin && (
            <section className="panel">
              <h2>Oferecer bolsa após avaliação humana</h2>
              <p>
                A candidatura deve ter avaliação concluída e registro prático.
                Recursos comerciais Pro ainda não estão habilitados. Os
                benefícios abaixo usam ferramentas existentes e o acompanhamento
                configurado.
              </p>
              <Form
                save={(f) =>
                  act(
                    "offer",
                    String(f.get("application_id")),
                    Number(f.get("expected")),
                    {
                      ...formObject(f),
                      benefits: f.getAll("benefits"),
                      starts_at: isoDate(f.get("starts_at")),
                      ends_at: isoDate(f.get("ends_at")),
                    },
                  )
                }
              >
                <Field
                  name="application_id"
                  label="UUID da candidatura"
                  defaultValue={query.get("application_id") || ""}
                />
                <Field
                  name="expected"
                  label="Versão atual da candidatura"
                  type="number"
                  defaultValue={query.get("version") || ""}
                />
                <Field name="title" label="Título da bolsa" />
                <Field
                  name="terms"
                  label="Condições revisadas, duração e limites"
                  multiline
                />
                <fieldset>
                  <legend>Benefícios que serão concedidos</legend>
                  {Object.entries(benefitLabels).map(([v, l]) => (
                    <label className="checkbox" key={v}>
                      <input
                        type="checkbox"
                        name="benefits"
                        value={v}
                        defaultChecked={v === "development_workspace"}
                      />
                      {l}
                    </label>
                  ))}
                </fieldset>
                <Field
                  name="human_availability"
                  label="Disponibilidade humana confirmada (obrigatória para feedback humano)"
                  required={false}
                  multiline
                />
                <Field
                  name="starts_at"
                  label="Início"
                  type="datetime-local"
                  defaultValue={localDate(new Date().toISOString())}
                />
                <Field name="ends_at" label="Fim" type="datetime-local" />
              </Form>
            </section>
          )}
          {!data.scholarships.length && (
            <Empty title="Nenhuma bolsa registrada">
              Ofertas e benefícios só aparecem após decisão da direção. Nada é
              concedido automaticamente por pontuação.
            </Empty>
          )}
          {adminView && (
            <label>
              Filtrar bolsa ou UUID de candidatura
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
          )}
          {data.scholarships
            .filter((b) =>
              (b.title + " " + b.application_id + " " + b.user_id)
                .toLowerCase()
                .includes(filter.toLowerCase()),
            )
            .map((b) => {
              const gs = data.goals.filter((g) => g.scholarship_id === b.id),
                rs = data.reviews.filter((r) => r.scholarship_id === b.id),
                expired = Date.parse(b.ends_at) <= Date.now(),
                active =
                  b.status === "accepted" &&
                  !expired &&
                  Date.parse(b.starts_at) <= Date.now();
              return (
                <section className="panel" key={b.id}>
                  <div className="row between wrap">
                    <h2>{b.title}</h2>
                    <Badge>
                      {expired
                        ? "Prazo encerrado"
                        : {
                            offered: "Oferta para aceite",
                            accepted: "Aceita",
                            declined: "Recusada",
                            revoked: "Revogada",
                            ended: "Encerrada",
                          }[b.status]}
                    </Badge>
                  </div>
                  {adminView && (
                    <p>
                      Candidatura: <code>{b.application_id}</code> · Usuário:{" "}
                      <code>{b.user_id}</code> · Versão {b.version}
                    </p>
                  )}
                  <p>
                    {new Date(b.starts_at).toLocaleString("pt-BR")} a{" "}
                    {new Date(b.ends_at).toLocaleString("pt-BR")}
                  </p>
                  <details>
                    <summary>Condições e benefícios informados</summary>
                    <p className="preserve-lines">{b.terms}</p>
                    <ul>
                      {b.benefits.map((v) => (
                        <li key={v}>{benefitLabels[v]}</li>
                      ))}
                    </ul>
                    {b.human_availability && (
                      <p>Disponibilidade humana: {b.human_availability}</p>
                    )}
                  </details>
                  {!adminView && b.status === "offered" && !expired && (
                    <button
                      className="button primary"
                      onClick={() => setSelected(b)}
                    >
                      Ler oferta e responder
                    </button>
                  )}
                  {adminView && data.admin && (
                    <Form
                      save={(f) =>
                        act(String(f.get("action")), b.id, b.version, {
                          ...formObject(f),
                          ends_at: f.get("ends_at")
                            ? isoDate(f.get("ends_at"))
                            : undefined,
                        })
                      }
                    >
                      <label>
                        Decisão
                        <select name="action">
                          <option value="end">Encerrar bolsa</option>
                          <option value="revoke">Revogar bolsa</option>
                          {active && (
                            <option value="extend">Prorrogar bolsa</option>
                          )}
                        </select>
                      </label>
                      <Field
                        name="ends_at"
                        label="Nova expiração (somente prorrogação)"
                        type="datetime-local"
                        required={false}
                      />
                      <Field name="reason" label="Motivo da decisão" />
                    </Form>
                  )}
                  {(active || adminView) && (
                    <>
                      <div className="row between wrap">
                        <h3>Plano e atividades</h3>
                        {adminView && (
                          <button
                            className="button"
                            onClick={() => {
                              setGoalScholar(b.id);
                              setGoal(null);
                            }}
                          >
                            Criar meta ou atividade
                          </button>
                        )}
                      </div>
                      <p>
                        {gs.filter((g) => g.state === "completed").length} de{" "}
                        {gs.length} metas concluídas por declaração do jogador.
                      </p>
                      <ProgressIndicator
                        value={gs.filter((g) => g.state === "completed").length}
                        max={gs.length || 1}
                      />
                      {gs.map((g) => (
                        <article className="application-card" key={g.id}>
                          <Badge>{goalLabels[g.kind]}</Badge>
                          <h4>{g.title}</h4>
                          <p className="preserve-lines">{g.description}</p>
                          <p>
                            {states[g.state]}
                            {g.due_at
                              ? ` · Até ${new Date(g.due_at).toLocaleString("pt-BR")}`
                              : ""}
                          </p>
                          {g.route && (
                            <Link className="button" to={g.route}>
                              Abrir recurso associado
                            </Link>
                          )}
                          {adminView ? (
                            <>
                              <p>
                                Observação autodeclarada:{" "}
                                {g.learner_note || "Não informada"}
                              </p>
                              <button
                                className="button"
                                onClick={() => {
                                  setGoalScholar(b.id);
                                  setGoal(g);
                                }}
                              >
                                Revisar meta
                              </button>
                            </>
                          ) : (
                            <Form
                              save={(f) =>
                                act("progress", g.id, g.version, formObject(f))
                              }
                            >
                              <label>
                                Meu progresso
                                <select name="state" defaultValue={g.state}>
                                  {Object.entries(states).map(([v, l]) => (
                                    <option value={v} key={v}>
                                      {l}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <Field
                                name="learner_note"
                                label="Observação autodeclarada compartilhada com o orientador"
                                multiline
                                required={false}
                                defaultValue={g.learner_note}
                              />
                            </Form>
                          )}
                        </article>
                      ))}
                      <h3>Calendário do programa</h3>
                      {gs.filter((g) => g.due_at).length ? (
                        <ol className="status-timeline">
                          {gs
                            .filter((g) => g.due_at)
                            .map((g) => (
                              <li key={g.id}>
                                <strong>
                                  {new Date(g.due_at!).toLocaleDateString(
                                    "pt-BR",
                                  )}{" "}
                                  · {g.title}
                                </strong>
                                <p>{states[g.state]}</p>
                              </li>
                            ))}
                        </ol>
                      ) : (
                        <p>Nenhum prazo de atividade definido.</p>
                      )}
                      <p>
                        Atividades do programa não são inseridas automaticamente
                        na agenda pessoal. Use os recursos associados para
                        organizar seu treino.
                      </p>
                      <h3>Avaliações, recomendações e próximas etapas</h3>
                      {rs.map((r) => (
                        <article className="application-card" key={r.id}>
                          <small>
                            {new Date(r.created_at).toLocaleString("pt-BR")}
                          </small>
                          <p className="preserve-lines">{r.shared_feedback}</p>
                          <p>Próxima etapa: {r.next_step}</p>
                          {adminView && <p>Nota interna: {r.internal_note}</p>}
                        </article>
                      ))}
                      {adminView && (
                        <Form
                          save={(f) =>
                            act("review", null, 0, {
                              ...formObject(f),
                              scholarship_id: b.id,
                            })
                          }
                        >
                          <Field
                            name="shared_feedback"
                            label="Feedback e recomendações compartilhados"
                            multiline
                          />
                          <Field
                            name="internal_note"
                            label="Observação confidencial do avaliador"
                            multiline
                          />
                          <Field
                            name="next_step"
                            label="Próximas etapas"
                            multiline
                          />
                        </Form>
                      )}
                    </>
                  )}
                </section>
              );
            })}
          {adminView && data.admin && (
            <>
              <section className="panel">
                <h2>Decisão expressa de Academy Roster</h2>
                <p>
                  Exige liberação manual de requisitos/formalização. Não publica
                  dados do jogador. Elenco profissional permanece fora deste
                  fluxo.
                </p>
                <Form
                  save={(f) =>
                    act(
                      "roster_decision",
                      String(f.get("application_id")),
                      Number(f.get("expected")),
                      {
                        ...formObject(f),
                        kind: "academy_player",
                        ends_at: isoDate(f.get("ends_at")),
                        requirements_confirmed:
                          f.get("requirements_confirmed") === "on",
                      },
                    )
                  }
                >
                  <Field name="application_id" label="UUID da candidatura" />
                  <Field
                    name="expected"
                    label="Versão atual da candidatura"
                    type="number"
                  />
                  <Field name="reason" label="Decisão e motivo" multiline />
                  <Field
                    name="formalization_reference"
                    label="Referência da revisão/formalização (sem documentos pessoais)"
                  />
                  <Field
                    name="ends_at"
                    label="Expiração do cargo"
                    type="datetime-local"
                  />
                  <CheckField
                    name="requirements_confirmed"
                    label="Requisitos e autorização pertinente revisados"
                  />
                </Form>
              </section>
              <section className="panel">
                <h2>Solicitações de exclusão de dados esports</h2>
                <p>
                  O pedido revoga acessos imediatamente. A execução
                  administrativa elimina os dados de esports; a conta e os dados
                  pessoais de treinamento são preservados.
                </p>
                {data.erasure_requests.map((r) => (
                  <article className="application-card" key={r.user_id}>
                    <p>
                      <code>{r.user_id}</code> ·{" "}
                      {new Date(r.requested_at).toLocaleString("pt-BR")}
                    </p>
                    <Form
                      save={async (f) => {
                        await esportsRPC("esports_purge", {
                          p_user: r.user_id,
                          p_confirmation: f.get("confirmation"),
                        });
                        await refresh();
                      }}
                    >
                      <Field
                        name="confirmation"
                        label="Digite EXCLUIR DADOS ESPORTS"
                      />
                    </Form>
                  </article>
                ))}
                <Form
                  save={async (f) => {
                    await esportsRPC("esports_purge", {
                      p_confirmation: f.get("confirmation"),
                    });
                    await refresh();
                  }}
                >
                  <p>
                    Executar retenção de candidaturas retiradas ou não
                    selecionadas cujo prazo terminou.
                  </p>
                  <Field
                    name="confirmation"
                    label="Digite EXCLUIR DADOS ESPORTS para executar retenção"
                  />
                </Form>
              </section>
            </>
          )}
        </>
      )}
      {selected && (
        <Modal
          title="Responder oferta de bolsa"
          onClose={() => setSelected(null)}
        >
          <h2>{selected.title}</h2>
          <p className="preserve-lines">{selected.terms}</p>
          <ul>
            {selected.benefits.map((v) => (
              <li key={v}>{benefitLabels[v]}</li>
            ))}
          </ul>
          <p>{selected.human_availability}</p>
          <p>
            De {new Date(selected.starts_at).toLocaleString("pt-BR")} até{" "}
            {new Date(selected.ends_at).toLocaleString("pt-BR")}. Bolsa sem
            cobrança, sem garantia de evolução ou ingresso no elenco.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void s.run(
                () =>
                  act("accept", selected.id, selected.version, {
                    accepted: true,
                  }),
                "Bolsa aceita no servidor.",
              );
            }}
          >
            <label className="checkbox">
              <input type="checkbox" required />
              Li e aceito expressamente as condições desta versão.
            </label>
            <button className="button primary" disabled={s.busy}>
              Aceitar bolsa temporária
            </button>
          </form>
          <button
            className="button"
            disabled={s.busy}
            onClick={() =>
              void s.run(
                () => act("decline", selected.id, selected.version, {}),
                "Oferta recusada.",
              )
            }
          >
            Recusar oferta
          </button>
        </Modal>
      )}
      {goal !== undefined && (
        <Modal
          title={goal ? "Revisar meta" : "Nova meta ou atividade"}
          onClose={() => setGoal(undefined)}
        >
          <Form
            save={async (f) => {
              await act("goal", goal?.id || null, goal?.version || 0, {
                ...formObject(f),
                scholarship_id: goalScholar,
                due_at: f.get("due_at") ? isoDate(f.get("due_at")) : null,
              });
              setGoal(undefined);
            }}
          >
            <Field name="title" label="Título" defaultValue={goal?.title} />
            <Field
              name="description"
              label="Objetivo, critérios e orientações"
              multiline
              defaultValue={goal?.description}
            />
            <label>
              Tipo
              <select name="kind" defaultValue={goal?.kind || "study"}>
                {Object.entries(goalLabels).map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <Field
              name="due_at"
              label="Prazo opcional"
              type="datetime-local"
              required={false}
              defaultValue={localDate(goal?.due_at || undefined)}
            />
            <Field
              name="route"
              label="Recurso interno associado (ex.: /app/vod)"
              required={false}
              defaultValue={goal?.route}
            />
          </Form>
        </Modal>
      )}
    </>
  );
}
