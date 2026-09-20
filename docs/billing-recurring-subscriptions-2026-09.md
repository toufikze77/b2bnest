# B2BNEST — Recurring Stripe Subscriptions Remediation (2026-09)

Controlled billing change. Implemented in staging/preview and deployed to the Supabase
project's edge functions and schema. **Not published to the live site.** No Stripe object was
created by me (no Stripe credentials are reachable from this environment), no pricing value was
changed, no existing customer was migrated, no historical payment or invoice was modified.

Reference: `docs/pricing-remediation-preflight-2026-09.md`.

---

## A. ARCHITECTURE BEFORE

```text
Pricing page (PricingPlans.tsx, amounts 19/190, 35/350, 85/850)
  → PaymentMethodSelector (Stripe | Coinbase)
  → StripeCheckout → create-payment
  → stripe.checkout.sessions.create({ mode: "payment", inline price_data })
  → ONE-OFF CHARGE. No Stripe subscription object, no renewal.
  → stripe-webhook: checkout.session.completed → payments row only
  → check-subscription: guesses tier from amount (<=999 Basic, <=1999 Premium, else Enterprise;
    any yearly → tier "Yearly")
  → subscribers: no subscription id / price / interval / status / period fields
create-subscription-checkout: orphaned, stale 1900/1500, 4900/3900, 9900/7900
create-subscription-invoice: plan label guessed from amount ranges (£350 → "Enterprise")
```

## B. ARCHITECTURE AFTER

```text
Pricing page → create-subscription-checkout (authenticated, planId + isAnnual only —
  the client never sends an amount)
  → _shared/plans.ts resolves a STABLE Stripe Price by lookup key
    (created once, idempotently, and amount-verified on every use)
  → duplicate-subscription guard (blocks a second live subscription per customer)
  → stripe.checkout.sessions.create({ mode: "subscription", price: price_… })
  → Stripe Checkout → recurring charge
  → stripe-webhook (signature verified, event-id idempotency)
       checkout.session.completed · customer.subscription.created/updated/deleted ·
       invoice.paid · invoice.payment_failed → syncs subscribers entitlements
  → subscribers holds subscription id, price id, plan, interval, status, period start/end,
    cancel_at_period_end, canceled_at
  → check-subscription reconciles from Stripe using the same catalogue (no amount guessing)
  → Settings → Billing → customer-portal → Stripe Customer Portal
create-payment: unchanged, retained for genuine one-off purchases (templates, services).
```

## C. FILES / FUNCTIONS CHANGED

| File | Change |
|---|---|
| `supabase/functions/_shared/plans.ts` | **new** — single server-side plan catalogue (£19/£190, £35/£350, £85/£850), lookup keys, idempotent Stripe Product/Price resolution with amount verification |
| `supabase/functions/create-subscription-checkout/index.ts` | **rewritten** — stale 1500/3900/4900/7900/9900 removed; authenticated; plan-key input only; `mode: subscription`; stable price ids; membership check when an organization id is supplied; duplicate-subscription guard |
| `supabase/functions/stripe-webhook/index.ts` | subscription lifecycle handling, event-id idempotency table, entitlement sync; one-off payment path preserved |
| `supabase/functions/check-subscription/index.ts` | tier derived from the price catalogue instead of amount thresholds; no more literal "Yearly" tier |
| `supabase/functions/create-subscription-invoice/index.ts` | plan label from the price lookup key / exact amount — fixes the £350-labelled-"Enterprise" defect |
| `supabase/functions/customer-portal/index.ts` | **new** — authenticated Stripe Customer Portal session |
| `supabase/config.toml` | explicit `verify_jwt`: webhook false (signature-verified), all billing functions true |
| `src/components/PricingPlans.tsx` | Subscribe button starts Stripe subscription checkout; payment-method modal removed for plans; copy corrected; **displayed prices untouched** |
| `src/components/billing/BillingSettings.tsx` | **new** — plan status + Manage billing |
| `src/pages/Settings.tsx` | Billing tab added |

Unchanged: `create-payment`, Coinbase path, plan entitlement lists, AI-credit logic, tenant
architecture, RLS, HMRC, Wave 1 behaviour.

## D. DATABASE CHANGES

Migration applied (additive only; no data rewritten, no policy weakened):

- `public.subscribers` + `stripe_subscription_id`, `stripe_price_id`, `plan_key`,
  `billing_interval`, `subscription_status`, `current_period_start`, `current_period_end`,
  `cancel_at_period_end`, `canceled_at`, `payment_status`; partial unique index on
  `stripe_subscription_id`.
- `public.stripe_webhook_events` (event_id unique) — webhook idempotency. RLS enabled,
  service-role only, no anon or authenticated grant.

Linter after migration: 84 warnings, all pre-existing platform-wide items (SECURITY DEFINER
function exposure, leaked-password protection, Postgres patch level). None introduced here.

## E. STRIPE PRODUCTS USED

Three products, one per plan, tagged `metadata.b2bnest_plan = starter|professional|enterprise`.
They are found or created once by `resolveStripePrice`; nothing is created per checkout session.

## F. SIX STRIPE PRICE IDS

