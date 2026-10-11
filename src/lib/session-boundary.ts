import type { Session } from "@supabase/supabase-js";

/** UI invalidation hint only. Server roles and verified JWTs authorize requests. */
export function sessionBoundary(session: Session | null): string {
  if (!session) return "anonymous";
  let assurance = "aal1";
  try {
    const encoded = session.access_token.split(".")[1];
    const claims = JSON.parse(
      atob(encoded.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (claims.aal === "aal2") assurance = "aal2";
  } catch {
    // A missing or malformed UI hint never grants administrative access.
  }
  return `${session.user.id}:${assurance}`;
}
