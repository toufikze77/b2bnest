import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { planFromAmount, planFromLookupKey } from "../_shared/plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) =>
  console.log(`[CHECK-SUBSCRIPTION] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

// Statuses that keep paid entitlements (mirrors stripe-webhook).
const ENTITLED_STATUSES = ["active", "trialing", "past_due", "unpaid"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("Stripe key not configured — reporting free tier");
      return new Response(
        JSON.stringify({ subscribed: false, subscription_tier: "free", billing_interval: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    const freeState = {
      email: user.email,
      user_id: user.id,
      subscribed: false,
      subscription_tier: "free",
      subscription_end: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      plan_key: null,
      billing_interval: null,
      subscription_status: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    };

    if (customers.data.length === 0) {
      await supabaseClient.from("subscribers").upsert(
        { ...freeState, stripe_customer_id: null },
        { onConflict: "email" },
      );
      return new Response(JSON.stringify({ subscribed: false, subscription_tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
      expand: ["data.items.data.price"],
    });
    const subscription = subscriptions.data.find((s) => ENTITLED_STATUSES.includes(s.status)) ?? null;

    if (!subscription) {
      await supabaseClient.from("subscribers").upsert(
        { ...freeState, stripe_customer_id: customerId },
        { onConflict: "email" },
      );
      logStep("No entitled subscription", { customerId });
      return new Response(JSON.stringify({ subscribed: false, subscription_tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const price = subscription.items.data[0]?.price;
    const resolved = planFromLookupKey(price?.lookup_key) ??
      planFromAmount(price?.unit_amount, price?.recurring?.interval);
    const interval = resolved?.interval ?? price?.recurring?.interval ?? null;
    const tier = resolved?.plan.tier ?? "Starter";
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    const row: Record<string, unknown> = {
      email: user.email,
      user_id: user.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: price?.id ?? null,
      plan_key: resolved?.plan.key ?? null,
      billing_interval: interval,
      subscription_status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      current_period_start: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: periodEnd,
      subscribed: true,
      subscription_tier: tier,
      subscription_end: periodEnd,
      updated_at: new Date().toISOString(),
    };
    if (resolved) row.ai_credits_limit = resolved.plan.aiCreditLimit;

    await supabaseClient.from("subscribers").upsert(row, { onConflict: "email" });
    logStep("Synced", { tier, interval, status: subscription.status });

    return new Response(
      JSON.stringify({
        subscribed: true,
        subscription_tier: tier,
        plan_key: resolved?.plan.key ?? null,
        billing_interval: interval,
        subscription_status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        subscription_end: periodEnd,
        is_yearly: interval === "year",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
