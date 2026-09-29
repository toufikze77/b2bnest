# B2BNEST — Wave 1 closure checklist (2026-09-30)

No secrets printed or committed. No data or settings changed while producing this record.

| # | Check | Evidence | Result |
|---|---|---|---|
| 1 | Repository and branch | Lovable-managed Git remote for project 0ab9e971…; working branch `edit/edt-c0542fb9…` (auto-synced). Latest commit `96ed402bbd42d8f2861e7682561393d1285d488a` (2026-09-29 22:53 UTC). No uncommitted changes. External GitHub mirror not visible from here. | PASS (GitHub mirror: owner to confirm) |
| 2 | Template apply + spreadsheet import use top-bar company | `workspaceTemplateApply.ts`, `templateApplyService.ts`, `Onboarding.tsx` import all call `assertActiveOrganization(selectedOrg)`; refuses when no company selected; no "first membership" fallback. Server-side guard triggers also reject mismatches. | PASS (code); live signed-in check by owner outstanding |
| 3 | Legacy projects/tasks | NG TELECOM (6), AINEST (5), NESTPRO TRADE (0) → Toufik Zemri's Organization; B2BNEST (26) → Dev Team — all per owner instructions. Projects without company: 0. Tasks mismatched with project: 0. | PASS |
| 4 | Wave 1 migration | Deployed; 4 guard triggers and 3 Wave 1 functions present in production. Isolated suite 642 PASS / 0 FAIL / 54 INFO; rollback validated and re-applied cleanly (see `organization-wave1-production-deployment-2026-09.md`). | PASS |
| 5 | Billing code | Recurring prices (`resolveStripePrice`), duplicate-subscription guard, webhook handles created/updated/deleted/invoice.paid/payment_failed with signature check + event de-duplication, two-plan fallback; expense record idempotent via `ref:<session>` tag. Invoice emails are sent by Stripe (confirmed manually in sandbox), not by app code. | PASS |
| 6 | Production Stripe config | Live restricted key and live webhook secret saved via secure form; live `cs_live_` checkout sessions confirmed. Live webhook destination in Stripe not yet confirmed by owner. | PARTIAL |
| 7 | Security | Critical `platform_settings` exposure fixed. | PASS |

## Remaining blockers
1. Owner confirms a live-mode webhook destination exists (6 events → `…/functions/v1/stripe-webhook`) and its secret is the one saved. Without it, new live subscriptions won't activate.
2. Owner signed-in checks from `wave1-closure-2026-09.md` (tests 1–16, A–I) — results not yet reported.
3. Stripe automatic invoice emails in live mode (Settings → Customer emails) — owner to confirm enabled.
4. Optional: confirm external GitHub repository shows commit `96ed402`.

**Status: WAVE 1 — NOT YET CLOSED (pending items 1–3).**
