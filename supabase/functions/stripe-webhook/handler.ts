// Stripe webhook core logic. Dependencies are injected so tests never touch Stripe or the database.
//
// Processing guarantees:
// - An event is marked completed only after every required account update succeeded.
// - Any failure returns 500 and releases the claim, so Stripe's next delivery retries it.
// - A database lease (claim) stops simultaneous deliveries applying the same event twice;
//   a delivery that finds the event in progress gets 409 and Stripe retries later.
// - If processing stops partway (crash/timeout), the lease expires and a later delivery reclaims it.
// - Each claim carries a unique token; all writes and completion check it inside the database, so a
//   worker whose lease expired and was taken over cannot write records or mark the event complete.
// - Subscriber state carries the Stripe event time; an older event can never overwrite newer state.
//   Equal timestamps (Stripe's `created` is whole seconds) are APPLIED, not skipped: each sync re-reads
//   the subscription from Stripe at processing time, so the later-processed write holds the fresher state.
import { planFromAmount, planFromLookupKey } from "../_shared/plans.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// past_due / unpaid keep access during Stripe's retry window — no data is ever deleted.
export const ENTITLED_STATUSES = ["active", "trialing", "past_due", "unpaid"];

export type ClaimResult = { result: "claimed"; token: string } | { result: "completed" | "busy" };
export type ApplyResult = "applied" | "stale";

// deno-lint-ignore no-explicit-any
type Any = any;

/** A Stripe id that may arrive as a plain string or as an expanded object with an `id`. */
const idOf = (v: unknown): string | null => {
  if (typeof v === "string" && v) return v;
  if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string" && (v as { id: string }).id) return (v as { id: string }).id;
  return null;
};

/**
 * The subscription an invoice belongs to. From API 2025-03-31 (basil) on, the top-level `invoice.subscription` is gone
 * and the id is at `invoice.parent.subscription_details.subscription`; older versions still send the top-level field.
 * Either may be a string or an expanded object. Null when the invoice has no subscription (for example a one-off invoice).
 */
export function invoiceSubscriptionId(obj: Any): string | null {
  return idOf(obj?.parent?.subscription_details?.subscription) ?? idOf(obj?.subscription);
}

/**
 * A subscription's current billing period, in Stripe seconds. From API 2025-03-31 (basil) on, the period lives on each
 * subscription item (`items.data[n].current_period_start/end`) and the subscription-level fields are gone; older versions
 * have them at the top level. Reads the first item first (B2BNEST subscriptions have one item), then the top level.
 */
export function subscriptionPeriod(sub: Any): { start: number | null; end: number | null } {
  const item = sub?.items?.data?.[0];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    start: num(item?.current_period_start) ?? num(sub?.current_period_start),
    end: num(item?.current_period_end) ?? num(sub?.current_period_end),
  };
}

export interface Store {
  claim(eventId: string, eventType: string): Promise<ClaimResult>;
  // Every write below is fenced by the claim token: it throws "claim_lost" if another worker has
  // since taken the event over, so a worker whose claim expired can neither write nor complete.
  complete(eventId: string, token: string): Promise<void>;
  release(eventId: string, token: string, error: string): Promise<void>;
  /** Atomically writes subscriber state unless newer state (later Stripe event) is already stored. */
  applySubscriber(eventId: string, token: string, row: Record<string, unknown>, eventCreated: number): Promise<ApplyResult>;
  /** Idempotent: sets a payment's status by session / payment-intent id; never inserts a second record. */
  updatePaymentStatus(eventId: string, token: string, args: Record<string, unknown>): Promise<void>;
  // Read-only lookups used to decide whose account a subscription belongs to (Phase 14).
  /** public.subscribers rows whose stripe_customer_id is this customer. */
  subscribersForCustomer(customerId: string): Promise<{ email: string; user_id: string | null }[]>;
  /** The public.subscribers row with exactly this email, if any. */
  subscriberByEmail(email: string): Promise<{ user_id: string | null; stripe_customer_id: string | null } | null>;
  /** The sign-in email of this B2BNEST account (auth.users), or null if the account doesn't exist. */
  authEmail(userId: string): Promise<string | null>;
}

