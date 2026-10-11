import { boundedText } from "./bounded-body.ts";
export type MediaInfo = {
  alt: string;
  source_url: string;
  rights: string;
  credit: string;
};
export function mediaInfo(value: Record<string, unknown>): MediaInfo | null {
  const t = (k: string, min: number, max: number) =>
    typeof value[k] === "string" &&
    value[k].trim().length >= min &&
    value[k].length <= max;
  if (
    !t("alt", 3, 300) ||
    !t("rights", 10, 1000) ||
    !t("credit", 3, 300) ||
    !t("source_url", 10, 2048)
  )
    return null;
  try {
    const u = new URL(value.source_url as string);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      /^(localhost|127\.|0\.|\[|10\.|192\.168\.|169\.254\.)/.test(u.hostname)
    )
      return null;
  } catch {
    return null;
  }
  return value as MediaInfo;
}
// Strict PNG container: CRC checks, bounded dimensions, no ancillary/executable metadata or trailing bytes.
export function validatePng(a: Uint8Array): boolean {
  if (
    a.length < 57 ||
    a.length > 3145728 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => a[i] === v)
  )
    return false;
  const view = new DataView(a.buffer, a.byteOffset, a.byteLength);
  let p = 8,
    idat = false,
    header = false;
  while (p + 12 <= a.length) {
    const size = view.getUint32(p);
    if (size > a.length - p - 12) return false;
    const tag = String.fromCharCode(...a.slice(p + 4, p + 8));
    if (!["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "sRGB"].includes(tag))
      return false;
    let crc = 0xffffffff;
    for (let i = p + 4; i < p + 8 + size; i++) {
      crc ^= a[i];
      for (let b = 0; b < 8; b++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    if ((crc ^ 0xffffffff) >>> 0 !== view.getUint32(p + 8 + size)) return false;
    if (!header && tag !== "IHDR") return false;
    if (tag === "IHDR") {
      if (header || size !== 13) return false;
      const w = view.getUint32(p + 8),
        h = view.getUint32(p + 12);
      if (
        !w ||
        !h ||
        w > 4096 ||
        h > 4096 ||
        w * h > 8_000_000 ||
        a[p + 18] !== 0 ||
        a[p + 19] !== 0 ||
        a[p + 20] !== 0
      )
        return false;
      header = true;
    }
    if (tag === "IDAT") idat = true;
    if (tag === "IEND") return size === 0 && idat && p + 12 === a.length;
    p += 12 + size;
  }
  return false;
}
export type MediaDependencies = {
  authorize(token: string): Promise<{ id: string } | null>;
  quota(token: string): Promise<boolean>;
  upload(path: string, bytes: Uint8Array): Promise<boolean>;
  insert(
    path: string,
    size: number,
    info: MediaInfo,
    actor: string,
  ): Promise<unknown>;
  removable(token: string, id: string): Promise<{ path: string } | null>;
  remove(path: string, id: string): Promise<boolean>;
};
export function mediaHandler(d: MediaDependencies, origin: string) {
  return async (req: Request) => {
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "authorization,apikey,content-type,x-client-info",
      "Access-Control-Allow-Methods": "POST,DELETE,OPTIONS",
      Vary: "Origin",
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    };
    const reply = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), { status, headers });
    if (req.headers.get("origin") && req.headers.get("origin") !== origin)
      return reply(403, { error: "Origin rejected" });
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (!["POST", "DELETE"].includes(req.method))
      return reply(405, { error: "Method not allowed" });
    const token =
      req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
    try {
      const user = await d.authorize(token);
      if (!user) return reply(403, { error: "Administrative role required" });
      if (!(await d.quota(token)))
        return reply(429, { error: "Editorial limit reached" });
      if (req.method === "DELETE") {
        let body;
        try {
          body = JSON.parse(await boundedText(req, 1024));
        } catch (error) {
          return reply(
            error instanceof Error && error.message === "body_limit"
              ? 413
              : 400,
            { error: "Invalid media request" },
          );
        }
        if (!body || typeof body !== "object")
          return reply(400, { error: "Invalid media" });
        if (typeof body.id !== "string" || !/^[a-f0-9-]{36}$/.test(body.id))
          return reply(400, { error: "Invalid media" });
        const asset = await d.removable(token, body.id);
        if (!asset)
          return reply(409, { error: "Referenced media cannot be removed" });
        return (await d.remove(asset.path, body.id))
          ? reply(200, { removed: true })
          : reply(503, { error: "Removal failed" });
      }
      const length = Number(req.headers.get("content-length"));
      if (length > 3 * 1024 * 1024 + 16384)
        return reply(413, { error: "Upload too large" });
      // Enforce a streaming body cap even when Content-Length is absent or dishonest.
      const reader = req.body?.getReader();
      if (!reader) return reply(400, { error: "Missing body" });
      let total = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > 3 * 1024 * 1024 + 16384) {
          await reader.cancel();
          return reply(413, { error: "Upload too large" });
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
      const form = await new Response(bytes, {
        headers: { "Content-Type": req.headers.get("content-type") || "" },
      }).formData();
      const file = form.get("file");
      const info = mediaInfo(
        Object.fromEntries(
          ["alt", "source_url", "rights", "credit"].map((k) => [
            k,
            form.get(k),
          ]),
        ),
      );
      if (!(file instanceof Blob) || file.type !== "image/png" || !info)
        return reply(400, { error: "Invalid file or authorization metadata" });
      const binary = new Uint8Array(await file.arrayBuffer());
      if (!validatePng(binary))
        return reply(400, {
          error: "Only validated normalized PNG images are accepted",
        });
      const path = user.id + "/" + crypto.randomUUID() + ".png";
      if (!(await d.upload(path, binary)))
        return reply(503, { error: "Upload failed" });
      try {
        const result = await d.insert(path, binary.length, info, user.id);
        return reply(201, result);
      } catch {
        await d.remove(path, "");
        return reply(503, { error: "Metadata registration failed" });
      }
    } catch {
      return reply(503, { error: "Media service unavailable" });
    }
  };
}
