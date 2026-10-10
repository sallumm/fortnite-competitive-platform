import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Download, Plus } from "lucide-react";
import { Calendar } from "./Calendar";
import { Badge, Modal } from "./ui";
import { useStore } from "../lib/store";
import type { Plan } from "../lib/types";
import type {
  ActivityKind,
  Occurrence,
  Series,
} from "../lib/performance-types";
import {
  calendarICS,
  conflicts,
  dateInZone,
  expandCalendar,
  shiftDate,
  wallTime,
  zonedInstant,
} from "../lib/calendar";
import { download, timeLabel } from "../lib/logic";
const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
interface Form {
  title: string;
  kind: ActivityKind;
  plan_id: string;
  datetime: string;
  duration: number;
  repeat: boolean;
  weekdays: number[];
  end: string;
  scope: "occurrence" | "series";
}
export function PlanningCalendar({
  intent,
  onHandled,
}: {
  intent: Plan | null;
  onHandled: () => void;
}) {
  const s = useStore(),
    p = s.data.profile!,
    navigate = useNavigate();
  const today = dateInZone(new Date(), p.timezone);
  const [range, setRange] = useState({
    from: shiftDate(today, -7),
    to: shiftDate(today, 42),
  });
  const onRange = useCallback(
    (from: string, to: string) => setRange({ from, to }),
    [],
  );
  const [form, setForm] = useState<Form | null>(null),
    [editing, setEditing] = useState<Occurrence | null>(null),
    [allowConflict, setAllowConflict] = useState(false),
    [viewFilter, setViewFilter] = useState<"upcoming" | "history">("upcoming");
  const occurrences = useMemo(
    () => expandCalendar(s.data, range.from, range.to),
    [s.data, range],
  );
  const savedTournaments = s.catalog.tournaments.filter(
    (t) =>
      s.data.bookmarks.some(
        (b) => b.kind === "tournament" && b.target_id === t.id,
      ) && !["cancelled", "postponed"].includes(t.status),
  );
  const tournamentRows: Occurrence[] = savedTournaments
    .filter((t) => t.starts_at && t.ends_at)
    .map((t) => ({
      key: "event:" + t.id,
      schedule_id: null,
      series_id: null,
      occurrence_date: dateInZone(t.starts_at!, p.timezone),
      starts_at: t.starts_at!,
      duration_minutes: Math.ceil(
        (Date.parse(t.ends_at!) - Date.parse(t.starts_at!)) / 60000,
      ),
      title: t.title,
      kind: "personal",
      plan_id: null,
      tournament_id: t.id,
      status: "planned",
      session_id: null,
    }));
  const create = (plan?: Plan) => {
    setEditing(null);
    setAllowConflict(false);
    const prefs = s.data.planningPreferences[0];
    setForm({
      title: plan?.title || "",
      kind: plan ? "training" : "personal",
      plan_id: plan?.id || "",
      datetime: today + "T" + (prefs?.local_time.slice(0, 5) || "18:00"),
      duration: plan?.steps.reduce((n, x) => n + x.minutes, 0) || 30,
      repeat: false,
      weekdays: prefs?.weekdays || [1, 3],
      end: "",
      scope: "occurrence",
    });
  };
  useEffect(() => {
    if (intent) {
      create(intent);
      onHandled();
    }
  }, [intent]);
  const open = (o: Occurrence) => {
    setEditing(o);
    setAllowConflict(false);
    const series = s.data.series.find((r) => r.id === o.series_id);
    setForm({
      title: o.title,
      kind: o.kind,
      plan_id: o.plan_id || "",
      datetime:
        dateInZone(o.starts_at, p.timezone) +
        "T" +
        wallTime(o.starts_at, p.timezone),
      duration: o.duration_minutes,
      repeat: !!series,
      weekdays: series?.weekdays || [1, 3],
      end: series?.end_date || "",
      scope: "occurrence",
    });
  };
  const update = (patch: Partial<Form>) =>
    setForm((f) => (f ? { ...f, ...patch } : f));
  let preview: Occurrence | null = null,
    previewError = "";
  if (form?.datetime)
    try {
      preview = {
        key: editing?.key || "new",
        schedule_id: editing?.schedule_id || null,
        series_id: editing?.series_id || null,
        occurrence_date: editing?.occurrence_date || form.datetime.slice(0, 10),
        starts_at: zonedInstant(
          form.datetime.slice(0, 10),
          form.datetime.slice(11),
          p.timezone,
        ),
        duration_minutes: form.duration,
        title: form.title,
        kind: form.kind,
        plan_id: form.plan_id || null,
        tournament_id: editing?.tournament_id || null,
        status: "planned",
        session_id: null,
      };
    } catch (e) {
      previewError = (e as Error).message;
    }
  const overlaps = preview
    ? conflicts(preview, [
        ...expandCalendar(
          s.data,
          shiftDate(form!.datetime.slice(0, 10), -1),
          shiftDate(form!.datetime.slice(0, 10), 1),
        ),
        ...tournamentRows,
      ])
    : [];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form || !preview || (overlaps.length && !allowConflict)) return;
    const f = form,
      o = preview;
    s.run(async () => {
      if (f.kind === "training" && !f.plan_id)
        throw new Error("Clutchfolio: escolha uma rotina.");
      if (editing?.series_id && f.scope === "occurrence") {
        const existing = s.data.exceptions.find(
          (e) =>
            e.series_id === editing.series_id &&
            e.occurrence_date === editing.occurrence_date,
        );
        await s.save("exceptions", {
          id: existing?.id || crypto.randomUUID(),
          user_id: p.id,
          series_id: editing.series_id,
          occurrence_date: editing.occurrence_date,
          starts_at: o.starts_at,
          duration_minutes: f.duration,
          title: f.title,
          status: "planned",
        });
      } else if (f.repeat) {
        const original = s.data.series.find((r) => r.id === editing?.series_id);
        const row: Series = {
          id: crypto.randomUUID(),
          user_id: p.id,
          title: f.title,
          kind: f.kind,
          plan_id: f.kind === "training" ? f.plan_id : null,
          timezone: p.timezone,
          local_time: f.datetime.slice(11, 16),
          start_date: editing?.series_id
            ? editing.occurrence_date
            : f.datetime.slice(0, 10),
          end_date: f.end || null,
          weekdays: f.weekdays,
          duration_minutes: f.duration,
          tournament_id: editing?.tournament_id || null,
        };
        if (original)
          await s.reviseSeries(original, editing!.occurrence_date, row);
        else await s.save("series", row);
      } else
        await s.save("schedules", {
          id: editing?.schedule_id || crypto.randomUUID(),
          user_id: p.id,
          plan_id: f.kind === "training" ? f.plan_id : null,
          starts_at: o.starts_at,
          tournament_id: editing?.tournament_id || null,
          title: f.title,
          kind: f.kind,
          duration_minutes: f.duration,
          status: "planned",
        });
      setForm(null);
    });
  };
  const cancel = (o: Occurrence) =>
    s.run(async () => {
      if (o.series_id) {
        const e = s.data.exceptions.find(
          (e) =>
            e.series_id === o.series_id &&
            e.occurrence_date === o.occurrence_date,
        );
        await s.save("exceptions", {
          id: e?.id || crypto.randomUUID(),
          user_id: p.id,
          series_id: o.series_id,
          occurrence_date: o.occurrence_date,
          starts_at: null,
          duration_minutes: null,
          title: null,
          status: "cancelled",
        });
      } else {
        const a = s.data.schedules.find((a) => a.id === o.schedule_id)!;
        await s.save("schedules", { ...a, status: "cancelled" });
      }
      setForm(null);
    });
  const markDone = (o: Occurrence) =>
    s.run(async () => {
      if (o.series_id) {
        const e = s.data.exceptions.find(
          (e) =>
            e.series_id === o.series_id &&
            e.occurrence_date === o.occurrence_date,
        );
        await s.save("exceptions", {
          id: e?.id || crypto.randomUUID(),
          user_id: p.id,
          series_id: o.series_id,
          occurrence_date: o.occurrence_date,
          starts_at: o.starts_at,
          duration_minutes: o.duration_minutes,
          title: o.title,
          status: "done",
        });
      } else
        await s.save("schedules", {
          ...s.data.schedules.find((a) => a.id === o.schedule_id)!,
          status: "done",
        });
    });
  const listing = expandCalendar(
    s.data,
    shiftDate(today, viewFilter === "history" ? -90 : 0),
    shiftDate(today, viewFilter === "history" ? 0 : 30),
  ).filter((o) =>
    viewFilter === "history"
      ? Date.parse(o.starts_at) < Date.now() || o.status !== "planned"
      : o.status === "planned",
  );
  return (
    <>
      <div className="section-title outside">
        <div>
          <h2>Calendário pessoal</h2>
          <small className="muted">
            Horários em {p.timezone}. Treinos, compromissos e descanso.
          </small>
        </div>
        <div className="row wrap">
          <button className="button" onClick={() => create()}>
            <Plus size={16} />
            Criar atividade
          </button>
          <button
            className="button"
            onClick={() =>
              download(
                calendarICS(occurrences),
                "clutchfolio-agenda.ics",
                "text/calendar",
              )
            }
          >
            <Download size={16} />
            Exportar período ICS
          </button>
        </div>
      </div>
      <div className="calendar-legend">
        <Badge tone="green">Treino</Badge>
        <Badge>Compromisso / descanso</Badge>
        <Badge tone="purple">Campeonato salvo</Badge>
        <span>Conflitos são avisos: você decide como organizar.</span>
      </div>
      <Calendar
        timezone={p.timezone}
        onRangeChange={onRange}
        items={[
          ...occurrences.map((o) => ({
            id: o.key,
            date: dateInZone(o.starts_at, p.timezone),
            title: `${wallTime(o.starts_at, p.timezone)} · ${o.title}${o.status === "done" ? " · concluída" : o.status === "cancelled" ? " · cancelada" : ""}`,
            tone:
              o.status === "cancelled"
                ? "cancelled"
                : o.kind === "training"
                  ? "training"
                  : "personal",
            onClick: () => open(o),
          })),
          ...savedTournaments.flatMap((t) => {
            const dates = [];
            for (
              let date = t.start_date;
              date <= t.end_date && dates.length < 31;
              date = shiftDate(date, 1)
            )
              dates.push(date);
            return dates.map((date) => ({
              id: t.id + date,
              date: t.starts_at ? dateInZone(t.starts_at, p.timezone) : date,
              title: t.title + (t.starts_at ? "" : " · confirmar horário"),
              tone: "tournament",
              onClick: () => navigate("/competitive/" + t.slug),
            }));
          }),
        ]}
      />
      <section className="panel agenda-list">
        <div className="section-title">
          <h2>Atividades e histórico</h2>
          <div className="tabs">
            <button
              aria-pressed={viewFilter === "upcoming"}
              onClick={() => setViewFilter("upcoming")}
            >
              Próximos 30 dias
            </button>
            <button
              aria-pressed={viewFilter === "history"}
              onClick={() => setViewFilter("history")}
            >
              Últimos 90 dias
            </button>
          </div>
        </div>
        {!listing.length && (
          <p className="muted">
            Nenhuma atividade neste período. Crie um agendamento único ou uma
            série semanal.
          </p>
        )}
        {listing.map((o) => (
          <div className="list-row" key={o.key}>
            <CalendarDays size={18} />
            <div>
              <strong>{o.title}</strong>
              <small>
                {timeLabel(o.starts_at, p.timezone)} · {o.duration_minutes} min{" "}
                {o.series_id ? " · recorrente" : ""}
              </small>
              <small>
                {o.status === "done"
                  ? "Concluída, autodeclarada"
                  : o.status === "cancelled"
                    ? "Cancelada"
                    : Date.parse(o.starts_at) + o.duration_minutes * 60000 <
                        Date.now()
                      ? "Pendente · você pode reagendar"
                      : "Planejada"}
                {conflicts(o, [...listing, ...tournamentRows]).length
                  ? " · conflito de horário"
                  : ""}
              </small>
            </div>
            <div className="row wrap">
              {o.status === "planned" && o.kind === "training" && (
                <button
                  className="button primary small"
                  disabled={s.busy}
                  onClick={() =>
                    s.run(async () => {
                      const active = s.data.sessions.find(
                        (x) => x.status === "active",
                      );
                      const plan = s.data.plans.find(
                        (x) => x.id === o.plan_id,
                      )!;
                      const session = active || (await s.start(plan, o));
                      navigate("/app/session/" + session.id);
                    })
                  }
                >
                  Começar treino
                </button>
              )}
              {o.status === "planned" && o.kind !== "training" && (
                <button
                  className="button small"
                  disabled={s.busy}
                  onClick={() => markDone(o)}
                >
                  Marcar concluída
                </button>
              )}
              <button className="button small" onClick={() => open(o)}>
                {Date.parse(o.starts_at) < Date.now() && o.status === "planned"
                  ? "Reagendar"
                  : "Detalhes / editar"}
              </button>
            </div>
          </div>
        ))}
      </section>
      {form && (
        <Modal
          title={editing ? "Editar atividade" : "Agendar atividade"}
          onClose={() => setForm(null)}
        >
          <form onSubmit={submit}>
            {editing?.status === "done" ? (
              <>
                <p>
                  Esta atividade está concluída. O vínculo e os resultados
                  permanecem no histórico.
                </p>
                {editing.session_id && (
                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      navigate("/app/journal/" + editing.session_id)
                    }
                  >
                    Revisar diário
                  </button>
                )}
              </>
            ) : (
              <>
                {editing?.series_id && (
                  <label>
                    Aplicar alteração
                    <select
                      value={form.scope}
                      onChange={(e) =>
                        update({ scope: e.target.value as Form["scope"] })
                      }
                    >
                      <option value="occurrence">
                        Somente esta ocorrência
                      </option>
                      <option value="series">
                        Série inteira a partir desta ocorrência
                      </option>
                    </select>
                    <small>
                      Ocorrências anteriores são preservadas. Exceções futuras
                      exigem revisão individual.
                    </small>
                  </label>
                )}
                {(!editing?.series_id || form.scope === "series") && (
                  <label>
                    Tipo de atividade
                    <select
                      value={form.kind}
                      onChange={(e) =>
                        update({
                          kind: e.target.value as ActivityKind,
                          plan_id:
                            e.target.value === "training"
                              ? s.data.plans[0]?.id || ""
                              : "",
                        })
                      }
                    >
                      <option value="training">Treino</option>
                      <option value="personal">
                        Compromisso pessoal / estudos
                      </option>
                      <option value="rest">Descanso / pausa</option>
                    </select>
                  </label>
                )}
                {form.kind === "training" &&
                  (!editing?.series_id || form.scope === "series") && (
                    <label>
                      Rotina
                      <select
                        required
                        value={form.plan_id}
                        onChange={(e) => {
                          const plan = s.data.plans.find(
                            (p) => p.id === e.target.value,
                          );
                          update({
                            plan_id: e.target.value,
                            title: plan?.title || form.title,
                            duration:
                              plan?.steps.reduce((n, x) => n + x.minutes, 0) ||
                              30,
                          });
                        }}
                      >
                        <option value="">Selecione…</option>
                        {s.data.plans.map((plan) => (
                          <option value={plan.id} key={plan.id}>
                            {plan.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                <label>
                  Título
                  <input
                    required
                    maxLength={80}
                    value={form.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                  <small>
                    Compromissos pessoais podem usar um título genérico, sem
                    detalhes privados.
                  </small>
                </label>
                <label>
                  Data e horário
                  <input
                    type="datetime-local"
                    required
                    value={form.datetime}
                    onChange={(e) => {
                      update({ datetime: e.target.value });
                      setAllowConflict(false);
                    }}
                  />
                  <small>
                    Entrada no fuso {p.timezone}. Horários repetidos no fim do
                    horário de verão usam a primeira ocorrência; horários
                    inexistentes são rejeitados ou omitidos na série.
                  </small>
                </label>
                <label>
                  Duração em minutos
                  <input
                    type="number"
                    required
                    min={1}
                    max={240}
                    value={form.duration}
                    onChange={(e) =>
                      update({ duration: Number(e.target.value) })
                    }
                  />
                </label>
                {!editing && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.repeat}
                      onChange={(e) => update({ repeat: e.target.checked })}
                    />
                    Repetir semanalmente
                  </label>
                )}
                {form.repeat &&
                  (!editing?.series_id || form.scope === "series") && (
                    <>
                      <fieldset>
                        <legend>Dias de repetição</legend>
                        <div className="weekday-picker">
                          {dayNames.map((name, d) => (
                            <label key={d} className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={form.weekdays.includes(d)}
                                onChange={(e) =>
                                  update({
                                    weekdays: e.target.checked
                                      ? [...form.weekdays, d]
                                      : form.weekdays.filter((x) => x !== d),
                                  })
                                }
                              />
                              {name}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <label>
                        Repetir até (opcional)
                        <input
                          type="date"
                          min={form.datetime.slice(0, 10)}
                          value={form.end}
                          onChange={(e) => update({ end: e.target.value })}
                        />
                      </label>
                    </>
                  )}
                {previewError && (
                  <p role="alert" className="alert error">
                    {previewError}
                  </p>
                )}
                {!!overlaps.length && (
                  <div className="conflict-notice">
                    <strong>
                      Conflito com {overlaps.map((o) => o.title).join(", ")}.
                    </strong>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={allowConflict}
                        onChange={(e) => setAllowConflict(e.target.checked)}
                      />
                      Salvar mesmo com conflito
                    </label>
                  </div>
                )}
                <button
                  className="button primary full"
                  disabled={
                    s.busy ||
                    !preview ||
                    (form.repeat && !form.weekdays.length) ||
                    (!!overlaps.length && !allowConflict)
                  }
                >
                  Salvar agendamento
                </button>
                {editing && (
                  <button
                    type="button"
                    className="button danger full"
                    disabled={s.busy}
                    onClick={() => cancel(editing)}
                  >
                    Cancelar esta ocorrência
                  </button>
                )}
                {editing?.series_id && (
                  <button
                    type="button"
                    className="button danger full"
                    disabled={s.busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Excluir a série e suas exceções? Sessões realizadas e diários serão preservados, mas a programação será removida.",
                        )
                      )
                        s.run(async () => {
                          await s.remove("series", editing.series_id!);
                          setForm(null);
                        });
                    }}
                  >
                    Excluir série inteira
                  </button>
                )}
                {editing?.schedule_id && (
                  <button
                    type="button"
                    className="button danger full"
                    disabled={s.busy}
                    onClick={() =>
                      s.run(async () => {
                        await s.remove("schedules", editing.schedule_id!);
                        setForm(null);
                      })
                    }
                  >
                    Excluir atividade
                  </button>
                )}
              </>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
