import { ReportEvidence } from "../components/ReportEvidence";
import { reportEvidence } from "../lib/intelligence-report";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import {
  dateInZone,
  expandCalendar,
  shiftDate,
  weekStart,
} from "../lib/calendar";
import { summarize } from "../lib/performance";
import { difficulties } from "../lib/performance-types";
import { dateLabel, download, timeLabel } from "../lib/logic";
import { Badge, Heading } from "../components/ui";
export default function Week() {
  const s = useStore(),
    p = s.data.profile!;
  const current = weekStart(dateInZone(new Date(), p.timezone));
  const [from, setFrom] = useState(current),
    [live, setLive] = useState(false);
  const saved = s.data.weeklyReports.find((r) => r.week_start === from);
  const to = shiftDate(from, 6);
  const build = () => ({
    ...summarize(s.data, from, to),
    evidence: reportEvidence(s.data, s.catalog.exercises, from, to),
  });
  const summary = !live && saved ? saved.summary : build();
  const upcoming = expandCalendar(
    s.data,
    shiftDate(to, 1),
    shiftDate(to, 7),
  ).filter((o) => o.status === "planned");
  const text = [
    "Minha Semana · Clutchfolio",
    `${summary.from} a ${summary.to} (${!live && saved ? saved.timezone : p.timezone})`,
    ...summary.observations,
    ...summary.difficulties.map(
      (d) =>
        `Dificuldade autodeclarada: ${difficulties[d.key]} (${d.count} relatos)`,
    ),
    ...summary.goals.map(
      (g) =>
        `Meta ${g.completed ? "marcada concluída" : "em andamento"}: ${g.title}`,
    ),
    ...summary.suggestions,
    ...(summary.evidence?.diagnostics.map(
      (d) =>
        `${d.kind === "fact" ? "FATO OBSERVADO" : "RECOMENDAÇÃO"}: ${d.title}. ${d.detail}`,
    ) || []),
    ...(summary.evidence?.comparisons.map(
      (c) =>
        `${c.title} (${c.configuration}, ${c.version}): ${c.first} → ${c.last} ${c.unit}; ${c.count} sessões.`,
    ) || []),
    "Método: contagem de registros reais; comparação apenas com configurações identificadas. Marcação manual e registros antigos são identificados; não é avaliação de desempenho em partidas.",
  ].join("\n\n");
  return (
    <>
      <Heading
        eyebrow="MINHA SEMANA"
        title="Revisar. Ajustar. Seguir."
        description="Resumo determinístico dos seus registros. Consulte semanas anteriores e mantenha uma cópia da revisão."
        action={
          <button
            className="button"
            onClick={() =>
              download(text, "clutchfolio-semana-" + from + ".txt")
            }
          >
            Exportar relatório
          </button>
        }
      />
      <div className="panel week-controls">
        <button
          className="button"
          onClick={() => {
            setFrom(shiftDate(from, -7));
            setLive(false);
          }}
        >
          Semana anterior
        </button>
        <label>
          Semana iniciada em
          <input
            type="date"
            max={current}
            value={from}
            onChange={(e) => {
              if (e.target.value) {
                setFrom(weekStart(e.target.value));
                setLive(false);
              }
            }}
          />
        </label>
        <button
          className="button"
          disabled={from >= current}
          onClick={() => {
            setFrom(shiftDate(from, 7));
            setLive(false);
          }}
        >
          Próxima semana
        </button>
        <button
          className="button primary"
          disabled={s.busy}
          onClick={() =>
            s.run(async () => {
              await s.save("weeklyReports", {
                id: saved?.id || crypto.randomUUID(),
                user_id: p.id,
                week_start: from,
                timezone: p.timezone,
                generated_at: new Date().toISOString(),
                summary: build(),
              });
              setLive(false);
            })
          }
        >
          {saved ? "Atualizar meu resumo" : "Gerar meu resumo"}
        </button>
        {saved && (
          <button className="button" onClick={() => setLive(!live)}>
            {live ? "Ver resumo salvo" : "Prévia com dados atuais"}
          </button>
        )}
      </div>
      <section className="panel weekly-summary">
        <Badge tone="green">
          {saved && !live
            ? "RESUMO SALVO · " + dateLabel(saved.generated_at, p.timezone)
            : "PRÉVIA COM REGISTROS ATUAIS"}
        </Badge>
        <h2>
          {dateLabel(from)} a {dateLabel(to)}
        </h2>
        <p className="muted">
          {saved && !live ? saved.timezone : p.timezone} · Semana atual parcial
          até o momento da geração. Metas são o estado na geração, sem data de
          conclusão inferida.
        </p>
        <div className="metrics-grid">
          {[
            [summary.completed, "Sessões concluídas"],
            [summary.planned, "Treinos planejados até agora"],
            [summary.practiceDays, "Dias de prática"],
            [summary.minutes, "Minutos ativos"],
          ].map(([value, label]) => (
            <article className="metric" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>
        <h3>Observações dos registros</h3>
        <ul>
          {summary.observations.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        <p>
          Período anterior completo: {summary.previousCompleted} sessões
          concluídas. Períodos parciais não são equivalentes.
        </p>
        <h3>Dificuldades relatadas</h3>
        {summary.difficulties.length ? (
          <ul>
            {summary.difficulties.map((d) => (
              <li key={d.key}>
                {difficulties[d.key]}: {d.count} registros
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            Nenhuma dificuldade categorizada neste período.
          </p>
        )}
        <h3>Metas no momento da geração</h3>
        {summary.goals.length ? (
          <ul>
            {summary.goals.map((g, i) => (
              <li key={i}>
                {g.title} · {g.completed ? "marcada concluída" : "em andamento"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Sem metas cadastradas.</p>
        )}
        <h3>Sugestões opcionais</h3>
        <ul>
          {summary.suggestions.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        <Link className="button" to="/app/planner">
          Reorganizar minha semana
        </Link>
      </section>
      {summary.evidence ? (
        <ReportEvidence evidence={summary.evidence} />
      ) : (
        <section className="panel">
          <p>
            Este resumo legado não contém diagnósticos detalhados. Use a prévia
            atual ou atualize o resumo para incluí-los.
          </p>
        </section>
      )}
      <section className="panel">
        <h2>Atividades da semana seguinte</h2>
        {!upcoming.length && (
          <p className="muted">
            Nada planejado ainda. Você também pode reservar períodos de
            descanso.
          </p>
        )}
        {upcoming.slice(0, 12).map((o) => (
          <div className="list-row" key={o.key}>
            <div>
              <strong>{o.title}</strong>
              <small>{timeLabel(o.starts_at, p.timezone)}</small>
            </div>
            <Badge>
              {o.kind === "training"
                ? "Treino"
                : o.kind === "rest"
                  ? "Descanso"
                  : "Compromisso"}
            </Badge>
          </div>
        ))}
        <Link className="text-link" to="/app/planner">
          Consultar calendário completo
        </Link>
      </section>
    </>
  );
}
