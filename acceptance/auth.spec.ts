// Preparation only. Excluded from the offline e2e suite and CI.
// Accounts, factors, mail links and private Access must be prepared by an authorized operator.
import { test, expect } from "./private-test";
import { createClient } from "@supabase/supabase-js";
import { privateAuthOperation, isSecurityDestination } from "./safe-errors";
const ref = "hqhkaewpkkgpagcvgfmb";
function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing operator fixture: ${name}`);
  return value;
}
function client() {
  const key = env("KYRVEN_AUTH_TEST_PUBLIC_KEY");
  let legacyPublic = false;
  try {
    legacyPublic =
      JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
        .role === "anon";
  } catch {
    /* A publishable key is not a JWT. */
  }
  if (!key.startsWith("sb_publishable_") && !legacyPublic)
    throw new Error("Public client key required");
  return createClient(`https://${ref}.supabase.co`, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
test("A/B real SDK identity, read isolation, AAL1 negative, MFA AAL2 and logout", async () =>
  privateAuthOperation(async () => {
    const a = client(),
      b = client();
    try {
      for (const [c, label] of [
        [a, "A"],
        [b, "B"],
      ] as const) {
        const result = await c.auth.signInWithPassword({
          email: env(`KYRVEN_AUTH_TEST_${label}_EMAIL`),
          password: env(`KYRVEN_AUTH_TEST_${label}_PASSWORD`),
          options: { captchaToken: env(`KYRVEN_AUTH_TEST_${label}_CAPTCHA`) },
        });
        // Never assert on full SDK objects: failure output must not expose a token.
        expect(result.error === null).toBe(true);
      }
      const au = await a.auth.getUser(),
        bu = await b.auth.getUser();
      expect(au.error === null && bu.error === null).toBe(true);
      expect(au.data.user?.id !== bu.data.user?.id).toBe(true);
      const rows = await b
        .from("profiles")
        .select("id")
        .eq("id", au.data.user!.id);
      expect(rows.error === null).toBe(true);
      expect(rows.data?.length).toBe(0);
      const negative = await a.rpc("meta_editor_media_quota");
      expect(negative.error !== null).toBe(true);
      const before = await a.auth.mfa.getAuthenticatorAssuranceLevel();
      expect(before.data?.currentLevel).toBe("aal1");
      const challenge = await a.auth.mfa.challenge({
        factorId: env("KYRVEN_AUTH_TEST_A_FACTOR_ID"),
      });
      expect(challenge.error === null).toBe(true);
      const verification = await a.auth.mfa.verify({
        factorId: env("KYRVEN_AUTH_TEST_A_FACTOR_ID"),
        challengeId: challenge.data!.id,
        code: env("KYRVEN_AUTH_TEST_A_TOTP"),
      });
      expect(verification.error === null).toBe(true);
      const after = await a.auth.mfa.getAuthenticatorAssuranceLevel();
      expect(after.data?.currentLevel).toBe("aal2");
      const status = await a.rpc("security_status");
      expect(status.error === null).toBe(true);
      expect(status.data?.aal2).toBe(true);
      const signout = await a.auth.signOut({ scope: "global" });
      expect(signout.error === null).toBe(true);
      expect((await a.auth.getSession()).data.session === null).toBe(true);
      // Access-JWT residual lifetime still requires the separately approved TTL experiment.
    } finally {
      await a.auth.signOut();
      await b.auth.signOut();
    }
  }));
test("two real tabs share operator-provided synthetic A session and invalidate on logout", async ({
  browser,
  baseURL,
}) =>
  privateAuthOperation(async () => {
    // The state path is private input only; never commit or upload it.
    const context = await browser.newContext({
      storageState: env("KYRVEN_AUTH_TEST_A_STATE_PATH"),
    });
    try {
      const one = await context.newPage(),
        two = await context.newPage();
      await Promise.all([
        one.goto(baseURL + "/app"),
        two.goto(baseURL + "/app"),
      ]);
      await expect(one.getByRole("heading", { name: "Meu Dia" })).toBeVisible();
      await expect(two.getByRole("heading", { name: "Meu Dia" })).toBeVisible();
      await one.getByRole("button", { name: "Sair", exact: true }).click();
      await expect(
        two.getByRole("heading", { name: "Meu Dia" }),
      ).not.toBeVisible();
    } finally {
      await context.close();
    }
  }));
test("valid invite or recovery displays password setup before security redirect", async ({
  browser,
  baseURL,
}) =>
  privateAuthOperation(async () => {
    const url = new URL(env("KYRVEN_AUTH_TEST_CALLBACK_URL"));
    if (url.origin !== baseURL || url.pathname !== "/auth")
      throw new Error("Callback origin/path mismatch");
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      try {
        await page.goto(url.href);
      } catch {
        throw new Error("Private callback navigation failed; URL omitted");
      }
      await expect(
        page.getByRole("heading", { name: "Nova senha" }),
      ).toBeVisible();
      await page.getByLabel(/Senha/).fill(env("KYRVEN_AUTH_TEST_NEW_PASSWORD"));
      await page.getByRole("button", { name: "Atualizar senha" }).click();
      await expect.poll(() => isSecurityDestination(page.url())).toBe(true);
    } finally {
      await context.close();
    }
  }));
