# B2BNEST — Final Recurring Billing Validation (2026-09-21)

Read-only validation. Nothing published, no database change deployed, no production customer
record modified, no Stripe object created or changed. No secret is reproduced in this document.

Reference: `docs/billing-recurring-subscriptions-2026-09.md`.

---

## 0. Validation environment — what could and could not be exercised

| Capability | Available here | Evidence |
|---|---|---|
| Repository / code inspection | Yes | scans below |
| Deployed edge-function HTTP behaviour (unauthenticated) | Yes | live curl results below |
| Production database, read-only | Yes | queries below |
| Full tenant/security suite on a disposable PostgreSQL cluster | Yes | 642 PASS / 0 FAIL / 54 INFO |
| Authenticated session against the app (Supabase is **external / unmanaged**) | **No** | no session can be minted |
| Stripe API (secret key lives only in the external Supabase project) | **No** | `STRIPE_SECRET_KEY` not reachable |

Consequence: every check that requires a signed-in user or a Stripe call is reported **BLOCKED**,
not PASS. No evidence has been inferred or fabricated.

---

## 1. SIX-PLAN RESULTS

Authoritative amounts come from one server-side file only, `supabase/functions/_shared/plans.ts`
(pence, GBP):

| Plan | Interval | Catalogue amount | Lookup key | Recurring in code | Live Stripe subscription created |
|---|---|---|---|---|---|
| Starter | month | 1900 = £19.00 | `b2bnest_starter_monthly_gbp` | yes (`recurring.interval = month`) | **BLOCKED** |
| Starter | year | 19000 = £190.00 | `b2bnest_starter_annual_gbp` | yes (`year`) | **BLOCKED** |
| Professional | month | 3500 = £35.00 | `b2bnest_professional_monthly_gbp` | yes (`month`) | **BLOCKED** |
| Professional | year | 35000 = £350.00 | `b2bnest_professional_annual_gbp` | yes (`year`) | **BLOCKED** |
| Enterprise | month | 8500 = £85.00 | `b2bnest_enterprise_monthly_gbp` | yes (`month`) | **BLOCKED** |
| Enterprise | year | 85000 = £850.00 | `b2bnest_enterprise_annual_gbp` | yes (`year`) | **BLOCKED** |

Amount verification: PASS (code). Interval verification: PASS (code). Subscription creation,
Stripe customer, Stripe subscription id, stored status, stored period, entitlement activation:
**BLOCKED** — these can only be proven by a real checkout, which requires your Stripe account and
a signed-in production user.

Objective supporting evidence that **no** live or test checkout has yet reached the new code:

```
select count(*) from stripe_webhook_events;            -- 0
select count(*) from subscribers
  where stripe_subscription_id is not null;            -- 0
```

Per your instruction, checkout-session creation alone is not treated as PASS — and in fact not
even a session creation can be observed from here.

Client-side entitlement: PASS. `PricingPlans.tsx` sends only `{ planId, isAnnual }`; it never
sends an amount and never writes `subscribers`. Entitlement columns are written exclusively by
`stripe-webhook` and `check-subscription`, both service-role server functions.

## 2. WEBHOOK RESULTS

Live behaviour of the deployed endpoint (`POST .../functions/v1/stripe-webhook`, no signature):

```
HTTP 400  "No Stripe signature"
```

| Requirement | Result | Basis |
|---|---|---|
| Signature verification | PASS | unsigned request rejected 400 before any processing |
| Duplicate event / idempotency | PASS (code) · BLOCKED (live replay) | `stripe_webhook_events.event_id` unique; duplicate insert (23505) acknowledged and skipped; failure path deletes the marker so Stripe can retry |
| Out-of-order safety | PASS (code) | every lifecycle event re-reads the subscription object and upserts full state rather than applying deltas |
| Unknown price ids fail closed | PASS (code) | `planFromLookupKey` → `planFromAmount`; unresolved price leaves `plan_key` null and does not raise `ai_credits_limit`; `resolveStripePrice` throws if an existing price's amount/interval differs from the catalogue |
| Failed/unverified events cannot grant entitlement | PASS | no entitlement write occurs before signature verification succeeds |
| Webhook secret server-only | PASS | held in the Supabase project's function secrets; `verify_jwt = false` for this function only, authenticity by signature |
| No secrets in logs or browser bundle | PASS | repository scan for `sk_live` / `sk_test` / `whsec_` / `STRIPE_SECRET` across `src`, `public`, `index.html` → 0 matches; log lines emit step names and ids only |

