import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./client";
import { demoPlayer, emptyPlayer, seed } from "./seed";
import type {
  Catalog,
  PlayerData,
  Profile,
  Plan,
  Schedule,
  Goal,
  Training,
  Result,
  Bookmark,
  Article,
  Exercise,
  Tournament,
} from "./types";
import type {
  Series,
  Exception,
  Journal,
  SkillReview,
  PlanningPreference,
  WeeklyReport,
  Occurrence,
} from "./performance-types";
import { normalizePlayer } from "./performance-types";
import { validOccurrence } from "./calendar";
const entityNames = {
  plans: "training_plans",
  schedules: "scheduled_sessions",
  goals: "personal_goals",
  bookmarks: "bookmarks",
  series: "activity_series",
  exceptions: "calendar_exceptions",
  journals: "training_journals",
  skillReviews: "skill_reviews",
  planningPreferences: "planning_preferences",
  weeklyReports: "weekly_reports",
} as const;
type Row =
  | Plan
  | Schedule
  | Goal
  | Bookmark
  | Series
  | Exception
  | Journal
  | SkillReview
  | PlanningPreference
  | WeeklyReport;
const KEY = "clutchfolio-demo-v1";
async function check<T>(
  promise: PromiseLike<{ data: T; error: unknown }>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
async function readRows(table: string) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += 500) {
    const page = await check(
      supabase!
        .from(table)
        .select("*")
        .order("id")
        .range(from, from + 499),
    );
    rows.push(...(page || []));
    if (!page || page.length < 500) return rows;
  }
}
function restore(): PlayerData {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    return data?.profile?.id === "demo" && Array.isArray(data.sessions)
      ? normalizePlayer(data)
      : demoPlayer();
  } catch {
    return demoPlayer();
  }
}
type Entity = keyof typeof entityNames;
interface Store {
  catalog: Catalog;
  editorial: Catalog;
  data: PlayerData;
  session: Session | null;
  demo: boolean;
  loading: boolean;
  busy: boolean;
  error: string;
  notice: string;
  admin: boolean;
  run: <T>(
    fn: () => Promise<T>,
    success?: string | false,
  ) => Promise<T | undefined>;
  enterDemo: () => void;
  exitDemo: () => void;
  refresh: () => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  save: (table: Entity, row: Row) => Promise<void>;
  remove: (table: Entity, id: string) => Promise<void>;
  start: (p: Plan, occurrence?: Occurrence) => Promise<Training>;
  reviseSeries: (
    old: Series,
    date: string,
    replacement: Series,
  ) => Promise<void>;
  finish: (
    s: Training,
    results: Result[],
    seconds: number,
    abandon?: boolean,
  ) => Promise<void>;
  saveEditorial: (
    table: "exercises" | "tournaments" | "articles",
    row: Exercise | Tournament | Article,
  ) => Promise<void>;
  deleteEditorial: (
    table: "exercises" | "tournaments" | "articles",
    id: string,
  ) => Promise<void>;
}
const Context = createContext<Store | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(
    supabase ? { exercises: [], tournaments: [], articles: [] } : seed,
  );
  const [data, setData] = useState<PlayerData>(emptyPlayer());
  const [session, setSession] = useState<Session | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [admin, setAdmin] = useState(false);
  const generation = useRef(0);
  const lock = useRef(false);
  const identity = useRef<string | null>(null);
  const [hydratedUser, setHydratedUser] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        if (error) setError("Não foi possível restaurar sua sessão.");
        if (identity.current !== (data.session?.user.id || null)) {
          setLoading(true);
          setData(emptyPlayer());
          setAdmin(false);
          identity.current = data.session?.user.id || null;
        }
        setSession(data.session);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (active) {
        if (identity.current !== (s?.user.id || null)) {
          setLoading(true);
          setData(emptyPlayer());
          setAdmin(false);
          identity.current = s?.user.id || null;
        }
        setSession(s);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  const refresh = useCallback(async () => {
    const ticket = ++generation.current;
    if (demo) {
      setData(restore());
      setCatalog(seed);
      setAdmin(false);
      setLoading(false);
      return;
    }
    if (!supabase) {
      setData(emptyPlayer());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [exercises, tournaments, articles] = await Promise.all([
        check(supabase.from("exercises").select("*").order("title")),
        check(supabase.from("tournaments").select("*").order("start_date")),
        check(
          supabase
            .from("articles")
            .select("*")
            .order("published_at", { ascending: false }),
        ),
      ]);
      if (ticket !== generation.current) return;
      setCatalog({
        exercises: exercises as Exercise[],
        tournaments: tournaments as Tournament[],
        articles: articles as Article[],
      });
      if (session) {
        const [
          profile,
          plans,
          schedules,
          sessions,
          goals,
          xp,
          bookmarks,
          isAdmin,
          series,
          exceptions,
          journals,
          skillReviews,
          planningPreferences,
          weeklyReports,
        ] = await Promise.all([
          check(
            supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .maybeSingle(),
          ),
          readRows("training_plans"),
          readRows("scheduled_sessions"),
          readRows("training_sessions"),
          readRows("personal_goals"),
          readRows("xp_transactions"),
          readRows("bookmarks"),
          check(supabase.rpc("is_admin")),
          ...[
            "activity_series",
            "calendar_exceptions",
            "training_journals",
            "skill_reviews",
            "planning_preferences",
            "weekly_reports",
          ].map((table) => readRows(table)),
        ]);
        if (ticket !== generation.current) return;
        setData({
          profile,
          plans,
          schedules,
          sessions: (sessions as Training[]).sort((a, b) =>
            b.started_at.localeCompare(a.started_at),
          ),
          goals,
          xp,
          bookmarks,
          series,
          exceptions,
          journals,
          skillReviews,
          planningPreferences,
          weeklyReports,
        } as PlayerData);
        setAdmin(Boolean(isAdmin));
        setHydratedUser(session.user.id);
      } else {
        setData(emptyPlayer());
        setAdmin(false);
      }
    } finally {
      if (ticket === generation.current) setLoading(false);
    }
  }, [demo, session?.user.id]);
  useEffect(() => {
    refresh().catch(() =>
      setError(
        "Não foi possível carregar seus dados. Verifique a conexão e tente novamente.",
      ),
    );
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const run = async <T,>(
    fn: () => Promise<T>,
    success: string | false = "Ação concluída.",
  ): Promise<T | undefined> => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await fn();
      if (success) setNotice(success);
      return result;
    } catch (e) {
      const raw =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e && "message" in e
            ? String(e.message)
            : "";
      setError(
        raw.startsWith("Clutchfolio:")
          ? raw
          : "Não foi possível concluir. Confira os campos e tente novamente.",
      );
      return undefined;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const persist = (next: PlayerData) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    setData(next);
  };
  const saveProfile = async (p: Profile) => {
    if (demo) persist({ ...restore(), profile: p });
    else {
      await check(supabase!.from("profiles").upsert(p));
      await refresh();
    }
  };
  const save = async (table: Entity, row: Row) => {
    if (demo) {
      const current = restore();
      if (row.user_id !== current.profile?.id)
        throw new Error("Clutchfolio: proprietário inválido.");
      if (
        (table === "schedules" || table === "series") &&
        "plan_id" in row &&
        row.plan_id &&
        !current.plans.some((p) => p.id === row.plan_id)
      )
        throw new Error("Clutchfolio: rotina indisponível.");
      if (table === "exceptions") {
        const e = row as Exception;
        const series = current.series.find((r) => r.id === e.series_id);
        if (!series || !validOccurrence(series, e.occurrence_date))
          throw new Error("Clutchfolio: ocorrência inválida.");
      }
      if (
        table === "journals" &&
        !current.sessions.some(
          (s) => s.id === (row as Journal).session_id && s.status !== "active",
        )
      )
        throw new Error(
          "Clutchfolio: conclua a sessão antes de escrever o diário.",
        );
      const rows = current[table] as { id: string }[];
      persist({
        ...current,
        [table]: [...rows.filter((x) => x.id !== row.id), row],
      });
    } else {
      const names = entityNames;
      await check(
        supabase!
          .from(names[table])
          .upsert(row as unknown as Record<string, unknown>),
      );
      await refresh();
    }
  };
  const remove = async (table: Entity, id: string) => {
    if (demo) {
      const current = restore();
      let next = {
        ...current,
        [table]: (current[table] as { id: string }[]).filter(
          (x) => x.id !== id,
        ),
      };
      if (table === "plans")
        next = {
          ...next,
          schedules: next.schedules.filter((x) => x.plan_id !== id),
          series: next.series.filter((x) => x.plan_id !== id),
          exceptions: next.exceptions.filter(
            (e) =>
              !next.series.some(
                (r) => r.id === e.series_id && r.plan_id === id,
              ),
          ),
          sessions: next.sessions.map((s) => ({
            ...s,
            plan_id: s.plan_id === id ? null : s.plan_id,
            schedule_id: next.schedules.some(
              (a) => a.id === s.schedule_id && a.plan_id === id,
            )
              ? null
              : s.schedule_id,
            series_id: next.series.some(
              (r) => r.id === s.series_id && r.plan_id === id,
            )
              ? null
              : s.series_id,
          })),
        };
      if (table === "series")
        next = {
          ...next,
          exceptions: next.exceptions.filter((e) => e.series_id !== id),
          sessions: next.sessions.map((s) =>
            s.series_id === id ? { ...s, series_id: null } : s,
          ),
        };
      if (table === "schedules")
        next = {
          ...next,
          sessions: next.sessions.map((s) =>
            s.schedule_id === id ? { ...s, schedule_id: null } : s,
          ),
        };
      persist(next);
    } else {
      const names = entityNames;
      await check(supabase!.from(names[table]).delete().eq("id", id));
      await refresh();
    }
  };
  const start = async (p: Plan, occurrence?: Occurrence) => {
    if (demo) {
      const current = restore();
      if (current.sessions.some((s) => s.status === "active"))
        throw new Error(
          "Clutchfolio: encerre a sessão ativa antes de iniciar outra.",
        );
      if (
        occurrence &&
        (occurrence.plan_id !== p.id ||
          occurrence.status !== "planned" ||
          current.sessions.some(
            (x) =>
              x.status !== "abandoned" &&
              (occurrence.schedule_id
                ? x.schedule_id === occurrence.schedule_id
                : x.series_id === occurrence.series_id &&
                  x.occurrence_date === occurrence.occurrence_date),
          ))
      )
        throw new Error("Clutchfolio: atividade já iniciada ou indisponível.");
      const s: Training = {
        schedule_id: occurrence?.schedule_id || null,
        series_id: occurrence?.series_id || null,
        occurrence_date: occurrence?.series_id
          ? occurrence.occurrence_date
          : null,
        id: crypto.randomUUID(),
        user_id: "demo",
        plan_id: p.id,
        title: p.title,
        steps: p.steps.map((step) => ({
          ...step,
          exercise: catalog.exercises.find((e) => e.id === step.exercise_id),
        })),
        started_at: new Date().toISOString(),
        completed_at: null,
        duration_seconds: 0,
        results: [],
        status: "active",
        xp: 0,
      };
      persist({ ...current, sessions: [s, ...current.sessions] });
      return s;
    }
    const s = await check(
      occurrence
        ? supabase!.rpc("start_scheduled_training", {
            p_plan: p.id,
            p_schedule: occurrence.schedule_id,
            p_series: occurrence.series_id,
            p_date: occurrence.series_id ? occurrence.occurrence_date : null,
          })
        : supabase!.rpc("start_training", { p_plan: p.id }),
    );
    await refresh();
    return s as Training;
  };
  const reviseSeries = async (
    old: Series,
    date: string,
    replacement: Series,
  ) => {
    if (date <= old.start_date) {
      if (
        data.exceptions.some((e) => e.series_id === old.id) ||
        data.sessions.some(
          (s) => s.series_id === old.id && s.status !== "abandoned",
        )
      )
        throw new Error(
          "Clutchfolio: há exceções ou treinos iniciados. Edite uma ocorrência ou revise a série a partir de uma data posterior.",
        );
      await save("series", { ...replacement, id: old.id });
      return;
    }
    if (demo) {
      const current = restore();
      if (
        current.exceptions.some(
          (e) => e.series_id === old.id && e.occurrence_date >= date,
        ) ||
        current.sessions.some(
          (s) =>
            s.series_id === old.id &&
            s.occurrence_date! >= date &&
            s.status !== "abandoned",
        )
      )
        throw new Error(
          "Clutchfolio: há exceções ou treinos iniciados no intervalo. Edite uma ocorrência pendente.",
        );
      const end = new Date(Date.parse(date + "T12:00:00Z") - 86400000)
        .toISOString()
        .slice(0, 10);
      persist({
        ...current,
        series: [
          ...current.series.map((r) =>
            r.id === old.id ? { ...r, end_date: end } : r,
          ),
          { ...replacement, start_date: date },
        ],
      });
    } else {
      await check(
        supabase!.rpc("revise_series", {
          p_id: old.id,
          p_from: date,
          p_replacement: replacement,
        }),
      );
      await refresh();
    }
  };
  const finish = async (
    s: Training,
    results: Result[],
    seconds: number,
    abandon = false,
  ) => {
    if (demo) {
      const current = restore();
      if (current.sessions.find((x) => x.id === s.id)?.status !== "active")
        return;
      const now = new Date().toISOString();
      const completed = current.sessions.filter(
        (x) => x.completed_at?.slice(0, 10) === now.slice(0, 10) && x.xp > 0,
      ).length;
      const xp = abandon || completed >= 2 ? 0 : 100;
      const next = {
        ...s,
        completed_at: now,
        results,
        duration_seconds: seconds,
        status: abandon ? ("abandoned" as const) : ("completed" as const),
        xp,
      };
      persist({
        ...current,
        sessions: current.sessions.map((x) => (x.id === s.id ? next : x)),
        xp: xp
          ? [
              ...current.xp,
              {
                id: crypto.randomUUID(),
                user_id: "demo",
                session_id: s.id,
                amount: xp,
                created_at: now,
              },
            ]
          : current.xp,
      });
    } else {
      await check(
        supabase!.rpc("finish_training", {
          p_session: s.id,
          p_results: results,
          p_seconds: seconds,
          p_abandon: abandon,
        }),
      );
      await refresh();
    }
  };
  const saveEditorial = async (
    table: "exercises" | "tournaments" | "articles",
    row: Exercise | Tournament | Article,
  ) => {
    if (!supabase || demo || !admin)
      throw new Error(
        "Clutchfolio: a administração exige uma conta autorizada.",
      );
    await check(
      supabase.from(table).upsert(row as unknown as Record<string, unknown>),
    );
    await refresh();
  };
  const deleteEditorial = async (
    table: "exercises" | "tournaments" | "articles",
    id: string,
  ) => {
    await check(supabase!.from(table).delete().eq("id", id));
    await refresh();
  };
  const publicCatalog: Catalog = {
    exercises: catalog.exercises.filter((x) => x.published),
    tournaments: catalog.tournaments.filter((x) => x.published),
    articles: catalog.articles.filter(
      (x) => x.published && new Date(x.published_at) <= new Date(),
    ),
  };
  return (
    <Context.Provider
      value={{
        catalog: publicCatalog,
        editorial: catalog,
        data,
        session,
        demo,
        loading:
          loading ||
          (!demo && Boolean(session) && hydratedUser !== session?.user.id),
        busy,
        error,
        notice,
        admin,
        run,
        enterDemo: () => {
          setDemo(true);
          setData(restore());
        },
        exitDemo: () => {
          setDemo(false);
          setData(emptyPlayer());
        },
        refresh,
        saveProfile,
        save,
        remove,
        start,
        reviseSeries,
        finish,
        saveEditorial,
        deleteEditorial,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("Provider ausente");
  return value;
}
