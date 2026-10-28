import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { type InvoiceDeps, recordSubscriptionPurchase } from "./handler.ts";
import { activeSub, fakeStripe, type FakeCustomer } from "../_shared/stripe_fake_test.ts";

const user = { id: "u-ana", email: "ana@example.test" };
const ANA: FakeCustomer = { id: "cus_ana", email: "ana@example.test", metadata: { supabase_user_id: "u-ana" } };
const session = (over: Record<string, unknown> = {}) => ({
  id: "cs_1", payment_status: "paid", customer: "cus_ana", subscription: "sub_ana", amount_total: 1200, invoice: "in_1",
  client_reference_id: "u-ana", metadata: { supabase_user_id: "u-ana" }, ...over,
});
function deps(customers: FakeCustomer[], sessions: unknown[], opts: { stored?: string | null; subs?: unknown[] } = {}) {
  const f = fakeStripe({ customers, sessions, subscriptions: opts.subs ?? [activeSub("sub_ana", "cus_ana"), activeSub("sub_bob", "cus_bob")] });
  const inserted: Record<string, unknown>[] = [];
  const d: InvoiceDeps = {
    stripe: f.stripe, storedCustomerId: async () => opts.stored ?? null,
    findExpense: async (_u, tag) => inserted.find((e) => String(e.description).includes(tag)) ?? null,
    insertExpense: async (row) => { const e = { id: `exp_${inserted.length + 1}`, ...row }; inserted.push(e); return e; },
  };
  return { f, d, inserted };
}

Deno.test("legitimate user: the paid session is recorded once as an expense (unchanged fields), idempotent", async () => {
  const { d, inserted } = deps([ANA], [session()]);
  const r = await recordSubscriptionPurchase(user, "cs_1", d);
  assertEquals(r.status, 200);
  assertEquals(inserted.length, 1);
  assertEquals([inserted[0].user_id, inserted[0].category, inserted[0].amount, inserted[0].status], ["u-ana", "Software subscription", 12, "paid"]);
  assert(String(inserted[0].description).includes("ref:cs_1"));
  const again = await recordSubscriptionPurchase(user, "cs_1", d);
  assertEquals(again.status, 200);
  assertEquals(inserted.length, 1);
});

Deno.test("a session owned by ANOTHER user is refused even when the customer email matches the caller", async () => {
  // Bob's session whose customer has Ana's email (the old check compared emails only).
  const bobsCustomer: FakeCustomer = { id: "cus_bob", email: "ana@example.test", metadata: { supabase_user_id: "u-bob" } };
  const s = session({ id: "cs_bob", customer: "cus_bob", subscription: "sub_bob", client_reference_id: "u-bob", metadata: { supabase_user_id: "u-bob" } });
  const { d, inserted } = deps([bobsCustomer], [s]);
  const r = await recordSubscriptionPurchase(user, "cs_bob", d);
  assertEquals(r.status, 403);
  assertEquals(inserted, []);
});

Deno.test("a session with no owner at all is refused", async () => {
  const { d, inserted } = deps([ANA], [session({ client_reference_id: null, metadata: {} })]);
  const r = await recordSubscriptionPurchase(user, "cs_1", d);
  assertEquals(r.status, 403);
  assertEquals(inserted, []);
});

Deno.test("session says it is the caller's but its customer is not the caller's verified customer: refused", async () => {
  const other: FakeCustomer = { id: "cus_other", email: "ana@example.test", metadata: { supabase_user_id: "u-bob" } };
  const { d, inserted } = deps([ANA, other], [session({ customer: "cus_other" })], { stored: "cus_ana" });
  const r = await recordSubscriptionPurchase(user, "cs_1", d);
  assertEquals(r.status, 403);
  assertEquals(inserted, []);
});

Deno.test("metadata mismatch: the session's customer belongs to another user (no stored id): refused", async () => {
  const bobs: FakeCustomer = { id: "cus_bob", email: "ana@example.test", metadata: { supabase_user_id: "u-bob" } };
  const { d, inserted } = deps([bobs], [session({ customer: "cus_bob", subscription: "sub_bob" })]);
  const r = await recordSubscriptionPurchase(user, "cs_1", d);
  assertEquals(r.status, 403);
  assertEquals(inserted, []);
});

Deno.test("ambiguous email (two customers, nothing stored): refused, never first-picked", async () => {
  const twin: FakeCustomer = { id: "cus_twin", email: "ana@example.test", metadata: { supabase_user_id: "u-ana" } };
  const { d, inserted } = deps([ANA, twin], [session()]);
  const r = await recordSubscriptionPurchase(user, "cs_1", d);
  assertEquals(r.status, 403);
  assertEquals(inserted, []);
});

Deno.test("stored id gone: the session's customer still counts when it is the one verified customer", async () => {
  const { d, inserted } = deps([ANA], [session()], { stored: "cus_gone" });
  const r = await recordSubscriptionPurchase(user, "cs_1", d);
  assertEquals(r.status, 200);
  assertEquals(inserted.length, 1);
});

Deno.test("an unpaid session is not recorded (unchanged)", async () => {
  const { d, inserted } = deps([ANA], [session({ payment_status: "unpaid" })]);
  const r = await recordSubscriptionPurchase(user, "cs_1", d);
  assertEquals(r.status, 500);
  assertEquals(inserted, []);
});

Deno.test("an unknown session id is a 404, nothing recorded", async () => {
  const { d, inserted } = deps([ANA], []);
  const r = await recordSubscriptionPurchase(user, "cs_nope", d);
  assertEquals(r.status, 404);
  assertEquals(inserted, []);
});

Deno.test("the invoice step never writes to Stripe", async () => {
  const { f, d } = deps([ANA], [session()]);
  await recordSubscriptionPurchase(user, "cs_1", d);
  assertEquals(f.writes, []);
});
