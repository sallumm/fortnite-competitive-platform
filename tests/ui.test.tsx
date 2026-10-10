// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { demoPlayer, seed, uid } from "../src/lib/seed";
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.stubGlobal("scrollTo", () => {});
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});
afterEach(cleanup);
describe("Fluxos funcionais do MVP em DOM simulado", () => {
  it("landing, tema e bloqueio de cadastro sem backend", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: /Seu próximo nível/ });
    await user.click(screen.getByRole("button", { name: "Ativar tema claro" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(
      screen.getAllByRole("link", { name: /Começar grátis/ })[0],
    );
    await screen.findByRole("heading", { name: "Bom ter você por aqui" });
    expect(screen.getByText(/Contas ainda não foram ativadas/)).toBeTruthy();
    expect(
      screen
        .getAllByRole("button", { name: "Entrar" })
        .find((b) => b.hasAttribute("disabled"))
        ?.hasAttribute("disabled"),
    ).toBe(true);
  });
  it("demonstração completa onboarding, cria rotina, executa sessão e registra histórico", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: /Seu próximo nível/ });
    await user.click(
      screen.getByRole("button", { name: "Explorar demonstração" }),
    );
    await screen.findByRole("heading", { name: "Como você joga?" });
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByLabelText("Como podemos chamar você?");
    await user.clear(screen.getByLabelText("Como podemos chamar você?"));
    await user.type(
      screen.getByLabelText("Como podemos chamar você?"),
      "Rafael",
    );
    await user.click(screen.getByRole("button", { name: "Criar meu plano" }));
    await screen.findByRole("heading", {
      name: "Vamos ao próximo passo, Rafael.",
    });
    const stored = JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!);
    expect(stored.profile.onboarded).toBe(true);
    expect(stored.plans).toHaveLength(1);
    await user.click(
      screen.getByRole("button", { name: "Iniciar meu treino" }),
    );
    await screen.findByRole("heading", { name: "Meu primeiro plano" });
    for (const checkbox of await screen.findAllByRole("checkbox", {
      name: "Etapa concluída",
    }))
      await user.click(checkbox);
    await user.click(
      screen.getByRole("button", { name: "Concluir e registrar" }),
    );
    await screen.findByRole("heading", {
      name: "Seu histórico, com contexto.",
    });
    const final = JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!);
    expect(final.sessions[0].status).toBe("completed");
    expect(final.xp[0].amount).toBe(100);
    expect(final.profile.display_name).toBe("Rafael");
  });
  it("planner edita, duplica, agenda e exclui rotina preservando dados do perfil", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: "Explorar demonstração" });
    const player = demoPlayer();
    player.profile!.onboarded = true;
    player.plans = [
      {
        id: uid(700),
        user_id: "demo",
        title: "Minha rotina",
        steps: [{ exercise_id: seed.exercises[0].id, minutes: 10 }],
      },
    ];
    localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(player));
    await user.click(
      screen.getByRole("button", { name: "Explorar demonstração" }),
    );
    await screen.findByRole("heading", { name: "Como você joga?" });
    await user.click(screen.getByRole("link", { name: "Planejador" }));
    await screen.findByRole("heading", { name: "Seu treino, com direção." });
    await user.click(
      screen.getByRole("button", { name: "Editar Minha rotina" }),
    );
    await screen.findByRole("dialog");
    await user.clear(screen.getByLabelText("Nome"));
    await user.type(screen.getByLabelText("Nome"), "Mira precisa");
    await user.click(screen.getByRole("button", { name: "Salvar rotina" }));
    await screen.findByRole("heading", { name: "Mira precisa" });
    await user.click(
      screen.getByRole("button", { name: "Duplicar Mira precisa" }),
    );
    await screen.findByRole("heading", { name: "Mira precisa (cópia)" });
    await user.click(screen.getAllByRole("button", { name: "Agendar" })[0]);
    await screen.findByRole("dialog");
    await user.type(
      screen.getByLabelText(/^Data e horário/),
      "2026-10-12T17:00",
    );
    await user.click(
      screen.getByRole("button", { name: "Salvar agendamento" }),
    );
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).schedules,
      ).toHaveLength(1),
    );
    await user.click(
      screen.getByRole("button", { name: "Excluir Mira precisa" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Excluir rotina" }),
    );
    await waitFor(() => {
      const data = JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!);
      expect(data.plans).toHaveLength(1);
      expect(data.schedules).toHaveLength(0);
      expect(data.profile.id).toBe("demo");
    });
  });
  it("biblioteca filtra por modalidade e copia código verificado", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("link", { name: "Treinamento" });
    await user.click(screen.getByRole("link", { name: "Treinamento" }));
    await screen.findByRole("heading", {
      name: "Encontre seu próximo exercício.",
    });
    await user.selectOptions(screen.getByLabelText("Modalidade"), "zero");
    expect(
      screen.queryByRole("heading", { name: "Edits, resets e precisão" }),
    ).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Tracking com intenção" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "8022-6842-4965" }));
    expect(await navigator.clipboard.readText()).toBe("8022-6842-4965");
  });
});
