// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  clearLocalProductData,
  validSessionDraft,
} from "../src/lib/local-data";
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
describe("Local privacy and untrusted drafts", () => {
  it("removes all product caches, preserving theme and other applications", () => {
    for (const key of [
      "clutchfolio-demo-v1",
      "clutchfolio-coach-demo:demo",
      "clutchfolio-preparation-demo:event",
      "clutchfolio-competitive-demo",
      "clutchfolio-theme",
      "another-app",
    ])
      localStorage.setItem(key, "test");
    sessionStorage.setItem("clutchfolio-session-demo:session", "private");
    clearLocalProductData(localStorage, sessionStorage);
    expect(localStorage.length).toBe(2);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.getItem("clutchfolio-theme")).toBe("test");
  });
  it("restores only comparable well-formed draft steps", () => {
    const draft = {
      elapsed: 0,
      since: null,
      done: [false],
      results: [{ exercise_id: "exercise", value: null, note: "" }],
    };
    expect(validSessionDraft(draft, ["exercise"])).toBe(true);
    expect(validSessionDraft(draft, ["another-exercise"])).toBe(false);
    expect(validSessionDraft({ ...draft, done: "broken" }, ["exercise"])).toBe(
      false,
    );
    expect(
      validSessionDraft({ ...draft, elapsed: Infinity }, ["exercise"]),
    ).toBe(false);
    expect(
      validSessionDraft(
        { ...draft, results: [{ ...draft.results[0], value: -2 }] },
        ["exercise"],
      ),
    ).toBe(false);
  });
});
