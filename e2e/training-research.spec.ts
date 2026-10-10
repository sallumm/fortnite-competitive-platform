import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPlayer } from "../src/lib/seed";
test("research to real builder: taxonomy, evidence, preview, persist and edit", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/academy/research");
  await expect(
    page.getByRole("heading", { name: "Entenda o que você está treinando." }),
  ).toBeVisible();
  await page.getByLabel("Modalidade da habilidade").selectOption("zero");
  await expect(
    page.getByRole("heading", { name: "Freebuild", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Buscar competência").fill("rotacao");
  await expect(
    page.getByRole("heading", {
      name: "Construção Zero: rotação",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Modalidade da habilidade").selectOption("build");
  await page.getByLabel("Buscar competência").fill("Freebuild");
  await page
    .getByRole("link", { name: "Encontrar exercícios relacionados" })
    .click();
  await expect(page.getByText("1 exercícios", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Freebuild", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Como avaliar esta prática" }),
  ).toBeVisible();
  await expect(
    page.getByText("Metadados revisados", { exact: false }),
  ).toBeVisible();
  await page.goto("/academy/research?view=sources");
  await expect(
    page.getByText("Conteúdo não consultável nesta pesquisa.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#spacing")).toContainText("Outro jogo");
  const data = demoPlayer();
  data.profile!.onboarded = true;
  await page.evaluate((data) => {
    localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data));
    localStorage.setItem("clutchfolio-demo-active", "true");
  }, data);
  await page.goto("/academy/research?view=paths");
  await page.getByLabel("Minutos iniciais por etapa").fill("4");
  await page
    .getByRole("button", { name: "Revisar no construtor", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".builder-step")).toHaveCount(4);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans.length,
    ),
  ).toBe(0);
  await dialog
    .getByLabel("Nome", { exact: true })
    .fill("Trilha revisada por mim");
  await dialog
    .getByRole("button", { name: "Salvar rotina", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.goto("/app/planner");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Trilha revisada por mim", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans[0],
  );
  expect(saved.steps).toHaveLength(4);
  expect(saved.steps.every((s: { minutes: number }) => s.minutes === 4)).toBe(
    true,
  );
  await page.goto("/academy/research?view=method");
  expect(
    (await new AxeBuilder({ page }).include("main").analyze()).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("research-methodology.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
