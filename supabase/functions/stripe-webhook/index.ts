import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, makeHandler } from "./handler.ts";

const logStep = (step: string, details?: unknown) =>
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
};

const handler = stripeSecretKey && webhookSecret
  ? (() => {
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    return makeHandler({
      stripe,
      log: logStep,
      verify: (body, sig) => stripe.webhooks.constructEventAsync(body, sig, webhookSecret),
      store: {
        claim: (id, type) => rpc("claim_stripe_webhook_event", { p_event_id: id, p_event_type: type, p_lease_seconds: 120 }),
        complete: async (id) => { await rpc("complete_stripe_webhook_event", { p_event_id: id }); },
        release: async (id, err) => { await rpc("release_stripe_webhook_event", { p_event_id: id, p_error: err }); },
        applySubscriber: (row, created) => rpc("apply_stripe_subscriber_state", { p_row: row, p_event_created: created }),
        updatePaymentStatus: async (args) => { await rpc("update_payment_status", args); },
      },
    });
  })()
  : null;

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!handler) {
    logStep("Billing secrets missing");
    return new Response("Billing not configured", { status: 500, headers: corsHeaders });
  }
  return handler(req);
});
