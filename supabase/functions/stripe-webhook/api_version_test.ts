// Phase 23: newer Stripe API versions (2025-03-31 "basil" onwards, live endpoint on 2026-10-28) moved the invoice's
// subscription id to invoice.parent.subscription_details.subscription and the billing period onto subscription items.
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { ApplyResult, ClaimResult, invoiceSubscriptionId, makeHandler, Store, subscriptionPeriod } from "./handler.ts";

// Stripe objects are loosely shaped in these fakes.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function memStore() {
  const events = new Map<string, string>();
  const subs = new Map<string, Record<string, unknown>>();
  let n = 0;
  const s = {
    events, subs, applyCalls: 0,
    async claim(id: string): Promise<ClaimResult> {
      if (events.get(id) === "completed") return { result: "completed" };
      events.set(id, "processing"); return { result: "claimed", token: `t${++n}` };
    },
    async complete(id: string) { events.set(id, "completed"); },
    async release(id: string) { events.set(id, "failed"); },
    async applySubscriber(_id: string, _t: string, row: Record<string, unknown>): Promise<ApplyResult> {
      s.applyCalls++; subs.set(row.email as string, row); return "applied";
    },
    async updatePaymentStatus() {},
    async subscribersForCustomer(c: string) { return c === "cus_1" ? [{ email: "owner@example.com", user_id: "u-owner" }] : []; },
    async subscriberByEmail() { return null; },
    async authEmail() { return null; },
  };
  return s;
}

const T_START = 1_790_000_000, T_END = 1_792_592_000; // 2026-09-21 → 2026-10-21 (UTC)
const iso = (t: number) => new Date(t * 1000).toISOString();
const price = { id: "price_b", lookup_key: "b2bnest_business_monthly_gbp", unit_amount: 5900, recurring: { interval: "month" } };

/** A subscription in the new shape (period on the item, none at the top level) or the old shape (top level only). */
const newShapeSub = (id: string, extra: Any = {}) =>
  ({ id, status: "active", customer: "cus_1", metadata: {}, items: { data: [{ price, current_period_start: T_START, current_period_end: T_END }] }, ...extra });
const oldShapeSub = (id: string) =>
  ({ id, status: "active", customer: "cus_1", metadata: {}, current_period_start: T_START, current_period_end: T_END, items: { data: [{ price }] } });

function setup(subFor: (id: string) => Any = newShapeSub, list: Any[] = []) {
  const store = memStore(); const retrieved: string[] = []; const logs: { step: string; details: unknown }[] = [];
  const stripe = {
    subscriptions: {
      retrieve: async (id: string) => { retrieved.push(id); return subFor(id); },
      list: async () => ({ data: list }),
    },
    customers: { retrieve: async () => ({ email: "owner@example.com", metadata: {} }) },
  };
  const h = makeHandler({ store: store as unknown as Store, stripe, verify: async (b) => JSON.parse(b), log: (step, details) => logs.push({ step, details }) });
  return { store, retrieved, logs, h };
}

const ev = (id: string, type: string, object: Record<string, unknown>) => ({ id, type, created: 1000, data: { object } });
const post = async (h: (r: Request) => Promise<Response>, event: unknown) => {
  const r = await h(new Request("http://x", { method: "POST", headers: { "stripe-signature": "t" }, body: JSON.stringify(event) }));
  await r.body?.cancel(); return r.status;
};

