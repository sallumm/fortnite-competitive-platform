import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Article } from "../lib/types";
import { useStore } from "../lib/store";
import { useStudy } from "../lib/useStudy";
import {
  assessmentResult,
  lessonState,
  studyLabels,
  type StudyRecord,
} from "../lib/academy";
import { recordStudy, saveStudyNote } from "../lib/academy-service";
export function LessonStudy({ lesson }: { lesson: Article }) {
  const s = useStore(),
    study = useStudy(),
    navigate = useNavigate();
  const [answers, setAnswers] = useState<number[]>([]);
  const [feedback, setFeedback] = useState(false);
  const [note, setNote] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [message, setMessage] = useState("");
  const saved = study.data.notes.find((n) => n.lesson_id === lesson.id);
  const state = lessonState(study.data.records, lesson.id);
  const questions = lesson.academy_questions || [];
  useEffect(() => {
    setNote(saved?.note || "");
    setDifficulty(saved?.difficulty || "");
    setFavorite(saved?.favorite || false);
  }, [lesson.id, saved?.note, saved?.difficulty, saved?.favorite]);
  useEffect(() => {
    setAnswers([]);
    setFeedback(false);
    setMessage("");
  }, [lesson.id]);
  if (!lesson.curriculum) return null;
  async function record(action: StudyRecord["action"]) {
    const r = await s.run(async () => {
      await recordStudy(
        s.demo,
        lesson,
        action,
        action === "assessment" ? answers : [],
      );
      await study.refresh();
      return true;
    }, false);
    if (r) {
      setMessage("Registro salvo.");
      if (action === "assessment") setFeedback(true);
    }
  }
  const last = study.data.records
    .filter((r) => r.lesson_id === lesson.id)
    .at(-1);
  return (
    <section className="panel" aria-label="Meu estudo desta aula">
      <h2>Meu estudo</h2>
      <p>
        Concluir o estudo registra sua declaração de leitura e revisão.
        Resultados práticos são registrados em sessões de treino; não há domínio
        automático nem XP por leitura.
      </p>
      {!study.enabled ? (
        <p>
          <Link to="/auth">Entre em sua conta</Link> para salvar progresso,
          avaliações e anotações.
        </p>
      ) : (
        <>
          {s.demo && (
            <p className="alert">
              Demonstração: registros apenas neste navegador, separados das
              contas reais.
            </p>
          )}
          {study.error && (
            <p role="alert">
              {study.error}{" "}
              <button onClick={() => void study.refresh()}>
                Tentar novamente
              </button>
            </p>
          )}
          <p role="status">
            {study.loading
              ? "Consultando estudo…"
              : state
                ? studyLabels[state]
                : "Ainda não estudada"}
            . {message}
          </p>
          {last &&
            (last.snapshot.version !== lesson.curriculum.version ||
              (last.snapshot.body && last.snapshot.body !== lesson.body)) && (
              <p className="alert">
                O conteúdo foi revisado desde seu último registro. Versão
                registrada: {last.snapshot.version}; versão atual:{" "}
                {lesson.curriculum.version}. Seu histórico foi preservado.
              </p>
            )}
          <div className="row">
            <button
              className="button"
              disabled={s.busy || study.loading}
              onClick={() => void record("started")}
            >
              Iniciar estudo
            </button>
            <button
              className="button primary"
              disabled={s.busy || study.loading}
              onClick={() => void record("completed")}
            >
              Concluir estudo
            </button>
            <button
              className="button"
              disabled={s.busy || study.loading}
              onClick={() => void record("reviewed")}
            >
              Registrar revisão
            </button>
          </div>
          {questions.length > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void record("assessment");
              }}
            >
              <h3>Avaliação conceitual opcional</h3>
              <p>
                Responda antes de consultar a explicação. O resultado vale para
                estas perguntas e esta versão da aula.
              </p>
              {questions.map((q, i) => (
                <fieldset key={q.id}>
                  <legend>{q.prompt}</legend>
                  {q.options.map((o, j) => (
                    <label className="row" key={j}>
                      <input
                        type="radio"
                        name={`question-${q.id}`}
                        checked={answers[i] === j}
                        onChange={() => {
                          setFeedback(false);
                          setAnswers((a) => {
                            const n = [...a];
                            n[i] = j;
                            return n;
                          });
                        }}
                        required
                      />
                      {o}
                    </label>
                  ))}
                  {feedback && (
                    <p className="alert">
                      {answers[i] === q.answer
                        ? "Resposta correta. "
                        : "Reveja esta resposta. "}
                      {q.explanation}
                    </p>
                  )}
                </fieldset>
              ))}
              <button className="button" disabled={s.busy}>
                Registrar avaliação
              </button>
              {feedback && (
                <p role="status">
                  {assessmentResult(questions, answers).correct} de{" "}
                  {questions.length} respostas corretas. Isso não mede sua
                  habilidade em partida.
                </p>
              )}
            </form>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void s.run(async () => {
                await saveStudyNote(s.demo, {
                  lesson_id: lesson.id,
                  note,
                  difficulty,
                  favorite,
                });
                await study.refresh();
                setMessage("Anotação salva.");
              }, false);
            }}
          >
            <label>
              Minha anotação
              <textarea
                maxLength={4000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label>
              Dificuldade a revisar
              <textarea
                maxLength={1000}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              />
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
              />
              Favoritar aula
            </label>
            <button className="button" disabled={s.busy}>
              Salvar anotação
            </button>
          </form>
        </>
      )}
      {lesson.curriculum.exercise_ids.length > 0 && (
        <>
          <h3>Aplicar em uma rotina</h3>
          <p>
            Os exercícios serão adicionados como proposta editável. Salvar a
            rotina não comprova execução.
          </p>
          <button
            className="button primary"
            disabled={s.busy}
            onClick={() => {
              if (!s.data.profile) {
                navigate("/auth");
                return;
              }
              void s.run(async () => {
                const exercises = lesson.curriculum!.exercise_ids.flatMap(
                  (id) => {
                    const e = s.catalog.exercises.find(
                      (e) =>
                        e.id === id &&
                        e.published &&
                        e.research?.review_status !== "retired",
                    );
                    return e ? [e] : [];
                  },
                );
                if (!exercises.length)
                  throw new Error(
                    "As atividades precisam de revisão editorial.",
                  );
                await s.save("plans", {
                  id: crypto.randomUUID(),
                  user_id: s.data.profile!.id,
                  title: `Estudo: ${lesson.title}`.slice(0, 80),
                  description: `Aplicação da aula ${lesson.slug}, versão ${lesson.curriculum!.version}.`,
                  objective: lesson.curriculum!.objectives[0],
                  mode:
                    lesson.curriculum!.modes.length === 2
                      ? "both"
                      : lesson.curriculum!.modes[0],
                  steps: exercises.map((e) => ({
                    id: crypto.randomUUID(),
                    exercise_id: e.id,
                    minutes: 5,
                    notes:
                      "Duração inicial editável; registre conclusão e resultados manualmente.",
                  })),
                });
                navigate("/app/planner");
              });
            }}
          >
            Criar rotina editável desta aula
          </button>
        </>
      )}
      <details>
        <summary>Dúvidas de estudo · orientação por regras</summary>
        <p>
          Se não compreender um termo, abra o glossário e as bases sugeridas.
          Para escolher um exercício, leia suas instruções e métrica. Para
          regras ou itens de temporada, confira a versão e a fonte oficial em
          Meta. Estas orientações não são uma resposta de IA generativa.
        </p>
        <Link to="/academy/research">Glossário e evidências</Link>
        {" · "}
        <Link to="/competitive/meta">Consultar Meta</Link>
      </details>
    </section>
  );
}
