import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useStudy } from "../lib/useStudy";
import { useRoad } from "../lib/road/useRoad";
import { journeyProgress } from "../lib/road/domain";
import { developmentSummary } from "../lib/development";
import { Progress } from "./ui";

export function DevelopmentOverview() {
  const s = useStore(),
    study = useStudy(),
    road = useRoad();
  const summary = developmentSummary(s.data, s.catalog, study.data);
  if (!summary) return null;
  const journey = road.data.journeys.find(
    (j) => j.user_id === s.data.profile!.id && j.status !== "completed",
  );
  const progress = journey
    ? journeyProgress(
        journey,
        road.data.events.filter((e) => e.user_id === journey.user_id),
      )
    : null;
  return (
    <section
      className="panel development-overview"
      aria-label="Meu desenvolvimento integrado"
    >
      <div className="section-title">
        <h2>Aprender, praticar e revisar</h2>
        <Link to="/academy">Meu percurso</Link>
      </div>
      {study.loading ? (
        <p role="status">Consultando seu estudo…</p>
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
            {summary.learned.length} de {summary.lessons.length} aulas com
            estudo registrado na versão atual. Leitura não comprova desempenho
            em partida.
          </p>
          <Progress
            value={summary.learned.length}
            max={summary.lessons.length || 1}
          />
          {summary.review ? (
            <p>
              <Link to={`/academy/${summary.review.slug}`}>
                Revisar: {summary.review.title}
              </Link>
              . A versão ou o prazo editorial mudou; seu histórico permanece
              preservado.
            </p>
          ) : null}
          {summary.apply ? (
            <p>
              Próxima aplicação:{" "}
              <Link to={`/library/${summary.apply.exercise.id}`}>
                {summary.apply.exercise.title}
              </Link>
              , vinculado editorialmente à aula{" "}
              <Link to={`/academy/${summary.apply.lesson.slug}`}>
                {summary.apply.lesson.title}
              </Link>
              . Ainda não há conclusão registrada deste exercício.
            </p>
          ) : summary.next ? (
            <p>
              Estudo sugerido:{" "}
              <Link to={`/academy/${summary.next.slug}`}>
                {summary.next.title}
              </Link>
              . Compatível com sua modalidade e experiência declarada; você pode
              escolher outro assunto.
            </p>
          ) : (
            <p>
              Escolha uma aula ou revise os registros; não há outra sugestão
              atual compatível neste catálogo.
            </p>
          )}
          {summary.difficulties.length > 0 && (
            <p>
              {summary.difficulties.length} aulas com dificuldade autodeclarada.{" "}
              <Link to="/academy">Consultar anotações</Link>.
            </p>
          )}
        </>
      )}
      {road.error ? (
        <p role="alert">
          {road.error}{" "}
          <button className="button small" onClick={() => void road.refresh()}>
            Consultar jornada novamente
          </button>
        </p>
      ) : journey && progress ? (
        <p>
          <Link to="/app/road">
            Road to Competitive · etapa {progress.current}
          </Link>
          : {progress.studied} estudos concluídos e {progress.skipped} conteúdos
          pulados.{" "}
          {journey.status === "paused"
            ? "Jornada pausada; seu progresso está preservado."
            : "Avance conforme sua disponibilidade."}
        </p>
      ) : null}
      <p>
        {summary.analysis.comparisons.length
          ? `${summary.analysis.comparisons.length} séries de resultados comparáveis nos últimos 30 dias.`
          : "Ainda não há resultados comparáveis suficientes nos últimos 30 dias."}{" "}
        <Link to="/app/reports">Consultar evidências e resultados</Link>.
      </p>
      <details className="development-paths">
        <summary>Ferramentas para cada etapa do seu desenvolvimento</summary>
        <div className="two-grid">
          <article>
            <h3>Aprendizagem</h3>
            <p>
              Conceitos, aulas e avaliações. Você pode acessar temas avançados
              diretamente.
            </p>
            <Link className="button" to="/academy">
              Abrir Academy
            </Link>
            <Link className="text-link" to="/app/road">
              Minha jornada
            </Link>
          </article>
          <article>
            <h3>Treinamento</h3>
            <p>
              Rotinas manuais ou propostas editáveis. A agenda só muda após
              confirmação.
            </p>
            <Link className="button" to="/app/evolution-plan">
              Criar plano de evolução
            </Link>
            <Link className="text-link" to="/app/training">
              Training Center
            </Link>
          </article>
          <article>
            <h3>Inteligência competitiva</h3>
            <p>
              Confira fonte, modalidade, versão e validade antes de preparar uma
              competição.
            </p>
            <Link className="button" to="/competitive/meta">
              Consultar Meta Center
            </Link>
            <Link className="text-link" to="/competitive">
              Campeonatos e regras
            </Link>
          </article>
          <article>
            <h3>Acompanhamento e orientação</h3>
            <p>
              O Coach consulta registros autorizados. Knowledge explica Fortnite
              com fontes.
            </p>
            <Link className="button" to="/app/coach">
              Planejar com o Coach
            </Link>
            <Link className="text-link" to="/knowledge">
              Entender com Knowledge
            </Link>
          </article>
        </div>
      </details>
    </section>
  );
}
