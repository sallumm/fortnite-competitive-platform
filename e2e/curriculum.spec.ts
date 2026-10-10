import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("progressive Academy: flexible prerequisites, Zero Build separation, sources and real activities", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/academy/curriculum");
  await expect(
    page.getByRole("status").filter({ hasText: "19 aulas curriculares" }),
  ).toBeVisible();
  await page.getByLabel("Modalidade de estudo").selectOption("zero");
  await expect(
    page.getByRole("link", {
      name: "Mats: madeira, pedra, metal e economia de construção",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByLabel("Nível de estudo").selectOption("5");
  await page
    .getByRole("link", {
      name: "VOD Review avançado: hipóteses, retenção e transferência",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Como avaliar o estudo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Você pode estudar fora da sequência", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Mind the gap — prática distribuída em MOBA",
      exact: true,
    }),
  ).toHaveAttribute("href", "https://pubmed.ncbi.nlm.nih.gov/36240151/");
  await page
    .getByRole("region", { name: "Percurso e avaliação da aula" })
    .getByRole("link", { name: "VOD Review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "VOD Review", exact: true }),
  ).toBeVisible();
  await page.goto("/academy/reload-retornos");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Reload / Trocação Reload: decisões com retornos",
      exact: true,
    }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page }).include("main").analyze();
  expect(
    audit.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact || ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: info.outputPath("reload-lesson.png"),
    fullPage: true,
  });
});
