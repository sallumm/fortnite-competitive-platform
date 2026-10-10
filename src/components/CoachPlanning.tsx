import { useState, type FormEvent } from "react";
import { useStore } from "../lib/store";
import {
  dateInZone,
  shiftDate,
  zonedInstant,
  expandCalendar,
  conflicts,
} from "../lib/calendar";
import { actionSchema, type CoachAction, type Pending } from "../lib/coach";
import { supabase } from "../lib/client";
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function CoachPlanning({
  question,
  call,
}: {
  question: string;
  call: (body: unknown) => Promise<unknown>;
}) {
  const s = useStore(),
    p = s.data.profile!,
    text = question.toLowerCase(),
    today = dateInZone(new Date(), p.timezone);
  const [operation, setOperation] = useState("create"),
    [date, setDate] = useState(shiftDate(today, 1)),
    [time, setTime] = useState("18:00"),
    [minutes, setMinutes] = useState(
      Number(text.match(/(\d+)\s*min/)?.[1] || 40),
    );
  const [title, setTitle] = useState(
    /vod/.test(text)
      ? "Revisão de VOD"
      : /mira/.test(text)
        ? "Treino de mira"
        : "Atividade planejada",
  );
  const [plan, setPlan] = useState(
    /vod/.test(text) ? "" : s.data.plans[0]?.id || "",
  );
  const [days, setDays] = useState<number[]>(
    [
      "domingo",
      "segunda",
      "terça",
      "quarta",
      "quinta",
      "sexta",
      "sábado",
    ].flatMap((d, i) => (text.includes(d) ? [i] : [])),
  );
  const [recurring, setRecurring] = useState(
      /aos domingos|toda semana|semanal/.test(text),
    ),
    [target, setTarget] = useState("");
  const [pending, setPending] = useState<Pending | null>(null),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const eligible = s.data.schedules.filter(
    (a) =>
      a.status === "planned" &&
      !s.data.sessions.some(
        (t) =>
          t.schedule_id === a.id && ["active", "completed"].includes(t.status),
      ),
  );
  const reset = () => {
    setPending(null);
    setDone(false);
    setError("");
  };
  function validateDemo(payload: CoachAction) {
    actionSchema.parse(payload);
    const target =
      payload.kind === "move" || payload.kind === "cancel"
        ? eligible.find((a) => a.id === payload.schedule_id)
        : null;
    if ((payload.kind === "move" || payload.kind === "cancel") && !target)
      throw Error("Atividade indisponível.");
    const rows = expandCalendar(s.data, date, shiftDate(date, 60)).filter(
      (o) => o.schedule_id !== target?.id,
    );
    const items =
      payload.kind === "create"
        ? payload.items
        : payload.kind === "move"
          ? [
              {
                starts_at: payload.starts_at,
                duration_minutes: target?.duration_minutes || 30,
              },
            ]
          : payload.kind === "series"
            ? Array.from({ length: 56 }, (_, i) =>
                shiftDate(payload.start_date, i),
              )
                .filter((d) =>
                  payload.weekdays.includes(
                    new Date(d + "T12:00:00Z").getUTCDay(),
                  ),
                )
                .map((d) => ({
                  starts_at: zonedInstant(
                    d,
                    payload.local_time,
                    payload.timezone,
                  ),
                  duration_minutes: payload.duration_minutes,
                }))
            : [];
    for (const item of items) {
      if (Date.parse(item.starts_at) <= Date.now())
        throw Error("Escolha um horário futuro.");
      if (
        conflicts(
          { ...item, key: "proposal" } as Parameters<typeof conflicts>[0],
          rows,
        ).length
      )
        throw Error("Conflito na agenda. Escolha outro horário.");
    }
  }
  async function preview(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let payload: CoachAction;
      if (operation === "move")
        payload = {
          kind: "move",
          schedule_id: target,
          starts_at: zonedInstant(date, time, p.timezone),
        };
      else if (operation === "cancel")
        payload = { kind: "cancel", schedule_id: target };
      else if (recurring)
        payload = {
          kind: "series",
          title,
          activity_kind: plan ? "training" : "personal",
          plan_id: plan || null,
          timezone: p.timezone,
          local_time: time,
          start_date: date,
          end_date: shiftDate(date, 55),
          weekdays: days,
          duration_minutes: minutes,
        };
      else {
        const dates = days.length
          ? Array.from({ length: 7 }, (_, i) => shiftDate(date, i)).filter(
              (d) => days.includes(new Date(d + "T12:00:00Z").getUTCDay()),
            )
          : [date];
        payload = {
          kind: "create",
          items: dates.map((d) => ({
            title,
            starts_at: zonedInstant(d, time, p.timezone),
            duration_minutes: minutes,
            kind: plan ? "training" : "personal",
            plan_id: plan || null,
          })),
        };
      }
      actionSchema.parse(payload);
      if (s.demo) {
        validateDemo(payload);
        setPending({
          id: crypto.randomUUID(),
          payload,
          status: "pending",
          expires_at: new Date(Date.now() + 900000).toISOString(),
        });
      } else setPending((await call({ op: "propose", payload })) as Pending);
      setDone(false);
      setConfirmation("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível gerar a prévia.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!pending || done) return;
    setBusy(true);
    setError("");
    try {
      const a = pending.payload;
      if (Date.parse(pending.expires_at) < Date.now())
        throw Error("A prévia expirou. Gere outra.");
      if (s.demo) {
        validateDemo(a);
        if (a.kind === "create")
          for (const item of a.items)
            await s.save("schedules", {
              ...item,
              id: crypto.randomUUID(),
              user_id: p.id,
              tournament_id: null,
              status: "planned",
            });
        else if (a.kind === "series")
          await s.save("series", {
            id: crypto.randomUUID(),
            user_id: p.id,
            title: a.title,
            kind: a.activity_kind,
            plan_id: a.plan_id,
            timezone: a.timezone,
            local_time: a.local_time,
            start_date: a.start_date,
            end_date: a.end_date,
            weekdays: a.weekdays,
            duration_minutes: a.duration_minutes,
            tournament_id: null,
          });
        else {
          const row = s.data.schedules.find((r) => r.id === a.schedule_id)!;
          await s.save("schedules", {
            ...row,
            ...(a.kind === "move"
              ? { starts_at: a.starts_at }
              : { status: "cancelled" }),
          });
        }
      } else {
        await call({
          op: "confirm",
          id: pending.id,
          confirmation: a.kind === "cancel" ? "CANCELAR" : "CONFIRMAR",
        });
        if (supabase) await s.refresh();
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível confirmar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="coach-planning panel">
      <h3>Organizar atividades</h3>
      <p className="muted">
        Revise os campos sugeridos. Horário inicial: 18h. Fuso: {p.timezone}.
        Nenhuma alteração acontece antes da confirmação.
      </p>
      <form onSubmit={preview} onChange={reset}>
        <div className="form-grid">
          <label>
            Operação
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
            >
              <option value="create">Adicionar atividades</option>
              <option value="move">Reagendar atividade avulsa</option>
              <option value="cancel">Cancelar atividade avulsa</option>
            </select>
          </label>
          {operation !== "create" ? (
            <label>
              Atividade
              <select
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Escolha uma atividade</option>
                {eligible.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title ||
                      s.data.plans.find((p) => p.id === a.plan_id)?.title}{" "}
                    ·{" "}
                    {new Date(a.starts_at).toLocaleString("pt-BR", {
                      timeZone: p.timezone,
                    })}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                Título
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  required
                />
              </label>
              <label>
                Rotina
                <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                  <option value="">Estudo / atividade pessoal</option>
                  {s.data.plans.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Duração (min)
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  required
                />
              </label>
            </>
          )}
          {operation !== "cancel" && (
            <>
              <label>
                Data inicial
                <input
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
              <label>
                Horário
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </label>
            </>
          )}
        </div>
        {operation === "create" && (
          <>
            <fieldset>
              <legend>Dias na próxima semana (opcional)</legend>
              <div className="row wrap">
                {weekdays.map((d, i) => (
                  <label key={d}>
                    <input
                      type="checkbox"
                      checked={days.includes(i)}
                      onChange={(e) =>
                        setDays(
                          e.target.checked
                            ? [...days, i]
                            : days.filter((x) => x !== i),
                        )
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="check">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />
              Repetir nesses dias por 8 semanas (data final explícita)
            </label>
          </>
        )}
        <button className="button" disabled={busy} type="submit">
          {busy ? "Verificando…" : "Gerar prévia e verificar conflitos"}
        </button>
      </form>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="coach-preview">
          <h4>
            Prévia validada ·{" "}
            {pending.payload.kind === "cancel"
              ? "cancelamento"
              : "planejamento"}
          </h4>
          <p>
            {pending.payload.kind === "create"
              ? `${pending.payload.items.length} atividades de ${pending.payload.items[0].duration_minutes} minutos.`
              : pending.payload.kind === "series"
                ? `${pending.payload.title}: ${pending.payload.weekdays.map((d) => weekdays[d]).join(", ")}, às ${pending.payload.local_time}, de ${pending.payload.start_date} até ${pending.payload.end_date}.`
                : pending.payload.kind === "move"
                  ? `Reagendar para ${new Date(pending.payload.starts_at).toLocaleString("pt-BR", { timeZone: p.timezone })}.`
                  : "Cancelar a atividade selecionada, mantendo o registro."}
          </p>
          {pending.payload.kind === "create" && (
            <ul>
              {pending.payload.items.map((a, i) => (
                <li key={i}>
                  {a.title} ·{" "}
                  {new Date(a.starts_at).toLocaleString("pt-BR", {
                    timeZone: p.timezone,
                  })}{" "}
                  · {a.duration_minutes} min
                </li>
              ))}
            </ul>
          )}
          <p className="small-text muted">
            A prévia expira em 15 minutos. Os conflitos serão consultados
            novamente ao confirmar.
          </p>
          {pending.payload.kind === "cancel" && !done && (
            <label>
              Digite CANCELAR para confirmar
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </label>
          )}
          <button
            className="button primary"
            disabled={
              busy ||
              done ||
              (pending.payload.kind === "cancel" && confirmation !== "CANCELAR")
            }
            onClick={confirm}
          >
            {done
              ? "Alteração concluída"
              : busy
                ? "Confirmando…"
                : pending.payload.kind === "cancel"
                  ? "Confirmar cancelamento"
                  : "Confirmar proposta"}
          </button>
          {done && (
            <p role="status">
              {s.demo
                ? "Atividades atualizadas na demonstração local."
                : "Alteração confirmada pelo servidor."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
