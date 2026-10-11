import { loadEnv } from "vite";
import { pathToFileURL } from "node:url";
import { productionIssues } from "./production-check.mjs";

export function stagingIssues(env) {
  const issues = productionIssues(env)
    .filter((issue) => !issue.includes("não use chave de teste"))
    .map((issue) =>
      issue.replace("obrigatório para produção", "obrigatório para staging"),
    );
  if (!/^[a-z0-9]{20}$/.test(env.KYRVEN_STAGING_PROJECT_REF || ""))
    issues.push(
      "KYRVEN_STAGING_PROJECT_REF: informe o ref do projeto identificado",
    );
  else if (
    env.VITE_SUPABASE_URL !==
    `https://${env.KYRVEN_STAGING_PROJECT_REF}.supabase.co`
  )
    issues.push(
      "VITE_SUPABASE_URL: não corresponde ao projeto de staging identificado",
    );
  if (env.PRERENDER_PUBLIC === "1")
    issues.push(
      "PRERENDER_PUBLIC: staging não deve consultar/publicar catálogo remoto no build",
    );
  return issues;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const issues = stagingIssues({
    ...loadEnv("staging", process.cwd(), ""),
    ...process.env,
  });
  if (issues.length) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
  } else {
    console.info(
      "Formato das variáveis válido. Projeto, Access, Auth e HTTP ainda exigem verificação real autorizada.",
    );
  }
}
