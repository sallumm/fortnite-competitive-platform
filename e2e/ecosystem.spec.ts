import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPlayer, seed } from "../src/lib/seed";

test("beginner ecosystem: onboarding, study, exercise intent, confirmed schedule, execution, evidence and reload", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date("2026-10-11T01:00:00Z"));
  await page.goto("/auth");
  await expect(page.getByText(/Contas ainda não foram ativadas/)).toBeVisible();
  await page.getByRole("button", { name: "Explorar sem cadastro" }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Como podemos chamar você?").fill("Jogador iniciante");
  await page
    .getByRole("button", { name: "Criar meu plano", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Meu Dia", exact: true }),
  ).toBeVisible();
  await page.goto("/academy/pecas-edicao");
  await page
    .getByRole("button", { name: "Concluir estudo", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Estudo concluído. Registro salvo." }),
  ).toBeVisible();
  await page.goto("/app");
  await page.screenshot({
    path: info.outputPath("development-ecosystem-dark.png"),
    fullPage: true,
  });
  const overview = page.getByRole("region", {
    name: "Meu desenvolvimento integrado",
  });
  await expect(
    overview.getByText(/1 de \d+ aulas com estudo registrado/),
  ).toBeVisible();
  await expect(
    overview.getByText(/Ainda não há resultados comparáveis suficientes/),
  ).toBeVisible();
  const e = seed.exercises.find((e) => e.title === "Edit Course")!;
  await page.goto(`/library/${e.id}`);
  await expect(
    page.getByRole("region", { name: "Aulas relacionadas ao exercício" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Adicionar a uma rotina", exact: true })
    .click();
  const builder = page.getByRole("dialog");
  await expect(builder.getByLabel("Nome", { exact: true })).toHaveValue(
    "Prática: Edit Course",
  );
  await expect(builder.getByText(/1\. Edit Course/)).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans.some(
        (p: { title: string }) => p.title === "Prática: Edit Course",
      ),
    ),
  ).toBe(false);
  await builder
    .getByRole("button", { name: "Salvar rotina", exact: true })
    .click();
  const card = page.locator(".routine-card").filter({
    has: page.getByRole("heading", {
      name: "Prática: Edit Course",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Agendar", exact: true }).click();
  const schedule = page.getByRole("dialog");
  await schedule.getByLabel(/Data e hor/).fill("2026-10-12T18:00");
  await schedule.getByRole("button", { name: /Salvar/ }).click();
  await expect(schedule).toBeHidden();
  await card.getByRole("button", { name: "Iniciar", exact: true }).click();
  await page.getByLabel("segundos", { exact: true }).fill("45");
  await page
    .getByLabel("Configuração comparável (opcional)")
    .fill("percurso fixo / kbm");
  await page
    .getByLabel("Observação ou erro recorrente")
    .fill("Preciso revisar o reset");
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("segundos", { exact: true })).toHaveValue("45");
  await page
    .getByRole("checkbox", { name: "Etapa concluída", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Concluir e registrar", exact: true })
    .click();
  const learning = page.getByRole("region", {
    name: "Estudo e prática no período",
  });
  await expect(
    learning.getByText(/1 aulas com conclusão ou revisão declarada/),
  ).toBeVisible();
  await page.goto("/app/training");
  await page.getByText(/^Prática: Edit Course ·/).click();
  await expect(page.getByText(/Resultado: 45 segundos/)).toBeVisible();
  await page.goto("/app");
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await overview
    .getByText("Ferramentas para cada etapa do seu desenvolvimento")
    .click();
  const audit = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("development-ecosystem-light.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(
    overview.getByText(/1 de \d+ aulas com estudo registrado/),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!),
  );
  expect(stored.sessions[0].results[0].value).toBe(45);
  expect(stored.schedules).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("Zero Build intent survives onboarding, cross-mode exercises are rejected and advanced content stays accessible", async ({
  page,
}) => {
  const d = demoPlayer();
  d.profile!.mode = "zero";
  d.profile!.onboarded = false;
  await page.goto("/");
  await page.evaluate((d) => {
    localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(d));
    localStorage.setItem("clutchfolio-demo-active", "true");
  }, d);
  const e = seed.exercises.find((e) => e.title === "Edit Course")!;
  await page.goto(`/app/planner?exercise=${e.id}`);
  await expect(page).toHaveURL(/onboarding/);
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Criar meu plano", exact: true })
    .click();
  await expect(page).toHaveURL(/app\/planner/);
  await expect(
    page.getByText(/Este exercício está indisponível ou não corresponde/),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/academy/vod-hipoteses");
  await expect(
    page.getByRole("heading", { name: "Meu estudo", exact: true }),
  ).toBeVisible();
  await page.goto("/app");
  await page
    .getByText("Ferramentas para cada etapa do seu desenvolvimento")
    .click();
  await expect(
    page.getByRole("link", { name: "Entender com Knowledge" }),
  ).toHaveAttribute("href", "/knowledge");
  await expect(
    page.getByRole("link", { name: "Criar plano de evolução", exact: true }),
  ).toHaveAttribute("href", "/app/evolution-plan");
});
