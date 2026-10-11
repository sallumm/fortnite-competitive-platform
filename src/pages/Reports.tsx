import { RoadAccess } from "../components/RoadAccess";
import { LearningReport } from "../components/LearningReport";
import { validPeriod } from "../lib/intelligence";
import { ReportEvidence } from "../components/ReportEvidence";
import { reportEvidence } from "../lib/intelligence-report";
import { AnimatedTabs, StatCounter } from "../components/experience/primitives";
import { useMotionLevel } from "../components/experience/MotionSystem";
import { CoachAccess } from "../components/CoachAccess";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Brush,
} from "recharts";
import { Download, Plus, Target } from "lucide-react";
import { useStore } from "../lib/store";
import { dateLabel, download, progression, stats } from "../lib/logic";
import { labels } from "../lib/types";
import { Badge, Empty, Heading, Progress } from "../components/ui";
import { dateInZone } from "../lib/calendar";
import { periodBounds, resultGroups, summarize } from "../lib/performance";
import { difficulties } from "../lib/performance-types";
export default function Reports() {
  const s = useStore();
  const { effective } = useMotionLevel();
  const [query] = useSearchParams();
  const [period, setPeriod] = useState(() => {
    const value = Number(query.get("period"));
    return [7, 30, 90].includes(value) ? value : 30;
  });
  const [custom, setCustom] = useState(false);
  const [customBounds, setCustomBounds] = useState(() =>
    periodBounds(30, s.data.profile!.timezone),
  );
  const [exercise, setExercise] = useState(s.catalog.exercises[0]?.id || "");
  const [goal, setGoal] = useState("");
  const [target, setTarget] = useState(3);
  const profile = s.data.profile!;
  const [configuration, setConfiguration] = useState("");
  const customValid = validPeriod(customBounds.from, customBounds.to);
  const bounds =
    custom && customValid
      ? customBounds
      : periodBounds(period, profile.timezone);
  const sessions = s.data.sessions.filter((x) => {
    const date = dateInZone(x.completed_at || x.started_at, profile.timezone);
    return date >= bounds.from && date <= bounds.to;
  });
  const summary = summarize(s.data, bounds.from, bounds.to);
  const metrics = stats(sessions);
  const distribution = sessions
    .filter((x) => x.status === "completed")
    .reduce<Record<string, number>>((acc, session) => {
      for (const [index, step] of session.steps.entries()) {
        if (session.results[index]?.status === "skipped") continue;
        const category =
          step.exercise?.category ||
          s.catalog.exercises.find((e) => e.id === step.exercise_id)?.category;
        if (category) acc[category] = (acc[category] || 0) + step.minutes;
      }
      return acc;
    }, {});
  const chart = Object.entries(distribution).map(([c, m]) => ({
    name: labels[c],
    minutos: m,
  }));
  const groups = resultGroups(sessions, exercise);
  const selected = groups.find((g) => g.key === configuration) || groups[0];
  const trend = (selected?.points || []).map((x) => ({
    data: dateLabel(x.date, profile.timezone),
    resultado: x.value,
  }));
  return (
    <>
      <RoadAccess />
      <CoachAccess
        question={`Como foi minha evolução nos últimos ${period} dias?`}
        label="Analisar minha evolução"
      />
      <Heading
        eyebrow="EVOLUÇÃO OBSERVÁVEL"
        title="Seu histórico, com contexto."
        description="Relatórios baseados nos registros que você fez. Sem estatísticas de partidas externas."
        action={
          <button
            className="button"
            onClick={() =>
              download(
                JSON.stringify(s.data, null, 2),
                "clutchfolio-meus-dados.json",
                "application/json",
              )
            }
          >
            <Download size={16} />
            Exportar meus dados
          </button>
        }
      />
      <Link className="button" to="/app/evolution">
        Central Minha Evolução
      </Link>
      <section className="panel">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={custom}
            onChange={(e) => setCustom(e.target.checked)}
          />
          Usar intervalo personalizado
        </label>
        {custom && (
          <>
            <div className="form-grid">
              <label>
                Data inicial do relatório
                <input
                  type="date"
                  value={customBounds.from}
                  onChange={(e) =>
                    setCustomBounds({ ...customBounds, from: e.target.value })
                  }
                />
              </label>
              <label>
                Data final do relatório
                <input
                  type="date"
                  value={customBounds.to}
                  onChange={(e) =>
                    setCustomBounds({ ...customBounds, to: e.target.value })
                  }
                />
              </label>
            </div>
            {!customValid && (
              <p role="alert">
                Intervalo inválido: use até 366 dias em ordem. Enquanto ajusta,
                os gráficos usam o período padrão indicado abaixo.
              </p>
            )}
          </>
        )}
      </section>
      <Link className="button" to="/app/training">
        Histórico detalhado e metas mensuráveis
      </Link>
      <LearningReport from={bounds.from} to={bounds.to} />
      <AnimatedTabs
        className="page-tabs"
        label="Período do relatório"
        value={period}
        onChange={setPeriod}
        items={[7, 30, 90].map((n) => ({ value: n, label: `${n} dias` }))}
      />
      <div className="metrics-grid">
        <article className="metric">
          <StatCounter value={metrics.count} />
          <span>Sessões concluídas</span>
        </article>
        <article className="metric">
          <StatCounter value={metrics.minutes} />
          <span>Minutos ativos registrados</span>
        </article>
        <article className="metric">
          <strong>
            {summary.planned
              ? Math.round((summary.adhered / summary.planned) * 100) + "%"
              : "—"}
          </strong>
          <span>Conclusão explícita da agenda</span>
        </article>
        <article className="metric">
          <StatCounter value={metrics.xp} />
          <span>XP no período</span>
        </article>
      </div>
      {chart.length > 0 && (
        <details className="panel chart-data">
          <summary>Consultar dados dos gráficos</summary>
          <table>
            <caption>
              Minutos planejados nas etapas das sessões concluídas
            </caption>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Minutos</th>
              </tr>
            </thead>
            <tbody>
              {chart.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.minutos}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {trend.length > 0 && (
            <table>
              <caption>Resultados na configuração selecionada</caption>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((row, i) => (
                  <tr key={i}>
                    <td>{row.data}</td>
                    <td>{row.resultado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>
      )}
      <section className="panel report-insights">
        <div className="section-title">
          <h2>Leitura do período</h2>
          <Link className="text-link" to="/app/week">
            Minha Semana
          </Link>
        </div>
        <p>
          {summary.planned} atividades de treino planejadas até agora ·{" "}
          {summary.practiceDays} dias de prática. Período anterior:{" "}
          {summary.previousCompleted} sessões (períodos parciais não são
          equivalentes).
        </p>
        {summary.estimated > 0 && (
          <p>
            {summary.estimated} correspondências antigas estimadas por plano e
            dia, apresentadas separadamente da aderência explícita.
          </p>
        )}
        <ul>
          {summary.observations.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        {summary.difficulties.length > 0 && (
          <p>
            Dificuldades relatadas:{" "}
            {summary.difficulties
              .map((d) => `${difficulties[d.key]} (${d.count})`)
              .join(", ")}
            .
          </p>
        )}
        <details>
          <summary>Como ler este relatório e próximos passos</summary>
          <p>
            Contagens derivadas dos registros autodeclarados. Aderência
            explícita usa vínculo com atividade, ou marcação manual. Categorias
            usam minutos planejados, sem medir tempo por habilidade.
            Cancelamentos são excluídos do denominador.
          </p>
          <ul>
            {summary.suggestions.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </details>
      </section>
      <div className="two-grid">
        <section className="panel chart-panel">
          <h2>Distribuição do planejamento realizado</h2>
          <p className="muted small-text">
            Duração planejada das etapas em sessões concluídas; não é tempo
            medido por habilidade.
          </p>
          {chart.length ? (
            <>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chart} accessibilityLayer>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        background: "var(--panel)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    />
                    <Bar
                      dataKey="minutos"
                      fill="var(--accent)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="sr-only">
                {chart.map((x) => (
                  <li key={x.name}>
                    {x.name}: {x.minutos} minutos planejados
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty title="Ainda sem sessões concluídas">
              Os gráficos aparecem quando houver registros.
            </Empty>
          )}
        </section>
        <section className="panel chart-panel">
          <h2>Resultados do mesmo exercício</h2>
          <label>
            Exercício
            <select
              value={exercise}
              onChange={(e) => {
                setExercise(e.target.value);
                setConfiguration("");
              }}
            >
              {s.catalog.exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Configuração e métrica comparáveis
            <select
              value={selected?.key || ""}
              onChange={(e) => setConfiguration(e.target.value)}
            >
              {!groups.length && (
                <option value="">Sem grupo identificado</option>
              )}
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.configuration} · {g.metric}
                  {g.version ? ` · ${g.version}` : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small-text">
            Dados autodeclarados. Resultados antigos sem identificação continuam
            no histórico, mas não geram comparação automática. Variação de valor
            não implica melhoria para todas as métricas.
          </p>
          {trend.length >= 2 ? (
            <>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={trend} accessibilityLayer>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--panel)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    />
                    <Line
                      isAnimationActive={effective === "full"}
                      animationDuration={450}
                      type="linear"
                      dataKey="resultado"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot
                    />
                    {trend.length >= 8 && (
                      <Brush
                        dataKey="data"
                        height={24}
                        stroke="var(--accent)"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ul className="sr-only">
                {trend.map((x, i) => (
                  <li key={i}>
                    {x.data}: {x.resultado}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty title="Duas medições para comparar">
              Registre o mesmo exercício com configuração equivalente em duas
              sessões.
            </Empty>
          )}
        </section>
      </div>
      <section id="metas" className="panel goals-panel">
        <h2>Minhas metas</h2>
        <p className="muted">
          Defina a intenção e marque a conclusão quando cumprir. Sem bônus de XP
          por marcação manual.
        </p>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            s.run(async () => {
              await s.save("goals", {
                id: crypto.randomUUID(),
                user_id: profile.id,
                title: goal,
                target,
                completed: false,
              });
              setGoal("");
            });
          }}
        >
          <label>
            Objetivo
            <input
              required
              maxLength={100}
              value={goal}
              placeholder="Revisar minhas decisões de rotação"
              onChange={(e) => setGoal(e.target.value)}
            />
          </label>
          <label>
            Quantidade desejada
            <input
              type="number"
              min={1}
              max={1000}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
          </label>
          <button disabled={s.busy} className="button primary">
            <Plus size={16} />
            Criar meta
          </button>
        </form>
        {s.data.goals.map((g) => (
          <div className="list-row" key={g.id}>
            <Target size={18} />
            <div>
              <strong>{g.title}</strong>
              <small>Quantidade definida: {g.target}</small>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={g.completed}
                disabled={s.busy}
                onChange={(e) =>
                  s.run(() =>
                    s.save("goals", { ...g, completed: e.target.checked }),
                  )
                }
              />
              Concluída
            </label>
            <button
              className="button small"
              disabled={s.busy}
              onClick={() => s.run(() => s.remove("goals", g.id))}
            >
              Remover
            </button>
          </div>
        ))}
      </section>
      <section className="panel history">
        <h2>Histórico de sessões</h2>
        {sessions.length ? (
          sessions
            .slice()
            .sort((a, b) => b.started_at.localeCompare(a.started_at))
            .map((session) => (
              <details key={session.id}>
                <summary>
                  <strong>{session.title}</strong>
                  <span>{dateLabel(session.started_at, profile.timezone)}</span>
                  <Badge>
                    {session.status === "completed"
                      ? "Concluída"
                      : session.status === "active"
                        ? "Em andamento"
                        : "Interrompida"}
                  </Badge>
                </summary>
                <p>
                  {Math.round(session.duration_seconds / 60)} minutos ativos · +
                  {session.xp} XP
                </p>
                {session.status !== "active" && (
                  <Link
                    className="button small"
                    to={"/app/journal/" + session.id}
                  >
                    {s.data.journals.some((j) => j.session_id === session.id)
                      ? "Revisar diário"
                      : "Escrever diário opcional"}
                  </Link>
                )}
                {session.results.map((r, i) => (
                  <div className="result-detail" key={i}>
                    <strong>
                      {session.steps.find(
                        (step) => step.exercise_id === r.exercise_id,
                      )?.exercise?.title ||
                        s.catalog.exercises.find((e) => e.id === r.exercise_id)
                          ?.title ||
                        "Exercício"}
                    </strong>
                    <span>
                      Resultado autodeclarado: {r.value ?? "Não informado"} ·
                      configuração: {r.configuration || "não identificada"}
                    </span>
                    <p>{r.note || "Sem observações."}</p>
                  </div>
                ))}
              </details>
            ))
        ) : (
          <Empty title="Seu histórico começa na próxima sessão" />
        )}
      </section>
      <ReportEvidence
        evidence={reportEvidence(
          s.data,
          s.catalog.exercises,
          bounds.from,
          bounds.to,
        )}
      />
    </>
  );
}
export function Progression() {
  const s = useStore();
  const xp = s.data.xp.reduce((n, x) => n + x.amount, 0);
  const rank = progression(xp);
  const sessions = s.data.sessions.filter((x) => x.status === "completed");
  const achievements = [
    ["Primeiro passo", "Concluir uma sessão", sessions.length >= 1],
    ["Prática com intenção", "Concluir cinco sessões", sessions.length >= 5],
    [
      "Observar para evoluir",
      "Registrar uma revisão de VOD",
      sessions.some((x) =>
        x.steps.some(
          (st) =>
            (st.exercise?.category ||
              s.catalog.exercises.find((e) => e.id === st.exercise_id)
                ?.category) === "vod",
        ),
      ),
    ],
  ] as const;
  return (
    <>
      <Heading
        eyebrow="PARTICIPAÇÃO COM PROPÓSITO"
        title="Cada registro conta."
        description="Progressão interna de participação. Sem equivalência com habilidade, PR ou rank do Fortnite."
      />
      <section className="panel progression-hero">
        <div className="rank-shape big">{Math.floor(xp / 500) + 1}</div>
        <div>
          <span className="eyebrow">SEU RANK INTERNO</span>
          <h2>{rank.rank}</h2>
          <p>
            Nível {rank.level} · {xp} XP acumulados
          </p>
          <Progress value={rank.progress} max={500} />
          <small className="muted">
            {500 - rank.progress} XP até o próximo marco de 500 XP
          </small>
        </div>
      </section>
      <div className="three-grid">
        {achievements.map(([title, desc, done]) => (
          <article
            className={"panel achievement " + (done ? "unlocked" : "")}
            key={title}
          >
            <Badge tone={done ? "green" : "neutral"}>
              {done ? "Conquistado" : "Em progresso"}
            </Badge>
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>Regras transparentes</h2>
        <p>
          Uma sessão concluída concede 100 XP. No máximo duas sessões por dia
          UTC recebem XP, totalizando 200 XP. Outras sessões podem ser
          registradas sem bônus. Reenvios da mesma conclusão não concedem XP
          extra.
        </p>
        <p>
          O XP não aumenta com a duração da sessão. Interrupções, metas manuais
          e permanecer conectado não geram bônus. Descanso não remove pontos e
          não há sequência diária obrigatória.
        </p>
        <div className="row wrap">
          {[
            "Rookie",
            "Contender",
            "Challenger",
            "Elite",
            "Master",
            "Legend",
          ].map((r, i) => (
            <Badge key={r}>
              {r} · {i * 500} XP
            </Badge>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Histórico de XP</h2>
        {s.data.xp.length ? (
          s.data.xp.map((x) => (
            <div className="list-row" key={x.id}>
              <strong>Conclusão de sessão</strong>
              <span>{dateLabel(x.created_at)}</span>
              <Badge tone="green">+{x.amount} XP</Badge>
            </div>
          ))
        ) : (
          <Empty title="Nenhum XP registrado" />
        )}
      </section>
    </>
  );
}
