import { expect, it } from "vitest";
// @ts-expect-error Native build utility does not require TypeScript at deployment.
import { editorialSnapshot } from "../scripts/prerender-editorial.mjs";
const template =
  '<html><head><title>Clutchfolio</title></head><body><div id="root"></div></body></html>';
const article = {
  slug: "safe-article",
  title: '<script>alert("x")</script>',
  summary: "Original",
  body: '<img onerror="bad()">',
  kind: "news",
  published: true,
  published_at: "2026-10-09T12:00:00Z",
  verified_at: "2026-10-09T12:00:00Z",
  valid_until: "2026-10-09T12:00:00Z",
  source_url: "https://www.fortnite.com/competitive",
};
const now = new Date("2026-10-10T12:00:00Z");
it("escapes editorial text and identifies outdated sources", () => {
  const page = editorialSnapshot(template, article, "https://example.com", now);
  expect(page.path).toBe("/news/safe-article");
  expect(page.html).not.toContain("<script>");
  expect(page.html).not.toContain("<img");
  expect(page.html).toContain("precisa de revisão");
  expect(page.html).toContain('rel="canonical"');
});
it("refuses drafts, future publications, path traversal and unsafe links", () => {
  for (const change of [
    { published: false },
    { published_at: "2026-10-11T12:00:00Z" },
    { slug: "../../app" },
    { source_url: "javascript:alert(1)" },
  ])
    expect(
      editorialSnapshot(
        template,
        { ...article, ...change },
        "https://example.com",
        now,
      ),
    ).toBeNull();
});