End-to-end delivery from your configured Stripe endpoint: **BLOCKED** (0 events recorded).

## 3. CUSTOMER PORTAL RESULTS

```
POST .../functions/v1/customer-portal  (no auth)  ->  401 UNAUTHORIZED_NO_AUTH_HEADER
```

| Requirement | Result |
|---|---|
| Unauthenticated access refused | PASS (live 401) |
| Portal session bound to the caller's own customer | PASS (code) — customer id resolved from the caller's `subscribers` row by `user_id`, else by the caller's own verified email; no customer id is ever accepted from the client |
| Cross-customer portal session impossible | PASS (code) — no request parameter can influence the customer chosen |
| Authenticated subscriber can open the portal from Settings → Billing | **BLOCKED** — needs a signed-in subscribed user |
| Configured portal actions (payment method, invoices, cancellation) | **BLOCKED** — Stripe-side configuration cannot be read from here |

## 4. SUBSCRIPTION LIFECYCLE RESULTS

| State | Implemented behaviour | Live test |
|---|---|---|
| ACTIVE | `active`/`trialing` → paid tier, plan credit limit applied | BLOCKED |
| CANCEL AT PERIOD END | `cancel_at_period_end` stored; access retained to `current_period_end` | BLOCKED |
| CANCELLED | `customer.subscription.deleted` → free tier; no org/company/customer data deleted | BLOCKED |
| PAYMENT FAILURE | `past_due`/`unpaid` retain access during Stripe's retry window, status recorded | BLOCKED |
| RENEWAL | `invoice.paid` re-syncs period dates | BLOCKED |
| PLAN CHANGE | supported only through the Stripe portal; `customer.subscription.updated` re-resolves plan and interval | BLOCKED |

Browser-supplied status can never override Stripe: `PaymentSuccess` performs no entitlement write,
and `check-subscription` re-reads Stripe server-side. PASS (code).

## 5. EXISTING PRODUCTION DATA (read only)

```
subscribers 4 | subscribed 0 | with stripe_customer_id 1 | with stripe_subscription_id 0
invoices 3 | payments 8 | stripe_webhook_events 0
```

No PII reproduced.

| Record | Tier | Status | Stripe customer | Stripe subscription | Classification |
|---|---|---|---|---|---|
| Subscriber 1 (2025-07-08) | none | none | yes | no | **REQUIRES REVIEW** — has a Stripe customer but no subscription; check your Stripe Dashboard for any live subscription under that customer |
| Subscriber 2 (2025-07-14) | none | none | no | no | NO MIGRATION NEEDED |
| Subscriber 3 (2025-08-28) | free | none | no | no | NO MIGRATION NEEDED |
| Subscriber 4 (2025-10-02) | free | none | no | no | NO MIGRATION NEEDED |
| 3 invoices / 8 payments | — | none completed | — | — | **LEGACY RECORDS** — historical, left untouched |

Comparison with the Stripe **live** Subscriptions list could not be performed here (no Stripe
access). No subscription record has been invented for any of these rows, and nothing was migrated.

## 6. PRICE SOURCE SCAN

Exactly one authoritative server-side mapping exists: `supabase/functions/_shared/plans.ts`.
No other executable file contains 1900/19000, 3500/35000 or 8500/85000 as a billing amount
(`IntelligentAnalytics.tsx` and `HMRCTaxReturns.tsx` matches are unrelated demo figures).

Legacy price scan (£15 / £39 / £49 / £79 / £99 and their pence forms 1500/3900/4900/7900/9900):

