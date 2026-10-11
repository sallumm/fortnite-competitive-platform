import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { demoPlayer, seed, uid } from "../src/lib/seed";

// Uses only the existing, explicitly identified demo. Esports/admin screens
// remain denied; their authorized contracts are tested separately in SQL/DOM.
test("all representative routes retain contrast, branding and responsive layout", async ({
  page,
}, info) => {
  test.setTimeout(360000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const data = demoPlayer();
  data.profile!.onboarded = true;
  // Exercise a readable cancelled state without activating or changing real data.
  data.schedules = [
    {
      id: uid(9900),
      user_id: "demo",
      plan_id: null,
      title: "Atividade cancelada de teste",
      kind: "personal",
      status: "cancelled",
      duration_minutes: 30,
      starts_at: new Date().toISOString(),
      tournament_id: null,
    },
  ];
  await page.evaluate((data) => {
    localStorage.setItem("clutchfolio-demo-v1", JSON.stringify(data));
  }, data);
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(
    page.getByRole("heading", { name: "Como você joga?" }),
  ).toBeVisible();
  const lesson = seed.articles.find((a) => a.kind === "lesson")!;
  const article = seed.articles.find((a) => a.kind !== "lesson")!;
  const routes = [
    "/",
    "/auth",
    "/onboarding",
    "/app",
    "/app/training",
    "/app/planner",
    "/app/evolution-plan",
    "/app/evolution",
    "/app/skills",
    "/app/vod",
    "/app/week",
    "/app/reports",
    "/app/progression",
    "/app/profile",
    "/app/coach",
    "/app/road",
    "/app/meta-training",
    "/app/teams",
    "/library",
    `/library/${seed.exercises[0].id}`,
    "/academy",
    `/academy/${lesson.slug}`,
    "/academy/curriculum",
    "/academy/research",
    "/competitive",
    `/competitive/${seed.tournaments[0].slug}`,
    "/competitive/meta",
    "/news",
    `/news/${article.slug}`,
    "/knowledge",
    "/help",
    "/community",
    "/legal/privacy",
    "/legal/terms",
    "/esports",
    "/be-kyrven",
    "/app/esports",
    "/app/esports/trials",
    "/app/esports/development",
    "/admin",
    "/admin/meta",
    "/admin/academy",
    "/admin/ai",
    "/admin/esports",
    "/admin/esports/assessments",
    "/admin/esports/development",
    "/route-not-found",
  ];
  for (const theme of ["dark", "light"] as const) {
    await page.goto("/");
    const toggle = page.getByRole("button", {
      name: theme === "light" ? "Ativar tema claro" : "Ativar tema escuro",
    });
    if (await toggle.isVisible()) await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const [index, route] of routes.entries()) {
      await test.step(`${theme} ${route}`, async () => {
        await page.goto(route);
        await expect(
          page.locator("main").getByRole("heading").first(),
        ).toBeVisible();
        await expect(page.locator(".skeleton-page")).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${theme} ${route}: horizontal overflow`,
        ).toBe(true);
        expect(
          await page.locator("body").innerText(),
          `${theme} ${route}: historical public branding`,
        ).not.toMatch(/Clutchfolio|Clutch Coach/);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect
          .soft(
            result.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => ({
                target: n.target,
                summary: n.failureSummary,
              })),
            })),
            `${theme} ${route}`,
          )
          .toEqual([]);
        await page.screenshot({
          path: info.outputPath(`${theme}-${index}.png`),
          fullPage: true,
        });
      });
    }
  }
  expect(errors).toEqual([]);
});
