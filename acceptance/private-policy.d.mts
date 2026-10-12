export const phases: readonly string[];
export const scenarios: readonly string[];
export function privatePolicy(argv: string[], env: Record<string,string|undefined>): string;
export function safeResult(value: unknown, expected: string|undefined): boolean;
