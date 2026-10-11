import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { deletionHandler } from "../_shared/delete-account.ts";
import { sessionAuthenticationTime } from "../_shared/session-authentication.ts";
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
Deno.serve(
  deletionHandler(
    {
      async user(token) {
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data.user) return null;
        const caller = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          {
            global: { headers: { Authorization: "Bearer " + token } },
            auth: { persistSession: false, autoRefreshToken: false },
          },
        );
        const status = await caller.rpc("security_status");
        if (status.error) return null;
        const verified = await caller.auth.getClaims(token);
        if (
          verified.error ||
          !verified.data ||
          verified.data.claims.sub !== data.user.id
        )
          return null;
        return {
          ...data.user,
          last_sign_in_at: sessionAuthenticationTime(verified.data.claims),
          mfaRequired: status.data?.privileged === true,
          mfaVerified: status.data?.aal2 === true,
        };
      },
      async deleteUser(id) {
        const { error } = await admin.auth.admin.deleteUser(id);
        return !error;
      },
    },
    Deno.env.get("ALLOWED_ORIGIN") || "http://localhost:5173",
  ),
);
