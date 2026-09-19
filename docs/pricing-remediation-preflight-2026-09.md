# B2BNEST — Pricing Remediation Preflight (2026-09)

Read-only investigation. Nothing was changed: no Stripe calls, no price objects created,
no deployment, no production data modified, no pricing-page values edited.

---

## A. ROOT CAUSE

There are **two independent payment paths** in the codebase, and only one of them is wired
to the pricing page.

```text
Pricing page (src/components/PricingPlans.tsx)
  plans[] hard-coded amounts: 19/190, 35/350, 85/850   <-- source of truth, correct
  → monthly/annual toggle picks plan.monthly | plan.annual (whole pounds)
  → PaymentMethodSelector (amount, currency "GBP")
  → StripeCheckout  → supabase.functions.invoke('create-payment')
       amount * 100 (pence), currency gbp
  → create-payment/index.ts
       stripe.checkout.sessions.create({ mode: "payment", price_data: {...inline...} })
  → Stripe Checkout charges that exact amount, ONE TIME
```

```text
supabase/functions/create-subscription-checkout/index.ts
  hard-coded planPrices: starter 1900/1500, professional 4900/3900, enterprise 9900/7900
  mode: "subscription", recurring interval month|year, inline price_data
  → NO CALLER. Repository-wide search finds zero frontend or backend invocations
    (only documentation mentions). It is dead/legacy code.
```

**Root cause:** the £15/£39/£79 and £49/£99 figures live *only* in the orphaned
`create-subscription-checkout` edge function — a stale legacy price table from an earlier
pricing model. It never executes in the current product. The reported discrepancy is a
**stale backend configuration**, not a live overcharge.

**However, a separate and more material defect exists:** the live path charges the correct
amounts but as **one-time payments (`mode: "payment"`)**, not subscriptions. Annual "£190"
is a single £190 charge that never renews; monthly "£19" is a single £19 charge that never
renews. No Stripe subscription object is created by the pricing page at all.

---

## B. CURRENT ACTUAL CHECKOUT MATRIX (live path: create-payment)

| Plan | Toggle | Displayed | Billing interval | Actually charged |
|---|---|---|---|---|
| Starter | Monthly | £19 /month | **none — one-off** | £19 once |
| Starter | Annual | £190 /year | **none — one-off** | £190 once |
| Professional | Monthly | £35 /month | **none — one-off** | £35 once |
| Professional | Annual | £350 /year | **none — one-off** | £350 once |
| Enterprise | Monthly | £85 /month | **none — one-off** | £85 once |
| Enterprise | Annual | £850 /year | **none — one-off** | £850 once |

Dormant path (`create-subscription-checkout`, unreachable today). If it were ever wired up:

| Plan | Toggle | Amount | Interval | Total charged |
|---|---|---|---|---|
| Starter | Monthly | 1900 | month | £19 / month |
| Starter | Annual | 1500 | **year** | £15 per **year** |
| Professional | Monthly | 4900 | month | £49 / month |
| Professional | Annual | 3900 | **year** | £39 per **year** |
| Enterprise | Monthly | 9900 | month | £99 / month |
| Enterprise | Annual | 7900 | **year** | £79 per **year** |

Classification of £15 / £39 / £79, as asked, with no assumption: they are **stale backend
values in dead code**. They were almost certainly authored as *monthly-equivalent display*
figures, but the code applies them as `interval: "year"` unit amounts — so had this path
been live they would have been real annual charges, not monthly equivalents. They are not
Stripe Price IDs and are not actual charges today.

---

## C. INTENDED CHECKOUT MATRIX

| Plan | Interval | Amount charged | Recurrence |
|---|---|---|---|
| Starter | month | £19 | recurring monthly |
| Starter | year | £190 | recurring yearly |
| Professional | month | £35 | recurring monthly |
| Professional | year | £350 | recurring yearly |
| Enterprise | month | £85 | recurring monthly |
| Enterprise | year | £850 | recurring yearly |

---

## D. FILES / FUNCTIONS INVOLVED

