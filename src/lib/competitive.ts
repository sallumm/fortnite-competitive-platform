import type {
  Article,
  Tournament,
  TournamentPhase,
  Exercise,
  PlayerData,
  Profile,
} from "./types";
import { isStale, tournamentICS } from "./logic";
import {
  dateInZone,
  expandCalendar,
  shiftDate,
  weekday,
  zonedInstant,
} from "./calendar";
export const topics: Record<string, string> = {
  competitive: "Fortnite competitivo",
  fncs: "FNCS",
  championships: "Campeonatos",
  results: "Resultados",
  updates: "Atualizações",
  meta: "Meta",
  players: "Jogadores",
  organizations: "Organizações",
  analysis: "Análises",
  guides: "Guias",
};
export const regions = ["BR", "NAC", "NAW", "EU", "ASIA", "ME", "OCE"];
export const checklistDefaults = [
  "Conferir requisitos na aba Competir",
  "Ler regulamento e pontuação",
  "Confirmar região, plataforma e horário",
  "Revisar rota e objetivo da sessão",
  "Reservar pausas e descanso",
  "Revisar VOD após o evento",
];
export function currentEvent(t: Tournament, now = new Date()) {
  return (
    t.published &&
    t.confirmation !== "unconfirmed" &&
    !isStale(t.verified_at, t.valid_until, now) &&
    t.status === "scheduled"
  );
}
export function usablePhase(
  t: Tournament,
  p: TournamentPhase,
  now = new Date(),
) {
  return (
    currentEvent(t, now) &&
    p.status === "scheduled" &&
    !isStale(p.verified_at, p.valid_until, now)
  );
}
export function phaseICS(t: Tournament, p: TournamentPhase) {
  return tournamentICS({
    ...t,
    id: t.id + "-" + p.key,
    title: t.title + " · " + p.title,
    start_date: p.date,
    end_date: p.ends_at ? dateInZone(p.ends_at, "UTC") : p.date,
    starts_at: p.starts_at,
    ends_at: p.ends_at,
    status: p.status,
    source_url: p.source_url,
  });
}
export function recentArticles(xs: Article[], now = new Date()) {
  return xs
    .filter((a) => a.published && Date.parse(a.published_at) <= +now)
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}
export function relatedArticles(xs: Article[], a: Article) {
  return recentArticles(xs)
    .filter((x) => x.id !== a.id)
    .sort((x, y) => score(y) - score(x))
    .slice(0, 3);
  function score(x: Article) {
    return (
      Number(x.topic === a.topic && !!a.topic) * 3 +
      Number(x.category === a.category) +
      (x.tags || []).filter((t) => a.tags?.includes(t)).length
    );
  }
}
export function preparationExercises(
  xs: Exercise[],
  t: Tournament,
  profile?: Profile | null,
) {
  return xs
    .filter(
      (e) =>
        e.published &&
        (e.mode === "both" || t.mode === "both" || e.mode === t.mode),
    )
    .sort(
      (a, b) =>
        Number(b.category === profile?.objective) * 4 +
        Number(b.level === profile?.level) * 2 -
        Number(a.category === profile?.objective) * 4 -
        Number(a.level === profile?.level) * 2 +
        Number(b.category === "decisions" || b.category === "vod") -
        Number(a.category === "decisions" || a.category === "vod"),
    )
    .slice(0, 6);
}
export function agendaConflicts(
  data: PlayerData,
  start: string,
  minutes: number,
) {
  const d = dateInZone(start, data.profile?.timezone || "UTC"),
    end = Date.parse(start) + minutes * 60000;
  return expandCalendar(data, d, d).filter(
    (x) =>
      x.status !== "cancelled" &&
      Date.parse(x.starts_at) < end &&
      Date.parse(x.starts_at) + x.duration_minutes * 60000 > Date.parse(start),
  );
}
/** Suggestions derive only from the player's saved availability; every inclusion still needs a preview. */
export function preparationSlots(
  data: PlayerData,
  event: Tournament,
  minutes: number,
  now = new Date(),
) {
  const pref = data.planningPreferences.find(
      (p) => p.user_id === data.profile?.id,
    ),
    timezone = data.profile?.timezone || "UTC";
  if (!pref || minutes > pref.minutes || minutes < 5) return [];
  const today = dateInZone(now, timezone),
    slots: string[] = [];
  for (let n = 0; n < 14 && slots.length < 3; n++) {
    const date = shiftDate(today, n);
    if (date > event.end_date) break;
    if (!pref.weekdays.includes(weekday(date))) continue;
    try {
      const start = zonedInstant(date, pref.local_time, timezone);
      if (
        Date.parse(start) > +now &&
        !agendaConflicts(data, start, minutes).length
      )
        slots.push(start);
    } catch {
      /* A DST gap is not proposed. */
    }
  }
  return slots;
}
