// Syncs the caller's subscription from Stripe into public.subscribers. Dependencies are injected for tests.
import { planFromAmount, planFromLookupKey } from "../_shared/plans.ts";
import { billingLinkError, isUnverified, resolveVerifiedCustomer, type StripeLike } from "../_shared/verified-customer.ts";

export interface CheckDeps {
  stripe: StripeLike;
  storedCustomerId: (userId: string) => Promise<string | null>;
  /** upsert into public.subscribers on (email). */
  upsertSubscriber: (row: Record<string, unknown>) => Promise<void>;
  log?: (step: string, details?: unknown) => void;
}
export type Result = { status: number; body: Record<string, unknown> };

// Statuses that keep paid entitlements (mirrors stripe-webhook).
export const ENTITLED_STATUSES = ["active", "trialing", "past_due", "unpaid"];

export async function checkSubscription(user: { id: string; email: string }, deps: CheckDeps): Promise<Result> {
  const log = deps.log ?? (() => {});
  const { stripe } = deps;
  const resolved = await resolveVerifiedCustomer(stripe, user, await deps.storedCustomerId(user.id));
  // A customer exists but can't be proven to be this user's: write nothing (never copy someone else's plan here).
  if (resolved.customerId === null && isUnverified(resolved.reason)) {
    log("Billing account not verified", { reason: resolved.reason });
    return billingLinkError(resolved.reason);
  }

  const freeState = {
    email: user.email, user_id: user.id, subscribed: false, subscription_tier: "free", subscription_end: null,
    stripe_subscription_id: null, stripe_price_id: null, plan_key: null, billing_interval: null, subscription_status: null,
    current_period_start: null, current_period_end: null, cancel_at_period_end: false, updated_at: new Date().toISOString(),
  };

  if (!resolved.customerId) {
    await deps.upsertSubscriber({ ...freeState, stripe_customer_id: null });
    return { status: 200, body: { subscribed: false, subscription_tier: "free" } };
  }

  const customerId = resolved.customerId;
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10, expand: ["data.items.data.price"] });
  const subscription = subscriptions.data.find((s: { status: string }) => ENTITLED_STATUSES.includes(s.status)) ?? null;

  if (!subscription) {
    await deps.upsertSubscriber({ ...freeState, stripe_customer_id: customerId });
    log("No entitled subscription", { customerId });
    return { status: 200, body: { subscribed: false, subscription_tier: "free" } };
  }

  const price = subscription.items.data[0]?.price;
  const planMatch = planFromLookupKey(price?.lookup_key) ?? planFromAmount(price?.unit_amount, price?.recurring?.interval);
  const interval = planMatch?.interval ?? price?.recurring?.interval ?? null;
  const tier = planMatch?.plan.tier ?? "Starter";
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;

  const row: Record<string, unknown> = {
    email: user.email, user_id: user.id, stripe_customer_id: customerId, stripe_subscription_id: subscription.id,
    stripe_price_id: price?.id ?? null, plan_key: planMatch?.plan.key ?? null, billing_interval: interval,
    subscription_status: subscription.status, cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null,
    current_period_end: periodEnd, subscribed: true, subscription_tier: tier, subscription_end: periodEnd, updated_at: new Date().toISOString(),
  };
  if (planMatch) row.ai_credits_limit = planMatch.plan.aiCreditLimit;
  await deps.upsertSubscriber(row);
  log("Synced", { tier, interval, status: subscription.status });
  return {
    status: 200,
    body: {
      subscribed: true, subscription_tier: tier, plan_key: planMatch?.plan.key ?? null, billing_interval: interval,
      subscription_status: subscription.status, cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      subscription_end: periodEnd, is_yearly: interval === "year",
    },
  };
}
