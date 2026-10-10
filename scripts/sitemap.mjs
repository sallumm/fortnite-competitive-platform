import { loadEnv } from "vite";
const env = {
  ...loadEnv("production", process.cwd(), "VITE_"),
  ...process.env,
};
import { writeFileSync } from "node:fs";
const raw = env.VITE_SITE_URL;
if (!raw) {
  console.info("Sitemap omitido: VITE_SITE_URL ainda não definido.");
  process.exit(0);
}
const base = new URL(raw);
if (!["https:", "http:"].includes(base.protocol))
  throw new Error("VITE_SITE_URL inválido");
const paths = [
  "/",
  "/library",
  "/competitive",
  "/news",
  "/academy",
  "/academy/research",
  "/academy/curriculum",
  "/help",
  "/community",
  "/legal/privacy",
  "/legal/terms",
];
// Editorial pages need a database-aware sitemap after live publishing; no stale seed URLs here.
writeFileSync(
  "dist/sitemap.xml",
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    paths
      .map(
        (p) =>
          "<url><loc>" +
          new URL(p, base).href.replaceAll("&", "&amp;") +
          "</loc></url>",
      )
      .join("") +
    "</urlset>",
);
writeFileSync(
  "dist/robots.txt",
  "User-agent: *\nAllow: /\nDisallow: /app/\nDisallow: /admin\nDisallow: /auth\nDisallow: /onboarding\nSitemap: " +
    new URL("/sitemap.xml", base).href +
    "\n",
);
