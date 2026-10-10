import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("meta contextual: verified sources, historical comparison, mode isolation and training links", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/competitive/meta");
  await expect(
    page.getByRole("heading", { name: "Meta com contexto." }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "registros neste contexto" }),
  ).toBeVisible();
  await page.getByLabel("Buscar no meta").fill("Tetris");
  const record = page
    .locator(".meta-record")
    .filter({ hasText: "Tetris Rift: retirada" });
  await expect(record).toBeVisible();
  await record
    .getByText("Fontes, limites e treinamento", { exact: true })
    .click();
  await expect(
    record.getByRole("link", {
      name: "Fortnite: Pesadelos — notas da equipe Epic",
    }),
  ).toBeVisible();
  await expect(
    record.getByRole("link", {
      name: "Inventário, recursos e tempestade",
    }),
  ).toBeVisible();
  await page
    .getByLabel("Comparar com", { exact: true })
    .selectOption("br-4200");
  await expect(
    page.getByText("Ausência de registro significa lacuna editorial", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByLabel("Contexto de consulta").selectOption("victory-br");
  await page.getByLabel("Buscar no meta").fill("Bonerattler");
  await expect(
    page.locator(".meta-record").getByText("Não confirmado", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Contexto de consulta").selectOption("zero-4230");
  await page.getByLabel("Buscar no meta").fill("");
  await expect(
    page
      .locator(".meta-record")
      .getByText("Itens de bolso: revisão necessária", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".meta-record")
      .getByText("Sonic Power Sneakers", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  const axe = await new AxeBuilder({ page }).include("main").analyze();
  expect(
    axe.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact || ""),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("meta-zero.png"),
    fullPage: true,
  });
});
