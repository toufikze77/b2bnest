// Resolves the Stripe customer for a signed-in user without ever guessing.
// - A stored customer id is used only if it exists in the Stripe account the key belongs to.
// - Email fallback requires EXACTLY one customer with that email AND metadata.supabase_user_id
//   equal to the user's id (set by create-subscription-checkout). Otherwise nothing is returned.
// Never writes records.
// deno-lint-ignore no-explicit-any
type StripeLike = any;

export type CustomerResolution =
  | { customerId: string; source: "stored" | "verified_email"; storedMissing: boolean }
  | { customerId: null; reason: "stored_missing_no_verified_match" | "no_customer" | "ambiguous_email" | "unverified_email" };

export async function resolveVerifiedCustomer(
  stripe: StripeLike,
  user: { id: string; email: string },
  storedId: string | null,
): Promise<CustomerResolution> {
  let storedMissing = false;
  if (storedId) {
    try {
      const c = await stripe.customers.retrieve(storedId);
      if (c && !c.deleted) return { customerId: storedId, source: "stored", storedMissing: false };
      storedMissing = true;
    } catch (err) {
      // deno-lint-ignore no-explicit-any
      if ((err as any)?.code !== "resource_missing") throw err;
      storedMissing = true;
    }
  }
  const list = (await stripe.customers.list({ email: user.email, limit: 2 })).data ?? [];
  if (list.length === 0) return { customerId: null, reason: storedMissing ? "stored_missing_no_verified_match" : "no_customer" };
  if (list.length > 1) return { customerId: null, reason: "ambiguous_email" };
  const only = list[0];
  if (only?.metadata?.supabase_user_id !== user.id) return { customerId: null, reason: "unverified_email" };
  return { customerId: only.id, source: "verified_email", storedMissing };
}
