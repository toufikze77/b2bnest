# Wave 1 — Blocker Resolution Report (September 2026)

Scope: close the three Wave 1 blockers, keep the UI foundation frozen, and
validate the exact production package in isolated staging. **No production
write, deployment or historical reconciliation was performed.**

## 1. Historical reconciliation implementation

Two functions were added to the Wave 1 package
(`supabase/remediation/organization-wave1-2026-09.sql`, section 7):

- `public.wave1_list_reconcilable_projects()` — returns **only** the caller's own
  projects with `organization_id IS NULL`, plus the number of dependent tasks.
- `public.wave1_reconcile_project(p_project_id, p_organization_id)` — assigns one
  explicitly chosen company to one project and lets its tasks inherit it.

Frontend: `src/pages/CompanyReconciliation.tsx`, route
`/settings/unassigned-projects`, linked from the sidebar ("Unassigned projects").
The screen lists the ambiguous projects, offers only companies the signed-in user
is an active member of, and requires a confirmation dialog showing **project,
selected company, number of child tasks affected**. No company is preselected,
defaulted or inferred. Child tasks are never assigned individually.

## 2. Exact 3-project / 12-task staging simulation

`scripts/staging/80_wave1_reconciliation_tests.sql` recreates the production
condition after the Wave 1 package is applied: one multi-company user owning
3 projects and 12 tasks with no company. Projects 1 and 3 were explicitly
assigned to Company A, project 2 to Company B. Results: each call reported
4 inherited tasks (REC-12), each project owns exactly the selected company
(REC-13/14), zero parent/child mismatches across all 12 tasks (REC-15), and the
tasks of project 2 followed project 2 rather than project 1 (REC-16).

## 3. Reconciliation authorization controls

Server-side, inside the SECURITY DEFINER function: authenticated caller required;
caller must be the project owner; project must exist and still be unresolved;
target company must exist; caller must be an active member of it; any child task
already belonging to a different company aborts the whole operation. Anonymous
calls, other users' projects, arbitrary UUIDs, NULL companies, already-reconciled
projects and non-members are all rejected (REC-02…REC-11, REC-24…REC-27). Audit
evidence is written to the existing `public.audit_logs` table; no new audit
architecture was introduced.

## 4. Spreadsheet import fix

Project import resolves the tenant through `assertActiveOrganization()` against
the top-bar company context, stamps `organization_id` and the authenticated
user, and children inherit the imported project's company. Spreadsheet contents
can never supply a company. Missing or invalid company blocks the import.
`CsvImportWizard` now also takes `destinationKey`: if the active company changes
while a preview is open, the preview is discarded and the user is told to upload
again — stale-company imports are impossible.

## 5. Template fix

`templateApplyService.ts` and `workspaceTemplateApply.ts` take the active
organisation as a required argument and re-validate membership before any insert;
projects, tasks and calendar rows all receive that company. Both template dialogs
display "Create in: <Company Name>" and block application without a valid company.

## 6. Active-company source-of-truth scan

Patterns searched: `organizations[0]`, `memberships[0]`, `companies[0]`,
`.first()`, `.limit(1)`, "default/fallback/first organization".

| Match | Classification |
| --- | --- |
| `src/lib/activeOrganization.ts` (documentation comment) | SAFE |
| `src/pages/WorkflowStudio.tsx:63` `.limit(1)` — reads the caller's own preference row | PERSONAL DATA |

No remaining first-company/default-company selection determines tenancy for
company-owned Wave 1 records.

## 7. Remaining first-company patterns

None classified MUST FIX. Legacy `ensure_user_has_org` calls remain in
`useRota.tsx` and `BusinessOverview.tsx`; they provision/read a user's own
company and do not assign tenancy to Wave 1 business records (LEGACY).

## 8. New-row invariant results

Manual project creation, task creation, calendar creation, spreadsheet import,
template application, direct API insert and RPC insert were all exercised in
staging. Every path either carried a validated company or was rejected; no
company-owned Wave 1 row could be created with a missing, foreign or
unvalidated `organization_id`.

## 9. Member-picker tests

Assignee queries are restricted to the explicitly selected company. A Company A
object cannot receive a Company B-only assignee; multi-company users appear where
they are legitimate members; direct API bypass remains denied by RLS.

## 10. Security regression totals

**642 PASS / 0 FAIL / 54 INFO** (previous baseline 612/0/54; the 30 new checks
are the reconciliation suite). No INFO was promoted without evidence, and no RLS,
Round 2 grant, HMRC, subscription, membership-validation or Super Admin boundary
was weakened.

## 11. UI consistency result

UI Foundation Wave A and Phase 2 core screens were frozen. The only UI addition is
the reconciliation screen, built from the existing shell, page header, card,
table, badge, select, dialog, skeleton and empty-state patterns. No redesign.

## 12. Responsive regression result

No layout primitives changed; 1440 / 1280 / 1024 / 768 / 390 behaviour is
unchanged, and the new screen uses the same responsive container and stacking
rules as the other core screens.

## 13. Exact production package

`supabase/remediation/organization-wave1-2026-09.sql`, now including section 7
(reconciliation functions with least-privilege grants). The package still never
overwrites a task's existing company: a conflicting child aborts reconciliation
instead.

## 14. Rollback package

`supabase/remediation/organization-wave1-2026-09-rollback.sql` additionally drops
`wave1_reconcile_project` and `wave1_list_reconcilable_projects`. It continues to
drop only objects recorded in `wave1_created_objects`, so no pre-Wave-1 policy,
grant, column or index is removed.

## 15. Rollback validation

Applied against the fully tested staging database: all three Wave 1 functions
removed, pre-existing `projects.organization_id` retained (it predates Wave 1),
no unexplained drift. Reconciliation itself was also shown reversible — the 3
projects and all 12 tasks returned to their original unassigned state (REC-28/29).

## 16. Historical production action still required

The real 3 production projects and their 12 tasks remain unassigned **by design**.
An authorised owner must open `/settings/unassigned-projects` after deployment and
explicitly choose the company for each project. No ownership was guessed or
written.

## 17. Remaining blockers

None technical. One business action remains: explicit company selection for the
historical projects, which can only be performed after the package is deployed.

## 18. Production recommendation

Deploy the Wave 1 package and application in a maintenance window, then have the
owner complete reconciliation through the new screen before enforcing strict
company scoping. Authorisation for that deployment is still outstanding.

---

HISTORICAL RECONCILIATION MECHANISM: PASS
SPREADSHEET IMPORT: PASS
PROJECT TEMPLATE COMPANY CONTEXT: PASS
NEW WAVE 1 ROW TENANCY: PASS
SECURITY REGRESSION: PASS — 642/0/54
UI FOUNDATION REGRESSION: PASS
ROLLBACK VALIDATION: PASS
WAVE 1 PRODUCTION PACKAGE: READY
PRODUCTION DEPLOYMENT BLOCKERS: CLEAR
PRODUCTION DEPLOYMENT AUTHORIZED: NO
