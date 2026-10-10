import { ContextSelector } from "./meta-training/ContextSelector";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { supabase } from "../lib/client";
import type { Tournament } from "../lib/types";
import {
  agendaConflicts,
  checklistDefaults,
  currentEvent,
  preparationExercises,
  preparationSlots,
} from "../lib/competitive";
import { zonedInstant, dateInZone, wallTime } from "../lib/calendar";
import { dateLabel, timeLabel } from "../lib/logic";
import { Source } from "./ui";
type Preview = {
  id: string;
  item: {
    title: string;
    starts_at: string;
    duration_minutes: number;
    kind: "training" | "personal";
    plan_id: string | null;
  };
  expires_at: string;
};
export function CompetitionPreparation({
  event,
  phaseKey,
}: {
  event: Tournament;
  phaseKey?: string;
}) {
  const s = useStore(),
    user = s.data.profile;
  const [metaContext, setMetaContext] = useState("");
  const [loadedFor, setLoadedFor] = useState("");
  const [objective, setObjective] = useState(""),
    [checks, setChecks] = useState(
      checklistDefaults.map((title) => ({ title, done: false })),
    ),
    [extra, setExtra] = useState(""),
    [plan, setPlan] = useState(s.data.plans[0]?.id || ""),
    [date, setDate] = useState(""),
    [time, setTime] = useState("18:00"),
    [preview, setPreview] = useState<Preview | null>(null),
    [message, setMessage] = useState(""),
    [ready, setReady] = useState(false);
  const key = "clutchfolio-preparation-demo:" + event.id;
  useEffect(() => {
    let active = true;
    setReady(false);
    setPreview(null);
    setMessage("");
    async function load() {
      try {
        let row;
        if (s.demo) {
          row = JSON.parse(localStorage.getItem(key) || "null");
        } else if (supabase && user) {
          const r = await supabase
            .from("competition_preparations")
            .select("*")
            .eq("user_id", user.id)
            .eq("tournament_id", event.id)
            .maybeSingle();
          if (r.error) throw r.error;
          row = r.data;
        }
        if (active) {
          setObjective(row?.objective || "");
          setChecks(
            Array.isArray(row?.checklist)
              ? row.checklist
              : checklistDefaults.map((title) => ({ title, done: false })),
          );
          setReady(true);
          setLoadedFor(
            (s.demo ? "demo:" : "account:") + (user?.id || "") + event.id,
          );
        }
      } catch {
        if (active)
          setMessage(
            "Não foi possível carregar sua preparação. Tente reabrir.",
          );
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [user?.id, event.id, s.demo, key]);
  if (!user)
    return (
      <Link to="/auth" className="button">
        Entrar para preparar
      </Link>
    );
  if (loadedFor !== (s.demo ? "demo:" : "account:") + user.id + event.id)
    return <p role="status">{message || "Carregando sua preparação…"}</p>;
  const timezone = user.timezone;
  const routine = s.data.plans.find((p) => p.id === plan),
    slots = preparationSlots(
      s.data,
      event,
      routine?.steps.reduce((n, x) => n + x.minutes, 0) || 0,
    );
  async function saveChecklist() {
    if (!ready) return;
    const row = {
      user_id: user!.id,
      tournament_id: event.id,
      objective,
      checklist: checks,
    };
    if (s.demo) localStorage.setItem(key, JSON.stringify(row));
    else {
      const r = await supabase!.from("competition_preparations").upsert(row);
      if (r.error) throw r.error;
    }
    setMessage("Objetivo e checklist salvos.");
  }
  async function propose() {
    setPreview(null);
    setMessage("");
    if (!currentEvent(event))
      throw new Error(
        "kyrven: confira a fonte; este evento precisa de revisão.",
      );
    const payload = phaseKey
      ? { kind: "event", phase_key: phaseKey }
      : {
          kind: "training",
          plan_id: plan,
          starts_at: zonedInstant(date, time, timezone),
        };
    if (!s.demo) {
      const r = await supabase!.rpc("competition_preview", {
        p_tournament: event.id,
        p_payload: payload,
      });
      if (r.error) throw r.error;
      setPreview(r.data);
      return;
    }
    const phase = event.phases?.find((p) => p.key === phaseKey),
      routine = s.data.plans.find((p) => p.id === plan);
    const start = phaseKey
      ? phase?.starts_at
      : "starts_at" in payload
        ? payload.starts_at
        : null;
    const minutes =
      phaseKey && phase?.ends_at && start
        ? Math.ceil((Date.parse(phase.ends_at) - Date.parse(start)) / 60000)
        : routine?.steps.reduce((n, x) => n + x.minutes, 0) || 0;
    if (
      !start ||
      (!phaseKey && !routine) ||
      Date.parse(start) < Date.now() ||
      minutes < 1 ||
      minutes > (phaseKey ? 240 : 120) ||
      (!phaseKey && date > event.end_date) ||
      (phaseKey &&
        (!phase ||
          phase.status !== "scheduled" ||
          Date.parse(phase.valid_until) < Date.now()))
    )
      throw new Error("kyrven: confira atividade, data e horário confirmado.");
    if (agendaConflicts(s.data, start, minutes).length)
      throw new Error("kyrven: conflito na agenda. Escolha outro horário.");
    setPreview({
      id: crypto.randomUUID(),
      item: {
        title: (event.title + " · " + (phase?.title || "Preparação")).slice(
          0,
          80,
        ),
        starts_at: start,
        duration_minutes: minutes,
        kind: phaseKey ? "personal" : "training",
        plan_id: phaseKey ? null : plan,
      },
      expires_at: new Date(Date.now() + 900000).toISOString(),
    });
  }
  async function confirm() {
    if (!preview) return;
    if (Date.parse(preview.expires_at) < Date.now())
      throw new Error("kyrven: prévia expirada. Gere outra.");
    if (s.demo) {
      if (
        !currentEvent(event) ||
        agendaConflicts(
          s.data,
          preview.item.starts_at,
          preview.item.duration_minutes,
        ).length
      )
        throw new Error("kyrven: evento ou agenda mudou. Gere outra prévia.");
      await s.save("schedules", {
        ...preview.item,
        id: preview.id,
        user_id: user!.id,
        tournament_id: event.id,
        status: "planned",
      });
    } else {
      const r = await supabase!.rpc("competition_confirm", {
        p_id: preview.id,
        p_confirmation: "CONFIRMAR",
      });
      if (r.error) throw r.error;
      await s.refresh();
    }
    setPreview(null);
    setMessage("Atividade confirmada na sua agenda.");
  }
  return (
    <div className="competition-preparation">
      <ContextSelector
        value={metaContext}
        onChange={(id) => setMetaContext(id)}
        mode={event.mode === "both" ? undefined : event.mode}
      />
      {metaContext && (
        <Link
          className="button"
          to={`/app/coach?meta_context=${metaContext}&tournament=${event.id}&q=${encodeURIComponent("Quais conteúdos verificados posso revisar para esta competição?")}`}
        >
          Revisar contexto e regulamento com kyrven coach
        </Link>
      )}
      <p className="muted">
        O contexto escolhido deve corresponder ao regulamento deste evento; a
        seleção não confirma a sua elegibilidade nem a versão utilizada no
        torneio.
      </p>
      <p>
        {event.title} · {dateLabel(event.start_date)} · {timezone}
      </p>
      <Source
        url={event.source_url}
        date={event.verified_at}
        stale={!currentEvent(event)}
      />
      <label>
        Objetivo pessoal
        <textarea
          maxLength={500}
          value={objective}
          disabled={!ready}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Ex.: revisar decisões de rotação, sem meta de classificação."
        />
      </label>
      <fieldset disabled={!ready}>
        <legend>Checklist de preparação</legend>
        {checks.map((x, i) => (
          <label className="checkbox-label" key={i}>
            <input
              type="checkbox"
              checked={x.done}
              onChange={(e) =>
                setChecks(
                  checks.map((c, j) =>
                    j === i ? { ...c, done: e.target.checked } : c,
                  ),
                )
              }
            />
            {x.title}
            <button
              type="button"
              className="text-link"
              aria-label={"Remover item " + x.title}
              onClick={() => setChecks(checks.filter((_, j) => j !== i))}
            >
              Remover
            </button>
          </label>
        ))}
        <label>
          Novo item
          <input
            value={extra}
            maxLength={160}
            onChange={(e) => setExtra(e.target.value)}
          />
        </label>
        <button
          className="button"
          disabled={!extra.trim() || checks.length >= 20}
          onClick={() => {
            setChecks([...checks, { title: extra.trim(), done: false }]);
            setExtra("");
          }}
        >
          Adicionar item
        </button>
      </fieldset>
      <button
        className="button"
        disabled={s.busy || !ready}
        onClick={() => s.run(saveChecklist)}
      >
        Salvar objetivo e checklist
      </button>
      <h3>
        {phaseKey
          ? "Adicionar sessão confirmada"
          : "Propor treino de preparação"}
      </h3>
      {!phaseKey && (
        <>
          <p className="small-text muted">
            Disponibilidade:{" "}
            {s.data.planningPreferences.length
              ? "preferências salvas no planejador; a proposta abaixo respeita os compromissos registrados."
              : "cadastre dias e duração disponíveis no planejador para obter sugestões."}
          </p>
          {slots.length > 0 && (
            <div>
              <p>Sugestões para sua rotina, conforme disponibilidade:</p>
              {slots.map((start) => (
                <button
                  key={start}
                  className="button"
                  onClick={() => {
                    setDate(dateInZone(start, timezone));
                    setTime(wallTime(start, timezone));
                    setPreview(null);
                  }}
                >
                  {timeLabel(start, timezone)}
                </button>
              ))}
            </div>
          )}
          <label>
            Rotina
            <select
              value={plan}
              onChange={(e) => {
                setPlan(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">Escolha uma rotina</option>
              {s.data.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Data
              <input
                type="date"
                value={date}
                max={event.end_date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPreview(null);
                }}
              />
            </label>
            <label>
              Horário em {timezone}
              <input
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setPreview(null);
                }}
              />
            </label>
          </div>
          <Link className="text-link" to="/app/planner">
            Conferir disponibilidade e criar rotina
          </Link>
        </>
      )}
      <button
        className="button primary full"
        disabled={
          s.busy || !currentEvent(event) || (!phaseKey && (!plan || !date))
        }
        onClick={() => s.run(propose)}
      >
        Consultar conflitos e mostrar prévia
      </button>
      {preview && (
        <section className="panel" aria-live="polite">
          <h3>Proposta para sua agenda</h3>
          <p>
            {preview.item.title} · {timeLabel(preview.item.starts_at, timezone)}{" "}
            · {preview.item.duration_minutes} minutos
          </p>
          <p>
            Nenhuma atividade foi criada. Validade: 15 minutos. A agenda será
            conferida novamente.
          </p>
          <button
            className="button primary"
            disabled={s.busy}
            onClick={() => s.run(confirm)}
          >
            Confirmar inclusão na agenda
          </button>
          <button className="button" onClick={() => setPreview(null)}>
            Descartar prévia
          </button>
        </section>
      )}
      {message && (
        <p role="status" className="alert">
          {message}{" "}
          {message.startsWith("Atividade") && (
            <Link to="/app/planner">Abrir agenda</Link>
          )}
        </p>
      )}
      <h3>Conteúdos para preparação</h3>
      <div className="preparation-links">
        {s.catalog.articles
          .filter(
            (a) =>
              (a.kind === "lesson" || a.kind === "analysis") &&
              (!a.valid_until || Date.parse(a.valid_until) >= Date.now()),
          )
          .slice(0, 3)
          .map((a) => (
            <Link
              key={a.id}
              to={(a.kind === "lesson" ? "/academy/" : "/news/") + a.slug}
            >
              {a.title}
            </Link>
          ))}
      </div>
      <h3>Exercícios compatíveis com a modalidade</h3>
      <div className="preparation-links">
        {preparationExercises(s.catalog.exercises, event, user).map((e) => (
          <Link key={e.id} to={"/library/" + e.id}>
            {e.title}
          </Link>
        ))}
      </div>
      <p className="muted small-text">
        Sugestão editorial; não garante resultado. Lembretes aparecem ao abrir o
        site quando habilitados no perfil; não há notificações com o site
        fechado.
      </p>
    </div>
  );
}
