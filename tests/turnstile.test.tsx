// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { loadTurnstile } from "../src/components/Turnstile";
it("allows retry after loader failure instead of caching a rejected promise", async () => {
  const first = loadTurnstile();
  document
    .querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com"]',
    )!
    .dispatchEvent(new Event("error"));
  await expect(first).rejects.toThrow("CAPTCHA unavailable");
  const retry = loadTurnstile();
  expect(retry).not.toBe(first);
  window.turnstile = { render: vi.fn(() => "widget"), remove: vi.fn() };
  document
    .querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com"]',
    )!
    .dispatchEvent(new Event("load"));
  expect(await retry).toBe(window.turnstile);
  delete window.turnstile;
});
