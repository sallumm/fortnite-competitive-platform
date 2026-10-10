/** A bounded official-page fetch, never arbitrary user URLs or search instructions. */
export async function officialSnapshot(
  source: string,
  transport: typeof fetch = fetch,
): Promise<{ text: string; url: string; checked_at: string } | null> {
  try {
    const u = new URL(source);
    if (
      u.protocol !== "https:" ||
      u.hostname !== "www.fortnite.com" ||
      !u.pathname.startsWith("/competitive/") ||
      u.username ||
      u.password ||
      u.port
    )
      return null;
    const response = await transport(u.toString(), {
      redirect: "error",
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "text/html" },
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("text/html") ||
      !response.body
    )
      return null;
    const reader = response.body.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 256000) {
          await reader.cancel();
          return null;
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }
    const text = new TextDecoder()
      .decode(bytes)
      .replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[^;]+;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
    if (text.length < 300) return null;
    return { text, url: u.toString(), checked_at: new Date().toISOString() };
  } catch {
    return null;
  }
}
