import { supabase } from "./client";
import {
  metaEntrySchema,
  metaWriteIssues,
  type MetaCatalog,
  type MetaEntry,
} from "./meta";
export async function loadMeta(demo = false): Promise<MetaCatalog> {
  if (!supabase || demo)
    return (await import("./meta-catalog")).default as MetaCatalog;
  const names = [
    "versions",
    "modes",
    "formats",
    "contexts",
    "sources",
    "entries",
    "links",
  ] as const;
  const results = await Promise.all(
    names.map(async (name) => {
      const rows: Record<string, unknown>[] = [];
      for (let offset = 0; offset < 10000; offset += 500) {
        const { data, error } = await supabase!
          .from("meta_" + name)
          .select("*")
          .order("id")
          .range(offset, offset + 499);
        if (error)
          throw new Error(
            "A base de meta não pôde ser carregada. Tente novamente.",
          );
        rows.push(...(data || []));
        if ((data?.length || 0) < 500) return [name, rows] as const;
      }
      throw new Error(
        "A base editorial precisa de filtros no servidor para este volume. A consulta foi interrompida para evitar dados incompletos.",
      );
    }),
  );
  return { investigated_at: "", ...Object.fromEntries(results) } as MetaCatalog;
}
export async function appendMeta(
  input: unknown,
  catalog: MetaCatalog,
): Promise<MetaEntry> {
  if (!supabase)
    throw new Error(
      "Revisão editorial exige uma conta administrativa conectada.",
    );
  const entry = metaEntrySchema.parse(input);
  const issues = metaWriteIssues(entry, catalog);
  if (issues.length) throw new Error(issues.join(". "));
  const { error } = await supabase.from("meta_entries").insert(entry);
  if (error)
    throw new Error(
      "A revisão não foi salva. Confira permissões, fontes e se outro editor publicou uma revisão. Recarregue antes de tentar novamente.",
    );
  return entry;
}
