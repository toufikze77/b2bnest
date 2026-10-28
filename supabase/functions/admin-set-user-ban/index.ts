import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { BAN_DURATION, setUserBan } from "./handler.ts";

// verify_jwt = true (supabase/config.toml). Not deployed by this change; see docs/phase12c/README.md for the order.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !anonKey || !serviceKey) return json({ error: "not_configured" }, 503);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const payload = await req.json().catch(() => ({}));

    const result = await setUserBan(token, payload, {
      getUser: async (t) => {
        const { data, error } = await admin.auth.getUser(t);
        return error || !data?.user ? null : { id: data.user.id };
      },
      setStatus: async (t, userId, active) => {
        // As the caller: the database decides who may do this and writes the audit row.
        const asCaller = createClient(url, anonKey, {
          global: { headers: { Authorization: `Bearer ${t}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error } = await asCaller.rpc("admin_set_user_status", { _user_id: userId, _active: active });
        return { error: error ? { code: error.code, message: error.message } : null };
      },
      setBan: async (userId, banned) => {
        const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: banned ? BAN_DURATION : "none" });
        return { error: error ? { code: (error as { code?: string }).code ?? String(error.status ?? ""), message: error.message } : null };
      },
    });
    return json(result.body, result.status);
  } catch (e) {
    console.error("admin-set-user-ban: unexpected error", e instanceof Error ? e.name : "unknown");
    return json({ error: "unexpected" }, 500);
  }
});
