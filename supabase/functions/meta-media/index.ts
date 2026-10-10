import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { mediaHandler } from "../_shared/meta-media.ts";
const url = Deno.env.get("SUPABASE_URL")!,
  key = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const client = (token: string) =>
  createClient(url, key, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
Deno.serve(
  mediaHandler(
    {
      async authorize(token) {
        const c = client(token);
        const { data, error } = await c.auth.getUser();
        if (error || !data.user) return null;
        const role = await c.rpc("is_admin");
        return role.data === true ? { id: data.user.id } : null;
      },
      async quota(token) {
        const { error } = await client(token).rpc("meta_editor_media_quota");
        return !error;
      },
      async upload(path, bytes) {
        const { error } = await admin.storage
          .from("meta-images")
          .upload(path, bytes, { contentType: "image/png", upsert: false });
        return !error;
      },
      async insert(path, size, info, actor) {
        const { data, error } = await admin.rpc("register_meta_asset", {
          p_path: path,
          p_size: size,
          p_info: info,
          p_actor: actor,
        });
        if (error) throw error;
        return data;
      },
      async removable(token, id) {
        const { data, error } = await client(token).rpc(
          "reserve_meta_asset_remove",
          { a: id },
        );
        return error || !data ? null : { path: data.path };
      },
      async remove(path, id) {
        const { error } = await admin.storage
          .from("meta-images")
          .remove([path]);
        if (error) {
          if (id)
            await admin
              .from("meta_assets")
              .update({ status: "active" })
              .eq("id", id);
          return false;
        }
        if (id) {
          const r = await admin.from("meta_assets").delete().eq("id", id);
          return !r.error;
        }
        return true;
      },
    },
    Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173",
  ),
);
