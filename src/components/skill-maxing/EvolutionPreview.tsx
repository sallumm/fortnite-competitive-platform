import { useState } from "react";
import { TrainingBuilder } from "../TrainingBuilder";
import { weekdays } from "../../lib/skill-maxing/config";
import {
  proposalOccurrences,
  proposalIssues,
  type EvolutionProposal,
} from "../../lib/skill-maxing/engine";
import { useStore } from "../../lib/store";
import { stepExercise } from "../../lib/training";
import { Link } from "react-router-dom";
export function EvolutionPreview({
  proposal,
  onChange,
  onConfirm,
}: {
  proposal: EvolutionProposal;
  onChange: (p: EvolutionProposal) => void;
  onConfirm: () => void;
}) {
  const s = useStore();
  const [edit, setEdit] = useState<string | null>(null);
  const selected = proposal.sessions.find((p) => p.id === edit);
  let errors: string[] = [];
  let occurrences: ReturnType<typeof proposalOccurrences> = [];
  try {
    errors = proposalIssues(proposal, s.data, s.catalog);
    occurrences = proposalOccurrences(proposal, s.data);
  } catch {
    errors = ["Confira as datas e os horários no fuso escolhido."];
  }
  return (
    <section className="panel evolution-preview">
      <h2>Prévia do meu plano de evolução</h2>
      <p>
        Nada foi salvo na agenda. Revise exercícios, duração, horários e
        repetições antes de confirmar.
      </p>
      <p>
        {proposal.config.timezone} · {proposal.weeks} semana(s) · regra{" "}
        {proposal.rules_version}. As divisões de tempo são pontos de partida
        editoriais e podem ser editadas.
      </p>
      {proposal.warnings.map((w) => (
        <p className="alert" key={w}>
          {w}
        </p>
      ))}
      {errors.length > 0 && (
        <div role="alert">
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="two-grid">
        {proposal.sessions.map((session) => (
          <article className="panel" key={session.id}>
            <h3>
              {weekdays[new Date(session.date + "T12:00:00Z").getUTCDay()]} ·{" "}
              {session.plan.title}
            </h3>
            <label>
              Horário da sessão · {session.date}
              <input
                type="time"
                value={session.time}
                onChange={(e) =>
                  onChange({
                    ...proposal,
                    sessions: proposal.sessions.map((p) =>
                      p.id === session.id ? { ...p, time: e.target.value } : p,
                    ),
                  })
                }
              />
            </label>
            <p>
              {session.plan.steps.reduce((n, st) => n + st.minutes, 0)} minutos
              · {session.plan.objective}
            </p>
            <ol>
              {session.plan.steps.map((st, i) => {
                const ex = stepExercise(st, s.catalog.exercises);
                return (
                  <li key={st.id || i}>
                    {ex?.title || "Indisponível"} · {st.minutes} min ·{" "}
                    {st.block}
                    {ex && !st.custom && (
                      <span>
                        {" "}
                        ·{" "}
                        <Link to={`/library/${ex.id}`}>Instruções e fonte</Link>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            <details>
              <summary>Por que esta sessão foi sugerida?</summary>
              <ul>
                {session.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <p>
                A prioridade combina competências escolhidas, metas, relatos e
                variedade. Não atribuímos causas nem domínio com base no volume.
              </p>
            </details>
            <button className="button" onClick={() => setEdit(session.id)}>
              Editar exercícios · {session.date}
            </button>
            <button
              className="button"
              onClick={() =>
                onChange({
                  ...proposal,
                  sessions: proposal.sessions.filter(
                    (p) => p.id !== session.id,
                  ),
                })
              }
            >
              Remover sessão · {session.date}
            </button>
          </article>
        ))}
      </div>
      <details>
        <summary>Conferir todas as ocorrências ({occurrences.length})</summary>
        <ol>
          {occurrences.map((o) => (
            <li key={o.key}>
              {new Date(o.starts_at).toLocaleString("pt-BR", {
                timeZone: proposal.config.timezone,
              })}{" "}
              · {o.duration_minutes} min
            </li>
          ))}
        </ol>
      </details>
      <p>
        O servidor verificará novamente conflitos, disponibilidade, catálogo e
        permissões. Qualquer falha cancela a operação inteira.
      </p>
      <button
        className="button primary"
        disabled={s.busy || errors.length > 0}
        onClick={onConfirm}
      >
        Revisar confirmação de agenda
      </button>
      {selected && (
        <TrainingBuilder
          key={selected.id}
          plan={selected.plan}
          onClose={() => setEdit(null)}
          onCommit={async (plan) => {
            onChange({
              ...proposal,
              sessions: proposal.sessions.map((p) =>
                p.id === selected.id
                  ? {
                      ...p,
                      plan,
                      reasons: [
                        "Rotina personalizada por você. Revise os objetivos, instruções e parâmetros das etapas antes de confirmar.",
                      ],
                      skill_ids: [],
                    }
                  : p,
              ),
            });
          }}
        />
      )}
    </section>
  );
}
