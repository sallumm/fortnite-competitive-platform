/** Preserve a private workflow after login/onboarding without accepting external redirects. */
export function appDestination(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 2000 ||
    /[\\\u0000-\u001f]/.test(value) ||
    !/^\/app(?:\/|\?|#|$)/.test(value)
  )
    return "/app";
  try {
    const url = new URL(value, "https://kyrven.invalid");
    return url.origin === "https://kyrven.invalid" &&
      /^\/app(?:\/|$)/.test(url.pathname)
      ? url.pathname + url.search + url.hash
      : "/app";
  } catch {
    return "/app";
  }
}
