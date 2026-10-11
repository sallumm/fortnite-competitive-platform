import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { recruitmentHandler } from "../_shared/recruitment.ts";
const url = Deno.env.get("SUPABASE_URL")!,
  key = Deno.env.get("SUPABASE_ANON_KEY")!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = (token: string) =>
  createClient(url, key, {
    ...options,
    global: { headers: { Authorization: "Bearer " + token } },
  });
const server = createClient(
  url,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  options,
);
Deno.serve(
  recruitmentHandler(
    {
      async user(token) {
        const { data, error } = await client(token).auth.getUser();
        return error ? null : data.user?.id || null;
      },
      async reserve(token) {
        const { data, error } = await client(token).rpc(
          "reserve_captcha_request",
        );
        return !error && data === true;
      },
      async issue(user, cycle) {
        const { data, error } = await server.rpc("issue_captcha_ticket", {
          p_user: user,
          p_cycle: cycle,
        });
        if (error) throw error;
        return data;
      },
      async submit(token, cycle, payload, ticket) {
        const { data, error } = await client(token).rpc("esports_submit", {
          p_cycle: cycle,
          p_payload: payload,
          p_ticket: ticket,
        });
        if (error) throw error;
        return data;
      },
      fetch,
    },
    Deno.env.get("ALLOWED_ORIGIN") || "",
    Deno.env.get("TURNSTILE_SECRET_KEY") || "",
  ),
);
