import { TrainingStepTransition } from "../components/experience/primitives";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { skills, type Skill, type SkillReview } from "../lib/performance-types";
import { resultGroups, skillExercises } from "../lib/performance";
import { dateLabel } from "../lib/logic";
import { Badge, Empty, Heading } from "../components/ui";
export default function Skills() {
  const s = useStore(),
    p = s.data.profile!;
  const initial = s.data.skillReviews
    .filter((r) => r.skill === "aim")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const [skill, setSkill] = useState<Skill>("aim"),
    [goal, setGoal] = useState(initial?.goal || ""),
    [note, setNote] = useState(""),
    [assessment, setAssessment] = useState<SkillReview["assessment"]>(
      initial?.assessment || "unassessed",
    );
  const reviews = s.data.skillReviews
    .filter((r) => r.skill === skill)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const related = skillExercises(s.catalog.exercises, skill, p);
  const known = new Set(related.map((e) => e.id));
  const records = s.data.sessions.filter(
    (x) =>
      x.status === "completed" &&
      x.results.some((r) => known.has(r.exercise_id) && r.status !== "skipped"),
  );
  const choose = (value: Skill) => {
    setSkill(value);
    const latest = s.data.skillReviews
      .filter((r) => r.skill === value)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    setGoal(latest?.goal || "");
    setNote("");
    setAssessment(latest?.assessment || "unassessed");
  };
  const assessmentLabels = {
    unassessed: "Sem avaliação",
    needs_practice: "Quero praticar mais",
    developing: "Em desenvolvimento",
    comfortable: "Sinto mais confiança",
  };
  return (
    <>
      <Heading
        eyebrow="MINHAS HABILIDADES"
        title="Desenvolva uma área por vez."
        description="Objetivos, exercícios e avaliações autodeclaradas. Sem notas artificiais de habilidade."
      />
      <div className="skill-layout">
        <nav className="panel skill-nav skill-selector" aria-label="Selecionar habilidade">
          {Object.entries(skills).map(([key, title]) => (
            <button
              className="button"
              aria-pressed={skill === key}
              key={key}
              onClick={() => choose(key as Skill)}
              disabled={
                p.mode === "zero" &&
                ["building", "editing", "piece", "box_fighting"].includes(key)
              }
            >
              {title}
            </button>
          ))}
        </nav>
        <TrainingStepTransition identity={skill}>
          <div className="skill-body skill-notebook">
            <section className="panel">
              <div className="section-title">
                <h2>{skills[skill]}</h2>
                <Badge>{records.length} sessões relacionadas</Badge>
              </div>
              <p className="muted">
                Os exercícios são associados por habilidades e tags editoriais.
                Não medem isoladamente todas as dimensões desta habilidade.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  s.run(async () => {
                    await s.save("skillReviews", {
                      id: crypto.randomUUID(),
                      user_id: p.id,
                      skill,
                      goal,
                      note,
                      assessment,
                      created_at: new Date().toISOString(),
                    });
                    setNote("");
                  });
                }}
              >
                <label>
                  Objetivo pessoal
                  <input
                    maxLength={300}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="O que quero executar com mais consistência?"
                  />
                </label>
                <label>
                  Última avaliação pessoal
                  <select
                    value={assessment}
                    onChange={(e) =>
                      setAssessment(e.target.value as SkillReview["assessment"])
                    }
                  >
                    {Object.entries(assessmentLabels).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Observações
                  <textarea
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button className="button primary" disabled={s.busy}>
                  Registrar avaliação
                </button>
              </form>
            </section>
            <section className="panel">
              <h2>Exercícios e resultados</h2>
              {!related.length && (
                <Empty title="Sem exercício específico publicado">
                  Use seu diário para registrar esta área até ampliar o
                  catálogo.
                </Empty>
              )}
              {related.map((e) => {
                const groups = resultGroups(records, e.id);
                return (
                  <article className="skill-exercise" key={e.id}>
                    <Link className="text-link" to={"/library/" + e.id}>
                      {e.title}
                    </Link>
                    <p>{e.description}</p>
                    {groups
                      .filter((g) => g.points.length >= 2)
                      .map((g) => (
                        <p key={g.key}>
                          <strong>Variação observada:</strong>{" "}
                          {g.points.at(-2)!.value} → {g.points.at(-1)!.value} ·{" "}
                          {g.metric} · {g.configuration}. Autodeclarada; duas
                          medições não comprovam melhoria de habilidade.
                        </p>
                      ))}
                    {!groups.some((g) => g.points.length >= 2) && (
                      <small className="muted">
                        Sem duas medições com métrica e configuração
                        identificadas para comparar.
                      </small>
                    )}
                  </article>
                );
              })}
              <Link className="button" to="/app/planner">
                Escolher o próximo exercício no plano
              </Link>
            </section>
            <section className="panel">
              <h2>Histórico de avaliações</h2>
              {!reviews.length && (
                <p className="muted">Nenhuma avaliação registrada.</p>
              )}
              {reviews.map((r) => (
                <div className="list-row" key={r.id}>
                  <div>
                    <strong>{assessmentLabels[r.assessment]}</strong>
                    <small>
                      {dateLabel(r.created_at, p.timezone)} · objetivo:{" "}
                      {r.goal || "não informado"}
                    </small>
                    <p>{r.note || "Sem observações."}</p>
                  </div>
                  <button
                    className="button small"
                    disabled={s.busy}
                    onClick={() => s.run(() => s.remove("skillReviews", r.id))}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </section>
            <section className="panel">
              <h2>Últimos resultados autodeclarados</h2>
              {!records.length && (
                <p className="muted">
                  Os registros aparecem depois de concluir um exercício
                  relacionado.
                </p>
              )}
              {records.slice(0, 5).map((session) => (
                <div key={session.id} className="list-row">
                  <div>
                    <strong>{session.title}</strong>
                    <small>
                      {dateLabel(session.completed_at!, p.timezone)}
                    </small>
                    {session.results
                      .filter(
                        (r) =>
                          known.has(r.exercise_id) && r.status !== "skipped",
                      )
                      .map((r) => (
                        <p key={r.step_id || r.exercise_id}>
                          {
                            session.steps.find(
                              (st) => st.exercise_id === r.exercise_id,
                            )?.exercise?.title
                          }
                          : {r.value ?? "não informado"} ·{" "}
                          {r.configuration || "configuração não identificada"}
                        </p>
                      ))}
                  </div>
                  <Link
                    className="button small"
                    to={"/app/journal/" + session.id}
                  >
                    Revisar diário
                  </Link>
                </div>
              ))}
            </section>
          </div>
        </TrainingStepTransition>
      </div>
    </>
  );
}
