import { it, expect } from "vitest";
import { privatePolicy, safeResult } from "../acceptance/private-policy.mjs";
it("rejects the proven reporter/debug paths and sensitive fixtures before launch", () => {
  for (const argv of [
    ["--add-reporter=list"],
    ["--reporter=list"],
    ["--debug"],
    ["--trace=on"],
    ["--mode=hosted"],
    ["--scenario=success", "--config=private"],
  ])
    expect(() => privatePolicy(argv, {})).toThrow();
  for (const key of [
    "PW_TEST_REPORTER",
    "PW_RUNNER_DEBUG",
    "PWDEBUG",
    "PWDEBUGIMPL",
    "PW_TEST_SOURCE_TRANSFORM",
    "DEBUG",
    "NODE_OPTIONS",
    "NODE_DEBUG",
    "KYRVEN_AUTH_TEST_CALLBACK_URL",
    "pw_test_reporter",
  ])
    expect(() => privatePolicy([], { [key]: "FICTITIOUS_VALUE" })).toThrow();
  expect(
    privatePolicy(["--scenario=success"], {
      PWD: "/synthetic",
      KYRVEN_SYNTHETIC_MARKER: "FICTITIOUS_SAFE",
    }),
  ).toBe("success");
});
it("rejects private errors, extra IPC fields, out-of-order phases and missing results", () => {
  expect(
    safeResult({ type: "result", phase: "setup", ok: false }, "setup"),
  ).toBe(true);
  for (const message of [
    { type: "result", phase: "setup", ok: true, error: "FICTITIOUS_SECRET" },
    { type: "result", phase: "FICTITIOUS_SECRET", ok: true },
    { type: "error", phase: "setup", ok: true },
    null,
  ])
    expect(safeResult(message, "setup")).toBe(false);
});
