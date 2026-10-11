// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { seed, demoPlayer } from "../src/lib/seed";
const mocked = vi.hoisted(() => ({
  profile: null as unknown,
  fail: false,
  exercises: null as unknown[] | null,
  filters: [] as string[],
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
      let first = 0,
        last = 499;
      const chain = {
        select: () => chain,
        eq: (key: string, value: string) => {
          mocked.filters.push(`${table}:${key}:${value}`);
          return chain;
        },
        order: () => chain,
        range: (from: number, to: number) => {
          first = from;
          last = to;
          return chain;
        },
        maybeSingle: () => {
          single = true;
          return chain;
        },
        then: (resolve: (value: unknown) => void) =>
          resolve({
            error: mocked.fail ? new Error("database offline") : null,
            data:
              table === "profiles"
                ? mocked.profile
                : table === "exercises"
                  ? (mocked.exercises || seed.exercises).slice(first, last + 1)
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
afterEach(() => {
  mocked.fail = false;
  mocked.exercises = null;
  mocked.filters = [];
  cleanup();
});
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
        name: "Meu Dia",
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

it("offers retry instead of an endless spinner after private data fails to load", async () => {
  mocked.fail = true;
  mocked.profile = {
    ...demoPlayer().profile!,
    id: mocked.session.user.id,
    onboarded: true,
  };
  window.history.replaceState({}, "", "/app");
  render(<App />);
  expect(
    await screen.findByRole("heading", {
      name: "Seu espaço não pôde ser carregado",
    }),
  ).toBeTruthy();
  mocked.fail = false;
  screen.getByRole("button", { name: "Tentar novamente" }).click();
  expect(await screen.findByRole("heading", { name: "Meu Dia" })).toBeTruthy();
});

it("loads public catalog beyond one thousand rows and scopes private reads to the owner", async () => {
  mocked.profile = {
    ...demoPlayer().profile!,
    id: mocked.session.user.id,
    onboarded: true,
  };
  mocked.exercises = Array.from({ length: 1001 }, (_, i) => ({
    ...seed.exercises[0],
    id: `exercise-${i}`,
    title: `Exercício ${i}`,
  }));
  window.history.replaceState({}, "", "/library/exercise-1000");
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Exercício 1000" }),
  ).toBeTruthy();
  expect(mocked.filters).toContain(
    `training_plans:user_id:${mocked.session.user.id}`,
  );
  expect(mocked.filters).toContain(
    `xp_transactions:user_id:${mocked.session.user.id}`,
  );
});
