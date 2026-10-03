import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { changePlan, Deps } from "./handler.ts";

const PRICES: Record<string, { id: string; lookup_key: string; recurring: { interval: string } }> = {
  starter_month: { id: "price_sm", lookup_key: "b2bnest_starter_monthly_gbp", recurring: { interval: "month" } },
  professional_month: { id: "price_pm", lookup_key: "b2bnest_professional_monthly_gbp", recurring: { interval: "month" } },
  professional_year: { id: "price_py", lookup_key: "b2bnest_professional_annual_gbp", recurring: { interval: "year" } },
};

function fakeStripe(opts: { subs?: number; failPayment?: boolean; price?: string } = {}) {
  const state = {
    subs: Array.from({ length: opts.subs ?? 1 }, (_, i) => ({
      id: `sub_${i}`, status: "active", metadata: {},
      items: { data: [{ id: `si_${i}`, price: PRICES[opts.price ?? "starter_month"] }] },
    })),
    updates: 0, created: 0, keys: new Set<string>(),
  };
  const stripe = {
    customers: { list: async () => ({ data: [{ id: "cus_1" }] }) },
    subscriptions: {
      list: async () => ({ data: state.subs }),
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
  };
  const deps: Deps = {
    stripe,
    getUser: async (t) => (t === "good" ? { id: "u1", email: "a@b.co" } : null),
    getStoredCustomerId: async () => "cus_1",
    resolvePrice: async (plan, interval) => PRICES[`${plan}_${interval}`].id,
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
  assertEquals(state.subs[0].items.data[0].price.id, "price_pm");
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
  assertEquals(r.body.newPrice, 3500);
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
