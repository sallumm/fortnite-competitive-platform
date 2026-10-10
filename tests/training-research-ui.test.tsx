// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ExerciseResearchEditor } from "../src/components/ExerciseResearchEditor";
import { exerciseSchema } from "../src/lib/validation";
import { seed } from "../src/lib/seed";
import type { ExerciseResearch } from "../src/lib/training-research-validation";
afterEach(cleanup);
it("editor reviews a real exercise and validates retirement instead of silently publishing it", async () => {
  const saved = vi.fn();
  const exercise = seed.exercises.find((e) => e.title === "Freebuild")!;
  function Form() {
    const [research, setResearch] = useState<ExerciseResearch>(
      exercise.research!,
    );
    const [published, setPublished] = useState(true);
    const [error, setError] = useState("");
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const result = exerciseSchema.safeParse({
            ...exercise,
            published,
            research,
          });
          if (result.success) {
            setError("");
            saved(result.data);
          } else setError(result.error.issues[0].message);
        }}
      >
        <ExerciseResearchEditor
          value={research}
          mode={exercise.mode}
          onChange={setResearch}
        />
        <label>
          Publicado
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
        </label>
        <button>Salvar revisão</button>
        {error && <p role="alert">{error}</p>}
      </form>
    );
  }
  render(<Form />);
  const u = userEvent.setup();
  await u.selectOptions(screen.getByLabelText("Status da revisão"), "retired");
  await u.clear(screen.getByLabelText("Notas da revisão"));
  await u.type(
    screen.getByLabelText("Notas da revisão"),
    "A ilha foi retirada; manter registros anteriores.",
  );
  await u.click(screen.getByRole("button", { name: "Salvar revisão" }));
  expect(saved).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toContain("Despublique");
  await u.click(screen.getByLabelText("Publicado"));
  await u.click(screen.getByRole("button", { name: "Salvar revisão" }));
  expect(saved).toHaveBeenCalledWith(
    expect.objectContaining({
      published: false,
      research: expect.objectContaining({
        review_status: "retired",
        review_notes: "A ilha foi retirada; manter registros anteriores.",
      }),
    }),
  );
});
