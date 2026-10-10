import type { PlayerData } from "./types";
import type { Occurrence, Series } from "./performance-types";
const dayMs = 86400000;
const formatters = new Map<string, Intl.DateTimeFormat>();
const instants = new Map<string, string>();
function formatter(timezone: string, time = false) {
  const key = timezone + String(time);
  let value = formatters.get(key);
  if (!value) {
    value = new Intl.DateTimeFormat(
      time ? "en-GB" : "en-CA",
      time
        ? {
            timeZone: timezone,
            hourCycle: "h23",
            hour: "2-digit",
            minute: "2-digit",
          }
        : {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          },
    );
    formatters.set(key, value);
  }
  return value;
}
export function dateInZone(instant: string | Date, timezone: string) {
  const parts = formatter(timezone).formatToParts(new Date(instant));
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + days * dayMs)
    .toISOString()
    .slice(0, 10);
}
export function weekday(date: string) {
  return new Date(date + "T12:00:00Z").getUTCDay();
}
export function weekStart(date: string) {
  return shiftDate(date, -((weekday(date) + 6) % 7));
}
export function wallTime(instant: string, timezone: string) {
  const parts = formatter(timezone, true).formatToParts(new Date(instant));
  return `${parts.find((p) => p.type === "hour")!.value}:${parts.find((p) => p.type === "minute")!.value}`;
}
/** Real IANA offsets, including DST. Repeated wall times choose the first instant; gaps are rejected. */
export function zonedInstant(date: string, time: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time))
    throw new Error("Clutchfolio: data ou horário inválido.");
  const cacheKey = JSON.stringify([date, time.slice(0, 5), timezone]);
  const cached = instants.get(cacheKey);
  if (cached) return cached;
  const wall = Date.parse(date + "T" + time.slice(0, 5) + ":00Z");
  if (
    !Number.isFinite(wall) ||
    new Date(wall).toISOString().slice(0, 16) !== date + "T" + time.slice(0, 5)
  )
    throw new Error("Clutchfolio: data ou horário inválido.");
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = new Date(wall + hours * 3600000);
    const rendered = Date.parse(
      dateInZone(probe, timezone) +
        "T" +
        wallTime(probe.toISOString(), timezone) +
        ":00Z",
    );
    offsets.add(rendered - probe.getTime());
  }
  const candidates = [...offsets]
    .map((offset) => new Date(wall - offset).toISOString())
    .filter(
      (iso) =>
        dateInZone(iso, timezone) === date &&
        wallTime(iso, timezone) === time.slice(0, 5),
    )
    .sort();
  if (!candidates.length)
    throw new Error(
      "Clutchfolio: este horário não existe no fuso escolhido devido à mudança de horário. Escolha outro horário.",
    );
  if (instants.size >= 2048) instants.clear();
  instants.set(cacheKey, candidates[0]);
  return candidates[0];
}
export function validOccurrence(series: Series, date: string) {
  return (
    date >= series.start_date &&
    (!series.end_date || date <= series.end_date) &&
    series.weekdays.includes(weekday(date))
  );
}
export function expandCalendar(
  data: PlayerData,
  from: string,
  to: string,
): Occurrence[] {
  if (
    to < from ||
    Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z") >
      370 * dayMs
  )
    throw new Error("Intervalo de calendário inválido");
  const timezone = data.profile?.timezone || "America/Sao_Paulo";
  const completed = (
    schedule: string | null,
    series: string | null,
    date: string,
  ) =>
    data.sessions.find(
      (s) =>
        s.status === "completed" &&
        (schedule
          ? s.schedule_id === schedule
          : s.series_id === series && s.occurrence_date === date),
    );
  const rows: Occurrence[] = data.schedules.map((s) => ({
    key: s.id,
    schedule_id: s.id,
    series_id: null,
    occurrence_date: dateInZone(s.starts_at, timezone),
    starts_at: s.starts_at,
    duration_minutes:
      s.duration_minutes ??
      data.plans
        .find((p) => p.id === s.plan_id)
        ?.steps.reduce((n, st) => n + st.minutes, 0) ??
      30,
    title:
      s.title || data.plans.find((p) => p.id === s.plan_id)?.title || "Treino",
    kind: s.kind || "training",
    plan_id: s.plan_id,
    tournament_id: s.tournament_id,
    status: completed(s.id, null, "") ? "done" : s.status || "planned",
    session_id: completed(s.id, null, "")?.id || null,
  }));
  for (const series of data.series) {
    // Include moved exceptions originating outside the visible interval.
    const dates = new Set<string>(
      data.exceptions
        .filter((e) => e.series_id === series.id)
        .map((e) => e.occurrence_date),
    );
    const first =
      shiftDate(from, -2) > series.start_date
        ? shiftDate(from, -2)
        : series.start_date;
    for (
      let date = first;
      date <= shiftDate(to, 2) && (!series.end_date || date <= series.end_date);
      date = shiftDate(date, 1)
    )
      if (validOccurrence(series, date)) dates.add(date);
    for (const date of dates) {
      if (!validOccurrence(series, date)) continue;
      const exception = data.exceptions.find(
        (e) => e.series_id === series.id && e.occurrence_date === date,
      );
      let instant = exception?.starts_at;
      if (!instant) {
        try {
          instant = zonedInstant(date, series.local_time, series.timezone);
        } catch {
          continue;
        }
      }
      const session = completed(null, series.id, date);
      rows.push({
        key: series.id + ":" + date,
        schedule_id: null,
        series_id: series.id,
        occurrence_date: date,
        starts_at: instant,
        duration_minutes:
          exception?.duration_minutes ?? series.duration_minutes,
        title: exception?.title ?? series.title,
        kind: series.kind,
        plan_id: series.plan_id,
        tournament_id: series.tournament_id,
        status: session ? "done" : exception?.status || "planned",
        session_id: session?.id || null,
      });
    }
  }
  return rows
    .filter((r) => {
      const date = dateInZone(r.starts_at, timezone);
      return date >= from && date <= to;
    })
    .sort(
      (a, b) =>
        a.starts_at.localeCompare(b.starts_at) || a.key.localeCompare(b.key),
    );
}
export function conflicts(target: Occurrence, rows: Occurrence[]) {
  if (target.status === "cancelled") return [];
  const begin = Date.parse(target.starts_at),
    end = begin + target.duration_minutes * 60000;
  return rows.filter(
    (r) =>
      r.key !== target.key &&
      r.status !== "cancelled" &&
      Date.parse(r.starts_at) < end &&
      Date.parse(r.starts_at) + r.duration_minutes * 60000 > begin,
  );
}
function escape(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
export function fold(line: string) {
  const chunks: string[] = [];
  let chunk = "",
    size = 0;
  for (const char of line) {
    const length = new TextEncoder().encode(char).length;
    if (size + length > 73) {
      chunks.push(chunk);
      chunk = "";
      size = 0;
    }
    chunk += char;
    size += length;
  }
  chunks.push(chunk);
  return chunks.join("\r\n ");
}
export function calendarICS(rows: Occurrence[], now = new Date()) {
  const stamp = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clutchfolio//Agenda pessoal//PT-BR",
    ...rows
      .filter((r) => r.status !== "cancelled")
      .flatMap((r) => [
        "BEGIN:VEVENT",
        `UID:${r.key}@clutchfolio`,
        "DTSTAMP:" + stamp(now.toISOString()),
        "DTSTART:" + stamp(r.starts_at),
        "DTEND:" +
          stamp(
            new Date(
              Date.parse(r.starts_at) + r.duration_minutes * 60000,
            ).toISOString(),
          ),
        "SUMMARY:" + escape(r.title),
        "DESCRIPTION:" +
          escape(
            r.status === "done"
              ? "Atividade concluída, autodeclarada."
              : "Atividade planejada.",
          ),
        "END:VEVENT",
      ]),
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
