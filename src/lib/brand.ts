import type { Catalog } from "./types";
/** Display-only compatibility for old editorial branding. Never rewrite IDs, URLs or snapshots. */
export const brandText = (value: string) => value.replace(/Clutchfolio/gi, "kyrven").replace(/Clutch Coach/g, "kyrven coach");
export function brandCatalog(c: Catalog): Catalog {
  return { ...c, articles: c.articles.map(a => ({...a, title: brandText(a.title), summary: brandText(a.summary), body: brandText(a.body), author: brandText(a.author)})) };
}
