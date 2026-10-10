// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { seed, demoPlayer } from "../src/lib/seed";
const mocked = vi.hoisted(() => ({
  profile: null as unknown,
  session: { user: { id: "00000000-0000-4000-8000-000000009999" } },
}));
vi.mock("../src/lib/client", () => ({
  configured: true,
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: mocked.session },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
    from: (table: string) => {
      let single = false;
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        maybeSingle: () => {
          single = true;
          return chain;
        },
        then: (resolve: (value: unknown) => void) =>
          resolve({
            error: null,
            data:
              table === "profiles"
                ? mocked.profile
                : table === "exercises"
                  ? seed.exercises
                  : table === "articles"
                    ? seed.articles
                    : table === "tournaments"
                      ? seed.tournaments
                      : [],
          }),
      };
      return chain;
    },
    rpc: async () => ({ data: false, error: null }),
  },
}));
import App from "../src/App";
vi.stubGlobal("scrollTo", () => {});
afterEach(cleanup);
describe("Integração Auth com adaptador simulado", () => {
  it("aguarda carregar perfil de conta existente antes de decidir onboarding", async () => {
    window.history.replaceState({}, "", "/app");
    mocked.profile = {
      ...demoPlayer().profile!,
      id: mocked.session.user.id,
      onboarded: true,
      display_name: "Conta existente",
    };
    render(<App />);
    expect(
      await screen.findByRole("heading", {
        name: "Vamos ao próximo passo, Conta existente.",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Como você joga?" }),
    ).toBeNull();
  });
  it("encaminha conta sem perfil ao onboarding e bloqueia administração", async () => {
    window.history.replaceState({}, "", "/admin");
    mocked.profile = null;
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Como você joga?" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", {
        name: "Informação que merece confiança.",
      }),
    ).toBeNull();
  });
});