export type Owner = { email: string; userId: string } | { refused: string };

/**
 * Whose account a subscription belongs to, in this order:
 *   1. metadata.supabase_user_id on the subscription or the customer (set by create-subscription-checkout);
 *   2. the one account whose subscribers row already holds this stripe_customer_id;
 *   3. a verified email match: the subscribers row with the customer's email belongs to an account that signs in with
 *      exactly that email and holds no other customer.
 * Anything ambiguous or contradictory is refused, never guessed. Reads only.
 */
export async function resolveOwner(store: Store, customerId: string, customerEmail: string, subMeta?: Any, custMeta?: Any): Promise<Owner> {
  const subOwner: string | null = subMeta?.supabase_user_id || null;
  const custOwner: string | null = custMeta?.supabase_user_id || null;
  if (subOwner && custOwner && subOwner !== custOwner) return { refused: "metadata_conflict" };
  const linked = await store.subscribersForCustomer(customerId);
  const linkedUsers = [...new Set(linked.map((r) => r.user_id).filter((u): u is string => !!u))];

  const metaOwner = subOwner || custOwner;
  if (metaOwner) {
    if (linkedUsers.some((u) => u !== metaOwner)) return { refused: "customer_linked_to_other_account" };
    const own = linked.find((r) => r.user_id === metaOwner);
    if (own) return { email: own.email, userId: metaOwner };
    const row = await store.subscriberByEmail(customerEmail);
    if (row?.user_id && row.user_id !== metaOwner) return { refused: "email_row_owned_by_other_account" };
    return { email: customerEmail, userId: metaOwner };
  }

  if (linkedUsers.length > 1) return { refused: "customer_linked_to_several_accounts" };
  if (linkedUsers.length === 1) {
    const own = linked.find((r) => r.user_id === linkedUsers[0])!;
    return { email: own.email, userId: linkedUsers[0] };
  }

  const row = await store.subscriberByEmail(customerEmail);
  if (row?.user_id && (row.stripe_customer_id === null || row.stripe_customer_id === customerId)) {
    const signIn = await store.authEmail(row.user_id);
    if (signIn && signIn.toLowerCase() === customerEmail.toLowerCase()) return { email: customerEmail, userId: row.user_id };
  }
  return { refused: "no_verified_owner" };
}

export interface Deps {
  verify(body: string, signature: string): Promise<Any>;
  stripe: Any;
  store: Store;
  log?: (step: string, details?: unknown) => void;
  /** true = live key (accept only livemode events), false = test key. Undefined disables the guard (tests only). */
  expectedLivemode?: boolean;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export function makeHandler(deps: Deps) {
  const log = deps.log ?? (() => {});
  const { stripe, store } = deps;

  const syncSubscription = async (eventId: string, token: string, subscriptionId: string, eventCreated: number) => {
    let subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });
    // If this subscription no longer grants access but the customer holds another live one,
    // sync the live one instead so the account is never briefly downgraded.
    if (!ENTITLED_STATUSES.includes(subscription.status)) {
      const others = await stripe.subscriptions.list({
        customer: subscription.customer as string, status: "all", limit: 20, expand: ["data.items.data.price"],
      });
      const live = others.data
        .filter((s: Any) => s.id !== subscription.id && ENTITLED_STATUSES.includes(s.status))
        .sort((a: Any, b: Any) => (subscriptionPeriod(b).end ?? 0) - (subscriptionPeriod(a).end ?? 0))[0];
      if (live) subscription = live;
    }
    const price = subscription.items.data[0]?.price;
    const resolved = planFromLookupKey(price?.lookup_key) ?? planFromAmount(price?.unit_amount, price?.recurring?.interval);

    const customer = await stripe.customers.retrieve(subscription.customer as string);
    const email = customer && !customer.deleted ? customer.email : null;
    // Required update cannot be made: fail so the event is retried rather than silently dropped.
    if (!email) throw new Error("customer_email_missing");

