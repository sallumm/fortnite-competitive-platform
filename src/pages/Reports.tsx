import { useState } from "react";
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
} from "recharts";
import { Download, Plus, Target } from "lucide-react";
import { useStore } from "../lib/store";
import {
  comparableResults,
  dateLabel,
  download,
  progression,
  stats,
} from "../lib/logic";
import { labels } from "../lib/types";
import { Badge, Empty, Heading, Progress } from "../components/ui";
import { localDate } from "../components/Calendar";
export default function Reports() {
  const s = useStore();
  const [period, setPeriod] = useState(30);
  const [exercise, setExercise] = useState(s.catalog.exercises[0]?.id || "");
  const [goal, setGoal] = useState("");
  const [target, setTarget] = useState(3);
  const cutoff = Date.now() - period * 864e5;
  const sessions = s.data.sessions.filter(
    (x) => new Date(x.started_at).getTime() >= cutoff,
  );
  const metrics = stats(sessions);
  const distribution = sessions
    .filter((x) => x.status === "completed")
    .reduce<Record<string, number>>((acc, session) => {
      for (const step of session.steps) {
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
  const trend = comparableResults(
    sessions,
    exercise,
    s.catalog.exercises.find((e) => e.id === exercise)?.metric,
  ).map((x) => ({ data: dateLabel(x.date), resultado: x.value }));
  const profile = s.data.profile!;
  const due = s.data.schedules.filter(
    (x) =>
      new Date(x.starts_at).getTime() >= cutoff &&
      new Date(x.starts_at).getTime() <= Date.now(),
  );
  const matched = new Set<string>();
  let adhered = 0;
  due.forEach((schedule) => {
    const match = sessions.find(
      (session) =>
        session.status === "completed" &&
        session.plan_id === schedule.plan_id &&
        !matched.has(session.id) &&
        localDate(session.started_at, profile.timezone) ===
          localDate(schedule.starts_at, profile.timezone),
    );
    if (match) {
      matched.add(match.id);
      adhered++;
    }
  });
  return (
    <>
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
      <div className="tabs page-tabs">
        {[7, 30, 90].map((n) => (
          <button
            key={n}
            aria-pressed={period === n}
            onClick={() => setPeriod(n)}
          >
            {n} dias
          </button>
        ))}
      </div>
      <div className="metrics-grid">
        <article className="metric">
          <strong>{metrics.count}</strong>
          <span>Sessões concluídas</span>
        </article>
        <article className="metric">
          <strong>{metrics.minutes}</strong>
          <span>Minutos ativos registrados</span>
        </article>
        <article className="metric">
          <strong>
            {due.length ? Math.round((adhered / due.length) * 100) + "%" : "—"}
          </strong>
          <span>Aderência: mesmo plano e dia</span>
        </article>
        <article className="metric">
          <strong>{metrics.xp}</strong>
          <span>XP no período</span>
        </article>
      </div>
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
              onChange={(e) => setExercise(e.target.value)}
            >
              {s.catalog.exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small-text">
            {s.catalog.exercises.find((e) => e.id === exercise)?.metric}.
            Compare somente configurações equivalentes.
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
                      type="linear"
                      dataKey="resultado"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot
                    />
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
      <section className="panel goals-panel">
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
                    <span>Resultado: {r.value ?? "Não informado"}</span>
                    <p>{r.note || "Sem observações."}</p>
                  </div>
                ))}
              </details>
            ))
        ) : (
          <Empty title="Seu histórico começa na próxima sessão" />
        )}
      </section>
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