| File | Role | Status |
|---|---|---|
| `src/components/PricingPlans.tsx` | displayed amounts 19/190, 35/350, 85/850; toggle; passes whole-pound amount | correct, no change needed |
| `src/components/checkout/PaymentMethodSelector.tsx` | pass-through of amount to Stripe/Coinbase | no change |
| `src/components/checkout/StripeCheckout.tsx` | converts to pence, invokes `create-payment` | change only if moving to subscriptions |
| `supabase/functions/create-payment/index.ts` | **live** Stripe session, `mode: "payment"`, inline `price_data`, validates 50–10,000,000 pence, gbp/usd/eur | correct amounts, wrong mode for plans |
| `supabase/functions/create-subscription-checkout/index.ts` | **orphaned**, holds 1900/1500, 4900/3900, 9900/7900 | stale — the reported discrepancy |
| `supabase/functions/create-subscription-invoice/index.ts` | plan name inferred from amount: `<=1500 Starter`, `<=4900 Professional`, `>=7900 Enterprise` | stale thresholds — would mislabel £190/£350/£850 |
| `supabase/functions/check-subscription/index.ts` | tier from amount: `<=999 Basic`, `<=1999 Premium`, else Enterprise; any yearly → tier "Yearly" | stale thresholds, unrelated to charge amount |
| `supabase/functions/stripe-webhook/index.ts` | notifications only, echoes `amount_total` | no price logic, no change |
| `src/components/checkout/CoinbaseCheckout.tsx` / `create-coinbase-charge` | crypto path, receives the same amount | inherits whatever amount is passed |
| `public.platform_plans` + `src/pages/admin/AdminPlans.tsx` | admin display of monthly/annual price | **table is empty in production (0 rows)** — not a price source |

---

## E. STRIPE PRICE IDS INVOLVED

**None.** Every Stripe session in this codebase is built with inline `price_data`
(ad-hoc prices created per session). There is not a single `price_...` or `prod_...`
identifier anywhere in `src/` or `supabase/functions/`, and no Price ID is stored in the
database or in environment configuration.

| Combination | Price ID selected today |
|---|---|
| Starter monthly | none — inline `price_data`, 1900 pence (dead path) / one-off 1900 (live path) |
| Starter annual | none — inline `price_data`, 1500 pence (dead path) / one-off 19000 (live path) |
| Professional monthly | none — inline, 4900 (dead) / 3500 (live) |
| Professional annual | none — inline, 3900 (dead) / 35000 (live) |
| Enterprise monthly | none — inline, 9900 (dead) / 8500 (live) |
| Enterprise annual | none — inline, 7900 (dead) / 85000 (live) |

No API keys or secret values are reproduced in this report.

---

## F. MINIMUM REMEDIATION PLAN

Two tiers. Tier 1 alone removes the discrepancy you reported; Tier 2 is required if plans
are meant to renew.

**Tier 1 — correct the stale figures (no Stripe work, no live behaviour change)**
1. `create-subscription-checkout/index.ts`: set `starter {monthly:1900, annual:19000}`,
   `professional {monthly:3500, annual:35000}`, `enterprise {monthly:8500, annual:85000}`.
   *Or* delete the function outright, since it has no caller — the cleaner option.
2. `create-subscription-invoice/index.ts`: replace amount-guessing thresholds with the
   six intended amounts (1900/19000/3500/35000/8500/85000) mapped to plan names, so
   invoices no longer label a £350 payment as "Enterprise".
3. `check-subscription/index.ts`: replace the 999/1999 thresholds with the same map and
   stop overwriting tier with the literal "Yearly"; derive tier from plan, interval
   separately. (Behaviour-affecting — needs your approval; entitlements read this.)

**Tier 2 — make plan purchases actually recurring (only if intended)**
4. Create six Stripe Price objects (GBP): 1900/month, 19000/year, 3500/month, 35000/year,
   8500/month, 85000/year, under three Products.
