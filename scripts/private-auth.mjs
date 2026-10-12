// Offline synthetic architecture. Never invokes Playwright Test or reads operator fixtures.
import { fork, spawn } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import {
  privatePolicy,
  safeResult,
  phases,
} from "../acceptance/private-policy.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let scenario;
try {
  scenario = privatePolicy(process.argv.slice(2), process.env);
} catch {
  console.error("Private runner controls rejected; fixtures were not loaded.");
  process.exit(2);
}
const temp = mkdtempSync(resolve(tmpdir(), "kyrven-private-auth-"));
const browserCache =
  process.platform === "win32"
    ? resolve(homedir(), "AppData/Local/ms-playwright")
    : process.platform === "darwin"
      ? resolve(homedir(), "Library/Caches/ms-playwright")
      : resolve(homedir(), ".cache/ms-playwright");
const env = {
  PATH: dirname(process.execPath),
  TEMP: temp,
  TMP: temp,
  TMPDIR: temp,
  HOME: temp,
  USERPROFILE: temp,
  PLAYWRIGHT_BROWSERS_PATH: browserCache,
  KYRVEN_PRIVATE_SCENARIO: scenario,
  KYRVEN_SYNTHETIC_MARKER:
    process.env.KYRVEN_SYNTHETIC_MARKER || "FICTITIOUS_DEFAULT",
};
if (process.platform === "win32") env.SystemRoot = process.env.SystemRoot;
const results = [];
let protocolFailed = false,
  watchdog = false,
  killTimer;
const child = fork(resolve(root, "acceptance/private-worker.mjs"), [], {
  env,
  execArgv: [],
  windowsHide: true,
  cwd: temp,
  stdio: ["ignore", "ignore", "ignore", "ipc"],
});
child.on("message", (value) => {
  if (protocolFailed) return;
  if (!safeResult(value, phases[results.length])) {
    protocolFailed = true;
    return;
  }
  // Construct a fresh allowlisted object; never spread/serialize a worker object.
  results.push({ phase: phases[results.length], ok: value.ok });
});
const timer = setTimeout(() => {
  watchdog = true;
  if (process.platform === "win32" && child.exitCode === null && !child.killed)
    spawn(
      resolve(process.env.SystemRoot, "System32/taskkill.exe"),
      ["/PID", String(child.pid), "/T", "/F"],
      { windowsHide: true, stdio: "ignore" },
    );
  else {
    child.kill("SIGTERM");
    killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
  }
}, 15000);
const exit = await new Promise((res) => {
  child.on("error", () => res(1));
  child.on("exit", (code) => res(code));
});
clearTimeout(timer);
clearTimeout(killTimer);
const ok =
  exit === 0 &&
  !protocolFailed &&
  !watchdog &&
  results.length === phases.length &&
  results.every((x) => x.ok);
// Temporary browser internals are confined and discarded, never exported as test artifacts.
const rel = relative(resolve(tmpdir()), temp);
if (
  isAbsolute(rel) ||
  rel.startsWith("..") ||
  !rel.startsWith("kyrven-private-auth-")
)
  throw new Error("Temporary boundary rejected.");
let temporaryRemoved = true;
try {
  rmSync(temp, {
    recursive: true,
    force: true,
    maxRetries: 30,
    retryDelay: 100,
  });
} catch {
  temporaryRemoved = false;
}
const dir = resolve(root, "artifacts/mission2423/private-auth");
mkdirSync(dir, { recursive: true });
const report = {
  scope: "offline synthetic browser API; hosted Auth disabled",
  scenario,
  status: ok && temporaryRemoved ? "passed" : "failed",
  results,
  protocolFailed,
  watchdog,
  temporaryRemoved,
};
writeFileSync(
  resolve(dir, scenario + ".json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log("Private Auth synthetic run: " + report.status);
process.exitCode = report.status === "passed" ? 0 : 1;
