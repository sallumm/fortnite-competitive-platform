import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Target,
  Trophy,
  Play,
} from "lucide-react";
import { useStore } from "../lib/store";
import {
  dateLabel,
  progression,
  recommendations,
  timeLabel,
} from "../lib/logic";
import { labels } from "../lib/types";
import { Badge, Empty, Heading, Progress } from "../components/ui";
import { dateInZone, expandCalendar, shiftDate } from "../lib/calendar";
import { summarize } from "../lib/performance";
export default function Dashboard() {
  const s = useStore(),
    p = s.data.profile!,
    navigate = useNavigate(),
    now = new Date();
  const today = dateInZone(now, p.timezone);
  const agenda = expandCalendar(s.data, today, shiftDate(today, 7)).filter(
    (o) => o.status !== "cancelled",
  );
  const todayAgenda = agenda.filter(
    (o) => dateInZone(o.starts_at, p.timezone) === today,
  );
  const primary = todayAgenda.find(
    (o) => o.kind === "training" && o.status === "planned",
  );
  const next =
    primary ||
    agenda.find((o) => o.kind === "training" && o.status === "planned");
  const active = s.data.sessions.find((x) => x.status === "active");
  const plan =
    s.data.plans.find((x) => x.id === next?.plan_id) || s.data.plans[0];
  const last = s.data.sessions
    .filter((x) => x.status !== "active")
    .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))[0];
  const diary = s.data.journals.find((j) => j.session_id === last?.id);
  const pending = expandCalendar(s.data, shiftDate(today, -30), today).filter(
    (o) =>
      o.status === "planned" &&
      Date.parse(o.starts_at) + o.duration_minutes * 60000 < now.getTime(),
  );
  const recent = summarize(s.data, shiftDate(today, -6), today, now);
  const rank = progression(s.data.xp.reduce((n, x) => n + x.amount, 0));
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: p.timezone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const nearest = s.catalog.tournaments
    .filter(
      (t) =>
        s.data.bookmarks.some(
          (b) => b.kind === "tournament" && b.target_id === t.id,
        ) &&
        t.end_date >= today &&
        !["finished", "cancelled", "postponed"].includes(t.status),
    )
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const rec = recommendations(s.catalog.exercises, p).slice(0, 3);
  const practiced = [
    ...new Set(
      s.data.sessions
        .filter((x) => x.status === "completed")
        .flatMap((x) =>
          x.steps.map((st) => st.exercise?.category).filter(Boolean),
        ),
    ),
  ];
  const start = () =>
    s.run(async () => {
      if (active) {
        navigate("/app/session/" + active.id);
        return;
      }
      if (plan) {
        const session = await s.start(
          plan,
          next?.plan_id === plan.id ? next : undefined,
        );
        navigate("/app/session/" + session.id);
      } else navigate("/app/planner");
    });
  return (
    <>
      <Heading
        eyebrow={`${dateLabel(today)} · ${p.timezone}`}
        title="Meu Dia"
        description={`${greeting}, ${p.display_name}. ${todayAgenda.length ? `${todayAgenda.filter((o) => o.status === "done").length} de ${todayAgenda.length} atividades de hoje concluídas.` : "Seu dia ainda está livre para organizar."}`}
        action={
          <Link className="button" to="/app/week">
            Minha Semana <ArrowRight size={16} />
          </Link>
        }
      />
      <div className="dashboard-top">
        <section className="next-training">
          <div className="row between">
            <Badge tone="green">
              {active
                ? "SESSÃO EM ANDAMENTO"
                : primary
                  ? "TREINO PRINCIPAL DE HOJE"
                  : next
                    ? "PRÓXIMO TREINO PLANEJADO"
                    : "SEU PRÓXIMO PASSO"}
            </Badge>
            <Target size={23} />
          </div>
          <h2>
            {active?.title ||
              plan?.title ||
              "Escolha um objetivo para sua primeira sessão."}
          </h2>
          <p>
            Objetivo principal: {labels[p.objective]} · {labels[p.mode]}
          </p>
          <div className="row">
            <span>
              <Clock size={16} />
              {plan?.steps.reduce((n, x) => n + x.minutes, 0) || p.minutes} min
              planejados
            </span>
            {next && (
              <span>
                <CalendarDays size={16} />
                {timeLabel(next.starts_at, p.timezone)}
              </span>
            )}
          </div>
          <button className="button primary" onClick={start} disabled={s.busy}>
            <Play size={16} />
            {active ? "Retomar treino" : "Começar meu treino"}
            <ArrowUpRight size={17} />
          </button>
          <div className="training-line" />
        </section>
        <section className="panel rank-card">
          <span className="eyebrow">EVOLUÇÃO RECENTE · 7 DIAS</span>
          <h2>{recent.completed} sessões concluídas</h2>
          <p>
            {recent.minutes} minutos ativos · {recent.practiceDays} dias com
            prática registrada.
          </p>
          <div className="rank-label">
            <span>
              {rank.rank} · {rank.progress} / 500 XP
            </span>
            <Trophy size={16} />
          </div>
          <Progress value={rank.progress} max={500} />
          <p className="small-text muted">
            XP mede participação registrada. Descansar não reduz seu progresso.
          </p>
          <Link className="text-link" to="/app/progression">
            Regras e conquistas <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="quick-actions">
        <Link className="button" to="/app/planner">
          Organizar minha semana
        </Link>
        <Link className="button" to="/app/reports">
          Ver minha evolução
        </Link>
        <Link className="button" to="/app/reports#metas">
          Criar uma meta
        </Link>
        <Link className="button" to="/app/planner">
          Consultar meu calendário
        </Link>
        {last && (
          <Link className="button" to={"/app/journal/" + last.id}>
            Revisar meu último treino
          </Link>
        )}
      </div>
      <div className="two-grid">
        <section className="panel">
          <div className="section-title">
            <h2>Hoje e próximas atividades</h2>
            <Link to="/app/planner">
              Abrir agenda <ArrowRight size={15} />
            </Link>
          </div>
          {agenda.length ? (
            agenda.slice(0, 5).map((o) => (
              <div className="list-row" key={o.key}>
                <CalendarDays size={20} />
                <div>
                  <strong>{o.title}</strong>
                  <small>
                    {timeLabel(o.starts_at, p.timezone)} · {o.duration_minutes}{" "}
                    min
                  </small>
                </div>
                <Badge tone={o.status === "done" ? "green" : "gray"}>
                  {o.status === "done"
                    ? "Concluída"
                    : o.kind === "training"
                      ? "Treino"
                      : o.kind === "rest"
                        ? "Descanso"
                        : "Compromisso"}
                </Badge>
              </div>
            ))
          ) : (
            <Empty title="Uma semana para organizar">
              Escolha quando praticar, estudar e descansar.{" "}
              <Link className="text-link" to="/app/planner">
                Planejar minha primeira atividade
              </Link>
            </Empty>
          )}
          {pending.length > 0 && (
            <div className="pending-note">
              <strong>
                {pending.length} atividades pendentes nos últimos 30 dias.
              </strong>
              <p>Revise o que ainda faz sentido e reagende sem penalidade.</p>
              <Link className="text-link" to="/app/planner">
                Revisar pendências
              </Link>
            </div>
          )}
        </section>
        <section className="panel">
          <h2>Meu foco e minhas metas</h2>
          {s.data.goals.filter((g) => !g.completed).length ? (
            s.data.goals
              .filter((g) => !g.completed)
              .slice(0, 3)
              .map((g) => (
                <div className="list-row" key={g.id}>
                  <Target size={20} />
                  <div>
                    <strong>{g.title}</strong>
                    <small>
                      Quantidade desejada: {g.target} · conclusão autodeclarada
                    </small>
                  </div>
                </div>
              ))
          ) : (
            <p className="muted">
              Nenhuma meta em andamento. Defina um objetivo específico para
              orientar seu próximo treino.
            </p>
          )}
          <p>
            Áreas praticadas:{" "}
            {practiced.length
              ? practiced.map((c) => labels[c!]).join(", ")
              : "ainda sem registros"}
            .
          </p>
          <Link className="text-link" to="/app/skills">
            Minhas Habilidades <ArrowRight size={15} />
          </Link>
          {nearest && (
            <div className="pending-note">
              <span className="eyebrow">CAMPEONATO SALVO MAIS PRÓXIMO</span>
              <Link to={"/competitive/" + nearest.slug}>
                <h3>{nearest.title}</h3>
              </Link>
              <p>
                {dateLabel(nearest.start_date)} ·{" "}
                {nearest.starts_at
                  ? timeLabel(nearest.starts_at, p.timezone)
                  : "Confirme o horário na fonte oficial."}
              </p>
            </div>
          )}
        </section>
      </div>
      {last && (
        <section className="panel day-review">
          <div>
            <span className="eyebrow">ÚLTIMA SESSÃO</span>
            <h2>{last.title}</h2>
            <p>
              {dateLabel(last.completed_at!, p.timezone)} ·{" "}
              {last.status === "completed" ? "concluída" : "interrompida"} ·{" "}
              {Math.round(last.duration_seconds / 60)} min ativos.
            </p>
            {diary?.next_focus && (
              <p>Próximo foco escolhido por você: {diary.next_focus}</p>
            )}
          </div>
          <Link className="button" to={"/app/journal/" + last.id}>
            Revisar meu último treino
          </Link>
        </section>
      )}
      <div className="section-title outside">
        <div>
          <span className="eyebrow">RECOMENDAÇÕES POR REGRAS</span>
          <h2>Pratique com intenção</h2>
          <p className="muted">
            Prioridade: seu foco, modalidade e nível. Você pode ajustar qualquer
            sugestão.
          </p>
        </div>
        <Link to="/library">
          Biblioteca completa <ArrowRight size={15} />
        </Link>
      </div>
      <div className="three-grid">
        {rec.map((e) => (
          <Link
            key={e.id}
            className="exercise-mini panel"
            to={"/library/" + e.id}
          >
            <Badge>{labels[e.category]}</Badge>
            <h3>{e.title}</h3>
            <p>{e.description}</p>
            <span className="text-link">
              Ver exercício <ArrowUpRight size={16} />
            </span>
          </Link>
        ))}
      </div>
      <div className="wellbeing-note">
        <span className="dot" />
        <p>
          Reserve pausas, estudos e descanso. Revise duração e prioridades antes
          de uma competição.
        </p>
        <Link to="/academy">
          Recursos educativos <ArrowUpRight size={14} />
        </Link>
      </div>
    </>
  );
}
