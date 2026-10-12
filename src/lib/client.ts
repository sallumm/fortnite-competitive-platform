import { createClient } from "@supabase/supabase-js";
import { passwordCallback } from "./auth-flow";
// Capture before detectSessionInUrl can consume/remove the callback fragment.
export let authPasswordFlow =
  typeof window !== "undefined" &&
  passwordCallback(window.location.search, window.location.hash);
export function clearAuthPasswordFlow() {
  authPasswordFlow = false;
}
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
export const configured = Boolean(supabase);
