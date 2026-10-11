import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("esports public surfaces stay closed and accessible in both themes", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/esports", "/be-kyrven"]) {
    await page.goto(route);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(
      page.getByText(/Recrutamento público fechado/),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations.map((v) => v.id),
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath(route.slice(1) + "-dark.png"),
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations.map((v) => v.id),
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("be-kyrven-light.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("private esports paths require authentication", async ({ page }) => {
  for (const path of ["/app/esports", "/admin/esports"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.locator("main h1").first()).toBeVisible();
  }
});
