import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { changePlan, Deps } from "./handler.ts";

// Today's prices (Solo/Business/Scale) plus the legacy ones existing subscribers still pay (Business £35, Scale £85).
const PRICES: Record<string, { id: string; lookup_key: string; unit_amount: number; recurring: { interval: string } }> = {
  starter_month: { id: "price_sm", lookup_key: "b2bnest_starter_monthly_gbp", unit_amount: 1900, recurring: { interval: "month" } },
  professional_month: { id: "price_bm", lookup_key: "b2bnest_business_monthly_gbp", unit_amount: 5900, recurring: { interval: "month" } },
  professional_year: { id: "price_by", lookup_key: "b2bnest_business_annual_gbp", unit_amount: 59000, recurring: { interval: "year" } },
  enterprise_month: { id: "price_scm", lookup_key: "b2bnest_scale_monthly_gbp", unit_amount: 8900, recurring: { interval: "month" } },
  legacy_professional_month: { id: "price_pm", lookup_key: "b2bnest_professional_monthly_gbp", unit_amount: 3500, recurring: { interval: "month" } },
  legacy_professional_year: { id: "price_py", lookup_key: "b2bnest_professional_annual_gbp", unit_amount: 35000, recurring: { interval: "year" } },
  legacy_enterprise_month: { id: "price_em", lookup_key: "b2bnest_enterprise_monthly_gbp", unit_amount: 8500, recurring: { interval: "month" } },
};

function fakeStripe(opts: { subs?: number; failPayment?: boolean; price?: string; notConfigured?: boolean } = {}) {
  const state = {
    subs: Array.from({ length: opts.subs ?? 1 }, (_, i) => ({
      id: `sub_${i}`, status: "active", metadata: {}, schedule: null as string | null,
      current_period_start: 1_700_000_000, current_period_end: 1_702_592_000, cancel_at_period_end: false,
      items: { data: [{ id: `si_${i}`, price: PRICES[opts.price ?? "starter_month"] }] },
    })),
    updates: 0, created: 0, keys: new Set<string>(),
    // deno-lint-ignore no-explicit-any
    schedules: new Map<string, any>(), schedulesCreated: 0, released: 0, invoicesCreated: 0,
  };
  const stripe = {
    customers: { list: async () => ({ data: [{ id: "cus_1" }] }) },
    subscriptions: {
      list: async () => ({ data: state.subs }),
      retrieve: async (id: string) => state.subs.find((s) => s.id === id),
      create: async () => { state.created++; },
      update: async (id: string, params: { items: { price: string }[] }, o: { idempotencyKey: string }) => {
        const sub = state.subs.find((s) => s.id === id)!;
        if (state.keys.has(o.idempotencyKey)) return { ...sub, pending_update: null }; // Stripe replays the first result
        state.keys.add(o.idempotencyKey);
        if (opts.failPayment) return { ...sub, pending_update: { subscription_items: params.items } };
        state.updates++;
        const p = Object.values(PRICES).find((x) => x.id === params.items[0].price)!;
        sub.items.data[0].price = p;
        return { ...sub, pending_update: null };
      },
    },
    invoices: { retrieveUpcoming: async () => ({ amount_due: 1600, currency: "gbp" }) },
    subscriptionSchedules: {
      create: async ({ from_subscription }: { from_subscription: string }) => {
        const sub = state.subs.find((s) => s.id === from_subscription)!;
        if (sub.schedule) throw new Error("already has a schedule"); // Stripe: one schedule per subscription
        state.schedulesCreated++;
        const sch = { id: `sub_sched_${state.schedulesCreated}`, metadata: {}, phases: [{ start_date: sub.current_period_start }] };
        state.schedules.set(sch.id, sch); sub.schedule = sch.id; return sch;
      },
      retrieve: async (id: string) => state.schedules.get(id),
      // deno-lint-ignore no-explicit-any
      update: async (id: string, p: any) => { const sch = state.schedules.get(id); Object.assign(sch, p); return sch; },
      release: async (id: string) => {
        state.released++; state.schedules.delete(id);
        state.subs.forEach((s) => { if (s.schedule === id) s.schedule = null; });
      },
    },
  };
  const deps: Deps = {
    stripe,
    getUser: async (t) => (t === "good" ? { id: "u1", email: "a@b.co" } : null),
    getStoredCustomerId: async () => "cus_1",
    // Only today's prices can be resolved for a change; null = not created in Stripe yet.
    resolvePrice: async (plan, interval) => (opts.notConfigured ? null : PRICES[`${plan}_${interval}`]?.id ?? null),
  };
  return { state, deps };
}

