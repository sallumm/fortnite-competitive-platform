import {
  knowledge,
  purposeLabels,
  type ExerciseResearch,
} from "../lib/training-research";
export function ExerciseResearchEditor({
  value,
  mode,
  onChange,
}: {
  value?: ExerciseResearch | null;
  mode: string;
  onChange: (value: ExerciseResearch) => void;
}) {
  if (!value)
    return (
      <section className="panel">
        <h3>Revisão de aprendizagem</h3>
        <p>
          Adicione competências, referências e critérios sem alterar o protocolo
          histórico.
        </p>
        <button
          type="button"
          className="button"
          onClick={() =>
            onChange({
              competency_ids: [],
              evidence_ids: ["editorial"],
              purpose: "technical",
              completion: "",
              transfer: "",
              limitations: "",
              review_status: "pending",
              review_due_at: new Date(Date.now() + 30 * 864e5).toISOString(),
              review_notes: "",
            })
          }
        >
          Adicionar contexto de pesquisa
        </button>
      </section>
    );
  const patch = (p: Partial<ExerciseResearch>) => onChange({ ...value, ...p });
  return (
    <fieldset>
      <legend>Revisão de aprendizagem</legend>
      <p>
        Confirme a fonte e o procedimento. “Revisado” não significa eficácia
        comprovada. Para retirar, desmarque a publicação.
      </p>
      <div className="form-grid">
        <label>
          Finalidade
          <select
            value={value.purpose}
            onChange={(e) =>
              patch({ purpose: e.target.value as ExerciseResearch["purpose"] })
            }
          >
            {Object.entries(purposeLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status da revisão
          <select
            value={value.review_status}
            onChange={(e) =>
              patch({
                review_status: e.target
                  .value as ExerciseResearch["review_status"],
              })
            }
          >
            <option value="pending">Pendente</option>
            <option value="verified">Metadados revisados</option>
            <option value="retired">Retirado</option>
          </select>
        </label>
        <label>
          Revisar até (UTC)
          <input
            type="date"
            value={value.review_due_at.slice(0, 10)}
            onChange={(e) =>
              e.target.value &&
              patch({ review_due_at: e.target.value + "T00:00:00Z" })
            }
          />
        </label>
        {(
          [
            ["completion", "Critério de conclusão"],
            ["transfer", "Aplicação em partida"],
            ["limitations", "Limitações"],
            ["review_notes", "Notas da revisão"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea
              required
              minLength={key === "review_notes" ? 10 : 20}
              maxLength={1000}
              value={value[key]}
              onChange={(e) => patch({ [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <details>
        <summary>
          Selecionar competências ({value.competency_ids.length})
        </summary>
        {knowledge.competencies
          .filter((c) => c.mode === "both" || c.mode === mode)
          .map((c) => (
            <label className="checkbox-label" key={c.id}>
              <input
                type="checkbox"
                checked={value.competency_ids.includes(c.id)}
                onChange={(e) =>
                  patch({
                    competency_ids: e.target.checked
                      ? [...value.competency_ids, c.id]
                      : value.competency_ids.filter((id) => id !== c.id),
                  })
                }
              />
              {c.title}
            </label>
          ))}
      </details>
      <details>
        <summary>Selecionar referências ({value.evidence_ids.length})</summary>
        {knowledge.references
          .filter((r) => r.access !== "unavailable")
          .map((r) => (
            <label className="checkbox-label" key={r.id}>
              <input
                type="checkbox"
                checked={value.evidence_ids.includes(r.id)}
                onChange={(e) =>
                  patch({
                    evidence_ids: e.target.checked
                      ? [...value.evidence_ids, r.id]
                      : value.evidence_ids.filter((id) => id !== r.id),
                  })
                }
              />
              {r.title}
            </label>
          ))}
      </details>
    </fieldset>
  );
}
