# Downgrade policy — production release (2026-10-05)

Target: gvftvswyrevummbvyhxa. Source: sandbox package `docs/downgrade-policy-transfer` (project B2BNEST Stripe Sandbox, commit 1fa3e93a); SHA-256 of transferred files matched the README.

## Transferred
- change-subscription-plan/handler.ts + handler_test.ts (tested versions, byte-identical). index.ts kept as production (no sandbox test-key guard).
- _shared/portal-config.ts (new, identical).
- customer-portal/index.ts: production version + `configuration` from `resolvePortalConfiguration`. Sandbox test-key guard NOT transferred.
- stripe-webhook unchanged (production version keeps the live/test event guard and retry fix).
- Frontend: BillingSettings pending-change panel (plan, start date, next price, Keep current plan); PricingPlans confirm text for scheduled downgrades; Help + Pricing Q&A.

No database migration.

## Checks
- Deno handler tests 15/15; vitest pending-panel test 1/1; typecheck + build OK.
- Live functions deployed; unauthenticated calls → 401.
- Sandbox Stripe test-clock results reused (see transfer README); not repeated.

## Live portal configuration
Previous: Stripe account default portal configuration (no `configuration` passed; not modified). New: created once, by metadata `b2bnest_policy=b2bnest_policy_v1`, on the first Manage billing click. Existing configurations and subscriptions are never modified.

## Rollback
1. Redeploy `supabase/rollback/downgrade-policy-pre-2026-10-05/` (change-subscription-plan handler, customer-portal index). Portal returns to the default configuration automatically.
2. Any already-scheduled downgrades stay as Stripe subscription schedules; release them in Stripe if a rollback must cancel them.

## Pending verification
- Live portal configuration creation on first real Manage billing click.
- First genuine live scheduled downgrade reaching its renewal.
- Next genuine live webhook event completing (from 2026-10-04 release).
