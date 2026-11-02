import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { type BeginResult, CAP_REACHED, CHOOSE_PLAN_FIRST, RATE_LIMITED, returnOrigin, startTopupCheckout, type TopupCheckoutDeps, TOPUPS_UNAVAILABLE } from "./handler.ts";
import { TOPUP_PACKS } from "../_shared/topup-packs.ts";
import { fakeStripe, type FakeCustomer } from "../_shared/stripe_fake_test.ts";

const user = { id: "u-ana", email: "ana@example.test" };
const ORIGIN = "https://www.b2bnest.online";
const NOW = 1_800_000_000_000;
const okBegin = (packId: string): BeginResult => {
  const p = TOPUP_PACKS.find((x) => x.id === packId)!;
  return { success: true, checkout_id: "chk-1", pack_id: p.id, credits: p.credits, amount_pence: p.amountPence, currency: "gbp" };
};
function setup(opts: { enabled?: boolean; begin?: (u: string, p: string) => BeginResult; customers?: FakeCustomer[]; stored?: string | null; stripeFails?: boolean } = {}) {
  const f = fakeStripe({ customers: opts.customers ?? [{ id: "cus_ana", email: "ana@example.test", metadata: { supabase_user_id: "u-ana" } }] });
  if (opts.stripeFails) f.stripe.checkout.sessions.create = async () => { throw Object.assign(new Error("card_declined"), { code: "api_error" }); };
  const begins: [string, string][] = []; const attaches: [string, string | null][] = []; const logs: unknown[] = [];
  const d: TopupCheckoutDeps = {
    stripe: f.stripe,
    enabled: opts.enabled ?? true,
    begin: async (u, p) => { begins.push([u, p]); return (opts.begin ?? ((_u, pk) => okBegin(pk)))(u, p); },
    attach: async (c, s) => { attaches.push([c, s]); },
    storedCustomerId: async () => opts.stored ?? "cus_ana",
    now: () => NOW,
    log: (step, details) => logs.push({ step, details }),
  };
  return { f, d, begins, attaches, logs };
}
const sessions = (f: ReturnType<typeof fakeStripe>) => f.writes.filter((w) => w.op === "checkout.sessions.create").map((w) => w.params);

Deno.test("flag off: 'Top-ups aren't available yet', nothing started, Stripe untouched", async () => {
  const { f, d, begins } = setup({ enabled: false });
  const r = await startTopupCheckout(user, { packId: "credits_100" }, ORIGIN, d);
  assertEquals(r, { status: 503, body: { error: "topups_disabled", message: TOPUPS_UNAVAILABLE } });
  assertEquals(begins, []); assertEquals(f.writes, []);
});

Deno.test("a subscriber gets one payment session; price and credits from the catalogue only", async () => {
  const { f, d, attaches } = setup();
  const r = await startTopupCheckout(user, { packId: "credits_300", credits: 99999, amount: 1, price: 1 }, ORIGIN, d);
  assertEquals(r.status, 200);
  const metadata = { type: "ai_topup", user_id: "u-ana", pack_id: "credits_300", checkout_id: "chk-1" };
  assertEquals(sessions(f), [{
    customer: "cus_ana",
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "gbp", unit_amount: 1200, product_data: { name: "AI credits: 300" } } }],
    allow_promotion_codes: false,
    expires_at: NOW / 1000 + 31 * 60,
    success_url: `${ORIGIN}/settings?tab=billing&topup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${ORIGIN}/settings?tab=billing&topup=cancelled`,
    client_reference_id: "u-ana",
    metadata,
    payment_intent_data: { metadata },
  }]);
  assertEquals(attaches, [["chk-1", "cs_new_1"]]);
  assertEquals(f.writes.filter((w) => w.op === "customers.create"), [], "existing customer reused");
});

Deno.test("every pack: amounts 500 / 1200 / 3500 pence, names 100 / 300 / 1,000", async () => {
  for (const [id, pence, name] of [["credits_100", 500, "AI credits: 100"], ["credits_300", 1200, "AI credits: 300"], ["credits_1000", 3500, "AI credits: 1,000"]] as const) {
    const { f, d } = setup();
    await startTopupCheckout(user, { packId: id }, ORIGIN, d);
    const li = sessions(f)[0].line_items[0].price_data;
    assertEquals([li.unit_amount, li.product_data.name], [pence, name]);
  }
});

