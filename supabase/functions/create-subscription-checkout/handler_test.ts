import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { type CheckoutDeps, startCheckout } from "./handler.ts";
import { activeSub, fakeStripe, type FakeCustomer } from "../_shared/stripe_fake_test.ts";

const user = { id: "u-ana", email: "ana@example.test" };
const ORIGIN = "https://www.b2bnest.online";
function deps(customers: FakeCustomer[] = [], opts: { stored?: string | null; member?: boolean; subs?: unknown[] } = {}) {
  const f = fakeStripe({ customers, subscriptions: opts.subs ?? [] });
  const d: CheckoutDeps = { stripe: f.stripe, isActiveMember: async () => opts.member ?? true, storedCustomerId: async () => opts.stored ?? null };
  return { f, d };
}
const sessionCreates = (f: ReturnType<typeof fakeStripe>) => f.writes.filter((w) => w.op === "checkout.sessions.create");
const customerCreates = (f: ReturnType<typeof fakeStripe>) => f.writes.filter((w) => w.op === "customers.create");

// The exact parameters today's code sends to Stripe for a new subscriber (Solo, monthly).
const EXPECTED_SESSION = (customer: string) => ({
  customer,
  mode: "subscription",
  line_items: [{ price: "price_b2bnest_starter_monthly_gbp", quantity: 1 }],
  allow_promotion_codes: false,
  success_url: `${ORIGIN}/payment-success?session_id={CHECKOUT_SESSION_ID}&create_invoice=true`,
  cancel_url: `${ORIGIN}/pricing`,
  client_reference_id: "u-ana",
  subscription_data: { metadata: { supabase_user_id: "u-ana", b2bnest_plan: "starter", b2bnest_interval: "month", organization_id: "" } },
  metadata: { supabase_user_id: "u-ana", b2bnest_plan: "starter", b2bnest_interval: "month", organization_id: "" },
});

Deno.test("regression: a new user gets exactly today's Stripe calls (one customer with ownership metadata, the same session)", async () => {
  const { f, d } = deps();
  const r = await startCheckout(user, { planId: "starter", isAnnual: false }, ORIGIN, d);
  assertEquals(r.status, 200);
  assertEquals(customerCreates(f).map((w) => w.params), [{ email: "ana@example.test", metadata: { supabase_user_id: "u-ana" } }]);
  assertEquals(sessionCreates(f).map((w) => w.params), [EXPECTED_SESSION("cus_new_1")]);
});

Deno.test("an existing customer verified as this user's is reused, nothing created; same session parameters", async () => {
  const { f, d } = deps([{ id: "cus_ana", email: "ana@example.test", metadata: { supabase_user_id: "u-ana" } }]);
  const r = await startCheckout(user, { planId: "starter" }, ORIGIN, d);
  assertEquals(r.status, 200);
  assertEquals(customerCreates(f), []);
  assertEquals(sessionCreates(f).map((w) => w.params), [EXPECTED_SESSION("cus_ana")]);
});

Deno.test("a stored customer that still exists is kept even without metadata (existing subscribers keep working)", async () => {
  const { f, d } = deps([{ id: "cus_legacy", email: "ana@example.test" }], { stored: "cus_legacy" });
  const r = await startCheckout(user, { planId: "starter" }, ORIGIN, d);
  assertEquals(r.status, 200);
  assertEquals(sessionCreates(f)[0].params.customer, "cus_legacy");
  assertEquals(customerCreates(f), []);
});

Deno.test("a customer with the same email OWNED BY SOMEONE ELSE is never used: clear error, nothing created or charged", async () => {
  const { f, d } = deps([{ id: "cus_bob", email: "ana@example.test", metadata: { supabase_user_id: "u-bob" } }]);
  const r = await startCheckout(user, { planId: "starter" }, ORIGIN, d);
  assertEquals(r.status, 409);
  assertEquals(r.body.error, "billing_account_unverified");
  assertEquals(f.writes, []);
});

Deno.test("a customer with the same email and NO ownership metadata is not guessed: clear error, nothing written", async () => {
  const { f, d } = deps([{ id: "cus_dash", email: "ana@example.test" }]);
  const r = await startCheckout(user, { planId: "starter" }, ORIGIN, d);
  assertEquals([r.status, r.body.error], [409, "billing_account_unverified"]);
  assertEquals(f.writes, []);
});

Deno.test("two customers with this email (ambiguous): clear error, nothing written", async () => {
  const m = { supabase_user_id: "u-ana" };
  const { f, d } = deps([{ id: "c1", email: "ana@example.test", metadata: m }, { id: "c2", email: "ana@example.test", metadata: m }]);
  const r = await startCheckout(user, { planId: "starter" }, ORIGIN, d);
  assertEquals([r.status, r.body.error], [409, "billing_account_unverified"]);
  assertEquals(f.writes, []);
});

Deno.test("stored id gone and no email match: a NEW customer with ownership metadata", async () => {
  const { f, d } = deps([], { stored: "cus_deleted" });
  const r = await startCheckout(user, { planId: "starter" }, ORIGIN, d);
  assertEquals(r.status, 200);
  assertEquals(customerCreates(f).map((w) => w.params.metadata), [{ supabase_user_id: "u-ana" }]);
});

Deno.test("a stored customer whose metadata names ANOTHER user is refused", async () => {
  const { f, d } = deps([{ id: "cus_x", email: "ana@example.test", metadata: { supabase_user_id: "u-bob" } }], { stored: "cus_x" });
  const r = await startCheckout(user, { planId: "starter" }, ORIGIN, d);
  assertEquals([r.status, r.body.error], [409, "billing_account_unverified"]);
  assertEquals(f.writes, []);
});

Deno.test("the duplicate-subscription guard still runs on the verified customer", async () => {
  const { f, d } = deps([{ id: "cus_ana", email: "ana@example.test", metadata: { supabase_user_id: "u-ana" } }], { subs: [activeSub("sub_1", "cus_ana")] });
  const r = await startCheckout(user, { planId: "starter" }, ORIGIN, d);
  assertEquals([r.status, r.body.error], [409, "already_subscribed"]);
  assertEquals(sessionCreates(f), []);
});

Deno.test("company path: a non-member is refused before Stripe is touched", async () => {
  const { f, d } = deps([], { member: false });
  const r = await startCheckout(user, { planId: "starter", organizationId: "org-1" }, ORIGIN, d);
  assertEquals(r.status, 403);
  assertEquals([f.writes.length, f.reads.length], [0, 0]);
});

Deno.test("company path: an active member's checkout records the company only as metadata", async () => {
  const { f, d } = deps();
  const r = await startCheckout(user, { planId: "starter", organizationId: "org-1" }, ORIGIN, d);
  assertEquals(r.status, 200);
  assert(sessionCreates(f)[0].params.metadata.organization_id === "org-1");
});
