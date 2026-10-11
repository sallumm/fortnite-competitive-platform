import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { knowledgeHandler } from "../_shared/knowledge/handler.ts";
import { OpenAIProvider } from "../_shared/coach/provider.ts";
import type { KnowledgeRow } from "../_shared/knowledge/domain.ts";
const key = Deno.env.get("OPENAI_API_KEY");
Deno.serve(
  knowledgeHandler({
    origin: Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173",
    provider: key ? new OpenAIProvider(key) : undefined,
    backend: (token) => {
      const c = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          global: { headers: { Authorization: "Bearer " + token } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      return {
        authenticate: async (t) => {
          const { data, error } = await c.auth.getUser(t);
          return !error && !!data.user;
        },
        rpc: async (name, args) => {
          const { data, error } = await c.rpc(name, args);
          if (error) throw new Error(error.message);
          return data;
        },
        settings: async () => {
          const { data, error } = await c
            .from("knowledge_settings")
            .select("enabled,external_enabled,detail")
            .single();
          if (error) throw error;
          return data;
        },
        editorial: async (query, mode, season, version, region, current) => {
          const { data, error } = await c.rpc("knowledge_editorial", {
            p_query: query,
            p_mode: mode,
            p_season: season,
            p_version: version,
            p_region: region,
            p_current: current,
          });
          if (error) throw error;
          return data as KnowledgeRow[];
        },
      };
    },
  }),
);
