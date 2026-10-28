// Resolves the Stripe customer for a signed-in user without ever guessing.
// - A stored customer id is used only if it exists in the Stripe account the key belongs to, and its
//   metadata.supabase_user_id (when set) is the user's own id. A stored customer marked as someone else's is refused.
// - Email fallback requires EXACTLY one customer with that email AND metadata.supabase_user_id
//   equal to the user's id (set by create-subscription-checkout). Otherwise nothing is returned.
// resolveVerifiedCustomer never writes. resolveOrCreateVerifiedCustomer writes only one thing: a NEW customer with
// ownership metadata, when the user has none at all. It never reuses an unverified email match.
// deno-lint-ignore no-explicit-any
export type StripeLike = any;

export type CustomerResolution =
  | { customerId: string; source: "stored" | "verified_email"; storedMissing: boolean }
  | {
    customerId: null;
    reason: "stored_missing_no_verified_match" | "no_customer" | "ambiguous_email" | "unverified_email" | "stored_owned_by_other";
  };

export async function resolveVerifiedCustomer(
  stripe: StripeLike,
  user: { id: string; email: string },
  storedId: string | null,
): Promise<CustomerResolution> {
  let storedMissing = false;
  if (storedId) {
    try {
      const c = await stripe.customers.retrieve(storedId);
      if (c && !c.deleted) {
        const owner = c.metadata?.supabase_user_id;
        if (owner && owner !== user.id) return { customerId: null, reason: "stored_owned_by_other" };
        return { customerId: storedId, source: "stored", storedMissing: false };
      }
      storedMissing = true;
    } catch (err) {
      if ((err as { code?: string })?.code !== "resource_missing") throw err;
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

/** Shown in the app when a billing account can't be linked safely. */
export const BILLING_LINK_ERROR = "We couldn't link your billing account. Please contact support.";
export const BILLING_LINK_ERROR_CODE = "billing_account_unverified";

/** The reasons that mean "a customer exists but can't be proven to be this user's". */
export const isUnverified = (reason: string) => reason === "ambiguous_email" || reason === "unverified_email" || reason === "stored_owned_by_other";

export const billingLinkError = (reason: string) => ({
  status: 409, body: { error: BILLING_LINK_ERROR_CODE, message: BILLING_LINK_ERROR, reason },
});

export type ResolveOrCreate =
  | { ok: true; customerId: string; source: "stored" | "verified_email" | "created" }
  | { ok: false; status: number; body: { error: string; message: string; reason: string } };

/** For checkout only: the user's verified customer, or a NEW one when they have none. Never an unverified match. */
export async function resolveOrCreateVerifiedCustomer(
  stripe: StripeLike,
  user: { id: string; email: string },
  storedId: string | null,
): Promise<ResolveOrCreate> {
  const r = await resolveVerifiedCustomer(stripe, user, storedId);
  if (r.customerId !== null) return { ok: true, customerId: r.customerId, source: r.source };
  if (isUnverified(r.reason)) return { ok: false, ...billingLinkError(r.reason) };
  const created = await stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } });
  return { ok: true, customerId: created.id, source: "created" };
}
