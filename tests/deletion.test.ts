import { describe, expect, it, vi } from "vitest";
import { deletionHandler } from "../supabase/functions/_shared/delete-account";
import { sessionAuthenticationTime } from "../supabase/functions/_shared/session-authentication";
it("does not turn a refresh or TOTP challenge into a recent primary login", () => {
  expect(
    sessionAuthenticationTime({
      amr: [
        { method: "token_refresh", timestamp: 200 },
        { method: "totp", timestamp: 200 },
      ],
    }),
  ).toBeUndefined();
  expect(
    sessionAuthenticationTime({
      amr: [
        { method: "password", timestamp: 100 },
        { method: "token_refresh", timestamp: 200 },
      ],
    }),
  ).toBe(new Date(100000).toISOString());
  expect(
    sessionAuthenticationTime({
      amr: [{ method: "password", timestamp: Infinity }],
    }),
  ).toBeUndefined();
});
const now = Date.parse("2026-10-10T12:00:00Z");
function setup(lastSignIn = new Date(now).toISOString()) {
  const backend = {
    user: vi.fn(async () => ({ id: "own-user", last_sign_in_at: lastSignIn })),
    deleteUser: vi.fn(async () => true),
  };
  return {
    backend,
    handle: deletionHandler(backend, "https://example.com", () => now),
  };
}
const request = (
  body: unknown = { confirmation: "EXCLUIR" },
  headers: Record<string, string> = { authorization: "Bearer verified-token" },
) =>
  new Request("https://example.com/delete", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
describe("Account deletion boundary", () => {
  it("requires administrative MFA even after a recent password login", async () => {
    const backend = {
      user: async () => ({
        id: "admin",
        last_sign_in_at: new Date(now).toISOString(),
        mfaRequired: true,
        mfaVerified: false,
      }),
      deleteUser: vi.fn(async () => true),
    };
    expect(
      (
        await deletionHandler(
          backend,
          "https://example.com",
          () => now,
        )(request())
      ).status,
    ).toBe(403);
    expect(backend.deleteUser).not.toHaveBeenCalled();
  });
  it("deletes only the authenticated identity after explicit confirmation", async () => {
    const { backend, handle } = setup();
    expect((await handle(request())).status).toBe(200);
    expect(backend.deleteUser).toHaveBeenCalledExactlyOnceWith("own-user");
  });
  it.each([
    {},
    { confirmation: "EXCLUIR", user_id: "someone-else" },
    { confirmation: "excluir" },
    [],
  ])("rejects invalid confirmation %j", async (body) => {
    const { backend, handle } = setup();
    expect((await handle(request(body))).status).toBe(400);
    expect(backend.deleteUser).not.toHaveBeenCalled();
  });
  it.each([
    "invalid",
    new Date(now - 901000).toISOString(),
    new Date(now + 120000).toISOString(),
  ])("requires a valid recent sign-in: %s", async (signIn) => {
    const { backend, handle } = setup(signIn);
    expect((await handle(request())).status).toBe(403);
    expect(backend.deleteUser).not.toHaveBeenCalled();
  });
  it("rejects missing auth, foreign origin and oversized body", async () => {
    const { backend, handle } = setup();
    expect((await handle(request({}, {}))).status).toBe(401);
    expect(
      (
        await handle(
          request(
            {},
            {
              authorization: "Bearer token",
              origin: "https://attacker.example",
            },
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (await handle(request({ confirmation: "x".repeat(3000) }))).status,
    ).toBe(413);
    expect(backend.deleteUser).not.toHaveBeenCalled();
  });
  it("reports deletion failure without disclosing provider errors", async () => {
    const { backend, handle } = setup();
    backend.deleteUser.mockRejectedValue(new Error("private secret"));
    const response = await handle(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
  });
});
