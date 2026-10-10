import { useEffect } from "react";
import type { Article } from "./types";
export function useSEO(title: string, description: string, article?: Article) {
  useEffect(() => {
    document.title = title + " — kyrven";
    const values: Record<string, string> = {
      description,
      "og:title": title,
      "og:description": description,
      "og:type": article ? "article" : "website",
      "og:url": location.href,
    };
    if (article) {
      values["article:published_time"] = article.published_at;
      values["article:modified_time"] = article.verified_at;
    }
    for (const [key, value] of Object.entries(values)) {
      const attribute = key === "description" ? "name" : "property";
      let meta = document.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${key}"]`,
      );
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attribute, key);
        document.head.appendChild(meta);
      }
      meta.content = value;
    }
    document
      .querySelectorAll('link[rel="canonical"]')
      .forEach((node) => node.remove());
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = location.origin + location.pathname;
    document.head.appendChild(canonical);
    let script: HTMLScriptElement | undefined;
    if (article) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": article.kind === "news" ? "NewsArticle" : "Article",
        headline: article.title,
        description: article.summary,
        datePublished: article.published_at,
        dateModified: article.verified_at,
        author: { "@type": "Organization", name: article.author },
        citation: article.source_url,
        url: canonical.href,
      });
      document.head.appendChild(script);
    }
    return () => {
      canonical.remove();
      script?.remove();
      document
        .querySelector('meta[property="article:published_time"]')
        ?.remove();
      document
        .querySelector('meta[property="article:modified_time"]')
        ?.remove();
    };
  }, [title, description, article]);
}
