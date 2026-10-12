import { it, expect } from "vitest";
import {
  privateAuthOperation,
  isSecurityDestination,
} from "../acceptance/safe-errors";
it("discards sensitive exception messages, stacks and causes while preserving failure", async () => {
  const fictitious = "FICTITIOUS_PRIVATE_INPUT";
  const original = new Error(fictitious, { cause: new Error(fictitious) });
  original.stack = fictitious;
  let caught: unknown;
  try {
    await privateAuthOperation(async () => {
      throw original;
    });
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(Error);
  expect(String(caught)).not.toContain(fictitious);
  expect((caught as Error).stack).not.toContain(fictitious);
  expect((caught as Error).cause).toBeUndefined();
});
it("validates the destination without returning query, fragment or complete URL", () => {
  expect(
    isSecurityDestination(
      "https://synthetic.invalid/security?secret=fake#token=fake",
    ),
  ).toBe(true);
  expect(
    isSecurityDestination(
      "https://synthetic.invalid/auth?next=/security#token=fake",
    ),
  ).toBe(false);
  expect(isSecurityDestination("invalid private URL")).toBe(false);
});
