// A small in-memory Stripe for the billing tests (no network). Records every call that would write to Stripe.
import { PLAN_CATALOG } from "./plans.ts";

export type FakeCustomer = { id: string; email: string | null; metadata?: Record<string, string>; deleted?: boolean };
// deno-lint-ignore no-explicit-any
export type Any = any;

const missing = (what: string) => { const e = new Error(`No such ${what}`) as Error & { code: string }; e.code = "resource_missing"; return e; };

export function fakeStripe(init: { customers?: FakeCustomer[]; subscriptions?: Any[]; sessions?: Any[] } = {}) {
  const customers = [...(init.customers ?? [])];
  const subscriptions = [...(init.subscriptions ?? [])];
  const sessions = [...(init.sessions ?? [])];
  const writes: { op: string; params: Any }[] = [];
  const reads: string[] = [];
  let n = 0;
  const allPrices = Object.values(PLAN_CATALOG).flatMap((p) => Object.values(p.prices).map((pr) => ({
    id: `price_${pr.lookupKey}`, lookup_key: pr.lookupKey, unit_amount: pr.amount, currency: "gbp", recurring: { interval: pr.interval },
  })));
  const stripe = {
    customers: {
      retrieve: async (id: string) => { reads.push(`customers.retrieve:${id}`); const c = customers.find((x) => x.id === id); if (!c) throw missing("customer"); return c; },
      list: async ({ email, limit }: { email: string; limit: number }) => {
        reads.push(`customers.list:${limit}`);
        return { data: customers.filter((c) => !c.deleted && (c.email ?? "").toLowerCase() === (email ?? "").toLowerCase()).slice(0, limit) };
      },
      create: async (params: Any) => { writes.push({ op: "customers.create", params }); const c = { id: `cus_new_${++n}`, ...params }; customers.push(c); return c; },
    },
    subscriptions: {
      list: async ({ customer }: { customer: string }) => ({ data: subscriptions.filter((s) => s.customer === customer) }),
      retrieve: async (id: string) => { const s = subscriptions.find((x) => x.id === id); if (!s) throw missing("subscription"); return s; },
    },
    checkout: {
      sessions: {
        create: async (params: Any) => { writes.push({ op: "checkout.sessions.create", params }); return { id: `cs_new_${++n}`, url: "https://checkout.stripe.test/s", status: "open" }; },
        retrieve: async (id: string) => { const s = sessions.find((x) => x.id === id); if (!s) throw missing("checkout.session"); return s; },
      },
    },
    invoices: { retrieve: async (id: string) => ({ id, number: "B2B-0001", hosted_invoice_url: "https://invoice.stripe.test/i" }) },
    prices: { list: async ({ lookup_keys }: { lookup_keys: string[] }) => ({ data: allPrices.filter((p) => p.lookup_key === lookup_keys[0]) }) },
  };
  return { stripe, writes, reads, customers };
}

export const priceFor = (lookupKey: string) => {
  for (const p of Object.values(PLAN_CATALOG)) for (const pr of Object.values(p.prices)) if (pr.lookupKey === lookupKey) {
    return { id: `price_${lookupKey}`, lookup_key: lookupKey, unit_amount: pr.amount, currency: "gbp", recurring: { interval: pr.interval } };
  }
  throw new Error("unknown lookup key");
};
export const activeSub = (id: string, customer: string, lookupKey = "b2bnest_starter_monthly_gbp", metadata: Record<string, string> = {}) => ({
  id, customer, status: "active", metadata, cancel_at_period_end: false, current_period_start: 1_760_000_000, current_period_end: 1_762_600_000,
  items: { data: [{ price: priceFor(lookupKey) }] },
});
