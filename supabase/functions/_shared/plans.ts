// B2BNEST plan catalogue — single source of truth for server-side billing.
// Amounts are in pence (GBP). src/lib/plans.ts (the Pricing page) must match; src/test/planCatalogue.test.ts fails if not.
//
// Plans from 23 Oct 2026 (new sign-ups and any plan change):
//   Solo £19 / £190 · Business £59 / £590 · Scale £89 / £890
// Legacy prices, kept ONLY so existing subscribers keep paying what they pay today and keep resolving to the right plan:
//   Business (was Professional) £35 / £350 · Scale (was Enterprise) £85 / £850
// Plan keys and the stored tier names (subscribers.plan_key / subscription_tier) are unchanged: starter, professional,
// enterprise / Starter, Professional, Enterprise. Only the display names changed.
// Never accept an amount from the client; always resolve it from this table.

export type PlanKey = "starter" | "professional" | "enterprise";
export type BillingInterval = "month" | "year";

export interface PlanPriceDefinition {
  amount: number; // pence
  interval: BillingInterval;
  lookupKey: string; // stable Stripe Price lookup key (set when the price is created in the Stripe dashboard)
}

export interface PlanLimits {
  members: number; // total users, owners and admins included
  admins: number; // owners and admins together
}

export interface PlanDefinition {
  key: PlanKey;
  name: string; // display name
  tier: string; // value stored in subscribers.subscription_tier (unchanged)
  aiCreditLimit: number;
  limits: PlanLimits;
  prices: Record<BillingInterval, PlanPriceDefinition>; // sold to new subscribers
  // Older prices still paid by existing subscribers. Never offered for a new checkout or a plan change.
  legacy?: { limits: PlanLimits; prices: Record<BillingInterval, PlanPriceDefinition> };
}

export const CURRENCY = "gbp";

export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  starter: {
    key: "starter",
    name: "Solo",
    tier: "Starter",
    aiCreditLimit: 250,
    limits: { members: 1, admins: 1 },
    prices: {
      month: { amount: 1900, interval: "month", lookupKey: "b2bnest_starter_monthly_gbp" },
      year: { amount: 19000, interval: "year", lookupKey: "b2bnest_starter_annual_gbp" },
    },
  },
  professional: {
    key: "professional",
    name: "Business",
    tier: "Professional",
    aiCreditLimit: 1000,
    limits: { members: 50, admins: 5 },
    prices: {
      month: { amount: 5900, interval: "month", lookupKey: "b2bnest_business_monthly_gbp" },
      year: { amount: 59000, interval: "year", lookupKey: "b2bnest_business_annual_gbp" },
    },
    legacy: {
      limits: { members: 5, admins: 5 },
      prices: {
        month: { amount: 3500, interval: "month", lookupKey: "b2bnest_professional_monthly_gbp" },
        year: { amount: 35000, interval: "year", lookupKey: "b2bnest_professional_annual_gbp" },
      },
    },
  },
  enterprise: {
    key: "enterprise",
    name: "Scale",
    tier: "Enterprise",
    aiCreditLimit: 5000,
    limits: { members: 100, admins: 10 },
    prices: {
      month: { amount: 8900, interval: "month", lookupKey: "b2bnest_scale_monthly_gbp" },
      year: { amount: 89000, interval: "year", lookupKey: "b2bnest_scale_annual_gbp" },
    },
    legacy: {
      limits: { members: 25, admins: 10 },
      prices: {
        month: { amount: 8500, interval: "month", lookupKey: "b2bnest_enterprise_monthly_gbp" },
        year: { amount: 85000, interval: "year", lookupKey: "b2bnest_enterprise_annual_gbp" },
      },
    },
  },
};

export const isPlanKey = (value: unknown): value is PlanKey =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(PLAN_CATALOG, value);

export interface ResolvedPrice {
  plan: PlanDefinition;
  interval: BillingInterval;
  price: PlanPriceDefinition;
  legacy: boolean; // an older price kept for an existing subscriber
  limits: PlanLimits; // the limits that go with THIS price (legacy prices keep their old user limit)
}

