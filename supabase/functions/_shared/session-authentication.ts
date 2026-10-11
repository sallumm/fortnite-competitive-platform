/** Only call with cryptographically verified claims, never decoded untrusted input.
 * Account-wide last_sign_in_at can belong to another device; iat can be a refresh.
 */
export function sessionAuthenticationTime(claims: {
  amr?: unknown;
}): string | undefined {
  if (!Array.isArray(claims.amr)) return undefined;
  const primary = new Set([
    "password",
    "oauth",
    "otp",
    "magiclink",
    "sso/saml",
    "recovery",
  ]);
  const timestamps = claims.amr
    .filter(
      (x) =>
        x &&
        primary.has(x.method) &&
        Number.isFinite(x.timestamp) &&
        x.timestamp > 0,
    )
    .map((x) => x.timestamp as number);
  if (!timestamps.length) return undefined;
  const time = Math.max(...timestamps) * 1000;
  return Number.isFinite(new Date(time).getTime())
    ? new Date(time).toISOString()
    : undefined;
}
