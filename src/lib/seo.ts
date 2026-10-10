import { useEffect } from "react";
export function useSEO(title: string, description: string) {
  useEffect(() => {
    document.title = title + " — Clutchfolio";
    for (const [key, value] of [
      ["description", description],
      ["og:title", title],
      ["og:description", description],
    ]) {
      const attribute = key.startsWith("og:") ? "property" : "name";
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
  }, [title, description]);
}
