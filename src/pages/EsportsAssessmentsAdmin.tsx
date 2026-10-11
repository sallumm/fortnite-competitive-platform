import { useState } from "react";
import { Link } from "react-router-dom";
import { Heading, Badge, Modal, Empty } from "../components/ui";
import { AnimatedTabs } from "../components/experience/primitives";
import {
  Field,
  CheckField,
  Form,
  formObject,
  localDate,
  isoDate,
} from "./EsportsAdmin";
import {
  loadAssessments,
  assessmentAction,
  type Question,
  type Exam,
  type Attempt,
  type Blueprint,
} from "../lib/esports/assessments";
import { useEsportsQuery } from "../lib/esports/useEsportsQuery";
const lines = (v: FormDataEntryValue | null) =>
  String(v || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
const difficultyLabels = {
  foundation: "Fundamentos",
  intermediate: "Intermediário",
  advanced: "Avançado",
};
export default function EsportsAssessmentsAdmin() {
  const { data, error, loading, refresh } = useEsportsQuery(loadAssessments);
  const [tab, setTab] = useState("attempts"),
    [question, setQuestion] = useState<Question | null | undefined>(),
    [exam, setExam] = useState<Exam | null | undefined>(),
    [attempt, setAttempt] = useState<Attempt | null>(null),
    [filter, setFilter] = useState("");
  const act = async (
    name: string,
    id: string | null,
    version: number,
    p: unknown,
  ) => {
    await assessmentAction(name, id, version, p);
    await refresh();
    setAttempt(null);
  };
  return (
    <>
      <Heading
        eyebrow="kyrven esports — Recruitment"
        title="Provas e revisões"
        description="Banco privado, versões congeladas e decisões humanas. Conteúdo exige revisão editorial antes de uso."
      />
      <Link className="text-link" to="/admin/esports">
        Voltar ao recrutamento
      </Link>
      {loading && <p role="status">Consultando banco de avaliações…</p>}
      {error && (
        <p className="alert" role="alert">
          {error}
          <button onClick={() => void refresh()}>Tentar novamente</button>
        </p>
      )}
      {data && (
        <>
          <AnimatedTabs
            label="Gestão de provas"
            value={tab}
            onChange={setTab}
            items={[
              { value: "attempts", label: "Respostas e revisão" },
              ...(data.admin
                ? [
                    { value: "questions", label: "Banco de questões" },
                    { value: "exams", label: "Provas e atribuição" },
                  ]
                : []),
            ]}
          />
          {tab === "questions" && data.admin && (
            <section className="panel">
              <div className="row between wrap">
                <h2>Questões revisadas</h2>
                <button
                  className="button primary"
                  onClick={() => setQuestion(null)}
                >
                  Criar questão
                </button>
              </div>
              <p>
                Não há gabaritos oficiais inventados. Cadastre conteúdo baseado
                na Academy e fontes verificadas, com explicação e revisão
                identificada. Banco vazio impede o início de provas.
              </p>
              <label>
                Filtrar enunciado ou categoria
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
              {data.questions
                .filter((q) =>
                  (q.prompt + " " + q.category)
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )
                .map((q) => (
                  <article className="application-card" key={q.id}>
                    <Badge>{q.published ? "Publicada" : "Rascunho"}</Badge>
                    <h3>{q.prompt}</h3>
                    <p>
                      {q.category} · {difficultyLabels[q.difficulty]} ·{" "}
                      {q.kind === "objective" ? "Objetiva" : "Discursiva"} ·
                      Peso {q.weight} · Versão {q.version}
                    </p>
                    <button className="button" onClick={() => setQuestion(q)}>
                      Editar questão
                    </button>
                  </article>
                ))}
            </section>
          )}
          {tab === "exams" && data.admin && (
            <>
              <section className="panel">
                <div className="row between wrap">
                  <h2>Definições de prova</h2>
                  <button
                    className="button primary"
                    onClick={() => setExam(null)}
                  >
                    Criar prova
                  </button>
                </div>
                {data.exams.map((e) => (
                  <article className="application-card" key={e.id}>
                    <h3>{e.title}</h3>
                    <p>
                      {e.minutes} minutos · Versão {e.version} ·{" "}
                      {e.published ? "Disponível para atribuir" : "Rascunho"}
                    </p>
                    <code>{e.id}</code>
                    <ul>
                      {e.blueprint.map((b, n) => (
                        <li key={n}>
                          {b.category} / {difficultyLabels[b.difficulty]}:{" "}
                          {b.count} questões
                        </li>
                      ))}
                    </ul>
                    <button className="button" onClick={() => setExam(e)}>
                      Editar prova
                    </button>
                  </article>
                ))}
              </section>
              <section className="panel">
                <h2>Atribuir prova a uma candidatura</h2>
                <Form
                  save={(f) =>
                    act("assign", String(f.get("application_id")), 0, {
                      ...formObject(f),
                      available_until: isoDate(f.get("available_until")),
                    })
                  }
                >
                  <Field
                    name="application_id"
                    label="UUID da candidatura Trialist"
                  />
                  <label>
                    Prova
                    <select name="exam_id" required>
                      {data.exams
                        .filter((e) => e.published)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Field
                    name="available_until"
                    label="Prazo de disponibilidade"
                    type="datetime-local"
                  />
                </Form>
              </section>
              <section className="panel">
                <h2>Atribuições e exceções técnicas</h2>
                {data.assignments.map((a) => (
                  <article
                    className="application-card"
                    key={a.application_id + a.exam_id}
                  >
                    <p>
                      Candidatura: <code>{a.application_id}</code>
                    </p>
                    <p>
                      Prova: <code>{a.exam_id}</code> · Até{" "}
                      {new Date(a.available_until).toLocaleString("pt-BR")}{" "}
                      {a.revoked_at ? "· Revogada" : ""}
                    </p>
                    <Form
                      save={(f) =>
                        act(String(f.get("action")), a.application_id, 0, {
                          exam_id: a.exam_id,
                          reason: f.get("reason"),
                        })
                      }
                    >
                      <label>
                        Operação
                        <select name="action">
                          <option value="extra_attempt">
                            Autorizar nova tentativa excepcional
                          </option>
                          <option value="revoke_assignment">
                            Revogar acesso à prova
                          </option>
                        </select>
                      </label>
                      <Field
                        name="reason"
                        label="Motivo (falha técnica ou decisão humana)"
                      />
                    </Form>
                  </article>
                ))}
              </section>
            </>
          )}
          {tab === "attempts" && (
            <section className="panel">
              <h2>Tentativas enviadas</h2>
              <p>
                Respostas em andamento não aparecem nesta área. Avaliadores
                consultam somente candidaturas designadas.
              </p>
              {!data.attempts.length && (
                <Empty title="Nenhuma tentativa para revisão">
                  Acesso e resultados são consultados no servidor.
                </Empty>
              )}
              {data.attempts.map((a) => (
                <article className="application-card" key={a.id}>
                  <h3>
                    {a.exam_snapshot.title} · Tentativa {a.number}
                  </h3>
                  <p>
                    Candidatura: <code>{a.application_id}</code>
                  </p>
                  <Badge>
                    {a.status === "graded" ? "Revisada" : "Aguardando revisão"}
                  </Badge>
                  <p>
                    Pontuação objetiva: {a.objective_points} / {a.objective_max}
                  </p>
                  <button className="button" onClick={() => setAttempt(a)}>
                    Consultar respostas e revisar
                  </button>
                </article>
              ))}
            </section>
          )}
          {question !== undefined && (
            <QuestionEditor
              initial={question}
              close={() => setQuestion(undefined)}
              save={async (f) => {
                const kind = String(f.get("kind"));
                await act(
                  "question",
                  question?.id || null,
                  question?.version || 0,
                  {
                    ...formObject(f),
                    kind,
                    options:
                      kind === "objective" ? lines(f.get("options")) : [],
                    correct:
                      kind === "objective"
                        ? Number(f.get("correct")) - 1
                        : null,
                    references_list: lines(f.get("references_list")),
                    weight: Number(f.get("weight")),
                    published: f.get("published") === "on",
                    reviewed_at: isoDate(f.get("reviewed_at")),
                  },
                );
                setQuestion(undefined);
              }}
            />
          )}
          {exam !== undefined && (
            <ExamEditor
              initial={exam}
              close={() => setExam(undefined)}
              save={async (f, blueprint) => {
                await act("exam", exam?.id || null, exam?.version || 0, {
                  ...formObject(f),
                  blueprint,
                  minutes: Number(f.get("minutes")),
                  max_attempts: Number(f.get("max_attempts")),
                  published: f.get("published") === "on",
                });
                setExam(undefined);
              }}
            />
          )}
          {attempt && (
            <Modal
              title={`Revisão — ${attempt.exam_snapshot.title}`}
              onClose={() => setAttempt(null)}
            >
              <p>
                Candidatura: <code>{attempt.application_id}</code> · Tentativa{" "}
                {attempt.number} · Versão {attempt.version}
              </p>
              <p>
                Início {new Date(attempt.started_at).toLocaleString("pt-BR")} ·
                Envio{" "}
                {attempt.submitted_at &&
                  new Date(attempt.submitted_at).toLocaleString("pt-BR")}{" "}
                · Prazo {new Date(attempt.deadline).toLocaleString("pt-BR")}
              </p>
              <p>
                Seleção registrada com seed <code>{attempt.seed}</code> e
                snapshots. Não constitui mecanismo completo contra consulta
                externa.
              </p>
              <p>
                Pontos objetivos: {attempt.objective_points} /{" "}
                {attempt.objective_max}
              </p>
              <Form
                save={(f) => {
                  const grades = Object.fromEntries(
                    attempt.questions
                      .filter((q) => q.kind === "discursive")
                      .map((q) => [q.id, Number(f.get("grade-" + q.id))]),
                  );
                  return act("grade", attempt.id, attempt.version, {
                    grades,
                    review_note: f.get("review_note"),
                    feedback: f.get("feedback"),
                    released: f.get("released") === "on",
                  });
                }}
              >
                {attempt.questions.map((q, n) => (
                  <section className="application-card" key={q.id}>
                    <h3>
                      {n + 1}. {q.prompt}
                    </h3>
                    <p>
                      Resposta:{" "}
                      {q.kind === "objective"
                        ? q.options[Number(attempt.answers[q.id])] ||
                          "Não respondida"
                        : String(attempt.answers[q.id] ?? "Não respondida")}
                    </p>
                    <p>
                      Referência de correção:{" "}
                      {q.kind === "objective"
                        ? q.options[q.correct!]
                        : q.explanation}
                    </p>
                    <p>{q.explanation}</p>
                    {q.references_list?.map((r) => (
                      <p key={r}>
                        <a
                          href={r}
                          className="text-link"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Fonte editorial
                        </a>
                      </p>
                    ))}
                    {q.kind === "discursive" && (
                      <label>
                        Pontos atribuídos (0 a {q.weight})
                        <input
                          name={"grade-" + q.id}
                          type="number"
                          required
                          min="0"
                          max={q.weight}
                          step="0.1"
                          defaultValue={attempt.manual_grades?.[q.id] ?? 0}
                        />
                      </label>
                    )}
                  </section>
                ))}
                <Field
                  name="review_note"
                  label="Observação interna da revisão"
                  multiline
                  defaultValue={attempt.review_note}
                />
                <Field
                  name="feedback"
                  label="Feedback compartilhável"
                  multiline
                  required={false}
                  defaultValue={attempt.feedback}
                />
                <CheckField
                  name="released"
                  label="Compartilhar pontuação e feedback com o candidato"
                  checked={attempt.released}
                />
              </Form>
              <h3>Histórico de revisões humanas</h3>
              {data.review_history
                .filter((r) => r.attempt_id === attempt.id)
                .map((r) => (
                  <article className="application-card" key={r.id}>
                    <p>
                      {new Date(r.created_at).toLocaleString("pt-BR")} · Versão
                      revisada {r.attempt_version}
                    </p>
                    <p>{r.review_note}</p>
                    <p>
                      Responsável: <code>{r.reviewer_id}</code>
                    </p>
                  </article>
                ))}
            </Modal>
          )}
        </>
      )}
    </>
  );
}
function QuestionEditor({
  initial,
  close,
  save,
}: {
  initial: Question | null;
  close: () => void;
  save: (f: FormData) => Promise<void>;
}) {
  const [kind, setKind] = useState(initial?.kind || "objective");
  return (
    <Modal title={initial ? "Editar questão" : "Nova questão"} onClose={close}>
      <Form save={save}>
        <Field
          name="prompt"
          label="Enunciado"
          multiline
          defaultValue={initial?.prompt}
        />
        <Field
          name="category"
          label="Categoria baseada na taxonomia ou Academy"
          defaultValue={initial?.category}
        />
        <label>
          Dificuldade
          <select
            name="difficulty"
            defaultValue={initial?.difficulty || "foundation"}
          >
            {Object.entries(difficultyLabels).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as Question["kind"])}
          >
            <option value="objective">Objetiva</option>
            <option value="discursive">Discursiva</option>
          </select>
        </label>
        {kind === "objective" && (
          <>
            <Field
              name="options"
              label="Alternativas (uma por linha, 2–8)"
              multiline
              defaultValue={initial?.options.join("\n")}
            />
            <Field
              name="correct"
              label="Número da alternativa correta (começando em 1)"
              type="number"
              defaultValue={Number(initial?.correct ?? 0) + 1}
            />
          </>
        )}
        <Field
          name="explanation"
          label="Explicação e critérios de correção"
          multiline
          defaultValue={initial?.explanation}
        />
        <Field
          name="references_list"
          label="Fontes HTTPS ou link de Academy (uma por linha)"
          multiline
          defaultValue={initial?.references_list?.join("\n")}
        />
        <Field
          name="weight"
          label="Peso (até 100)"
          type="number"
          defaultValue={initial?.weight || 1}
        />
        <Field
          name="reviewed_at"
          label="Data da revisão editorial"
          type="datetime-local"
          defaultValue={localDate(
            initial?.reviewed_at || new Date().toISOString(),
          )}
        />
        <CheckField
          name="published"
          label="Conteúdo revisado e publicado"
          checked={initial?.published}
        />
      </Form>
    </Modal>
  );
}
function ExamEditor({
  initial,
  close,
  save,
}: {
  initial: Exam | null;
  close: () => void;
  save: (f: FormData, b: Blueprint[]) => Promise<void>;
}) {
  const [blueprint, setBlueprint] = useState<Blueprint[]>(
    initial?.blueprint || [
      { category: "", difficulty: "foundation", count: 1 },
    ],
  );
  return (
    <Modal title={initial ? "Editar prova" : "Nova prova"} onClose={close}>
      <Form save={(f) => save(f, blueprint)}>
        <Field name="title" label="Título" defaultValue={initial?.title} />
        <Field
          name="instructions"
          label="Instruções"
          multiline
          defaultValue={initial?.instructions}
        />
        <Field
          name="rules"
          label="Regras e materiais permitidos"
          multiline
          defaultValue={initial?.rules}
        />
        <Field
          name="minutes"
          label="Duração (5–180 minutos)"
          type="number"
          defaultValue={initial?.minutes || 30}
        />
        <Field
          name="max_attempts"
          label="Máximo de tentativas (1–5)"
          type="number"
          defaultValue={initial?.max_attempts || 1}
        />
        <h3>Seleção equilibrada por tema e dificuldade</h3>
        {blueprint.map((b, n) => (
          <fieldset key={n} className="application-card">
            <legend>Grupo {n + 1}</legend>
            <label>
              Categoria
              <input
                required
                value={b.category}
                onChange={(e) =>
                  setBlueprint(
                    blueprint.map((x, i) =>
                      i === n ? { ...x, category: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Dificuldade
              <select
                value={b.difficulty}
                onChange={(e) =>
                  setBlueprint(
                    blueprint.map((x, i) =>
                      i === n
                        ? {
                            ...x,
                            difficulty: e.target
                              .value as Blueprint["difficulty"],
                          }
                        : x,
                    ),
                  )
                }
              >
                {Object.entries(difficultyLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantidade
              <input
                type="number"
                min="1"
                max="40"
                required
                value={b.count}
                onChange={(e) =>
                  setBlueprint(
                    blueprint.map((x, i) =>
                      i === n ? { ...x, count: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="button"
              disabled={blueprint.length === 1}
              onClick={() => setBlueprint(blueprint.filter((_, i) => i !== n))}
            >
              Remover grupo {n + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="button"
          disabled={blueprint.length >= 20}
          onClick={() =>
            setBlueprint([
              ...blueprint,
              { category: "", difficulty: "foundation", count: 1 },
            ])
          }
        >
          Adicionar grupo
        </button>
        <p>
          Até 40 questões; categorias precisam existir no banco. Uma seleção
          insuficiente impede o início, sem gerar prova incompleta.
        </p>
        <CheckField
          name="published"
          label="Disponibilizar definição revisada"
          checked={initial?.published}
        />
      </Form>
    </Modal>
  );
}
