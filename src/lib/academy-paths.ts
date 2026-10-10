import { z } from "zod";
import { supabase } from "./client";
import { tracks } from "./academy";
export const pathSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{3,60}$/),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(1000),
    slugs: z
      .array(z.string().regex(/^[a-z0-9-]{3,100}$/))
      .min(1)
      .max(100),
    published: z.boolean(),
    position: z.number().int().min(0).max(1000),
  })
  .strict()
  .refine(
    (p) => new Set(p.slugs).size === p.slugs.length,
    "Remova aulas duplicadas.",
  );
export type AcademyPath = z.infer<typeof pathSchema>;
export async function loadPaths(demo: boolean) {
  if (demo || !supabase)
    return tracks.map((t, i) => ({
      ...t,
      description:
        "Percurso editorial parcial, com bases sugeridas e acesso livre às aulas.",
      published: true,
      position: i,
    }));
  const { data, error } = await supabase
    .from("academy_paths")
    .select("*")
    .order("position");
  if (error) throw new Error("Não foi possível consultar as trilhas.");
  return z.array(pathSchema).parse(data);
}
export async function savePath(path: AcademyPath) {
  if (!supabase) throw new Error("A administração precisa estar configurada.");
  const { error } = await supabase
    .from("academy_paths")
    .upsert(pathSchema.parse(path));
  if (error)
    throw new Error(
      "A trilha não foi salva. Confira permissões e aulas publicadas.",
    );
}
