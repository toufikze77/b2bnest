# Phase 22: Admin shows real plan names and no free tier (prepared)

**Status: prepared, not applied.** Nothing in this folder has been run against production.

## What was wrong

I read the function bodies from production with `pg_get_functiondef` on 30 Oct 2026. They match the repo's migrations.

| Where | Before |
| --- | --- |
| Plan names | Admin printed the stored tier (Professional, Starter, Enterprise), or `free` when there was none. `check-subscription` writes the literal tier `"free"` for accounts with no subscription. |
| MRR | The sum of `platform_plans.monthly_price` over rows with `subscribed = true`, matched on the **tier name**. A legacy Business subscriber (£35) counted as £59 and a legacy Scale one (£85) as £89. Annual subscribers counted at the monthly price, so Business £590/year showed as £59 a month instead of £49.17. |
| ARR | MRR × 12. |
| Value (per row) | The same fixed monthly price, shown **even on cancelled rows**. |
| Status: active | `subscribed = true` |
| Status: trial | The old `profiles.is_trial_active` flag (not the Phase 12 access state). |
| Status: cancelled | **Any row whose `subscription_end` is in the past.** This includes a checkout that was started and never paid: Stripe `incomplete_expired`, for which the webhook stores the period end. |
| Status: free | Everything else. |
| `free_users` | Every profile without a `subscribed = true` row. |

## What changes (`proposal.sql`, one transaction)

- **`public.plan_prices`:** the catalogue's 10 prices (6 current, 4 legacy) by lookup key, with an empty `stripe_price_id` for you to fill in (`data-step.sql`).
  - RLS is on and browsers have no access.
  - `src/test/planCatalogue.test.ts` fails if these rows ever differ from `supabase/functions/_shared/plans.ts`.
- **`public._subscriber_monthly_value()`:** one subscriber's monthly value.
  - **0** unless the subscription is entitled, using `public._access_entitled`, the same rule as access.
  - Otherwise the price its `stripe_price_id` maps to (annual ÷ 12, rounded to pence).
  - If the price ID isn't mapped yet, **today's price** for its plan and interval, marked as an estimate.
- **`admin_overview_stats`:**
  - `mrr` is the sum of those values; `arr` = MRR × 12;
  - new `mrr_estimated` (how many rows are estimates) and `no_plan_users` (same count as before, renamed);
  - `free_users` still returned with the same number, for the old screen;
  - `active_subscriptions` uses the entitled rule;
  - `trials` uses the Phase 12 access state.
- **`admin_list_subscriptions`:**
  - each row gains `plan_key`, `billing_interval`, `subscription_status`, `access_state` (from `_access_state_for`), `value` (the monthly value above) and `value_basis` (`stripe_price` / `estimate` / `none`);
  - `status` is **active**, **not_completed** (checkout never paid), **cancelled** (Stripe `canceled`, or ended) or **no_plan**;
  - the old filter value `free` means `no_plan`, and `trial` filters on the access state.
- **`admin_list_users`:**
  - each row gains `plan_key` and `access_state`, and `subscribed` uses the entitled rule;
  - new status filters `trial_ended` and `owner`; `trial` uses the access state;
  - the plan filter compares plan keys; `free` / `no_plan` means no active subscription.
- **Search path and grants:** every replaced or new function has `SET search_path = ''`. The grants are explicit and match the live functions: `authenticated` and `service_role` may call, PUBLIC and anon may not, and the body refuses non-super-admins. The helper and the table can't be reached from a browser.
- **Guards:** the body hashes of the three live functions:

  | Function | md5 |
  | --- | --- |
  | `admin_overview_stats` | `28ee18513e9010929d93f70c89dfa7da` |
  | `admin_list_subscriptions` | `f8061f10eb397748969715af30661310` |
  | `admin_list_users` | `24265c01d545e12517a1f15edebf0d5b` |

  The proposal also checks that the Phase 12 access functions exist, and refuses a second apply.
- **Nobody's entitlement changes.** These functions only report.

## Expected figures for the 7 subscriber rows today (worked out from the code, not by querying production)

- One active Business subscriber; the other six rows are cancelled or have no plan, so they count **0** both now and after.
- Only the active subscriber counts towards MRR:

  | What they pay | MRR | ARR |
  | --- | --- | --- |
  | Business £59 a month | **£59** | £708 |
  | Legacy Business £35 a month | **£35** | £420 |
  | Business £590 a year | **£49.17** | £590.04 |
  | Legacy Business £350 a year | **£29.17** | £350.04 |

- Today Admin shows £59 / £708, which is only right if that subscriber pays £59 a month.
- Until `data-step.sql` maps the price IDs, Phase 22 values that subscriber at today's price for their plan and interval (£59 if monthly), and the tile says "Includes 1 valued at today's price".
- The cancelled rows' Value changes from the old fixed price to £0.
- `owner-readonly.sql` query B shows the plan and interval of the active row (counts only) so you can check.

## Files

| File | What it is |
| --- | --- |
| `proposal.sql` | The change. |
| `rollback.sql` | Restores the three functions verbatim, then drops the helper and the table. |
| `data-step.sql` | Map the Stripe price IDs (placeholders), plus a check query. |
| `owner-readonly.sql` | Read-only: confirm the live hashes, what active subscribers pay, how "cancelled" rows came about. |
| `fixture-live.sql` | The live functions verbatim, plus minimal tables. `_access_state_for` is a stub reading a fixture table. |
| `test.sql` | 20 checks. |
| `run-test.sh` | Runs every earlier suite unchanged through `docs/phase20/run-test.sh`, then this suite and the guards. |

## Order

**SQL first, then publish the frontend.** Either order works without errors:

| Order | What Admin shows |
| --- | --- |
| SQL first, old frontend still live | The old screen still works (`free_users` is still returned). Plans still show raw tier names, and "free" rows now show the status code `no_plan`. MRR/ARR/Value are the corrected figures. |
| New frontend first, SQL not yet applied | Solo / Business / Scale and "No plan" everywhere. MRR/ARR/Value are still the old fixed-price figures. Account states fall back to the old trial flag ("Trial" or "No plan"). The "Trial ended" and "Checkout not completed" filters return nothing until the SQL is applied. |
