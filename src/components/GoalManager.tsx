import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { skills, type Skill } from "../lib/performance-types";
import { goalState } from "../lib/intelligence";
import { resultGroups } from "../lib/performance";
import type { Goal } from "../lib/types";
import { Badge, Modal } from "./ui";
const states = {
  active: "Em andamento",
  paused: "Pausada",
  completed: "Concluída por você",
  archived: "Arquivada",
} as const;
export function GoalManager() {
  const s = useStore();
  const [editing, setEditing] = useState<Goal | null>(null),
    [open, setOpen] = useState(false),
    [showArchived, setShowArchived] = useState(false);
  return (
    <section className="panel" id="goals">
      <div className="section-title">
        <h2>Objetivos e metas</h2>
        <button
          className="button primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Criar meta
        </button>
      </div>
      <p className="muted">
        Critérios observáveis e protocolos individuais. Atingir um valor não
        conclui a meta automaticamente.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Mostrar metas arquivadas
      </label>
      {s.data.goals
        .filter((g) => showArchived || goalState(g) !== "archived")
        .map((g) => {
          const state = goalState(g),
            m = g.measurement;
          const groups = m
            ? resultGroups(s.data.sessions, m.exercise_id).filter(
                (x) =>
                  x.unit === m.unit &&
                  x.version === m.version &&
                  x.configuration === m.configuration,
              )
            : [];
          const recent = groups.length === 1 ? groups[0].points.at(-1) : null;
          const linked = new Set([
            ...(g.exercise_ids || []),
            ...(m ? [m.exercise_id] : []),
          ]);
          const routines = s.data.plans.filter((p) =>
            p.steps.some((st) => linked.has(st.exercise_id)),
          );
          return (
            <article className="goal" key={g.id}>
              <div className="row between wrap">
                <h3>{g.title}</h3>
                <Badge>{states[state]}</Badge>
              </div>
              <p>
                {g.criteria ||
                  "Critério ainda não informado. Defina o que deseja registrar."}
              </p>
              <p className="muted">
                {g.skill ? skills[g.skill] + " · " : ""}
                {g.due_date || m?.deadline || "Sem prazo obrigatório"}
              </p>
              {m && (
                <p>
                  {m.baseline} → {m.desired} {m.unit} · {m.configuration} ·{" "}
                  {m.version}.{" "}
                  {recent
                    ? `Último resultado: ${recent.value} ${m.unit}.`
                    : groups.length > 1
                      ? "Condições diferentes; selecione o grupo nos relatórios."
                      : "Sem medição comparável."}
                </p>
              )}
              <div className="row wrap">
                {s.catalog.exercises
                  .filter((e) => linked.has(e.id))
                  .map((e) => (
                    <Link
                      className="text-link"
                      key={e.id}
                      to={"/library/" + e.id}
                    >
                      {e.title}
                    </Link>
                  ))}
              </div>
              <p className="small-text">
                Rotinas relacionadas:{" "}
                {routines.map((p) => p.title).join(", ") ||
                  "nenhuma rotina vinculada pelo exercício"}
                . Associação não comprova que uma sessão atendeu à meta.
              </p>
              <div className="row wrap">
                <button
                  className="button small"
                  onClick={() => {
                    setEditing(g);
                    setOpen(true);
                  }}
                >
                  Editar meta {g.title}
                </button>
                {Object.entries(states)
                  .filter(([key]) => key !== state)
                  .map(([key]) => (
                    <button
                      key={key}
                      className="button small"
                      disabled={s.busy}
                      onClick={() =>
                        s.run(() =>
                          s.save("goals", {
                            ...g,
                            status: key as keyof typeof states,
                            completed: key === "completed",
                          }),
                        )
                      }
                    >
                      {key === "active"
                        ? "Retomar"
                        : key === "paused"
                          ? "Pausar"
                          : key === "completed"
                            ? "Concluir"
                            : "Arquivar"}{" "}
                      meta
                    </button>
                  ))}
              </div>
              <details>
                <summary>Histórico desta meta</summary>
                {s.data.goalRevisions
                  .filter((r) => r.goal_id === g.id)
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((r) => (
                    <div className="list-row" key={r.id}>
                      <div>
                        <strong>
                          {new Date(r.created_at).toLocaleString("pt-BR", {
                            timeZone: s.data.profile!.timezone,
                          })}{" "}
                          · {states[goalState(r.after_value)]}
                        </strong>
                        <small>
                          {r.before_value ? "Alteração" : "Criação"} ·{" "}
                          {r.after_value.title}
                        </small>
                        <p>
                          {r.after_value.criteria || "Sem critério informado."}
                        </p>
                        {r.after_value.measurement && (
                          <small>
                            {r.after_value.measurement.baseline} →{" "}
                            {r.after_value.measurement.desired}{" "}
                            {r.after_value.measurement.unit} ·{" "}
                            {r.after_value.measurement.configuration}
                          </small>
                        )}
                      </div>
                    </div>
                  ))}
              </details>
            </article>
          );
        })}
      {!s.data.goals.length && (
        <p className="muted">
          Defina uma ação ou um teste específico. Não existe obrigação de
          aumentar suas horas de prática.
        </p>
      )}
      {open && (
        <GoalEditor
          key={editing?.id || "new"}
          goal={editing}
          close={() => setOpen(false)}
        />
      )}
    </section>
  );
}
function GoalEditor({ goal, close }: { goal: Goal | null; close: () => void }) {
  const s = useStore(),
    owner = s.data.profile!.id;
  const [title, setTitle] = useState(goal?.title || ""),
    [criteria, setCriteria] = useState(goal?.criteria || ""),
    [skill, setSkill] = useState<Skill | "">(goal?.skill || ""),
    [ids, setIds] = useState(goal?.exercise_ids || []),
    [deadline, setDeadline] = useState(
      goal?.due_date || goal?.measurement?.deadline || "",
    ),
    [test, setTest] = useState(!!goal?.measurement),
    [exercise, setExercise] = useState(goal?.measurement?.exercise_id || ""),
    [baseline, setBaseline] = useState(goal?.measurement?.baseline || 0),
    [desired, setDesired] = useState(goal?.measurement?.desired || 0),
    [configuration, setConfiguration] = useState(
      goal?.measurement?.configuration || "",
    );
  const e = s.catalog.exercises.find((e) => e.id === exercise),
    m = e?.measurement;
  return (
    <Modal title={goal ? "Editar meta" : "Criar meta"} onClose={close}>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          s.run(async () => {
            await s.save("goals", {
              ...goal,
              id: goal?.id || crypto.randomUUID(),
              user_id: owner,
              title,
              criteria,
              skill: skill || null,
              exercise_ids: ids,
              due_date: deadline || null,
              target: goal?.target || 1,
              completed: goal?.completed || false,
              status: goalState(goal || ({ completed: false } as Goal)),
              measurement:
                test && m
                  ? {
                      exercise_id: exercise,
                      unit: m.unit,
                      version: m.version,
                      baseline,
                      desired,
                      configuration: configuration.trim(),
                      ...(deadline ? { deadline } : {}),
                    }
                  : null,
            });
            close();
          });
        }}
      >
        <label>
          Nome da meta
          <input
            required
            maxLength={100}
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
          />
        </label>
        <label>
          Critério de conclusão
          <textarea
            maxLength={500}
            value={criteria}
            onChange={(ev) => setCriteria(ev.target.value)}
            placeholder="Que ação ou resultado específico vou observar?"
          />
        </label>
        <div className="form-grid">
          <label>
            Habilidade da meta
            <select
              value={skill}
              onChange={(ev) => setSkill(ev.target.value as Skill | "")}
            >
              <option value="">Não especificada</option>
              {Object.entries(skills).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prazo da meta (opcional)
            <input
              type="date"
              value={deadline}
              onChange={(ev) => setDeadline(ev.target.value)}
            />
          </label>
        </div>
        <fieldset>
          <legend>Exercícios relacionados</legend>
          <div className="intelligence-picker">
            {s.catalog.exercises
              .filter(
                (e) =>
                  e.published &&
                  (e.mode === "both" || e.mode === s.data.profile!.mode),
              )
              .map((e) => (
                <label className="checkbox-label" key={e.id}>
                  <input
                    type="checkbox"
                    checked={ids.includes(e.id)}
                    disabled={!ids.includes(e.id) && ids.length >= 20}
                    onChange={(ev) =>
                      setIds(
                        ev.target.checked
                          ? [...ids, e.id]
                          : ids.filter((x) => x !== e.id),
                      )
                    }
                  />
                  {e.title}
                </label>
              ))}
          </div>
        </fieldset>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={test}
            onChange={(ev) => setTest(ev.target.checked)}
          />
          Acompanhar um protocolo numérico
        </label>
        {test && (
          <>
            <label>
              Protocolo da meta
              <select
                required
                value={exercise}
                onChange={(ev) => setExercise(ev.target.value)}
              >
                <option value="">Escolha um exercício</option>
                {s.catalog.exercises
                  .filter(
                    (e) =>
                      e.measurement &&
                      e.published &&
                      (e.mode === "both" || e.mode === s.data.profile!.mode),
                  )
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
              </select>
            </label>
            {m && (
              <p>
                {m.procedure} Unidade: {m.unit} · versão: {m.version}.
              </p>
            )}
            <div className="form-grid">
              <label>
                Valor inicial da meta
                <input
                  type="number"
                  step="any"
                  required
                  min={m?.min || 0}
                  max={m?.max || 1000000}
                  value={baseline}
                  onChange={(ev) => setBaseline(Number(ev.target.value))}
                />
              </label>
              <label>
                Alvo da meta
                <input
                  type="number"
                  step="any"
                  required
                  min={m?.min || 0}
                  max={m?.max || 1000000}
                  value={desired}
                  onChange={(ev) => setDesired(Number(ev.target.value))}
                />
              </label>
            </div>
            <label>
              Cenário e configuração da meta
              <input
                required
                maxLength={200}
                value={configuration}
                onChange={(ev) => setConfiguration(ev.target.value)}
              />
            </label>
          </>
        )}
        <button className="button primary" disabled={s.busy || (test && !m)}>
          Salvar meta
        </button>
      </form>
    </Modal>
  );
}
