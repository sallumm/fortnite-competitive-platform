// @vitest-environment jsdom
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  within,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MotionSystem } from "../src/components/experience/MotionSystem";
import EsportsTrials from "../src/pages/EsportsTrials";
import EsportsDevelopment from "../src/pages/EsportsDevelopment";
import {
  loadTrials,
  startExam,
  answerExam,
} from "../src/lib/esports/assessments";
import {
  loadDevelopment,
  developmentAction,
} from "../src/lib/esports/development";
import type { Attempt, Trials } from "../src/lib/esports/assessments";
vi.mock("../src/lib/store", () => ({
  useStore: () => ({
    session: { user: { id: "learner" } },
    demo: false,
    busy: false,
    run: async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch {
        /* store reports errors in app notifications */
      }
    },
  }),
}));
vi.mock("../src/lib/esports/assessments", () => ({
  loadTrials: vi.fn(),
  startExam: vi.fn(),
  answerExam: vi.fn(),
}));
vi.mock("../src/lib/esports/development", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/esports/development")>()),
  loadDevelopment: vi.fn(),
  developmentAction: vi.fn(),
}));
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
const attempt: Attempt = {
  id: "attempt",
  application_id: "application",
  exam_id: "exam",
  number: 1,
  version: 1,
  server_now: new Date().toISOString(),
  exam_snapshot: {
    id: "exam",
    version: 1,
    title: "Avaliação de decisões",
    instructions: "Leia e responda.",
    rules: "Avaliação humana.",
    blueprint: [],
    minutes: 30,
    max_attempts: 1,
    published: true,
  },
  questions: [
    {
      id: "q1",
      version: 1,
      category: "Fundamentos",
      difficulty: "foundation",
      kind: "objective",
      prompt: "Qual hábito ajuda a revisar?",
      options: ["Registro contextualizado", "Ignorar resultado"],
      weight: 2,
    },
    {
      id: "q2",
      version: 1,
      category: "Decisões",
      difficulty: "intermediate",
      kind: "discursive",
      prompt: "Explique sua decisão.",
      options: [],
      weight: 3,
    },
  ],
  answers: {},
  status: "active",
  started_at: new Date().toISOString(),
  deadline: new Date(Date.now() + 1800000).toISOString(),
  submitted_at: null,
  result: null,
};
const trials: Trials = {
  assignments: [
    {
      application_id: "application",
      exam_id: "exam",
      title: "Avaliação de decisões",
      instructions: "Leia e responda.",
      rules: "Avaliação humana.",
      minutes: 30,
      max_attempts: 1,
      available_until: new Date(Date.now() + 86400000).toISOString(),
      count: 0,
    },
  ],
  attempts: [],
  technical_notice: "Não monitoramos outras abas.",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadTrials).mockResolvedValue(trials);
  vi.mocked(startExam).mockResolvedValue(attempt);
  vi.mocked(answerExam).mockImplementation(async (t, action, answers) => ({
    ...t,
    version: t.version + 1,
    answers,
    status: action === "submit" ? "submitted" : "active",
  }));
});
afterEach(cleanup);
function renderTrials() {
  return render(
    <MemoryRouter>
      <MotionSystem>
        <EsportsTrials />
      </MotionSystem>
    </MemoryRouter>,
  );
}
async function start() {
  const u = userEvent.setup();
  renderTrials();
  await u.click(
    await screen.findByRole("button", { name: "Ler regras e iniciar" }),
  );
  const dialog = screen.getByRole("dialog");
  await u.click(within(dialog).getByRole("checkbox"));
  await u.click(
    within(dialog).getByRole("button", { name: "Confirmar início" }),
  );
  await screen.findByRole("heading", { name: "Qual hábito ajuda a revisar?" });
  return u;
}
it("requires disclosed acceptance and preserves answers across question navigation", async () => {
  const u = await start();
  expect(startExam).toHaveBeenCalledWith("application", "exam");
  await u.click(screen.getByLabelText("Registro contextualizado"));
  await u.click(screen.getByRole("button", { name: "Próxima questão" }));
  await u.type(
    screen.getByLabelText("Resposta discursiva"),
    "Considero o contexto.",
  );
  await u.click(screen.getByRole("button", { name: "Anterior" }));
  expect(
    (screen.getByLabelText("Registro contextualizado") as HTMLInputElement)
      .checked,
  ).toBe(true);
  await u.click(screen.getByRole("button", { name: "Salvar respostas" }));
  await screen.findByText("Salvamento confirmado pelo servidor.");
  expect(answerExam).toHaveBeenCalledWith(
    expect.objectContaining({ id: "attempt", version: 1 }),
    "save",
    { q1: 0, q2: "Considero o contexto." },
  );
});
it("keeps unsaved drafts after connection failure and prevents dismissal with Escape", async () => {
  const u = await start();
  vi.mocked(answerExam).mockRejectedValueOnce(new Error("Falha de conexão"));
  await u.click(screen.getByLabelText("Registro contextualizado"));
  await u.click(screen.getByRole("button", { name: "Salvar respostas" }));
  await screen.findByRole("alert");
  expect(
    (screen.getByLabelText("Registro contextualizado") as HTMLInputElement)
      .checked,
  ).toBe(true);
  const dialog = screen.getByRole("dialog");
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(dialog.getAttribute("open")).not.toBeNull();
  await screen.findByText(/Salve as respostas antes de sair/);
  await u.click(screen.getByRole("button", { name: "Salvar respostas" }));
  await screen.findByText("Salvamento confirmado pelo servidor.");
});
it("requires final confirmation and shows pending human review without promotion", async () => {
  const u = await start();
  await u.click(screen.getByLabelText("Registro contextualizado"));
  await u.click(screen.getByRole("button", { name: "Revisar e enviar prova" }));
  expect(answerExam).not.toHaveBeenCalled();
  await u.click(
    screen.getByRole("button", { name: "Confirmar envio definitivo" }),
  );
  await screen.findByText(
    "Resultado ainda não compartilhado pela avaliação humana.",
  );
  expect(answerExam).toHaveBeenCalledWith(
    expect.objectContaining({ id: "attempt" }),
    "submit",
    { q1: 0 },
  );
  expect(screen.queryByRole("button", { name: "Salvar respostas" })).toBeNull();
});
it("recovers server-saved answers on a new visit", async () => {
  vi.mocked(loadTrials).mockResolvedValue({
    ...trials,
    attempts: [{ ...attempt, answers: { q1: 1, q2: "Resposta salva" } }],
  });
  const u = userEvent.setup();
  renderTrials();
  await u.click(
    await screen.findByRole("button", { name: "Retomar respostas" }),
  );
  expect(
    (screen.getByLabelText("Ignorar resultado") as HTMLInputElement).checked,
  ).toBe(true);
  await u.click(screen.getByRole("button", { name: "Próxima questão" }));
  expect(
    (screen.getByLabelText("Resposta discursiva") as HTMLTextAreaElement).value,
  ).toBe("Resposta salva");
});
it("keeps denied trial access explicit and recoverable", async () => {
  vi.mocked(loadTrials).mockRejectedValue(
    new Error("Sua conta não possui acesso a esta operação."),
  );
  renderTrials();
  expect((await screen.findByRole("alert")).textContent).toContain(
    "não possui acesso",
  );
  expect(
    screen.queryByRole("button", { name: "Ler regras e iniciar" }),
  ).toBeNull();
});
it("requires explicit versioned scholarship acceptance and never implies paid access", async () => {
  const u = userEvent.setup();
  vi.mocked(loadDevelopment).mockResolvedValue({
    admin: false,
    scholarships: [
      {
        id: "scholarship",
        application_id: "application",
        user_id: "learner",
        version: 3,
        status: "offered",
        title: "Bolsa temporária",
        terms: "Apoio por período, sem contratação ou cobrança.",
        benefits: ["development_workspace"],
        human_availability: "",
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 86400000).toISOString(),
        accepted_at: null,
        created_at: new Date().toISOString(),
      },
    ],
    goals: [],
    reviews: [],
    benefits: [],
    erasure_requests: [],
  });
  vi.mocked(developmentAction).mockResolvedValue({});
  render(
    <MemoryRouter initialEntries={["/app/esports/development"]}>
      <MotionSystem>
        <EsportsDevelopment />
      </MotionSystem>
    </MemoryRouter>,
  );
  await u.click(
    await screen.findByRole("button", { name: "Ler oferta e responder" }),
  );
  expect(developmentAction).not.toHaveBeenCalled();
  await u.click(within(screen.getByRole("dialog")).getByRole("checkbox"));
  await u.click(
    screen.getByRole("button", { name: "Aceitar bolsa temporária" }),
  );
  await waitFor(() =>
    expect(developmentAction).toHaveBeenCalledWith("accept", "scholarship", 3, {
      accepted: true,
    }),
  );
});
