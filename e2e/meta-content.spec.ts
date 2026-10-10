import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("public Meta details, combinable filters, history, safe reading and protected editorial route", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/competitive/meta");
  await page.getByLabel("Buscar no meta").fill("Tetris");
  const card = page
    .locator(".meta-record")
    .filter({ hasText: "Tetris Rift: retirada" });
  await card.getByRole("link", { name: "Abrir página detalhada" }).click();
  await expect(
    page.getByRole("heading", { name: "Tetris Rift: retirada" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fontes e limitações" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Inventário, recursos e tempestade" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao Meta", exact: true }).click();
  await page
    .getByText("Combinar filtros de modalidade, versão e equipe", {
      exact: true,
    })
    .click();
  await page
    .getByLabel("Filtrar construção", { exact: true })
    .selectOption("false");
  await page
    .getByLabel("Filtrar versão", { exact: true })
    .selectOption("br-42-4230");
  await expect(page.getByLabel("Contexto de consulta")).toHaveValue(
    "zero-4230",
  );
  await page.getByLabel("Buscar no meta").fill("");
  await expect(
    page.locator(".meta-record").filter({ hasText: "Sonic Power Sneakers" }),
  ).toHaveCount(0);
  await page.getByLabel("Filtrar equipe", { exact: true }).selectOption("trio");
  await expect(
    page.getByRole("heading", {
      name: "Ainda não há registros para este recorte",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.getByRole("button", { name: "Atualizações e histórico" }).click();
  await expect(page.getByLabel("Mostrar revisões históricas")).toBeChecked();
  const axe = await new AxeBuilder({ page }).include("main").analyze();
  expect(
    axe.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact || ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("meta-content.png"),
    fullPage: true,
  });
  await page.goto("/admin/meta");
  await expect(page).toHaveURL(/\/auth$/);
  await expect(
    page.getByRole("heading", { name: "Bom ter você por aqui" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
