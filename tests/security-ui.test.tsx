// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const mocks = vi.hoisted(() => ({
  verified: false,
  challenge: vi.fn(async () => ({ error: null })),
  list: vi.fn(async () => ({
    data: {
      totp: [
        { id: "one", friendly_name: "Primeiro" },
        { id: "two", friendly_name: "Segundo" },
      ],
    },
    error: null,
  })),
}));
vi.mock("../src/lib/client", () => ({
  supabase: {
    rpc: async () => ({ data: { privileged: true }, error: null }),
    auth: {
      mfa: {
        listFactors: mocks.list,
        getAuthenticatorAssuranceLevel: async () => ({
          data: {
            currentLevel: mocks.verified ? "aal2" : "aal1",
            nextLevel: "aal2",
          },
          error: null,
        }),
        challengeAndVerify: mocks.challenge,
      },
    },
  },
}));
import Security from "../src/pages/Security";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.verified = false;
});
it("withholds continuation at AAL1 and verifies the selected second factor", async () => {
  render(
    <MemoryRouter>
      <Security />
    </MemoryRouter>,
  );
  await screen.findByText("Adicionar autenticador");
  expect(screen.queryByText("Continuar para a plataforma")).toBeNull();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "two" } });
  fireEvent.change(screen.getByLabelText("Código do autenticador"), {
    target: { value: "123456" },
  });
  mocks.challenge.mockImplementationOnce(async () => {
    mocks.verified = true;
    return { error: null };
  });
  fireEvent.click(screen.getByText("Verificar código"));
  await waitFor(() =>
    expect(mocks.challenge).toHaveBeenCalledWith({
      factorId: "two",
      code: "123456",
    }),
  );
  await screen.findByText("Continuar para a plataforma");
});
it("keeps access closed when the factor is rejected", async () => {
  mocks.challenge.mockRejectedValueOnce(Error("invalid"));
  render(
    <MemoryRouter>
      <Security />
    </MemoryRouter>,
  );
  await screen.findByText("Adicionar autenticador");
  fireEvent.change(screen.getByLabelText("Código do autenticador"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByText("Verificar código"));
  await screen.findByRole("alert");
  expect(screen.queryByText("Continuar para a plataforma")).toBeNull();
});
