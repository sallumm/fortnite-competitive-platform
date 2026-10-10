import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPlayer, seed, uid } from "../src/lib/seed";
async function navigate(page: Page, name: string) {
  const toggle = page.getByRole("button", { name: "Abrir menu", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole("link", { name, exact: true }).first().click();
}
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (!request.failure()?.errorText.includes("ERR_ABORTED"))
      errors.push(request.url());
  });
  (page as Page & { productErrors: string[] }).productErrors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { productErrors: string[] }).productErrors).toEqual(
    [],
  );
});
test("public discovery, disabled accounts, responsive navigation and both themes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Seu próximo nível/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("link", { name: "Começar grátis" }).first().click();
  await expect(page.getByText(/Contas ainda não foram ativadas/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }).last(),
  ).toBeDisabled();
  await navigate(page, "Notícias e análises");
  await expect(page).toHaveURL(/\/news$/);
  await expect(page.locator("main h1").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("training, reports, coach and complete local deletion", async ({
  page,
}, testInfo) => {
  // Storage is seeded once; deleting it must not be undone by an init script on a reload.
  const data = demoPlayer();
  data.profile!.onboarded = true;
  data.plans = [
    {
      id: uid(700),
      user_id: "demo",
      title: "Treino de mira",
      steps: [{ exercise_id: seed.exercises[0].id, minutes: 10 }],
    },
  ];
  await page.goto("/");
  await page.evaluate(
    (data) => localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data)),
    data,
  );
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(
    page.getByRole("heading", { name: "Como você joga?" }),
  ).toBeVisible();
  await navigate(page, "Meu Dia");
  await expect(
    page.getByRole("heading", { name: "Meu Dia", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".menu-backdrop")).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "Começar meu treino" }).click();
  await page.getByRole("checkbox", { name: "Etapa concluída" }).check();
  await page.getByRole("button", { name: "Concluir e registrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu histórico, com contexto." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).sessions[0]
          .status,
    ),
  ).toBe("completed");
  await navigate(page, "Planejador");
  await expect(
    page.getByRole("button", { name: "Agenda", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await expect(page.locator(".calendar-grid.agenda .calendar-day")).toHaveCount(
    7,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("agenda.png"),
    fullPage: true,
  });
  await navigate(page, "Clutch Coach");
  await page.getByLabel("Sua mensagem").fill("Como foi minha última semana?");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.locator(".coach-turn").last()).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem("clutchfolio-preparation-demo:event", "private");
    localStorage.setItem("clutchfolio-coach-demo:demo", "private");
    sessionStorage.setItem("clutchfolio-session-demo:test", "private");
  });
  const toggle = page.getByRole("button", { name: "Abrir menu", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await page.locator('.sidebar-bottom a[href="/app/profile"]').click();
  await page
    .getByRole("button", { name: "Apagar dados da demonstração" })
    .click();
  await page.getByLabel("Confirmação", { exact: true }).fill("EXCLUIR");
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(
    page.getByRole("heading", { name: /Seu próximo nível/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter(
        (k) => k.startsWith("clutchfolio-") && k !== "clutchfolio-theme",
      ),
    ),
  ).toEqual([]);
});
test("critical public pages satisfy axe WCAG A/AA checks", async ({ page }) => {
  for (const path of ["/", "/library", "/news", "/competitive", "/auth"]) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});
test("mobile menu keyboard control, offline feedback and administrative restriction", async ({
  page,
}, testInfo) => {
  await page.goto("/library");
  await expect(page.locator("main h1")).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.locator(".mobile-menu")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Abrir menu" }),
    ).toBeFocused();
    await expect(page.locator(".sidebar")).toBeHidden();
  }
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  // Real online state changes, rather than a fake saved-status indicator.
  await page.context().setOffline(true);
  await expect(page.getByText(/Você está sem conexão/)).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByText(/Você está sem conexão/)).toBeHidden();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Bom ter você por aqui" }),
  ).toBeVisible();
});
