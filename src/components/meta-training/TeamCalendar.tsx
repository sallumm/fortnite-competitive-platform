import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../lib/store";
import { emptyTeams, loadTeams } from "../../lib/meta-training/service";
export function TeamCalendar() {
  const s = useStore(),
    [data, setData] = useState(emptyTeams),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!s.demo)
      loadTeams()
        .then((d) => {
          if (active) setData(d);
        })
        .catch(() => {
          if (active)
            setError("Não foi possível consultar o calendário de equipes.");
        });
    return () => {
      active = false;
    };
  }, [s.demo, s.data.profile?.id]);
  const rows = data.sessions
    .filter(
      (x) =>
        x.status === "planned" &&
        data.participation.some(
          (p) =>
            p.session_id === x.id &&
            p.user_id === s.data.profile?.id &&
            p.status === "accepted",
        ),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (s.demo || (!rows.length && !error)) return null;
  return (
    <section className="panel">
      <h2>Sessões de equipe que aceitei</h2>
      {error && <p role="alert">{error}</p>}
      {rows.map((x) => (
        <p key={x.id}>
          {x.title} ·{" "}
          {new Date(x.starts_at).toLocaleString("pt-BR", {
            timeZone: s.data.profile!.timezone,
          })}{" "}
          · {x.duration_minutes} min
        </p>
      ))}
      <Link to="/app/teams">Revisar participação e calendário da equipe</Link>
    </section>
  );
}
