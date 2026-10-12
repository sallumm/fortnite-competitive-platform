export const phases = Object.freeze([
  "collection",
  "beforeAll",
  "setup",
  "body",
  "teardown",
  "afterAll",
  "cleanup",
]);
export const scenarios = Object.freeze([
  "success",
  ...phases,
  "timeout",
  "matcher",
  "console",
  "attachment",
  "unexpected",
  "worker-crash",
]);
export function privatePolicy(argv, env) {
  const forbidden = Object.keys(env).some(
    (k) =>
      env[k] &&
      ((k.toUpperCase() !== "PWD" &&
        /^(DEBUG|NODE_OPTIONS|NODE_DEBUG|PW.*|PLAYWRIGHT.*)$/.test(
          k.toUpperCase(),
        )) ||
        k.toUpperCase().startsWith("KYRVEN_AUTH_TEST_")),
  );
  if (
    forbidden ||
    argv.length > 1 ||
    argv.some((a) => !/^--scenario=[a-zA-Z-]+$/.test(a))
  )
    throw new Error("Private runner controls rejected.");
  const scenario = argv.length
    ? argv[0].slice("--scenario=".length)
    : "success";
  if (!scenarios.includes(scenario))
    throw new Error("Private runner controls rejected.");
  if (
    env.KYRVEN_SYNTHETIC_MARKER &&
    !/^FICTITIOUS_[A-Za-z0-9_-]{1,128}$/.test(env.KYRVEN_SYNTHETIC_MARKER)
  )
    throw new Error("Synthetic input required.");
  return scenario;
}
export function safeResult(value, expected) {
  return (
    !!value &&
    typeof value === "object" &&
    Object.keys(value).sort().join(",") === "ok,phase,type" &&
    value.type === "result" &&
    value.phase === expected &&
    typeof value.ok === "boolean"
  );
}
