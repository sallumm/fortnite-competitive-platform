import type { Exercise, Goal, PlayerData } from "./types";
import { difficulties, skills, type Skill } from "./performance-types";
import { dateInZone, expandCalendar } from "./calendar";
import { resultGroups } from "./performance";
import { compatibleExercises } from "./skill-match";
function validDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const stamp = Date.parse(v + "T00:00:00Z");
  return (
    Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === v
  );
}
export function goalState(g: Goal) {
  return g.status || (g.completed ? "completed" : "active");
}
export interface Diagnostic {
  key: string;
  kind: "fact" | "recommendation";
  title: string;
  detail: string;
  to: string;
}
export function validPeriod(from: string, to: string) {
  return (
    validDate(from) &&
    validDate(to) &&
    from <= to &&
    (Date.parse(to) - Date.parse(from)) / 864e5 <= 365
  );
}
/** Defense in depth: the store is RLS-backed; calculations also exclude foreign rows. */
export function ownedPerformanceData(data: PlayerData): PlayerData {
  const owner = data.profile?.id;
  return {
    ...data,
    sessions: data.sessions.filter((r) => r.user_id === owner),
    goals: data.goals.filter((r) => r.user_id === owner),
    journals: data.journals.filter((r) => r.user_id === owner),
    schedules: data.schedules.filter((r) => r.user_id === owner),
    series: data.series.filter((r) => r.user_id === owner),
    exceptions: data.exceptions.filter((r) => r.user_id === owner),
    skillReviews: data.skillReviews.filter((r) => r.user_id === owner),
    planningPreferences: data.planningPreferences.filter(
      (r) => r.user_id === owner,
    ),
    vodReviews: data.vodReviews.filter((r) => r.user_id === owner),
    goalRevisions: data.goalRevisions.filter((r) => r.user_id === owner),
    readiness: data.readiness.filter((r) => r.user_id === owner),
  };
}
export function analyze(
  data: PlayerData,
  exercises: Exercise[],
  from: string,
  to: string,
  now = new Date(),
) {
  if (!validPeriod(from, to))
    throw new Error("kyrven: escolha um intervalo de até 366 dias.");
  data = ownedPerformanceData(data);
  const tz = data.profile?.timezone || "UTC";
  const sessions = data.sessions.filter(
    (s) =>
      s.status === "completed" &&
      s.completed_at &&
      dateInZone(s.completed_at, tz) >= from &&
      dateInZone(s.completed_at, tz) <= to &&
      Date.parse(s.completed_at) <= now.getTime(),
  );
  const diagnostics: Diagnostic[] = [];
  const add = (
    key: string,
    title: string,
    detail: string,
    to = "/app/reports",
    kind: Diagnostic["kind"] = "fact",
  ) => diagnostics.push({ key, title, detail, to, kind });
  const comparisons = [] as {
    exercise_id: string;
    title: string;
    configuration: string;
    context: string;
    unit: string;
    version: string;
    first: number;
    last: number;
    count: number;
    direction: "higher" | "lower" | null;
    points: { date: string; value: number }[];
  }[];
  let missing = 0;
  for (const id of new Set(
    sessions.flatMap((s) =>
      s.results.filter((r) => r.status !== "skipped").map((r) => r.exercise_id),
    ),
  )) {
    const snapshots = sessions
      .flatMap((s) => s.steps)
      .filter((st) => st.exercise_id === id);
    const e = snapshots.at(-1)?.exercise || exercises.find((e) => e.id === id);
    const records = sessions
      .flatMap((s) => s.results)
      .filter(
        (r) =>
          r.exercise_id === id && r.status !== "skipped" && r.value !== null,
      );
    const groups = resultGroups(sessions, id);
    missing += records.filter(
      (r) =>
        !r.configuration?.trim() || (e?.measurement && (!r.unit || !r.version)),
    ).length;
    if (records.length < 2)
      add(
        "few:" + id,
        (e?.title || "Exercício") + ": poucos registros",
        `${records.length} resultados numéricos no período; ainda não permitem comparar sessões.`,
        "/app/training",
      );
    for (const g of groups) {
      const protocol = snapshots.find(
        (st) =>
          st.exercise?.measurement?.version === g.version &&
          st.exercise?.measurement?.unit === g.unit,
      )?.exercise?.measurement;
      if (e?.measurement && !protocol) continue;
      // Repetições da mesma sessão continuam no histórico; não são sessões independentes.
      const points = [...new Map(g.points.map((p) => [p.date, p])).values()];
      if (points.length < 2) continue;
      comparisons.push({
        exercise_id: id,
        title: e?.title || "Exercício",
        configuration: g.configuration,
        context: g.context,
        unit: g.unit || g.metric,
        version: g.version || "legado",
        first: points[0].value,
        last: points.at(-1)!.value,
        count: points.length,
        direction: protocol?.direction || null,
        points,
      });
      const last = points.slice(-3);
      const diffs = last.slice(1).map((p, i) => p.value - last[i].value);
      if (last.length === 3 && diffs[0] * diffs[1] < 0)
        add(
          "osc:" + g.key,
          (e?.title || "Exercício") + ": oscilação observada",
          `Últimos resultados comparáveis: ${last.map((p) => p.value).join(" → ")} ${g.unit || g.metric}. Causa não identificada nos registros.`,
        );
      else if (
        last.length === 3 &&
        diffs.every((d) => (protocol?.direction === "lower" ? d < 0 : d > 0)) &&
        protocol
      )
        add(
          "trend:" + g.key,
          (e?.title || "Exercício") + ": sequência favorável",
          `Três sessões comparáveis: ${last.map((p) => p.value).join(" → ")} ${protocol.unit}; ${protocol.direction === "lower" ? "menor" : "maior"} é o alvo do protocolo. Isso não comprova transferência para partidas.`,
        );
    }
  }
  if (missing)
    add(
      "missing",
      "Comparação incompleta",
      `${missing} resultados sem configuração ou unidade/versão suficientes. Complete os dados antes de atribuir uma tendência.`,
      "/app/training",
    );
  const pending = expandCalendar(data, from, to).filter(
    (o) =>
      o.kind === "training" &&
      o.status === "planned" &&
      Date.parse(o.starts_at) + o.duration_minutes * 60000 < now.getTime(),
  );
  if (pending.length)
    add(
      "pending",
      "Atividades sem conclusão registrada",
      `${pending.length} treinos passaram do horário planejado. Ausência de registro não prova que não foram realizados.`,
      "/app/planner",
    );
  const tally = new Map<string, number>();
  for (const j of data.journals.filter((j) =>
    sessions.some((s) => s.id === j.session_id),
  ))
    for (const d of new Set(j.difficulties))
      tally.set(d, (tally.get(d) || 0) + 1);
  for (const [key, n] of tally)
    if (n >= 2)
      add(
        "difficulty:" + key,
        `Dificuldade relatada: ${difficulties[key as keyof typeof difficulties]}`,
        `${n} diários distintos registram esta dificuldade. Não identifica a causa.`,
        "/app/skills",
      );
  for (const g of data.goals.filter((g) => goalState(g) === "active")) {
    const id = g.measurement?.exercise_id;
    const recent = data.sessions.some(
      (s) =>
        s.status === "completed" &&
        s.completed_at &&
        Date.parse(s.completed_at) <= now.getTime() &&
        Date.parse(s.completed_at) >= now.getTime() - 14 * 864e5 &&
        s.results.some(
          (r) =>
            r.exercise_id === id &&
            r.value !== null &&
            r.status !== "skipped" &&
            r.unit === g.measurement?.unit &&
            r.version === g.measurement?.version &&
            r.configuration === g.measurement?.configuration,
        ),
    );
    if (id && !recent)
      add(
        "goal:" + g.id,
        `Meta sem medição recente: ${g.title}`,
        "Nenhum resultado numérico compatível com o protocolo e configuração nos últimos 14 dias. Confira o cenário antes de comparar.",
        "/app/evolution#goals",
      );
    if (!g.measurement && !g.criteria?.trim())
      add(
        "vague:" + g.id,
        "Torne o objetivo observável",
        `“${g.title}” não tem protocolo ou critério explícito. Escolha um exercício e um cenário fixo, ou descreva a ação que pretende registrar.`,
        "/app/evolution#goals",
        "recommendation",
      );
  }
  if (!sessions.length)
    add(
      "empty",
      "Sem sessões concluídas no período",
      "Crie um primeiro registro quando fizer sentido. Não há nota de habilidade nem penalidade por descanso.",
      "/app/training",
    );
  return { sessions, diagnostics, comparisons, pending, missing };
}
export function recommend(
  data: PlayerData,
  exercises: Exercise[],
  skill: Skill,
  minutes?: number,
) {
  data = ownedPerformanceData(data);
  if (!data.profile) return [];
  const budget =
    minutes || data.planningPreferences[0]?.minutes || data.profile.minutes;
  return compatibleExercises(exercises, skill, data.profile)
    .map((e) => ({
      exercise: e,
      count: data.sessions.filter(
        (s) =>
          s.status === "completed" &&
          s.results.some(
            (r) => r.exercise_id === e.id && r.status !== "skipped",
          ),
      ).length,
    }))
    .sort(
      (a, b) =>
        Number(b.exercise.level === data.profile!.level) -
          Number(a.exercise.level === data.profile!.level) ||
        a.count - b.count ||
        a.exercise.title.localeCompare(b.exercise.title, "pt-BR"),
    )
    .slice(0, 3)
    .map(({ exercise, count }) => ({
      exercise,
      minutes: Math.max(1, Math.min(20, Math.floor(budget / 3))),
      reason: `Relacionado a ${skills[skill]}; compatível com ${data.profile!.mode === "zero" ? "Construção Zero" : "Construção"}. ${count} sessões relacionadas registradas; menor frequência prioriza opções ainda pouco documentadas, sem afirmar menor habilidade. Tempo proposto cabe na duração escolhida (${budget} min).`,
    }));
}
