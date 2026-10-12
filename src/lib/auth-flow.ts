// A callback marker selects UI only. Supabase must still validate the session/token.
export function passwordCallback(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  if ([query, fragment].some((p) => p.has("error") || p.has("error_code")))
    return false;
  return (
    query.get("recovery") === "1" ||
    query.get("invite") === "1" ||
    ["recovery", "invite"].includes(fragment.get("type") || "")
  );
}
