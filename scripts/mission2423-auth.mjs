import { spawn } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { scenarios } from "../acceptance/private-policy.mjs";
const marker = "FICTITIOUS_" + randomUUID(),
  temp = mkdtempSync(resolve(tmpdir(), "kyrven-auth-regressions-")),
  before = [],
  after = [],
  guard = [];
// Baseline probes also receive only OS/runtime paths, never operator credentials.
const baseEnv = {};
for (const k of [
  "PATH",
  "Path",
  "SystemRoot",
  "SYSTEMROOT",
  "HOME",
  "USERPROFILE",
  "LOCALAPPDATA",
  "TEMP",
  "TMP",
  "TMPDIR",
])
  if (process.env[k]) baseEnv[k] = process.env[k];
function run(args, env = {}) {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, args, {
      windowsHide: true,
      env: { ...baseEnv, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    p.stdout.on("data", (b) => (log += b));
    p.stderr.on("data", (b) => (log += b));
    p.on("error", rej);
    p.on("close", (exit) => res({ exit, log }));
  });
}
function leaked(dir) {
  let found = false;
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) found = leaked(p) || found;
      else found = readFileSync(p).includes(Buffer.from(marker)) || found;
    }
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  return found;
}
try {
  for (const [name, args, env] of [
    ["additional-reporter", ["--add-reporter=list"], {}],
    ["environment-reporter", [], { PW_TEST_REPORTER: "list" }],
    ["runner-debug", [], { PW_RUNNER_DEBUG: "1" }],
  ]) {
    const dir = resolve(temp, name),
      r = await run(
        [
          "node_modules/@playwright/test/cli.js",
          "test",
          "--config=tests/fixtures/private-auth-audited/redaction.config.ts",
          "--output=" + dir,
          ...args,
        ],
        { KYRVEN_FAKE_REDACTION_MARKER: marker, ...env },
      );
    assert(r.exit !== 0 && r.log.includes(marker));
    before.push({
      name,
      logLeak: true,
      artifactLeak: leaked(dir),
      nonzeroExit: true,
    });
  }
  for (const phase of [
    "collection",
    "beforeAll",
    "setup",
    "teardown",
    "afterAll",
  ]) {
    const dir = resolve(temp, phase),
      r = await run(
        [
          "node_modules/@playwright/test/cli.js",
          "test",
          "--config=tests/fixtures/private-auth-audited/lifecycle.config.ts",
          "--output=" + dir,
        ],
        { KYRVEN_FAKE_REDACTION_MARKER: marker, A2422_SCENARIO: phase },
      );
    assert.notEqual(r.exit, 0);
    const leak = leaked(dir);
    assert.equal(leak, ["beforeAll", "teardown", "afterAll"].includes(phase));
    before.push({
      name: phase,
      logLeak: r.log.includes(marker),
      artifactLeak: leak,
      nonzeroExit: true,
    });
  }
  for (const scenario of scenarios) {
    const r = await run(
      ["scripts/private-auth.mjs", "--scenario=" + scenario],
      { KYRVEN_SYNTHETIC_MARKER: marker },
    );
    assert.equal(r.exit, scenario === "success" ? 0 : 1);
    assert(!r.log.includes(marker));
    const report = JSON.parse(
      readFileSync("artifacts/mission2423/private-auth/" + scenario + ".json"),
    );
    assert(report.temporaryRemoved);
    assert.equal(report.status, scenario === "success" ? "passed" : "failed");
    after.push({
      scenario,
      exit: r.exit,
      status: report.status,
      results: report.results,
      protocolFailed: report.protocolFailed,
      temporaryRemoved: report.temporaryRemoved,
      logLeak: false,
    });
  }
  for (const [name, args, env] of [
    ["additional-reporter", ["--add-reporter=list"], {}],
    ["reporter", ["--reporter=list"], {}],
    ["debug", ["--debug"], {}],
    ["trace", ["--trace=on"], {}],
    ["hosted-mode", ["--mode=hosted"], {}],
    ...[
      "PW_TEST_REPORTER",
      "PW_RUNNER_DEBUG",
      "PWDEBUG",
      "PWDEBUGIMPL",
      "PW_TEST_SOURCE_TRANSFORM",
      "DEBUG",
      "NODE_OPTIONS",
      "NODE_DEBUG",
      "KYRVEN_AUTH_TEST_CALLBACK_URL",
    ].map((k) => [
      k,
      [],
      { [k]: k === "NODE_OPTIONS" ? "--no-warnings" : marker },
    ]),
  ]) {
    const r = await run(["scripts/private-auth.mjs", ...args], {
      KYRVEN_SYNTHETIC_MARKER: marker,
      ...env,
    });
    assert.equal(r.exit, 2);
    assert(r.log.includes("fixtures were not loaded"));
    assert(!r.log.includes(marker));
    guard.push({ name, exit: 2, blockedBeforeFixtures: true, logLeak: false });
  }
  assert(!leaked("artifacts/mission2423/private-auth"));
  const dir = process.env.KYRVEN_NATIVE_EVIDENCE_DIR || "artifacts/mission2423";
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, "auth-privacy.json"),
    JSON.stringify(
      {
        scope:
          "synthetic only; no hosted Auth; no raw output or artifact export",
        runtime: JSON.parse(
          readFileSync("node_modules/playwright/package.json"),
        ).version,
        before,
        after,
        guard,
        exportedMarkerLeak: false,
        temporaryRemoved: true,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Private Auth regressions: original overrides/lifecycle leaks reproduced; isolated API phases fail correctly; controls rejected before fixtures; only sanitized JSON exported.",
  );
} finally {
  rmSync(temp, {
    recursive: true,
    force: true,
    maxRetries: 30,
    retryDelay: 100,
  });
}
