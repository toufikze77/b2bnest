import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { PLAN_CATALOG, planFromAmount, planFromLookupKey, priceForNewSubscription, PlanPriceNotConfigured, resolveStripePrice } from "./plans.ts";

Deno.test("new prices: Solo £19/£190, Business £59/£590, Scale £89/£890 (annual = 10 x monthly)", () => {
  const p = (k: keyof typeof PLAN_CATALOG) => [PLAN_CATALOG[k].name, PLAN_CATALOG[k].prices.month.amount, PLAN_CATALOG[k].prices.year.amount];
  assertEquals(p("starter"), ["Solo", 1900, 19000]);
  assertEquals(p("professional"), ["Business", 5900, 59000]);
  assertEquals(p("enterprise"), ["Scale", 8900, 89000]);
  for (const plan of Object.values(PLAN_CATALOG)) assertEquals(plan.prices.year.amount, plan.prices.month.amount * 10);
});

Deno.test("stored tier names and plan keys are unchanged", () => {
  assertEquals(Object.values(PLAN_CATALOG).map((p) => [p.key, p.tier]), [["starter", "Starter"], ["professional", "Professional"], ["enterprise", "Enterprise"]]);
});

Deno.test("limits: Solo 1/1, Business 50/5, Scale 100/10; legacy Business 5 users, legacy Scale 25 users", () => {
  assertEquals(PLAN_CATALOG.starter.limits, { members: 1, admins: 1 });
  assertEquals(PLAN_CATALOG.professional.limits, { members: 50, admins: 5 });
  assertEquals(PLAN_CATALOG.enterprise.limits, { members: 100, admins: 10 });
  assertEquals(PLAN_CATALOG.professional.legacy!.limits, { members: 5, admins: 5 });
  assertEquals(PLAN_CATALOG.enterprise.legacy!.limits, { members: 25, admins: 10 });
});

Deno.test("legacy lookup keys still resolve to Business / Scale, flagged legacy", () => {
  const pm = planFromLookupKey("b2bnest_professional_monthly_gbp")!;
  assertEquals([pm.plan.key, pm.interval, pm.legacy, pm.price.amount], ["professional", "month", true, 3500]);
  const ey = planFromLookupKey("b2bnest_enterprise_annual_gbp")!;
  assertEquals([ey.plan.key, ey.interval, ey.legacy, ey.price.amount], ["enterprise", "year", true, 85000]);
  const bm = planFromLookupKey("b2bnest_business_monthly_gbp")!;
  assertEquals([bm.plan.key, bm.legacy], ["professional", false]);
  assertEquals(planFromLookupKey("unknown"), null);
});

Deno.test("amount fallback: legacy 3500/35000 and 8500/85000 keep resolving to Business and Scale", () => {
  const r = (a: number, i: string) => { const x = planFromAmount(a, i); return x ? [x.plan.key, x.legacy] : null; };
  assertEquals(r(3500, "month"), ["professional", true]);
  assertEquals(r(35000, "year"), ["professional", true]);
  assertEquals(r(8500, "month"), ["enterprise", true]);
  assertEquals(r(85000, "year"), ["enterprise", true]);
  assertEquals(r(5900, "month"), ["professional", false]);
  assertEquals(r(89000, "year"), ["enterprise", false]);
  assertEquals(r(1900, "month"), ["starter", false]);
  assertEquals(r(3500, "year"), null); // wrong interval for that amount
  assertEquals(r(4200, "month"), null);
});

type FakePrice = { id: string; lookup_key: string; unit_amount: number; currency: string; recurring: { interval: string } };
function fakeStripe(prices: FakePrice[]) {
  const calls: string[] = [];
  return {
    calls,
    stripe: {
      prices: {
        list: async ({ lookup_keys }: { lookup_keys: string[] }) => { calls.push(`list:${lookup_keys[0]}`); return { data: prices.filter((p) => p.lookup_key === lookup_keys[0]) }; },
        create: async () => { calls.push("create"); throw new Error("must never create"); },
      },
      products: { create: async () => { calls.push("product.create"); }, search: async () => ({ data: [] }) },
    },
  };
}

Deno.test("new checkout uses today's price by lookup key; never a legacy price; never creates anything in Stripe", async () => {
  const { stripe, calls } = fakeStripe([
    { id: "price_legacy", lookup_key: "b2bnest_professional_monthly_gbp", unit_amount: 3500, currency: "gbp", recurring: { interval: "month" } },
    { id: "price_new", lookup_key: "b2bnest_business_monthly_gbp", unit_amount: 5900, currency: "gbp", recurring: { interval: "month" } },
  ]);
  const r = await priceForNewSubscription(stripe, "professional", "month");
  assertEquals(r, { ok: true, priceId: "price_new" });
  assertEquals(calls, ["list:b2bnest_business_monthly_gbp"]);
});

Deno.test("a price not yet created in Stripe: clear 503, nothing created, nothing charged", async () => {
  const { stripe, calls } = fakeStripe([]);
  const r = await priceForNewSubscription(stripe, "enterprise", "year");
  assertEquals(r.ok, false);
  if (!r.ok) { assertEquals(r.status, 503); assertEquals(r.body.error, "plan_not_available"); }
  assert(!calls.includes("create") && !calls.includes("product.create"));
  let thrown: unknown = null;
  try { await resolveStripePrice(stripe, "enterprise", "year"); } catch (e) { thrown = e; }
  assert(thrown instanceof PlanPriceNotConfigured);
});

Deno.test("a Stripe price whose amount, interval or currency differs from the catalogue is refused", async () => {
  for (const bad of [
    { unit_amount: 3500, currency: "gbp", recurring: { interval: "month" } },
    { unit_amount: 5900, currency: "gbp", recurring: { interval: "year" } },
    { unit_amount: 5900, currency: "usd", recurring: { interval: "month" } },
  ]) {
    const { stripe } = fakeStripe([{ id: "p", lookup_key: "b2bnest_business_monthly_gbp", ...bad }]);
    let thrown = false;
    try { await priceForNewSubscription(stripe, "professional", "month"); } catch { thrown = true; }
    assert(thrown, JSON.stringify(bad));
  }
});
