import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { coachHandler } from "../_shared/coach/handler.ts";
import { OpenAIProvider } from "../_shared/coach/provider.ts";
import { defaults } from "../_shared/coach/domain.ts";
const url = Deno.env.get("SUPABASE_URL")!,
  anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const key = Deno.env.get("OPENAI_API_KEY");
Deno.serve(
  coachHandler({
    origin: Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173",
    provider: key ? new OpenAIProvider(key) : undefined,
    backend: (token) => {
      // All queries retain the user's JWT and RLS. No service-role client in the Coach.
      const client = createClient(url, anon, {
        global: { headers: { Authorization: "Bearer " + token } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return {
        authenticate: async (token) => {
          const { data, error } = await client.auth.getUser(token);
          return !error && !!data.user;
        },
        preferences: async () => {
          const { data, error } = await client
            .from("coach_preferences")
            .select(
              "context_enabled,external_enabled,history_enabled,proactive_enabled,consent_version",
            )
            .maybeSingle();
          if (error) throw error;
          return data || defaults;
        },
        rpc: async (name, args) => {
          const { data, error } = await client.rpc(name, args);
          if (error) throw new Error(error.message);
          return data;
        },
      };
    },
  }),
);
