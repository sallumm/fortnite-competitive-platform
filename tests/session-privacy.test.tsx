// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { demoPlayer, seed } from "../src/lib/seed";
import type { Training as TrainingRow } from "../src/lib/types";
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
const auth = vi.hoisted(() => ({
  callbacks: [] as ((event: string, session: Session | null) => void)[],
  initial: null as Session | null,
  initialPending: null as Promise<{
    data: { session: Session | null };
    error: null;
  }> | null,
  delayedProfile: null as Promise<unknown> | null,
  reads: 0,
  current: null as Session | null,
  trainings: [] as TrainingRow[],
  checkpointPending: null as Promise<{ data: TrainingRow; error: null }> | null,
}));
vi.mock("../src/lib/client", () => ({
  supabase: {
    auth: {
      signOut: async () => {
        auth.current = auth.initial = null;
        for (const callback of [...auth.callbacks])
          callback("SIGNED_OUT", null);
        return { error: null };
      },
      getSession: () =>
        auth.initialPending ||
        Promise.resolve({ data: { session: auth.initial }, error: null }),
      onAuthStateChange: (
        callback: (event: string, session: Session | null) => void,
      ) => {
        auth.callbacks.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe() {
                auth.callbacks = auth.callbacks.filter((c) => c !== callback);
              },
            },
          },
        };
      },
    },
    from: (table: string) => {
      auth.reads++;
      let owner = "";
      const chain = {
        select: () => chain,
        order: () => chain,
        range: () => chain,
        eq: (_key: string, value: string) => {
          owner = value;
          return chain;
        },
        maybeSingle: () => chain,
        then: (resolve: (value: unknown) => void) => {
          if (table === "profiles" && auth.delayedProfile)
            return auth.delayedProfile.then(resolve);
          const data =
            table === "profiles"
              ? {
                  ...demoPlayer().profile,
                  id: owner,
                  display_name: owner,
                  onboarded: true,
                }
              : table === "exercises"
                ? seed.exercises
                : table === "tournaments"
                  ? seed.tournaments
                  : table === "articles"
                    ? auth.current?.access_token.includes(
                        btoa(
                          JSON.stringify({ aal: "aal2", rotation: "first" }),
                        ),
                      )
                      ? [
                          {
                            ...seed.articles[0],
                            id: "private-editorial",
                            published: false,
                          },
                        ]
                      : []
                    : table === "training_sessions"
                      ? auth.trainings
                      : [];
          return Promise.resolve(resolve({ data, error: null }));
        },
      };
      return chain;
    },
    rpc: async (name: string) =>
      name === "save_training_checkpoint" && auth.checkpointPending
        ? auth.checkpointPending
        : {
            data: Boolean(
              auth.current &&
              JSON.parse(atob(auth.current.access_token.split(".")[1])).aal ===
                "aal2",
            ),
            error: null,
          },
  },
}));
import { Provider, useStore } from "../src/lib/store";
import App from "../src/App";
import { TrainingBuilder } from "../src/components/TrainingBuilder";
import { PRIVACY_SIGNAL } from "../src/lib/local-data";
const account = (id: string, aal = "aal2", rotation = "first") =>
  ({
    user: { id },
    access_token: `header.${btoa(JSON.stringify({ aal, rotation }))}.signature`,
  }) as Session;
