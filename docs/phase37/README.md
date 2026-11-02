# Phase 37: AI credit top-up packs

Subscribers on their own paid plan can buy one-off packs of AI credits in **Settings → Billing**. Nothing here has been
applied, deployed or created in Stripe.

## Owner decisions (2 November 2026)
- **Packs:** 100 credits for £5, 300 for £12, 1,000 for £35. These are one-off payments.
- **Rules:**
  - Monthly credits still don't roll over.
  - Purchased credits last 12 months and are used after the monthly allowance.
- **Who can buy:**
  - Only subscribers with their own paid plan (`_access_state_for` = `subscribed` with `via = 'self'`).
  - Owner and master accounts can also buy, for testing.
  - Trial, trial-ended, suspended accounts and company members can't buy.
  - Trial accounts keep their 50 credits.
- **One catalogue:** `public.ai_topup_packs` is the only source of what is sold and charged.
  - `supabase/functions/_shared/topup-packs.ts` and `src/lib/aiTopups.ts` are copies.
  - `src/lib/aiTopups.test.ts` fails if any of the three differ.
- **VAT:** prices are shown "as shown". The accountant needs to confirm whether VAT applies and how it is shown. Stripe tax isn't switched on.

## Rollout (in this order)
1. **Apply `docs/phase37/proposal.sql`** (one transaction). It refuses if any of the functions it replaces differ from the Phase 35 bodies:
   - `check_and_deduct_ai_credit` 659fcd…
   - `get_ai_credits_info` f6869e…
   - `refund_ai_credit` 538c31…
   - `ai_credit_ledger_append_only` a54399…

   Applying it on its own changes nothing users can see. Two extra answer fields are added, and with no lots they equal today's numbers.
2. **Deploy the Edge Functions** (flattened with `node scripts/flatten-function.mjs <fn> <outdir>`):

   | Function | Files | Notes |
   |---|---|---|
   | `create-ai-topup-checkout` (new, `verify_jwt = true`) | `index.ts`, `handler.ts`, `shared_topup-packs.ts`, `shared_verified-customer.ts` | Nobody can buy until step 4 (`AI_TOPUPS_ENABLED` is unset). |
   | `stripe-webhook` (updated) | `index.ts`, `handler.ts`, `shared_plans.ts` | Every event it handled before behaves the same. |
   | `ai-assistant` (text only) | `index.ts`, `handler.ts`, `knowledge.ts`, `gld_catalogue.ts`, `shared_access.ts`, `shared_ai-ledger.ts`, `shared_ai-limits.ts`, `shared_plans.ts`, `shared_topup-packs.ts`, `shared_workflow-access.ts` | Only `knowledge.ts` changed: what the assistant says about top-ups. The handler is unchanged. Optional: without it the assistant just doesn't know about top-ups. |
3. **Stripe:** add these events to the existing webhook endpoint. No new product or price is needed: the session builds the price from the catalogue.
   - `checkout.session.async_payment_succeeded`
   - `charge.refunded`
   - `charge.dispute.created`

   `checkout.session.completed` is already subscribed.
4. **Publish the frontend.**
5. **The real Solo test:** the owner sets the secret `AI_TOPUPS_ENABLED=true` only after a live purchase on their own account has worked end to end (below). Until then, Buy shows "Top-ups aren't available yet."

Rollback: `docs/phase37/rollback.sql`. It **refuses while any lot exists**, because customers have paid. To force it, first export `public.ai_credit_lots`, decide how to make those customers whole, then run it with `app.phase37_force = on`. Roll back the Edge Functions first, so no new purchase lands.

## Design
- **Tables:**

  | Table | Holds |
  |---|---|
  | `ai_topup_packs` | The catalogue. |
  | `ai_credit_lots` | One row per purchase: purchased, remaining, voided, expiry, Stripe session and payment intent. RLS: a user can SELECT their own rows; nobody writes except the functions. |
  | `ai_topup_checkouts` | Checkouts started. Used for the cap and the one-a-minute limit. |

  The ledger gains `topup_credits` and `topup_lots`.
- **Ledger split:** the existing reserve row carries the split. `topup_credits` = how many came from lots; `topup_lots` = `[{lot, credits}]`.
  - One row per request is kept, so the Phase 35 and 36 counts (requests = reserve rows) stay right.
  - The refund knows exactly which lots to give back to.
- **Spending:**
  - Monthly credits first, then lots by soonest expiry (`FOR UPDATE`, under the per-user advisory lock).
  - All or nothing: a refused request takes nothing and writes nothing.
  - `credits_remaining` is now monthly + unexpired top-up credits. Results add `monthly_remaining` and `topup_credits`; `get_ai_credits_info` also adds `topup_next_expiry`.
- **Refunds:**
  - Idempotent per (user, request) as before.
  - The top-up part goes back first, to the same lots, never above what was taken; then the monthly part (never above the monthly limit).
  - If a lot has expired or been voided since, its part is lost. The refund row shows `{"lost": n}`.
- **Monthly reset:** unchanged, and it never touches lots. Expiry is a date check everywhere; there is no cron.
- **Cap:** 5,000 unexpired top-up credits per user.
  - `begin_ai_topup_checkout` counts open checkouts from the last 35 minutes. Stripe sessions expire after 31 minutes.
  - So a paid session can't normally be refused at grant time. `grant_ai_topup` checks again.
