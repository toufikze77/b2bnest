# Stripe webhook — production release package (NOT deployed)

## Sandbox verification (owner-reported, separate backend, test mode only)
- Test checkout: PASS. Starter → Professional switch: PASS.
- Sandbox limitations (not production defects unless verified there): broken return page, unrelated build errors.

## Production checks (read-only, 2026-10-04)
1. Sandbox events: production `stripe-webhook` logs show recent deliveries failing signature verification
   (400, returned before any claim/write). `stripe_webhook_events`: last row 2026-09-29, 0 rows in last 3 days.
   `subscribers` updated in last 2 days: 0. New `payments` in last 3 days: 0. **No production records changed.**
   Action: remove the production URL from any Stripe test-mode webhook endpoint.
2. Test-mode guard: was missing (only the signing secret protected it). Added `expectedLivemode`
   derived from key prefix (`sk_live_`/`rk_live_` → live). Mismatch → 400 before claim, no write.
3. Customer edit of subscriptions: **not reproducible**. RLS on; only policy is SELECT own row;
   `authenticated` has no INSERT/UPDATE privilege; `anon` none. No fix needed.
4. Credential in old news migrations (`20251001194036_*`, `20251001194055_*`, pg_cron news fetch):
   JWT with role **anon** (public publishable key, same as the app ships). Not privileged — no rotation needed.

## Tests actually run
`deno test supabase/functions/stripe-webhook/handler_test.ts` — 10/10 passed, incl.
- #8 byte-identical payload: write fails once (500, not completed), same body redelivered → 200, completed, one subscriber row.
- #9 test-mode event to live endpoint → 400, zero claims/writes.

## Transfer to production (exact)
- `supabase/functions/stripe-webhook/handler.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/_shared/plans.ts` (unchanged; dependency)
- Migration: `supabase/remediation/stripe-webhook-retry-2026-10-04.sql`
- Exclude: `handler_test.ts` (test-only), sandbox keys, sandbox project ref, any sandbox `.env`/config.
- Production secrets stay as-is (`STRIPE_SECRET_KEY` live, `STRIPE_WEBHOOK_SECRET` live). No new secrets.

## Order
1. Apply migration (additive; existing events become `completed`).
2. Deploy `stripe-webhook`.
3. Confirm next live event logs `Entitlements synced` and row `status=completed`.

## Rollback
1. Redeploy previous `stripe-webhook` code (commit before this change).
2. Run `supabase/remediation/stripe-webhook-retry-2026-10-04-rollback.sql`.

## Known limitation
Retried payment-status updates can add a duplicate `payment_audit_logs` entry (no duplicate payments).

## Production release result (2026-10-04, target gvftvswyrevummbvyhxa)
- Previous webhook saved for rollback: `supabase/rollback/stripe-webhook-pre-2026-10-04/index.ts` (last committed pre-fix version).
- Migration applied. 6 new functions: service_role only (anon/authenticated denied). Existing 23 events kept, all `completed`.
- `stripe-webhook` deployed. Unsigned probe → 400 "No Stripe signature"; forged signature → 400 "Invalid signature"
  (confirms live secrets loaded). No event rows written by probes. No payment created, no subscription changed.
- Next genuine live event: PENDING VERIFICATION (expect log "Entitlements synced" and row status=completed).
- Rollback: redeploy the saved index.ts (it imports ../_shared/plans.ts), then run the rollback SQL.
