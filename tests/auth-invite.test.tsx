// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { passwordCallback } from "../src/lib/auth-flow";
const mock = vi.hoisted(() => ({
  session: { user: { id: "synthetic-a" } } as object | null,
  captured: false,
  error: null as Error | null,
  errors: [] as unknown[],
  updateUser: vi.fn(),
}));
vi.mock("../src/lib/client", () => ({
  configured: true,
  get authPasswordFlow() {
    return mock.captured;
  },
  clearAuthPasswordFlow() {
    mock.captured = false;
  },
  supabase: { auth: { updateUser: mock.updateUser } },
}));
vi.mock("../src/lib/store", () => ({
  useStore: () => ({
    session: mock.session,
    busy: false,
    enterDemo() {},
    run: async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (e) {
        mock.errors.push(e);
      }
    },
  }),
}));
vi.mock("../src/components/Turnstile", () => ({
  Turnstile: () => <span>CAPTCHA</span>,
}));
import Auth from "../src/pages/Auth";
function SecurityFixture() {
  const route = useLocation();
  return <p>Security destination: {route.state?.from}</p>;
}
function mount() {
  mock.updateUser.mockImplementation(async () => ({ error: mock.error }));
  render(
    <MemoryRouter
      initialEntries={[{ pathname: "/auth", state: { from: "/app/reports" } }]}
    >
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/security" element={<SecurityFixture />} />
      </Routes>
    </MemoryRouter>,
  );
}
afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/auth");
  mock.session = { user: { id: "synthetic-a" } };
  mock.captured = false;
  mock.error = null;
  mock.errors = [];
  vi.clearAllMocks();
});
it.each(["#type=invite", "#type=recovery", "?invite=1", "?recovery=1"])(
  "keeps authenticated %s at password setup until successful update",
  async (marker) => {
    window.history.replaceState({}, "", "/auth" + marker);
    mount();
    expect(screen.getByRole("heading", { name: "Nova senha" })).toBeTruthy();
    expect(screen.queryByText(/Security destination/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Senha/), {
      target: { value: "synthetic-password" },
    });
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() =>
      expect(mock.updateUser).toHaveBeenCalledWith({
        password: "synthetic-password",
      }),
    );
    expect(
      await screen.findByText("Security destination: /app/reports"),
    ).toBeTruthy();
    expect(mock.captured).toBe(false);
  },
);
it("retains invite mode after SDK clears the fragment", () => {
  mock.captured = true;
  mount();
  expect(screen.getByRole("heading", { name: "Nova senha" })).toBeTruthy();
});
it("callback markers cannot update a password without a session", async () => {
  window.history.replaceState({}, "", "/auth?invite=1");
  mock.session = null;
  mount();
  expect(
    (
      screen.getByRole("button", {
        name: "Atualizar senha",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.submit(document.querySelector("form")!);
  await waitFor(() => expect(mock.errors).toHaveLength(1));
  expect(mock.updateUser).not.toHaveBeenCalled();
});
it("failed token/session update stays in setup without navigation", async () => {
  window.history.replaceState({}, "", "/auth?invite=1");
  mock.error = new Error("invalid session fixture");
  mount();
  fireEvent.submit(document.querySelector("form")!);
  await waitFor(() => expect(mock.errors).toHaveLength(1));
  expect(screen.getByRole("heading", { name: "Nova senha" })).toBeTruthy();
  expect(screen.queryByText(/Security destination/)).toBeNull();
});
it("uses exact markers and rejects error callbacks", () => {
  for (const [query, hash] of [
    ["?notrecovery=1", ""],
    ["?invite=10", ""],
    ["", "#type=signup"],
    ["?invite=1", "#error=access_denied"],
    ["?recovery=1&error_code=expired", ""],
  ])
    expect(passwordCallback(query, hash)).toBe(false);
});
