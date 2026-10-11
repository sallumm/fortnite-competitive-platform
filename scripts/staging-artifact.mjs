import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const robots = "User-agent: *\nDisallow: /\n";
const stagingHeaders =
  "  X-Robots-Tag: noindex, nofollow, noarchive\n  Cache-Control: no-store\n";
function htmlFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory()
      ? htmlFiles(path)
      : entry.isFile() && entry.name.endsWith(".html")
        ? [path]
        : [];
  });
}
export function prepareStagingArtifact(root = "dist") {
  if (!existsSync(join(root, "index.html")))
    throw new Error("Build ausente; staging não preparado.");
  for (const file of htmlFiles(root)) {
    const html = readFileSync(file, "utf8");
    if (!html.includes("</head>"))
      throw new Error("HTML sem head; staging não preparado.");
    writeFileSync(
      file,
      html
        .replace(/<meta\b[^>]*name=["'](?:robots|googlebot)["'][^>]*>/gi, "")
        .replace(
          "</head>",
          '<meta name="robots" content="noindex, nofollow, noarchive"></head>',
        ),
    );
  }
  writeFileSync(join(root, "robots.txt"), robots);
  // Only this generated build file is removed, never source/migrations/user data.
  rmSync(join(root, "sitemap.xml"), { force: true });
  const headersPath = join(root, "_headers");
  const headers = readFileSync(headersPath, "utf8");
  if (!headers.startsWith("/*"))
    throw new Error("Headers globais ausentes; staging não preparado.");
  writeFileSync(
    headersPath,
    headers.replace(/^\/\*\r?\n/, "/*\n" + stagingHeaders),
  );
  writeFileSync(join(root, "_redirects"), "/* /index.html 200\n");
  assertStagingArtifact(root);
}
export function assertStagingArtifact(root = "dist") {
  if (
    readFileSync(join(root, "robots.txt"), "utf8") !== robots ||
    existsSync(join(root, "sitemap.xml"))
  )
    throw new Error("Staging indexável: robots/sitemap inválido.");
  if (
    !htmlFiles(root).length ||
    htmlFiles(root).some(
      (file) =>
        !readFileSync(file, "utf8").includes(
          'name="robots" content="noindex, nofollow, noarchive"',
        ),
    )
  )
    throw new Error("Staging indexável: HTML sem noindex.");
  const headers = readFileSync(join(root, "_headers"), "utf8");
  if (
    !headers.includes(stagingHeaders) ||
    !headers.includes("Content-Security-Policy:") ||
    !headers.includes("frame-ancestors 'none'")
  )
    throw new Error("Headers de staging incompletos.");
  if (readFileSync(join(root, "_redirects"), "utf8") !== "/* /index.html 200\n")
    throw new Error("Fallback SPA de staging ausente.");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.includes("--check")) assertStagingArtifact();
  else if (process.env.KYRVEN_BUILD_TARGET === "staging")
    prepareStagingArtifact();
  else throw new Error("Preparação exige build de staging explícito.");
  console.info(
    "Artefato de staging validado localmente; não comprova hospedagem ou controle de acesso.",
  );
}
