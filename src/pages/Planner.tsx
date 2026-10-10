import { TrainingBuilder } from "../components/TrainingBuilder";
import { CoachAccess } from "../components/CoachAccess";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Copy, Edit3, Play, Plus, Trash2 } from "lucide-react";
import { useStore } from "../lib/store";
import type { Plan } from "../lib/types";
import { starterSteps } from "../lib/logic";
import { PlanningCalendar } from "../components/PlanningCalendar";
import { PlanningAssistant } from "../components/PlanningAssistant";
import { Badge, Empty, Heading, Modal } from "../components/ui";
export default function Planner() {
  const s = useStore();
  const p = s.data.profile!;
  const navigate = useNavigate();
  const [edit, setEdit] = useState<Plan | null>(null);
  const [agendaIntent, setAgendaIntent] = useState<Plan | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const create = () =>
    setEdit({
      id: crypto.randomUUID(),
      user_id: p.id,
      title: "Nova rotina",
      steps: [],
    });
  const schedule = (plan: Plan) => setAgendaIntent(plan);
  return (
    <>
      <CoachAccess
        question="Ajude a organizar meus treinos nesta semana."
        label="Ajudar a organizar"
      />
      <Heading
        eyebrow="PLANEJAMENTO"
        title="Seu treino, com direção."
        description="Crie uma rotina, escolha um horário e pratique uma etapa por vez."
        action={
          <button className="button primary" onClick={create}>
            <Plus size={16} />
            Criar rotina
          </button>
        }
      />
      <PlanningAssistant onSchedule={schedule} />
      <div className="template-strip panel">
        <div>
          <span className="eyebrow">UM PONTO DE PARTIDA</span>
          <h3>Rotinas adaptadas ao seu foco</h3>
          <p>Escolha uma duração e ajuste os exercícios antes de salvar.</p>
        </div>
        <div className="row">
          {[30, 45, 60].map((minutes) => (
            <button
              className="button"
              key={minutes}
              onClick={() =>
                setEdit({
                  id: crypto.randomUUID(),
                  user_id: p.id,
                  title: `${minutes} minutos · meu foco`,
                  steps: starterSteps(s.catalog.exercises, p, minutes),
                })
              }
            >
              {minutes} min
            </button>
          ))}
        </div>
      </div>
      <div className="section-title outside">
        <h2>Minhas rotinas</h2>
        <Badge>{s.data.plans.length} rotinas</Badge>
      </div>
      {s.data.plans.length ? (
        <div className="three-grid">
          {s.data.plans.map((plan) => (
            <article className="panel routine-card" key={plan.id}>
              <span className="eyebrow">ROTINA PERSONALIZADA</span>
              <h3>{plan.title}</h3>
              <p>
                {plan.steps.length} etapas ·{" "}
                {plan.steps.reduce((n, x) => n + x.minutes, 0)} min planejados
              </p>
              <ol>
                {plan.steps.map((step, i) => (
                  <li key={i}>
                    {s.catalog.exercises.find((e) => e.id === step.exercise_id)
                      ?.title || "Exercício removido"}
                    <span>{step.minutes} min</span>
                  </li>
                ))}
              </ol>
              <div className="row wrap">
                <button
                  className="button primary small"
                  disabled={s.busy}
                  onClick={() =>
                    s.run(async () => {
                      const active = s.data.sessions.find(
                        (x) => x.status === "active",
                      );
                      const session = active || (await s.start(plan));
                      navigate("/app/session/" + session.id);
                    })
                  }
                >
                  <Play size={14} />
                  Iniciar
                </button>
                <button className="button small" onClick={() => schedule(plan)}>
                  <CalendarDays size={14} />
                  Agendar
                </button>
                <button
                  className="icon-button"
                  aria-label={`Editar ${plan.title}`}
                  onClick={() => setEdit(structuredClone(plan))}
                >
                  <Edit3 size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Duplicar ${plan.title}`}
                  disabled={s.busy}
                  onClick={() =>
                    s.run(() =>
                      s.save("plans", {
                        ...plan,
                        id: crypto.randomUUID(),
                        title: plan.title.slice(0, 70) + " (cópia)",
                      }),
                    )
                  }
                >
                  <Copy size={16} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label={`Excluir ${plan.title}`}
                  onClick={() => setDeleteId(plan.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Seu primeiro plano ainda está por vir">
          Comece com uma rotina sugerida ou monte a sua.
        </Empty>
      )}
      <PlanningCalendar
        intent={agendaIntent}
        onHandled={() => setAgendaIntent(null)}
      />
      <div className="wellbeing-note">
        <p>
          O calendário é uma ferramenta de organização. Não há penalidade por
          descansar ou reagendar.
        </p>
        <Link to="/competitive">Conectar ao competitivo</Link>
      </div>
      {edit && (
        <TrainingBuilder
          key={edit.id}
          plan={edit}
          onClose={() => setEdit(null)}
        />
      )}
      {deleteId && (
        <Modal title="Excluir rotina?" onClose={() => setDeleteId(null)}>
          <p>
            Os agendamentos desta rotina serão removidos. Sessões já registradas
            permanecem no histórico.
          </p>
          <button
            className="button danger"
            disabled={s.busy}
            onClick={() =>
              s.run(async () => {
                await s.remove("plans", deleteId);
                setDeleteId(null);
              })
            }
          >
            Excluir rotina
          </button>
        </Modal>
      )}
    </>
  );
}
