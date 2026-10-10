// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { demoPlayer, seed, uid } from "../src/lib/seed";
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
window.scrollTo = () => {};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});
afterEach(cleanup);
async function start() {
  const data = demoPlayer();
  data.profile!.onboarded = true;
  data.plans = [
    {
      id: uid(700),
      user_id: "demo",
      title: "Treino editável",
      steps: seed.exercises
        .slice(0, 2)
        .map((e) => ({ exercise_id: e.id, minutes: 10 })),
    },
  ];
  localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data));
  render(<App />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Explorar demonstração" }),
  );
  await screen.findByRole("heading", { name: "Como você joga?" });
  await user.click(screen.getByRole("link", { name: "Meu Dia", exact: true }));
  await screen.findByRole("heading", { name: "Meu Dia", exact: true });
  return user;
}
it("editor mantém alterações locais, desfaz ordem e duração e salva no armazenamento real do demo", async () => {
  const user = await start();
  await user.click(
    screen.getByRole("link", { name: "Planejador", exact: true }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Editar Treino editável" }),
  );
  const initial = JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!)
    .plans[0];
  await user.click(
    screen.getAllByRole("button", { name: "Mover para baixo" })[0],
  );
  expect(
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans[0],
  ).toEqual(initial);
  await user.click(screen.getByRole("button", { name: "Desfazer" }));
  await user.clear(screen.getAllByLabelText("Minutos")[0]);
  await user.type(screen.getAllByLabelText("Minutos")[0], "15");
  await user.click(screen.getByRole("button", { name: "Pré-visualizar" }));
  expect(screen.getByText("15 min", { exact: true })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Salvar rotina" }));
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans[0].steps[0]
        .minutes,
    ).toBe(15),
  );
});
it("busca de visitante não oferece páginas privadas e a prévia não grava sessões", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "Buscar na plataforma" }),
  );
  await user.type(screen.getByLabelText("O que você procura?"), "Meu Dia");
  expect(
    screen.getByText("Nenhum recurso encontrado. Tente outro termo."),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Fechar janela" }));
  await user.click(
    screen.getByRole("button", { name: "Evolução", exact: true }),
  );
  await user.click(
    screen.getByRole("button", { name: "Registrar sessão de exemplo" }),
  );
  expect(localStorage.getItem("clutchfolio-demo-v1")).toBeNull();
});
it("preferência essencial persiste sem alterar perfil e muda o sistema global", async () => {
  const user = await start();
  await user.click(screen.getByRole("link", { name: /Demonstração local/ }));
  await user.selectOptions(
    await screen.findByLabelText(/Intensidade de movimento/),
    "essential",
  );
  expect(localStorage.getItem("clutchfolio-motion")).toBe("essential");
  expect(document.documentElement.dataset.motion).toBe("essential");
  expect(
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).profile.onboarded,
  ).toBe(true);
});
