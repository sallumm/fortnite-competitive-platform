import { loadEnv } from "vite";
import { pathToFileURL } from "node:url";
export function productionIssues(env) {
  const issues = [];
  for (const name of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_SITE_URL",
  ])
    if (!env[name]) issues.push(`${name}: obrigatório para produção`);
  for (const name of ["VITE_SUPABASE_URL", "VITE_SITE_URL"]) {
    if (!env[name]) continue;
    try {
      const url = new URL(env[name]);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (name === "VITE_SITE_URL" && url.pathname !== "/")
      )
        issues.push(`${name}: use uma origem HTTPS`);
    } catch {
      issues.push(`${name}: URL inválida`);
    }
  }
  const key = env.VITE_SUPABASE_ANON_KEY || "";
  let role;
  try {
    role = JSON.parse(
      Buffer.from(key.split(".")[1] || "", "base64url").toString(),
    ).role;
  } catch {
    /* New publishable keys are not JWTs. */
  }
  if (key && !(key.startsWith("sb_publishable_") || role === "anon"))
    issues.push(
      "VITE_SUPABASE_ANON_KEY: somente chave pública anon/publishable",
    );
  for (const name of Object.keys(env))
    if (
      name.startsWith("VITE_") &&
      /(?:SERVICE_ROLE|SECRET|OPENAI|API_KEY)/i.test(name)
    )
      issues.push(`${name}: segredo não pode ser incluído no frontend`);
  if (
    env.VITE_DISCORD_INVITE &&
    !/^https:\/\/(?:discord\.gg\/|discord\.com\/invite\/)[a-zA-Z0-9_-]+$/.test(
      env.VITE_DISCORD_INVITE,
    )
  )
    issues.push("VITE_DISCORD_INVITE: convite inválido");
  return issues;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const issues = productionIssues({
    ...loadEnv("production", process.cwd(), "VITE_"),
    ...process.env,
  });
  if (issues.length) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
  } else
    console.info(
      "Variáveis públicas válidas. Ainda é necessário validar banco, funções e fluxos reais.",
    );
}
