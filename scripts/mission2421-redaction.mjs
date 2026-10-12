import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const marker = "FICTITIOUS_AUTH_" + randomUUID();
const browser = await chromium.launch({ headless: true });
let beforeLeak = false;
try {
  const page = await browser.newPage();
  await page.goto("data:text/html,synthetic#access_token=" + marker);
  try {
    await expect(page).toHaveURL(/\/security(?:[?#]|$)/, { timeout: 100 });
  } catch (e) {
    beforeLeak = e.message.includes(marker);
  }
} finally {
  await browser.close();
}
assert(
  beforeLeak,
  "Audited matcher must reproduce URL disclosure with fake input",
);
const result = await new Promise((resolve, reject) => {
  const p = spawn(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config=acceptance/redaction.config.ts",
    ],
    {
      windowsHide: true,
      env: { ...process.env, KYRVEN_FAKE_REDACTION_MARKER: marker },
    },
  );
  let logs = "";
  p.stdout.on("data", (b) => (logs += b));
  p.stderr.on("data", (b) => (logs += b));
  p.on("error", reject);
  p.on("close", (code) => resolve({ code, logs }));
});
assert.notEqual(result.code, 0, "Deliberate failures must stay failures");
assert.equal((result.logs.match(/Private Auth case/g) || []).length, 5);
assert(
  !result.logs.includes(marker),
  "Reporter leaked fictitious sensitive input",
);
function inspect(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = dir + "/" + name.name;
    if (name.isDirectory()) inspect(p);
    else
      assert(
        !readFileSync(p).includes(Buffer.from(marker)),
        "Artifact leaked fictitious input",
      );
  }
}
inspect("test-results/auth-redaction");
const dir = process.env.KYRVEN_NATIVE_EVIDENCE_DIR || "artifacts/mission2421";
mkdirSync(dir, { recursive: true });
writeFileSync(dir + "/auth-redaction.log", result.logs);
writeFileSync(
  dir + "/auth-redaction.json",
  JSON.stringify(
    {
      scope: "offline Chromium; fictitious marker; no hosted Auth",
      before: { matcherLeaks: true },
      after: {
        intentionalFailures: 5,
        nonzeroExit: true,
        logsAndArtifactsLeak: false,
      },
      result: "PASS",
    },
    null,
    2,
  ),
);
console.log(
  "Auth redaction: audited matcher disclosure reproduced; five deliberate failures remain failures; marker absent from corrected logs/artifacts.",
);
