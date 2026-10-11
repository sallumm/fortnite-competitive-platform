import { it, expect, vi } from "vitest";
import { boundedText } from "../supabase/functions/_shared/bounded-body";
import { mediaHandler } from "../supabase/functions/_shared/meta-media";
it("reads valid multibyte UTF-8 split between chunks", async () => {
  const bytes = new TextEncoder().encode("ação");
  const body = new ReadableStream({
    start(c) {
      c.enqueue(bytes.slice(0, 2));
      c.enqueue(bytes.slice(2));
      c.close();
    },
  });
  expect(await boundedText(new Response(body), bytes.length)).toBe("ação");
});
it.each([undefined, "1"])(
  "cancels oversized streams with length %s",
  async (length) => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      pull(c) {
        c.enqueue(new Uint8Array(100));
      },
      cancel,
    });
    await expect(
      boundedText(
        new Response(body, {
          headers: length ? { "content-length": length } : {},
        }),
        101,
      ),
    ).rejects.toThrow("body_limit");
    expect(cancel).toHaveBeenCalledOnce();
  },
);
it("rejects oversized DELETE before removal, accepts valid IDs and rejects malformed JSON", async () => {
  const remove = vi.fn(async () => true),
    removable = vi.fn(async () => ({ path: "owned.png" }));
  const handler = mediaHandler(
    {
      authorize: async () => ({ id: "owner" }),
      quota: async () => true,
      upload: async () => true,
      insert: async () => ({}),
      removable,
      remove,
    },
    "https://example.test",
  );
  const req = (body: string) =>
    new Request("https://example.test/media", { method: "DELETE", body });
  expect((await handler(req("x".repeat(1025)))).status).toBe(413);
  expect((await handler(req("null"))).status).toBe(400);
  expect(remove).not.toHaveBeenCalled();
  expect(
    (
      await handler(
        req(JSON.stringify({ id: "10000000-0000-4000-8000-000000000001" })),
      )
    ).status,
  ).toBe(200);
  expect(remove).toHaveBeenCalledOnce();
});
