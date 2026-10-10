import type { EvolutionConfig } from "../../lib/skill-maxing/config";
import { weekdays } from "../../lib/skill-maxing/config";
export function AvailabilityEditor({
  config,
  onChange,
}: {
  config: EvolutionConfig;
  onChange: (c: EvolutionConfig) => void;
}) {
  return (
    <section className="panel">
      <h2>Minha disponibilidade semanal</h2>
      <p>
        Informe janelas permitidas e o tempo desejado para a sessão. Intervalos
        sem treino continuam livres. Um dia sem janela é descanso ou
        indisponibilidade, sem penalidade.
      </p>
      {[1, 2, 3, 4, 5, 6, 0].map((day) => (
        <fieldset key={day}>
          <legend>{weekdays[day]}</legend>
          {config.windows
            .filter((w) => w.weekday === day)
            .map((w) => (
              <div className="availability-window form-grid" key={w.id}>
                <label>
                  Início · {weekdays[day]}
                  <input
                    type="time"
                    value={w.start}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        windows: config.windows.map((x) =>
                          x.id === w.id ? { ...x, start: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Fim · {weekdays[day]}
                  <input
                    type="time"
                    value={w.end}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        windows: config.windows.map((x) =>
                          x.id === w.id ? { ...x, end: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Minutos de treino · {weekdays[day]}
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={w.minutes}
                    onChange={(e) =>
                      onChange({
                        ...config,
                        windows: config.windows.map((x) =>
                          x.id === w.id
                            ? { ...x, minutes: Number(e.target.value) }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="button"
                  aria-label={`Remover intervalo de ${weekdays[day]}`}
                  onClick={() =>
                    onChange({
                      ...config,
                      windows: config.windows.filter((x) => x.id !== w.id),
                    })
                  }
                >
                  Remover
                </button>
              </div>
            ))}
          <button
            type="button"
            className="button"
            disabled={config.windows.length >= 42}
            onClick={() =>
              onChange({
                ...config,
                windows: [
                  ...config.windows,
                  {
                    id: crypto.randomUUID(),
                    weekday: day,
                    start: "17:00",
                    end: "18:00",
                    minutes: 30,
                  },
                ],
              })
            }
          >
            Adicionar intervalo · {weekdays[day]}
          </button>
        </fieldset>
      ))}
      <h3>Compromissos pessoais opcionais</h3>
      <p>
        Reserve apenas dia e horário; não informe detalhes privados.
        Compromissos já cadastrados na agenda também serão considerados.
      </p>
      {config.blocked.map((b) => (
        <div className="form-grid" key={b.id}>
          <label>
            Dia reservado
            <select
              value={b.weekday}
              onChange={(e) =>
                onChange({
                  ...config,
                  blocked: config.blocked.map((x) =>
                    x.id === b.id
                      ? { ...x, weekday: Number(e.target.value) }
                      : x,
                  ),
                })
              }
            >
              {weekdays.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            Início da reserva
            <input
              type="time"
              value={b.start}
              onChange={(e) =>
                onChange({
                  ...config,
                  blocked: config.blocked.map((x) =>
                    x.id === b.id ? { ...x, start: e.target.value } : x,
                  ),
                })
              }
            />
          </label>
          <label>
            Fim da reserva
            <input
              type="time"
              value={b.end}
              onChange={(e) =>
                onChange({
                  ...config,
                  blocked: config.blocked.map((x) =>
                    x.id === b.id ? { ...x, end: e.target.value } : x,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className="button"
            onClick={() =>
              onChange({
                ...config,
                blocked: config.blocked.filter((x) => x.id !== b.id),
              })
            }
          >
            Remover reserva
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button"
        disabled={config.blocked.length >= 42}
        onClick={() =>
          onChange({
            ...config,
            blocked: [
              ...config.blocked,
              {
                id: crypto.randomUUID(),
                weekday: 1,
                start: "18:00",
                end: "19:00",
              },
            ],
          })
        }
      >
        Adicionar reserva pessoal
      </button>
    </section>
  );
}
