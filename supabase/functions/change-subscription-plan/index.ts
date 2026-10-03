// Changes the plan on the customer's EXISTING Stripe subscription.
// Never creates a subscription: if none exists, the caller is told to use checkout.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { BillingInterval, isPlanKey, PLAN_CATALOG, planFromLookupKey, resolveStripePrice } from "../_shared/plans.ts";

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
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.email) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    const payload = await req.json().catch(() => ({}));
    if (!isPlanKey(payload?.planId)) return json({ error: "invalid_plan" }, 400);
    const interval: BillingInterval = payload?.isAnnual === true ? "year" : "month";

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "billing_not_configured" }, 503);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const { data: subscriber } = await supabase.from("subscribers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    let customerId = subscriber?.stripe_customer_id as string | null;
    if (!customerId) customerId = (await stripe.customers.list({ email: user.email, limit: 1 })).data[0]?.id ?? null;
    if (!customerId) return json({ error: "no_subscription" }, 404);

    const live = (await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 })).data
      .filter((s: { status: string }) => ["active", "trialing", "past_due"].includes(s.status));
    if (live.length === 0) return json({ error: "no_subscription" }, 404);
    if (live.length > 1) return json({ error: "multiple_subscriptions", message: "More than one subscription found. Please contact support." }, 409);

    const sub = live[0];
    if (sub.items.data.length !== 1) return json({ error: "unsupported_subscription", message: "Use Manage billing to change this subscription." }, 409);
    const item = sub.items.data[0];
    const current = planFromLookupKey(item.price.lookup_key);
    if (current && current.plan.key === payload.planId && current.interval === interval) {
      return json({ error: "already_on_plan", message: "This is already your current plan." }, 409);
    }

    const { priceId } = await resolveStripePrice(stripe, payload.planId, interval);
    if (item.price.id === priceId) return json({ error: "already_on_plan", message: "This is already your current plan." }, 409);

    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: { ...sub.metadata, b2bnest_plan: payload.planId, b2bnest_interval: interval },
    });
    console.log("[CHANGE-PLAN] updated", JSON.stringify({ sub: updated.id, plan: payload.planId, interval }));
    return json({ ok: true, plan: PLAN_CATALOG[payload.planId as keyof typeof PLAN_CATALOG].tier, interval, status: updated.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CHANGE-PLAN] error", message);
    return json({ error: "server_error", message }, 500);
  }
});
