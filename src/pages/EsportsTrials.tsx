import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Heading, Badge, Empty, Modal } from "../components/ui";
import { ProgressIndicator } from "../components/experience/primitives";
import { useStore } from "../lib/store";
import {
  loadTrials,
  startExam,
  answerExam,
  type Attempt,
  type Assignment,
  type Answers,
} from "../lib/esports/assessments";
import { useEsportsQuery } from "../lib/esports/useEsportsQuery";
export default function EsportsTrials() {
  const { data, error, loading, refresh } = useEsportsQuery(loadTrials),
    s = useStore();
  const [rules, setRules] = useState<Assignment | null>(null),
    [attempt, setAttempt] = useState<Attempt | null>(null);
  return (
    <>
      <Heading
        eyebrow="kyrven esports / TRIALIST"
        title="Minhas avaliações"
        description="Avaliações privadas com prazo, salvamento e revisão humana. Nenhuma nota gera promoção automática."
      />
      <Link className="text-link" to="/app/esports">
        Voltar ao meu espaço
      </Link>
      {loading && <p role="status">Consultando avaliações…</p>}
      {error && (
        <p role="alert" className="alert">
          {error}
          <button onClick={() => void refresh()}>Tentar novamente</button>
        </p>
      )}
      {data && (
        <>
          <section className="panel">
            <h2>Antes de começar</h2>
            <p>{data.technical_notice}</p>
            <p>
              Respostas salvas são recuperadas pelo servidor. Durante uma falha,
              mantenha esta página aberta e use “Salvar respostas” novamente.
              Mudanças ainda não confirmadas podem ser perdidas ao fechar ou
              recarregar a página. A atividade não é uma contratação.
            </p>
          </section>
          {!data.assignments.length && (
            <Empty title="Nenhuma avaliação disponível">
              Um convite Trialist e uma prova atribuída pela direção são
              necessários.
            </Empty>
          )}
          <div className="two-grid">
            {data.assignments.map((a) => (
              <article className="panel" key={a.application_id + a.exam_id}>
                <h2>{a.title}</h2>
                <p>
                  {a.minutes} minutos · Até {a.max_attempts} tentativas ·{" "}
                  {a.count} iniciadas
                </p>
                <p>
                  Disponível até{" "}
                  {new Date(a.available_until).toLocaleString("pt-BR")}
                </p>
                <button
                  className="button primary"
                  disabled={
                    Date.parse(a.available_until) <= Date.now() ||
                    (!data.attempts.some(
                      (t) =>
                        t.application_id === a.application_id &&
                        t.exam_id === a.exam_id &&
                        t.status === "active",
                    ) &&
                      a.count >= a.max_attempts)
                  }
                  onClick={() => setRules(a)}
                >
                  Ler regras e iniciar
                </button>
              </article>
            ))}
          </div>
          <section className="panel">
            <h2>Histórico e respostas salvas</h2>
            {data.attempts.map((t) => (
              <article className="application-card" key={t.id}>
                <h3>
                  {t.exam_snapshot.title} · Tentativa {t.number}
                </h3>
                <Badge>
                  {t.status === "active"
                    ? "Em andamento"
                    : t.status === "submitted"
                      ? "Enviada para revisão"
                      : "Revisada"}
                </Badge>
                <p>
                  Iniciada em {new Date(t.started_at).toLocaleString("pt-BR")}
                </p>
                <button className="button" onClick={() => setAttempt(t)}>
                  {t.status === "active"
                    ? "Retomar respostas"
                    : "Consultar respostas e feedback"}
                </button>
              </article>
            ))}
          </section>
        </>
      )}
      {rules && (
        <Modal title={rules.title} onClose={() => setRules(null)}>
          <p className="preserve-lines">{rules.instructions}</p>
          <p className="preserve-lines">{rules.rules}</p>
          <p>{data?.technical_notice}</p>
          <p>
            O prazo começa ao confirmar. Questões e respostas são particulares;
            não envie dados sensíveis em respostas discursivas.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void s.run(async () => {
                const t = await startExam(rules.application_id, rules.exam_id);
                setRules(null);
                setAttempt(t);
                await refresh();
              });
            }}
          >
            <label className="checkbox">
              <input type="checkbox" required />
              Li as instruções, regras e informações técnicas.
            </label>
            <button className="button primary" disabled={s.busy}>
              Confirmar início
            </button>
          </form>
        </Modal>
      )}
      {attempt && (
        <ExamRunner
          key={attempt.id}
          initial={attempt}
          close={() => {
            setAttempt(null);
            void refresh();
          }}
        />
      )}
    </>
  );
}
function ExamRunner({
  initial,
  close,
}: {
  initial: Attempt;
  close: () => void;
}) {
  const [attempt, setAttempt] = useState(initial),
    [answers, setAnswers] = useState<Answers>(initial.answers),
    [index, setIndex] = useState(0),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("Respostas recuperadas do servidor."),
    [now, setNow] = useState(Date.now());
  const clockOffset = useRef(
      Date.parse(initial.server_now || new Date().toISOString()) - Date.now(),
    ),
    lock = useRef(false),
    alive = useRef(true),
    draft = useRef(answers);
  draft.current = answers;
  const dirty = JSON.stringify(answers) !== JSON.stringify(attempt.answers),
    active = attempt.status === "active",
    remaining = Math.max(
      0,
      Math.ceil(
        (Date.parse(attempt.deadline) - now - clockOffset.current) / 1000,
      ),
    ),
    q = attempt.questions[index];
  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty && active) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, active]);
  const persist = async (action: "save" | "submit" | "timeout") => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const outgoing = { ...draft.current };
    try {
      const t = await answerExam(attempt, action, outgoing);
      if (!alive.current) return;
      clockOffset.current = Date.parse(t.server_now) - Date.now();
      setAttempt(t);
      setConfirm(false);
      setSaved(
        t.status === "active"
          ? "Salvamento confirmado pelo servidor."
          : "Envio registrado pelo servidor.",
      );
      if (t.status !== "active") setAnswers(t.answers);
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : "Falha no salvamento. Mantenha esta página aberta.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  useEffect(() => {
    if (!active || remaining > 0 || busy || error) return;
    void persist("timeout");
  }, [active, remaining, busy, error]);
  return (
    <Modal
      title={`${attempt.exam_snapshot.title} — tentativa ${attempt.number}`}
      onClose={() => {
        if (dirty && active) {
          setError(
            "Salve as respostas antes de sair. Se quiser descartar mudanças, use a opção abaixo.",
          );
          return;
        }
        close();
      }}
    >
      <div className="row between wrap">
        <Badge>{active ? "Em andamento" : "Enviada"}</Badge>
        <span aria-label="Tempo restante">
          {active
            ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} restantes`
            : `Início: ${new Date(attempt.started_at).toLocaleString("pt-BR")}`}
        </span>
      </div>
      <ProgressIndicator
        value={Object.keys(answers).length}
        max={attempt.questions.length}
      />
      <nav className="question-nav assessment-index" aria-label="Navegar entre questões">
        {attempt.questions.map((item, n) => (
          <button
            key={item.id}
            className={`button ${n === index ? "primary" : ""}`}
            aria-current={n === index ? "step" : undefined}
            aria-label={`Questão ${n + 1}${answers[item.id] !== undefined ? ", respondida" : ""}`}
            onClick={() => setIndex(n)}
          >
            {n + 1}
          </button>
        ))}
      </nav>
      <section className="exam-question assessment-sheet">
        <span className="eyebrow">
          {q.category} / {q.difficulty} · Peso {q.weight}
        </span>
        <h2>{q.prompt}</h2>
        {q.kind === "objective" ? (
          <fieldset disabled={!active || !remaining}>
            <legend>Escolha uma resposta</legend>
            {q.options.map((option, n) => (
              <label className="exam-option" key={n}>
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === n}
                  onChange={() => setAnswers({ ...answers, [q.id]: n })}
                />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <label>
            Resposta discursiva
            <textarea
              disabled={!active || !remaining}
              maxLength={8000}
              value={String(answers[q.id] ?? "")}
              onChange={(e) =>
                setAnswers({ ...answers, [q.id]: e.target.value })
              }
            />
          </label>
        )}
      </section>
      <div className="row between wrap">
        <button
          className="button"
          disabled={!index}
          onClick={() => setIndex(index - 1)}
        >
          Anterior
        </button>
        <button
          className="button"
          disabled={index === attempt.questions.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          Próxima questão
        </button>
      </div>
      <p role="status">
        {busy
          ? "Aguardando confirmação do servidor…"
          : dirty
            ? "Há respostas ainda não salvas."
            : saved}
      </p>
      {error && (
        <p role="alert" className="alert">
          {error} As respostas digitadas continuam nesta página.
        </p>
      )}
      {active && (
        <div className="row wrap">
          <button
            className="button"
            disabled={busy}
            onClick={() => void persist(remaining ? "save" : "timeout")}
          >
            Salvar respostas
          </button>
          <button
            className="button primary"
            disabled={busy || !remaining}
            onClick={() => setConfirm(true)}
          >
            Revisar e enviar prova
          </button>
          {dirty && (
            <button
              className="button danger"
              onClick={() => {
                if (
                  window.confirm(
                    "Descartar respostas ainda não salvas e fechar?",
                  )
                )
                  close();
              }}
            >
              Descartar mudanças e sair
            </button>
          )}
        </div>
      )}
      {confirm && (
        <section className="panel">
          <h3>Confirmar envio definitivo?</h3>
          <p>
            {Object.keys(answers).length} de {attempt.questions.length}{" "}
            respondidas. Após o envio você não poderá alterar esta tentativa. A
            revisão não garante seleção.
          </p>
          <button className="button" onClick={() => setConfirm(false)}>
            Continuar respondendo
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void persist("submit")}
          >
            Confirmar envio definitivo
          </button>
        </section>
      )}
      {attempt.result ? (
        <section className="panel">
          <h2>Feedback compartilhado</h2>
          <p>
            Pontuação objetiva: {attempt.result.objective_points} de{" "}
            {attempt.result.objective_max}. Discursivas:{" "}
            {Object.values(attempt.result.manual_grades).reduce(
              (sum, v) => sum + Number(v),
              0,
            )}{" "}
            pontos.
          </p>
          <p className="preserve-lines">{attempt.result.feedback}</p>
        </section>
      ) : (
        !active && (
          <p>Resultado ainda não compartilhado pela avaliação humana.</p>
        )
      )}
    </Modal>
  );
}
