import { supabase } from "./client";
import {
  editorialSchema,
  editorialDraftSchema,
  type EditorialContent,
  type MetaDraft,
  type MetaEdition,
  type MetaAsset,
} from "./meta-editorial";
function connection() {
  if (!supabase)
    throw new Error("Conecte uma conta administrativa para editar o Meta.");
  return supabase;
}
function failure(error: unknown) {
  if (error)
    throw new Error(
      "Não foi possível salvar. Confira os campos, permissões e limites de uso. Se outro editor alterou o conteúdo, recarregue antes de tentar novamente.",
    );
}
async function all<T>(table: string): Promise<T[]> {
  const client = connection(),
    rows: T[] = [];
  for (let i = 0; i < 10000; i += 500) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .order(table === "meta_editions" ? "entry_id" : "id")
      .range(i, i + 499);
    failure(error);
    rows.push(...((data || []) as T[]));
    if ((data?.length || 0) < 500) return rows;
  }
  throw new Error(
    "Use filtros no servidor antes de ampliar este volume editorial.",
  );
}
export async function loadEditorial() {
  if (!supabase)
    return { editions: [] as MetaEdition[], assets: [] as MetaAsset[] };
  const [editions, assets] = await Promise.all([
    all<MetaEdition>("meta_editions"),
    all<MetaAsset>("meta_assets"),
  ]);
  return { editions, assets };
}
export async function loadDrafts() {
  return all<MetaDraft>("meta_drafts");
}
export async function saveDraft(
  payload: EditorialContent,
  status: "draft" | "review",
  draft: MetaDraft | null,
) {
  const p = (status === "draft" ? editorialDraftSchema : editorialSchema).parse(
    payload,
  );
  const { data, error } = await connection().rpc("save_meta_draft", {
    p_payload: p,
    p_status: status,
    p_id: draft?.id || null,
    p_expected: draft?.version || 0,
  });
  failure(error);
  return data as MetaDraft;
}
export async function publishDraft(d: MetaDraft, withdraw = false) {
  const { data, error } = await connection().rpc("publish_meta_draft", {
    p_id: d.id,
    p_expected: d.version,
    p_withdraw: withdraw,
  });
  failure(error);
  return data as string;
}
export async function draftHistory(id: string) {
  const { data, error } = await connection()
    .from("meta_draft_history")
    .select("version,status,created_at,actor_id")
    .eq("draft_id", id)
    .order("version", { ascending: false })
    .limit(100);
  failure(error);
  return data as {
    version: number;
    status: string;
    created_at: string;
    actor_id: string | null;
  }[];
}
export async function restoreDraft(d: MetaDraft, version: number) {
  const { data, error } = await connection().rpc("restore_meta_draft", {
    p_id: d.id,
    p_expected: d.version,
    p_version: version,
  });
  failure(error);
  return data as MetaDraft;
}
export async function registerMeta(
  table: "seasons" | "versions" | "modes" | "formats" | "contexts" | "sources",
  input: Record<string, unknown>,
) {
  const { error } = await connection()
    .from("meta_" + table)
    .insert(input);
  failure(error);
}
export async function imageUrl(asset: MetaAsset) {
  const { data, error } = await connection()
    .storage.from("meta-images")
    .createSignedUrl(asset.path, 300);
  failure(error);
  return data!.signedUrl;
}
export async function uploadImage(
  file: File,
  info: { alt: string; source_url: string; rights: string; credit: string },
) {
  if (
    file.size > 3 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new Error("Envie PNG, JPEG ou WebP de até 3 MB.");
  // Decode and re-encode as PNG to remove metadata and active/polyglot payloads before sending.
  const bitmap = await createImageBitmap(file);
  let blob: Blob | null = null;
  try {
    if (
      bitmap.width > 4096 ||
      bitmap.height > 4096 ||
      bitmap.width * bitmap.height > 8_000_000
    )
      throw new Error("A imagem excede os limites de resolução.");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  } finally {
    bitmap.close();
  }
  if (!blob || blob.size > 3 * 1024 * 1024)
    throw new Error("A imagem normalizada excede 3 MB; reduza sua resolução.");
  const body = new FormData();
  body.set("file", blob, "image.png");
  for (const [k, v] of Object.entries(info)) body.set(k, v);
  const { data, error } = await connection().functions.invoke("meta-media", {
    body,
  });
  if (error || data?.error)
    throw new Error(
      "Upload não concluído. Verifique direitos, tamanho, permissões e configuração do armazenamento.",
    );
  return data as MetaAsset;
}
export async function removeImage(a: MetaAsset) {
  const { data, error } = await connection().functions.invoke("meta-media", {
    body: { id: a.id },
    method: "DELETE",
  });
  if (error || data?.error)
    throw new Error(
      "A imagem não foi removida. Mídias já publicadas são preservadas no histórico; retire a associação do rascunho antes de remover uma mídia não publicada.",
    );
}

export async function loadSeasons() {
  return all<{ id: string; title: string }>("meta_seasons");
}
