// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(async () => ({ error: null })),
  signUp: vi.fn(async () => ({ error: null })),
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
}));
vi.mock("../src/lib/client", () => ({ configured: true, supabase: { auth } }));
vi.mock("../src/lib/store", () => ({
  useStore: () => ({
    session: null,
    busy: false,
    run: async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch {}
    },
    enterDemo: () => {},
  }),
}));
vi.mock("../src/components/Turnstile", () => ({
  Turnstile: ({ onToken }: { onToken: (t: string) => void }) => (
    <button type="button" onClick={() => onToken("verified-proof")}>
      CAPTCHA test
    </button>
  ),
}));
import Auth from "../src/pages/Auth";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it.each(["login", "signup", "reset"])(
  "passes the CAPTCHA token to Supabase %s",
  async (mode) => {
    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );
    if (mode === "signup")
      fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    if (mode === "reset")
      fireEvent.click(screen.getByRole("button", { name: "Recuperar" }));
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "fixture@example.test" },
    });
    if (mode !== "reset")
      fireEvent.change(screen.getByLabelText(/Senha/), {
        target: { value: "synthetic-password" },
      });
    if (mode === "signup") fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("CAPTCHA test"));
    fireEvent.submit(document.querySelector("form")!);
    const fn =
      mode === "login"
        ? auth.signInWithPassword
        : mode === "signup"
          ? auth.signUp
          : auth.resetPasswordForEmail;
    await waitFor(() => expect(fn).toHaveBeenCalledOnce());
    const args = fn.mock.calls[0] as unknown as unknown[];
    expect(
      mode === "reset" ? args[1] : (args[0] as { options: unknown }).options,
    ).toMatchObject({ captchaToken: "verified-proof" });
  },
);
it("does not submit a password without a fresh proof", async () => {
  render(
    <MemoryRouter>
      <Auth />
    </MemoryRouter>,
  );
  fireEvent.submit(document.querySelector("form")!);
  await new Promise((r) => setTimeout(r, 0));
  expect(auth.signInWithPassword).not.toHaveBeenCalled();
});
