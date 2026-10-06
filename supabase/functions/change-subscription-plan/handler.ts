// Core logic for changing the plan on the customer's ONE existing Stripe subscription.
// Never creates a subscription. Dependencies are injected so it can be tested without Stripe.
//
// Policy:
// - Upgrades (higher tier, or same tier monthly -> annual) apply immediately with a prorated charge (unchanged).
// - Downgrades (lower tier, or same tier annual -> monthly) are SCHEDULED on the same subscription for the end of
//   the current paid period via a Stripe subscription schedule. No refund, no unused-time credit, no charge now.
//   The customer keeps the higher plan until then; entitlements change only when Stripe activates the lower price
//   (the webhook syncs from the subscription's live price).
// - Stripe allows one schedule per subscription, so repeated requests can never create a second schedule.
// - A pending downgrade can be cancelled (schedule released; subscription continues on the current plan).
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
const RANK: Record<PlanKey, number> = { starter: 1, professional: 2, enterprise: 3 };
export const DOWNGRADE_TAG = "b2bnest_downgrade";
type Mode = "preview" | "apply" | "status" | "cancel_downgrade";

export function isDowngrade(from: { plan: PlanKey; interval: BillingInterval }, to: { plan: PlanKey; interval: BillingInterval }) {
  if (RANK[to.plan] !== RANK[from.plan]) return RANK[to.plan] < RANK[from.plan];
  return from.interval === "year" && to.interval === "month";
}

const iso = (t?: number | null) => (t ? new Date(t * 1000).toISOString() : null);

