// @vitest-environment jsdom
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { demoPlayer, uid } from "../src/lib/seed";
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
async function demo() {
  const user = userEvent.setup(),
    data = demoPlayer();
  data.profile!.onboarded = true;
  data.plans = [
    {
      id: uid(700),
      user_id: "demo",
      title: "Minha rotina competitiva",
      steps: [{ exercise_id: uid(1), minutes: 30 }],
    },
  ];
  localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data));
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "Explorar demonstração" }),
  );
  await screen.findByRole("heading", { name: "Como você joga?" });
  await user.click(screen.getAllByRole("link", { name: /Competitivo/ })[0]);
  await screen.findByRole("heading", {
    name: "Entenda o cenário. Prepare seu jogo.",
  });
  return user;
}
it("favoritos persistem; preferências regionais e calendário exibem fases sem inventar horas", async () => {
  const u = await demo();
  await u.click(
    screen.getByRole("button", { name: "Favoritar FNCS Solos 2026 · BR" }),
  );
  await waitFor(() =>
    expect(
      JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).bookmarks.some(
        (x: { target_id: string }) => x.target_id === uid(4100),
      ),
    ).toBe(true),
  );
  await u.click(screen.getByRole("button", { name: "Salvos" }));
  expect(
    screen.getByRole("heading", { name: "FNCS Solos 2026 · BR" }),
  ).toBeTruthy();
  await u.click(screen.getByText("Regiões e lembretes opcionais"));
  await u.click(screen.getByRole("checkbox", { name: "EU" }));
  await u.click(screen.getByRole("button", { name: "Salvar preferências" }));
  await screen.findByText("Preferências salvas.");
  expect(
    JSON.parse(localStorage.getItem("clutchfolio-competitive-demo")!).regions,
  ).toEqual(["BR", "EU"]);
});
it("checklist salvo e preparação exige prévia e confirmação antes de gravar", async () => {
  const u = await demo();
  await u.click(screen.getByRole("heading", { name: "FNCS Solos 2026 · BR" }));
  await screen.findByRole("heading", { name: "Fases e sessões" });
  expect(screen.getAllByText(/Horário não confirmado/).length).toBeGreaterThan(
    0,
  );
  await u.click(
    screen.getByRole("button", { name: "Preparar para competição" }),
  );
  const dialog = screen.getByRole("dialog");
  await waitFor(() =>
    expect(
      (within(dialog).getByLabelText("Objetivo pessoal") as HTMLTextAreaElement)
        .disabled,
    ).toBe(false),
  );
  await u.type(
    within(dialog).getByLabelText("Objetivo pessoal"),
    "Revisar rota e recursos",
  );
  await u.click(
    within(dialog).getByRole("checkbox", { name: /Ler regulamento/ }),
  );
  await u.click(
    within(dialog).getByRole("button", { name: "Salvar objetivo e checklist" }),
  );
  await screen.findByText("Objetivo e checklist salvos.");
  const stored = JSON.parse(
    localStorage.getItem("clutchfolio-preparation-demo:" + uid(4100))!,
  );
  expect(stored.objective).toBe("Revisar rota e recursos");
  expect(stored.checklist[1].done).toBe(true);
  const date = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  await u.type(within(dialog).getByLabelText("Data"), date);
  await u.click(
    within(dialog).getByRole("button", {
      name: "Consultar conflitos e mostrar prévia",
    }),
  );
  await screen.findByRole("heading", { name: "Proposta para sua agenda" });
  expect(
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).schedules,
  ).toHaveLength(0);
  await u.click(
    within(dialog).getByRole("button", {
      name: "Confirmar inclusão na agenda",
    }),
  );
  await screen.findByText("Atividade confirmada na sua agenda.");
  const schedules = JSON.parse(
    localStorage.getItem("clutchfolio-demo-v1")!,
  ).schedules;
  expect(schedules).toHaveLength(1);
  expect(schedules[0].tournament_id).toBe(uid(4100));
  expect(schedules[0].starts_at).toBe(date + "T21:00:00.000Z");
});
