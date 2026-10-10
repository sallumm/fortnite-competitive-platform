import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Copy,
  Edit3,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
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
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (edit)
      s.run(async () => {
        await s.save("plans", edit);
        setEdit(null);
      });
  };
  const move = (i: number, d: number) => {
    if (!edit) return;
    const steps = [...edit.steps];
    [steps[i], steps[i + d]] = [steps[i + d], steps[i]];
    setEdit({ ...edit, steps });
  };
  const schedule = (plan: Plan) => setAgendaIntent(plan);
  return (
    <>
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
        <Modal title="Editar rotina" onClose={() => setEdit(null)}>
          <form onSubmit={submit}>
            <label>
              Nome
              <input
                autoFocus
                value={edit.title}
                maxLength={80}
                required
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </label>
            <label>
              Adicionar exercício
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value)
                    setEdit({
                      ...edit,
                      steps: [
                        ...edit.steps,
                        { exercise_id: e.target.value, minutes: 10 },
                      ],
                    });
                }}
              >
                <option value="">Escolha um exercício…</option>
                {s.catalog.exercises
                  .filter(
                    (e) =>
                      (e.mode === "both" || e.mode === p.mode) &&
                      !edit.steps.some((st) => st.exercise_id === e.id),
                  )
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
              </select>
            </label>
            {edit.steps.map((step, i) => (
              <div className="step-editor" key={step.exercise_id}>
                <strong>
                  {i + 1}.{" "}
                  {
                    s.catalog.exercises.find((e) => e.id === step.exercise_id)
                      ?.title
                  }
                </strong>
                <label>
                  Minutos
                  <input
                    type="number"
                    min={1}
                    max={120}
                    required
                    value={step.minutes}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        steps: edit.steps.map((x, n) =>
                          n === i
                            ? { ...x, minutes: Number(e.target.value) }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Mover para cima"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Mover para baixo"
                  disabled={i === edit.steps.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label="Remover exercício"
                  onClick={() =>
                    setEdit({
                      ...edit,
                      steps: edit.steps.filter((_, n) => n !== i),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <p className="muted">
              Total: {edit.steps.reduce((n, x) => n + x.minutes, 0)} minutos.
              Ajuste conforme sua disponibilidade.
            </p>
            <button
              className="button primary full"
              disabled={s.busy || !edit.steps.length}
            >
              Salvar rotina
            </button>
          </form>
        </Modal>
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
