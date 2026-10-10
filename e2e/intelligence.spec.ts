import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPlayer, seed, uid } from "../src/lib/seed";
import { trainingCatalog } from "../src/lib/training-catalog";
import type { Training } from "../src/lib/types";
test("evolution evidence, confirmed suggestion, VOD markers, goal lifecycle, weekly snapshots and persistence", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const data = demoPlayer();
  data.profile!.onboarded = true;
  const exercise = trainingCatalog.find((e) => e.title === "Smooth Tracking")!;
  const planId = uid(9200);
  data.plans = [
    {
      id: planId,
      user_id: "demo",
      title: "Tracking para avaliar",
      steps: [{ id: uid(9201), exercise_id: exercise.id, minutes: 5 }],
      mode: "both",
    },
  ];
  data.sessions = [65, 72, 68].map((value, i) => {
    const stamp = new Date(Date.now() - (4 - i) * 864e5).toISOString();
    return {
      id: uid(9210 + i),
      user_id: "demo",
      plan_id: planId,
      title: "Benchmark anterior (demonstração)",
      started_at: stamp,
      completed_at: stamp,
      duration_seconds: 60,
      status: "completed",
      xp: 0,
      steps: [
        { id: uid(9215 + i), exercise_id: exercise.id, minutes: 5, exercise },
      ],
      results: [
        {
          exercise_id: exercise.id,
          step_id: uid(9215 + i),
          value,
          note: "",
          status: "completed",
          unit: exercise.measurement!.unit,
          version: exercise.measurement!.version,
          configuration: "alvo fixo",
        },
      ],
    } as Training;
  });
  data.bookmarks = [
    {
      id: uid(9220),
      user_id: "demo",
      kind: "tournament",
      target_id: seed.tournaments[0].id,
    },
  ];
  await page.goto("/");
  await page.evaluate((data) => {
    localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data));
    localStorage.setItem("clutchfolio-demo-active", "true");
  }, data);
  await page.goto("/app/evolution");
  await expect(
    page.getByRole("heading", { name: "Minha Evolução", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Smooth Tracking: oscilação observada", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: seed.tournaments[0].title, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator("main").getByText(seed.tournaments[0].title, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Habilidade prioritária", exact: true })
    .selectOption("tracking");
  await page
    .getByRole("button", { name: "Salvar habilidade prioritária", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!)
            .planningPreferences[0]?.primary_skill,
      ),
    )
    .toBe("tracking");
  await page
    .getByRole("button", {
      name: "Propor rotina com Smooth Tracking",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans.length,
    ),
  ).toBe(1);
  await page
    .getByRole("button", { name: "Descartar proposta", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans.length,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Criar meta", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Nome da meta", { exact: true })
    .fill("Tracking no mesmo cenário");
  await dialog
    .getByRole("textbox", { name: "Critério de conclusão", exact: true })
    .fill("Comparar testes do mesmo cenário e protocolo");
  await dialog
    .getByRole("checkbox", { name: "Smooth Tracking", exact: true })
    .check();
  await dialog
    .getByRole("combobox", { name: "Habilidade da meta", exact: true })
    .selectOption("tracking");
  await dialog
    .getByRole("checkbox", {
      name: "Acompanhar um protocolo numérico",
      exact: true,
    })
    .check();
  await dialog
    .getByRole("combobox", { name: "Protocolo da meta", exact: true })
    .selectOption(exercise.id);
  await dialog.getByLabel("Valor inicial da meta", { exact: true }).fill("65");
  await dialog.getByLabel("Alvo da meta", { exact: true }).fill("75");
  await dialog
    .getByLabel("Cenário e configuração da meta", { exact: true })
    .fill("alvo fixo");
  await dialog
    .getByRole("button", { name: "Salvar meta", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Pausar meta", exact: true }).click();
  await expect(page.getByText("Pausada", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retomar meta", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Tracking no mesmo cenário",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Editar meta Tracking no mesmo cenário",
      exact: true,
    })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Critério de conclusão", exact: true })
    .fill("Registrar comparação sem inferir habilidade geral");
  await dialog
    .getByRole("button", { name: "Salvar meta", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.goto("/app/planner");
  const card = page.locator(".routine-card").filter({
    has: page.getByRole("heading", {
      name: "Tracking para avaliar",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Agendar", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Data e hor/).fill("2026-10-20T18:00");
  await dialog.getByRole("button", { name: /Salvar/ }).click();
  await expect(dialog).toBeHidden();
  await card.getByRole("button", { name: "Iniciar", exact: true }).click();
  await page
    .getByText("Como quero organizar esta sessão? (opcional)", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Energia percebida", exact: true })
    .selectOption("2");
  await page
    .getByRole("combobox", { name: "Preferência de sessão", exact: true })
    .selectOption("light");
  await page
    .getByRole("button", { name: "Salvar preferência da sessão", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).readiness
            .length,
      ),
    )
    .toBe(1);
  await page.getByLabel("Precisão (%)", { exact: true }).fill("78");
  await page.getByLabel("Configuração comparável (opcional)").fill("alvo fixo");
  await page
    .getByRole("checkbox", { name: "Etapa concluída", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Concluir e registrar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Seu histórico, com contexto.",
      exact: true,
    }),
  ).toBeVisible();
  const session = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).sessions.find(
        (s: { title: string }) => s.title === "Tracking para avaliar",
      ).id,
  );
  await page.goto("/app/journal/" + session);
  await page
    .getByLabel("Em que tive dificuldade?", { exact: true })
    .fill("Perdi o alvo após mudança de direção");
  await page.getByRole("checkbox", { name: "Tracking", exact: true }).check();
  await page
    .getByRole("button", { name: "Salvar diário", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).journals
            .length,
      ),
    )
    .toBe(1);
  await page.goto("/app/vod");
  await page
    .getByRole("button", { name: "Criar revisão de VOD", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Nome da partida ou revisão", { exact: true })
    .fill("Revisão de rotações");
  await dialog
    .getByLabel("Observações da revisão", { exact: true })
    .fill("Revisão manual da decisão antes da zona");
  await dialog
    .getByRole("combobox", { name: "Competição da revisão", exact: true })
    .selectOption(seed.tournaments[0].id);
  await dialog.getByLabel("Timestamp em segundos", { exact: true }).fill("45");
  await dialog
    .getByRole("combobox", { name: "Situação do marcador", exact: true })
    .selectOption("rotations");
  await dialog
    .getByRole("combobox", { name: "Tipo de observação", exact: true })
    .selectOption("mistake");
  await dialog
    .getByLabel("Observação do marcador", { exact: true })
    .fill("Rotação começou após fechar a zona");
  await dialog
    .getByRole("combobox", { name: "Habilidade do marcador", exact: true })
    .selectOption("rotations");
  await dialog
    .getByRole("button", { name: "Registrar marcador", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Salvar revisão de VOD", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Revisão de rotações", exact: true }),
  ).toBeVisible();
  await page
    .getByText("Consultar marcadores e decisões", { exact: true })
    .click();
  await expect(
    page.getByText("Rotação começou após fechar a zona", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Editar revisão Revisão de rotações",
      exact: true,
    })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Editar marcador 0:45", exact: true })
    .click();
  await dialog.getByLabel("Timestamp em segundos", { exact: true }).fill("90");
  await dialog
    .getByRole("button", { name: "Salvar revisão de VOD", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.reload();
  expect(
    (await new AxeBuilder({ page }).include("main").analyze()).violations,
  ).toEqual([]);
  await page.goto("/app/week");
  await page
    .getByRole("button", { name: "Gerar meu resumo", exact: true })
    .click();
  await expect(page.getByText(/RESUMO SALVO/)).toBeVisible();
  await expect(
    page.getByText(/Revisões manuais de VOD no período: 1/),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(/RESUMO SALVO/)).toBeVisible();
  await page
    .getByRole("button", { name: "Semana anterior", exact: true })
    .click();
  await expect(
    page.getByText("PRÉVIA COM REGISTROS ATUAIS", { exact: true }),
  ).toBeVisible();
  await page.goto("/app/evolution");
  await page
    .getByRole("button", { name: "Concluir meta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Arquivar meta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Tracking no mesmo cenário",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Mostrar metas arquivadas", exact: true })
    .check();
  await expect(
    page.getByRole("heading", {
      name: "Tracking no mesmo cenário",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include("main").analyze()).violations,
  ).toEqual([]);
  await page.locator("main").focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("evolution.png") });
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!),
  );
  expect(persisted.goalRevisions).toHaveLength(6);
  expect(persisted.goals[0]).toMatchObject({
    status: "archived",
    completed: true,
  });
  expect(persisted.vodReviews[0].markers[0].seconds).toBe(90);
  expect(persisted.vodReviews[0].tournament_id).toBe(seed.tournaments[0].id);
  expect(persisted.weeklyReports[0].summary.evidence).toBeTruthy();
  expect(errors).toEqual([]);
});
