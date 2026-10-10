import type {
  Category,
  Exercise,
  PlayerData,
  Profile,
  Step,
  Training,
} from "./types";
import type {
  Difficulty,
  PlanningPreference,
  ReportSummary,
  Skill,
} from "./performance-types";
import { dateInZone, expandCalendar, shiftDate } from "./calendar";
export const skillCategory: Record<Skill, Category> = {
  aim: "aim",
  tracking: "aim",
  shotgun: "aim",
  building: "mechanics",
  editing: "mechanics",
  piece: "piece",
  movement: "competitive",
  decisions: "decisions",
  rotations: "decisions",
  endgame: "competitive",
  vod: "vod",
};
export function skillExercises(
  exercises: Exercise[],
  skill: Skill,
  profile: Profile,
) {
  return exercises.filter(
    (e) =>
      (e.mode === "both" || e.mode === profile.mode) &&
      e.category === skillCategory[skill],
  );
}
export function resultGroups(sessions: Training[], exerciseId: string) {
  const groups = new Map<
    string,
    {
      key: string;
      configuration: string;
      metric: string;
      points: { date: string; value: number }[];
    }
  >();
  for (const session of sessions.filter((s) => s.status === "completed")) {
    const metric = session.steps.find((st) => st.exercise_id === exerciseId)
      ?.exercise?.metric;
    for (const result of session.results.filter(
      (r) =>
        r.exercise_id === exerciseId &&
        r.value !== null &&
        !!r.configuration?.trim(),
    )) {
      if (!metric) continue;
      const configuration = result.configuration!.trim();
      const key = JSON.stringify([exerciseId, metric, configuration]);
      const group = groups.get(key) || {
        key,
        configuration,
        metric,
        points: [],
      };
      group.points.push({ date: session.completed_at!, value: result.value! });
      groups.set(key, group);
    }
  }
  return [...groups.values()].map((g) => ({
    ...g,
    points: g.points.sort((a, b) => a.date.localeCompare(b.date)),
  }));
}
export function summarize(
  data: PlayerData,
  from: string,
  to: string,
  now = new Date(),
): ReportSummary {
  const tz = data.profile?.timezone || "America/Sao_Paulo";
  const inRange = (iso: string) =>
    dateInZone(iso, tz) >= from &&
    dateInZone(iso, tz) <= to &&
    Date.parse(iso) <= now.getTime();
  const complete = data.sessions.filter(
    (s) =>
      s.status === "completed" && s.completed_at && inRange(s.completed_at),
  );
  const days =
    Math.round(
      (Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) /
        86400000,
    ) + 1;
  const previousFrom = shiftDate(from, -days),
    previousTo = shiftDate(from, -1);
  const previous = data.sessions.filter(
    (s) =>
      s.status === "completed" &&
      s.completed_at &&
      dateInZone(s.completed_at, tz) >= previousFrom &&
      dateInZone(s.completed_at, tz) <= previousTo,
  );
  const planned = expandCalendar(data, from, to).filter(
    (o) =>
      o.kind === "training" &&
      o.status !== "cancelled" &&
      Date.parse(o.starts_at) <= now.getTime(),
  );
  const matched = new Set<string>();
  let adhered = 0,
    estimated = 0;
  for (const o of planned) {
    if (o.status === "done") {
      adhered++;
      if (o.session_id) matched.add(o.session_id);
      continue;
    }
    // Legacy-only fallback: never infer association for newly linked sessions or recurrent events.
    if (o.schedule_id) {
      const match = data.sessions.find(
        (s) =>
          s.status === "completed" &&
          !s.schedule_id &&
          !s.series_id &&
          !matched.has(s.id) &&
          s.plan_id === o.plan_id &&
          dateInZone(s.started_at, tz) === dateInZone(o.starts_at, tz),
      );
      if (match) {
        matched.add(match.id);
        estimated++;
      }
    }
  }
  const tally = new Map<Difficulty, number>();
  for (const j of data.journals.filter((j) =>
    complete.some((s) => s.id === j.session_id),
  ))
    for (const key of new Set(j.difficulties))
      tally.set(key, (tally.get(key) || 0) + 1);
  const observations: string[] = [],
    suggestions: string[] = [];
  if (complete.length)
    observations.push(
      `${complete.length} sessões concluídas, em ${new Set(complete.map((s) => dateInZone(s.completed_at!, tz))).size} dias de prática.`,
    );
  else
    observations.push(
      "Nenhuma sessão concluída neste período. Descansar não reduz seu progresso.",
    );
  if (planned.length)
    observations.push(
      `${adhered} de ${planned.length} atividades de treino com conclusão explícita${estimated ? `; ${estimated} correspondências antigas estimadas por plano e dia` : ""}.`,
    );
  for (const id of new Set(
    complete.flatMap((s) => s.results.map((r) => r.exercise_id)),
  )) {
    for (const g of resultGroups(complete, id).filter(
      (g) => g.points.length >= 2,
    )) {
      const a = g.points.at(-2)!,
        b = g.points.at(-1)!;
      observations.push(
        `${g.metric} (${g.configuration}): ${a.value} → ${b.value}. Variação observada nas duas últimas medições autodeclaradas; a direção desejada depende da métrica.`,
      );
    }
  }
  if (tally.size)
    suggestions.push(
      "Sugestão: revise uma dificuldade registrada e escolha um exercício relacionado; a recorrência no diário não comprova a causa.",
    );
  if (planned.some((o) => o.status === "planned"))
    suggestions.push(
      "Sugestão: confira atividades pendentes e reagende apenas as que ainda fazem sentido.",
    );
  if (!data.goals.some((g) => !g.completed))
    suggestions.push(
      "Sugestão: defina um objetivo observável para a próxima sessão.",
    );
  return {
    from,
    to,
    completed: complete.length,
    minutes: Math.round(
      complete.reduce((n, s) => n + s.duration_seconds, 0) / 60,
    ),
    planned: planned.length,
    adhered,
    estimated,
    practiceDays: new Set(complete.map((s) => dateInZone(s.completed_at!, tz)))
      .size,
    previousCompleted: previous.length,
    difficulties: [...tally].map(([key, count]) => ({ key, count })),
    observations,
    suggestions,
    goals: data.goals.map((g) => ({ title: g.title, completed: g.completed })),
  };
}
export function personalPlan(
  exercises: Exercise[],
  profile: Profile,
  pref: PlanningPreference,
  sessions: Training[] = [],
): { steps: Step[]; reasons: string[] } {
  const counts = new Map<string, number>();
  const recentPractice = new Map<Category, number>();
  for (const session of sessions.filter(
    (s) =>
      s.status === "completed" &&
      s.completed_at &&
      Date.parse(s.completed_at) >= Date.now() - 30 * 86400000,
  ))
    for (const category of new Set(
      session.steps
        .map((st) => st.exercise?.category)
        .filter((c): c is Category => !!c),
    ))
      recentPractice.set(category, (recentPractice.get(category) || 0) + 1);
  const eligible = exercises
    .filter(
      (e) =>
        (e.mode === "both" || e.mode === profile.mode) &&
        e.category !== "wellbeing",
    )
    .sort(
      (a, b) =>
        Number(pref.focuses.includes(b.category)) -
          Number(pref.focuses.includes(a.category)) ||
        Number(b.level === profile.level) - Number(a.level === profile.level) ||
        (recentPractice.get(a.category) || 0) -
          (recentPractice.get(b.category) || 0),
    );
  const selected = eligible
    .filter((e) => {
      const n = counts.get(e.category) || 0;
      if (n >= 2) return false;
      counts.set(e.category, n + 1);
      return true;
    })
    .slice(0, Math.min(4, Math.floor(pref.minutes / 5)));
  const base = Math.floor(pref.minutes / Math.max(1, selected.length));
  return {
    steps: selected.map((e, i) => ({
      exercise_id: e.id,
      minutes:
        base +
        (i === selected.length - 1 ? pref.minutes - base * selected.length : 0),
    })),
    reasons: selected.map(
      (e) =>
        `${e.title}: ${e.description} Dispositivo informado: ${profile.input === "kbm" ? "teclado e mouse" : "controle"}; ajuste sensibilidade e cenário. Prioridade: ${pref.focuses.includes(e.category) ? "foco escolhido" : "variedade complementar"}. ${recentPractice.get(e.category) || 0} sessões dessa categoria nos últimos 30 dias; frequência não mede habilidade.`,
    ),
  };
}
export function periodBounds(days: number, timezone: string, now = new Date()) {
  const to = dateInZone(now, timezone);
  return { from: shiftDate(to, 1 - days), to };
}
