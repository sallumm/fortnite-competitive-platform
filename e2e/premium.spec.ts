import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPlayer, seed, uid } from "../src/lib/seed";
import { dateInZone, zonedInstant, shiftDate } from "../src/lib/calendar";
async function navigate(page: Page, name: string) {
  const previous = await page.locator("main h1").first().textContent();
  const toggle = page.getByRole("button", { name: "Abrir menu", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole("link", { name, exact: true }).first().click();
  if (previous)
    await expect(page.locator("main h1").first()).not.toHaveText(previous);
}
async function demo(page: Page) {
  const data = demoPlayer();
  data.profile!.onboarded = true;
  data.plans = [
    {
      id: uid(700),
      user_id: "demo",
      title: "Treino premium",
      steps: seed.exercises
        .slice(0, 3)
        .map((e) => ({ exercise_id: e.id, minutes: 10 })),
    },
  ];
  const day = dateInZone(new Date(), data.profile!.timezone);
  data.schedules = [
    {
      id: uid(701),
      user_id: "demo",
      plan_id: uid(700),
      title: "Sessão planejada",
      kind: "training",
      status: "planned",
      duration_minutes: 30,
      tournament_id: null,
      starts_at: zonedInstant(day, "18:00", data.profile!.timezone),
    },
  ];
  await page.goto("/");
  await page.evaluate(
    (data) => localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data)),
    data,
  );
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(
    page.getByRole("heading", { name: "Como você joga?" }),
  ).toBeVisible();
  await navigate(page, "Meu Dia");
  await expect(
    page.getByRole("heading", { name: "Meu Dia", exact: true }),
  ).toBeVisible();
  return day;
}
test("builder keyboard reorder, undo, preview, persistence and session resume", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  await navigate(page, "Planejador");
  await page.getByRole("button", { name: "Editar Treino premium" }).click();
  const dialog = page.getByRole("dialog");
  const grip = dialog.getByRole("button", { name: /^Arrastar / }).first();
  await grip.focus();
  await page.keyboard.press("Space");
  await expect(dialog.locator(".builder-step.dragging")).toHaveCount(1);
  // KeyboardSensor attaches its listener and measures sortable coordinates after activation.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByText(`Destino: ${seed.exercises[1].title}.`, { exact: true }),
  ).toBeAttached();
  await page.keyboard.press("Space");
  await expect(dialog.locator(".builder-step strong").first()).toContainText(
    seed.exercises[1].title,
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans[0]
          .steps[0].exercise_id,
    ),
  ).toBe(seed.exercises[0].id);
  await dialog.getByRole("button", { name: "Desfazer" }).click();
  await expect(dialog.locator(".builder-step strong").first()).toContainText(
    seed.exercises[0].title,
  );
  await dialog.getByLabel("Minutos", { exact: true }).first().fill("15");
  await dialog.getByRole("button", { name: "Pré-visualizar" }).click();
  await expect(dialog.getByText("15 min", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Salvar rotina" }).click();
  await expect(dialog).toBeHidden();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).plans[0]
          .steps[0].minutes,
    ),
  ).toBe(15);
  await page
    .getByRole("button", { name: "Iniciar", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Observação ou erro recorrente")
    .fill("Preservar meu resultado");
  await page
    .getByRole("button", { name: "Próximo exercício", exact: true })
    .click();
  await page.getByLabel("Observação ou erro recorrente").fill("Segunda etapa");
  await navigate(page, "Relatórios");
  await navigate(page, "Meu Dia");
  await page.getByRole("button", { name: /Retomar/ }).click();
  await expect(page.getByLabel("Observação ou erro recorrente")).toHaveValue(
    "Segunda etapa",
  );
  await page.getByRole("button", { name: "Exercício anterior" }).click();
  await expect(page.getByLabel("Observação ou erro recorrente")).toHaveValue(
    "Preservar meu resultado",
  );
  await page.getByRole("button", { name: "Próximo exercício" }).click();
  await expect(page.getByLabel("Observação ou erro recorrente")).toHaveValue(
    "Segunda etapa",
  );
  await page.screenshot({
    path: info.outputPath("training.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("calendar drag opens a proposal and saves only after confirmation", async ({
  page,
}, info) => {
  const day = await demo(page);
  await navigate(page, "Planejador");
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  if (info.project.name === "mobile") {
    // Equivalent edit controls are available without a pointer drag.
    await page
      .locator(`.calendar-day[data-calendar-date="${day}"] .event`)
      .click();
    const input = page.getByLabel(/Data e hor/);
    await input.fill(shiftDate(day, 1) + "T18:00");
  } else {
    const grip = page.locator(
      `.calendar-day[data-calendar-date="${day}"] .calendar-drag`,
    );
    const target = page.locator(
      `.calendar-day[data-calendar-date="${shiftDate(day, 1)}"]`,
    );
    await grip.scrollIntoViewIfNeeded();
    const from = await grip.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error("Missing calendar geometry");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + 35, { steps: 16 });
    await page.mouse.up();
  }
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).schedules[0]
          .starts_at,
    ),
  ).toBe(zonedInstant(day, "18:00", "America/Sao_Paulo"));
  await page.screenshot({
    path: info.outputPath("reschedule-preview.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Salvar agendamento" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("clutchfolio-demo-v1")!).schedules[0]
          .starts_at,
    ),
  ).toBe(zonedInstant(shiftDate(day, 1), "18:00", "America/Sao_Paulo"));
});
test("public and private page coverage, search, light theme and reduced motion", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await expect(
    page.getByRole("heading", { name: /Seu próximo nível/ }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("landing-dark.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Evolução", exact: true }).click();
  await page
    .getByRole("button", { name: "Registrar sessão de exemplo" })
    .click();
  expect(
    await page.evaluate(() => localStorage.getItem("clutchfolio-demo-v1")),
  ).toBeNull();
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await page.screenshot({
    path: info.outputPath("landing-light.png"),
    fullPage: true,
  });
  await demo(page);
  for (const name of [
    "Planejador",
    "Minhas Habilidades",
    "Minha Semana",
    "Relatórios",
    "Progressão",
    "kyrven coach",
    "Exercícios",
    "Competitivo",
    "Notícias e análises",
    "kyrven academy",
    "Central de ajuda",
    "Comunidade",
  ]) {
    await test.step(`Abrir ${name}`, async () => {
      await navigate(page, name);
    });
    await expect(page.locator("main h1").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name,
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Buscar na plataforma" }).click();
  await page.getByLabel("O que você procura?").fill("Perfil");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: /Perfil/ })
    .click();
  await page.getByLabel(/Intensidade de movimento/).selectOption("essential");
  await expect(page.locator("html")).toHaveAttribute(
    "data-motion",
    "essential",
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
  expect(errors).toEqual([]);
});
test("article detail, competition detail and compact sidebar", async ({
  page,
}, info) => {
  await page.goto("/news");
  await expect(page.locator("main h1")).toBeVisible();
  const article = page.locator('main a[href^="/news/"]').first();
  await article.click();
  await expect(page.locator("main h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/competitive");
  await expect(page.locator("main h1")).toBeVisible();
  const event = page.locator('main a[href^="/competitive/"]').first();
  await event.click();
  await expect(page.locator("main h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/legal/privacy");
  await expect(page.locator("main h1")).toBeVisible();
  await demo(page);
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "Recolher menu" }).click();
    await expect(page.locator(".sidebar")).toHaveClass(/collapsed/);
    await page.getByRole("link", { name: "Planejador", exact: true }).click();
    await expect(page.locator("main h1")).toBeVisible();
    await page.getByRole("button", { name: "Expandir menu" }).click();
  }
  await page.evaluate(() => {
    document.activeElement instanceof HTMLElement &&
      document.activeElement.blur();
    scrollTo(0, 0);
  });
  await page.screenshot({ path: info.outputPath("workspace-viewport.png") });
});
