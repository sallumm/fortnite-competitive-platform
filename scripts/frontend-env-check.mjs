import { loadEnv } from "vite";
import { productionIssues } from "./production-check.mjs";
const env = {
  ...loadEnv(
    process.env.KYRVEN_BUILD_TARGET === "staging" ? "staging" : "production",
    process.cwd(),
    "VITE_",
  ),
  ...process.env,
};
const issues = productionIssues(env).filter((issue) =>
  /segredo|somente chave pública/.test(issue),
);
if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
}
