import { contextLabel, practiceLabel } from "../lib/meta-training/context";
import { SessionReadiness } from "../components/SessionReadiness";
import { TrainingStepTransition } from "../components/experience/primitives";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Pause, Play, Square } from "lucide-react";
import { useStore } from "../lib/store";
import { validSessionDraft } from "../lib/local-data";
import type { Result } from "../lib/types";
import {
  Badge,
  CopyCode,
  Empty,
  Heading,
  Modal,
  Progress,
} from "../components/ui";
interface Draft {
  elapsed: number;
  since: number | null;
  done: boolean[];
  results: Result[];
  activeStep?: number;
  stepElapsed?: number[];
  stepSince?: number | null;
}
export default function Training() {
  const { id } = useParams();
  const store = useStore();
  const session = store.data.sessions.find((s) => s.id === id);
  const navigate = useNavigate();
  const key = "clutchfolio-session-" + store.data.profile?.id + ":" + id;
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (
        validSessionDraft(saved, session?.steps.map((x) => x.exercise_id) || [])
      )
        return saved;
      if (
        validSessionDraft(
          session?.checkpoint,
          session?.steps.map((x) => x.exercise_id) || [],
        )
      )
        return session!.checkpoint!;
    } catch {}
    return {
      stepElapsed: session?.steps.map(() => 0) || [],
      stepSince: Date.now(),
      elapsed: 0,
      since: Date.now(),
      done: session?.steps.map(() => false) || [],
      results:
        session?.steps.map((x) => ({
          exercise_id: x.exercise_id,
          step_id: x.id,
          unit: x.exercise?.measurement?.unit,
          version: x.exercise?.measurement?.version,
          value: null,
          note: "",
        })) || [],
    };
  });
  const revision = useRef(session?.checkpoint_version || 0);
  const syncing = useRef(false);
  const [syncState, setSyncState] = useState("Rascunho salvo neste navegador.");
  const [tick, setTick] = useState(Date.now());
  const activeStep =
    draft.activeStep && draft.activeStep < (session?.steps.length || 0)
      ? draft.activeStep
      : 0;
  const setActiveStep = (value: number | ((i: number) => number)) =>
    setDraft((d) => {
      const next = typeof value === "number" ? value : value(activeStep);
      const elapsed = d.stepElapsed || session!.steps.map(() => 0);
      return {
        ...d,
        activeStep: next,
        stepElapsed: elapsed.map((n, i) =>
          i === activeStep
            ? n +
              Math.max(
                0,
                Math.floor((Date.now() - (d.stepSince || Date.now())) / 1000),
              )
            : n,
        ),
        stepSince: d.since ? Date.now() : null,
      };
    });
  const [allSteps, setAllSteps] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [openJournal, setOpenJournal] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      /* Session remains usable if browser storage is unavailable. */
    }
  }, [draft, key]);
  useEffect(() => {
    if (!session || session.status !== "active") return;
    const timer = setTimeout(async () => {
      if (syncing.current) return;
      syncing.current = true;
      try {
        revision.current = await store.checkpoint(
          session,
          draft,
          revision.current,
        );
        setSyncState(
          store.demo
            ? "Sessão recuperável neste navegador (demonstração)."
            : "Sessão sincronizada com sua conta.",
        );
      } catch {
        setSyncState(
          "Não foi possível sincronizar. O rascunho está neste navegador; recarregue se a sessão estiver aberta em outra aba.",
        );
      } finally {
        syncing.current = false;
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [draft, key]);
  if (!session)
    return (
      <Empty
        title="Sessão não encontrada"
        to="/app/planner"
        label="Voltar ao planejador"
      />
    );
  if (session.status !== "active")
    return (
      <Empty
        title="Esta sessão já foi encerrada"
        to="/app/reports"
        label="Consultar histórico"
      />
    );
  const seconds = Math.max(
    0,
    draft.elapsed + (draft.since ? Math.floor((tick - draft.since) / 1000) : 0),
  );
  const done = draft.done.filter(Boolean).length;
  const toggle = () =>
    setDraft({
      ...draft,
      elapsed: seconds,
      since: draft.since ? null : Date.now(),
      stepElapsed: (draft.stepElapsed || session.steps.map(() => 0)).map(
        (n, i) =>
          i === activeStep
            ? n +
              Math.max(
                0,
                Math.floor(
                  (Date.now() - (draft.stepSince || Date.now())) / 1000,
                ),
              )
            : n,
      ),
      stepSince: draft.since ? null : Date.now(),
    });
  const change = (
    i: number,
    key: "value" | "note" | "configuration",
    value: number | string | null,
  ) =>
    setDraft({
      ...draft,
      results: draft.results.map((r, n) =>
        n === i ? { ...r, [key]: value } : r,
      ),
    });
  const conditions = (
    i: number,
    patch: Partial<NonNullable<Result["conditions"]>>,
  ) =>
    setDraft((d) => ({
      ...d,
      results: d.results.map((r, n) =>
        n === i
          ? {
              ...r,
              conditions: {
                scenario: "",
                device: store.data.profile?.input || "",
                sensitivity: "",
                test_seconds: null,
                ...r.conditions,
                ...patch,
              },
            }
          : r,
      ),
    }));
  const finish = (abandon = false) =>
    store.run(async () => {
      await store.finish(
        session,
        draft.results.map((r, i) => ({
          ...r,
          step_id: session.steps[i].id,
          unit: session.steps[i].exercise?.measurement?.unit,
          version: session.steps[i].exercise?.measurement?.version,
          status: draft.done[i] ? "completed" : "skipped",
        })),
        Math.min(seconds, 86400),
        abandon,
      );
      localStorage.removeItem(key);
      navigate(
        openJournal && !abandon ? "/app/journal/" + session.id : "/app/reports",
      );
    });
  return (
    <>
      <Heading
        eyebrow="PRATIQUE COM INTENÇÃO"
        title={session.title}
        description="Conclua as etapas, registre observações e ajuste o ritmo quando precisar."
      />
      <p className="muted">
        {contextLabel(session.plan_snapshot?.game_context)} · prática:{" "}
        {practiceLabel(session.plan_snapshot?.practice_format)}
      </p>
      {session.plan_snapshot?.objective && (
        <p>Objetivo: {session.plan_snapshot.objective}</p>
      )}
      <p role="status" className="muted">
        {syncState}
      </p>
      <section className="session-toolbar panel">
        <div>
          <span className="eyebrow">TEMPO ATIVO REGISTRADO</span>
          <strong className="timer" aria-live="off">
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:
            {String(seconds % 60).padStart(2, "0")}
          </strong>
        </div>
        <div className="row">
          <button className="button" onClick={toggle}>
            {draft.since ? <Pause size={16} /> : <Play size={16} />}{" "}
            {draft.since ? "Pausar" : "Retomar"}
          </button>
          <button className="button danger" onClick={() => setConfirm(true)}>
            <Square size={16} />
            Encerrar sem concluir
          </button>
        </div>
        <div>
          <p className="muted">
            {Math.max(
              0,
              session.steps.reduce((n, st) => n + st.minutes * 60, 0) - seconds,
            )}{" "}
            segundos restantes planejados (estimativa global)
          </p>
          <span className="muted">
            {done} de {session.steps.length} etapas
          </span>
          <Progress value={done} max={session.steps.length} />
        </div>
      </section>
      <SessionReadiness sessionId={session.id} />
      <nav className="session-navigation panel" aria-label="Etapas da sessão">
        <div className="row between">
          <h2>Seu percurso</h2>
          <button
            className="button small"
            aria-pressed={allSteps}
            onClick={() => setAllSteps(!allSteps)}
          >
            {allSteps ? "Focar exercício atual" : "Ver todas as etapas"}
          </button>
        </div>
        <div className="session-checklist">
          {session.steps.map((step, i) => (
            <div key={i} className={activeStep === i ? "selected" : ""}>
              <button
                className="text-link"
                onClick={() => setActiveStep(i)}
                aria-current={activeStep === i ? "step" : undefined}
              >
                {i + 1}.{" "}
                {step.exercise?.title ||
                  store.catalog.exercises.find((e) => e.id === step.exercise_id)
                    ?.title}
              </button>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(draft.done[i])}
                  onChange={(ev) =>
                    setDraft({
                      ...draft,
                      done: draft.done.map((d, n) =>
                        n === i ? ev.target.checked : d,
                      ),
                    })
                  }
                />
                Etapa concluída
              </label>
              <button
                className="button small"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    done: d.done.map((v, n) => (n === i ? false : v)),
                    results: d.results.map((r, n) =>
                      n === i ? { ...r, status: "skipped", value: null } : r,
                    ),
                  }))
                }
              >
                Pular etapa
              </button>
              {draft.results[i]?.status === "skipped" && (
                <span className="muted">Etapa pulada</span>
              )}
            </div>
          ))}
        </div>
      </nav>
      <div className="session-steps">
        {session.steps.map((step, i) => {
          const e =
            step.exercise ||
            store.catalog.exercises.find((e) => e.id === step.exercise_id);
          if (!allSteps && i !== activeStep) return null;
          return (
            <TrainingStepTransition key={i} identity={i}>
              <article
                key={i}
                className={`panel session-step ${draft.done[i] ? "done" : ""}`}
              >
                <div className="session-number">
                  {draft.done[i] ? <Check /> : String(i + 1).padStart(2, "0")}
                </div>
                <div className="session-body">
                  <div className="row between">
                    <h2>{e?.title || "Exercício indisponível"}</h2>
                    <Badge>{step.minutes} min planejados</Badge>
                  </div>
                  <p>
                    {e?.instructions ||
                      "Este exercício foi removido do catálogo. Registre suas observações."}
                  </p>
                  {e?.map_code && (
                    <div className="row">
                      <CopyCode code={e.map_code} />
                      <a
                        className="text-link"
                        href={e.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir ilha oficial
                      </a>
                    </div>
                  )}
                  <p className="muted">
                    Nesta etapa:{" "}
                    {(draft.stepElapsed?.[i] || 0) +
                      (draft.stepSince && i === activeStep
                        ? Math.max(
                            0,
                            Math.floor((tick - draft.stepSince) / 1000),
                          )
                        : 0)}{" "}
                    segundos ativos · tempo restante planejado:{" "}
                    {Math.max(
                      0,
                      step.minutes * 60 -
                        (draft.stepElapsed?.[i] || 0) -
                        (draft.stepSince && i === activeStep
                          ? Math.max(
                              0,
                              Math.floor((tick - draft.stepSince) / 1000),
                            )
                          : 0),
                    )}{" "}
                    segundos. O timer não conclui a etapa automaticamente.
                  </p>
                  {step.block && <Badge>{step.block}</Badge>}
                  {step.notes && <p>Notas do plano: {step.notes}</p>}
                  {step.repetitions && (
                    <p>{step.repetitions} repetições planejadas</p>
                  )}
                  {e?.measurement && (
                    <p className="muted">{e.measurement.procedure}</p>
                  )}
                  {step.resource_url && (
                    <a
                      className="text-link"
                      href={step.resource_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir link de apoio
                    </a>
                  )}
                  <div className="form-grid">
                    <label>
                      {e?.metric || "Resultado observado"}
                      <input
                        type="number"
                        min={0}
                        max={e?.measurement?.max ?? 1000000}
                        step="any"
                        placeholder="Opcional"
                        value={draft.results[i]?.value ?? ""}
                        onChange={(ev) =>
                          change(
                            i,
                            "value",
                            ev.target.value === ""
                              ? null
                              : Number(ev.target.value),
                          )
                        }
                      />
                    </label>
                    <label>
                      Configuração comparável (opcional)
                      <input
                        maxLength={200}
                        value={draft.results[i]?.configuration || ""}
                        placeholder="Cenário, arma, modo, sensibilidade e duração do teste"
                        onChange={(ev) =>
                          change(i, "configuration", ev.target.value)
                        }
                      />
                      <small>
                        Use a mesma identificação somente para testes
                        equivalentes. Resultados sem configuração não geram
                        tendência automática.
                      </small>
                    </label>
                    <label>
                      Cenário do teste
                      <input
                        maxLength={120}
                        value={draft.results[i]?.conditions?.scenario || ""}
                        onChange={(ev) =>
                          conditions(i, { scenario: ev.target.value })
                        }
                      />
                    </label>
                    <label>
                      Dispositivo declarado
                      <input
                        maxLength={80}
                        value={draft.results[i]?.conditions?.device || ""}
                        onChange={(ev) =>
                          conditions(i, { device: ev.target.value })
                        }
                        placeholder="Teclado e mouse ou controle"
                      />
                    </label>
                    <label>
                      Sensibilidade declarada
                      <input
                        maxLength={80}
                        value={draft.results[i]?.conditions?.sensitivity || ""}
                        onChange={(ev) =>
                          conditions(i, { sensitivity: ev.target.value })
                        }
                      />
                    </label>
                    <label>
                      Duração do teste (segundos)
                      <input
                        type="number"
                        min={1}
                        max={7200}
                        value={draft.results[i]?.conditions?.test_seconds ?? ""}
                        onChange={(ev) =>
                          conditions(i, {
                            test_seconds: ev.target.value
                              ? Number(ev.target.value)
                              : null,
                          })
                        }
                      />
                    </label>
                    <label>
                      Observação ou erro recorrente
                      <textarea
                        value={draft.results[i]?.note || ""}
                        maxLength={1000}
                        placeholder="O que você quer testar na próxima sessão?"
                        onChange={(ev) => change(i, "note", ev.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </article>
            </TrainingStepTransition>
          );
        })}
      </div>
      <div className="row between session-controls">
        <button
          className="button"
          disabled={activeStep === 0}
          onClick={() => setActiveStep((i) => i - 1)}
        >
          Exercício anterior
        </button>
        <span className="muted">
          Etapa {activeStep + 1} de {session.steps.length}
        </span>
        <button
          className="button"
          disabled={activeStep === session.steps.length - 1}
          onClick={() => setActiveStep((i) => i + 1)}
        >
          Próximo exercício
        </button>
      </div>
      <div className="wellbeing-note">
        <p>
          Faça pausas quando precisar. Se estiver com dificuldade de
          concentração, reduza a sessão ou deixe a próxima atividade para outro
          momento.
        </p>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={openJournal}
          onChange={(e) => setOpenJournal(e.target.checked)}
        />
        Abrir diário opcional após concluir
      </label>
      <div className="row between">
        <p className="muted">
          Pausas não reduzem seu XP. Finalize somente o que você praticou.
        </p>
        <button
          className="button primary"
          disabled={
            draft.done.some(
              (v, i) => !v && draft.results[i]?.status !== "skipped",
            ) || store.busy
          }
          onClick={() => finish()}
        >
          <Check size={17} />
          Concluir e registrar
        </button>
      </div>
      {confirm && (
        <Modal title="Encerrar esta sessão?" onClose={() => setConfirm(false)}>
          <p>
            O tempo e as observações serão guardados como sessão interrompida,
            sem XP.
          </p>
          <button
            className="button danger"
            disabled={store.busy}
            onClick={() => finish(true)}
          >
            Encerrar sem concluir
          </button>
        </Modal>
      )}
    </>
  );
}
