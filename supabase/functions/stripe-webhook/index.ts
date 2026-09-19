import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { planFromAmount, planFromLookupKey } from "../_shared/plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: unknown) =>
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

// Subscription statuses that keep the customer on their paid entitlements.
// past_due / unpaid keep access during Stripe's retry window — no data is ever deleted.
const ENTITLED_STATUSES = ["active", "trialing", "past_due", "unpaid"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeSecretKey || !webhookSecret) {
    logStep("Billing secrets missing");
    return new Response("Billing not configured", { status: 500, headers: corsHeaders });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // 1. Signature verification — the only accepted proof of payment.
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("No Stripe signature", { status: 400, headers: corsHeaders });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    logStep("Signature verification failed", { error: (err as Error).message });
    return new Response("Invalid signature", { status: 400, headers: corsHeaders });
  }

  logStep("Verified", { type: event.type, id: event.id });

  // 2. Idempotency — record the event id first; a replay is acknowledged and skipped.
  const { error: dedupeError } = await supabase
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, event_type: event.type });
  if (dedupeError) {
    if (dedupeError.code === "23505") {
      logStep("Duplicate event ignored", { id: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    logStep("Could not record event id", { error: dedupeError.message });
  }

  const syncSubscription = async (subscriptionId: string) => {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
    const item = subscription.items.data[0];
    const price = item?.price;
    const resolved = planFromLookupKey(price?.lookup_key) ??
      planFromLookupKey(price?.metadata?.b2bnest_plan ? undefined : undefined) ??
      planFromAmount(price?.unit_amount, price?.recurring?.interval);

    const customer = await stripe.customers.retrieve(subscription.customer as string);
    const email = (customer && !("deleted" in customer && customer.deleted))
      ? (customer as Stripe.Customer).email
      : null;
    if (!email) {
      logStep("No customer email — cannot sync entitlements", { subscriptionId });
      return;
    }

    const userId = subscription.metadata?.supabase_user_id ||
      (customer as Stripe.Customer).metadata?.supabase_user_id || null;

    const entitled = ENTITLED_STATUSES.includes(subscription.status);
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    const row: Record<string, unknown> = {
      email,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      stripe_price_id: price?.id ?? null,
      plan_key: resolved?.plan.key ?? null,
      billing_interval: resolved?.interval ?? price?.recurring?.interval ?? null,
      subscription_status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      current_period_start: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: periodEnd,
      subscribed: entitled,
      subscription_tier: entitled ? (resolved?.plan.tier ?? "Starter") : "free",
      subscription_end: periodEnd,
      updated_at: new Date().toISOString(),
    };
    if (userId) row.user_id = userId;
    if (entitled && resolved) row.ai_credits_limit = resolved.plan.aiCreditLimit;

    const { error } = await supabase.from("subscribers").upsert(row, { onConflict: "email" });
    if (error) logStep("Failed to upsert subscriber", { error: error.message });
    else {
      logStep("Entitlements synced", {
        status: subscription.status,
        plan: resolved?.plan.key,
        interval: resolved?.interval,
        subscribed: entitled,
      });
    }
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          await syncSubscription(session.subscription as string);
        } else {
          // One-off purchases (templates etc.) keep their existing payment record flow.
          const { error } = await supabase.rpc("update_payment_status", {
            p_status: "completed",
            p_stripe_session_id: session.id,
            p_stripe_payment_intent_id: session.payment_intent as string,
            p_payment_method: session.payment_method_types?.[0] || "card",
            p_metadata: {
              webhook_event_id: event.id,
              payment_status: session.payment_status,
              amount_total: session.amount_total,
              currency: session.currency,
            },
          });
          if (error) logStep("Payment update failed", { error: error.message });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription.id);
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await syncSubscription(invoice.subscription as string);
        }
        logStep(event.type, { invoiceId: invoice.id });
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await supabase.rpc("update_payment_status", {
          p_status: "failed",
          p_stripe_payment_intent_id: paymentIntent.id,
          p_metadata: {
            webhook_event_id: event.id,
            failure_reason: paymentIntent.last_payment_error?.message,
          },
        });
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    // Return 500 so Stripe retries; the dedupe row is removed to allow the retry through.
    await supabase.from("stripe_webhook_events").delete().eq("event_id", event.id);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
