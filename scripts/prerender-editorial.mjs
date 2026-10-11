import { loadEnv } from "vite";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { productionIssues } from "./production-check.mjs";
export const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export function editorialSnapshot(template, article, origin, now = new Date()) {
  if (
    !article.published ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) ||
    !["news", "analysis", "lesson"].includes(article.kind) ||
    !Number.isFinite(Date.parse(article.published_at)) ||
    Date.parse(article.published_at) > now.getTime() ||
    !/^https:\/\/[^\s]+$/.test(article.source_url)
  )
    return null;
  // Display compatibility for historical records; stored IDs/content are preserved.
  const normalize = (v) =>
    String(v)
      .replace(/Clutchfolio/gi, "kyrven")
      .replace(/Clutch Coach/gi, "kyrven coach");
  article = {
    ...article,
    title: normalize(article.title),
    summary: normalize(article.summary),
    body: normalize(article.body),
  };
  const path = `/${article.kind === "lesson" ? "academy" : "news"}/${article.slug}`;
  const canonical = new URL(path, origin).href;
  const stale =
    !Number.isFinite(Date.parse(article.verified_at)) ||
    !article.valid_until ||
    Date.parse(article.valid_until) < now.getTime();
  let html = template.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHTML(article.title)} — kyrven</title>`,
  );
  html = html.replace(
    /<meta\s+(?:name="description"|property="og:[^"]+")\s+content="[^"]*"\s*\/>/g,
    "",
  );
  html = html.replace(
    "</head>",
    `<meta name="description" content="${escapeHTML(article.summary)}"><meta property="og:title" content="${escapeHTML(article.title)}"><meta property="og:description" content="${escapeHTML(article.summary)}"><meta property="og:image" content="${escapeHTML(new URL("/brand/social.png", origin).href)}"><meta property="og:type" content="article"><meta property="og:url" content="${escapeHTML(canonical)}"><link rel="canonical" href="${escapeHTML(canonical)}"></head>`,
  );
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root"><main class="reading-page article-body"><a href="/">kyrven</a><article><h1>${escapeHTML(article.title)}</h1><p>${escapeHTML(article.summary)}</p><p>Publicado em ${escapeHTML(article.published_at.slice(0, 10))} · Verificado em ${escapeHTML(article.verified_at?.slice(0, 10) || "não informado")}</p>${stale ? "<p>Informação precisa de revisão. Confira a fonte original.</p>" : ""}${String(
      article.body,
    )
      .split(/\n\s*\n/)
      .map((text) => `<p>${escapeHTML(text)}</p>`)
      .join(
        "",
      )}<a href="${escapeHTML(article.source_url)}" rel="noopener noreferrer">Fonte original</a></article></main></div>`,
  );
  return { path, html };
}
export async function prerender(env = process.env, fetcher = fetch) {
  if (env.KYRVEN_BUILD_TARGET === "staging") {
    console.info("Staging: pré-renderização remota desativada.");
    return;
  }
  if (env.PRERENDER_PUBLIC !== "1") {
    console.info("Pré-renderização editorial opcional desativada.");
    return;
  }
  const issues = productionIssues(env);
  if (issues.length) throw new Error(issues.join("\n"));
  const template = readFileSync("dist/index.html", "utf8");
  const pages = [];
  const now = new Date();
  for (let offset = 0; ; offset += 100) {
    const url = new URL("/rest/v1/articles", env.VITE_SUPABASE_URL);
    url.search = new URLSearchParams({
      select:
        "slug,title,kind,summary,body,source_url,verified_at,published_at,valid_until,published",
      published: "eq.true",
      published_at: "lte." + now.toISOString(),
      order: "id.asc",
      offset: String(offset),
      limit: "100",
    }).toString();
    const response = await fetcher(url, {
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        "Não foi possível obter o catálogo público para pré-renderização.",
      );
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Catálogo público inválido.");
    for (const article of rows) {
      const page = editorialSnapshot(template, article, env.VITE_SITE_URL, now);
      if (!page) continue;
      mkdirSync(`dist${page.path}`, { recursive: true });
      writeFileSync(`dist${page.path}/index.html`, page.html);
      pages.push(page.path);
    }
    if (rows.length < 100) break;
  }
  const sitemap = readFileSync("dist/sitemap.xml", "utf8");
  writeFileSync(
    "dist/sitemap.xml",
    sitemap.replace(
      "</urlset>",
      pages
        .map(
          (path) =>
            `<url><loc>${escapeHTML(new URL(path, env.VITE_SITE_URL).href)}</loc></url>`,
        )
        .join("") + "</urlset>",
    ),
  );
  console.info(
    `${pages.length} páginas editoriais públicas pré-renderizadas. Republicar após mudanças editoriais.`,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await prerender({
    ...(process.env.KYRVEN_BUILD_TARGET === "staging"
      ? {}
      : loadEnv("production", process.cwd(), "")),
    ...process.env,
  });
