import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { deletionHandler } from "../_shared/delete-account.ts";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(deletionHandler({
  async user(token) {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user;
  },
  async deleteUser(id) {
    const { error } = await admin.auth.admin.deleteUser(id);
    return !error;
  },
}, Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173"));
