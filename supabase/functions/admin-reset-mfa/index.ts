import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { AUDIT_ACTION, resetMfa } from "./handler.ts";

// verify_jwt = true (supabase/config.toml). Not deployed by this change; see docs/phase25/README.md.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const err = (e: { code?: string; status?: number; message?: string } | null) =>
  e ? { code: e.code ?? String(e.status ?? ""), message: e.message } : null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) return json({ error: "not_configured" }, 503);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const payload = await req.json().catch(() => ({}));

    const result = await resetMfa(token, payload, {
      getUser: async (t) => {
        const { data, error } = await admin.auth.getUser(t);
        return error || !data?.user ? null : { id: data.user.id };
      },
      isSuperAdmin: async (id) => {
        const { data, error } = await admin.rpc("is_super_admin", { _user_id: id });
        return !error && data === true;
      },
      recentResets: async (callerId, since) => {
        const { count, error } = await admin.from("audit_logs").select("id", { count: "exact", head: true })
          .eq("action", AUDIT_ACTION).eq("details->>admin_id", callerId).gte("created_at", since);
        return error ? Number.MAX_SAFE_INTEGER : (count ?? 0); // fail closed
      },
      listFactorIds: async (userId) => {
        const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
        return { ids: (data?.factors ?? []).map((f: { id: string }) => f.id), error: err(error) };
      },
      deleteFactor: async (userId, id) => {
        const { error } = await admin.auth.admin.mfa.deleteFactor({ id, userId });
        return { error: err(error) };
      },
      audit: async (row) => {
        const { error } = await admin.from("audit_logs").insert(row);
        return { error: err(error) };
      },
    });
    return json(result.body, result.status);
  } catch (e) {
    console.error("admin-reset-mfa: unexpected error", e instanceof Error ? e.name : "unknown");
    return json({ error: "unexpected" }, 500);
  }
});
