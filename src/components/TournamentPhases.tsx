import type { Tournament } from "../lib/types";
import { dateLabel, download, timeLabel, isStale } from "../lib/logic";
import { phaseICS, usablePhase } from "../lib/competitive";
import { Badge, Source } from "./ui";
export function TournamentPhases({
  event,
  timezone,
  onAdd,
}: {
  event: Tournament;
  timezone: string;
  onAdd: (key: string) => void;
}) {
  return (
    <section className="phase-list">
      <h2>Fases e sessões</h2>
      {!event.phases?.length ? (
        <p>Fases ainda não verificadas. Consulte o regulamento oficial.</p>
      ) : (
        event.phases.map((p) => (
          <article className="panel" key={p.key}>
            <div className="row between">
              <h3>{p.title}</h3>
              <Badge>
                {
                  {
                    registration: "Inscrições",
                    qualifier: "Classificatória",
                    session: "Sessão",
                    final: "Final",
                  }[p.kind]
                }
              </Badge>
            </div>
            <p>
              {dateLabel(p.date)} ·{" "}
              {p.starts_at
                ? timeLabel(p.starts_at, timezone) +
                  " — " +
                  timeLabel(p.ends_at!, timezone) +
                  " · " +
                  timezone
                : "Horário não confirmado; data publicada na fonte."}
            </p>
            <p className="small-text muted">
              Status:{" "}
              {
                {
                  scheduled: "Programada",
                  finished: "Concluída",
                  postponed: "Adiada",
                  cancelled: "Cancelada",
                }[p.status]
              }
            </p>
            {p.status === "scheduled" &&
              p.date < new Date().toISOString().slice(0, 10) && (
                <p className="small-text muted">
                  Data passada no calendário; realização e resultado exigem
                  confirmação na fonte.
                </p>
              )}
            <Source
              url={p.source_url}
              date={p.verified_at}
              stale={isStale(p.verified_at, p.valid_until)}
            />
            <div className="row">
              <button
                className="button"
                onClick={() =>
                  download(
                    phaseICS(event, p),
                    event.slug + "-" + p.key + ".ics",
                    "text/calendar",
                  )
                }
              >
                Exportar {p.starts_at ? "sessão" : "dia inteiro"}
              </button>
              <button
                className="button"
                disabled={
                  !p.starts_at ||
                  !usablePhase(event, p) ||
                  p.kind === "registration" ||
                  Date.parse(p.starts_at) < Date.now()
                }
                onClick={() => onAdd(p.key)}
              >
                Adicionar à agenda
              </button>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