5. Store the six Price IDs as edge-function secrets (no IDs in client code).
6. Point `PricingPlans` at a subscription checkout call that passes `planId` + `isAnnual`
   and have the edge function select the Price ID server-side (never trust a client amount).
7. Keep `create-payment` for genuine one-off purchases (templates etc.) unchanged.

Minimum to satisfy your stated goal *"actual checkout charges become exactly £19/£190,
£35/£350, £85/£850"*: **Tier 1 item 1 + 2**. The live path already charges those exact
amounts; only the recurrence is missing, which is Tier 2.

---

## G. EXISTING SUBSCRIBER IMPACT

- Stripe Price objects are immutable and **never retroactively applied**. Creating six new
  Prices changes nothing for anyone who already paid; no migration happens unless someone
  explicitly calls `subscriptions.update` with the new price, which is not part of this plan.
- Because the live path only ever created **one-time payments**, there may be **no active
  Stripe subscriptions at all** for plan purchases. This must be confirmed in the Stripe
  Dashboard (Billing → Subscriptions, filter active) before any remediation. I did not
  query Stripe.
- Historical invoices in `invoices` and Stripe's own records are untouched by any step above.
- Anyone holding a legacy subscription at 1900/1500/4900/3900/9900/7900 keeps that price
  until you deliberately migrate them, with notice. Recommended: grandfather, do not migrate.
- Editing `check-subscription` thresholds (Tier 1 item 3) **can change the tier label shown
  to existing customers**, which is why it is flagged for explicit approval rather than
  bundled as a silent fix.

---

## H. VERIFICATION THAT REMEDIATION CHANGES NOTHING ELSE

| Area | Touched? | Why not |
|---|---|---|
| Plan entitlements / feature lists | No | Defined in `PricingPlans.tsx` feature arrays and AI-credit logic; untouched |
| Subscription limits (AI credits, members) | No | Sourced from plan keys, not amounts — except `check-subscription` tier labels (Tier 1 item 3, gated) |
| Tenant architecture / organizations | No | No organization or membership code in the pricing flow |
| RLS policies | No | No migration, no policy, no grant in this plan |
| Existing subscriptions | No | Stripe Prices are immutable and never back-applied |
| Historical invoices | No | Only future invoice *labelling* improves |
| Other discounts | No | No discount mechanism exists post promotion removal; none added |
| Unrelated billing (one-off template purchases, Coinbase) | No | `create-payment` amount logic and crypto path unchanged |

---

## I. TEST PLAN (after approval, in test mode first)

1. Stripe **test mode** only; confirm no live key in the test run.
2. For each of six combinations, start checkout and read the Stripe-hosted page:
   assert amount and interval = 1900/mo, 19000/yr, 3500/mo, 35000/yr, 8500/mo, 85000/yr.
3. Complete one monthly and one annual test purchase; confirm a Stripe **subscription**
   exists with the right Price and renewal date (Tier 2 only).
4. `check-subscription` returns the correct tier for each purchase.
5. `create-subscription-invoice` produces an invoice whose plan name matches the plan bought.
6. Confirm the pricing page still displays £19/£190, £35/£350, £85/£850 — unchanged.
7. Regression: one-off template purchase via `create-payment` still works.
8. Confirm no existing test subscriber's price changed.
9. Cancel/clean up all synthetic test customers and subscriptions.

## J. ROLLBACK PLAN

- Code: revert the edge-function changes and redeploy the previous version; the live
  pricing path is unaffected by Tier 1, so rollback risk is effectively zero.
- Tier 2: revert the frontend to the current `create-payment` call; newly created Stripe
  Prices can be **archived** (never deleted) with no effect on past charges.
- Any subscription created during testing: cancel in Stripe, refund if in live mode.
- No database rollback required — no migration is proposed.

---

## SAFE TO REMEDIATE? **YES** — for Tier 1 (stale figures + invoice labelling), which is
dead-code correction with no live behaviour change.

**Tier 2 requires your decision**, because it changes plan purchases from one-off charges
to real recurring subscriptions and needs six Stripe Price objects created in your account.

Awaiting your instruction. Nothing has been changed.