| Location | Occurrences | Classification |
|---|---|---|
| `docs/wave1-closure-2026-09.md`, `docs/pricing-remediation-preflight-2026-09.md`, `docs/post-deployment-validation-2026-09.md`, `docs/billing-recurring-subscriptions-2026-09.md` | many | harmless historical documentation of the defect |
| `src/components/DomainAvailability.tsx` (`£49.99`) | 1 | unrelated domain-extension price list, not a plan |
| `src/components/StartupIdeaGenerator.tsx` (`£15,000`) | 1 | unrelated generated copy |
| various `1500` / `15000` timeouts, token limits, demo figures | several | unrelated numeric literals |
| **Billing code (`supabase/functions/**`, `PricingPlans.tsx`, `BillingSettings.tsx`)** | **0** | clean |

Obsolete one-off paid-plan checkout: `create-payment` / `StripeCheckout` / `PaymentMethodSelector`
/ `CheckoutModal` remain, but are now reachable **only** from `TemplateCard.tsx` (one-off template
purchases). No plan path calls them; `PricingPlans.tsx` calls `create-subscription-checkout` only.
Classification: retained on purpose for genuine one-off products, not a second plan-billing path.

## 7. SECURITY REGRESSION

`scripts/staging/run-wave1-suite.sh` on a disposable local PostgreSQL cluster:

```
TOTAL SECURITY CHECKS: 642 PASS / 0 FAIL / 54 INFO
```

Billing-relevant coverage confirmed within the run: `subscribers`, `payments`, invoices,
organization isolation, company-level filtering, role and Super Admin boundaries, no anon write
grants, no PUBLIC grants, Round 2 controls intact. `stripe_webhook_events` is service-role only
(no anon or authenticated grant). Zero tenant-isolation regressions.

Live endpoint authorization spot-checks:

```
stripe-webhook               -> 400 "No Stripe signature"
create-subscription-checkout -> 401 UNAUTHORIZED_NO_AUTH_HEADER
customer-portal              -> 401 UNAUTHORIZED_NO_AUTH_HEADER
check-subscription           -> 401 UNAUTHORIZED_NO_AUTH_HEADER
```

## 8. REMAINING BLOCKERS

1. No Stripe access from this environment — the six recurring checkouts, the created subscriptions,
   the stored periods and the entitlement activation cannot be observed here.
2. `stripe_webhook_events` is empty — your configured webhook has delivered nothing to the new
   handler yet, so end-to-end delivery is unproven.
3. Customer Portal round trip requires a signed-in subscribed user (external/unmanaged Supabase —
   no session can be minted here).
4. Live Stripe Subscriptions list not comparable from here; subscriber 1 (has a Stripe customer,
   no subscription) needs your dashboard check.
5. Carried forward, unrelated to billing and fail-closed: 3 projects with no company, 4 tasks whose
   company differs from their project.

### What you need to do in Stripe (test mode first)

1. Run all six combinations from the pricing page; confirm Stripe shows £19/month, £190/year,
   £35/month, £350/year, £85/month, £850/year, each marked **recurring**.
2. After one purchase confirm: a Stripe *subscription* with a renewal date; Settings → Billing shows
   the plan; the invoice names the correct plan.
3. Attempt a second purchase on the same account — must be refused ("already subscribed").
4. Cancel at period end in the portal — access must persist to the period end.
5. Replay one webhook event from the Stripe Dashboard — it must be acknowledged without double-
   applying.
6. Report whether any **live** subscriptions exist for the existing customer record.

## 9. DEPLOYMENT RECOMMENDATION

Code, security and data evidence are clean, but recurring billing has never been exercised against
a real Stripe subscription. Do not publish until the six test-mode checkouts and one webhook replay
are confirmed by you. Everything else is ready and no billing blocker originates in the code.

---

SIX RECURRING PLANS: BLOCKED

STRIPE WEBHOOK: BLOCKED

CUSTOMER PORTAL: BLOCKED

SUBSCRIPTION LIFECYCLE: BLOCKED

EXISTING CUSTOMER MIGRATION: REVIEW REQUIRED

SECURITY REGRESSION: PASS

PRODUCTION BILLING BLOCKERS: REMAIN

DEPLOYMENT RECOMMENDATION: DO NOT DEPLOY

PRODUCTION DEPLOYMENT AUTHORIZED: NO
