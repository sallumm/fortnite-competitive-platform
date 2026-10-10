// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import raw from "../src/data/meta-knowledge.json";
import { seed } from "../src/lib/seed";
import MetaAdmin from "../src/pages/MetaAdmin";
import { MetaVideoPlayer } from "../src/components/MetaContent";
import type { MetaDraft } from "../src/lib/meta-editorial";
const state = vi.hoisted(() => ({
  admin: true,
  drafts: [] as MetaDraft[],
  saved: vi.fn(),
  publish: vi.fn(),
}));
vi.mock("../src/lib/store", () => ({
  useStore: () => ({
    admin: state.admin,
    demo: false,
    session: { user: { id: "editor" } },
    catalog: seed,
  }),
}));
vi.mock("../src/lib/meta-service", () => ({ loadMeta: async () => raw }));
vi.mock("../src/lib/meta-editorial-service", () => ({
  loadSeasons: async () => [],
  loadDrafts: async () => state.drafts,
  loadEditorial: async () => ({ editions: [], assets: [] }),
  registerMeta: vi.fn(),
  imageUrl: vi.fn(),
  uploadImage: vi.fn(),
  removeImage: vi.fn(),
  draftHistory: async () => [],
  restoreDraft: vi.fn(),
  saveDraft: async (
    payload: MetaDraft["payload"],
    status: MetaDraft["status"],
    draft: MetaDraft | null,
  ) => {
    state.saved(payload, status);
    const d = {
      id: draft?.id || "test-draft",
      payload,
      version: (draft?.version || 0) + 1,
      status,
      updated_at: new Date().toISOString(),
      editor_id: "editor",
      published_entry_id: draft?.published_entry_id || null,
    };
    state.drafts = [d];
    return d;
  },
  publishDraft: async (d: MetaDraft, withdraw: boolean) => {
    state.publish(d, withdraw);
    state.drafts = [
      {
        ...d,
        version: d.version + 1,
        status: withdraw ? "archived" : "published",
        published_entry_id: "meta-published",
      },
    ];
    return "meta-published";
  },
}));
beforeEach(() => {
  state.admin = true;
  state.drafts = [];
  state.saved.mockClear();
  state.publish.mockClear();
});
afterEach(cleanup);
it("offers real structured fields and explicit preview/review/publication instead of JSON; restores persisted drafts on remount", async () => {
  const u = userEvent.setup();
  const first = render(
    <MemoryRouter initialEntries={["/admin/meta?entry=meta-001"]}>
      <MetaAdmin />
    </MemoryRouter>,
  );
  await screen.findByDisplayValue("Temporada e versão verificadas");
  await u.clear(screen.getByLabelText("Título", { exact: true }));
  await u.type(
    screen.getByLabelText("Título", { exact: true }),
    "Item revisado no formulário",
  );
  await u.click(
    screen.getByRole("button", { name: "Adicionar bloco", exact: true }),
  );
  await u.type(
    screen.getByLabelText("Título do bloco"),
    "Explicação documentada",
  );
  await u.type(
    screen.getByLabelText("Texto do bloco"),
    "<script>window.__executed=true</script>",
  );
  await u.click(screen.getByRole("button", { name: "Pré-visualizar" }));
  expect(
    screen.getByText("<script>window.__executed=true</script>"),
  ).toBeTruthy();
  expect(document.querySelector("script")).toBeNull();
  await u.click(screen.getByRole("button", { name: "Voltar à edição" }));
  expect(
    screen
      .getByRole("button", { name: "Publicar conteúdo" })
      .hasAttribute("disabled"),
  ).toBe(true);
  await u.click(screen.getByRole("button", { name: "Enviar para revisão" }));
  await waitFor(() =>
    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Item revisado no formulário" }),
      "review",
    ),
  );
  await u.click(screen.getByRole("button", { name: "Publicar conteúdo" }));
  expect(state.publish).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button", { name: "Confirmar publicação" }));
  await screen.findByRole("link", { name: "Ver página pública" });
  expect(state.publish).toHaveBeenCalledOnce();
  first.unmount();
  render(
    <MemoryRouter>
      <MetaAdmin />
    </MemoryRouter>,
  );
  await u.click(
    await screen.findByRole("button", { name: /Item revisado no formulário/ }),
  );
  expect(screen.getByDisplayValue("Item revisado no formulário")).toBeTruthy();
  await u.click(
    screen.getByRole("button", { name: "Retirar publicação e arquivar" }),
  );
  expect(state.publish).toHaveBeenCalledTimes(1);
  await u.click(screen.getByRole("button", { name: "Confirmar retirada" }));
  await waitFor(() => expect(state.publish).toHaveBeenCalledTimes(2));
  expect(state.drafts[0].status).toBe("archived");
});
it("does not expose editor forms to an ordinary account", () => {
  state.admin = false;
  render(
    <MemoryRouter>
      <MetaAdmin />
    </MemoryRouter>,
  );
  expect(
    screen.getByText("Gerenciar Meta exige uma conta administrativa"),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Novo conteúdo" })).toBeNull();
});
it("makes no YouTube connection before consent and closes the embed on withdrawal", async () => {
  const u = userEvent.setup();
  render(
    <MetaVideoPlayer
      video={{
        title: "Vídeo educativo",
        creator: "Criador identificado",
        url: "https://youtu.be/7qQFLL_DJ7Q",
        description: "Registro de teste.",
        source_url: "https://example.com",
        authorization: "Permissão registrada de teste",
        embed_allowed: true,
        tags: [],
        timestamps: [{ seconds: 45, label: "Decisão de rotação" }],
      }}
    />,
  );
  expect(document.querySelector("iframe")).toBeNull();
  await u.click(
    screen.getByRole("button", { name: "Permitir YouTube e carregar vídeo" }),
  );
  expect(document.querySelector("iframe")?.src).toContain(
    "https://www.youtube-nocookie.com/embed/7qQFLL_DJ7Q",
  );
  await u.click(screen.getByRole("button", { name: /0:45/ }));
  expect(document.querySelector("iframe")?.src).toContain("start=45");
  await u.click(
    screen.getByRole("button", {
      name: "Fechar vídeo e retirar consentimento",
    }),
  );
  expect(document.querySelector("iframe")).toBeNull();
});
