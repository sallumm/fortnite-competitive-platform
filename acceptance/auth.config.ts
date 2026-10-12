import { defineConfig } from "@playwright/test";
// Verified against the locked Playwright runtime: suppress error-context page snapshots.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";
delete process.env.DEBUG;
delete process.env.PWDEBUG;
const origin = process.env.KYRVEN_AUTH_TEST_ORIGIN;
let exactHTTPSOrigin = false;
try {
  exactHTTPSOrigin =
    !!origin &&
    new URL(origin).protocol === "https:" &&
    new URL(origin).origin === origin;
} catch {
  /* Do not expose malformed private URLs. */
}
if (
  process.env.KYRVEN_AUTH_TEST_APPROVED !== "hqhkaewpkkgpagcvgfmb" ||
  !exactHTTPSOrigin
)
  throw new Error(
    "Hosted Auth tests require separate explicit authorization and exact private HTTPS origin.",
  );
export default defineConfig({
  testDir: ".",
  testMatch: "auth.spec.ts",
  workers: 1,
  retries: 0,
  reporter: [["./safe-reporter.ts"]],
  timeout: 60000,
  use: { baseURL: origin, trace: "off", screenshot: "off", video: "off" },
});
