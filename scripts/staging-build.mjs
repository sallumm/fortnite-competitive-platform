import { spawnSync } from "node:child_process";
import { loadEnv } from "vite";
import { stagingIssues } from "./staging-check.mjs";

// No publish step, remote prerender, or production-mode env file.
const env = {
  ...loadEnv("staging", process.cwd(), ""),
  ...process.env,
  KYRVEN_BUILD_TARGET: "staging",
  PRERENDER_PUBLIC: "0",
};
if (
  [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_SITE_URL",
    "VITE_TURNSTILE_SITE_KEY",
  ].some((name) => env[name])
) {
  const issues = stagingIssues(env);
  if (issues.length) {
    console.error(issues.join("\n"));
    process.exit(1);
  }
} else {
  console.info(
    "Build offline: nenhum serviço configurado; implantação bloqueada até check:staging e autorização.",
  );
}
const steps = [
  ["scripts/frontend-env-check.mjs"],
  ["node_modules/typescript/bin/tsc", "-b"],
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.coach.json"],
  ["node_modules/vite/bin/vite.js", "build", "--mode", "staging"],
  ["scripts/sitemap.mjs"],
  ["scripts/prerender-editorial.mjs"],
  ["scripts/staging-artifact.mjs"],
];
for (const args of steps) {
  const result = spawnSync(process.execPath, [...process.execArgv, ...args], {
    env,
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    console.error("Build de staging interrompido; artefato não aprovado.");
    process.exit(result.status || 1);
  }
}
