// Phase 14: which account a subscription event is attached to.
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { ApplyResult, ClaimResult, makeHandler, Store } from "./handler.ts";

type Link = { email: string; user_id: string | null; stripe_customer_id: string | null };
function store(rows: Link[] = [], authEmails: Record<string, string> = {}) {
  const applied: Record<string, unknown>[] = [];
  const events = new Map<string, string>();
  const s: Store & { applied: typeof applied; events: typeof events } = {
    applied, events,
    async claim(id: string): Promise<ClaimResult> { if (events.get(id) === "completed") return { result: "completed" }; events.set(id, "processing"); return { result: "claimed", token: "t" }; },
    async complete(id: string) { events.set(id, "completed"); },
    async release(id: string) { events.set(id, "failed"); },
    async applySubscriber(_id: string, _t: string, row: Record<string, unknown>): Promise<ApplyResult> { applied.push(row); return "applied"; },
    async updatePaymentStatus() {},
    async subscribersForCustomer(customerId: string) { return rows.filter((r) => r.stripe_customer_id === customerId).map(({ email, user_id }) => ({ email, user_id })); },
    async subscriberByEmail(email: string) {
      const r = rows.find((x) => x.email === email); // exact, like apply_stripe_subscriber_state
      return r ? { user_id: r.user_id, stripe_customer_id: r.stripe_customer_id } : null;
    },
    async authEmail(userId: string) { return authEmails[userId] ?? null; },
  };
  return s;
}
const price = { id: "price_b2bnest_starter_monthly_gbp", lookup_key: "b2bnest_starter_monthly_gbp", unit_amount: 1200, recurring: { interval: "month" } };
function stripe(subMeta: Record<string, string>, customer: { email: string; metadata?: Record<string, string> }) {
  return {
    subscriptions: {
      retrieve: async (id: string) => ({ id, status: "active", customer: "cus_1", metadata: subMeta, items: { data: [{ price }] } }),
      list: async () => ({ data: [] }),
    },
    customers: { retrieve: async () => ({ id: "cus_1", metadata: {}, ...customer }) },
  };
}
async function run(s: ReturnType<typeof store>, st: ReturnType<typeof stripe>) {
  const h = makeHandler({ store: s, stripe: st, verify: async (b) => JSON.parse(b) });
  const e = { id: "evt_o", type: "customer.subscription.updated", created: 1000, data: { object: { id: "sub_1" } } };
  const r = await h(new Request("http://x", { method: "POST", headers: { "stripe-signature": "t" }, body: JSON.stringify(e) }));
  await r.body?.cancel();
  return r.status;
}
const ANA = "ana@example.test";

Deno.test("rule 1: subscription metadata names the user → applied to that user (happy path unchanged)", async () => {
  const s = store();
  assertEquals(await run(s, stripe({ supabase_user_id: "u-ana" }, { email: ANA })), 200);
  assertEquals(s.applied.length, 1);
  assertEquals([s.applied[0].email, s.applied[0].user_id, s.applied[0].stripe_customer_id, s.applied[0].plan_key], [ANA, "u-ana", "cus_1", "starter"]);
});

Deno.test("rule 1: customer metadata names the user → applied", async () => {
  const s = store([{ email: ANA, user_id: "u-ana", stripe_customer_id: "cus_1" }]);
  await run(s, stripe({}, { email: ANA, metadata: { supabase_user_id: "u-ana" } }));
  assertEquals(s.applied.map((r) => r.user_id), ["u-ana"]);
});

Deno.test("ambiguous: subscription and customer metadata name DIFFERENT users → not attached, event still completed", async () => {
  const s = store();
  assertEquals(await run(s, stripe({ supabase_user_id: "u-ana" }, { email: ANA, metadata: { supabase_user_id: "u-bob" } })), 200);
  assertEquals(s.applied, []);
  assertEquals(s.events.get("evt_o"), "completed");
});

Deno.test("metadata names Ana but the row for that email belongs to Bob → Bob's row is never taken over", async () => {
  const s = store([{ email: ANA, user_id: "u-bob", stripe_customer_id: null }]);
  await run(s, stripe({ supabase_user_id: "u-ana" }, { email: ANA }));
  assertEquals(s.applied, []);
});

Deno.test("metadata names Ana but this customer is already linked to Bob → not attached", async () => {
  const s = store([{ email: "bob@example.test", user_id: "u-bob", stripe_customer_id: "cus_1" }]);
  await run(s, stripe({ supabase_user_id: "u-ana" }, { email: ANA }));
  assertEquals(s.applied, []);
});

Deno.test("rule 2: no metadata, a subscriber row already holds this customer id → applied to that row's user", async () => {
  const s = store([{ email: ANA, user_id: "u-ana", stripe_customer_id: "cus_1" }]);
  await run(s, stripe({}, { email: ANA }));
  assertEquals(s.applied.map((r) => [r.email, r.user_id]), [[ANA, "u-ana"]]);
});

Deno.test("rule 2: the linked row is updated even if the email in Stripe was changed", async () => {
  const s = store([{ email: ANA, user_id: "u-ana", stripe_customer_id: "cus_1" }]);
  await run(s, stripe({}, { email: "ana.new@example.test" }));
  assertEquals(s.applied.map((r) => [r.email, r.user_id]), [[ANA, "u-ana"]]);
});

Deno.test("rule 2 ambiguous: two users' rows hold this customer id → not attached", async () => {
  const s = store([{ email: ANA, user_id: "u-ana", stripe_customer_id: "cus_1" }, { email: "bob@example.test", user_id: "u-bob", stripe_customer_id: "cus_1" }]);
  await run(s, stripe({}, { email: ANA }));
  assertEquals(s.applied, []);
});

Deno.test("rule 3: no metadata, no link; the email row's user signs in with exactly this email → applied", async () => {
  const s = store([{ email: ANA, user_id: "u-ana", stripe_customer_id: null }], { "u-ana": "Ana@Example.test" });
  await run(s, stripe({}, { email: ANA }));
  assertEquals(s.applied.map((r) => r.user_id), ["u-ana"]);
});

Deno.test("rule 3 refused: the email row's user now signs in with another email → not attached", async () => {
  const s = store([{ email: ANA, user_id: "u-ana", stripe_customer_id: null }], { "u-ana": "someone@else.test" });
  await run(s, stripe({}, { email: ANA }));
  assertEquals(s.applied, []);
});

Deno.test("rule 3 refused: the email row already holds a DIFFERENT customer → not attached", async () => {
  const s = store([{ email: ANA, user_id: "u-ana", stripe_customer_id: "cus_other" }], { "u-ana": ANA });
  await run(s, stripe({}, { email: ANA }));
  assertEquals(s.applied, []);
});

Deno.test("nothing identifies the owner (no metadata, no row) → not attached to anyone", async () => {
  const s = store();
  assertEquals(await run(s, stripe({}, { email: ANA })), 200);
  assertEquals(s.applied, []);
  assertEquals(s.events.get("evt_o"), "completed");
});
