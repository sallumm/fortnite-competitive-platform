import { fold } from "./calendar";
import type { Exercise, Profile, Step, Training, Tournament } from "./types";
export const rankNames = [
  "Rookie",
  "Contender",
  "Challenger",
  "Elite",
  "Master",
  "Legend",
];
export function progression(xp: number) {
  const safe = Math.max(0, xp);
  return {
    rank: rankNames[Math.min(5, Math.floor(safe / 500))],
    level: Math.floor(safe / 100) + 1,
    progress: safe % 500,
    next: 500,
  };
}
export function recommendations(exercises: Exercise[], p: Profile) {
  return exercises
    .filter((e) => e.mode === "both" || e.mode === p.mode)
    .sort(
      (a, b) =>
        Number(b.category === p.objective) -
          Number(a.category === p.objective) ||
        Number(b.level === p.level) - Number(a.level === p.level),
    );
}
export function starterSteps(
  exercises: Exercise[],
  p: Profile,
  minutes: number,
): Step[] {
  const list = recommendations(exercises, p).slice(0, 3);
  if (!list.length) return [];
  const base = Math.floor(minutes / list.length);
  return list.map((e, i) => ({
    exercise_id: e.id,
    minutes: base + (i === list.length - 1 ? minutes - base * list.length : 0),
  }));
}
export function stats(sessions: Training[]) {
  const complete = sessions.filter((s) => s.status === "completed");
  return {
    count: complete.length,
    minutes: Math.round(
      complete.reduce((n, s) => n + s.duration_seconds, 0) / 60,
    ),
    xp: complete.reduce((n, s) => n + s.xp, 0),
  };
}
export function comparableResults(
  sessions: Training[],
  exerciseId: string,
  metric?: string,
) {
  return sessions
    .filter(
      (s) =>
        s.status === "completed" &&
        (!metric ||
          s.steps.some(
            (st) =>
              st.exercise_id === exerciseId && st.exercise?.metric === metric,
          )),
    )
    .flatMap((s) =>
      s.results
        .filter((r) => r.exercise_id === exerciseId && r.value !== null)
        .map((r) => ({ date: s.completed_at!, value: r.value! })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function isStale(
  verifiedAt: string,
  validUntil: string | null,
  now = new Date(),
) {
  return validUntil
    ? new Date(validUntil) < now
    : now.getTime() - new Date(verifiedAt).getTime() > 90 * 864e5;
}
export function eventStatus(t: Tournament, now = new Date()) {
  if (t.status === "finished") return "finished";
  if (t.status === "cancelled" || t.status === "postponed") return t.status;
  if (t.ends_at && new Date(t.ends_at) < now) return "finished";
  if (
    !t.starts_at &&
    t.confirmation !== "unconfirmed" &&
    !isStale(t.verified_at, t.valid_until, now) &&
    t.phases?.some(
      (p) =>
        p.status === "scheduled" &&
        !isStale(p.verified_at, p.valid_until, now) &&
        p.starts_at &&
        p.ends_at &&
        Date.parse(p.starts_at) <= +now &&
        Date.parse(p.ends_at) >= +now,
    )
  )
    return "live";
  if (
    t.confirmation !== "unconfirmed" &&
    !isStale(t.verified_at, t.valid_until, now) &&
    t.starts_at &&
    t.ends_at &&
    new Date(t.starts_at) <= now &&
    now <= new Date(t.ends_at)
  )
    return "live";
  if (t.end_date < now.toISOString().slice(0, 10)) return "finished";
  return t.status;
}
export function dateLabel(date: string, timezone?: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(new Date(date.length === 10 ? date + "T12:00:00Z" : date));
}
export function timeLabel(date: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
function escapeICS(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
export function tournamentICS(t: Tournament) {
  const stamp = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const start = t.starts_at
    ? "DTSTART:" + stamp(t.starts_at)
    : "DTSTART;VALUE=DATE:" + t.start_date.replaceAll("-", "");
  const end = t.ends_at
    ? "DTEND:" + stamp(t.ends_at)
    : "DTEND;VALUE=DATE:" +
      new Date(new Date(t.end_date + "T00:00:00Z").getTime() + 864e5)
        .toISOString()
        .slice(0, 10)
        .replaceAll("-", "");
  const desc =
    t.description +
    (t.starts_at
      ? ""
      : "\nData sem horário confirmado: o evento é exportado como dia inteiro.");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clutchfolio//Competitivo//PT-BR",
    "BEGIN:VEVENT",
    `UID:${t.id}@clutchfolio`,
    "DTSTAMP:" + stamp(new Date().toISOString()),
    start,
    end,
    "SUMMARY:" + escapeICS(t.title),
    "DESCRIPTION:" + escapeICS(desc),
    "URL:" + t.source_url,
    ...(t.status === "cancelled"
      ? ["STATUS:CANCELLED"]
      : [
          "STATUS:" +
            (t.confirmation === "unconfirmed" || t.status === "postponed"
              ? "TENTATIVE"
              : "CONFIRMED"),
        ]),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
export function download(content: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
