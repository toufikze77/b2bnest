import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { resolveVerifiedCustomer } from "./verified-customer.ts";

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
