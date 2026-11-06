import { serve as stdServe } from "https://deno.land/std@0.190.0/http/server.ts";
import { guardedServe } from '../_shared/demo-guard.ts';
// Demo read-only: a demo person is refused (403) before the handler runs (docs/demo-readonly).
const serve = guardedServe(stdServe);
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { type BeginResult, startTopupCheckout } from "./handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
// Ids and codes only; never card or customer details.
const logStep = (step: string, details?: unknown) =>
  console.log(`[AI-TOPUP-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.email) return json({ error: "Unauthorized" }, 401);
    const user = { id: userData.user.id, email: userData.user.email };
    const payload = await req.json().catch(() => ({}));

    const enabled = Deno.env.get("AI_TOPUPS_ENABLED") === "true";
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (enabled && !stripeKey) return json({ error: "Billing is not configured" }, 503);
    const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2023-10-16" }) : null;

    const r = await startTopupCheckout(user, payload, req.headers.get("origin"), {
      stripe,
      enabled,
      log: logStep,
      begin: async (userId, packId) => {
        const { data, error } = await supabase.rpc("begin_ai_topup_checkout", { p_user_id: userId, p_pack_id: packId });
        if (error) throw new Error(`begin_ai_topup_checkout: ${error.code ?? "error"}`);
        return data as BeginResult;
      },
      attach: async (checkoutId, sessionId) => {
        const { error } = await supabase.rpc("attach_ai_topup_session", { p_checkout_id: checkoutId, p_session_id: sessionId });
        if (error) throw new Error(`attach_ai_topup_session: ${error.code ?? "error"}`);
      },
      storedCustomerId: async (userId) => {
        const { data } = await supabase.from("subscribers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
        return (data?.stripe_customer_id as string | null) ?? null;
      },
    });
    return json(r.body, r.status);
  } catch (error) {
    logStep("ERROR", { message: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return json({ error: "topup_unavailable", message: "Couldn't start the top-up. Please try again." }, 500);
  }
});
