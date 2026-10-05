// Billing-portal configuration that enforces the plan-change policy.
// Plan switching is disabled in the portal: all upgrades/downgrades go through change-subscription-plan,
// which applies upgrades now and schedules downgrades for the period end. Cancellation is at period end with
// no proration, so the portal can't refund or credit unused time either.
// The configuration is found by metadata and created once; existing configurations are never modified.
export const PORTAL_POLICY_VERSION = "b2bnest_policy_v1";

// deno-lint-ignore no-explicit-any
export async function resolvePortalConfiguration(stripe: any): Promise<string> {
  const list = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  // deno-lint-ignore no-explicit-any
  const found = list.data.find((c: any) => c.metadata?.b2bnest_policy === PORTAL_POLICY_VERSION);
  if (found) return found.id;
  const created = await stripe.billingPortal.configurations.create(
    {
      business_profile: { headline: "Manage your B2BNEST billing" },
      metadata: { b2bnest_policy: PORTAL_POLICY_VERSION },
      features: {
        customer_update: { enabled: true, allowed_updates: ["email", "address", "name", "tax_id"] },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true, mode: "at_period_end", proration_behavior: "none" },
        subscription_update: { enabled: false },
      },
    },
    { idempotencyKey: `portal-config:${PORTAL_POLICY_VERSION}` },
  );
  return created.id;
}
