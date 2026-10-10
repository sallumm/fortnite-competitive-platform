import type { Catalog, PlayerData } from "./types";
import { dateInZone, expandCalendar, shiftDate } from "./calendar";
import {
  classify,
  rulesAnswer,
  defaults,
  type Context,
  type Preferences,
  type Answer,
} from "../../supabase/functions/_shared/coach/domain";
import { retrieve } from "../../supabase/functions/_shared/coach/knowledge";
import {
  actionSchema,
  type CoachAction,
} from "../../supabase/functions/_shared/coach/schema";
export { defaults, classify, actionSchema };
export type { Preferences, Answer, CoachAction };
export type Turn = {
  id: string;
  question: string;
  answer: Answer;
  created_at: string;
};
export type Conversation = { id: string; title: string; created_at: string };
export type Pending = {
  id: string;
  payload: CoachAction;
  expires_at: string;
  status: string;
};
/** Demo follows the same opt-in projection as the server; no provider calls. */
export function demoContext(
  data: PlayerData,
  catalog: Catalog,
  message: string,
  pref: Preferences,
  exercise_id?: string,
  now = new Date(),
  tournament_id?: string,
): Context {
  const q = classify(message, exercise_id),
    p = data.profile,
    c: Context = {};
  if (tournament_id) q.intent = "competition";
  if (q.category === "auto")
    q.category = pref.context_enabled ? p?.objective || "aim" : "aim";
  if (pref.context_enabled && p) {
    c.profile = {
      mode: p.mode,
      level: p.level,
      objective: p.objective,
      timezone: p.timezone,
      minutes: p.minutes,
    };
    const owner = p.id,
      today = dateInZone(now, p.timezone),
      from = shiftDate(today, 1 - q.days);
    if (q.intent === "report") {
      const sessions = data.sessions
        .filter(
          (s) =>
            s.user_id === owner &&
            s.status === "completed" &&
            s.completed_at &&
            dateInZone(s.completed_at, p.timezone) >= from &&
            Date.parse(s.completed_at) <= now.getTime(),
        )
        .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!));
      c.total = sessions.length;
      c.sessions = sessions.slice(0, 200).map((s) => ({
        id: s.id,
        completed_at: s.completed_at!,
        duration_seconds: s.duration_seconds,
        steps: s.steps.map((st) => ({
          id: st.id,
          exercise_id: st.exercise_id,
          exercise: st.exercise
            ? {
                category: st.exercise.category,
                metric: st.exercise.metric,
                title: st.exercise.title,
                published: st.exercise.published,
              }
            : undefined,
        })),
        results: s.results.map((r) => ({
          step_id: r.step_id,
          status: r.status,
          unit: r.unit,
          version: r.version,
          conditions: r.conditions,
          exercise_id: r.exercise_id,
          value: r.value,
          configuration: r.configuration,
        })),
      }));
      c.goals = data.goals
        .filter((g) => g.user_id === owner)
        .slice(0, 20)
        .map((g) => ({
          title: g.title,
          completed: g.completed,
          status: g.status,
        }));
      const planning = data.planningPreferences.find(
        (x) => x.user_id === owner,
      );
      c.focus = {
        primary_skill: planning?.primary_skill || null,
        secondary_skills: planning?.secondary_skills || [],
        assessments: [
          ...new Map(
            data.skillReviews
              .filter(
                (r) =>
                  r.user_id === owner &&
                  Date.parse(r.created_at) <= now.getTime(),
              )
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((r) => [
                r.skill,
                {
                  skill: r.skill,
                  goal: r.goal,
                  assessment: r.assessment,
                  created_at: r.created_at,
                },
              ]),
          ).values(),
        ].slice(0, 13),
      };
      const vods = data.vodReviews.filter(
        (r) =>
          r.user_id === owner && r.match_date >= from && r.match_date <= today,
      );
      const counts = new Map<string, number>();
      for (const r of vods)
        for (const category of new Set(
          r.markers.filter((m) => m.kind === "mistake").map((m) => m.category),
        ))
          counts.set(category, (counts.get(category) || 0) + 1);
      c.vod_summary = {
        reviews: vods.length,
        mistakes: [...counts].map(([category, count]) => ({ category, count })),
      };
      c.journals = data.journals
        .filter(
          (j) =>
            j.user_id === owner &&
            c.sessions!.some((s) => s.id === j.session_id),
        )
        .map((j) => ({
          session_id: j.session_id,
          difficulties: j.difficulties,
          next_focus: j.next_focus.slice(0, 300),
          difficult: j.difficult.slice(0, 300),
        }));
    } else if (q.intent === "agenda") {
      const own = {
        ...data,
        schedules: data.schedules.filter((s) => s.user_id === owner),
        series: data.series.filter((s) => s.user_id === owner),
        exceptions: data.exceptions.filter((s) => s.user_id === owner),
        sessions: data.sessions.filter((s) => s.user_id === owner),
      };
      c.agenda = expandCalendar(own, today, shiftDate(today, 14))
        .filter((o) => o.status !== "cancelled")
        .slice(0, 100)
        .map((o) => ({
          id: o.schedule_id || o.key,
          title: o.title,
          starts_at: o.starts_at,
          duration_minutes: o.duration_minutes,
          status: o.status,
          series_id: o.series_id || undefined,
          occurrence_date: o.occurrence_date,
        }));
    } else if (q.intent === "competition")
      c.tournaments = catalog.tournaments
        .filter(
          (t) =>
            t.published &&
            data.bookmarks.some(
              (b) =>
                b.user_id === owner &&
                b.kind === "tournament" &&
                b.target_id === t.id,
            ),
        )
        .slice(0, 10)
        .map((t) => ({
          id: t.id,
          slug: t.slug,
          title: t.title,
          starts_at: t.starts_at,
          start_date: t.start_date,
          status: t.status,
          valid_until: t.valid_until,
          verified_at: t.verified_at,
          source_url: t.source_url,
        }));
  }
  if (tournament_id)
    c.tournaments = catalog.tournaments
      .filter((t) => t.published && t.id === tournament_id)
      .slice(0, 1)
      .map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        starts_at: t.starts_at,
        start_date: t.start_date,
        status: t.status,
        valid_until: t.valid_until,
        verified_at: t.verified_at,
        source_url: t.source_url,
        format: t.format,
        rules: t.rules.slice(0, 4000),
        region: t.region,
        mode: t.mode,
        confirmation: t.confirmation,
        phases: t.phases,
        result_summary: t.result_summary,
        result_source_url: t.result_source_url,
        result_verified_at: t.result_verified_at,
      }));
  if (q.intent === "exercise" || q.intent === "knowledge") {
    c.exercises = catalog.exercises
      .filter(
        (e) =>
          e.published &&
          (exercise_id ? e.id === exercise_id : e.category === q.category),
      )
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        mode: e.mode,
        level: e.level,
        description: e.description,
        instructions: e.instructions,
        metric: e.metric,
        map_code: e.map_code,
        source_url: e.source_url,
        verified_at: e.verified_at,
      }));
    c.articles = catalog.articles
      .filter(
        (a) =>
          a.published &&
          Date.parse(a.published_at) <= now.getTime() &&
          a.category === q.category &&
          (!a.valid_until || Date.parse(a.valid_until) >= now.getTime()),
      )
      .slice(0, 3)
      .map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        source_url: a.source_url,
        verified_at: a.verified_at,
      }));
  }
  return c;
}
export function demoAnswer(
  data: PlayerData,
  catalog: Catalog,
  message: string,
  pref: Preferences,
  exercise_id?: string,
  tournament_id?: string,
) {
  const q = classify(message, exercise_id);
  if (tournament_id) q.intent = "competition";
  const k = retrieve(message);
  const answer = rulesAnswer(
    q,
    demoContext(
      data,
      catalog,
      message,
      pref,
      exercise_id,
      new Date(),
      tournament_id,
    ),
    k.references,
    k.definitions,
  );
  if (
    !pref.context_enabled &&
    !tournament_id &&
    ["report", "agenda", "competition"].includes(q.intent)
  ) {
    answer.sections = [
      {
        title: "Autorize o contexto individual",
        items: [
          "Seus registros privados não foram consultados. Ative a personalização nas preferências.",
        ],
      },
    ];
    answer.scope = [];
  }
  if (tournament_id)
    answer.scope = ["Evento público selecionado", "Fonte e validade editorial"];
  answer.notice =
    tournament_id && !pref.context_enabled
      ? "Consulta ao catálogo público; registros privados não foram consultados."
      : pref.context_enabled
        ? "Demonstração local · assistência por regras. Nenhum dado é enviado a um modelo externo."
        : "Personalização desativada. Autorize o uso dos registros para analisar sua conta de demonstração.";
  return answer;
}
