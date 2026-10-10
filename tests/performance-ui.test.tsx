// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { demoPlayer, seed, uid } from "../src/lib/seed";
import { dateInZone, shiftDate, weekday } from "../src/lib/calendar";
vi.stubGlobal("scrollTo", () => {});
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
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
async function demo() {
  const user = userEvent.setup();
  const data = demoPlayer();
  data.profile!.onboarded = true;
  data.plans = [
    {
      id: uid(700),
      user_id: "demo",
      title: "Mira pessoal",
      steps: [{ exercise_id: seed.exercises[0].id, minutes: 10 }],
    },
  ];
  localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data));
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "Explorar demonstração" }),
  );
  await screen.findByRole("heading", { name: "Como você joga?" });
  await user.click(screen.getByRole("link", { name: "Meu Dia" }));
  await screen.findByRole("heading", { name: "Meu Dia" });
  return user;
}
function stored() {
  return JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!);
}
describe("Fluxos pessoais 2.0 e persistência em DOM", () => {
  it("cria série, move somente uma ocorrência e vincula conclusão ao calendário", async () => {
    const user = await demo();
    await user.click(screen.getByRole("link", { name: "Planejador" }));
    await screen.findByRole("heading", { name: "Seu treino, com direção." });
    await user.click(screen.getByRole("button", { name: "Agendar" }));
    const day = dateInZone(new Date(), "America/Sao_Paulo");
    await user.click(screen.getByLabelText("Repetir semanalmente"));
    const field = screen.getByRole("group", { name: "Dias de repetição" });
    for (const box of within(field).getAllByRole("checkbox")) {
      const name = box.parentElement!.textContent;
      if ((box as HTMLInputElement).checked) await user.click(box);
      expect(name).toBeTruthy();
    }
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    await user.click(
      within(field).getByRole("checkbox", { name: dayNames[weekday(day)] }),
    );
    await user.click(
      screen.getByRole("button", { name: "Salvar agendamento" }),
    );
    await waitFor(() => expect(stored().series).toHaveLength(1));
    expect(stored().schedules).toHaveLength(0);
    await user.click(
      (await screen.findAllByRole("button", { name: "Detalhes / editar" }))[0],
    );
    await screen.findByRole("dialog");
    await user.clear(screen.getByLabelText(/^Título/));
    await user.type(screen.getByLabelText(/^Título/), "Tracking ajustado");
    await user.click(
      screen.getByRole("button", { name: "Salvar agendamento" }),
    );
    await waitFor(() => expect(stored().exceptions).toHaveLength(1));
    expect(stored().series[0].title).toBe("Mira pessoal");
    await user.click(
      screen.getAllByRole("button", { name: "Começar treino" })[0],
    );
    await screen.findByRole("heading", { name: "Mira pessoal" });
    expect(stored().sessions[0].series_id).toBe(stored().series[0].id);
    await user.type(
      await screen.findByLabelText(/^Configuração comparável/),
      "Cenário A / 60s",
    );
    await user.click(screen.getByRole("checkbox", { name: "Etapa concluída" }));
    await user.click(
      screen.getByRole("checkbox", {
        name: "Abrir diário opcional após concluir",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Concluir e registrar" }),
    );
    await screen.findByRole("heading", {
      name: "Uma revisão breve, do seu jeito.",
    });
    await user.type(
      screen.getByLabelText("O que consegui executar melhor?"),
      "Mantive o alvo",
    );
    await user.click(screen.getByRole("checkbox", { name: "Tracking" }));
    await user.click(screen.getByRole("button", { name: "Salvar diário" }));
    await waitFor(() => expect(stored().journals).toHaveLength(1));
    expect(stored().sessions[0].results[0].configuration).toBe(
      "Cenário A / 60s",
    );
    expect(stored().journals[0].difficulties).toEqual(["tracking"]);
    await user.click(screen.getByRole("link", { name: "Minha Semana" }));
    await screen.findByRole("heading", { name: "Revisar. Ajustar. Seguir." });
    await user.click(screen.getByRole("button", { name: "Gerar meu resumo" }));
    await waitFor(() => expect(stored().weeklyReports).toHaveLength(1));
    expect(stored().weeklyReports[0].summary.completed).toBe(1);
    expect(stored().weeklyReports[0].summary.difficulties).toEqual([
      { key: "tracking", count: 1 },
    ]);
  });
  it("registra avaliação qualitativa sem nota e preserva dados após nova montagem", async () => {
    const user = await demo();
    await user.click(
      screen.getAllByRole("link", { name: "Minhas Habilidades" })[0],
    );
    await screen.findByRole("heading", {
      name: "Desenvolva uma área por vez.",
    });
    await user.type(
      screen.getByLabelText("Objetivo pessoal"),
      "Manter acompanhamento consistente",
    );
    await user.selectOptions(
      screen.getByLabelText("Última avaliação pessoal"),
      "developing",
    );
    await user.click(
      screen.getByRole("button", { name: "Registrar avaliação" }),
    );
    await waitFor(() => expect(stored().skillReviews).toHaveLength(1));
    cleanup();
    window.history.replaceState({}, "", "/");
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Explorar demonstração" }),
    );
    await user.click(
      (await screen.findAllByRole("link", { name: "Minhas Habilidades" }))[0],
    );
    await screen.findByRole("heading", {
      name: "Desenvolva uma área por vez.",
    });
    expect(
      screen.getByText("Em desenvolvimento", { selector: "strong" }),
    ).toBeTruthy();
    expect(stored().skillReviews[0].goal).toBe(
      "Manter acompanhamento consistente",
    );
  });
  it("permite compromisso pessoal com conflito explícito e cancelamento", async () => {
    const user = await demo();
    await user.click(screen.getByRole("link", { name: "Planejador" }));
    await screen.findByRole("button", { name: "Criar atividade" });
    await user.click(screen.getByRole("button", { name: "Criar atividade" }));
    const future =
      shiftDate(dateInZone(new Date(), stored().profile.timezone), 1) +
      "T18:00";
    await user.type(screen.getByLabelText(/^Título/), "Estudos");
    fireEvent.change(screen.getByLabelText(/^Data e horário/), {
      target: { value: future },
    });
    await user.click(
      screen.getByRole("button", { name: "Salvar agendamento" }),
    );
    await waitFor(() => expect(stored().schedules).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Criar atividade" }));
    await user.type(screen.getByLabelText(/^Título/), "Pausa");
    fireEvent.change(screen.getByLabelText(/^Data e horário/), {
      target: { value: future },
    });
    expect(screen.getByText(/Conflito com Estudos/)).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Salvar agendamento" })
        .hasAttribute("disabled"),
    ).toBe(true);
    await user.click(screen.getByLabelText("Salvar mesmo com conflito"));
    await user.click(
      screen.getByRole("button", { name: "Salvar agendamento" }),
    );
    await waitFor(() => expect(stored().schedules).toHaveLength(2));
    await user.click(
      (await screen.findAllByRole("button", { name: "Detalhes / editar" }))[0],
    );
    await user.click(
      screen.getByRole("button", { name: "Cancelar esta ocorrência" }),
    );
    await waitFor(() =>
      expect(
        stored().schedules.some(
          (a: { status: string }) => a.status === "cancelled",
        ),
      ).toBe(true),
    );
  });
});