- **Checkout (`create-ai-topup-checkout`):**
  - The flag must be set.
  - The client sends only `packId`.
  - `begin_ai_topup_checkout` decides who may buy and applies the cap and the one-a-minute limit.
  - The database price must equal the code price, or nothing is sold.
  - It uses the caller's own verified Stripe customer (Phase 14 rules) and creates a session:
    - `mode: payment`;
    - `price_data` built from the catalogue (product "AI credits: 300");
    - `allow_promotion_codes: false`;
    - `expires_at` = now + 31 minutes;
    - metadata `{type: "ai_topup", user_id, pack_id, checkout_id}` on the session and on the payment intent;
    - `client_reference_id`;
    - success and cancel URLs back to Settings → Billing (our own sites only).
  - Any failure closes the checkout.
- **Credits are granted only in `stripe-webhook`:**
  - `checkout.session.completed` with `mode=payment`, `metadata.type=ai_topup` and `payment_status=paid`;
  - or `checkout.session.async_payment_succeeded`.

  `grant_ai_topup` is service role only and checks:
  - it is idempotent on the session id;
  - the user matches;
  - the pack exists;
  - the amount equals the pack price;
  - the account exists;
  - the cap.

  A refusal a retry can't fix is logged as `ALERT top-up paid but not granted: refund by hand`, and the event completes. A database error returns 500, so Stripe retries.
- **Voids:** `charge.refunded` and `charge.dispute.created` call `void_ai_topup` by payment intent.
  - Unused credits are removed; credits already spent stay spent.
  - A payment that isn't a top-up gets `not_found`, and nothing is written.
- **Admin → AI usage → Business development:**
  - top-up revenue and amount refunded;
  - packs sold;
  - credits sold, used, unused, expired and removed;
  - a warning for paid top-ups that need a manual refund.

  Before this SQL is applied, these sections say "Not available until the Phase 37 database update".

## Failure cases
| Case | What happens |
|---|---|
| Payment delayed (for example a bank debit) | `completed` arrives with `payment_status=unpaid`: nothing is granted. `async_payment_succeeded` grants it later. If the payment fails, nothing is granted. |
| Webhook never arrives | Nothing is granted. The Billing page says "Payment received…", checks 5 times, 3 seconds apart, then says it's still waiting ("you won't be charged twice"). Stripe retries for up to 3 days. If it never lands, find the session in Stripe and refund it, or resend the event from the Stripe dashboard. |
| Double delivery | The same event id is skipped (claim store). A second event for the same session returns the same lot with `granted: 0`. |
| Refund (full or **partial**) | All **unused** credits of that purchase are removed. Credits already spent are not clawed back. A partial refund voids everything left: refund partially only if that's what you want. |
| Dispute opened | Same as a refund, at once (the dispute isn't waited on). |
| Refund arrives before the grant (very unlikely) | `void` finds nothing, then the grant adds the credits. Check `ai_credit_lots` against Stripe refunds. Flagged in the PR. |
| Over the cap at grant time | Shouldn't happen (open checkouts count). If it does, the checkout becomes `needs_refund`, an ALERT is logged, and Admin shows a warning. Refund in Stripe. |
| Account deleted between payment and grant | `unknown_user` and an ALERT: refund in Stripe. |
| Subscription ends | Lots remain until they expire, but AI use is blocked by the access check, as for any non-subscriber. |

## How to test in Stripe test mode
1. Use a staging or test project with a test key (`sk_test_…`) and that project's test webhook secret. The live-mode guard refuses mismatched events.
2. Apply the SQL there, deploy both functions, add the three events, and set `AI_TOPUPS_ENABLED=true`.
3. As a test subscriber, buy 300 credits with card `4242 4242 4242 4242`. Expect:
   - "Payment received…", then "Your top-up credits are ready.";
   - Billing shows "+ 300 top-up credits (expire from …)".
4. Delayed payment: pay with a test bank debit method. There is no credit until `async_payment_succeeded`.
5. Use AI until the monthly allowance is gone. The top-up balance then goes down; a refund of a failed AI call goes back to the right bucket.
6. Refund the payment in the dashboard: the remaining credits are removed. Use `stripe trigger charge.dispute.created` (or a dispute test card) for a dispute.
7. Resend `checkout.session.completed` from the dashboard: there is no second lot.
8. As a trial user: "Choose a plan first. Top-ups are for subscribers." There is no Buy button, and the function refuses with 403.

## Tests
- `PG_RUN_USER=postgres bash docs/phase37/run-test.sh`:
  - a disposable Postgres 16 with the Phase 35 and 36 fixtures and proposals (production bodies, hash-checked first);
  - **107 checks**: privileges, guard log, catalogue, who may buy, attach, grant, spending order, all or nothing, refunds (to the right bucket, idempotent, expired lot lost), reset, trial 50, void, cap (balance and open checkouts), RLS, append-only ledger, admin summary, rollback refused without force, forced rollback (exact bodies, privileges, guard rows), re-apply, second apply refused, drift refused.
- **Deno:**
  - `create-ai-topup-checkout/handler_test.ts` (12);
  - `stripe-webhook/topup_test.ts` (11);
  - `ai-assistant/knowledge_test.ts` (+1);
  - all 392 pass.
- **vitest:** Billing card states, display, generator, admin and catalogue (all 1,273 pass).

## Security advisor expectations
- `authenticated_security_definer_function_executable` (WARN): **+1** (`admin_ai_topup_summary`), like every admin RPC.
  - The four top-up functions are service role only.
  - `_ai_topup_balance` isn't SECURITY DEFINER and is service role only.
- No new `rls_disabled`: RLS is on for all three tables.
  - `ai_topup_packs` and `ai_topup_checkouts` have no permissive policy (service role only), so `rls_enabled_no_policy` (INFO) may appear for those two. This is intended.
- No anon grants, and `search_path` is pinned on every new function.
