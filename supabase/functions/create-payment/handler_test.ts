import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { createPayment, type PaymentDeps } from "./handler.ts";
import { fakeStripe, type FakeCustomer } from "../_shared/stripe_fake_test.ts";

const user = { id: "u-ana", email: "ana@example.test" };
const ORIGIN = "https://www.b2bnest.online";
const body = { amount: 1999, currency: "gbp", itemName: "NDA template" };
function deps(customers: FakeCustomer[], stored: string | null = null) {
  const f = fakeStripe({ customers });
  const recorded: Record<string, unknown>[] = [];
  const d: PaymentDeps = { stripe: f.stripe, storedCustomerId: async () => stored, recordPayment: async (a) => { recorded.push(a); } };
  return { f, d, recorded };
}
const sessions = (f: ReturnType<typeof fakeStripe>) => f.writes.filter((w) => w.op === "checkout.sessions.create").map((w) => w.params);
const EXPECTED = (who: { customer?: string; customer_email?: string }) => ({
  customer: who.customer, customer_email: who.customer_email,
  line_items: [{ price_data: { currency: "gbp", product_data: { name: "NDA template" }, unit_amount: 1999 }, quantity: 1 }],
  mode: "payment", success_url: `${ORIGIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${ORIGIN}/pricing`,
});

Deno.test("regression: no customer yet → guest checkout by email, exactly today's parameters, nothing created", async () => {
  const { f, d, recorded } = deps([]);
  const r = await createPayment(user, body, ORIGIN, d);
  assertEquals(r.status, 200);
  assertEquals(sessions(f), [EXPECTED({ customer_email: "ana@example.test" })]);
  assertEquals(f.writes.filter((w) => w.op === "customers.create"), []);
  assertEquals(recorded.length, 1);
});

Deno.test("legitimate user: their verified customer is used, exactly today's parameters", async () => {
  const { f, d } = deps([{ id: "cus_ana", email: "ana@example.test", metadata: { supabase_user_id: "u-ana" } }]);
  const r = await createPayment(user, body, ORIGIN, d);
  assertEquals(r.status, 200);
  assertEquals(sessions(f), [EXPECTED({ customer: "cus_ana" })]);
});

Deno.test("a stored customer that still exists is used", async () => {
  const { f, d } = deps([{ id: "cus_legacy", email: "ana@example.test" }], "cus_legacy");
  await createPayment(user, body, ORIGIN, d);
  assertEquals(sessions(f)[0].customer, "cus_legacy");
});

Deno.test("ANOTHER user's customer with the same email is never used: clear error, no session", async () => {
  const { f, d, recorded } = deps([{ id: "cus_bob", email: "ana@example.test", metadata: { supabase_user_id: "u-bob" } }]);
  const r = await createPayment(user, body, ORIGIN, d);
  assertEquals(r.status, 409);
  assertEquals(r.body.error, "billing_account_unverified");
  assertEquals(f.writes, []);
  assertEquals(recorded, []);
});

Deno.test("a same-email customer without ownership metadata is not used", async () => {
  const { f, d } = deps([{ id: "cus_x", email: "ana@example.test" }]);
  const r = await createPayment(user, body, ORIGIN, d);
  assertEquals(r.status, 409);
  assertEquals(f.writes, []);
});

Deno.test("ambiguous email: refused, never first-picked", async () => {
  const m = { metadata: { supabase_user_id: "u-ana" } };
  const { f, d } = deps([{ id: "a", email: "ana@example.test", ...m }, { id: "b", email: "ana@example.test", ...m }]);
  const r = await createPayment(user, body, ORIGIN, d);
  assertEquals(r.status, 409);
  assertEquals(f.writes, []);
});

Deno.test("stored id gone and no verified match → guest checkout (no one else's customer)", async () => {
  const { f, d } = deps([], "cus_gone");
  const r = await createPayment(user, body, ORIGIN, d);
  assertEquals(r.status, 200);
  assertEquals(sessions(f), [EXPECTED({ customer_email: "ana@example.test" })]);
});

Deno.test("invalid amount is still refused before Stripe (unchanged)", async () => {
  const { f, d } = deps([]);
  const r = await createPayment(user, { ...body, amount: 10 }, ORIGIN, d);
  assertEquals(r.status, 400);
  assertEquals(f.reads, []);
});
