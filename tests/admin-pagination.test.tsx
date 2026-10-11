// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MotionSystem } from "../src/components/experience/MotionSystem";
import EsportsAssessmentsAdmin from "../src/pages/EsportsAssessmentsAdmin";
const api = vi.hoisted(() => ({
  load: vi.fn(),
  expire: vi.fn(),
  action: vi.fn(),
}));
vi.mock("../src/lib/store", () => ({
  useStore: () => ({
    session: { user: { id: "admin" } },
    demo: false,
    busy: false,
    run: (fn: () => Promise<unknown>) => fn(),
  }),
}));
vi.mock("../src/lib/esports/assessments", () => ({
  loadAssessments: api.load,
  expireAssessments: api.expire,
  assessmentAction: api.action,
}));
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
const attempt = {
  id: "attempt",
  application_id: "application",
  number: 1,
  version: 1,
  exam_snapshot: { title: "Test exam" },
  questions: [],
  answers: {},
  status: "submitted",
  started_at: "2026-10-01T12:00:00Z",
  submitted_at: "2026-10-01T12:10:00Z",
  deadline: "2026-10-01T12:10:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  api.expire.mockResolvedValue(1);
  api.load.mockImplementation(
    async (
      offset = 0,
      query = "",
      reviewOffset = 0,
      selected: string | null = null,
    ) => ({
      admin: true,
      exams: [],
      assignments: [],
      attempts: [attempt],
      questions: Array.from({ length: offset === 0 ? 50 : 1 }, (_, i) => ({
        id: `question-${offset + i}`,
        prompt: `Question ${offset + i} ${query}`,
        category: "aim",
        difficulty: "foundation",
        kind: "objective",
        weight: 1,
        version: 1,
      })),
      review_history: selected
        ? Array.from({ length: reviewOffset === 0 ? 50 : 1 }, (_, i) => ({
            id: `review-${reviewOffset + i}`,
            attempt_id: selected,
            review_note: `Review note ${reviewOffset + i}`,
            created_at: "2026-10-01T12:00:00Z",
            attempt_version: 1,
            reviewer_id: "reviewer",
          }))
        : [],
    }),
  );
});
afterEach(cleanup);
function open() {
  render(
    <MemoryRouter>
      <MotionSystem>
        <EsportsAssessmentsAdmin />
      </MotionSystem>
    </MemoryRouter>,
  );
}
it("loads subsequent question pages and applies the search before pagination on the server", async () => {
  open();
  await screen.findByText("Tentativas enviadas");
  fireEvent.click(screen.getByRole("button", { name: "Banco de questões" }));
  await screen.findByText("Question 0");
  fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
  await screen.findByText("Question 50");
  expect(api.load).toHaveBeenLastCalledWith(50, "", 0, null);
  fireEvent.change(screen.getByLabelText("Filtrar enunciado ou categoria"), {
    target: { value: "rotation" },
  });
  await waitFor(() =>
    expect(api.load).toHaveBeenLastCalledWith(0, "rotation", 0, null),
  );
});
it("fetches only selected-attempt review pages and preserves unsaved grading fields", async () => {
  open();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Consultar respostas e revisar",
    }),
  );
  await screen.findByText("Review note 0");
  const note = screen.getByLabelText("Observação interna da revisão");
  fireEvent.change(note, { target: { value: "Unsaved human assessment" } });
  fireEvent.click(screen.getByRole("button", { name: "Próximas revisões" }));
  await screen.findByText("Review note 50");
  expect(api.load).toHaveBeenLastCalledWith(0, "", 50, "attempt");
  expect(screen.getByLabelText("Observação interna da revisão")).toHaveProperty(
    "value",
    "Unsaved human assessment",
  );
});
it("never expires an assessment during loading; requires the explicit action", async () => {
  open();
  const button = await screen.findByRole("button", {
    name: "Processar provas com prazo encerrado",
  });
  expect(api.expire).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(api.expire).toHaveBeenCalledTimes(1));
});
