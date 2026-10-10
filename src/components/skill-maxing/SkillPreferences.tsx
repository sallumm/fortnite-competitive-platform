import { useState } from "react";
import { knowledge } from "../../lib/training-research";
import { trainingCategories } from "../../lib/training";
import type { EvolutionConfig } from "../../lib/skill-maxing/config";
export function SkillPreferences({
  config,
  onChange,
}: {
  config: EvolutionConfig;
  onChange: (c: EvolutionConfig) => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all");
  const list = knowledge.competencies.filter(
    (k) =>
      (k.mode === "both" || k.mode === config.mode) &&
      (category === "all" || k.category === category) &&
      `${k.title} ${k.definition}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  return (
    <section className="panel">
      <h2>O que quero desenvolver?</h2>
      <p>
        Combine até 12 competências. Importância relativa orienta a seleção
        editorial; não é uma nota de habilidade.
      </p>
      <div className="form-grid">
        <label>
          Buscar competência
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Shotgun, Piece Control, Endgame…"
          />
        </label>
        <label>
          Categoria de competência
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">Todas</option>
            {Object.entries(trainingCategories).map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="two-grid">
        {list.map((k) => {
          const chosen = config.skills.find((s) => s.id === k.id);
          return (
            <div className="skill-choice" key={k.id}>
              <label className="row">
                <input
                  type="checkbox"
                  checked={!!chosen}
                  disabled={!chosen && config.skills.length >= 12}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      skills: e.target.checked
                        ? [...config.skills, { id: k.id, weight: 3 }]
                        : config.skills.filter((s) => s.id !== k.id),
                    })
                  }
                />
                {k.title}
              </label>
              <p className="small-text muted">{k.definition}</p>
              {chosen && (
                <label>
                  Importância · {k.title}
                  <select
                    value={chosen.weight}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        skills: config.skills.map((s) =>
                          s.id === k.id
                            ? { ...s, weight: Number(e.target.value) }
                            : s,
                        ),
                      })
                    }
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                        {n === 5 ? " · Prioridade principal" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          );
        })}
      </div>
      <p role="status">{config.skills.length} competências selecionadas.</p>
    </section>
  );
}
