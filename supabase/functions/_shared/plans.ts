// B2BNEST plan catalogue — single source of truth for server-side billing.
// Amounts are in pence (GBP). These MUST match the public pricing page:
//   Starter £19 / £190 · Professional £35 / £350 · Enterprise £85 / £850
// Never accept an amount from the client; always resolve it from this table.

export type PlanKey = "starter" | "professional" | "enterprise";
export type BillingInterval = "month" | "year";

export interface PlanPriceDefinition {
  amount: number; // pence
  interval: BillingInterval;
  lookupKey: string; // stable Stripe Price lookup key
}

export interface PlanDefinition {
  key: PlanKey;
  name: string; // display name, also used as Stripe Product name
  tier: string; // value stored in subscribers.subscription_tier
  aiCreditLimit: number;
  prices: Record<BillingInterval, PlanPriceDefinition>;
}

export const CURRENCY = "gbp";

export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  starter: {
    key: "starter",
    name: "Starter Plan",
    tier: "Starter",
    aiCreditLimit: 250,
    prices: {
      month: { amount: 1900, interval: "month", lookupKey: "b2bnest_starter_monthly_gbp" },
      year: { amount: 19000, interval: "year", lookupKey: "b2bnest_starter_annual_gbp" },
    },
  },
  professional: {
    key: "professional",
    name: "Professional Plan",
    tier: "Professional",
    aiCreditLimit: 1000,
    prices: {
      month: { amount: 3500, interval: "month", lookupKey: "b2bnest_professional_monthly_gbp" },
      year: { amount: 35000, interval: "year", lookupKey: "b2bnest_professional_annual_gbp" },
    },
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise Plan",
    tier: "Enterprise",
    aiCreditLimit: 5000,
    prices: {
      month: { amount: 8500, interval: "month", lookupKey: "b2bnest_enterprise_monthly_gbp" },
      year: { amount: 85000, interval: "year", lookupKey: "b2bnest_enterprise_annual_gbp" },
    },
  },
};

export const isPlanKey = (value: unknown): value is PlanKey =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(PLAN_CATALOG, value);

export const planFromLookupKey = (
  lookupKey?: string | null,
): { plan: PlanDefinition; interval: BillingInterval } | null => {
  if (!lookupKey) return null;
  for (const plan of Object.values(PLAN_CATALOG)) {
    for (const interval of ["month", "year"] as BillingInterval[]) {
      if (plan.prices[interval].lookupKey === lookupKey) return { plan, interval };
    }
  }
  return null;
};

// Fallback used only when a Stripe price has no lookup key (e.g. legacy prices).
export const planFromAmount = (
  amount?: number | null,
  interval?: string | null,
): { plan: PlanDefinition; interval: BillingInterval } | null => {
  if (typeof amount !== "number") return null;
  for (const plan of Object.values(PLAN_CATALOG)) {
    for (const candidate of ["month", "year"] as BillingInterval[]) {
      const price = plan.prices[candidate];
      if (price.amount === amount && (!interval || interval === candidate)) {
        return { plan, interval: candidate };
      }
    }
  }
  return null;
};

/**
 * Resolve (and create once, idempotently) the stable Stripe Price for a plan/interval.
 * Prices are looked up by their lookup key, so the same Price object is reused for every
 * checkout session. Nothing is ever created twice and existing prices are never modified.
 */
export async function resolveStripePrice(
  // deno-lint-ignore no-explicit-any
  stripe: any,
  planKey: PlanKey,
  interval: BillingInterval,
): Promise<{ priceId: string; definition: PlanPriceDefinition; plan: PlanDefinition }> {
  const plan = PLAN_CATALOG[planKey];
  const definition = plan.prices[interval];

  const existing = await stripe.prices.list({
    lookup_keys: [definition.lookupKey],
    active: true,
    limit: 1,
    expand: ["data.product"],
  });

  if (existing.data.length > 0) {
    const price = existing.data[0];
    // Defensive: never silently charge an amount that differs from the catalogue.
    if (price.unit_amount !== definition.amount || price.recurring?.interval !== interval) {
      throw new Error(
        `Stripe price ${price.id} (${definition.lookupKey}) does not match the catalogue ` +
          `(${price.unit_amount} ${price.recurring?.interval} vs ${definition.amount} ${interval}). ` +
          `Archive the mismatched price in Stripe and retry.`,
      );
    }
    return { priceId: price.id, definition, plan };
  }

  // Find or create the product for this plan.
  const products = await stripe.products.search({
    query: `active:'true' AND metadata['b2bnest_plan']:'${plan.key}'`,
    limit: 1,
  });
  const product = products.data.length > 0
    ? products.data[0]
    : await stripe.products.create({
      name: `B2BNEST ${plan.name}`,
      metadata: { b2bnest_plan: plan.key },
    });

  const price = await stripe.prices.create({
    product: product.id,
    currency: CURRENCY,
    unit_amount: definition.amount,
    recurring: { interval },
    lookup_key: definition.lookupKey,
    metadata: { b2bnest_plan: plan.key, b2bnest_interval: interval },
  });

  return { priceId: price.id, definition, plan };
}