Deno.test("signed-out callers are refused", async () => {
  const { deps } = fakeStripe();
  assertEquals((await changePlan("", {}, deps)).status, 401);
  assertEquals((await changePlan("bad", { planId: "professional" }, deps)).status, 401);
});

Deno.test("upgrade updates the one subscription with the right monthly price; no new subscription", async () => {
  const { state, deps } = fakeStripe();
  const r = await changePlan("good", { planId: "professional", isAnnual: false, requestId: "req-00000001" }, deps);
  assertEquals(r.status, 200);
  assertEquals(state.subs.length, 1);
  assertEquals(state.created, 0);
  assertEquals(state.subs[0].items.data[0].price.id, "price_bm"); // today's Business price
  assertEquals(state.subs[0].items.data[0].price.recurring.interval, "month");
});

Deno.test("annual choice uses the annual price", async () => {
  const { state, deps } = fakeStripe();
  await changePlan("good", { planId: "professional", isAnnual: true, requestId: "req-00000002" }, deps);
  assertEquals(state.subs[0].items.data[0].price.recurring.interval, "year");
});

Deno.test("preview shows proration and changes nothing", async () => {
  const { state, deps } = fakeStripe();
  const r = await changePlan("good", { mode: "preview", planId: "professional" }, deps);
  assertEquals(r.status, 200);
  assertEquals(r.body.amountDueNow, 1600);
  assertEquals(r.body.newPrice, 5900);
  assertEquals(r.body.newPlan, "Business");
  assertEquals(r.body.legacyPriceEnds, undefined); // Solo is not a legacy price
  assertEquals(state.updates, 0);
});

Deno.test("repeated clicks with the same request id change the plan once", async () => {
  const { state, deps } = fakeStripe();
  const body = { planId: "professional", requestId: "req-00000003" };
  await Promise.all([changePlan("good", body, deps), changePlan("good", body, deps), changePlan("good", body, deps)]);
  assertEquals(state.updates, 1);
  // a further click after success is refused as already on plan
  assertEquals((await changePlan("good", { planId: "professional", requestId: "req-00000004" }, deps)).status, 409);
});

Deno.test("apply without a request id is refused", async () => {
  const { state, deps } = fakeStripe();
  assertEquals((await changePlan("good", { planId: "professional" }, deps)).status, 400);
  assertEquals(state.updates, 0);
});

Deno.test("same plan is refused", async () => {
  const { deps } = fakeStripe({ price: "professional_month" });
  assertEquals((await changePlan("good", { planId: "professional", requestId: "req-00000005" }, deps)).body.error, "already_on_plan");
});

Deno.test("failed payment leaves the existing plan intact", async () => {
  const { state, deps } = fakeStripe({ failPayment: true });
  const r = await changePlan("good", { planId: "professional", requestId: "req-00000006" }, deps);
  assertEquals(r.status, 402);
  assertEquals(state.subs[0].items.data[0].price.id, "price_sm");
});

Deno.test("no subscription or several subscriptions: nothing is created or changed", async () => {
  const none = fakeStripe({ subs: 0 });
  assertEquals((await changePlan("good", { planId: "professional", requestId: "req-00000007" }, none.deps)).body.error, "no_subscription");
  const many = fakeStripe({ subs: 2 });
  assertEquals((await changePlan("good", { planId: "professional", requestId: "req-00000008" }, many.deps)).body.error, "multiple_subscriptions");
  assert(none.state.created === 0 && many.state.updates === 0);
});

