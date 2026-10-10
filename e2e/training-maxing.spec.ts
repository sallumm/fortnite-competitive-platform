import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPlayer } from "../src/lib/seed";
test("mixed routine, repeated and private activities: save, schedule, run, recover, report and correct", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const data = demoPlayer();
  data.profile!.onboarded = true;
  await page.goto("/");
  await page.evaluate((data) => {
    localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data));
    localStorage.setItem("clutchfolio-demo-active", "true");
  }, data);
  await page.goto("/app/planner");
  await page.getByRole("button", { name: "Criar rotina", exact: true }).click();
  const d = page.getByRole("dialog");
  await d
    .getByLabel("Nome", { exact: true })
    .fill("Prática completa verificável");
  await d
    .getByLabel("Objetivo", { exact: true })
    .fill("Observar decisões e execução no mesmo protocolo.");
  for (const name of [
    "Freebuild",
    "Edit Course",
    "Piece Control",
    "Box Fight",
    "Zone Wars",
    "VOD Review",
    "Freebuild",
  ])
    await d
      .getByRole("combobox", { name: "Adicionar exercício", exact: true })
      .selectOption({ label: name });
  await d
    .getByRole("button", { name: "Atividade personalizada", exact: true })
    .click();
  await d.getByLabel("Nome da atividade").fill("Revisar comunicação");
  await d
    .getByLabel("Instruções da atividade")
    .fill("Revisar três decisões de comunicação da minha partida gravada.");
  await d
    .getByRole("button", { name: "Adicionar atividade", exact: true })
    .click();
  await expect(d.locator(".builder-step")).toHaveCount(8);
  await d.getByLabel("Minutos", { exact: true }).first().fill("5");
  await d.getByLabel("Bloco", { exact: true }).first().fill("Aquecimento");
  await d
    .getByLabel("Notas da etapa")
    .first()
    .fill("Observar controle das construções");
  await d
    .getByRole("button", { name: "Mover para baixo", exact: true })
    .first()
    .click();
  await expect(d.locator(".builder-step strong").first()).toContainText(
    "Edit Course",
  );
  await d.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(d.locator(".builder-step strong").first()).toContainText(
    "Freebuild",
  );
  const audit = await new AxeBuilder({ page }).include("dialog").analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("mixed-builder.png"),
    fullPage: true,
  });
  await d.getByRole("button", { name: "Salvar rotina", exact: true }).click();
  await expect(d).toBeHidden();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans[0],
  );
  expect(new Set(saved.steps.map((s: { id: string }) => s.id)).size).toBe(8);
  expect(saved.steps[0].exercise_id).toBe(saved.steps[6].exercise_id);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Prática completa verificável",
      exact: true,
    }),
  ).toBeVisible();
  const card = page.locator(".routine-card").filter({
    has: page.getByRole("heading", {
      name: "Prática completa verificável",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Agendar", exact: true }).click();
  const schedule = page.getByRole("dialog");
  await schedule.getByLabel(/Data e hor/).fill("2026-10-20T18:00");
  await schedule.getByRole("button", { name: /Salvar/ }).click();
  await expect(schedule).toBeHidden();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).schedules
          .length,
    ),
  ).toBe(1);
  await card.getByRole("button", { name: "Iniciar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Freebuild", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Observação ou erro recorrente")
    .fill("Interrupções observadas no freebuild");
  await page
    .getByRole("button", { name: "Próximo exercício", exact: true })
    .click();
  await page.getByLabel("segundos", { exact: true }).fill("45");
  await page
    .getByLabel("Configuração comparável (opcional)")
    .fill("percurso A / kbm / sens 6 / 60s");
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Edit Course", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("segundos", { exact: true })).toHaveValue("45");
  await expect(
    page.getByRole("button", { name: "Retomar", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Concluir e registrar", exact: true }),
  ).toBeDisabled();
  for (const check of await page
    .getByRole("checkbox", { name: "Etapa concluída", exact: true })
    .all())
    await check.check();
  await page
    .getByRole("button", { name: "Concluir e registrar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Seu histórico, com contexto.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Exportar meus dados", exact: true })
    .isVisible();
  await page
    .getByRole("link", {
      name: "Histórico detalhado e metas mensuráveis",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Training Center", exact: true }),
  ).toBeVisible();
  await page.locator(".training-history summary").click();
  await expect(
    page.getByText("Interrupções observadas no freebuild", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Corrigir resultado da etapa 2", exact: true })
    .click();
  const c = page.getByRole("dialog");
  await c.getByLabel("Valor registrado").fill("42");
  await c
    .getByRole("button", { name: "Confirmar correção", exact: true })
    .click();
  await expect(c).toBeHidden();
  await page
    .getByRole("combobox", { name: "Exercício da meta", exact: true })
    .selectOption({ label: "Edit Course" });
  await page.getByLabel("Valor inicial", { exact: true }).fill("50");
  await page.getByLabel("Resultado desejado", { exact: true }).fill("40");
  await page
    .getByLabel("Configuração comparável", { exact: true })
    .fill("percurso A / kbm / sens 6 / 60s");
  await page
    .getByRole("button", { name: "Salvar meta mensurável", exact: true })
    .click();
  await expect(
    page.getByText(/Último resultado comparável: 42 segundos/),
  ).toBeVisible();
  await page.reload();
  await page.locator(".training-history summary").click();
  await expect(page.getByText(/Resultado: 42 segundos/)).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include("#main").analyze()).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("training-history.png"),
    fullPage: true,
  });
  await page.goto("/app/planner");
  await page
    .getByRole("button", {
      name: "Editar Prática completa verificável",
      exact: true,
    })
    .click();
  await d.getByLabel("Minutos", { exact: true }).first().fill("7");
  await d.getByRole("button", { name: "Salvar rotina", exact: true }).click();
  await expect(d).toBeHidden();
  const final = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!),
  );
  expect(final.plans[0].steps[0].minutes).toBe(7);
  expect(final.sessions[0].steps[0].minutes).toBe(5);
  expect(final.sessions[0].results[1].value).toBe(42);
  expect(final.xp).toHaveLength(1);
  expect(errors).toEqual([]);
});
