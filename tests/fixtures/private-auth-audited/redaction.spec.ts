import { test, expect } from "./private-test";
import { privateAuthOperation, isSecurityDestination } from "./safe-errors";
const marker = () => process.env.KYRVEN_FAKE_REDACTION_MARKER!;
test("private URL assertion failure", async ({ page }) =>
  privateAuthOperation(async () => {
    await page.goto(
      `data:text/html,synthetic?token=${marker()}#access_token=${marker()}`,
    );
    await expect
      .poll(() => isSecurityDestination(page.url()), { timeout: 100 })
      .toBe(true);
  }));
test("private exception and worker output", async () =>
  privateAuthOperation(async () => {
    console.log(marker());
    console.error(marker());
    throw new Error(`SDK failure with fictitious sensitive input: ${marker()}`);
  }));
test("private cleanup failure", async () =>
  privateAuthOperation(async () => {
    try {
      expect(true).toBe(true);
    } finally {
      throw new Error(marker());
    }
  }));
test("framework timeout containing private pending operation", async () => {
  test.setTimeout(100);
  console.error(marker());
  await new Promise(() => {});
});
test("unwrapped private assertion is sanitized before artifacts", async () => {
  expect(marker()).toBe("safe expected value");
});
