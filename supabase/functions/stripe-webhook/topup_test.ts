// Phase 37: AI credit top-ups in stripe-webhook. Credits are granted only for a paid top-up session; refunds and disputes
// void the unused credits; subscription events are untouched.
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { ClaimResult, makeHandler, Store, TopupStore } from "./handler.ts";
import type { Any } from "../_shared/stripe_fake_test.ts";

function setup(opts: { grant?: (a: Any) => Any; void?: (a: Any) => Any; noTopups?: boolean; verifyFails?: boolean } = {}) {
  const events = new Map<string, string>();
  const grants: Any[] = []; const voids: Any[] = []; const logs: { step: string; details: Any }[] = [];
  const store = {
    payments: 0, applied: 0,
    async claim(id: string): Promise<ClaimResult> {
      const e = events.get(id);
      if (e === "completed") return { result: "completed" };
      events.set(id, "processing"); return { result: "claimed", token: "t" };
    },
    async complete(id: string) { events.set(id, "completed"); },
    async release(id: string) { events.set(id, "failed"); },
    async applySubscriber() { store.applied++; return "applied"; },
    async updatePaymentStatus() { store.payments++; },
    async subscribersForCustomer() { return [{ email: "owner@example.com", user_id: "u-owner" }]; },
    async subscriberByEmail() { return null; },
    async authEmail() { return null; },
  };
  const lots = new Map<string, number>();
  const topups: TopupStore = {
    grant: async (a) => {
      grants.push(a);
      if (opts.grant) return opts.grant(a);
      if (lots.has(a.sessionId)) return { success: true, duplicate: true, granted: 0, lot_id: "lot-1" };
      lots.set(a.sessionId, 300); return { success: true, duplicate: false, granted: 300, lot_id: "lot-1" };
    },
    void: async (a) => { voids.push(a); return opts.void ? opts.void(a) : { success: true, duplicate: false, removed: 120, lot_id: "lot-1" }; },
  };
  const stripe = {
    subscriptions: { retrieve: async (id: string) => ({ id, status: "active", customer: "cus_1", metadata: {}, items: { data: [{ price: { id: "p", lookup_key: "b2bnest_starter_monthly_gbp", unit_amount: 1900, recurring: { interval: "month" } } }] } }), list: async () => ({ data: [] }) },
    customers: { retrieve: async () => ({ email: "owner@example.com", metadata: {} }) },
  };
  const h = makeHandler({
    store: store as unknown as Store, stripe, topups: opts.noTopups ? undefined : topups,
    verify: async (b) => { if (opts.verifyFails) throw new Error("bad signature"); return JSON.parse(b); },
    log: (step, details) => logs.push({ step, details }),
  });
  return { h, store, events, grants, voids, logs };
}
const post = (h: (r: Request) => Promise<Response>, event: unknown) =>
  h(new Request("http://x", { method: "POST", headers: { "stripe-signature": "t" }, body: JSON.stringify(event) }));
const ev = (id: string, type: string, object: Any) => ({ id, type, created: 1000, data: { object } });
const session = (over: Any = {}) => ({
  id: "cs_test_topup_1", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 1200, currency: "gbp",
  client_reference_id: "u-ana", payment_intent: "pi_test_1",
  metadata: { type: "ai_topup", user_id: "u-ana", pack_id: "credits_300", checkout_id: "chk-1" }, ...over,
});

Deno.test("paid top-up session: granted once, from the session's own ids and amount", async () => {
  const { h, grants, store, events } = setup();
  const r = await post(h, ev("evt_1", "checkout.session.completed", session()));
  assertEquals(r.status, 200);
  assertEquals(grants, [{ userId: "u-ana", packId: "credits_300", sessionId: "cs_test_topup_1", paymentIntentId: "pi_test_1", amountPence: 1200 }]);
  assertEquals(store.payments, 0, "a top-up is not a payments row");
  assertEquals(events.get("evt_1"), "completed");
});

Deno.test("unpaid (delayed method): nothing granted; async_payment_succeeded grants it", async () => {
  const { h, grants } = setup();
  assertEquals((await post(h, ev("evt_2", "checkout.session.completed", session({ payment_status: "unpaid" })))).status, 200);
  assertEquals(grants.length, 0);
  assertEquals((await post(h, ev("evt_3", "checkout.session.async_payment_succeeded", session()))).status, 200);
  assertEquals(grants.length, 1);
});