// ---- invoiceSubscriptionId ----
Deno.test("23: invoiceSubscriptionId reads every shape, new location first", () => {
  assertEquals(invoiceSubscriptionId({ parent: { type: "subscription_details", subscription_details: { subscription: "sub_new" } } }), "sub_new");
  assertEquals(invoiceSubscriptionId({ parent: { subscription_details: { subscription: { id: "sub_obj", object: "subscription" } } } }), "sub_obj");
  assertEquals(invoiceSubscriptionId({ subscription: "sub_old" }), "sub_old");
  assertEquals(invoiceSubscriptionId({ subscription: { id: "sub_old_obj" } }), "sub_old_obj");
  assertEquals(invoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_new" } }, subscription: "sub_old" }), "sub_new");
  assertEquals(invoiceSubscriptionId({ parent: null, subscription: "sub_old" }), "sub_old");
  for (const none of [{}, { parent: null }, { parent: { type: "quote_details", quote_details: { quote: "qt_1" } } }, { subscription: null }, { subscription: "" }, { subscription: {} }, null, undefined]) {
    assertEquals(invoiceSubscriptionId(none), null);
  }
});

// ---- invoice events end to end ----
for (const type of ["invoice.paid", "invoice.payment_failed"]) {
  for (const [label, obj, want] of [
    ["new shape, string id", { id: "in_1", parent: { type: "subscription_details", subscription_details: { subscription: "sub_new" } } }, "sub_new"],
    ["new shape, expanded object", { id: "in_2", parent: { type: "subscription_details", subscription_details: { subscription: { id: "sub_obj" } } } }, "sub_obj"],
    ["old shape (top-level subscription)", { id: "in_3", subscription: "sub_old" }, "sub_old"],
  ] as const) {
    Deno.test(`23: ${type}, ${label} → synced`, async () => {
      const { store, retrieved, h } = setup();
      assertEquals(await post(h, ev(`evt_${type}_${label}`, type, obj)), 200);
      assertEquals(retrieved, [want]);
      assertEquals(store.events.get(`evt_${type}_${label}`), "completed");
      const row = store.subs.get("owner@example.com")!;
      assertEquals([row.stripe_subscription_id, row.plan_key, row.subscribed], [want, "professional", true]);
    });
  }

  Deno.test(`23: ${type} without a subscription → completed, nothing synced, only id and type logged`, async () => {
    const { store, retrieved, logs, h } = setup();
    const id = `evt_none_${type}`;
    assertEquals(await post(h, ev(id, type, { id: "in_9", customer: "cus_1", customer_email: "owner@example.com", parent: null })), 200);
    assertEquals(store.events.get(id), "completed");
    assertEquals([retrieved.length, store.applyCalls, store.subs.size], [0, 0, 0]);
    const line = logs.find((l) => l.step === "Invoice without subscription");
    assertEquals(line?.details, { id, type });
    assertEquals(JSON.stringify(logs).includes("owner@example.com") || JSON.stringify(logs).includes("cus_1"), false);
  });
}

// ---- checkout.session.completed still uses the top-level subscription ----
Deno.test("23: checkout.session.completed (subscription mode) → synced from obj.subscription", async () => {
  const { store, retrieved, h } = setup();
  assertEquals(await post(h, ev("evt_cs", "checkout.session.completed", { id: "cs_1", mode: "subscription", subscription: "sub_cs" })), 200);
  assertEquals(retrieved, ["sub_cs"]);
  assertEquals(store.subs.get("owner@example.com")!.stripe_subscription_id, "sub_cs");
});

// ---- period dates ----
Deno.test("23: subscriptionPeriod prefers the item, falls back to the top level", () => {
  assertEquals(subscriptionPeriod(newShapeSub("s")), { start: T_START, end: T_END });
  assertEquals(subscriptionPeriod(oldShapeSub("s")), { start: T_START, end: T_END });
  assertEquals(subscriptionPeriod({ current_period_start: 1, current_period_end: 2, items: { data: [{ current_period_start: 3, current_period_end: 4 }] } }), { start: 3, end: 4 });
  assertEquals(subscriptionPeriod({ items: { data: [] } }), { start: null, end: null });
  assertEquals(subscriptionPeriod(null), { start: null, end: null });
});

for (const [label, shape] of [["new shape (period on the item)", newShapeSub], ["old shape (period at the top level)", oldShapeSub]] as const) {
  Deno.test(`23: period dates stored for a ${label}`, async () => {
    const { store, h } = setup(shape);
    assertEquals(await post(h, ev(`evt_p_${label}`, "customer.subscription.updated", { id: "sub_1" })), 200);
    const row = store.subs.get("owner@example.com")!;
    assertEquals([row.current_period_start, row.current_period_end, row.subscription_end], [iso(T_START), iso(T_END), iso(T_END)]);
  });
}

Deno.test("23: a cancelled subscription falls back to the live one with the latest item period end", async () => {
  const ended = (id: string) => ({ ...newShapeSub(id), status: "canceled" });
  const older = newShapeSub("sub_older", { items: { data: [{ price, current_period_start: T_START - 100, current_period_end: T_END - 100 }] } });
  const newer = newShapeSub("sub_newer");
  const { store, h } = setup(ended, [older, newer]);
  assertEquals(await post(h, ev("evt_fb", "customer.subscription.deleted", { id: "sub_gone" })), 200);
  const row = store.subs.get("owner@example.com")!;
  assertEquals([row.stripe_subscription_id, row.current_period_end, row.subscribed], ["sub_newer", iso(T_END), true]);
});
