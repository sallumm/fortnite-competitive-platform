import { test, expect, type Page } from "@playwright/test";
import { demoPlayer } from "../src/lib/seed";

async function enterDemo(page: Page) {
  const data = demoPlayer();
  data.profile!.onboarded = true;
  await page.goto("/");
  await page.evaluate((data) => {
    localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data));
    localStorage.setItem("clutchfolio-demo-active", "true");
  }, data);
  await page.goto("/library");
}

test("navigation links and profile accept pointer input across narrow and short viewports", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterDemo(page);
  const viewports = info.project.name === "mobile"
    ? [{ width: 320, height: 568 }, { width: 393, height: 500 },
       { width: 640, height: 500 }, { width: 641, height: 500 },
       { width: 680, height: 500 }, { width: 681, height: 500 }]
    : [page.viewportSize()!];
  const menu = page.locator("#main-navigation");
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/library");
    if (viewport.width <= 680) {
      await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
      await expect(page.getByRole("button", { name: "Fechar menu de navegação", exact: true })).toBeFocused();
      await expect(menu).toHaveCSS("transform", "none");
      expect(await menu.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({ path: info.outputPath(`navigation-open-${viewport.width}x${viewport.height}.png`) });
    }
    const links = menu.locator("a[href]");
    for (const link of await links.all()) {
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();
      expect(await link.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      }), `${viewport.width}x${viewport.height}: link receives pointer input`).toBe(true);
    }
    await page.screenshot({ path: info.outputPath(`navigation-${viewport.width}x${viewport.height}.png`) });
    const profile = menu.locator('a[href="/app/profile"]');
    if (info.project.name === "mobile") await profile.tap();
    else await profile.click();
    await expect(page).toHaveURL(/\/app\/profile$/);
    await expect(page.getByRole("button", { name: "Apagar dados da demonstração", exact: true })).toBeVisible();
    if (viewport.width <= 680) await expect(menu).toBeHidden();
    await expect(page.locator(".mobile-dock")).toBeVisible({ visible: viewport.width <= 640 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("drawer traps focus, restores both openers and releases scrolling across desktop transition", async ({ page }) => {
  await enterDemo(page);
  await page.setViewportSize({ width: 900, height: 700 });
  await page.getByRole("button", { name: "Recolher menu", exact: true }).click();
  await page.setViewportSize({ width: 393, height: 500 });
  const menu = page.locator("#main-navigation");
  const headerOpener = page.getByRole("button", { name: "Abrir menu", exact: true });
  const dockOpener = page.getByRole("button", { name: "Mais destinos", exact: true });
  const close = page.getByRole("button", { name: "Fechar menu de navegação", exact: true });
  const profile = menu.locator('a[href="/app/profile"]');

  await headerOpener.click();
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(profile).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(headerOpener).toBeFocused();

  await dockOpener.click();
  await expect(close).toBeFocused();
  await expect(dockOpener).toHaveAttribute("aria-expanded", "true");
  await close.click();
  await expect(menu).toBeHidden();
  await expect(dockOpener).toBeFocused();
  await expect(dockOpener).toHaveAttribute("aria-expanded", "false");

  await dockOpener.click();
  await page.locator(".menu-backdrop").click({ position: { x: 350, y: 100 } });
  await expect(menu).toBeHidden();
  await expect(dockOpener).toBeFocused();

  await dockOpener.click();
  await page.setViewportSize({ width: 641, height: 500 });
  await expect(close).toBeVisible();
  await expect(page.locator(".mobile-dock")).toBeHidden();
  await page.setViewportSize({ width: 680, height: 500 });
  await expect(close).toBeVisible();
  await page.setViewportSize({ width: 681, height: 500 });
  await expect(menu).not.toHaveClass(/\bopen\b/);
  await expect(page.getByRole("link", { name: "Meu Dia", exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");

  await page.setViewportSize({ width: 640, height: 500 });
  await headerOpener.click();
  await profile.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/profile$/);
  await expect(menu).toBeHidden();
  await expect(page.locator("main")).toBeFocused();
  await expect(page.locator(".mobile-dock")).toBeVisible();
});
