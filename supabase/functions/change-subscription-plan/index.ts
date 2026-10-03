import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveStripePrice } from "../_shared/plans.ts";
import { changePlan } from "./handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "billing_not_configured" }, 503);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const payload = await req.json().catch(() => ({}));

    const result = await changePlan(token, payload, {
      stripe,
      getUser: async (t) => {
        const { data, error } = await supabase.auth.getUser(t);
        return error || !data?.user?.email ? null : { id: data.user.id, email: data.user.email };
      },
      getStoredCustomerId: async (userId) => {
        const { data } = await supabase.from("subscribers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
        return (data?.stripe_customer_id as string | null) ?? null;
      },
      resolvePrice: async (plan, interval) => (await resolveStripePrice(stripe, plan, interval)).priceId,
    });
    if (result.status === 200 && result.body.subscriptionId) console.log("[CHANGE-PLAN] updated", JSON.stringify({ plan: result.body.plan, interval: result.body.interval }));
    return json(result.body, result.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CHANGE-PLAN] error", message);
    return json({ error: "server_error", message: "Your plan hasn't changed. Please try again later." }, 500);
  }
});
