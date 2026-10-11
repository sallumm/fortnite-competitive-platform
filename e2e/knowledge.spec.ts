import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPlayer } from "../src/lib/seed";
test("Fortnite Knowledge: grounded concepts, current-data refusal, privacy, reload and administrative restriction", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const d = demoPlayer();
  d.profile!.onboarded = true;
  await page.clock.setFixedTime(new Date("2026-10-11T01:00:00Z"));
  await page.goto("/");
  await page.evaluate((d) => {
    localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(d));
    localStorage.setItem("clutchfolio-demo-active", "true");
  }, d);
  await page.goto("/knowledge");
  await expect(
    page.getByRole("heading", { name: "Fortnite Knowledge", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Pergunta", exact: true })
    .fill("O que é Storm Surge?");
  await page
    .getByRole("button", { name: "Consultar conhecimento", exact: true })
    .click();
  const answer = page.getByRole("article", {
    name: "Resposta do Fortnite Knowledge",
  });
  await expect(answer).toContainText("quantidade de jogadores sobreviventes");
  await expect(answer).toContainText("Não é o dano normal");
  await expect(
    answer.getByRole("link", {
      name: "Epic Games · explicação histórica de Storm Surge",
    }),
  ).toHaveAttribute("href", /fortnite-chapter-3-season-3/);
  await page
    .getByRole("textbox", { name: "Pergunta", exact: true })
    .fill("Como funciona a FNCS atual?");
  await page
    .getByRole("button", { name: "Consultar conhecimento", exact: true })
    .click();
  await expect(answer).toContainText(
    "Não disponho de informação atual verificada",
  );
  await page
    .getByRole("textbox", { name: "Pergunta", exact: true })
    .fill("Qual a capital da França?");
  await page
    .getByRole("button", { name: "Consultar conhecimento", exact: true })
    .click();
  await expect(answer).toContainText("Sou especializado em Fortnite");
  await page
    .getByRole("textbox", { name: "Pergunta", exact: true })
    .fill("Qual a diferença entre Box Fight e Realistic?");
  await page
    .getByRole("button", { name: "Consultar conhecimento", exact: true })
    .click();
  await expect(answer).toContainText("Box Fight");
  await expect(answer).toContainText("Realistic");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("knowledge.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Resposta do Fortnite Knowledge" }),
  ).toHaveCount(0);
  await page.goto("/admin/ai");
  await expect(
    page.getByRole("heading", { name: "Acesso administrativo restrito" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
