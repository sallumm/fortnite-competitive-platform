import { KnowledgeAccess } from "../components/KnowledgeAccess";
import { currentStudy } from "../lib/development";
import { RoadAccess } from "../components/RoadAccess";
import { loadPaths, type AcademyPath } from "../lib/academy-paths";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { useStudy } from "../lib/useStudy";
import { curriculumLessons } from "../lib/curriculum";
import { lessonState, lessonsForTrack, studyLabels } from "../lib/academy";
import { clearStudy } from "../lib/academy-service";
import { Heading, Badge } from "../components/ui";
import { useSEO } from "../lib/seo";
export default function Academy() {
  const s = useStore(),
    study = useStudy();
  const [start, setStart] = useState("all");
  const [clear, setClear] = useState(false);
  const [paths, setPaths] = useState<AcademyPath[]>([]);
  const [pathsError, setPathsError] = useState("");
  useEffect(() => {
    let active = true;
    loadPaths(s.demo)
      .then((p) => {
        if (active) setPaths(p.filter((p) => p.published));
      })
      .catch(() => {
        if (active)
          setPathsError(
            "As trilhas estão indisponíveis. As aulas podem ser consultadas pela busca.",
          );
      });
    return () => {
      active = false;
    };
  }, [s.demo]);
  const lessons = curriculumLessons(s.catalog.articles);
  const progressLessons = s.data.profile
    ? lessons.filter((a) => a.curriculum!.modes.includes(s.data.profile!.mode))
    : lessons;
  const completed = s.data.profile
    ? currentStudy(progressLessons, s.data.profile.mode, study.data.records)
    : [];
  const list =
    start === "all"
      ? lessons
      : start === "beginner"
        ? lessons.filter((a) => a.curriculum!.level === 0)
        : start === "regular"
          ? lessons.filter(
              (a) => a.curriculum!.level >= 2 && a.curriculum!.level <= 3,
            )
          : lessons.filter((a) => a.curriculum!.level >= 4);
  const compatible = s.data.profile
    ? list.filter((a) => a.curriculum!.modes.includes(s.data.profile!.mode))
    : list;
  const next =
    compatible.find((a) => !completed.some((c) => c.id === a.id)) ||
    compatible[0];
  const last = study.data.records.at(-1);
  useSEO(
    "kyrven academy",
    "Estudo progressivo de Fortnite com fontes, avaliações conceituais e aplicação em treinos.",
  );
  return (
    <div className="academy-page">
      <KnowledgeAccess />
      <Heading
        eyebrow="MASTERY ACADEMY"
        title="Compreenda uma decisão. Aplique. Revise."
        description="Uma sequência flexível de estudo e prática. Conclusão de aula, avaliação conceitual e desempenho em treino são registros diferentes."
      />
      <div className="row">
        <RoadAccess />
        <Link className="button" to="/academy/curriculum">
          Buscar todas as aulas
        </Link>
        <Link className="button" to="/academy/research">
          Habilidades e glossário
        </Link>
        <Link className="button" to="/competitive/meta">
          Meta verificado
        </Link>
        <Link className="button" to="/app/reports">
          Resultados práticos
        </Link>
      </div>
      <section className="panel">
        <h2>Seu ponto de partida</h2>
        <label>
          O que você quer estudar?
          <select value={start} onChange={(e) => setStart(e.target.value)}>
            <option value="all">Escolher um assunto diretamente</option>
            <option value="beginner">
              Nunca joguei / primeiros fundamentos
            </option>
            <option value="regular">
              Já conheço o básico / jogo regularmente
            </option>
            <option value="competitive">Competitivo e temas avançados</option>
          </select>
        </label>
        <p>
          Você pode mudar de nível, pular uma aula ou voltar às bases. Não há
          bloqueios por avaliação.
        </p>
        {next && (
          <Link className="button primary" to={`/academy/${next.slug}`}>
            Próxima sugestão: {next.title}
          </Link>
        )}
        {last && (
          <p>
            Retomar:{" "}
            <Link to={`/academy/${last.snapshot.slug}`}>
              {last.snapshot.title}
            </Link>{" "}
            · versão registrada {last.snapshot.version}
          </p>
        )}
      </section>
      <section className="panel">
        <h2>Meu percurso</h2>
        {study.enabled ? (
          <>
            <p role="status">
              {completed.length} de {progressLessons.length} aulas com estudo
              concluído ou revisado na versão atual ·{" "}
              {
                study.data.records.filter((r) => r.action === "assessment")
                  .length
              }{" "}
              avaliações registradas ·{" "}
              {study.data.notes.filter((n) => n.favorite).length} favoritas.
            </p>
            <progress
              max={progressLessons.length || 1}
              value={completed.length}
              aria-label="Aulas com estudo concluído"
            />
            <p>
              O progresso considera a modalidade do perfil, a versão e a
              validade editorial das aulas publicadas. Registros de versões
              anteriores continuam no histórico.
            </p>
            {study.error && (
              <p role="alert">
                {study.error}
                <button onClick={() => void study.refresh()}>
                  Tentar novamente
                </button>
              </p>
            )}
          </>
        ) : (
          <p>
            <Link to="/auth">Entre em sua conta</Link> para acompanhar estudo e
            anotações. Você pode ler as aulas sem cadastro.
          </p>
        )}
      </section>
      <h2>Trilhas disponíveis</h2>
      {pathsError && <p role="alert">{pathsError}</p>}
      <p>
        A cobertura é parcial: {lessons.length} aulas curriculares, agrupadas em{" "}
        {paths.length} percursos publicados. Solo, meta específico e
        especializações adicionais ainda não constituem cursos completos.
      </p>
      <div className="two-grid">
        {paths.map((t) => (
          <section className="panel" key={t.id}>
            <h3>{t.title}</h3>
            <ol>
              {lessonsForTrack(lessons, t.slugs).map((a) => {
                const state = lessonState(study.data.records, a.id);
                return (
                  <li key={a.id}>
                    <Link to={`/academy/${a.slug}`}>{a.title}</Link>
                    {state && <Badge>{studyLabels[state]}</Badge>}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Mapa de pré-requisitos</h2>
        <p>
          As conexões representam bases editoriais sugeridas, não domínio
          comprovado. Abra qualquer aula para estudar diretamente.
        </p>
        <div className="two-grid">
          {lessons.map((a) => (
            <details key={a.id}>
              <summary>
                {a.title} ·{" "}
                {lessonState(study.data.records, a.id)
                  ? studyLabels[lessonState(study.data.records, a.id)!]
                  : "Não estudada"}
              </summary>
              <Link to={`/academy/${a.slug}`}>Abrir aula</Link>
              <ul>
                {a.curriculum!.prerequisites.map((p) => (
                  <li key={p}>
                    <Link to={`/academy/${p}`}>
                      {lessons.find((x) => x.slug === p)?.title || p}
                    </Link>
                  </li>
                ))}
              </ul>
              {!a.curriculum!.prerequisites.length && (
                <p>Sem bases obrigatórias.</p>
              )}
            </details>
          ))}
        </div>
      </section>
      {study.enabled && (
        <section className="panel">
          <h2>Histórico e revisão</h2>
          <p>
            Tente explicar uma ideia sem reler e depois confira a explicação.
            Você escolhe quando revisar; não existe intervalo universal validado
            para Fortnite.
          </p>
          {study.data.notes
            .filter((n) => n.note || n.difficulty || n.favorite)
            .map((n) => (
              <details key={n.lesson_id}>
                <summary>
                  {lessons.find((a) => a.id === n.lesson_id)?.title ||
                    "Aula arquivada"}
                  {n.favorite ? " · Favorita" : ""}
                </summary>
                <p>{n.note}</p>
                <p>{n.difficulty}</p>
              </details>
            ))}
          <ol>
            {study.data.records
              .slice(-30)
              .reverse()
              .map((r) => (
                <li key={r.id}>
                  {studyLabels[r.action]} · {r.snapshot.title} ·{" "}
                  {r.snapshot.version} ·{" "}
                  {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  {r.action === "assessment" && (
                    <span>
                      {" "}
                      ·{" "}
                      {
                        r.answers.filter(
                          (a, i) => a === r.snapshot.questions[i]?.answer,
                        ).length
                      }
                      /{r.snapshot.questions.length} respostas
                    </span>
                  )}
                  {r.snapshot.body && (
                    <details>
                      <summary>Consultar conteúdo da versão registrada</summary>
                      <p>{r.snapshot.body}</p>
                      {r.snapshot.questions.map((q) => (
                        <p key={q.id}>
                          {q.prompt} · {q.explanation}
                        </p>
                      ))}
                    </details>
                  )}
                </li>
              ))}
          </ol>
          <button
            className="button"
            onClick={() => {
              const b = new Blob([JSON.stringify(study.data, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(b),
                a = document.createElement("a");
              a.href = url;
              a.download = "clutchfolio-estudo.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Exportar meus registros
          </button>
          <button className="button danger" onClick={() => setClear(true)}>
            Excluir dados de estudo
          </button>
          {clear && (
            <div role="alert">
              <p>
                Excluir todo o histórico de estudo, avaliações e anotações desta
                conta? Esta ação não pode ser desfeita.
              </p>
              <button
                className="button danger"
                disabled={s.busy}
                onClick={() =>
                  void s.run(async () => {
                    await clearStudy(s.demo);
                    await study.refresh();
                    setClear(false);
                  })
                }
              >
                Confirmar exclusão do estudo
              </button>
              <button onClick={() => setClear(false)}>Cancelar</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
