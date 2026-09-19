# Wave 1 Final Readiness — 2026-09

No production writes, no deployment, no reconciliation of real records were performed.

## A. Historical project reconciliation
No ownership was inferred. An explicit, owner-driven mechanism was added:

- `wave1_list_reconcilable_projects()` (SECURITY DEFINER) returns only the authenticated caller's own projects with `organization_id IS NULL`, with child-task counts. No other user's ambiguous records are visible.
- `wave1_reconcile_project(p_project_id, p_organization_id)` validates: authenticated caller; caller owns/can access the project; project is still unresolved; target organization exists; caller holds an active membership in it. It then stamps the project, propagates the organization to NULL-organization child tasks only, refuses when a child already carries a different company, writes audit evidence into the existing `audit_logs` table (best effort, no new audit architecture), and returns the number of tasks assigned.
- UI: `/settings/unassigned-projects` (`src/pages/CompanyReconciliation.tsx`), reachable from the sidebar. Per project the owner selects one of their legitimate companies; a confirmation dialog shows PROJECT, SELECTED COMPANY and NUMBER OF CHILD TASKS AFFECTED before committing. Creator/owner attribution (`user_id`) is preserved.
- Database validation does not rely on the frontend; arbitrary project UUIDs and cross-organization assignment are denied.

Evidence for the real three projects remains insufficient to determine a single obvious organization, so they stay unresolved pending an explicit owner decision in production.

## B. Project spreadsheet import
Import now requires an authenticated user and a validated active organization. `assertActiveOrganization` re-checks membership and role before any insert; every imported project is stamped with the validated active organization and imported child records inherit it. Spreadsheet contents can never supply an organization UUID. With no active company the import is blocked with an explanatory message; NULL-organization records cannot be created. The wizard shows the destination company before confirmation and invalidates an open preview if the active company changes (`destinationKey`).

## C. Project template company context
All first-company selection was removed from the template paths. `applyTemplateToWorkspace` and `applyWorkspaceTemplate` require the caller-supplied active organization and re-validate membership via `assertActiveOrganization`; projects and all generated tasks inherit that organization. Both dialogs display "Create in: <Company>" and block application without a validated company. Stale client state fails closed rather than creating mismatched parent/child rows.

## D. Regression suite
Fresh isolated production-parity staging, exact Wave 1 package applied, complete suite run, including added regression phases for reconciliation (`80_wave1_reconciliation_tests.sql`), import and template tenancy (`70_...`). Actors covered: A_OWNER, A_ADMIN, A_MEMBER, B_OWNER, B_ADMIN, B_MEMBER, MULTI_ORG_USER, SUPER_ADMIN.

Result: **642 PASS / 0 FAIL / 54 INFO** (previous baseline 574/612 PASS; no tests were removed). Simulated condition: multi-org owner, 3 ambiguous projects, 12 dependent tasks; each project explicitly assigned; tasks inherited the parent organization; other companies denied access; same-company members retained role-appropriate access; unrelated and previously repaired rows unchanged.

## E. Production package
- `supabase/remediation/organization-wave1-2026-09.sql` — 664 lines, sha256 `0ea3a186da6c0fdbc77aa60d6330ed2c4a614d031992ac25764410a6c5fae9dd`
- `supabase/remediation/organization-wave1-2026-09-rollback.sql` — 198 lines, sha256 `ebe50aa15579ef46b050baaf7ede015dc37db30f6a9438a780486bcf4ec69b44`

Both pre-flight corrections remain in place: no irreversible silent overwrite of a task's existing company, and the rollback removes only objects Wave 1 itself created, leaving pre-existing rules and policies intact. Baseline → Wave 1 → full regression → rollback → baseline comparison completed with no unexplained drift.

## F. GUI/UX audit
Delivered as `docs/gui-ux-modernisation-audit-2026-09.md` (22 sections) and `docs/gui-ux-modernisation-implementation-plan-2026-09.md` (Waves A–E). No GUI redesign was deployed; only the UI required by blockers 1–3 was changed.

## Remaining production action
An authorised owner must resolve the three historical projects through the reconciliation screen after Wave 1 is deployed. No automated assignment is provided.

---

HISTORICAL PROJECT RECONCILIATION: PASS
PROJECT IMPORT COMPANY CONTEXT: PASS
PROJECT TEMPLATE COMPANY CONTEXT: PASS
WAVE 1 SECURITY REGRESSION: PASS
WAVE 1 ROLLBACK VALIDATION: PASS
WAVE 1 PRODUCTION BLOCKERS: CLEAR
WAVE 1 DEPLOYMENT RECOMMENDATION: APPROVE
GUI/UX AUDIT: COMPLETE
GUI REDESIGN DEPLOYED: NO
PRODUCTION CHANGES AUTHORIZED: NO
