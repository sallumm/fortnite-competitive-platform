import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../lib/store";
import { dateInZone, shiftDate, weekStart } from "../../lib/calendar";
import { weeklyEvolutionReview } from "../../lib/skill-maxing/engine";
export function WeeklyReview({ onFocus }: { onFocus: (key: string) => void }) {
  const s = useStore();
  const [from, setFrom] = useState(() =>
    shiftDate(weekStart(dateInZone(new Date(), s.data.profile!.timezone)), -7),
  );
  let review: ReturnType<typeof weeklyEvolutionReview> | null = null;
  try {
    review = weeklyEvolutionReview(s.data, s.catalog, from, shiftDate(from, 6));
  } catch {
    /* Invalid date remains editable. */
  }
  return (
    <section className="panel">
      <h2>Reavaliar uma semana</h2>
      <label>
        Início do período de revisão
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      {review ? (
        <>
          <p>
            {review.completed} sessões concluídas neste período. Ausência de
            conclusão não prova ausência de prática; descanso não é falha.
          </p>
          {review.suggestions.map((d) => (
            <article key={d.key}>
              <h3>{d.title}</h3>
              <p>{d.detail}</p>
              {d.key.startsWith("difficulty:") && (
                <button
                  className="button"
                  onClick={() => onFocus(d.key.slice("difficulty:".length))}
                >
                  Incluir foco na próxima prévia · {d.title}
                </button>
              )}
            </article>
          ))}
          {review.comparisons.map((c, i) => (
            <p key={i}>
              {c.title}: {c.first} → {c.last} {c.unit} · {c.count} sessões
              comparáveis · cenário {c.configuration} · versão {c.version}.
              Variação observada, sem atribuir causa ou transferência para
              partidas.
            </p>
          ))}
          {!review.comparisons.length && (
            <p>
              Não há medições comparáveis suficientes para avaliar resultados
              nesta semana.
            </p>
          )}
          <p className="muted">{review.note}</p>
        </>
      ) : (
        <p role="alert">Escolha uma data válida.</p>
      )}
      <Link className="text-link" to="/app/reports">
        Abrir relatórios e registros
      </Link>
    </section>
  );
}
