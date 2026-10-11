import { RoadAccess } from "../components/RoadAccess";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { Heading, Badge, Empty, Modal } from "../components/ui";
import { stepExercise, trainingCategories, resultState } from "../lib/training";
import { resultGroups } from "../lib/performance";
import { download } from "../lib/logic";
import type { Result, Training } from "../lib/types";
export default function TrainingCenter() {
  const s = useStore(),
    p = s.data.profile!;
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all");
  const [correction, setCorrection] = useState<{
    session: Training;
    index: number;
    result: Result;
  } | null>(null);
  const [goalExercise, setGoalExercise] = useState(""),
    [baseline, setBaseline] = useState(0),
    [desired, setDesired] = useState(0),
    [configuration, setConfiguration] = useState(""),
    [deadline, setDeadline] = useState("");
  const exercises = s.catalog.exercises.filter(
    (e) => e.measurement && (e.mode === "both" || e.mode === p.mode),
  );
  const selected = exercises.find((e) => e.id === goalExercise);
  const sessions = s.data.sessions.filter(
    (x) =>
      (status === "all" || x.status === status) &&
      (
        x.title +
        " " +
        x.steps
          .map((st) => stepExercise(st, s.catalog.exercises)?.title)
          .join(" ") +
        " " +
        x.results.map((r) => r.note).join(" ")
      )
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const latest = s.data.sessions.find((x) => x.status === "completed"),
    active = s.data.sessions.find((x) => x.status === "active");
  const plan =
    s.data.plans.find((x) => x.favorite && !x.archived) ||
    s.data.plans.find((x) => !x.archived);
  return (
    <>
      <RoadAccess />
      <Heading
        eyebrow="SKILL MAXING"
        title="Training Center"
        description="Planeje uma prática possível, registre o que realizou e compare testes equivalentes."
        action={
          <Link className="button primary" to="/app/planner">
            Criar ou editar rotina
          </Link>
        }
      />
      <Link className="button primary" to="/app/evolution-plan">
        Criar meu plano de evolução
      </Link>
      <Link className="button" to="/app/meta-training">
        Meta Training Center
      </Link>
      <Link className="button" to="/app/teams">
        Minhas equipes
      </Link>
      <div className="three-grid">
        <article className="panel">
          <h2>Seu próximo passo</h2>
          {active ? (
            <>
              <p>{active.title} está em andamento.</p>
              <Link className="button primary" to={"/app/session/" + active.id}>
                Continuar sessão
              </Link>
            </>
          ) : plan ? (
            <>
              <p>
                {plan.title} · {plan.steps.reduce((n, x) => n + x.minutes, 0)}{" "}
                min planejados
              </p>
              <Link className="button" to="/app/planner">
                Revisar e iniciar
              </Link>
              <p className="muted">
                Sugestão pela rotina salva, sem presumir necessidade de mais
                prática.
              </p>
            </>
          ) : (
            <p>Crie uma rotina ou use um modelo editável no planejador.</p>
          )}
        </article>
        <article className="panel">
          <h2>Avaliações individuais</h2>
          <p>
            Use os protocolos da biblioteca com cenário, dispositivo,
            sensibilidade e duração constantes.
          </p>
          <Link className="button" to="/library">
            Explorar exercícios e benchmarks
          </Link>
        </article>
        <article className="panel">
          <h2>Continuidade</h2>
          <p>
            {latest
              ? `Última sessão: ${latest.title}`
              : "Ainda não há sessões concluídas."}
          </p>
          <Link className="button" to="/app/reports">
            Analisar meus resultados
          </Link>
          <Link className="text-link" to="/competitive">
            Preparar para competição
          </Link>
        </article>
      </div>
      <section className="panel">
        <h2>Habilidades e exercícios recentes</h2>
        <div className="row wrap">
          {Object.entries(trainingCategories).map(([key, label]) => (
            <Badge key={key}>{label}</Badge>
          ))}
        </div>
        {latest && (
          <ul>
            {latest.steps.map((st, i) => (
              <li key={st.id || i}>
                {stepExercise(st, s.catalog.exercises)?.title} ·{" "}
                {resultState(latest.results[i])}
              </li>
            ))}
          </ul>
        )}
        <Link to="/app/skills">Revisar minhas habilidades e objetivos</Link>
      </section>
      <section className="panel">
        <h2>Metas mensuráveis</h2>
        <Link className="text-link" to="/app/evolution#goals">
          Editar, pausar, concluir e consultar histórico das metas
        </Link>
        <p>
          Acompanhe uma métrica do mesmo exercício e configuração. Não inferimos
          evolução por horas de treino.
        </p>
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!selected?.measurement) return;
            const m = selected.measurement;
            s.run(
              () =>
                s.save("goals", {
                  id: crypto.randomUUID(),
                  user_id: p.id,
                  title:
                    `${selected.title}: ${baseline} → ${desired} ${m.unit}`.slice(
                      0,
                      100,
                    ),
                  target: 1,
                  completed: false,
                  measurement: {
                    exercise_id: selected.id,
                    unit: m.unit,
                    version: m.version,
                    baseline,
                    desired,
                    configuration: configuration.trim(),
                    ...(deadline ? { deadline } : {}),
                  },
                }),
              "Meta salva.",
            );
          }}
        >
          <div className="form-grid">
            <label>
              Exercício da meta
              <select
                required
                value={goalExercise}
                onChange={(e) => setGoalExercise(e.target.value)}
              >
                <option value="">Escolha um protocolo</option>
                {exercises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Valor inicial
              <input
                required
                type="number"
                step="any"
                min={selected?.measurement?.min || 0}
                max={selected?.measurement?.max || 1000000}
                value={baseline}
                onChange={(e) => setBaseline(Number(e.target.value))}
              />
            </label>
            <label>
              Resultado desejado
              <input
                required
                type="number"
                step="any"
                min={selected?.measurement?.min || 0}
                max={selected?.measurement?.max || 1000000}
                value={desired}
                onChange={(e) => setDesired(Number(e.target.value))}
              />
            </label>
            <label>
              Configuração comparável
              <input
                required
                maxLength={200}
                value={configuration}
                onChange={(e) => setConfiguration(e.target.value)}
                placeholder="Cenário, arma, dispositivo, sensibilidade, duração"
              />
            </label>
            <label>
              Prazo opcional
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
          </div>
          <button
            className="button primary"
            disabled={s.busy || !selected || !configuration.trim()}
          >
            Salvar meta mensurável
          </button>
        </form>
        {s.data.goals
          .filter((g) => g.measurement)
          .map((g) => {
            const m = g.measurement!;
            const e = s.catalog.exercises.find((e) => e.id === m.exercise_id);
            const matches = resultGroups(s.data.sessions, m.exercise_id).filter(
              (group) =>
                group.configuration === m.configuration &&
                group.unit === m.unit &&
                group.version === m.version,
            );
            const value =
              matches.length === 1
                ? matches[0].points.at(-1)?.value
                : undefined;
            return (
              <article key={g.id} className="goal">
                <h3>{g.title}</h3>
                <p>
                  {value === undefined
                    ? matches.length > 1
                      ? "Há condições de teste diferentes nesta configuração; consulte os grupos no relatório antes de avaliar a meta."
                      : "Sem resultados comparáveis registrados."
                    : `Último resultado comparável: ${value} ${m.unit}. ${(e?.measurement?.direction === "lower" ? value <= m.desired : value >= m.desired) ? "Alvo observado nesta configuração." : "Alvo ainda não observado."}`}
                </p>
                <p className="muted">
                  {m.configuration}
                  {m.deadline ? ` · prazo: ${m.deadline}` : ""}
                </p>
                <button
                  className="button small"
                  onClick={() => s.run(() => s.remove("goals", g.id))}
                >
                  Excluir meta
                </button>
              </article>
            );
          })}
      </section>
      <section className="panel">
        <div className="row between">
          <h2>Histórico de sessões</h2>
          <button
            className="button"
            onClick={() =>
              download(
                JSON.stringify(s.data.sessions, null, 2),
                "clutchfolio-sessoes.json",
                "application/json",
              )
            }
          >
            Exportar sessões
          </button>
        </div>
        <div className="form-grid">
          <label>
            Buscar no histórico
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rotina, exercício ou observação"
            />
          </label>
          <label>
            Estado da sessão
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Todos</option>
              <option value="active">Em andamento</option>
              <option value="completed">Concluída</option>
              <option value="abandoned">Interrompida</option>
            </select>
          </label>
        </div>
        {sessions.length ? (
          sessions.map((session) => (
            <details className="training-history" key={session.id}>
              <summary>
                {session.title} ·{" "}
                {new Date(session.started_at).toLocaleString("pt-BR", {
                  timeZone: p.timezone,
                })}{" "}
                ·{" "}
                {session.status === "completed"
                  ? "Concluída"
                  : session.status === "active"
                    ? "Em andamento"
                    : "Interrompida"}
              </summary>
              <p>
                {session.duration_seconds} segundos ativos registrados ·{" "}
                {session.steps.length} etapas · {session.xp} XP
              </p>
              {session.status === "active" ? (
                <Link className="button" to={"/app/session/" + session.id}>
                  Continuar sessão
                </Link>
              ) : (
                <>
                  {session.steps.map((st, i) => {
                    const e = stepExercise(st, s.catalog.exercises),
                      r = session.results[i];
                    return (
                      <article key={st.id || i}>
                        <h3>
                          {i + 1}. {e?.title}
                        </h3>
                        <p>{e?.instructions}</p>
                        {st.notes && <p>Notas do plano: {st.notes}</p>}
                        <p>
                          {st.minutes} min planejados
                          {st.block ? ` · ${st.block}` : ""} · {resultState(r)}
                        </p>
                        <p>
                          Resultado: {r?.value ?? "não registrado"}{" "}
                          {r?.unit || e?.metric} ·{" "}
                          {r?.configuration || "sem configuração comparável"}
                        </p>
                        <p>{r?.note}</p>
                        {r?.conditions && (
                          <p className="muted">
                            Cenário: {r.conditions.scenario || "não informado"}{" "}
                            · dispositivo:{" "}
                            {r.conditions.device || "não informado"} ·
                            sensibilidade:{" "}
                            {r.conditions.sensitivity || "não informada"} ·
                            teste:{" "}
                            {r.conditions.test_seconds ?? "não informado"}{" "}
                            segundos
                          </p>
                        )}
                        {r && (
                          <button
                            className="button small"
                            onClick={() =>
                              setCorrection({
                                session,
                                index: i,
                                result: { ...r },
                              })
                            }
                          >
                            Corrigir resultado da etapa {i + 1}
                          </button>
                        )}
                      </article>
                    );
                  })}
                  <Link className="text-link" to={"/app/journal/" + session.id}>
                    Consultar diário
                  </Link>
                </>
              )}
              <p className="muted">
                As instruções são preservadas da sessão, mesmo após editar ou
                excluir a rotina. Correções mantêm o registro anterior e não
                concedem XP.
              </p>
            </details>
          ))
        ) : (
          <Empty title="Nenhuma sessão encontrada">
            Os treinos realizados aparecerão aqui.
          </Empty>
        )}
      </section>
      {correction && (
        <Modal title="Corrigir resultado" onClose={() => setCorrection(null)}>
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              s.run(async () => {
                await s.correctResult(
                  correction.session,
                  correction.index,
                  correction.result,
                );
                setCorrection(null);
              }, "Resultado corrigido; versão anterior preservada.");
            }}
          >
            <label>
              Valor registrado
              <input
                type="number"
                step="any"
                min={0}
                max={
                  correction.session.steps[correction.index].exercise
                    ?.measurement?.max || 1000000
                }
                value={correction.result.value ?? ""}
                onChange={(e) =>
                  setCorrection({
                    ...correction,
                    result: {
                      ...correction.result,
                      value: e.target.value ? Number(e.target.value) : null,
                    },
                  })
                }
              />
            </label>
            <label>
              Configuração
              <input
                maxLength={200}
                value={correction.result.configuration || ""}
                onChange={(e) =>
                  setCorrection({
                    ...correction,
                    result: {
                      ...correction.result,
                      configuration: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label>
              Observação
              <textarea
                maxLength={1000}
                value={correction.result.note}
                onChange={(e) =>
                  setCorrection({
                    ...correction,
                    result: { ...correction.result, note: e.target.value },
                  })
                }
              />
            </label>
            <p>
              A versão anterior é preservada para auditoria. A conclusão e o XP
              da sessão permanecem os mesmos.
            </p>
            <button className="button primary" disabled={s.busy}>
              Confirmar correção
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
