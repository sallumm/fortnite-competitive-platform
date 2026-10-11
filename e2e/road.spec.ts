import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPlayer } from "../src/lib/seed";
async function start(page: import("@playwright/test").Page, mode = "build") {
  const d = demoPlayer();
  d.profile!.onboarded = true;
  d.profile!.mode = mode as "build" | "zero";
  d.profile!.level = "beginner";
  d.plans = [];
  d.sessions = [];
  d.series = [];
  d.schedules = [];
  d.exceptions = [];
  await page.clock.setFixedTime(new Date("2026-10-10T23:00:00Z"));
  await page.goto("/");
  await page.evaluate((d) => {
    localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(d));
    localStorage.setItem("clutchfolio-demo-active", "true");
  }, d);
  await page.goto("/app/road");
  await expect(
    page.getByRole("heading", { name: "Road to Competitive", exact: true }),
  ).toBeVisible();
}
async function create(
  page: import("@playwright/test").Page,
  mode: "build" | "zero",
) {
  await page
    .getByRole("button", { name: "Criar minha jornada", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Modalidade da jornada").selectOption(mode);
  await d
    .getByLabel("Meu objetivo", { exact: true })
    .fill("Entender o jogo e registrar uma prática comparável");
  await d.getByRole("button", { name: "Continuar", exact: true }).click();
  await d
    .getByRole("button", { name: "Adicionar intervalo · Segunda", exact: true })
    .click();
  await d.getByLabel("Minutos de treino · Segunda", { exact: true }).fill("5");
  await d.getByRole("button", { name: "Continuar", exact: true }).click();
  await d
    .getByRole("button", { name: "Confirmar criação da jornada", exact: true })
    .click();
  await expect(d).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Meu ciclo de aprendizagem" }),
  ).toBeVisible();
}
test("beginner cycle: lesson, assessment, pause, availability, confirmed practice, recovery and final report", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await create(page, "build");
  await page
    .getByRole("button", {
      name: "Primeira partida: objetivo, lobby e modalidades",
      exact: true,
    })
    .click();
  let d = page.getByRole("dialog");
  await d.getByRole("radio").first().check();
  await d
    .getByRole("button", {
      name: "Registrar avaliação de conceitos",
      exact: true,
    })
    .click();
  await d
    .getByLabel("Observação ou dificuldade (opcional)")
    .fill("Ainda preciso compreender rotação");
  await d
    .getByRole("button", { name: "Marcar estudo concluído", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "1 de" }),
  ).toBeVisible();
  await d.getByRole("button", { name: "Fechar janela" }).click();
  await page
    .getByRole("button", { name: "Pausar jornada", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retomar jornada", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retomar jornada", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retomar jornada", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Ajustar objetivo e disponibilidade",
      exact: true,
    })
    .click();
  d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Continuar", exact: true }).click();
  await d.getByLabel("Início · Segunda", { exact: true }).fill("18:00");
  await d.getByLabel("Fim · Segunda", { exact: true }).fill("19:00");
  await d.getByRole("button", { name: "Continuar", exact: true }).click();
  await d
    .getByRole("button", {
      name: "Salvar preferências da jornada",
      exact: true,
    })
    .click();
  await expect(d).toBeHidden();
  await page.getByLabel("Segunda-feira da semana").fill("2026-10-12");
  await page
    .getByRole("button", { name: "Gerar prévia desta semana", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Prévia do meu plano de evolução" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans.length,
    ),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Revisar confirmação de agenda", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d
    .getByRole("button", {
      name: "Confirmar e agendar esta semana",
      exact: true,
    })
    .click();
  await expect(d).toBeHidden();
  await page.reload();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!),
  );
  expect(stored.plans).toHaveLength(1);
  expect(stored.series).toHaveLength(1);
  expect(stored.series[0].local_time).toBe("18:00");
  expect(stored.plans[0].learning_journey_id).toBeTruthy();
  await page.getByRole("button", { name: /^Iniciar · Road/ }).click();
  await expect(page).toHaveURL(/\/app\/session\//);
  await page
    .locator('input[type="number"][placeholder="Opcional"]')
    .first()
    .fill("5");
  await page
    .getByLabel("Configuração comparável (opcional)")
    .fill("primeiro cenário / kbm / mesma configuração");
  await page
    .getByLabel("Observação ou erro recorrente")
    .fill("Primeira tentativa: acompanhar alvo");
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Observação ou erro recorrente")).toHaveValue(
    "Primeira tentativa: acompanhar alvo",
  );
  for (const check of await page
    .getByRole("checkbox", { name: "Etapa concluída", exact: true })
    .all())
    await check.check();
  await page
    .getByRole("button", { name: "Concluir e registrar", exact: true })
    .click();
  await page.goto("/app/road");
  const executed = await page.evaluate(
    () => JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).sessions[0],
  );
  expect(executed.results[0].value).toBe(5);
  expect(executed.learning_journey_id).toBeTruthy();
  await expect(
    page.getByText("1 sessões concluídas · 0 interrompidas", { exact: false }),
  ).toBeVisible();
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
    path: info.outputPath("road-cycle.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Encerrar ciclo e consultar relatório",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Confirmar encerramento do ciclo",
      exact: true,
    })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Criar próximo ciclo com minhas preferências",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Relatório do meu ciclo" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("Zero Build low availability keeps an independent path and preserves skip/review without skill claims", async ({
  page,
}, info) => {
  await start(page, "zero");
  await create(page, "zero");
  await expect(
    page.getByRole("button", {
      name: "Construção Zero: cobertura, mobilidade e recursos",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Peças, edição e reset: a base da construção",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Primeira partida: objetivo, lobby e modalidades",
      exact: true,
    })
    .click();
  const d = page.getByRole("dialog");
  await d
    .getByRole("button", { name: "Pular conteúdo que já conheço", exact: true })
    .click();
  await d
    .getByRole("button", { name: "Registrar nova revisão", exact: true })
    .click();
  await d.getByRole("button", { name: "Fechar janela" }).click();
  await page.reload();
  await page.getByLabel("Segunda-feira da semana").fill("2026-10-12");
  await page
    .getByRole("button", { name: "Gerar prévia desta semana", exact: true })
    .click();
  const road = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("clutchfolio-road-demo-v1")!),
  );
  expect(road.journeys[0].config.mode).toBe("zero");
  expect(
    road.events.some((e: { action: string }) => e.action === "skipped"),
  ).toBe(true);
  expect(
    road.events.some((e: { action: string }) => e.action === "reviewed"),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans.length,
    ),
  ).toBe(0);
  await page.screenshot({
    path: info.outputPath("road-zero-preview.png"),
    fullPage: true,
  });
});
