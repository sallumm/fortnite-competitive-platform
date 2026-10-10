import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPlayer } from "../src/lib/seed";
async function start(page: import("@playwright/test").Page) {
  const d = demoPlayer();
  d.profile!.onboarded = true;
  d.profile!.level = "beginner";
  await page.goto("/");
  await page.evaluate((d) => {
    localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(d));
    localStorage.setItem("clutchfolio-demo-active", "true");
  }, d);
  await page.goto("/app/evolution-plan");
  await expect(
    page.getByRole("heading", {
      name: "Criar meu plano de evolução",
      exact: true,
    }),
  ).toBeVisible();
}
test("assisted multi-skill week: preview, edit, explicit approval, execution, recovery and reports", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page
    .getByRole("checkbox", { name: "Controle de peças", exact: true })
    .check();
  await page.getByRole("checkbox", { name: "Zone Wars", exact: true }).check();
  await page
    .getByRole("button", { name: "Continuar etapa", exact: true })
    .click();
  for (const [day, time, end, minutes] of [
    ["Segunda", "17:00", "18:00", "30"],
    ["Quarta", "18:00", "19:30", "45"],
    ["Sábado", "14:00", "16:00", "60"],
  ]) {
    await page
      .getByRole("button", {
        name: `Adicionar intervalo · ${day}`,
        exact: true,
      })
      .click();
    await page.getByLabel(`Início · ${day}`, { exact: true }).fill(time);
    await page.getByLabel(`Fim · ${day}`, { exact: true }).fill(end);
    await page
      .getByLabel(`Minutos de treino · ${day}`, { exact: true })
      .fill(minutes);
  }
  await page
    .getByRole("button", { name: "Continuar etapa", exact: true })
    .click();
  await page.getByLabel("Segunda-feira de início").fill("2026-10-12");
  await page
    .getByRole("button", { name: "Gerar prévia explicada", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Prévia do meu plano de evolução" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).series.length,
    ),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Editar exercícios · 2026-10-12" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Minutos", { exact: true }).first().fill("5");
  await dialog
    .getByRole("button", { name: "Duplicar etapa", exact: true })
    .first()
    .click();
  await dialog
    .getByRole("button", { name: "Atividade personalizada", exact: true })
    .click();
  await dialog.getByLabel("Nome da atividade").fill("Revisão pessoal");
  await dialog
    .getByLabel("Instruções da atividade")
    .fill("Revisar uma decisão da partida e registrar uma alternativa.");
  await dialog
    .getByRole("button", { name: "Adicionar atividade", exact: true })
    .click();
  for (const field of await dialog.getByLabel("Minutos", { exact: true }).all())
    await field.fill("5");
  await dialog
    .getByRole("button", { name: "Salvar rotina", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page
    .getByRole("button", { name: "Revisar confirmação de agenda", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancelar confirmação", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans.length,
    ),
  ).toBe(0);
  const axe = await new AxeBuilder({ page })
    .include(".evolution-planner")
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("evolution-preview.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Revisar confirmação de agenda", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Confirmar e salvar plano na agenda",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/app\/planner$/);
  let saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!),
  );
  expect(saved.plans).toHaveLength(3);
  expect(saved.series).toHaveLength(3);
  await page.reload();
  await expect(page.locator(".routine-card")).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await page
      .locator(".routine-card")
      .nth(i)
      .getByRole("button", { name: "Iniciar", exact: true })
      .click();
    await expect(
      page.getByLabel("Observação ou erro recorrente"),
    ).toBeVisible();
    await page
      .getByLabel("Observação ou erro recorrente")
      .fill("Observar decisões e registrar alternativa");
    await page
      .getByRole("spinbutton")
      .first()
      .fill(String(5 + i));
    await page
      .getByLabel("Configuração comparável (opcional)")
      .fill(
        "cenário A / kbm / mesma arma / sensibilidade declarada / teste 60s",
      );
    if (i === 0) {
      await page.getByRole("button", { name: "Pausar", exact: true }).click();
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Retomar", exact: true }),
      ).toBeVisible();
    }
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
    await page.goto("/app/planner");
    await expect(page.locator(".routine-card")).toHaveCount(3);
  }
  saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!),
  );
  expect(
    saved.sessions.filter((s: { status: string }) => s.status === "completed"),
  ).toHaveLength(3);
  expect(
    saved.sessions.every((s: { results: { value: number | null }[] }) =>
      s.results.some((r) => typeof r.value === "number"),
    ),
  ).toBe(true);
  await page.goto("/app/reports");
  await expect(
    page.getByRole("heading", {
      name: "Seu histórico, com contexto.",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/app/evolution-plan");
  await page.getByLabel("Início do período de revisão").fill("2026-10-10");
  await expect(
    page.getByText("3 sessões concluídas neste período.", { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("Zero Build controller with reduced availability never generates construction exercises", async ({
  page,
}) => {
  await start(page);
  await page.getByLabel("Modalidade do plano").selectOption("zero");
  await page.getByLabel("Dispositivo do plano").selectOption("controller");
  await page
    .getByRole("checkbox", { name: "Construção Zero: mira", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Uso de cobertura", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Continuar etapa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adicionar intervalo · Segunda", exact: true })
    .click();
  await page
    .getByLabel("Minutos de treino · Segunda", { exact: true })
    .fill("10");
  await page
    .getByRole("button", { name: "Continuar etapa", exact: true })
    .click();
  await page.getByLabel("Segunda-feira de início").fill("2026-10-12");
  await page
    .getByRole("button", { name: "Gerar prévia explicada", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Prévia do meu plano de evolução" }),
  ).toBeVisible();
  await expect(page.locator(".evolution-preview")).toContainText("10 minutos");
  await expect(page.locator(".evolution-preview")).not.toContainText(
    "Freebuild",
  );
  await expect(
    page.getByRole("button", {
      name: "Revisar confirmação de agenda",
      exact: true,
    }),
  ).toBeEnabled();
});
