import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { BILLING_LINK_ERROR, resolveOrCreateVerifiedCustomer, resolveVerifiedCustomer } from "./verified-customer.ts";
import { fakeStripe } from "./stripe_fake_test.ts";

const missing = () => { const e = new Error("No such customer") as Error & { code: string }; e.code = "resource_missing"; throw e; };
const fake = (list: unknown[], retrieve: (id: string) => unknown = missing) => ({
  customers: { retrieve: async (id: string) => retrieve(id), list: async () => ({ data: list }) },
});
const user = { id: "u1", email: "a@x.test" };

Deno.test("stored customer that exists is used", async () => {
  const r = await resolveVerifiedCustomer(fake([], (id) => ({ id })), user, "cus_ok");
  assertEquals(r.customerId, "cus_ok");
});
Deno.test("missing stored + one verified match is used", async () => {
  const r = await resolveVerifiedCustomer(fake([{ id: "cus_v", metadata: { supabase_user_id: "u1" } }]), user, "cus_gone");
  assertEquals(r, { customerId: "cus_v", source: "verified_email", storedMissing: true });
});
Deno.test("single match owned by someone else is refused", async () => {
  const r = await resolveVerifiedCustomer(fake([{ id: "cus_o", metadata: { supabase_user_id: "u2" } }]), user, "cus_gone");
  assertEquals(r.customerId, null);
});
Deno.test("single match without ownership metadata is refused", async () => {
  const r = await resolveVerifiedCustomer(fake([{ id: "cus_n", metadata: {} }]), user, null);
  assertEquals(r.customerId, null);
});
Deno.test("two email matches are refused, never first-picked", async () => {
  const m = { metadata: { supabase_user_id: "u1" } };
  const r = await resolveVerifiedCustomer(fake([{ id: "a", ...m }, { id: "b", ...m }]), user, null);
  assertEquals(r, { customerId: null, reason: "ambiguous_email" });
});

// Phase 14 additions (the tests above are unchanged).

Deno.test("a stored customer whose metadata names ANOTHER user is refused (never used for the caller)", async () => {
  const r = await resolveVerifiedCustomer(fake([], (id) => ({ id, metadata: { supabase_user_id: "u2" } })), user, "cus_theirs");
  assertEquals(r, { customerId: null, reason: "stored_owned_by_other" });
});
Deno.test("a stored customer whose metadata names the caller is used", async () => {
  const r = await resolveVerifiedCustomer(fake([], (id) => ({ id, metadata: { supabase_user_id: "u1" } })), user, "cus_mine");
  assertEquals(r.customerId, "cus_mine");
});
Deno.test("legitimate user, as customer-portal and change-subscription-plan call it: stored or verified customer found, no Stripe writes", async () => {
  const f = fakeStripe({ customers: [{ id: "cus_a", email: "a@x.test", metadata: { supabase_user_id: "u1" } }] });
  assertEquals((await resolveVerifiedCustomer(f.stripe, user, "cus_a")).customerId, "cus_a");
  assertEquals((await resolveVerifiedCustomer(f.stripe, user, null)).customerId, "cus_a");
  assertEquals(f.writes, []);
});
Deno.test("resolveOrCreate: no customer → creates ONE new customer with ownership metadata", async () => {
  const f = fakeStripe();
  const r = await resolveOrCreateVerifiedCustomer(f.stripe, user, null);
  assertEquals(r, { ok: true, customerId: "cus_new_1", source: "created" });
  assertEquals(f.writes, [{ op: "customers.create", params: { email: "a@x.test", metadata: { supabase_user_id: "u1" } } }]);
});
Deno.test("resolveOrCreate: stored id gone and no verified match → creates a new customer", async () => {
  const f = fakeStripe();
  const r = await resolveOrCreateVerifiedCustomer(f.stripe, user, "cus_gone");
  assertEquals(r.ok && r.source, "created");
});
Deno.test("resolveOrCreate: verified customer reused, nothing created", async () => {
  const f = fakeStripe({ customers: [{ id: "cus_a", email: "a@x.test", metadata: { supabase_user_id: "u1" } }] });
  const r = await resolveOrCreateVerifiedCustomer(f.stripe, user, null);
  assertEquals(r, { ok: true, customerId: "cus_a", source: "verified_email" });
  assertEquals(f.writes, []);
});
for (const [label, customers] of [
  ["owned by someone else", [{ id: "cus_o", email: "a@x.test", metadata: { supabase_user_id: "u2" } }]],
  ["no ownership metadata", [{ id: "cus_n", email: "a@x.test" }]],
  ["ambiguous", [{ id: "c1", email: "a@x.test", metadata: { supabase_user_id: "u1" } }, { id: "c2", email: "a@x.test", metadata: { supabase_user_id: "u1" } }]],
] as const) {
  Deno.test(`resolveOrCreate: same-email customer ${label} → clear error, never reused, nothing created`, async () => {
    const f = fakeStripe({ customers: [...customers] });
    const r = await resolveOrCreateVerifiedCustomer(f.stripe, user, null);
    assertEquals(r.ok, false);
    if (!r.ok) assertEquals([r.status, r.body.error, r.body.message], [409, "billing_account_unverified", BILLING_LINK_ERROR]);
    assertEquals(f.writes, []);
  });
}