function* allPrices(): Generator<ResolvedPrice> {
  for (const plan of Object.values(PLAN_CATALOG)) {
    for (const interval of ["month", "year"] as BillingInterval[]) {
      yield { plan, interval, price: plan.prices[interval], legacy: false, limits: plan.limits };
      if (plan.legacy) yield { plan, interval, price: plan.legacy.prices[interval], legacy: true, limits: plan.legacy.limits };
    }
  }
}

export const planFromLookupKey = (lookupKey?: string | null): ResolvedPrice | null => {
  if (!lookupKey) return null;
  for (const r of allPrices()) if (r.price.lookupKey === lookupKey) return r;
  return null;
};

// Fallback used only when a Stripe price has no lookup key. Covers the current AND the legacy amounts, so an
// existing Business/Scale subscriber on £35/£350 or £85/£850 never falls back to the wrong plan.
export const planFromAmount = (amount?: number | null, interval?: string | null): ResolvedPrice | null => {
  if (typeof amount !== "number") return null;
  for (const r of allPrices()) {
    if (r.price.amount === amount && (!interval || interval === r.interval)) return r;
  }
  return null;
};

/** The price for a NEW subscription or a plan change has not been created in Stripe yet. Nothing is charged. */
export class PlanPriceNotConfigured extends Error {
  constructor(public readonly lookupKey: string) {
    super(`plan_price_not_configured:${lookupKey}`);
  }
}
/** The one Stripe call price resolution needs (kept narrow so tests can pass a fake). */
export interface StripePriceLister {
  prices: {
    list: (params: { lookup_keys: string[]; active: boolean; limit: number }) => Promise<{
      data: { id: string; unit_amount: number | null; currency?: string | null; recurring?: { interval?: string | null } | null }[];
    }>;
  };
}

export const PLAN_NOT_AVAILABLE_MESSAGE = "This plan can't be bought yet. Nothing has been charged. Please try again later.";

/**
 * Find the Stripe Price for a plan/interval by its lookup key. Prices are created by the owner in the Stripe dashboard
 * (see docs/phase11b/README.md); this code never creates or changes anything in Stripe. A missing price throws
 * PlanPriceNotConfigured, and a price whose amount or interval differs from the catalogue is refused.
 */
export async function resolveStripePrice(
  stripe: StripePriceLister,
  planKey: PlanKey,
  interval: BillingInterval,
): Promise<{ priceId: string; definition: PlanPriceDefinition; plan: PlanDefinition }> {
  const plan = PLAN_CATALOG[planKey];
  const definition = plan.prices[interval];

  const existing = await stripe.prices.list({ lookup_keys: [definition.lookupKey], active: true, limit: 1 });
  const price = existing.data[0];
  if (!price) throw new PlanPriceNotConfigured(definition.lookupKey);
  // Defensive: never charge an amount or currency that differs from the catalogue.
  if (price.unit_amount !== definition.amount || price.recurring?.interval !== interval || (price.currency ?? CURRENCY) !== CURRENCY) {
    throw new Error(
      `Stripe price ${price.id} (${definition.lookupKey}) does not match the catalogue ` +
        `(${price.unit_amount} ${price.currency} ${price.recurring?.interval} vs ${definition.amount} ${CURRENCY} ${interval}).`,
    );
  }
  return { priceId: price.id, definition, plan };
}

/** The price a NEW checkout or a plan change uses: always today's price, never a legacy one. */
export async function priceForNewSubscription(
  stripe: StripePriceLister,
  planKey: PlanKey,
  interval: BillingInterval,
): Promise<{ ok: true; priceId: string } | { ok: false; status: 503; body: { error: "plan_not_available"; message: string } }> {
  try {
    return { ok: true, priceId: (await resolveStripePrice(stripe, planKey, interval)).priceId };
  } catch (e) {
    if (e instanceof PlanPriceNotConfigured) return { ok: false, status: 503, body: { error: "plan_not_available", message: PLAN_NOT_AVAILABLE_MESSAGE } };
    throw e;
  }
}
