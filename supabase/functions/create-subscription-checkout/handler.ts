// Subscription checkout. Dependencies are injected so tests never touch Stripe or the database.
import { type BillingInterval, isPlanKey, PLAN_CATALOG, priceForNewSubscription } from "../_shared/plans.ts";
import { resolveOrCreateVerifiedCustomer, type StripeLike } from "../_shared/verified-customer.ts";

export interface CheckoutDeps {
  stripe: StripeLike;
  /** The caller is an active member of this company. */
  isActiveMember: (organizationId: string, userId: string) => Promise<boolean>;
  /** subscribers.stripe_customer_id for this user, if any. */
  storedCustomerId: (userId: string) => Promise<string | null>;
  log?: (step: string, details?: unknown) => void;
}
export type Result = { status: number; body: Record<string, unknown> };

export async function startCheckout(user: { id: string; email: string }, payload: Record<string, unknown> | null, origin: string, deps: CheckoutDeps): Promise<Result> {
  const log = deps.log ?? (() => {});
  const { stripe } = deps;
  const planId = payload?.planId;
  const isAnnual = payload?.isAnnual === true;
  const organizationId = typeof payload?.organizationId === "string" ? payload.organizationId : null;

  if (!isPlanKey(planId)) return { status: 400, body: { error: "Invalid plan selected" } };
  const interval: BillingInterval = isAnnual ? "year" : "month";
  const plan = PLAN_CATALOG[planId];

  // If an organization was supplied, the caller must be an active member of it.
  if (organizationId && !(await deps.isActiveMember(organizationId, user.id))) return { status: 403, body: { error: "Forbidden" } };

  // The caller's own customer: the stored one, or the one email match marked as theirs, or a NEW one when they have
  // none. A same-email customer that isn't provably theirs is never reused: stop with a clear error instead.
  const resolvedCustomer = await resolveOrCreateVerifiedCustomer(stripe, user, await deps.storedCustomerId(user.id));
  if (!resolvedCustomer.ok) {
    log("Billing account not verified", { reason: resolvedCustomer.body.reason });
    return { status: resolvedCustomer.status, body: resolvedCustomer.body };
  }
  const customer = { id: resolvedCustomer.customerId };

  // Duplicate-subscription guard: never let one customer open a second live subscription.
  const liveStatuses = ["active", "trialing", "past_due", "unpaid", "incomplete"];
  const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 20 });
  const live = subscriptions.data.find((s: { status: string }) => liveStatuses.includes(s.status));
  if (live) {
    log("Existing live subscription found — directing to portal", { status: live.status });
    return { status: 409, body: { error: "already_subscribed", message: "This account already has an active subscription. Use Manage billing to change or cancel your plan." } };
  }

  // New sign-ups always get today's price for the plan (never a legacy price). If the owner hasn't created that
  // price in Stripe yet, stop here: no session is created and nothing is charged.
  const resolvedPrice = await priceForNewSubscription(stripe, planId, interval);
  if (!resolvedPrice.ok) {
    log("Price not configured", { planId, interval });
    return { status: resolvedPrice.status, body: resolvedPrice.body };
  }
  const { priceId } = resolvedPrice;
  log("Resolved stable price", { planId, interval, priceId });

  const metadata = { supabase_user_id: user.id, b2bnest_plan: plan.key, b2bnest_interval: interval, organization_id: organizationId ?? "" };
  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: false,
    success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&create_invoice=true`,
    cancel_url: `${origin}/pricing`,
    client_reference_id: user.id,
    subscription_data: { metadata },
    metadata,
  });
  log("Checkout session created", { sessionId: session.id });
  return { status: 200, body: { url: session.url, sessionId: session.id } };
}