Deno.test("an unknown pack is refused before the database or Stripe", async () => {
  for (const packId of ["credits_5000", "", null, 100, { id: "credits_100" }]) {
    const { f, d, begins } = setup();
    const r = await startTopupCheckout(user, { packId }, ORIGIN, d);
    assertEquals(r.status, 400); assertEquals(begins, []); assertEquals(f.writes, []);
  }
});

Deno.test("trial / company member / suspended (not_subscriber): 'Choose a plan first', Stripe untouched", async () => {
  const { f, d } = setup({ begin: () => ({ success: false, error: "not_subscriber", state: "trial", via: "self" }) });
  const r = await startTopupCheckout(user, { packId: "credits_100" }, ORIGIN, d);
  assertEquals(r, { status: 403, body: { error: "not_subscriber", message: CHOOSE_PLAN_FIRST } });
  assertEquals(f.writes, []);
});

Deno.test("over the 5,000 cap: refused before payment", async () => {
  const { f, d } = setup({ begin: () => ({ success: false, error: "topup_cap_exceeded" }) });
  const r = await startTopupCheckout(user, { packId: "credits_1000" }, ORIGIN, d);
  assertEquals(r, { status: 409, body: { error: "topup_cap_exceeded", message: CAP_REACHED } });
  assertEquals(CAP_REACHED, "You can hold up to 5,000 top-up credits at a time.");
  assertEquals(f.writes, []);
});

Deno.test("rate limit: one checkout a minute (429)", async () => {
  const { f, d } = setup({ begin: () => ({ success: false, error: "rate_limited" }) });
  const r = await startTopupCheckout(user, { packId: "credits_100" }, ORIGIN, d);
  assertEquals(r, { status: 429, body: { error: "rate_limited", message: RATE_LIMITED } });
  assertEquals(f.writes, []);
});

Deno.test("database and code catalogues disagree: nothing sold, checkout closed", async () => {
  const { f, d, attaches } = setup({ begin: () => ({ success: true, checkout_id: "chk-9", pack_id: "credits_100", credits: 100, amount_pence: 400, currency: "gbp" }) });
  const r = await startTopupCheckout(user, { packId: "credits_100" }, ORIGIN, d);
  assertEquals(r.status, 500); assertEquals(f.writes, []); assertEquals(attaches, [["chk-9", null]]);
});

Deno.test("Stripe fails: 502, the checkout is closed so it stops counting towards the cap", async () => {
  const { d, attaches, logs } = setup({ stripeFails: true });
  const r = await startTopupCheckout(user, { packId: "credits_100" }, ORIGIN, d);
  assertEquals(r.status, 502); assertEquals(attaches, [["chk-1", null]]);
  assert(!JSON.stringify(logs).includes("ana@example.test"), "no email in logs");
});

Deno.test("a same-email customer not proven to be theirs is never reused (and the checkout is closed)", async () => {
  const { f, d, attaches } = setup({ customers: [{ id: "cus_x", email: "ana@example.test", metadata: {} }], stored: null });
  const r = await startTopupCheckout(user, { packId: "credits_100" }, ORIGIN, d);
  assertEquals(r.status, 409); assertEquals(sessions(f), []); assertEquals(attaches, [["chk-1", null]]);
});

Deno.test("a new buyer with no customer gets one with ownership metadata", async () => {
  const { f, d } = setup({ customers: [], stored: null });
  const r = await startTopupCheckout(user, { packId: "credits_100" }, ORIGIN, d);
  assertEquals(r.status, 200);
  assertEquals(f.writes.filter((w) => w.op === "customers.create").map((w) => w.params), [{ email: "ana@example.test", metadata: { supabase_user_id: "u-ana" } }]);
});

Deno.test("return address: only our own sites", () => {
  assertEquals(returnOrigin("https://b2bnest.online"), "https://b2bnest.online");
  assertEquals(returnOrigin("http://localhost:8080"), "http://localhost:8080");
  assertEquals(returnOrigin("https://evil.example"), ORIGIN);
  assertEquals(returnOrigin(null), ORIGIN);
});
