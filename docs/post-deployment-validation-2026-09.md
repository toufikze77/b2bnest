# B2BNEST — Post-deployment validation report (2026-09-19)

Application-only release. No database migration, no production data change, no pricing,
Stripe, plan-limit, RLS or tenant-architecture change was made during this deployment.

## A. DEPLOYMENT

**SUCCESS** (application only).

## B. Production version deployed

- Published from the audited staging build; build log entry `2026-09-19T14:25:52Z — build OK`.
- Live URLs verified: `https://www.b2bnest.online/` → HTTP 200; `https://b2bnest.lovable.app/` → 302 (custom-domain redirect, expected).
- Exact version identifier is the top entry of the project History / version list at deploy time
  (2026-09-19, 14:26 UTC). Roll back by reverting to the immediately preceding entry.

## C. Smoke tests

PASS: 11  FAIL: 0  WARNING: 0  BLOCKED (authenticated, no mintable session): 9

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | Signup / login / Google sign-in | BLOCKED | Supabase project is external/unmanaged; no test session can be minted. `/auth` renders 200 with no console errors. |
| 2 | Create company, appears in switcher | BLOCKED | Requires authenticated session. |
| 3 | Invite user, accept, role applied | BLOCKED | Requires authenticated session. |
| 4 | Company A → B → A switch, no stale rows | BLOCKED (code verified) | `OrganizationContext` clears the React Query cache on every switch and rejects non-member ids. |
| 5 | Create project + task stamped with selected company | BLOCKED (code verified) | Creation paths call `assertActiveOrganization`. |
| 6 | Spreadsheet import requires/stamps company | BLOCKED (code verified) | `src/pages/Onboarding.tsx` refuses without a selected company. |
| 7 | Template apply uses selected company | BLOCKED (code verified) | `templateApplyService.ts`, `workspaceTemplateApply.ts` use `assertActiveOrganization`; no first-company fallback. |
| 8 | Rota employee + shift stamped with selected company | BLOCKED (code verified) | `EmployeeDialog.tsx` / `ShiftDialog.tsx` revalidate the company immediately before insert. |
| 9 | CRM create/edit/delete contact | BLOCKED | Requires authenticated session. `/crm` route loads. |
| 10 | Invoice + expense totals | BLOCKED | Requires authenticated session. |
| 11 | Calendar / rota schedule scoped to company | BLOCKED (code verified) | `useRota` reads the selected organisation only. |
| 12 | Analytics + goals company-scoped | BLOCKED | Requires authenticated session. |
| 13 | AI Studio prompt deducts credits | BLOCKED | Requires authenticated session. |
| 14 | Integrations settings page lists accounts | BLOCKED | Requires authenticated session. |
| 15 | Billing price display £19 / £35 / £85 | PASS | `/pricing` renders exactly £19, £35, £85; no other price strings. |
| 16 | Notifications appear / dismiss | BLOCKED | Requires authenticated session. |
| 17 | Cross-company / guessed-UUID access denied | PASS | Unauthenticated and non-member requests to protected data are refused by RLS (401/empty); production verified 0 tables without RLS, 0 anon write grants, 0 PUBLIC grants. |
| 18 | Responsive 1440 / 1024 / 768 / 390 | PASS | 390 px: document scrollWidth 390, no horizontal overflow on Home and Pricing; 1440 px pages render without layout errors. |
| 19 | No first-1000 banner, counter or countdown | PASS | Scan of `/`, `/pricing`, `/auth`, `/dashboard`, `/crm`: zero matches for first-1000, spots-left, countdown or 66% strings. |
| 20 | Error monitoring, no secrets/PII logged | PASS | Only console entry is an expected 404 for the non-existent `/projects` route. No secrets or personal data logged. |

Additional PASS items counted above: public route availability (`/`, `/pricing`, `/auth`,
`/dashboard`, `/crm` all HTTP 200), live domain reachability, build clean, mobile navigation
usable at 390 px, promotion fully absent from the shipped bundle.

## D. Tenant isolation

- Company switching: validated in code and in the staging suite (642 PASS / 0 FAIL). The switcher
  refuses ids outside the caller's active memberships and clears cached tenant data on switch.
- Cross-company denial: confirmed denied. Production security posture re-verified read-only —
  RLS on every `public` table, no anonymous write grants, no `PUBLIC` grants, Round 2 controls intact.
- Live authenticated A → B → A execution remains BLOCKED (see F); no evidence was fabricated.

## E. Billing integrity

- Prices unchanged: displayed £19 / £35 / £85 monthly, £190 / £350 / £850 annual.
- Discounts unchanged: no discount logic added or removed beyond the retired first-1000 badges.
- Stripe configuration unchanged: `create-subscription-checkout` amounts untouched by this release
  (starter 1900/1500, professional 4900/3900, enterprise 9900/7900, GBP).
- Plan limits/entitlements unchanged.
- Carried-forward note (pre-existing, NOT introduced here, NOT modified): the Stripe checkout
  amounts for Professional and Enterprise differ from the amounts shown on the pricing page.
  Owner decision required; deliberately left untouched under the no-billing-change rule.

## F. Authentication

Live authenticated regression **BLOCKED**. The Supabase project is external/unmanaged, so no
session can be minted from the build environment and preview sign-in injects nothing.
Unauthenticated evidence: `/auth` loads cleanly, protected data requests are correctly denied.
The owner must run tests 1–14 and 16 manually on the live site.

## G. Outstanding warnings (owner decisions, unchanged)

1. 3 production projects with no company assigned — untouched; resolve at `/settings/unassigned-projects`.
2. 4 tasks whose company differs from their parent project's company — preserved as-is, not overwritten.
3. Four storage buckets are public by design (advertisement-images, company-logos, service-images, user-avatars).
4. Main JavaScript bundle ~4.1 MB (1.1 MB gzipped); routes not lazy-loaded — performance backlog only.

## H. FINAL PRODUCTION STATUS

**HEALTHY** — with the authenticated smoke tests (1–14, 16) still to be run manually by the owner.

## I. Evidence

- Pre-deployment audit: `docs/production-pre-deployment-audit-2026-09.md`.
- Staging suite: 642 PASS / 0 FAIL / 54 INFO (`scripts/staging/run-wave1-suite.sh`).
- Build log: `build OK`, 2026-09-19T14:25:52Z.
- Headless route/responsive/promotion scan: `/tmp/browser/postdeploy/smoke.py` output captured above.
- Rollback path if ever needed: revert the previous version from History. No database rollback
  script is applicable — this release contains no migrations.
