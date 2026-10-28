import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { checkSubscription, type CheckDeps } from "./handler.ts";
import { activeSub, fakeStripe, type FakeCustomer } from "../_shared/stripe_fake_test.ts";

const user = { id: "u-ana", email: "ana@example.test" };
function deps(customers: FakeCustomer[], subs: unknown[] = [], stored: string | null = null) {
  const f = fakeStripe({ customers, subscriptions: subs });
  const rows: Record<string, unknown>[] = [];
  const d: CheckDeps = { stripe: f.stripe, storedCustomerId: async () => stored, upsertSubscriber: async (row) => { rows.push(row); } };
  return { f, d, rows };
}

Deno.test("legitimate user: verified customer's subscription is synced onto the caller (unchanged fields)", async () => {
  const { d, rows } = deps([{ id: "cus_ana", email: "ana@example.test", metadata: { supabase_user_id: "u-ana" } }], [activeSub("sub_ana", "cus_ana")]);
  const r = await checkSubscription(user, d);
  assertEquals(r.status, 200);
  assertEquals(r.body.subscribed, true);
  assertEquals(r.body.plan_key, "starter");
  assertEquals(rows.length, 1);
  assertEquals([rows[0].email, rows[0].user_id, rows[0].stripe_customer_id, rows[0].stripe_subscription_id], ["ana@example.test", "u-ana", "cus_ana", "sub_ana"]);
});

Deno.test("a stored customer that still exists is used even without metadata (existing subscribers keep working)", async () => {
  const { d, rows } = deps([{ id: "cus_legacy", email: "ana@example.test" }], [activeSub("sub_l", "cus_legacy")], "cus_legacy");
  const r = await checkSubscription(user, d);
  assertEquals(r.body.subscribed, true);
  assertEquals(rows[0].stripe_customer_id, "cus_legacy");
});

Deno.test("no Stripe customer at all: free state written for the caller, no customer id (unchanged)", async () => {
  const { d, rows } = deps([]);
  const r = await checkSubscription(user, d);
  assertEquals(r.body, { subscribed: false, subscription_tier: "free" });
  assertEquals(rows.length, 1);
  assertEquals(rows[0].stripe_customer_id, null);
});

Deno.test("ANOTHER user's customer with the same email (and an active subscription) is never written onto the caller", async () => {
  const { d, rows } = deps([{ id: "cus_bob", email: "ana@example.test", metadata: { supabase_user_id: "u-bob" } }], [activeSub("sub_bob", "cus_bob")]);
  const r = await checkSubscription(user, d);
  assertEquals(r.status, 409);
  assertEquals(r.body.error, "billing_account_unverified");
  assertEquals(rows, []);
});

Deno.test("a same-email customer with no ownership metadata is not trusted: nothing written", async () => {
  const { d, rows } = deps([{ id: "cus_x", email: "ana@example.test" }], [activeSub("sub_x", "cus_x")]);
  const r = await checkSubscription(user, d);
  assertEquals(r.status, 409);
  assertEquals(rows, []);
});

Deno.test("ambiguous email (two customers): nothing written, never first-picked", async () => {
  const m = { metadata: { supabase_user_id: "u-ana" } };
  const { d, rows } = deps([{ id: "cus_a", email: "ana@example.test", ...m }, { id: "cus_b", email: "ana@example.test", ...m }], [activeSub("sub_b", "cus_b")]);
  const r = await checkSubscription(user, d);
  assertEquals(r.status, 409);
  assertEquals(rows, []);
});

Deno.test("stored id gone and no verified match: free state, the dead id is cleared", async () => {
  const { d, rows } = deps([], [], "cus_gone");
  const r = await checkSubscription(user, d);
  assertEquals(r.body.subscribed, false);
  assertEquals(rows[0].stripe_customer_id, null);
});

Deno.test("stored id gone but one verified customer exists: that one is used", async () => {
  const { d, rows } = deps([{ id: "cus_ana2", email: "ana@example.test", metadata: { supabase_user_id: "u-ana" } }], [activeSub("sub_2", "cus_ana2")], "cus_gone");
  const r = await checkSubscription(user, d);
  assertEquals(r.body.subscribed, true);
  assertEquals(rows[0].stripe_customer_id, "cus_ana2");
});

Deno.test("a stored customer whose metadata names ANOTHER user is refused: nothing written", async () => {
  const { d, rows } = deps([{ id: "cus_bob", email: "bob@example.test", metadata: { supabase_user_id: "u-bob" } }], [activeSub("sub_bob", "cus_bob")], "cus_bob");
  const r = await checkSubscription(user, d);
  assertEquals(r.status, 409);
  assertEquals(rows, []);
});

Deno.test("check never writes to Stripe", async () => {
  const { f, d } = deps([{ id: "cus_ana", email: "ana@example.test", metadata: { supabase_user_id: "u-ana" } }], [activeSub("sub_ana", "cus_ana")]);
  await checkSubscription(user, d);
  assertEquals(f.writes, []);
});
