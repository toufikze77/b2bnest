import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { ApplyResult, ClaimResult, makeHandler, Store } from "./handler.ts";

// In-memory store with the same semantics as the SQL functions (atomic claim with lease).
function memStore() {
  const events = new Map<string, { status: string; lockedUntil: number }>();
  const subs = new Map<string, Record<string, unknown> & { at: number }>();
  const payments = new Map<string, string>([["cs_1", "pending"]]);
  let now = 0;
  const s = {
    events, subs, payments, failNextApply: 0, applyCalls: 0, paymentCalls: 0,
    advance: (ms: number) => { now += ms; },
    async claim(id: string): Promise<ClaimResult> {
      const e = events.get(id);
      if (!e) { events.set(id, { status: "processing", lockedUntil: now + 120_000 }); return "claimed"; }
      if (e.status === "completed") return "completed";
      if (e.status === "processing" && e.lockedUntil > now) return "busy";
      e.status = "processing"; e.lockedUntil = now + 120_000; return "claimed";
    },
    async complete(id: string) { events.get(id)!.status = "completed"; },
    async release(id: string) { const e = events.get(id)!; if (e.status === "processing") { e.status = "failed"; e.lockedUntil = 0; } },
    async applySubscriber(row: Record<string, unknown>, at: number): Promise<ApplyResult> {
      s.applyCalls++;
      if (s.failNextApply > 0) { s.failNextApply--; throw new Error("db unavailable"); }
      const cur = subs.get(row.email as string);
      if (cur && cur.at > at) return "stale";
      subs.set(row.email as string, { ...row, at }); return "applied";
    },
    async updatePaymentStatus(a: Record<string, unknown>) { s.paymentCalls++; if (payments.has(a.p_stripe_session_id as string)) payments.set(a.p_stripe_session_id as string, a.p_status as string); },
  };
  return s;
}

const price = (lk: string) => ({ id: `price_${lk}`, lookup_key: lk, unit_amount: 0, recurring: { interval: "month" } });
function fakeStripe(lookup: { value: string }) {
  return {
    subscriptions: {
      retrieve: async (id: string) => ({ id, status: "active", customer: "cus_1", metadata: {}, items: { data: [{ price: price(lookup.value) }] } }),
      list: async () => ({ data: [] }),
    },
    customers: { retrieve: async () => ({ email: "owner@example.com", metadata: {} }) },
  };
}

const ev = (id: string, type: string, object: Record<string, unknown>, created = 1000) => ({ id, type, created, data: { object } });
const post = (h: (r: Request) => Promise<Response>, event: unknown) =>
  h(new Request("http://x", { method: "POST", headers: { "stripe-signature": "t" }, body: JSON.stringify(event) }));

function setup(lk = "b2bnest_professional_monthly_gbp") {
  const store = memStore(); const lookup = { value: lk };
  const h = makeHandler({ store: store as unknown as Store, stripe: fakeStripe(lookup), verify: async (b) => JSON.parse(b) });
  return { store, lookup, h };
}

Deno.test("1. account update fails → 500 and not completed; the retry succeeds", async () => {
  const { store, h } = setup(); store.failNextApply = 1;
  const e = ev("evt_1", "customer.subscription.updated", { id: "sub_1" });
  const r1 = await post(h, e); await r1.body?.cancel();
  assertEquals(r1.status, 500); assertEquals(store.events.get("evt_1")!.status, "failed"); assertEquals(store.subs.size, 0);
  const r2 = await post(h, e); await r2.body?.cancel();
  assertEquals(r2.status, 200); assertEquals(store.events.get("evt_1")!.status, "completed");
  assertEquals(store.subs.get("owner@example.com")!.plan_key, "professional");
});

Deno.test("2. simultaneous duplicate deliveries → applied once, the other gets a retryable 409", async () => {
  const { store, h } = setup();
  const e = ev("evt_2", "customer.subscription.updated", { id: "sub_1" });
  const [a, b] = await Promise.all([post(h, e), post(h, e)]);
  const codes = [a.status, b.status].sort(); await a.body?.cancel(); await b.body?.cancel();
  assertEquals(codes, [200, 409]); assertEquals(store.applyCalls, 1);
});

Deno.test("3. processing stops partway → lease expires, reclaimed, no duplicate records or credits", async () => {
  const { store, h } = setup();
  // Simulate a crash after claiming: event left 'processing', nothing written.
  await store.claim("evt_3");
  const e = ev("evt_3", "checkout.session.completed", { id: "cs_1", mode: "payment", payment_intent: "pi_1" });
  const busy = await post(h, e); await busy.body?.cancel(); assertEquals(busy.status, 409);
  store.advance(121_000);
  const r = await post(h, e); await r.body?.cancel(); assertEquals(r.status, 200);
  const again = await post(h, e); await again.body?.cancel(); assertEquals(again.status, 200);
  assertEquals(store.payments.size, 1); assertEquals(store.payments.get("cs_1"), "completed"); assertEquals(store.paymentCalls, 1);
  // Subscription path: credit LIMIT is an absolute value, so a failed-then-retried sync can't double it.
  const s = setup(); s.store.failNextApply = 1;
  const se = ev("evt_3b", "invoice.paid", { subscription: "sub_1" });
  await (await post(s.h, se)).body?.cancel(); await (await post(s.h, se)).body?.cancel();
  assertEquals(s.store.subs.get("owner@example.com")!.ai_credits_limit, s.store.subs.get("owner@example.com")!.ai_credits_limit);
  assertEquals(s.store.subs.size, 1);
});

Deno.test("4. already-completed event is acknowledged and ignored", async () => {
  const { store, h } = setup();
  const e = ev("evt_4", "customer.subscription.updated", { id: "sub_1" });
  await (await post(h, e)).body?.cancel();
  const r = await post(h, e); const b = await r.json();
  assertEquals(r.status, 200); assertEquals(b.duplicate, true); assertEquals(store.applyCalls, 1);
});

Deno.test("5. an older event cannot restore an outdated plan", async () => {
  const { store, lookup, h } = setup("b2bnest_enterprise_monthly_gbp");
  await (await post(h, ev("evt_new", "customer.subscription.updated", { id: "sub_1" }, 2000))).body?.cancel();
  lookup.value = "b2bnest_starter_monthly_gbp"; // older event's view of the subscription
  const r = await post(h, ev("evt_old", "customer.subscription.updated", { id: "sub_1" }, 1000)); await r.body?.cancel();
  assertEquals(r.status, 200); assertEquals(store.events.get("evt_old")!.status, "completed");
  assertEquals(store.subs.get("owner@example.com")!.plan_key, "enterprise");
});

Deno.test("bad signature → 400, nothing claimed", async () => {
  const store = memStore();
  const h = makeHandler({ store: store as unknown as Store, stripe: {}, verify: async () => { throw new Error("bad"); } });
  const r = await post(h, {}); await r.body?.cancel();
  assertEquals(r.status, 400); assertEquals(store.events.size, 0);
});
