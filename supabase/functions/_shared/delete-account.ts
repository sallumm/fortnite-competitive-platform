export interface DeletionBackend {
  user: (
    token: string,
  ) => Promise<{
    id: string;
    last_sign_in_at?: string;
    mfaRequired?: boolean;
    mfaVerified?: boolean;
  } | null>;
  deleteUser: (id: string) => Promise<boolean>;
}
/** Only the authenticated identity can be deleted; body IDs are never trusted. */
export function deletionHandler(
  backend: DeletionBackend,
  origin: string,
  now = () => Date.now(),
) {
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization,x-client-info,apikey,content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  return async (request: Request) => {
    const respond = (error: string, status: number) =>
      new Response(JSON.stringify({ error }), { status, headers });
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== origin
    )
      return respond("Origin not allowed", 403);
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return respond("Method not allowed", 405);
    const token = /^Bearer ([^\s]+)$/i.exec(
      request.headers.get("authorization") || "",
    )?.[1];
    if (!token) return respond("Authentication required", 401);
    try {
      const user = await backend.user(token);
      if (!user) return respond("Invalid session", 401);
      if (user.mfaRequired && !user.mfaVerified)
        return respond("Verify MFA before deleting your account", 403);
      const signIn = Date.parse(user.last_sign_in_at || "");
      if (
        !Number.isFinite(signIn) ||
        now() - signIn > 900000 ||
        signIn > now() + 60000
      )
        return respond("Sign in again before deleting your account", 403);
      if (Number(request.headers.get("content-length")) > 2048)
        return respond("Invalid request", 413);
      // Bound the stream as well: Content-Length is supplied by the caller.
      const reader = request.body?.getReader();
      if (!reader) return respond("Confirmation required", 400);
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 2048) {
          await reader.cancel();
          return respond("Invalid request", 413);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      let body: unknown;
      try {
        body = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        return respond("Invalid request", 400);
      }
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).length !== 1 ||
        !("confirmation" in body) ||
        body.confirmation !== "EXCLUIR"
      )
        return respond("Confirmation required", 400);
      if (!(await backend.deleteUser(user.id)))
        return respond("Account deletion failed", 500);
      return new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers,
      });
    } catch {
      return respond("Deletion unavailable", 500);
    }
  };
}
