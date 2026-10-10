// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { demoPlayer, uid } from "../src/lib/seed";
vi.stubGlobal("scrollTo", () => {});
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});
afterEach(cleanup);
async function demo() {
  const u = userEvent.setup(),
    data = demoPlayer();
  data.profile!.onboarded = true;
  data.plans = [
    {
      id: uid(700),
      user_id: "demo",
      title: "Mira pessoal",
      steps: [{ exercise_id: uid(1), minutes: 10 }],
    },
  ];
  localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data));
  render(<App />);
  await u.click(
    await screen.findByRole("button", { name: "Explorar demonstração" }),
  );
  await screen.findByRole("heading", { name: "Como você joga?" });
  await u.click(screen.getByRole("link", { name: "kyrven coach" }));
  await screen.findByRole("heading", { name: "kyrven coach" });
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Sua mensagem") as HTMLTextAreaElement).disabled,
    ).toBe(false),
  );
  return u;
}
async function send(u: ReturnType<typeof userEvent.setup>, text: string) {
  await u.clear(screen.getByLabelText("Sua mensagem"));
  await u.type(screen.getByLabelText("Sua mensagem"), text);
  await u.click(screen.getByRole("button", { name: "Enviar mensagem" }));
  await screen.findByText(text, { selector: ".coach-user p" });
}
it("abre chat pelo produto, ausência de consentimento não inventa dados e histórico é opcional", async () => {
  const u = await demo();
  await send(u, "Como foi minha evolução nos últimos 30 dias?");
  expect(
    await screen.findByRole("heading", {
      name: "Autorize o contexto individual",
    }),
  ).toBeTruthy();
  expect(
    JSON.stringify(localStorage.getItem("clutchfolio-coach-demo:demo")),
  ).not.toContain("Como foi");
  await u.click(
    screen.getByRole("button", { name: "Privacidade e preferências" }),
  );
  await u.click(screen.getByRole("checkbox", { name: /Autorizar consulta/ }));
  await u.click(screen.getByRole("checkbox", { name: /Salvar histórico/ }));
  await send(u, "Como foi minha última semana?");
  expect(
    await screen.findByRole("heading", { name: "Resultados comparáveis" }),
  ).toBeTruthy();
  const stored = JSON.parse(
    localStorage.getItem("clutchfolio-coach-demo:demo")!,
  );
  expect(stored.conversations).toHaveLength(1);
  expect(Object.values(stored.history)[0]).toHaveLength(1);
  await u.click(screen.getByRole("button", { name: "Nova conversa" }));
  expect(
    screen.queryByRole("heading", { name: "Resultados comparáveis" }),
  ).toBeNull();
  await u.click(
    screen.getByRole("button", { name: "Como foi minha última semana?" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Resultados comparáveis" }),
  ).toBeTruthy();
  await u.click(
    screen.getByRole("button", { name: "Excluir todo o histórico" }),
  );
  await u.click(
    screen.getByRole("button", { name: "Confirmar exclusão do histórico" }),
  );
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem("clutchfolio-coach-demo:demo")!)
        .conversations,
    ).toHaveLength(0),
  );
});
it("gera prévia sem mutação e somente confirmação adiciona ao calendário", async () => {
  const u = await demo();
  await send(u, "Quero treinar mira amanhã por 40 minutos.");
  await screen.findByRole("heading", { name: "Organizar atividades" });
  const before = JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!)
    .schedules.length;
  await u.click(
    screen.getByRole("button", { name: "Gerar prévia e verificar conflitos" }),
  );
  await screen.findByRole("heading", {
    name: "Prévia validada · planejamento",
  });
  expect(
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).schedules,
  ).toHaveLength(before);
  await u.click(screen.getByRole("button", { name: "Confirmar proposta" }));
  await screen.findByText("Atividades atualizadas na demonstração local.");
  expect(
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).schedules,
  ).toHaveLength(before + 1);
  expect(
    (
      screen.getByRole("button", {
        name: "Alteração concluída",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
it("link contextual de exercício mantém pergunta e não envia dados para IA externa no demo", async () => {
  const u = await demo();
  await u.click(screen.getByRole("link", { name: "Exercícios" }));
  await screen.findByRole("heading", {
    name: "Encontre seu próximo exercício.",
  });
  const link = screen
    .getAllByRole("link")
    .find((l) => l.getAttribute("href") === "/library/" + uid(1))!;
  await u.click(link);
  await u.click(
    await screen.findByRole("link", { name: "Como este exercício me ajuda?" }),
  );
  expect(
    ((await screen.findByLabelText("Sua mensagem")) as HTMLTextAreaElement)
      .value,
  ).toContain("Como este exercício me ajuda");
  await u.click(
    screen.getByRole("button", { name: "Privacidade e preferências" }),
  );
  expect(
    (
      screen.getByRole("checkbox", {
        name: /Autorizar envio/,
      }) as HTMLInputElement
    ).disabled,
  ).toBe(true);
  await u.click(screen.getByRole("button", { name: "Enviar mensagem" }));
  await screen.findByRole("heading", { name: "Exercícios do kyrven" });
  expect(
    within(screen.getByRole("log")).getByText(/Mapa cadastrado/),
  ).toBeTruthy();
});
