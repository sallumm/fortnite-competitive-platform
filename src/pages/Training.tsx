import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Pause, Play, Square } from "lucide-react";
import { useStore } from "../lib/store";
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
}
export default function Training() {
  const { id } = useParams();
  const store = useStore();
  const session = store.data.sessions.find((s) => s.id === id);
  const navigate = useNavigate();
  const key = "clutchfolio-session-" + id;
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      if (saved) return saved;
    } catch {}
    return {
      elapsed: 0,
      since: Date.now(),
      done: session?.steps.map(() => false) || [],
      results:
        session?.steps.map((x) => ({
          exercise_id: x.exercise_id,
          value: null,
          note: "",
        })) || [],
    };
  });
  const [tick, setTick] = useState(Date.now());
  const [confirm, setConfirm] = useState(false);
  const [openJournal, setOpenJournal] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(draft));
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
  const finish = (abandon = false) =>
    store.run(async () => {
      await store.finish(session, draft.results, seconds, abandon);
      sessionStorage.removeItem(key);
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
          <span className="muted">
            {done} de {session.steps.length} etapas
          </span>
          <Progress value={done} max={session.steps.length} />
        </div>
      </section>
      <div className="session-steps">
        {session.steps.map((step, i) => {
          const e =
            step.exercise ||
            store.catalog.exercises.find((e) => e.id === step.exercise_id);
          return (
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
                <div className="form-grid">
                  <label>
                    {e?.metric || "Resultado observado"}
                    <input
                      type="number"
                      min={0}
                      max={1000000}
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
                    Observação ou erro recorrente
                    <textarea
                      value={draft.results[i]?.note || ""}
                      maxLength={1000}
                      placeholder="O que você quer testar na próxima sessão?"
                      onChange={(ev) => change(i, "note", ev.target.value)}
                    />
                  </label>
                </div>
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
              </div>
            </article>
          );
        })}
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
          disabled={done !== session.steps.length || store.busy}
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