Deno.test("downgrade is scheduled for period end on the same subscription: no charge, plan unchanged now", async () => {
  const { state, deps } = fakeStripe({ price: "professional_month" });
  const r = await changePlan("good", { planId: "starter", requestId: "req-00000101" }, deps);
  assertEquals(r.status, 200);
  assertEquals(r.body.scheduled, true);
  assertEquals(r.body.amountDueNow, 0);
  assertEquals(r.body.effectiveDate, new Date(1_702_592_000 * 1000).toISOString());
  assertEquals(state.subs[0].items.data[0].price.id, "price_bm"); // still Business
  assertEquals(state.updates, 0);
  assertEquals(state.created, 0);
  const sch = state.schedules.get(state.subs[0].schedule!);
  assertEquals(sch.proration_behavior, "none");
  assertEquals(sch.end_behavior, "release");
  assertEquals(sch.phases[0].end_date, 1_702_592_000);
  assertEquals(sch.phases[1].items[0].price, "price_sm");
  const st = await changePlan("good", { mode: "status" }, deps);
  assertEquals((st.body.pendingDowngrade as { plan: string }).plan, "Solo");
  assertEquals((st.body.pendingDowngrade as { price: number }).price, 1900);
});

Deno.test("repeated and concurrent downgrade requests create one schedule", async () => {
  const { state, deps } = fakeStripe({ price: "professional_month" });
  await Promise.all([1, 2, 3].map((i) => changePlan("good", { planId: "starter", requestId: `req-0000020${i}` }, deps)));
  const again = await changePlan("good", { planId: "starter", requestId: "req-00000209" }, deps);
  assertEquals(again.body.alreadyScheduled, true);
  assertEquals(state.schedulesCreated, 1);
  assertEquals(state.subs.length, 1);
  assertEquals(state.created, 0);
});

Deno.test("annual to monthly on the same tier is a downgrade at the annual renewal", async () => {
  const { state, deps } = fakeStripe({ price: "professional_year" });
  const r = await changePlan("good", { planId: "professional", isAnnual: false, requestId: "req-00000301" }, deps);
  assertEquals(r.body.scheduled, true);
  assertEquals(state.subs[0].items.data[0].price.id, "price_by");
});

Deno.test("cancelling a pending downgrade keeps the current plan", async () => {
  const { state, deps } = fakeStripe({ price: "professional_month" });
  await changePlan("good", { planId: "starter", requestId: "req-00000401" }, deps);
  const c = await changePlan("good", { mode: "cancel_downgrade", requestId: "req-00000402" }, deps);
  assertEquals(c.body.cancelled, true);
  assertEquals(state.subs[0].schedule, null);
  assertEquals(state.subs[0].items.data[0].price.id, "price_bm");
  assertEquals((await changePlan("good", { mode: "status" }, deps)).body.pendingDowngrade, null);
  const c2 = await changePlan("good", { mode: "cancel_downgrade", requestId: "req-00000403" }, deps);
  assertEquals(c2.body.cancelled, false);
});

Deno.test("upgrade while a downgrade is pending cancels it and upgrades immediately", async () => {
  const { state, deps } = fakeStripe({ price: "professional_month" });
  await changePlan("good", { planId: "starter", requestId: "req-00000501" }, deps);
  const r = await changePlan("good", { planId: "enterprise", requestId: "req-00000502" }, deps);
  assertEquals(r.status, 200);
  assertEquals(state.released, 1);
  assertEquals(state.subs[0].items.data[0].price.id, "price_scm"); // today's Scale price
});

