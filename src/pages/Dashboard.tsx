import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Target,
  Trophy,
  Play,
  CheckCircle2,
} from "lucide-react";
import { useStore } from "../lib/store";
import {
  dateLabel,
  progression,
  recommendations,
  stats,
  timeLabel,
} from "../lib/logic";
import { labels } from "../lib/types";
import { Badge, Empty, Heading, Progress } from "../components/ui";
export default function Dashboard() {
  const s = useStore();
  const navigate = useNavigate();
  const p = s.data.profile!;
  const counts = stats(s.data.sessions);
  const rank = progression(s.data.xp.reduce((n, x) => n + x.amount, 0));
  const next = s.data.schedules
    .filter((x) => new Date(x.starts_at) > new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const active = s.data.sessions.find((x) => x.status === "active");
  const plan =
    s.data.plans.find((x) => x.id === next?.plan_id) || s.data.plans[0];
  const rec = recommendations(s.catalog.exercises, p).slice(0, 3);
  const start = () =>
    s.run(async () => {
      if (active) {
        navigate("/app/session/" + active.id);
        return;
      }
      if (plan) {
        const session = await s.start(plan);
        navigate("/app/session/" + session.id);
      } else navigate("/app/planner");
    });
  return (
    <>
      <Heading
        eyebrow="SEU PLANO DE JOGO"
        title={`Vamos ao próximo passo, ${p.display_name}.`}
        description="Uma sessão com objetivo vale mais que um treino sem direção."
        action={
          <Link className="button" to="/app/planner">
            <CalendarDays size={16} />
            Organizar semana
          </Link>
        }
      />
      <div className="dashboard-top">
        <section className="next-training">
          <div className="row between">
            <Badge tone="green">
              {active ? "SESSÃO EM ANDAMENTO" : "SEU PRÓXIMO TREINO"}
            </Badge>
            <Target size={23} />
          </div>
          <h2>
            {active?.title || plan?.title || "Dê direção à sua próxima sessão."}
          </h2>
          <p>
            {labels[p.objective]} · {labels[p.mode]}
          </p>
          <div className="row">
            <span>
              <Clock size={16} />
              {plan
                ? plan.steps.reduce((n, x) => n + x.minutes, 0)
                : p.minutes}{" "}
              min planejados
            </span>
            <span>
              <LayersIcon />
              {plan?.steps.length || 0} etapas
            </span>
          </div>
          <button className="button primary" onClick={start} disabled={s.busy}>
            <Play size={16} />
            {active ? "Retomar treino" : "Iniciar meu treino"}
            <ArrowUpRight size={17} />
          </button>
          <div className="training-line" />
        </section>
        <section className="panel rank-card">
          <span className="eyebrow">SUA PROGRESSÃO</span>
          <div className="rank-row">
            <div className="rank-shape">{Math.floor(counts.xp / 500) + 1}</div>
            <div>
              <h2>{rank.rank}</h2>
              <p>Nível {rank.level}</p>
            </div>
          </div>
          <div className="rank-label">
            <span>{rank.progress} / 500 XP</span>
            <Trophy size={16} />
          </div>
          <Progress value={rank.progress} max={500} />
          <p className="small-text muted">
            Participação registrada. Não representa seu rank oficial ou sua
            habilidade.
          </p>
          <Link className="text-link" to="/app/progression">
            Regras e conquistas
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="metrics-grid">
        {[
          [CheckCircle2, "Sessões concluídas", counts.count],
          [Clock, "Minutos registrados", counts.minutes],
          [
            CalendarDays,
            "Treinos agendados",
            s.data.schedules.filter((x) => new Date(x.starts_at) > new Date())
              .length,
          ],
          [
            Target,
            "Metas concluídas",
            s.data.goals.filter((g) => g.completed).length,
          ],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof Clock;
          return (
            <article className="metric" key={String(label)}>
              <I size={18} />
              <strong>{value as number}</strong>
              <span>{label as string}</span>
            </article>
          );
        })}
      </div>
      <div className="two-grid">
        <section className="panel">
          <div className="section-title">
            <h2>Sua agenda</h2>
            <Link to="/app/planner">
              Ver calendário
              <ArrowRight size={15} />
            </Link>
          </div>
          {s.data.schedules.length ? (
            s.data.schedules
              .slice()
              .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
              .slice(0, 4)
              .map((x) => (
                <div className="list-row" key={x.id}>
                  <CalendarDays size={20} />
                  <div>
                    <strong>
                      {s.data.plans.find((p) => p.id === x.plan_id)?.title ||
                        "Treino"}
                    </strong>
                    <small>{timeLabel(x.starts_at, p.timezone)}</small>
                  </div>
                  <Badge>{labels[p.mode]}</Badge>
                </div>
              ))
          ) : (
            <Empty title="Uma semana para organizar">
              Adicione seu primeiro treino à agenda.
              <Link to="/app/planner" className="text-link">
                Planejar uma sessão
                <ArrowRight size={14} />
              </Link>
            </Empty>
          )}
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>Atividade recente</h2>
            <Link to="/app/reports">
              Meu histórico
              <ArrowRight size={15} />
            </Link>
          </div>
          {counts.count ? (
            s.data.sessions
              .filter((x) => x.status === "completed")
              .slice(0, 4)
              .map((x) => (
                <div className="list-row" key={x.id}>
                  <CheckCircle2 size={20} className="green-text" />
                  <div>
                    <strong>{x.title}</strong>
                    <small>
                      {dateLabel(x.completed_at!, p.timezone)} ·{" "}
                      {Math.round(x.duration_seconds / 60)} min
                    </small>
                  </div>
                  <Badge tone="green">+{x.xp} XP</Badge>
                </div>
              ))
          ) : (
            <Empty title="Seu histórico começa com você">
              Conclua uma sessão para acompanhar a evolução dos seus próprios
              registros.
            </Empty>
          )}
        </section>
      </div>
      <div className="section-title outside">
        <div>
          <span className="eyebrow">ESCOLHIDOS PARA SEU FOCO</span>
          <h2>Pratique com intenção</h2>
        </div>
        <Link to="/library">
          Biblioteca completa
          <ArrowRight size={15} />
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
              Ver exercício
              <ArrowUpRight size={16} />
            </span>
          </Link>
        ))}
      </div>
      <div className="wellbeing-note">
        <span className="dot" />
        <p>
          Seu plano pode mudar. Ajuste a duração, faça pausas e preserve seu
          descanso.
        </p>
        <Link to="/academy">
          Entender a evidência
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </>
  );
}
function LayersIcon() {
  return <Target size={16} />;
}
