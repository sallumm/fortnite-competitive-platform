import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPlayer } from "../src/lib/seed";
test("Academy study persists, advanced access stays open, and a lesson creates a real executable routine", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const data = demoPlayer();
  data.profile!.onboarded = true;
  await page.evaluate((d) => {
    localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(d));
    localStorage.setItem("clutchfolio-demo-active", "true");
  }, data);
  await page.goto("/academy");
  await page.getByLabel("O que você quer estudar?").selectOption("beginner");
  await page.getByRole("link", { name: /Próxima sugestão:/ }).click();
  await expect(
    page.getByRole("heading", { name: "Meu estudo", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Iniciar estudo", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "Ser a última pessoa ou equipe sobrevivente." })
    .check();
  await page
    .getByRole("button", { name: "Registrar avaliação", exact: true })
    .click();
  await expect(
    page.getByText("Resposta correta.", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Minha anotação")
    .fill("Revisar sobrevivência e escolha de luta.");
  await page
    .getByRole("button", { name: "Salvar anotação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Concluir estudo", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Minha anotação")).toHaveValue(
    "Revisar sobrevivência e escolha de luta.",
  );
  await page.goto("/academy/vod-hipoteses");
  await page
    .getByRole("button", { name: "Criar rotina editável desta aula" })
    .click();
  await expect(page).toHaveURL(/\/app\/planner/);
  const card = page
    .locator(".routine-card")
    .filter({ hasText: "Estudo: VOD Review avançado" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Agendar", exact: true }).click();
  const schedule = page.getByRole("dialog");
  await schedule.getByLabel(/Data e hor/).fill("2026-10-20T18:00");
  await schedule.getByRole("button", { name: /Salvar/ }).click();
  await expect(schedule).toBeHidden();
  await card.getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "VOD Review", exact: true }),
  ).toBeVisible();
  for (const c of await page
    .getByRole("checkbox", { name: "Etapa concluída", exact: true })
    .all())
    await c.check();
  await page
    .getByRole("button", { name: "Concluir e registrar", exact: true })
    .click();
  await expect(page).toHaveURL(/reports/);
  await page.goto("/academy");
  await expect(
    page.getByText(/1 de 19 aulas com estudo concluído/),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page }).include("main").analyze();
  expect(
    audit.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: info.outputPath("academy-study.png"),
    fullPage: true,
  });
});