Deno.test("double delivery: the same event is skipped; a second event for the same session grants nothing (database idempotent)", async () => {
  const { h, grants, logs } = setup();
  await post(h, ev("evt_4", "checkout.session.completed", session()));
  const again = await post(h, ev("evt_4", "checkout.session.completed", session()));
  assertEquals((await again.json()).duplicate, true);
  assertEquals(grants.length, 1);
  await post(h, ev("evt_5", "checkout.session.async_payment_succeeded", session()));
  assertEquals(grants.length, 2);
  assert(logs.some((l) => l.step === "Top-up already granted"));
});

Deno.test("grant refused for a reason a retry won't fix: ALERT for a manual refund, event completes", async () => {
  for (const code of ["amount_mismatch", "topup_cap_exceeded", "unknown_user", "unknown_pack"]) {
    const { h, logs, events } = setup({ grant: () => ({ success: false, error: code }) });
    assertEquals((await post(h, ev("evt_6", "checkout.session.completed", session()))).status, 200);
    assertEquals(events.get("evt_6"), "completed");
    assertEquals(logs.find((l) => l.step.startsWith("ALERT"))?.details, { session: "cs_test_topup_1", code });
  }
});

Deno.test("database error while granting: 500 and released, so Stripe retries", async () => {
  const { h, events } = setup({ grant: () => { throw new Error("grant_ai_topup: connection lost"); } });
  assertEquals((await post(h, ev("evt_7", "checkout.session.completed", session()))).status, 500);
  assertEquals(events.get("evt_7"), "failed");
});

Deno.test("metadata user differs from client_reference_id: never granted, ALERT", async () => {
  const { h, grants, logs } = setup();
  await post(h, ev("evt_8", "checkout.session.completed", session({ client_reference_id: "u-other" })));
  assertEquals(grants.length, 0);
  assertEquals(logs.find((l) => l.step.startsWith("ALERT"))?.details.code, "user_mismatch");
});

Deno.test("top-up events without the top-up deps are retried, never dropped", async () => {
  const { h, events } = setup({ noTopups: true });
  assertEquals((await post(h, ev("evt_9", "checkout.session.completed", session()))).status, 500);
  assertEquals(events.get("evt_9"), "failed");
});

Deno.test("refund and dispute void by payment intent; a non-top-up payment changes nothing", async () => {
  const { h, voids, logs } = setup();
  await post(h, ev("evt_10", "charge.refunded", { id: "ch_1", object: "charge", payment_intent: "pi_test_1", amount_refunded: 1200 }));
  await post(h, ev("evt_11", "charge.dispute.created", { id: "dp_1", object: "dispute", charge: "ch_1", payment_intent: "pi_test_1" }));
  assertEquals(voids, [{ sessionId: null, paymentIntentId: "pi_test_1", reason: "charge.refunded" }, { sessionId: null, paymentIntentId: "pi_test_1", reason: "charge.dispute.created" }]);
  const n = setup({ void: () => ({ success: false, error: "not_found" }) });
  assertEquals((await post(n.h, ev("evt_12", "charge.refunded", { id: "ch_2", payment_intent: "pi_sub" }))).status, 200);
  assertEquals(n.store.applied + n.store.payments, 0);
  assert(n.logs.some((l) => l.step === "Refund or dispute not for a top-up"));
  assert(logs.some((l) => l.step === "Top-up voided"));
});

Deno.test("existing events unchanged: subscription checkout syncs, a non-top-up payment session updates the payment row", async () => {
  const { h, grants, store } = setup();
  await post(h, ev("evt_13", "checkout.session.completed", { id: "cs_sub", mode: "subscription", subscription: "sub_1", metadata: {} }));
  assertEquals(store.applied, 1);
  await post(h, ev("evt_14", "checkout.session.completed", { id: "cs_pay", mode: "payment", payment_status: "paid", metadata: {} }));
  assertEquals(store.payments, 1);
  // async_payment_succeeded for something else stays unhandled (as before).
  await post(h, ev("evt_15", "checkout.session.async_payment_succeeded", { id: "cs_pay", mode: "payment", metadata: {} }));
  assertEquals(grants.length, 0); assertEquals(store.payments, 1);
});

Deno.test("bad signature: 400, nothing granted", async () => {
  const { h, grants, events } = setup({ verifyFails: true });
  assertEquals((await post(h, ev("evt_16", "checkout.session.completed", session()))).status, 400);
  assertEquals(grants.length, 0); assertEquals(events.size, 0);
});

Deno.test("logs hold ids and codes only", async () => {
  const { h, logs } = setup();
  await post(h, ev("evt_17", "checkout.session.completed", session({ customer_details: { email: "ana@example.test", name: "Ana" } })));
  assert(!JSON.stringify(logs).includes("ana@example.test") && !JSON.stringify(logs).includes("Ana\""));
});
