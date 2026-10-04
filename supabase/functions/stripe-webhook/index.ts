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
        claim: async (id, type) => {
          const r = (await rpc("claim_stripe_webhook_event", { p_event_id: id, p_event_type: type, p_lease_seconds: 120 }))?.[0];
          return r?.result === "claimed" ? { result: "claimed", token: r.token } : { result: r?.result === "completed" ? "completed" : "busy" };
        },
        complete: async (id, token) => { await rpc("complete_stripe_webhook_event", { p_event_id: id, p_token: token }); },
        release: async (id, token, err) => { await rpc("release_stripe_webhook_event", { p_event_id: id, p_token: token, p_error: err }); },
        applySubscriber: (id, token, row, created) => rpc("apply_stripe_subscriber_state", { p_event_id: id, p_token: token, p_row: row, p_event_created: created }),
        updatePaymentStatus: async (id, token, a) => {
          await rpc("apply_stripe_payment_status", {
            p_event_id: id, p_token: token, p_status: a.p_status, p_stripe_session_id: a.p_stripe_session_id ?? null,
            p_stripe_payment_intent_id: a.p_stripe_payment_intent_id ?? null, p_payment_method: a.p_payment_method ?? null, p_metadata: a.p_metadata ?? null,
          });
        },
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