Deno.test("a schedule not created by this app is never modified", async () => {
  const { state, deps } = fakeStripe({ price: "professional_month" });
  state.schedules.set("sub_sched_x", { id: "sub_sched_x", metadata: { other: "1" }, phases: [] });
  state.subs[0].schedule = "sub_sched_x";
  assertEquals((await changePlan("good", { planId: "starter", requestId: "req-00000601" }, deps)).body.error, "unsupported_schedule");
  assertEquals((await changePlan("good", { mode: "cancel_downgrade", requestId: "req-00000602" }, deps)).body.error, "unsupported_schedule");
  assertEquals(state.released, 0);
});

// ---- Legacy prices (existing subscribers keep £35 / £85 until they change plan) ----

Deno.test("legacy: status reports the real price the customer pays and that it is an earlier price", async () => {
  const { deps } = fakeStripe({ price: "legacy_professional_month" });
  const st = await changePlan("good", { mode: "status" }, deps);
  assertEquals(st.body.currentPlan, "Business");
  assertEquals(st.body.currentPlanKey, "professional");
  assertEquals(st.body.currentPrice, 3500);
  assertEquals(st.body.currentLegacy, true);
  assertEquals(st.body.currentLimits, { members: 5, admins: 5 });
});

Deno.test("legacy: same plan and interval is refused and keeps the earlier price", async () => {
  const { state, deps } = fakeStripe({ price: "legacy_professional_month" });
  const r = await changePlan("good", { planId: "professional", requestId: "req-00000201" }, deps);
  assertEquals(r.body.error, "already_on_plan");
  assert(String(r.body.message).includes("You keep your current price."));
  assertEquals(state.updates, 0);
  assertEquals(state.subs[0].items.data[0].price.id, "price_pm");
});

Deno.test("legacy: monthly to annual moves to today's annual price and says the earlier price ends", async () => {
  const { state, deps } = fakeStripe({ price: "legacy_professional_month" });
  const p = await changePlan("good", { mode: "preview", planId: "professional", isAnnual: true }, deps);
  assertEquals(p.body.newPrice, 59000);
  assertEquals(p.body.legacyPriceEnds, true);
  assertEquals(p.body.currentPrice, 3500);
  const r = await changePlan("good", { planId: "professional", isAnnual: true, requestId: "req-00000202" }, deps);
  assertEquals(r.status, 200);
  assertEquals(state.subs[0].items.data[0].price.id, "price_by"); // today's Business annual, never the legacy £350
  const st = await changePlan("good", { mode: "status" }, deps);
  assertEquals(st.body.currentLegacy, false);
});

Deno.test("legacy: Scale (£85) to Business is a downgrade scheduled at today's Business price", async () => {
  const { state, deps } = fakeStripe({ price: "legacy_enterprise_month" });
  const r = await changePlan("good", { planId: "professional", requestId: "req-00000203" }, deps);
  assertEquals(r.body.scheduled, true);
  assertEquals(r.body.newPrice, 5900);
  assertEquals(r.body.legacyPriceEnds, true);
  const sch = state.schedules.get(state.subs[0].schedule!);
  assertEquals(sch.phases[0].items[0].price, "price_em"); // keeps the earlier price until period end
  assertEquals(sch.phases[1].items[0].price, "price_bm");
});

Deno.test("legacy: Business (£35) to Scale upgrades to today's Scale price", async () => {
  const { state, deps } = fakeStripe({ price: "legacy_professional_month" });
  const r = await changePlan("good", { planId: "enterprise", requestId: "req-00000204" }, deps);
  assertEquals(r.status, 200);
  assertEquals(r.body.plan, "Scale");
  assertEquals(state.subs[0].items.data[0].price.id, "price_scm");
});

Deno.test("a price the owner hasn't created in Stripe yet: clear error, nothing changed or charged", async () => {
  const { state, deps } = fakeStripe({ price: "starter_month", notConfigured: true });
  const r = await changePlan("good", { planId: "professional", requestId: "req-00000205" }, deps);
  assertEquals(r.status, 503);
  assertEquals(r.body.error, "plan_not_available");
  assertEquals(state.updates, 0);
  assertEquals(state.schedulesCreated, 0);
});
