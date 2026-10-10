import { it, expect, vi } from "vitest";
import { deflateSync } from "node:zlib";
import {
  mediaHandler,
  validatePng,
  mediaInfo,
  type MediaDependencies,
} from "../supabase/functions/_shared/meta-media";
import {
  videoSchema,
  youtubeId,
  editorialSchema,
  cleanEntryContent,
} from "../src/lib/meta-editorial";
import raw from "../src/data/meta-knowledge.json";
import type { MetaEntry } from "../src/lib/meta";
function chunk(tag: string, bytes: Uint8Array) {
  const b = Buffer.alloc(bytes.length + 12);
  b.writeUInt32BE(bytes.length);
  b.write(tag, 4);
  b.set(bytes, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < 8 + bytes.length; i++) {
    crc ^= b[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  b.writeUInt32BE((crc ^ 0xffffffff) >>> 0, bytes.length + 8);
  return b;
}
function png() {
  const h = Buffer.alloc(13);
  h.writeUInt32BE(1);
  h.writeUInt32BE(1, 4);
  h[8] = 8;
  h[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", h),
    chunk("IDAT", deflateSync(Buffer.from([0, 150, 200, 120, 255]))),
    chunk("IEND", new Uint8Array()),
  ]);
}
const info = {
  alt: "Ilustração original",
  source_url: "https://example.com/source",
  rights: "Direitos originais da equipe de teste.",
  credit: "Equipe de teste",
};
function dependencies(): MediaDependencies {
  return {
    authorize: vi.fn(async () => ({
      id: "00000000-0000-4000-8000-000000000001",
    })),
    quota: vi.fn(async () => true),
    upload: vi.fn(async () => true),
    insert: vi.fn(async (path, size, i) => ({
      id: "asset",
      path,
      size_bytes: size,
      ...i,
    })),
    removable: vi.fn(async () => null),
    remove: vi.fn(async () => true),
  };
}
function request(bytes: Uint8Array, mime = "image/png") {
  const body = new FormData();
  body.set(
    "file",
    new Blob([new Uint8Array(bytes)], { type: mime }),
    "file.png",
  );
  for (const [k, v] of Object.entries(info)) body.set(k, v);
  return new Request("https://app.example/meta-media", {
    method: "POST",
    body,
    headers: { Authorization: "Bearer test", Origin: "https://app.example" },
  });
}
it("validates PNG structure, CRC, dimensions, metadata and refuses SVG/executable/polyglot files", () => {
  expect(validatePng(png())).toBe(true);
  expect(validatePng(Buffer.from('<svg onload="alert(1)">'))).toBe(false);
  expect(validatePng(Buffer.concat([png(), Buffer.from("<script>")]))).toBe(
    false,
  );
  const corrupt = png();
  corrupt[35] ^= 1;
  expect(validatePng(corrupt)).toBe(false);
  expect(mediaInfo({ ...info, rights: "" })).toBeNull();
  expect(
    mediaInfo({ ...info, source_url: "https://user:password@example.com" }),
  ).toBeNull();
});
it("authenticates, applies quota and uploads only verified binaries with safe generated names", async () => {
  const d = dependencies(),
    handler = mediaHandler(d, "https://app.example");
  const r = await handler(request(png()));
  expect(r.status).toBe(201);
  expect(d.upload).toHaveBeenCalledWith(
    expect.stringMatching(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.png$/),
    expect.any(Uint8Array),
  );
  expect(d.insert).toHaveBeenCalled();
  expect((await handler(request(Buffer.from("<html>")))).status).toBe(400);
  expect((await handler(request(png(), "image/svg+xml"))).status).toBe(400);
});
it("blocks unauthorized writes, request overflow, origin violations, referenced deletion and rolls back storage failures", async () => {
  const d = dependencies();
  d.authorize = vi.fn(async () => null);
  expect(
    (await mediaHandler(d, "https://app.example")(request(png()))).status,
  ).toBe(403);
  expect(d.upload).not.toHaveBeenCalled();
  d.authorize = vi.fn(async () => ({ id: "editor" }));
  d.quota = vi.fn(async () => false);
  expect(
    (await mediaHandler(d, "https://app.example")(request(png()))).status,
  ).toBe(429);
  d.quota = vi.fn(async () => true);
  const handler = mediaHandler(d, "https://app.example");
  expect(
    (
      await handler(
        new Request("https://app.example", {
          method: "POST",
          body: "x".repeat(3145728 + 16385),
        }),
      )
    ).status,
  ).toBe(413);
  expect(
    (
      await handler(
        new Request("https://app.example", {
          method: "POST",
          headers: { Origin: "https://evil.example" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await handler(
        new Request("https://app.example", {
          method: "DELETE",
          body: JSON.stringify({ id: "00000000-0000-4000-8000-000000000001" }),
        }),
      )
    ).status,
  ).toBe(409);
  d.insert = vi.fn(async () => {
    throw new Error("DB down");
  });
  expect((await handler(request(png()))).status).toBe(503);
  expect(d.remove).toHaveBeenCalledWith(expect.any(String), "");
});
it("parses an allowlisted YouTube ID, rejects deceptive URLs and validates structured content without accepting arbitrary HTML fields", () => {
  expect(youtubeId("https://youtu.be/7qQFLL_DJ7Q")).toBe("7qQFLL_DJ7Q");
  for (const u of [
    "javascript:alert(1)",
    "https://youtube.com.evil.example/watch?v=7qQFLL_DJ7Q",
    "https://user:pass@youtube.com/watch?v=7qQFLL_DJ7Q",
    "https://youtube.com/embed/<script>",
  ])
    expect(youtubeId(u)).toBeNull();
  const p = cleanEntryContent(raw.entries[0] as MetaEntry);
  expect(editorialSchema.safeParse(p).success).toBe(true);
  expect(editorialSchema.safeParse({ ...p, html: "<script>" }).success).toBe(
    false,
  );
  expect(
    videoSchema.safeParse({
      title: "Video",
      creator: "Creator",
      description: "Description",
      url: "https://example.com/iframe",
      source_url: "https://example.com",
      authorization: "Written permission",
      embed_allowed: true,
      tags: [],
      timestamps: [],
    }).success,
  ).toBe(false);
});
