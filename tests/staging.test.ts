import { expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error Native deployment utilities intentionally use JavaScript.
import {
  prepareStagingArtifact,
  assertStagingArtifact,
} from "../scripts/staging-artifact.mjs";
// @ts-expect-error Native deployment utility.
import { stagingIssues } from "../scripts/staging-check.mjs";
// @ts-expect-error Native build utility.
import { prerender } from "../scripts/prerender-editorial.mjs";

it("prevents indexing on nested SPA documents and rejects reintroduced sitemap", () => {
  const root = mkdtempSync(join(tmpdir(), "kyrven-staging-"));
  try {
    mkdirSync(join(root, "news"));
    const html =
      '<html><head><meta name="robots" content="index"></head><body></body></html>';
    writeFileSync(join(root, "index.html"), html);
    writeFileSync(join(root, "news", "index.html"), html);
    writeFileSync(join(root, "sitemap.xml"), "public urls");
    writeFileSync(
      join(root, "_headers"),
      "/*\n  Content-Security-Policy: default-src 'self'; frame-ancestors 'none'\n",
    );
    prepareStagingArtifact(root);
    expect(() => assertStagingArtifact(root)).not.toThrow();
    expect(
      readFileSync(join(root, "news", "index.html"), "utf8"),
    ).not.toContain('content="index"');
    writeFileSync(join(root, "sitemap.xml"), "public urls");
    expect(() => assertStagingArtifact(root)).toThrow("indexável");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
it("rejects missing staging configuration, project mismatch and public secrets without values", () => {
  expect(stagingIssues({}).length).toBeGreaterThan(0);
  const env = {
    KYRVEN_STAGING_PROJECT_REF: "abcdefghijklmnopqrst",
    VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    VITE_SUPABASE_ANON_KEY: "sb_publishable_synthetic",
    VITE_SITE_URL: "https://staging.example.com",
    VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  };
  expect(stagingIssues(env)).toEqual([]);
  const issues = stagingIssues({
    ...env,
    VITE_SUPABASE_URL: "https://wrong.supabase.co",
    VITE_SECRET: "DO_NOT_PRINT",
    PRERENDER_PUBLIC: "1",
  });
  expect(issues.length).toBe(3);
  expect(JSON.stringify(issues)).not.toContain("DO_NOT_PRINT");
});
it("never contacts remote prerender providers for staging even when requested", async () => {
  let calls = 0;
  await prerender(
    { KYRVEN_BUILD_TARGET: "staging", PRERENDER_PUBLIC: "1" },
    () => {
      calls++;
      throw new Error("Forbidden remote fetch");
    },
  );
  expect(calls).toBe(0);
});
