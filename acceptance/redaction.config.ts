// Strictly offline adversarial suite. Never loads hosted Auth config or operator fixtures.
import { defineConfig } from "@playwright/test";
import { requirePrivateReporting } from "./privacy-config";
requirePrivateReporting();
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
export default defineConfig({
  testDir: ".",
  testMatch: "redaction.spec.ts",
  workers: 1,
  retries: 0,
  reporter: [["./safe-reporter.ts"]],
  outputDir: "../test-results/auth-redaction",
  timeout: 1000,
  use: { trace: "off", screenshot: "off", video: "off" },
});
