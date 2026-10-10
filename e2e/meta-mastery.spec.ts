import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPlayer } from "../src/lib/seed";
async function start(page: import("@playwright/test").Page) {
  const d = demoPlayer();
  d.profile!.onboarded = true;
  d.plans = [];
  d.sessions = [];
  d.series = [];
  d.schedules = [];
  await page.clock.setFixedTime(new Date("2026-10-10T23:00:00Z"));
  await page.goto("/");
  await page.evaluate((d) => {
    localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(d));
    localStorage.setItem("clutchfolio-demo-active", "true");
  }, d);
  await page.goto("/app/meta-training");
  await expect(
    page.getByRole("heading", { name: "Meta Training Center", exact: true }),
  ).toBeVisible();
}
test("meta profile, mixed routine persistence, manual VOD context and grounded rules coach", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page
    .getByLabel("Versão e contexto verificados")
    .selectOption("br-4230");
  await page
    .getByRole("button", { name: "Salvar perfil competitivo", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Versão e contexto verificados")).toHaveValue(
    "br-4230",
  );
  await page
    .getByRole("button", { name: "Adicionar à rotina", exact: true })
    .nth(0)
    .click();
  await page
    .getByRole("button", { name: "Adicionar à rotina", exact: true })
    .nth(0)
    .click();
  await page
    .getByRole("button", { name: "Adicionar à rotina", exact: true })
    .nth(1)
    .click();
  await expect(
    page.getByRole("heading", { name: "Minha seleção · 3 etapa(s)" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar e salvar rotina", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Nome", { exact: true })
    .fill("Prática contextual verificada");
  await dialog
    .getByRole("button", { name: "Salvar rotina", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans[0],
  );
  expect(saved.steps).toHaveLength(3);
  expect(saved.steps[0].exercise_id).toBe(saved.steps[1].exercise_id);
  expect(saved.game_context.context_id).toBe("br-4230");
  expect(saved.game_context.entries.length).toBeGreaterThan(0);
  const axe = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/meta-training-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/app/vod");
  await page
    .getByRole("button", { name: /Criar revisão|Nova revisão/ })
    .click();
  const vod = page.getByRole("dialog");
  await vod
    .getByLabel("Nome da partida ou revisão")
    .fill("Observações do mapa");
  await vod
    .getByLabel("Contexto do jogo e regulamento")
    .selectOption("br-4230");
  await vod.getByRole("button", { name: /Salvar revisão/ }).click();
  await expect(vod).not.toBeVisible();
  await page.reload();
  const reviews = await page.evaluate(
    () => JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).vodReviews,
  );
  expect(reviews[0].game_context.patch).toBe("42.30");
  await page.goto("/app/coach?meta_context=br-4230&q=temporada");
  await page
    .getByRole("button", { name: "Enviar mensagem", exact: true })
    .click();
  await expect(
    page.getByText("Meta verificado · contexto br-4230", { exact: true }),
  ).toBeVisible();
  await page.getByText("Contexto e referências", { exact: true }).click();
  await expect(page.locator('a[href*="fortnite.com"]').last()).toBeVisible();
  expect(errors).toEqual([]);
});
test("team consent is not simulated in demo and kyrven preserves internal storage", async ({
  page,
}) => {
  await start(page);
  await page.goto("/app/teams");
  await expect(
    page.getByRole("heading", {
      name: "Equipes exigem contas autenticadas",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gerar convite privado", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".brand").first()).toContainText("kyrven");
  await expect(page).toHaveTitle(/kyrven/);
  expect(
    await page.evaluate(() => localStorage.getItem("clutchfolio-demo-v1")),
  ).not.toBeNull();
});
