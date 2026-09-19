import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  BillingInterval,
  isPlanKey,
  PLAN_CATALOG,
  resolveStripePrice,
} from "../_shared/plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const logStep = (step: string, details?: unknown) =>
  console.log(`[SUBSCRIPTION-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.email) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const payload = await req.json().catch(() => ({}));
    const planId = payload?.planId;
    const isAnnual = payload?.isAnnual === true;
    const organizationId = typeof payload?.organizationId === "string" ? payload.organizationId : null;

    if (!isPlanKey(planId)) return json({ error: "Invalid plan selected" }, 400);
    const interval: BillingInterval = isAnnual ? "year" : "month";
    const plan = PLAN_CATALOG[planId];

    // If an organization was supplied, the caller must be an active member of it.
    if (organizationId) {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (!membership) return json({ error: "Forbidden" }, 403);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Billing is not configured" }, 503);
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Reuse an existing Stripe customer for this email, otherwise create one.
    const existingCustomers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customer = existingCustomers.data[0] ??
      await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });

    // Duplicate-subscription guard: never let one customer open a second live subscription.
    const liveStatuses = ["active", "trialing", "past_due", "unpaid", "incomplete"];
    const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 20 });
    const live = subscriptions.data.find((s: { status: string }) => liveStatuses.includes(s.status));
    if (live) {
      logStep("Existing live subscription found — directing to portal", { status: live.status });
      return json({
        error: "already_subscribed",
        message:
          "This account already has an active subscription. Use Manage billing to change or cancel your plan.",
      }, 409);
    }

    const { priceId } = await resolveStripePrice(stripe, planId, interval);
    logStep("Resolved stable price", { planId, interval, priceId });

    const origin = req.headers.get("origin") || "https://www.b2bnest.online";
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: false,
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&create_invoice=true`,
      cancel_url: `${origin}/pricing`,
      client_reference_id: user.id,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          b2bnest_plan: plan.key,
          b2bnest_interval: interval,
          organization_id: organizationId ?? "",
        },
      },
      metadata: {
        supabase_user_id: user.id,
        b2bnest_plan: plan.key,
        b2bnest_interval: interval,
        organization_id: organizationId ?? "",
      },
    });

    logStep("Checkout session created", { sessionId: session.id });
    return json({ url: session.url, sessionId: session.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return json({ error: message }, 500);
  }
});
