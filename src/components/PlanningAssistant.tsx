import { useState } from "react";
import { useStore } from "../lib/store";
import { labels, type Category, type Plan } from "../lib/types";
import type { PlanningPreference } from "../lib/performance-types";
import { difficulties } from "../lib/performance-types";
import { personalPlan } from "../lib/performance";
import { Badge } from "./ui";
export function PlanningAssistant({
  onSchedule,
}: {
  onSchedule: (plan: Plan) => void;
}) {
  const s = useStore(),
    p = s.data.profile!;
  const [pref, setPref] = useState<PlanningPreference>(
    () =>
      s.data.planningPreferences[0] || {
        id: p.id,
        user_id: p.id,
        weekdays: [1, 3, 5],
        local_time: "18:00",
        minutes: p.minutes,
        focuses: [p.objective],
      },
  );
  const [preview, setPreview] = useState(false);
  const proposal = personalPlan(s.catalog.exercises, p, pref, s.data.sessions);
  const recentDifficulties = [
    ...new Set(s.data.journals.slice(-5).flatMap((j) => j.difficulties)),
  ];
  const favorite = s.catalog.tournaments.find(
    (t) =>
      t.status === "scheduled" &&
      s.data.bookmarks.some(
        (b) => b.kind === "tournament" && b.target_id === t.id,
      ),
  );
  return (
    <details className="panel planning-assistant">
      <summary>
        <strong>Organizar minha semana</strong>
        <span>
          Um plano ajustável com explicações, disponibilidade e preferências.
        </span>
      </summary>
      <p>
        {labels[p.mode]} · {labels[p.level]} · {labels[p.input]}. As sugestões
        são regras de organização, sem uma duração universal ideal.
      </p>
      {!!recentDifficulties.length && (
        <p>
          Dificuldades recentes autodeclaradas:{" "}
          {recentDifficulties.map((d) => difficulties[d]).join(", ")}. Você
          decide se elas devem orientar esta semana.
        </p>
      )}
      {favorite && (
        <p>
          Competição salva: {favorite.title}. Reserve preparação e descanso
          conforme seu calendário; confirme os horários na fonte oficial.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPreview(true);
        }}
      >
        <div className="form-grid">
          <label>
            Minutos por sessão
            <input
              type="number"
              min={15}
              max={120}
              required
              value={pref.minutes}
              onChange={(e) => {
                setPreview(false);
                setPref({ ...pref, minutes: Number(e.target.value) });
              }}
            />
          </label>
          <label>
            Horário preferido ({p.timezone})
            <input
              type="time"
              required
              value={pref.local_time.slice(0, 5)}
              onChange={(e) => setPref({ ...pref, local_time: e.target.value })}
            />
          </label>
        </div>
        <fieldset>
          <legend>Disponibilidade semanal</legend>
          <div className="weekday-picker">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day, i) => (
              <label className="checkbox-label" key={day}>
                <input
                  type="checkbox"
                  checked={pref.weekdays.includes(i)}
                  onChange={(e) =>
                    setPref({
                      ...pref,
                      weekdays: e.target.checked
                        ? [...pref.weekdays, i]
                        : pref.weekdays.filter((d) => d !== i),
                    })
                  }
                />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Focos escolhidos</legend>
          <div className="weekday-picker">
            {(
              [
                "aim",
                "mechanics",
                "piece",
                "competitive",
                "decisions",
                "vod",
              ] as Category[]
            )
              .filter(
                (c) =>
                  p.mode === "build" || !["mechanics", "piece"].includes(c),
              )
              .map((c) => (
                <label className="checkbox-label" key={c}>
                  <input
                    type="checkbox"
                    checked={pref.focuses.includes(c)}
                    onChange={(e) => {
                      setPreview(false);
                      setPref({
                        ...pref,
                        focuses: e.target.checked
                          ? [...pref.focuses, c]
                          : pref.focuses.filter((x) => x !== c),
                      });
                    }}
                  />
                  {labels[c]}
                </label>
              ))}
          </div>
        </fieldset>
        <button
          className="button"
          disabled={!pref.weekdays.length || !pref.focuses.length}
        >
          Propor meu plano
        </button>
      </form>
      {preview && (
        <div className="plan-preview">
          <Badge tone="green">PROPOSTA · VOCÊ MANTÉM O CONTROLE</Badge>
          <ol>
            {proposal.steps.map((step, i) => (
              <li key={step.exercise_id}>
                <strong>
                  {
                    s.catalog.exercises.find((e) => e.id === step.exercise_id)
                      ?.title
                  }{" "}
                  · {step.minutes} min
                </strong>
                <p>{proposal.reasons[i]}</p>
              </li>
            ))}
          </ol>
          <p>
            Ajuste a duração e os exercícios no editor de rotinas depois de
            salvar. A agenda só será criada após sua confirmação.
          </p>
          <button
            className="button primary"
            disabled={s.busy || !proposal.steps.length}
            onClick={() =>
              s.run(async () => {
                await s.save("planningPreferences", pref);
                const plan: Plan = {
                  id: crypto.randomUUID(),
                  user_id: p.id,
                  title: "Meu plano semanal",
                  steps: proposal.steps,
                };
                await s.save("plans", plan);
                setPreview(false);
                onSchedule(plan);
              })
            }
          >
            Criar plano e organizar calendário
          </button>
        </div>
      )}
    </details>
  );
}