    const owner = await resolveOwner(store, subscription.customer as string, email, subscription.metadata, customer.metadata);
    if ("refused" in owner) {
      // Not attached to anyone. The event still completes (a retry would not change the answer); the fix is to set
      // metadata.supabase_user_id on the customer in Stripe, after which the next event or sign-in syncs it.
      log("Subscription not attached: owner not verified", { reason: owner.refused, customer: subscription.customer });
      return;
    }
    const userId = owner.userId;
    const entitled = ENTITLED_STATUSES.includes(subscription.status);
    const iso = (t?: number | null) => (t ? new Date(t * 1000).toISOString() : null);
    const period = subscriptionPeriod(subscription);
    const periodEnd = iso(period.end);

    const row: Record<string, unknown> = {
      email: owner.email,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      stripe_price_id: price?.id ?? null,
      plan_key: resolved?.plan.key ?? null,
      billing_interval: resolved?.interval ?? price?.recurring?.interval ?? null,
      subscription_status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      canceled_at: iso(subscription.canceled_at),
      current_period_start: iso(period.start),
      current_period_end: periodEnd,
      subscribed: entitled,
      subscription_tier: entitled ? (resolved?.plan.tier ?? "Starter") : "free",
      subscription_end: periodEnd,
    };
    row.user_id = userId;
    // Sets the plan's credit LIMIT (absolute value); never adds credits, so a retry cannot double-allocate.
    if (entitled && resolved) row.ai_credits_limit = resolved.plan.aiCreditLimit;

    const r = await store.applySubscriber(eventId, token, row, eventCreated);
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

    // Environment guard: a test-mode event must never touch a live database (and vice versa).
    // Runs before claim, so a mismatched event causes no database write at all.
    if (typeof deps.expectedLivemode === "boolean" && event.livemode !== deps.expectedLivemode) {
      log("Rejected event from wrong Stripe mode", { livemode: event.livemode ?? null });
      return new Response("Wrong Stripe mode", { status: 400, headers: corsHeaders });
    }

    let claim: ClaimResult;
    try { claim = await store.claim(event.id, event.type); } catch (e) {
      log("Could not claim event", { error: (e as Error).message });
      return json(500, { error: "claim_failed" });
    }
    if (claim.result === "completed") return json(200, { received: true, duplicate: true });
    if (claim.result === "busy") return json(409, { error: "in_progress" }); // Stripe retries non-2xx later
    const token = (claim as { token: string }).token;
    const sync = (subId: string, created: number) => syncSubscription(event.id, token, subId, created);

    try {
      const created = Number(event.created) || 0;
      const obj = event.data.object;
      switch (event.type) {
        case "checkout.session.completed":
          // `subscription` is still top level on Checkout Sessions (a string in webhook payloads; an object if expanded).
          if (obj.mode === "subscription" && idOf(obj.subscription)) await sync(idOf(obj.subscription)!, created);
          else {
            await store.updatePaymentStatus(event.id, token, {
              p_status: "completed", p_stripe_session_id: obj.id, p_stripe_payment_intent_id: obj.payment_intent,
              p_payment_method: obj.payment_method_types?.[0] || "card",
              p_metadata: { webhook_event_id: event.id, payment_status: obj.payment_status, amount_total: obj.amount_total, currency: obj.currency },
            });
          }
          break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await sync(obj.id, created);
          break;
        case "invoice.paid":
        case "invoice.payment_failed": {
          const subId = invoiceSubscriptionId(obj);
          // Nothing to sync; the event still completes. Only the event id and type are logged (no customer data).
          if (subId) await sync(subId, created);
          else log("Invoice without subscription", { id: event.id, type: event.type });
          break;
        }
        case "payment_intent.payment_failed":
          await store.updatePaymentStatus(event.id, token, {
            p_status: "failed", p_stripe_payment_intent_id: obj.id,
            p_metadata: { webhook_event_id: event.id, failure_reason: obj.last_payment_error?.message },
          });
          break;
        default:
          log("Unhandled event type", { type: event.type });
      }
      await store.complete(event.id, token);
      return json(200, { received: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log("ERROR", { message });
      await store.release(event.id, token, message.slice(0, 500)).catch(() => {}); // lease expiry covers a failed release
      return json(500, { error: "processing_failed" });
    }
  };
}
