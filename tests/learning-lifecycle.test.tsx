// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
const state = vi.hoisted(() => ({
  owner: "account-a",
  study: vi.fn(),
  road: vi.fn(),
}));
vi.mock("../src/lib/store", () => ({
  useStore: () => ({
    demo: false,
    session: state.owner ? { user: { id: state.owner } } : null,
  }),
}));
vi.mock("../src/lib/academy-service", () => ({ loadStudy: state.study }));
vi.mock("../src/lib/road/service", () => ({ loadRoad: state.road }));
import { useStudy } from "../src/lib/useStudy";
import { useRoad } from "../src/lib/road/useRoad";
function Study() {
  const s = useStudy();
  return (
    <>
      <output>{s.data.records.map((r) => r.id).join(",")}</output>
      <button onClick={() => void s.refresh()}>Atualizar</button>
      <span>{s.error}</span>
    </>
  );
}
function Road() {
  const s = useRoad();
  return (
    <>
      <output>{s.data.events.map((r) => r.id).join(",")}</output>
      <button onClick={() => void s.refresh()}>Atualizar</button>
      <span>{s.error}</span>
    </>
  );
}
function deferred() {
  let resolve!: (value: any) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<any>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.owner = "account-a";
});
it("older study responses cannot overwrite a newer refresh or expose the previous account", async () => {
  const old = deferred(),
    fresh = deferred(),
    other = deferred();
  state.study
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(fresh.promise)
    .mockReturnValueOnce(other.promise);
  const view = render(<Study />);
  fireEvent.click(screen.getByRole("button"));
  await act(async () =>
    fresh.resolve({ records: [{ id: "fresh" }], notes: [] }),
  );
  await act(async () => old.resolve({ records: [{ id: "old" }], notes: [] }));
  expect(screen.getByRole("status").textContent).toBe("fresh");
  state.owner = "account-b";
  view.rerender(<Study />);
  expect(screen.getByRole("status").textContent).toBe("");
  await act(async () =>
    other.resolve({ records: [{ id: "other" }], notes: [] }),
  );
  expect(screen.getByRole("status").textContent).toBe("other");
});
it("a late journey failure does not replace a successful refresh, and logout clears the visible state", async () => {
  const old = deferred(),
    fresh = deferred();
  state.road
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(fresh.promise);
  const view = render(<Road />);
  fireEvent.click(screen.getByRole("button"));
  await act(async () =>
    fresh.resolve({ journeys: [], events: [{ id: "current" }], batches: [] }),
  );
  await act(async () => old.reject(new Error("offline")));
  expect(screen.getByRole("status").textContent).toBe("current");
  expect(screen.queryByText(/Não foi possível/)).toBeNull();
  state.owner = "";
  view.rerender(<Road />);
  expect(screen.getByRole("status").textContent).toBe("");
});
