# Phase 11b: Solo / Business / Scale plans and seat limits — PREPARED, NOT APPLIED

Nothing in this folder has been applied to production, and nothing has been created or changed in Stripe. The code in
the PR (catalogue, Pricing page, billing functions) is not deployed either. Each step below needs its own approval.

## Plans (owner decisions, 23 Oct 2026)

| Plan (key, stored tier) | Monthly | Annual | Users | Admins | AI credits / month |
|---|---|---|---|---|---|
| Solo (`starter`, `Starter`) | £19 | £190 | 1 | 1 (the user) | 250 |
| Business (`professional`, `Professional`) | £59 | £590 | 50 | 5 | 1,000 |
| Scale (`enterprise`, `Enterprise`) | £89 | £890 | 100 | 10 | 5,000 |
| Business, earlier price (existing subscribers only) | £35 | £350 | 5 | 5 | 1,000 |
| Scale, earlier price (existing subscribers only) | £85 | £850 | 25 | 10 | 5,000 |

AI credit amounts are unchanged. Owners and admins count together against the admin limit, and towards the user limit.

## Files

| File | What it is | Writes? |
|---|---|---|
| `proposal.sql` | `platform_plans.admin_limit`, 5 plan rows, `platform_plan_prices` (new table, explicit grants), seat functions extended for admins. Caps stay off. | yes |
| `rollback.sql` | Undoes `proposal.sql`; restores the live definitions read on 2026-10-23 verbatim. Refuses while caps are on. | yes |
| `live-functions-2026-10-23.sql` | The live definitions (read-only `pg_get_functiondef`), used by `rollback.sql` and the tests | — |
| `mapping.sql` | Which plan row each active subscriber maps to | read-only |
| `data-step.sql` / `data-step-rollback.sql` | Records the earlier-price Stripe ids in `platform_plan_prices` | yes |
| `precheck.sql` | Per billing pool: users/admins vs limits, and which pools would already be over | read-only |
| `enable-caps.sql` / `enable-caps-rollback.sql` | Switches `_seat_caps_enabled()` on / off (keeps `SET search_path = ''`) | yes |
| `test.sql`, `run-test.sh` | Throwaway Postgres 16 test (`PG_RUN_USER=postgres bash docs/phase11b/run-test.sh`) | local only |

## Order (each step separately approved)

1. **Stripe dashboard (owner):** create the four new prices below. Until they exist, choosing Business or Scale shows
   "This plan can't be bought yet. Nothing has been charged." and no checkout is created.
2. **`mapping.sql`** (read-only), then **`proposal.sql`**.
3. **`data-step.sql`**, BEFORE anyone subscribes at a new price: every Business/Scale price id in use today is an earlier
   price. Check each id from `mapping.sql` in Stripe first (£35/£350 or £85/£850). Read-only on 2026-10-23: 2 Business
   subscribers share 1 price id, 3 Scale subscribers share 1 price id, 1 Solo subscriber.
4. **Deploy the code** (Pricing page and billing functions). New checkouts use the new prices; existing subscriptions are
   never touched.
5. **`precheck.sql`** (read-only), then **`enable-caps.sql`** on the date you set. Then set `SEAT_LIMITS_ENFORCED = true`
   (or `SEAT_LIMITS_FROM`) in `src/lib/plans.ts` so the Pricing page and Members & roles say the limits apply.

Rollback at any point: `enable-caps-rollback.sql` (if caps were switched on), then `data-step-rollback.sql`
(optional; the table goes anyway), then `rollback.sql`.

## Stripe: prices the owner must create (I can't create them)

All recurring, currency **GBP**, on a product per plan. Set the **lookup key** exactly as listed (the code finds prices
by lookup key and refuses any price whose amount, interval or currency differs). Metadata on product and price:
`plan_key` = the plan key below. The code doesn't read metadata (only the lookup key); the earlier prices carry
`b2bnest_plan` with the same value, so adding that too keeps them consistent.

| Product (suggested name) | Price | Interval | Lookup key | metadata `plan_key` |
|---|---|---|---|---|
| B2BNEST Business | £59.00 | month | `b2bnest_business_monthly_gbp` | `professional` |
| B2BNEST Business | £590.00 | year | `b2bnest_business_annual_gbp` | `professional` |
| B2BNEST Scale | £89.00 | month | `b2bnest_scale_monthly_gbp` | `enterprise` |
| B2BNEST Scale | £890.00 | year | `b2bnest_scale_annual_gbp` | `enterprise` |

Solo keeps its existing prices and lookup keys (`b2bnest_starter_monthly_gbp` £19, `b2bnest_starter_annual_gbp` £190);
please confirm both exist and are active, because the code no longer creates a missing price.
Do **not** archive or edit the earlier prices (`b2bnest_professional_*`, `b2bnest_enterprise_*`): existing
subscriptions renew on them.

## How limits are counted (proposal.sql)

- One allowance per paying owner, shared by every company that owner bills for; a person in several of those companies
  counts once. Support customers never count. Pending invitations reserve a seat (admin invitations reserve an admin seat);
  the invited person uses that reservation when they join.
- Over the limit: nobody is removed. Deactivations, demotions and other role changes are never blocked.
- A new or re-activated owner/admin, or a member **promoted** to admin, needs a free admin seat (only while caps are on).
- A pool with no active paid plan keeps today's fallback: the `free` plan row if one exists. There is none, so free
  pools have no limit. Companies without a billing owner still can't add members (unchanged).

## Test results (throwaway Postgres 16, 2026-10-23)

`test.sql`: 57 passed, 0 failed. `run-test.sh` also: rollback carries the live definitions verbatim (pass); two
simultaneous adds with one user seat left → exactly one succeeds (pass); two simultaneous admin adds with one admin seat
left → exactly one succeeds (pass). Covered: search_path and grants, plan rows, data step, caps off/on, Solo user cap,
pooled counting, re-activation, invitation and admin-invitation reservations, admin cap, promotion/demotion, legacy
limits, free fallback, support customers, nobody removed, precheck, rollback refused while caps on, rollback = live
baseline (definitions, ACLs, search_path), re-apply after rollback.

## Decisions for the owner

1. **Admin promotion is checked** against the admin limit while caps are on. Today no role change is ever checked; without
   this, the admin limit could be bypassed by promoting. Demotions are never blocked.
2. **Legacy limits:** existing Business (£35) keep 5 users, existing Scale (£85) keep 25 users; their admin caps are the
   new plans' (5 and 10). The legacy Business row therefore has 5 users and 5 admins.
3. **Free plan:** no `free` row, so free pools stay unlimited even with caps on. Add a `free` row if you want a limit.
4. **Admin stats:** `admin_overview_stats` / `admin_list_subscriptions` join `platform_plans` on the tier, so once the rows
   exist, MRR counts legacy subscribers at the new price (£59/£89 instead of £35/£85). Not changed here.
5. The 3 Enterprise subscribers come from the 29 Sep Stripe test-mode run (roadmap); their limits follow whatever you
   decide for them.

## Not verified

Production behaviour of any of this, Stripe (no access; nothing created), the dashboard SQL editor run of these files,
and that the live `free`/`platform_plans` state is unchanged at the time you apply.
