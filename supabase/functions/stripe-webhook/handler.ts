// Stripe webhook core logic. Dependencies are injected so tests never touch Stripe or the database.
//
// Processing guarantees:
// - An event is marked completed only after every required account update succeeded.
// - Any failure returns 500 and releases the claim, so Stripe's next delivery retries it.
// - A database lease (claim) stops simultaneous deliveries applying the same event twice;
//   a delivery that finds the event in progress gets 409 and Stripe retries later.
// - If processing stops partway (crash/timeout), the lease expires and a later delivery reclaims it.
// - Subscriber state carries the Stripe event time; an older event can never overwrite newer state.
import { planFromAmount, planFromLookupKey } from "../_shared/plans.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// past_due / unpaid keep access during Stripe's retry window — no data is ever deleted.
export const ENTITLED_STATUSES = ["active", "trialing", "past_due", "unpaid"];

export type ClaimResult = "claimed" | "completed" | "busy";
export type ApplyResult = "applied" | "stale";

// deno-lint-ignore no-explicit-any
type Any = any;

export interface Store {
  claim(eventId: string, eventType: string): Promise<ClaimResult>;
  complete(eventId: string): Promise<void>;
  release(eventId: string, error: string): Promise<void>;
  /** Atomically writes subscriber state unless newer state (later Stripe event) is already stored. */
  applySubscriber(row: Record<string, unknown>, eventCreated: number): Promise<ApplyResult>;
  /** Idempotent: sets a payment's status by session / payment-intent id; never inserts a second record. */
  updatePaymentStatus(args: Record<string, unknown>): Promise<void>;
}

export interface Deps {
  verify(body: string, signature: string): Promise<Any>;
  stripe: Any;
  store: Store;
  log?: (step: string, details?: unknown) => void;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export function makeHandler(deps: Deps) {
  const log = deps.log ?? (() => {});
  const { stripe, store } = deps;

  const syncSubscription = async (subscriptionId: string, eventCreated: number) => {
    let subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });
    // If this subscription no longer grants access but the customer holds another live one,
    // sync the live one instead so the account is never briefly downgraded.
    if (!ENTITLED_STATUSES.includes(subscription.status)) {
      const others = await stripe.subscriptions.list({
        customer: subscription.customer as string, status: "all", limit: 20, expand: ["data.items.data.price"],
      });
      const live = others.data
        .filter((s: Any) => s.id !== subscription.id && ENTITLED_STATUSES.includes(s.status))
        .sort((a: Any, b: Any) => (b.current_period_end ?? 0) - (a.current_period_end ?? 0))[0];
      if (live) subscription = live;
    }
    const price = subscription.items.data[0]?.price;
    const resolved = planFromLookupKey(price?.lookup_key) ?? planFromAmount(price?.unit_amount, price?.recurring?.interval);

    const customer = await stripe.customers.retrieve(subscription.customer as string);
    const email = customer && !customer.deleted ? customer.email : null;
    // Required update cannot be made: fail so the event is retried rather than silently dropped.
    if (!email) throw new Error("customer_email_missing");

    const userId = subscription.metadata?.supabase_user_id || customer.metadata?.supabase_user_id || null;
    const entitled = ENTITLED_STATUSES.includes(subscription.status);
    const iso = (t?: number | null) => (t ? new Date(t * 1000).toISOString() : null);
    const periodEnd = iso(subscription.current_period_end);

    const row: Record<string, unknown> = {
      email,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      stripe_price_id: price?.id ?? null,
      plan_key: resolved?.plan.key ?? null,
      billing_interval: resolved?.interval ?? price?.recurring?.interval ?? null,
      subscription_status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      canceled_at: iso(subscription.canceled_at),
      current_period_start: iso(subscription.current_period_start),
      current_period_end: periodEnd,
      subscribed: entitled,
      subscription_tier: entitled ? (resolved?.plan.tier ?? "Starter") : "free",
      subscription_end: periodEnd,
    };
    if (userId) row.user_id = userId;
    // Sets the plan's credit LIMIT (absolute value); never adds credits, so a retry cannot double-allocate.
    if (entitled && resolved) row.ai_credits_limit = resolved.plan.aiCreditLimit;

    const r = await store.applySubscriber(row, eventCreated);
    log(r === "applied" ? "Entitlements synced" : "Older event ignored (newer state stored)", { status: subscription.status, plan: resolved?.plan.key });
  };

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) return new Response("No Stripe signature", { status: 400, headers: corsHeaders });

    let event: Any;
    try { event = await deps.verify(body, signature); } catch (e) {
      log("Signature verification failed", { error: (e as Error).message });
      return new Response("Invalid signature", { status: 400, headers: corsHeaders });
    }

    let claim: ClaimResult;
    try { claim = await store.claim(event.id, event.type); } catch (e) {
      log("Could not claim event", { error: (e as Error).message });
      return json(500, { error: "claim_failed" });
    }
    if (claim === "completed") return json(200, { received: true, duplicate: true });
    if (claim === "busy") return json(409, { error: "in_progress" }); // Stripe retries non-2xx later

    try {
      const created = Number(event.created) || 0;
      const obj = event.data.object;
      switch (event.type) {
        case "checkout.session.completed":
          if (obj.mode === "subscription" && obj.subscription) await syncSubscription(obj.subscription, created);
          else {
            await store.updatePaymentStatus({
              p_status: "completed", p_stripe_session_id: obj.id, p_stripe_payment_intent_id: obj.payment_intent,
              p_payment_method: obj.payment_method_types?.[0] || "card",
              p_metadata: { webhook_event_id: event.id, payment_status: obj.payment_status, amount_total: obj.amount_total, currency: obj.currency },
            });
          }
          break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await syncSubscription(obj.id, created);
          break;
        case "invoice.paid":
        case "invoice.payment_failed":
          if (obj.subscription) await syncSubscription(obj.subscription, created);
          break;
        case "payment_intent.payment_failed":
          await store.updatePaymentStatus({
            p_status: "failed", p_stripe_payment_intent_id: obj.id,
            p_metadata: { webhook_event_id: event.id, failure_reason: obj.last_payment_error?.message },
          });
          break;
        default:
          log("Unhandled event type", { type: event.type });
      }
      await store.complete(event.id);
      return json(200, { received: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log("ERROR", { message });
      await store.release(event.id, message.slice(0, 500)).catch(() => {}); // lease expiry covers a failed release
      return json(500, { error: "processing_failed" });
    }
  };
}
