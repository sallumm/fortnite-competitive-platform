import { defineConfig } from "@playwright/test";
const origin = process.env.KYRVEN_AUTH_TEST_ORIGIN;
if (
  process.env.KYRVEN_AUTH_TEST_APPROVED !== "hqhkaewpkkgpagcvgfmb" ||
  !origin ||
  new URL(origin).protocol !== "https:" ||
  new URL(origin).origin !== origin
)
  throw new Error(
    "Hosted Auth tests require separate explicit authorization and exact private HTTPS origin.",
  );
export default defineConfig({
  testDir: ".",
  testMatch: "auth.spec.ts",
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60000,
  use: { baseURL: origin, trace: "off", screenshot: "off", video: "off" },
});
