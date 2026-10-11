import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useStudy } from "../lib/useStudy";
import { dateInZone } from "../lib/calendar";

export function LearningReport({ from, to }: { from: string; to: string }) {
  const s = useStore(),
    study = useStudy();
  const tz = s.data.profile!.timezone;
  const records = study.data.records.filter((r) => {
    const stamp = Date.parse(r.created_at);
    if (!Number.isFinite(stamp) || stamp > Date.now()) return false;
    const day = dateInZone(r.created_at, tz);
    return day >= from && day <= to;
  });
  const completed = records.filter(
    (r) => r.action === "completed" || r.action === "reviewed",
  );
  const lessons = new Map(completed.map((r) => [r.lesson_id, r.snapshot]));
  return (
    <section className="panel" aria-label="Estudo e prática no período">
      <h2>Aprendizagem no mesmo período</h2>
      {study.loading ? (
        <p role="status">Consultando os registros de estudo…</p>
      ) : study.error ? (
        <p role="alert">
          {study.error}{" "}
          <button className="button small" onClick={() => void study.refresh()}>
            Consultar estudo novamente
          </button>
        </p>
      ) : (
        <>
          <p>
            {lessons.size} aulas com conclusão ou revisão declarada ·{" "}
            {records.filter((r) => r.action === "assessment").length} avaliações
            conceituais registradas.
          </p>
          <p>
            Estes registros complementam as sessões e medições abaixo. Conclusão
            de aula, resposta conceitual e resultado de exercício são evidências
            diferentes.
          </p>
          {lessons.size > 0 && (
            <details>
              <summary>Conteúdos e versões estudadas</summary>
              <ul>
                {Array.from(lessons, ([id, a]) => (
                  <li key={id}>
                    <Link to={`/academy/${a.slug}`}>{a.title}</Link> · versão
                    registrada {a.version}
                  </li>
                ))}
              </ul>
              <p>
                O histórico completo preserva todas as versões. O link abre o
                conteúdo atualmente disponível.
              </p>
            </details>
          )}
        </>
      )}
      <div className="row wrap">
        <Link className="button" to="/academy">
          Consultar meu estudo
        </Link>
        <Link className="button" to="/app/road">
          Relatório da jornada
        </Link>
        <Link className="button" to="/app/evolution-plan">
          Revisar próximas prioridades
        </Link>
      </div>
    </section>
  );
}