export async function changePlan(token: string, payload: Record<string, unknown>, deps: Deps): Promise<Result> {
  if (!token) return { status: 401, body: { error: "unauthorized" } };
  const user = await deps.getUser(token);
  if (!user) return { status: 401, body: { error: "unauthorized" } };

  const rawMode = payload?.mode;
  const mode: Mode = rawMode === "preview" || rawMode === "status" || rawMode === "cancel_downgrade" ? rawMode : "apply";
  const needsPlan = mode === "preview" || mode === "apply";
  if (needsPlan && !isPlanKey(payload?.planId)) return { status: 400, body: { error: "invalid_plan" } };
  const requestId = typeof payload?.requestId === "string" ? payload.requestId : "";
  if ((mode === "apply" || mode === "cancel_downgrade") && !REQUEST_ID.test(requestId)) {
    return { status: 400, body: { error: "missing_request_id" } };
  }

  const { stripe } = deps;
  // getStoredCustomerId returns only a customer that exists in this Stripe account or a single
  // ownership-verified email match (see _shared/verified-customer.ts). No first-match guessing here.
  const customerId = await deps.getStoredCustomerId(user.id);
  if (!customerId) return { status: 404, body: { error: "no_subscription" } };

  const live = (await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 })).data
    .filter((s: { status: string }) => LIVE.includes(s.status));
  if (live.length === 0) return { status: 404, body: { error: "no_subscription" } };
  if (live.length > 1) return { status: 409, body: { error: "multiple_subscriptions", message: "More than one subscription found. Please contact support." } };

  const sub = live[0];
  if (sub.items.data.length !== 1) return { status: 409, body: { error: "unsupported_subscription", message: "Use Manage billing to change this subscription." } };
  const item = sub.items.data[0];
  const current = planFromLookupKey(item.price?.lookup_key);
  const scheduleId: string | null = typeof sub.schedule === "string" ? sub.schedule : sub.schedule?.id ?? null;
  const schedule = scheduleId ? await stripe.subscriptionSchedules.retrieve(scheduleId) : null;
  const ours = !!schedule && schedule.metadata?.[DOWNGRADE_TAG] === "1";
  const pending = ours && isPlanKey(schedule.metadata?.b2bnest_plan)
    ? (() => {
      const plan = schedule.metadata.b2bnest_plan as PlanKey;
      const interval = (schedule.metadata.b2bnest_interval === "year" ? "year" : "month") as BillingInterval;
      return { plan: PLAN_CATALOG[plan].tier, planKey: plan, interval, price: PLAN_CATALOG[plan].prices[interval].amount, effectiveDate: iso(sub.current_period_end) };
    })()
    : null;

  if (mode === "status") {
    return {
      status: 200,
      body: {
        ok: true,
        currentPlan: current?.plan.tier ?? null,
        currentInterval: current?.interval ?? item.price?.recurring?.interval ?? null,
        currentPeriodEnd: iso(sub.current_period_end),
        pendingDowngrade: pending,
      },
    };
  }

  if (mode === "cancel_downgrade") {
    if (!schedule) return { status: 200, body: { ok: true, cancelled: false, message: "No pending plan change." } };
    if (!ours) return { status: 409, body: { error: "unsupported_schedule", message: "This subscription has a schedule that wasn't set up here. Please contact support." } };
    await stripe.subscriptionSchedules.release(schedule.id, {}, { idempotencyKey: `downgrade-release:${schedule.id}:${requestId}` });
    return { status: 200, body: { ok: true, cancelled: true, plan: current?.plan.tier ?? null } };
  }

  const planId = payload.planId as PlanKey;
  const interval: BillingInterval = payload?.isAnnual === true ? "year" : "month";
  const target = PLAN_CATALOG[planId];
  const price = target.prices[interval];
  const priceId = await deps.resolvePrice(planId, interval);
  if (item.price?.id === priceId || (current && current.plan.key === planId && current.interval === interval)) {
    return { status: 409, body: { error: "already_on_plan", message: pending ? "This is already your current plan. To keep it, cancel the pending change." : "This is already your current plan." } };
  }
  if (!current) return { status: 409, body: { error: "unsupported_subscription", message: "Your current plan couldn't be identified. Please contact support." } };
  const intervalChanges = (item.price?.recurring?.interval ?? current.interval) !== interval;
  const downgrade = isDowngrade({ plan: current.plan.key, interval: current.interval }, { plan: planId, interval });

  if (downgrade) {
    const effectiveDate = iso(sub.current_period_end);
    if (sub.cancel_at_period_end) return { status: 409, body: { error: "subscription_ending", message: "Your subscription is set to end. Resume it before changing plan." } };
    if (schedule && !ours) return { status: 409, body: { error: "unsupported_schedule", message: "This subscription has a schedule that wasn't set up here. Please contact support." } };
    const body = { newPlan: target.tier, newInterval: interval, newPrice: price.amount, currency: "gbp", amountDueNow: 0, effectiveDate, scheduled: true, intervalChanges };
    if (mode === "preview") return { status: 200, body: { ok: true, currentPlan: current.plan.tier, currentInterval: current.interval, ...body } };
    if (pending && pending.planKey === planId && pending.interval === interval) {
      return { status: 200, body: { ok: true, alreadyScheduled: true, ...body } };
    }

    let sched = schedule;
    if (!sched) {
      try {
        sched = await stripe.subscriptionSchedules.create({ from_subscription: sub.id }, { idempotencyKey: `downgrade-create:${sub.id}:${requestId}` });
      } catch (e) {
        // A concurrent request attached a schedule first; Stripe allows only one per subscription.
        const fresh = await stripe.subscriptions.retrieve(sub.id);
        const id = typeof fresh.schedule === "string" ? fresh.schedule : fresh.schedule?.id;
        if (!id) throw e;
        sched = await stripe.subscriptionSchedules.retrieve(id);
        if (sched.metadata?.[DOWNGRADE_TAG] !== "1" && sched.metadata && Object.keys(sched.metadata).length > 0) throw e;
      }
    }
    const startDate = sched.phases?.[0]?.start_date ?? sub.current_period_start;
    const quantity = item.quantity ?? 1;
    await stripe.subscriptionSchedules.update(
      sched.id,
      {
        end_behavior: "release",
        proration_behavior: "none",
        metadata: { [DOWNGRADE_TAG]: "1", b2bnest_plan: planId, b2bnest_interval: interval },
        phases: [
          { items: [{ price: item.price.id, quantity }], start_date: startDate, end_date: sub.current_period_end, proration_behavior: "none" },
          { items: [{ price: priceId, quantity }], iterations: 1, proration_behavior: "none", metadata: { b2bnest_plan: planId, b2bnest_interval: interval } },
        ],
      },
      { idempotencyKey: `downgrade-update:${sched.id}:${priceId}:${requestId}` },
    );
    return { status: 200, body: { ok: true, ...body, subscriptionId: sub.id } };
  }

  // Upgrade (existing behaviour). A pending downgrade is cancelled first so the schedule can't later undo the upgrade.
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
        currentPlan: current.plan.tier,
        currentInterval: current.interval,
        newPlan: target.tier,
        newInterval: interval,
        newPrice: price.amount,
        currency: upcoming.currency ?? "gbp",
        amountDueNow: upcoming.amount_due ?? 0,
        intervalChanges,
        scheduled: false,
        cancelsPendingDowngrade: !!pending,
      },
    };
  }

  if (schedule) {
    if (!ours) return { status: 409, body: { error: "unsupported_schedule", message: "This subscription has a schedule that wasn't set up here. Please contact support." } };
    await stripe.subscriptionSchedules.release(schedule.id, {}, { idempotencyKey: `downgrade-release:${schedule.id}:${requestId}` });
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
  return { status: 200, body: { ok: true, plan: target.tier, interval, subscriptionId: updated.id, scheduled: false } };
}
