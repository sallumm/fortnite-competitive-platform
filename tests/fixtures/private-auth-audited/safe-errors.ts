// No original message, stack, cause, SDK payload or callback URL crosses this boundary.
export async function privateAuthOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch {
    const error = new Error(
      "Auth acceptance failed; private details suppressed.",
    );
    error.stack = error.message;
    throw error;
  }
}
export function isSecurityDestination(value: string): boolean {
  try {
    return new URL(value).pathname === "/security";
  } catch {
    return false;
  }
}