**Not yet created — this requires your Stripe account.** The six prices are addressed by stable
lookup keys and will be created once, on the first checkout of each combination:

| Plan | Interval | Amount | Lookup key |
|---|---|---|---|
| Starter | month | £19.00 | `b2bnest_starter_monthly_gbp` |
| Starter | year | £190.00 | `b2bnest_starter_annual_gbp` |
| Professional | month | £35.00 | `b2bnest_professional_monthly_gbp` |
| Professional | year | £350.00 | `b2bnest_professional_annual_gbp` |
| Enterprise | month | £85.00 | `b2bnest_enterprise_monthly_gbp` |
| Enterprise | year | £850.00 | `b2bnest_enterprise_annual_gbp` |

If a lookup key already exists but its amount or interval differs from the catalogue, checkout
**fails closed** rather than charging a wrong amount. No secret key appears anywhere in this repo.

## G. WEBHOOK EVENTS HANDLED

`checkout.session.completed` (subscription and one-off branches), `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`,
`invoice.payment_failed`, `payment_intent.payment_failed`.
Signature verified on every call; each event id is recorded once, replays are acknowledged and
skipped; a processing failure removes the marker and returns 500 so Stripe retries.
Frontend redirects are never treated as proof of payment.

## H. EXISTING-CUSTOMER IMPACT (no PII)

| Metric | Count |
|---|---|
| Subscriber records | 4 |
| Records marked subscribed | 0 |
| Records with a Stripe customer id | 1 |
| Payment records | 8 |
| Payment records marked completed | 0 |
| Invoices | 3 |
| Distinct subscription tiers present | 1 |

No customer is migrated, no record was edited by this change. Live Stripe customers and any
legacy subscriptions can only be confirmed in your Stripe Dashboard. If migration is ever wanted,
it will be a separate written proposal.

**Entitlement policy implemented:** `active`/`trialing` → paid entitlements;
`cancel_at_period_end` → access retained until `current_period_end`; `past_due`/`unpaid` → access
retained during Stripe's retry window with the status recorded; `canceled`/expired → tier returns
to free. No organization, company or customer data is ever deleted because a subscription ends.

## I. TEST RESULTS

| Test | Result |
|---|---|
| App build | PASS (`build OK`) |
| TypeScript | PASS |
| Lint on changed files | PASS (3 pre-existing `any`/empty-block findings in untouched code) |
| Edge function deployment (5 functions) | PASS |
| `create-subscription-checkout` rejects unauthenticated calls | PASS (401) |
| `stripe-webhook` rejects unsigned calls | PASS (400 "No Stripe signature") |
| Webhook billing secrets present in the Supabase project | PASS (would return 500 if missing) |
| Stale amounts 1500/3900/4900/7900/9900 remaining in billing code | PASS — none |
| Six live checkout combinations, renewal, failed payment, cancellation, portal, invoice, replay | **BLOCKED** — see below |

## J. SECURITY / TENANT REGRESSION

`scripts/staging/run-wave1-suite.sh` → **642 PASS / 0 FAIL / 54 INFO**. Zero tenant-isolation
regressions. The new table is service-role only; no RLS policy was altered or relaxed.

## K. ROLLBACK PLAN

1. Application: revert the published version from History (nothing is published yet).
2. Edge functions: redeploy the previous revisions of the five functions.
3. Database: the migration is purely additive; no rollback needed. If desired, the added
   columns and `stripe_webhook_events` can be dropped without touching existing data.
4. Stripe: any price created during testing is **archived**, never deleted; test subscriptions
   are cancelled in the Stripe Dashboard. Past charges are unaffected.

## L. PRODUCTION READINESS: **NOT READY — pending your Stripe validation**

The code is complete and every check available in this environment passes, but the Stripe account
is outside this environment (external Supabase, secrets held in your dashboard), so the six live
checkout combinations cannot be exercised here. Evidence has not been fabricated.

### Manual Stripe actions required from you

1. **Stripe Dashboard → Developers → Webhooks**: confirm the endpoint pointing at
   `.../functions/v1/stripe-webhook` is enabled for: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`,
   `payment_intent.payment_failed`. Its signing secret must be the `STRIPE_WEBHOOK_SECRET`
   already stored in Supabase.
2. **Stripe Dashboard → Settings → Billing → Customer portal**: activate the portal and enable
   payment-method updates, invoice history and cancellation.
3. **Test mode first**: run all six combinations from the pricing page and confirm the Stripe page
   shows £19/month, £190/year, £35/month, £350/year, £85/month, £850/year — each as *recurring*.
4. Confirm after one purchase: a Stripe **subscription** exists with a renewal date; Settings →
   Billing shows the plan; the invoice generated names the correct plan.
5. Attempt a second purchase on the same account — it must be refused with "already subscribed".
6. Cancel at period end in the portal and confirm access is retained until the period end.
7. **Stripe Dashboard → Billing → Subscriptions (live)**: confirm whether any legacy live
   subscriptions exist. Report back and I will produce a migration proposal only if you want one.
8. Confirm whether crypto payment should remain unavailable for plan subscriptions (Coinbase
   cannot produce a recurring Stripe subscription; it is still available for one-off purchases).

Nothing is published to the live site until you confirm these steps.