let activeStore: ReturnType<typeof useStore>;
function Probe({ editor = false }: { editor?: boolean }) {
  const s = useStore();
  activeStore = s;
  return (
    <>
      <output data-testid="state">
        {JSON.stringify({
          user: s.session?.user.id,
          profile: s.data.profile?.id,
          admin: s.admin,
          loading: s.loading,
          sessions: s.data.sessions.map((x) => x.id),
          private: s.editorial.articles.some((a) => !a.published),
        })}
      </output>
      {editor && s.session && !s.loading && (
        <TrainingBuilder
          plan={{
            id: "plan",
            user_id: s.session.user.id,
            title: "private draft",
            steps: [{ exercise_id: seed.exercises[0].id, minutes: 10 }],
          }}
          onClose={() => {}}
        />
      )}
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId("state").textContent!);
async function emit(session: Session | null, event = "TOKEN_REFRESHED") {
  auth.current = session;
  auth.initial = session;
  await act(async () => {
    for (const callback of [...auth.callbacks]) callback(event, session);
  });
}
beforeEach(() => {
  auth.initial = account("account-A");
  auth.initialPending = null;
  auth.delayedProfile = null;
  auth.reads = 0;
  auth.current = auth.initial;
  auth.trainings = [];
  auth.checkpointPending = null;
  vi.stubGlobal("scrollTo", () => {});
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("Integrated session privacy boundaries", () => {
  it("cleans private storage through the actual application's normal logout button", async () => {
    window.history.replaceState({}, "", "/app");
    render(<App />);
    const logout = await screen.findByRole("button", { name: "Sair" });
    localStorage.setItem("clutchfolio-plan-draft:account-A:new", "private");
    sessionStorage.setItem("clutchfolio-private-tab", "private");
    fireEvent.click(logout);
    await waitFor(() =>
      expect(
        localStorage.getItem("clutchfolio-plan-draft:account-A:new"),
      ).toBeNull(),
    );
    expect(sessionStorage.getItem("clutchfolio-private-tab")).toBeNull();
    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });
  it("discards an in-flight training checkpoint after logout instead of recreating private session state", async () => {
    const training: TrainingRow = {
      id: "training-A",
      user_id: "account-A",
      plan_id: null,
      title: "Private training",
      steps: [{ exercise_id: seed.exercises[0].id, minutes: 10 }],
      started_at: new Date().toISOString(),
      completed_at: null,
      duration_seconds: 0,
      results: [],
      status: "active",
      xp: 0,
    };
    auth.trainings = [training];
    let resolve!: (value: { data: TrainingRow; error: null }) => void;
    auth.checkpointPending = new Promise((done) => {
      resolve = done;
    });
    render(
      <Provider>
        <Probe />
      </Provider>,
    );
    await waitFor(() => expect(state().sessions).toEqual([training.id]));
    const pending = activeStore.checkpoint(
      training,
      {
        elapsed: 0,
        since: null,
        done: [false],
        results: [
          { exercise_id: seed.exercises[0].id, value: null, note: "private" },
        ],
      },
      0,
    );
    const outcome = expect(pending).rejects.toThrow("sessão mudou");
    await emit(null, "SIGNED_OUT");
    await act(async () => {
      resolve({ data: { ...training, checkpoint_version: 1 }, error: null });
      await outcome;
    });
    expect(state().sessions).toEqual([]);
    expect(state().profile).toBeUndefined();
  });
  it.each(["SIGNED_OUT", "REMOTE_SIGNED_OUT"])(
    "removes editor copies and prevents pending autosave after %s",
    async (event) => {
      render(
        <Provider>
          <Probe editor />
        </Provider>,
      );
      await screen.findByLabelText("Nome");
      fireEvent.change(screen.getByLabelText("Nome"), {
        target: { value: "private account-A" },
      });
      sessionStorage.setItem("clutchfolio-private-tab", "account-A");
      await emit(null, event);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 650));
      });
      expect(screen.queryByDisplayValue("private account-A")).toBeNull();
      expect(
        Object.keys(localStorage).filter((key) =>
          key.startsWith("clutchfolio-plan-draft:"),
        ),
      ).toEqual([]);
      expect(sessionStorage.getItem("clutchfolio-private-tab")).toBeNull();
      expect(state().profile).toBeUndefined();
      expect(state().admin).toBe(false);
    },
  );
  it("invalidates administrative caches on AAL2 loss while normal rotation preserves the editor", async () => {
    render(
      <Provider>
        <Probe editor />
      </Provider>,
    );
    await screen.findByLabelText("Nome");
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "keep my draft" },
    });
    const reads = auth.reads;
    await emit(account("account-A", "aal2", "rotated"));
    expect(screen.getByLabelText("Nome")).toHaveProperty(
      "value",
      "keep my draft",
    );
    expect(auth.reads).toBe(reads);
    let resolve!: (value: unknown) => void;
    auth.delayedProfile = new Promise((done) => {
      resolve = done;
    });
    await emit(account("account-A", "aal1"));
    expect(state().admin).toBe(false);
    expect(state().profile).toBeUndefined();
    expect(screen.queryByDisplayValue("keep my draft")).toBeNull();
    await act(async () => {
      resolve({
        data: { ...demoPlayer().profile, id: "account-A" },
        error: null,
      });
    });
    await waitFor(() => expect(state().loading).toBe(false));
    expect(state().admin).toBe(false);
    expect(state().private).toBe(false);
    auth.delayedProfile = null;
    await emit(account("account-A", "aal2"));
    await waitFor(() => expect(state().admin).toBe(true));
  });
  it("rejects the delayed initial session after logout", async () => {
    let resolve!: (value: {
      data: { session: Session | null };
      error: null;
    }) => void;
    auth.initialPending = new Promise((done) => {
      resolve = done;
    });
    render(
      <Provider>
        <Probe />
      </Provider>,
    );
    await emit(null, "SIGNED_OUT");
    await act(async () => {
      resolve({ data: { session: account("account-A") }, error: null });
    });
    expect(state().user).toBeUndefined();
    expect(state().profile).toBeUndefined();
  });
  it("discards an account-A read that resolves after switching to account-B", async () => {
    let resolve!: (value: unknown) => void;
    auth.delayedProfile = new Promise((done) => {
      resolve = done;
    });
    render(
      <Provider>
        <Probe />
      </Provider>,
    );
    await waitFor(() => expect(auth.reads).toBeGreaterThan(5));
    auth.delayedProfile = null;
    await emit(account("account-B"), "SIGNED_IN");
    await waitFor(() => expect(state().profile).toBe("account-B"));
    await act(async () => {
      resolve({
        data: { ...demoPlayer().profile, id: "account-A" },
        error: null,
      });
    });
    expect(state().profile).toBe("account-B");
  });
  it("clears the receiving tab's session storage and editor on a shared privacy signal", async () => {
    render(
      <Provider>
        <Probe editor />
      </Provider>,
    );
    await screen.findByLabelText("Nome");
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "second-tab private" },
    });
    sessionStorage.setItem("clutchfolio-private-tab", "second-tab private");
    localStorage.setItem(PRIVACY_SIGNAL, "other-tab-logout");
    auth.initial = null;
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PRIVACY_SIGNAL,
          newValue: "other-tab-logout",
        }),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 650));
    });
    expect(state().user).toBeUndefined();
    expect(screen.queryByDisplayValue("second-tab private")).toBeNull();
    expect(sessionStorage.getItem("clutchfolio-private-tab")).toBeNull();
    expect(
      Object.keys(localStorage).filter((key) =>
        key.startsWith("clutchfolio-plan-draft:"),
      ),
    ).toEqual([]);
  });
  it("reconciles storage after an SDK account change without losing the new authenticated identity", async () => {
    render(
      <Provider>
        <Probe />
      </Provider>,
    );
    await waitFor(() => expect(state().profile).toBe("account-A"));
    await emit(account("account-B"), "SIGNED_IN");
    await waitFor(() => expect(state().profile).toBe("account-B"));
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PRIVACY_SIGNAL,
          newValue: "peer-account-change",
        }),
      );
    });
    await waitFor(() => expect(state().profile).toBe("account-B"));
    expect(state().user).toBe("account-B");
  });
});
