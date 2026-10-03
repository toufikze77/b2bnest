// Core logic for changing the plan on the customer's ONE existing Stripe subscription.
// Never creates a subscription. Dependencies are injected so it can be tested without Stripe.
import { BillingInterval, isPlanKey, PLAN_CATALOG, PlanKey, planFromLookupKey } from "../_shared/plans.ts";

export interface Deps {
  // deno-lint-ignore no-explicit-any
  stripe: any;
  getUser: (token: string) => Promise<{ id: string; email: string } | null>;
  getStoredCustomerId: (userId: string) => Promise<string | null>;
  resolvePrice: (planKey: PlanKey, interval: BillingInterval) => Promise<string>;
}

export interface Result { status: number; body: Record<string, unknown> }

const LIVE = ["active", "trialing", "past_due"];
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

export async function changePlan(token: string, payload: Record<string, unknown>, deps: Deps): Promise<Result> {
  if (!token) return { status: 401, body: { error: "unauthorized" } };
  const user = await deps.getUser(token);
  if (!user) return { status: 401, body: { error: "unauthorized" } };

  const mode = payload?.mode === "preview" ? "preview" : "apply";
  if (!isPlanKey(payload?.planId)) return { status: 400, body: { error: "invalid_plan" } };
  const planId = payload.planId as PlanKey;
  const interval: BillingInterval = payload?.isAnnual === true ? "year" : "month";
  const requestId = typeof payload?.requestId === "string" ? payload.requestId : "";
  if (mode === "apply" && !REQUEST_ID.test(requestId)) return { status: 400, body: { error: "missing_request_id" } };

  const { stripe } = deps;
  let customerId = await deps.getStoredCustomerId(user.id);
  if (!customerId) customerId = (await stripe.customers.list({ email: user.email, limit: 1 })).data[0]?.id ?? null;
  if (!customerId) return { status: 404, body: { error: "no_subscription" } };

  const live = (await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 })).data
    .filter((s: { status: string }) => LIVE.includes(s.status));
  if (live.length === 0) return { status: 404, body: { error: "no_subscription" } };
  if (live.length > 1) return { status: 409, body: { error: "multiple_subscriptions", message: "More than one subscription found. Please contact support." } };

  const sub = live[0];
  if (sub.items.data.length !== 1) return { status: 409, body: { error: "unsupported_subscription", message: "Use Manage billing to change this subscription." } };
  const item = sub.items.data[0];
  const current = planFromLookupKey(item.price?.lookup_key);
  const priceId = await deps.resolvePrice(planId, interval);
  if (item.price?.id === priceId || (current && current.plan.key === planId && current.interval === interval)) {
    return { status: 409, body: { error: "already_on_plan", message: "This is already your current plan." } };
  }

  const target = PLAN_CATALOG[planId];
  const price = target.prices[interval];
  const intervalChanges = (item.price?.recurring?.interval ?? current?.interval) !== interval;

  if (mode === "preview") {
    const prorationDate = Math.floor(Date.now() / 1000);
    const upcoming = await stripe.invoices.retrieveUpcoming({
      customer: customerId,
      subscription: sub.id,
      subscription_items: [{ id: item.id, price: priceId }],
      subscription_proration_behavior: "always_invoice",
      subscription_proration_date: prorationDate,
    });
    return {
      status: 200,
      body: {
        ok: true,
        currentPlan: current?.plan.tier ?? null,
        currentInterval: current?.interval ?? item.price?.recurring?.interval ?? null,
        newPlan: target.tier,
        newInterval: interval,
        newPrice: price.amount,
        currency: upcoming.currency ?? "gbp",
        amountDueNow: upcoming.amount_due ?? 0,
        intervalChanges,
      },
    };
  }

  // always_invoice: the prorated difference is charged (or credited) now.
  // pending_if_incomplete: if that payment fails, Stripe keeps the subscription on the old price.
  const updated = await stripe.subscriptions.update(
    sub.id,
    {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: "always_invoice",
      payment_behavior: "pending_if_incomplete",
      metadata: { ...(sub.metadata ?? {}), b2bnest_plan: planId, b2bnest_interval: interval },
    },
    { idempotencyKey: `plan-change:${sub.id}:${priceId}:${requestId}` },
  );
  const applied = updated.items?.data?.[0]?.price?.id === priceId && !updated.pending_update;
  if (!applied) {
    return { status: 402, body: { error: "payment_failed", message: "The payment for the change didn't go through, so your plan hasn't changed." } };
  }
  return { status: 200, body: { ok: true, plan: target.tier, interval, subscriptionId: updated.id } };
}
