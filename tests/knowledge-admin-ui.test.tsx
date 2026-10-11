// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { KnowledgeDraft } from "../src/lib/knowledge/service";
import KnowledgeAdmin from "../src/pages/KnowledgeAdmin";
const state = vi.hoisted(() => ({
  admin: true,
  drafts: [] as KnowledgeDraft[],
  saved: vi.fn(),
  managed: vi.fn(),
  refresh: vi.fn(),
  asked: vi.fn(),
}));
vi.mock("../src/lib/store", () => ({
  useStore: () => ({
    admin: state.admin,
    demo: false,
    session: { user: { id: "editor" } },
  }),
}));
vi.mock("../src/lib/knowledge/service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../src/lib/knowledge/service")>();
  return {
    ...original,
    loadAdmin: async () => ({
      drafts: state.drafts,
      revisions: [],
      diagnostics: [],
      settings: original.demoSettings,
    }),
    saveKnowledge: async (
      p: KnowledgeDraft["payload"],
      d: KnowledgeDraft | null,
    ) => {
      state.saved(p);
      const v: KnowledgeDraft = {
        id: d?.id || "test-draft",
        payload: p,
        version: (d?.version || 0) + 1,
        published_revision: d?.published_revision || null,
        archived: false,
        updated_at: new Date().toISOString(),
        updated_by: "editor",
      };
      state.drafts = [v];
      return v;
    },
    manageKnowledge: async (d: KnowledgeDraft, action: string) => {
      state.managed(d, action);
      const v = {
        ...d,
        version: d.version + 1,
        published_revision: action === "publish" ? d.version + 1 : null,
        archived: action === "archive",
      };
      state.drafts = [v];
      return v;
    },
    askKnowledge: async (q: unknown) => {
      state.asked(q);
      return {
        mode: "knowledge-base",
        summary: "Explicação de teste revisada",
        notice: "Somente no teste",
        sections: [],
        references: [],
        related: [],
        missing: false,
        conflict: false,
      };
    },
    configureKnowledge: vi.fn(),
    providerStatus: async () => ({
      provider: null,
      provider_configured: false,
      limits: "limites do teste",
      billing: "não disponível",
    }),
    refreshKnowledge: async () => {
      state.refresh();
      return 2;
    },
  };
});
beforeEach(() => {
  state.admin = true;
  state.drafts = [];
  state.saved.mockClear();
  state.managed.mockClear();
  state.refresh.mockClear();
  state.asked.mockClear();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
afterEach(cleanup);
const mount = () =>
  render(
    <MemoryRouter>
      <KnowledgeAdmin />
    </MemoryRouter>,
  );
it("teaching stages editable content, saves only on action and publishes only in the confirmation modal", async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByRole("heading", { name: "Ensinar à IA" });
  await user.type(
    screen.getByLabelText("Sua explicação"),
    "Piece Control limita as opções de movimento do adversário.",
  );
  await user.click(
    screen.getByRole("button", { name: "Organizar proposta sem publicar" }),
  );
  expect(state.saved).not.toHaveBeenCalled();
  await user.type(
    screen.getByLabelText("Título da fonte"),
    "Fonte editorial de teste",
  );
  await user.type(
    screen.getByLabelText("URL da fonte"),
    "https://example.com/verified",
  );
  await user.click(
    screen.getByRole("button", { name: "Adicionar fonte à proposta" }),
  );
  await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
  await waitFor(() => expect(state.saved).toHaveBeenCalledTimes(1));
  expect(state.drafts[0].published_revision).toBeNull();
  expect(state.managed).not.toHaveBeenCalled();
  await user.click(
    await screen.findByRole("button", { name: "Revisar publicação" }),
  );
  expect(state.managed).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Confirmar publicação" }),
  );
  await waitFor(() => expect(state.managed).toHaveBeenCalledTimes(1));
  expect(state.managed.mock.calls[0][1]).toBe("publish");
});
it("admin test session resets only local answers and refresh does not mutate permanent publications", async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByRole("heading", { name: "Ensinar à IA" });
  await user.click(screen.getByRole("button", { name: "Testar respostas" }));
  await user.type(
    screen.getByLabelText("Pergunta de teste"),
    "O que é Piece Control?",
  );
  await user.click(
    screen.getByRole("button", { name: "Testar resposta", exact: true }),
  );
  await screen.findByText("Explicação de teste revisada");
  expect(state.asked.mock.calls[0][0]).toMatchObject({
    preview: true,
    external: false,
    diagnostics: false,
  });
  await user.click(
    screen.getByRole("button", { name: "Reiniciar sessão de teste" }),
  );
  expect(screen.queryByText("Explicação de teste revisada")).toBeNull();
  expect(state.managed).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Status e utilização" }));
  await user.click(
    screen.getByRole("button", { name: "Recarregar base sem apagar dados" }),
  );
  await waitFor(() => expect(state.refresh).toHaveBeenCalledOnce());
  expect(state.saved).not.toHaveBeenCalled();
});
it("ordinary accounts never see or load teaching controls", () => {
  state.admin = false;
  mount();
  expect(
    screen.getByRole("heading", { name: "Acesso administrativo restrito" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ensinar à IA" })).toBeNull();
});
