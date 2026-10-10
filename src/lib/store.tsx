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
const KEY = "clutchfolio-demo-v1";
async function check<T>(
  promise: PromiseLike<{ data: T; error: unknown }>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
function restore(): PlayerData {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    return data?.profile?.id === "demo" && Array.isArray(data.sessions)
      ? data
      : demoPlayer();
  } catch {
    return demoPlayer();
  }
}
type Entity = "plans" | "schedules" | "goals" | "bookmarks";
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
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  enterDemo: () => void;
  exitDemo: () => void;
  refresh: () => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  save: (
    table: Entity,
    row: Plan | Schedule | Goal | Bookmark,
  ) => Promise<void>;
  remove: (table: Entity, id: string) => Promise<void>;
  start: (p: Plan) => Promise<Training>;
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
  const [catalog, setCatalog] = useState<Catalog>(seed);
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
        ] = await Promise.all([
          check(
            supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .maybeSingle(),
          ),
          check(supabase.from("training_plans").select("*")),
          check(supabase.from("scheduled_sessions").select("*")),
          check(
            supabase
              .from("training_sessions")
              .select("*")
              .order("started_at", { ascending: false }),
          ),
          check(supabase.from("personal_goals").select("*")),
          check(supabase.from("xp_transactions").select("*")),
          check(supabase.from("bookmarks").select("*")),
          check(supabase.rpc("is_admin")),
        ]);
        if (ticket !== generation.current) return;
        setData({
          profile,
          plans,
          schedules,
          sessions,
          goals,
          xp,
          bookmarks,
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
        "Falha ao carregar os dados. Verifique sua conexão e a configuração do banco.",
      ),
    );
  }, [refresh]);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await fn();
      setNotice("Alteração concluída.");
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
  const save = async (
    table: Entity,
    row: Plan | Schedule | Goal | Bookmark,
  ) => {
    if (demo) {
      const current = restore();
      const rows = current[table] as { id: string }[];
      persist({
        ...current,
        [table]: [...rows.filter((x) => x.id !== row.id), row],
      });
    } else {
      const names = {
        plans: "training_plans",
        schedules: "scheduled_sessions",
        goals: "personal_goals",
        bookmarks: "bookmarks",
      };
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
        };
      persist(next);
    } else {
      const names = {
        plans: "training_plans",
        schedules: "scheduled_sessions",
        goals: "personal_goals",
        bookmarks: "bookmarks",
      };
      await check(supabase!.from(names[table]).delete().eq("id", id));
      await refresh();
    }
  };
  const start = async (p: Plan) => {
    if (demo) {
      const current = restore();
      if (current.sessions.some((s) => s.status === "active"))
        throw new Error(
          "Clutchfolio: encerre a sessão ativa antes de iniciar outra.",
        );
      const s: Training = {
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
    const s = await check(supabase!.rpc("start_training", { p_plan: p.id }));
    await refresh();
    return s as Training;
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
