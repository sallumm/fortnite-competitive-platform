import { it, expect, vi } from "vitest";
import { recruitmentHandler } from "../supabase/functions/_shared/recruitment";
const cycle = "10000000-0000-4000-8000-000000000001",
  origin = "https://example.test";
function setup(
  result: unknown = {
    success: true,
    hostname: "example.test",
    action: "recruitment",
  },
) {
  const d = {
    user: vi.fn(async () => "user-a" as string | null),
    reserve: vi.fn(async () => true),
    issue: vi.fn(async () => "ticket"),
    submit: vi.fn(async () => "application"),
    fetch: vi.fn(async () => new Response(JSON.stringify(result))),
  };
  return { d, handle: recruitmentHandler(d, origin, "server-secret") };
}
const request = (
  body: unknown = {
    cycle,
    captcha: "valid",
    payload: { nickname: "fictional" },
  },
  headers = {},
) =>
  new Request(origin, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { authorization: "Bearer jwt", ...headers },
  });
it("preserves authenticated owner and reserves quota before contacting Siteverify", async () => {
  const { d, handle } = setup();
  expect((await handle(request())).status).toBe(201);
  expect(d.reserve.mock.invocationCallOrder[0]).toBeLessThan(
    d.fetch.mock.invocationCallOrder[0],
  );
  expect(d.issue).toHaveBeenCalledWith("user-a", cycle);
  expect(d.submit).toHaveBeenCalledWith(
    "jwt",
    cycle,
    { nickname: "fictional" },
    "ticket",
  );
  expect(
    JSON.parse(d.fetch.mock.calls[0][1]!.body as string),
  ).not.toHaveProperty("remoteip");
});
it.each([
  { success: false },
  { success: true, hostname: "attacker.test", action: "recruitment" },
  { success: true, hostname: "example.test", action: "auth" },
])("rejects invalid proof %j", async (result) => {
  const { d, handle } = setup(result);
  expect((await handle(request())).status).toBe(400);
  expect(d.issue).not.toHaveBeenCalled();
});
it("rejects quota exhaustion before external work and rejects missing auth/origin", async () => {
  const { d, handle } = setup();
  d.reserve.mockResolvedValue(false);
  const response = await handle(request());
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("600");
  expect(d.fetch).not.toHaveBeenCalled();
  d.user.mockResolvedValue(null);
  expect((await handle(request())).status).toBe(401);
  expect(
    (await handle(request({}, { origin: "https://attacker.test" }))).status,
  ).toBe(403);
});
it("fails closed on oversized input/provider response and provider failure", async () => {
  const { d, handle } = setup();
  expect(
    (await handle(request({ cycle, captcha: "x".repeat(25000) }))).status,
  ).toBe(400);
  expect(d.fetch).not.toHaveBeenCalled();
  d.fetch.mockResolvedValue(new Response("x".repeat(8193)));
  expect((await handle(request())).status).toBe(503);
  expect(d.issue).not.toHaveBeenCalled();
});
