# B2BNEST — First-1000 Promotion Removal and Wave 1 Cleanup

## Scope and release boundary

This staging/application-code cleanup removed the retired first-1000 promotion and completed a repository-wide tenant-path check. It did not deploy to production, write production data, change RLS, change HMRC or billing security, alter Stripe configuration, change plan entitlements, or begin the broader UI redesign.

## Promotion removal

- Removed the first-1000 banner, mock `127/1000` counter, spots-taken urgency copy, special-offer flag, crossed-out prices, and 66%-off badges from `PricingPlans`.
- Removed the purchase-notification promotion widget, including its urgency copy and browser-side subscriber query.
- Removed the fundraising countdown and its unreferenced first-investor urgency component.
- A full source scan found no executable first-1000, countdown, limited-availability, or deleted-component references. Historical security documentation and the archived implementation plan still name removed files for audit traceability.

## Pricing, Stripe, and entitlements

Pricing now renders directly without promotion branches:

| Plan | Monthly | Annual |
|---|---:|---:|
| Starter | £19 | £190 |
| Professional | £35 | £350 |
| Enterprise | £85 | £850 |

No Stripe Edge Function, price identifier, subscription gate, feature list, user limit, or entitlement logic was edited.

## Wave 1 tenant cleanup

- Spreadsheet import still requires `assertActiveOrganization()` and stamps the validated selected company.
- Both template services still require `assertActiveOrganization()` and stamp parent and child records consistently.
- Rota reads now use `OrganizationContext` instead of `ensure_user_has_org`; company switching clears prior rota state and reloads the selected company.
- Rota employee and shift inserts revalidate the selected company with `assertActiveOrganization()` immediately before writing.
- Business Overview reads now follow the selected company and clear prior results during a switch. No executable application call to `ensure_user_has_org` remains.

## Historical reconciliation

No reconciliation was executed. B2BNEST and AI NEST retain deterministic prepared mappings; AINEST remains unresolved; NESTPRO TRADE and NG TELECOM still require separately authorized organization decisions; existing contradictory child stamps were not overwritten. The fail-closed reconciliation package remains unchanged.

## Validation

- Repository-wide retired-promotion scan: PASS for executable source.
- Repository-wide arbitrary first-company RPC scan: PASS; generated Supabase types retain only the RPC type declaration.
- Patch whitespace check: PASS.
- Full repository lint: pre-existing baseline failures remain across unrelated files; focused changed-file lint reports only existing `any`/empty-block issues already present in those files.
- Automated preview build: delegated to the platform harness.
- Isolated Wave 1 database suite: not rerun because the dedicated disposable PostgreSQL endpoint `/tmp/pgs2:55433` is unavailable. The last validated database result remains 642 PASS / 0 FAIL / 54 INFO; this frontend cleanup did not edit SQL or database packages.

## Status

FIRST-1000 PROMOTION: REMOVED
COUNTDOWN PROMOTION: REMOVED
PRICING: PRESERVED
STRIPE CONFIGURATION: UNCHANGED
PLAN ENTITLEMENTS: UNCHANGED
WAVE 1 TENANT CREATION PATHS: PASS
HISTORICAL RECONCILIATION: FAIL-CLOSED / NOT EXECUTED
PRODUCTION DEPLOYMENT: NOT PERFORMED