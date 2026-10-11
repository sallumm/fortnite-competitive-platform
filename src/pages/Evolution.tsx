import { JourneyNav } from "../components/experience/JourneyNav";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useStore } from "../lib/store";
import {
  analyze,
  recommend,
  validPeriod,
  goalState,
} from "../lib/intelligence";
import { skills, type Skill } from "../lib/performance-types";
import { periodBounds, summarize } from "../lib/performance";
import { dateInZone, expandCalendar, shiftDate } from "../lib/calendar";
import { labels, type Plan } from "../lib/types";
import { identifySteps } from "../lib/training";
import { download, progression, timeLabel } from "../lib/logic";
import { Badge, Heading, Modal } from "../components/ui";
import { GoalManager } from "../components/GoalManager";
import { CoachAccess } from "../components/CoachAccess";
import { useMotionLevel } from "../components/experience/MotionSystem";
export default function Evolution() {
  const s = useStore(),
    p = s.data.profile!;
  const { effective } = useMotionLevel();
  const [bounds, setBounds] = useState(() => periodBounds(30, p.timezone)),
    [skill, setSkill] = useState<Skill>(
      p.mode === "zero" &&
        ["building", "editing", "piece", "box_fighting"].includes(
          s.data.planningPreferences[0]?.primary_skill || "",
        )
        ? "tracking"
        : s.data.planningPreferences[0]?.primary_skill || "tracking",
    ),
    [selection, setSelection] = useState(""),
    [preview, setPreview] = useState<Plan | null>(null);
  const valid = validPeriod(bounds.from, bounds.to),
    report = valid
      ? analyze(s.data, s.catalog.exercises, bounds.from, bounds.to)
      : null;
  const summary = valid ? summarize(s.data, bounds.from, bounds.to) : null;
  const ideas = recommend(s.data, s.catalog.exercises, skill);
  const current = dateInZone(new Date(), p.timezone);
  const upcoming = expandCalendar(
    s.data,
    current,
    shiftDate(current, 7),
  ).filter(
    (o) => o.status === "planned" && Date.parse(o.starts_at) > Date.now(),
  );
  const review = s.data.skillReviews
    .filter((r) => r.skill === skill)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const comparisons = report?.comparisons || [];
  const comparison =
    comparisons.find((_, i) => String(i) === selection) || comparisons[0];
  const distribution = new Map<string, number>();
  for (const session of report?.sessions || [])
    for (const [i, step] of session.steps.entries())
      if (session.results[i]?.status !== "skipped") {
        const c = step.exercise?.category;
        if (c) distribution.set(c, (distribution.get(c) || 0) + 1);
      }
  const chart = [...distribution].map(([key, count]) => ({
    categoria: labels[key],
    etapas: count,
  }));
  const favorites = s.catalog.tournaments.filter((t) =>
    s.data.bookmarks.some(
      (b) => b.kind === "tournament" && b.target_id === t.id,
    ),
  );
  const rank = progression(s.data.xp.reduce((n, x) => n + x.amount, 0));
  return (
    <>
      <JourneyNav />
      <Heading
        eyebrow="PERFORMANCE INTELLIGENCE"
        title="Minha Evolução"
        description="Planejamento, avaliações e resultados com contexto. XP representa participação; testes comparáveis representam apenas o protocolo registrado."
        action={
          <button
            className="button"
            disabled={!report}
            onClick={() =>
              download(
                JSON.stringify(
                  {
                    version: 1,
                    generated_at: new Date().toISOString(),
                    timezone: p.timezone,
                    bounds,
                    summary,
                    ...report,
                  },
                  null,
                  2,
                ),
                "clutchfolio-evolucao-" + bounds.from + ".json",
                "application/json",
              )
            }
          >
            Exportar análise do período
          </button>
        }
      />
      <section className="panel evolution-profile">
        <div>
          <Badge>
            {labels[p.mode]} · {labels[p.input]}
          </Badge>
          <h2>{p.display_name}</h2>
          <p>
            Objetivo principal informado: {labels[p.objective]} · nível
            autodeclarado: {labels[p.level]}. Fuso: {p.timezone}.
          </p>
          <small>
            {rank.rank} · {s.data.xp.reduce((n, x) => n + x.amount, 0)} XP de
            participação. Sem equivalência com rank do Fortnite.
          </small>
        </div>
        <div className="row wrap">
          <Link className="button" to="/app/skills">
            Minhas habilidades
          </Link>
          <Link className="button" to="/app/vod">
            VOD Review Center
          </Link>
          <Link className="button" to="/app/week">
            Relatório semanal
          </Link>
          <Link className="button" to="/app/reports">
            Relatórios detalhados
          </Link>
        </div>
      </section>
      <section className="panel">
        <div className="row wrap">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              className="button small"
              onClick={() => {
                setBounds(periodBounds(days, p.timezone));
                setSelection("");
              }}
            >
              Últimos {days} dias
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label>
            Início da análise
            <input
              type="date"
              value={bounds.from}
              onChange={(e) => setBounds({ ...bounds, from: e.target.value })}
            />
          </label>
          <label>
            Fim da análise
            <input
              type="date"
              value={bounds.to}
              onChange={(e) => setBounds({ ...bounds, to: e.target.value })}
            />
          </label>
        </div>
        {!valid && (
          <p role="alert">Escolha datas válidas em ordem, com até 366 dias.</p>
        )}
      </section>
      {report && summary && (
        <>
          <div className="metrics-grid">
            {[
              [summary.completed, "Sessões concluídas"],
              [summary.minutes, "Minutos registrados"],
              [summary.planned, "Treinos planejados até agora"],
              [
                s.data.goals.filter((g) => goalState(g) === "active").length,
                "Metas em andamento",
              ],
            ].map(([value, label]) => (
              <article className="metric" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            ))}
          </div>
          <section className="panel">
            <h2>O que os registros mostram</h2>
            <p className="muted">
              Fatos são registros observados; recomendações são opções baseadas
              em regras. Hipóteses causais não são inferidas de pontuação,
              volume ou autorrelato.
            </p>
            <div className="diagnostic-grid">
              {report.diagnostics.map((d) => (
                <article className="diagnostic-card" key={d.key}>
                  <Badge>
                    {d.kind === "fact" ? "FATO OBSERVADO" : "RECOMENDAÇÃO"}
                  </Badge>
                  <h3>{d.title}</h3>
                  <p>{d.detail}</p>
                  <Link className="text-link" to={d.to}>
                    Consultar registros e próximos passos
                  </Link>
                </article>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="section-title">
              <h2>Resultados comparáveis</h2>
              <Badge>{comparisons.length} grupos com duas sessões</Badge>
            </div>
            {comparison ? (
              <>
                <label>
                  Protocolo e configuração
                  <select
                    value={String(comparisons.indexOf(comparison))}
                    onChange={(e) => setSelection(e.target.value)}
                  >
                    {comparisons.map((c, i) => (
                      <option key={i} value={i}>
                        {c.title} · {c.configuration} · {c.unit} · {c.version} ·
                        grupo {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  {comparison.count} sessões comparáveis: {comparison.first} →{" "}
                  {comparison.last} {comparison.unit}.{" "}
                  {comparison.direction
                    ? `O protocolo busca resultados ${comparison.direction === "lower" ? "menores" : "maiores"}.`
                    : "Direção desejada não padronizada no registro legado."}
                </p>
                <div
                  className="chart"
                  role="img"
                  aria-label={`Resultados de ${comparison.title}: ${comparison.points.map((x) => x.value).join(", ")} ${comparison.unit}`}
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart
                      data={comparison.points.map((x) => ({
                        data: dateInZone(x.date, p.timezone),
                        resultado: x.value,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="data" />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => [
                          `${value} ${comparison.unit}`,
                          comparison.title,
                        ]}
                      />
                      <Line
                        dataKey="resultado"
                        type="linear"
                        stroke="var(--accent)"
                        isAnimationActive={effective === "full"}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="muted">
                  Mesmo exercício, métrica, unidade, versão,
                  cenário/configuração e condições declaradas. Repetições da
                  mesma sessão não são sessões independentes; exibimos a última
                  medição por sessão. Diferenças não identificam a causa nem
                  garantem desempenho competitivo.
                </p>
                <Link className="text-link" to="/app/reports">
                  Conferir todos os grupos e condições
                </Link>
              </>
            ) : (
              <p>
                Sem duas sessões com dados suficientes para comparar neste
                período.
              </p>
            )}
          </section>
          <section className="panel">
            <h2>Distribuição registrada</h2>
            {chart.length ? (
              <div
                className="chart"
                role="img"
                aria-label={chart
                  .map((x) => `${x.categoria}: ${x.etapas} etapas`)
                  .join(", ")}
              >
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chart}>
                    <XAxis dataKey="categoria" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="etapas"
                      fill="var(--accent)"
                      isAnimationActive={effective === "full"}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p>Sem etapas concluídas para distribuir.</p>
            )}
            <p className="muted">
              Contagem de etapas registradas, incluindo repetições. Não
              representa uma nota ou porcentagem de domínio da habilidade.
            </p>
            <p>
              Período anterior de mesma duração: {summary.previousCompleted}{" "}
              sessões. Um período atual parcial não equivale a um período
              completo.
            </p>
          </section>
        </>
      )}
      <section className="panel">
        <h2>Próximos passos para uma habilidade</h2>
        <label>
          Habilidade prioritária
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value as Skill)}
          >
            {Object.entries(skills)
              .filter(
                ([key]) =>
                  p.mode === "build" ||
                  !["building", "editing", "piece", "box_fighting"].includes(
                    key,
                  ),
              )
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <p>
          {review
            ? `Última avaliação pessoal: ${dateInZone(review.created_at, p.timezone)} · ${review.goal || "Sem objetivo escrito"} · ${review.note || "Sem observações"}`
            : "Sem avaliação pessoal desta habilidade. Registre um objetivo em Minhas Habilidades."}
        </p>
        <button
          className="button small"
          disabled={s.busy}
          onClick={() =>
            s.run(() =>
              s.save("planningPreferences", {
                ...(s.data.planningPreferences[0] || {
                  id: p.id,
                  user_id: p.id,
                  weekdays: [1, 3, 5],
                  local_time: "18:00",
                  minutes: p.minutes,
                  focuses: [p.objective],
                }),
                primary_skill: skill,
              }),
            )
          }
        >
          Salvar habilidade prioritária
        </button>
        {!ideas.length && (
          <p>
            Não há exercício publicado compatível com esta habilidade e
            modalidade.
          </p>
        )}
        {ideas.map((x) => (
          <article className="skill-exercise" key={x.exercise.id}>
            <h3>{x.exercise.title}</h3>
            <p>{x.reason}</p>
            <div className="row wrap">
              <Link className="text-link" to={"/library/" + x.exercise.id}>
                Instruções e fonte
              </Link>
              <button
                className="button small"
                onClick={() =>
                  setPreview({
                    id: crypto.randomUUID(),
                    user_id: p.id,
                    title: `Prática: ${x.exercise.title}`.slice(0, 80),
                    mode: p.mode,
                    objective: skills[skill],
                    steps: identifySteps([
                      { exercise_id: x.exercise.id, minutes: x.minutes },
                    ]),
                  })
                }
              >
                Propor rotina com {x.exercise.title}
              </button>
            </div>
          </article>
        ))}
        <Link className="button" to="/app/planner">
          Organizar dias, horários e conflitos
        </Link>
      </section>
      <GoalManager />
      <section className="panel">
        <h2>Agenda e continuidade</h2>
        {upcoming.length ? (
          upcoming.slice(0, 8).map((o) => (
            <div className="list-row" key={o.key}>
              <div>
                <strong>{o.title}</strong>
                <small>
                  {timeLabel(o.starts_at, p.timezone)} · {o.duration_minutes}{" "}
                  min
                </small>
              </div>
              <Link className="text-link" to="/app/planner">
                Consultar agenda
              </Link>
            </div>
          ))
        ) : (
          <p>
            Sem próximos compromissos registrados. Descanso pode continuar sem
            atividades na agenda.
          </p>
        )}
        <Link className="button" to="/app/training">
          Histórico de sessões e correções
        </Link>
      </section>
      <section className="panel">
        <h2>Competições salvas</h2>
        {favorites.length ? (
          favorites.map((t) => (
            <div className="list-row" key={t.id}>
              <div>
                <strong>{t.title}</strong>
                <small>
                  {t.start_date} · {t.region} ·{" "}
                  {Date.parse(t.valid_until) < Date.now()
                    ? "Informação precisa de revisão"
                    : t.status}
                </small>
              </div>
              <Link className="button small" to={"/competitive/" + t.slug}>
                Consultar e preparar
              </Link>
            </div>
          ))
        ) : (
          <p>Nenhuma competição favorita registrada.</p>
        )}
      </section>
      <section className="panel">
        <h2>Conteúdo relacionado ao objetivo</h2>
        {s.catalog.articles
          .filter(
            (a) =>
              a.category === p.objective &&
              a.published &&
              Date.parse(a.published_at) <= Date.now() &&
              (!a.valid_until || Date.parse(a.valid_until) >= Date.now()),
          )
          .slice(0, 3)
          .map((a) => (
            <div className="list-row" key={a.id}>
              <Link
                className="text-link"
                to={(a.kind === "lesson" ? "/academy/" : "/news/") + a.slug}
              >
                {a.title}
              </Link>
            </div>
          ))}
        <Link className="button" to="/academy">
          Consultar Academy
        </Link>
      </section>
      <CoachAccess
        question="Como foi minha semana?"
        label="Conversar sobre meus registros"
      />
      {preview && (
        <Modal
          title="Confirmar rotina sugerida"
          onClose={() => setPreview(null)}
        >
          <h3>{preview.title}</h3>
          <p>
            {preview.steps[0].minutes} minutos · {skills[skill]} · {p.timezone}.
            Esta prévia ainda não criou rotina ou compromisso.
          </p>
          <p>
            Depois de confirmar, escolha data/horário no planejador. Os
            conflitos e a agenda serão conferidos antes de salvar o evento.
          </p>
          <button
            className="button primary"
            disabled={s.busy}
            onClick={() =>
              s.run(async () => {
                await s.save("plans", preview);
                setPreview(null);
              }, "Rotina criada. Abra o planejador para escolher e confirmar o horário.")
            }
          >
            Confirmar criação da rotina
          </button>
          <button className="button" onClick={() => setPreview(null)}>
            Descartar proposta
          </button>
        </Modal>
      )}
    </>
  );
}
