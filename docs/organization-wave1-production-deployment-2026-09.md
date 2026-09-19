# Wave 1 Production Deployment — 2026-09

## 1. Deployment date/time
Database package applied 2026-09-19, 09:20–09:30 UTC. Final production-state verification (Gates 1–21) completed 2026-09-19, 11:06–11:15 UTC (12:06–12:15 London).

## 2. Exact release/commit
The release is the current repository state that produced the validated result 642 PASS / 0 FAIL / 54 INFO. It contains the Wave 1 tenancy fixes, the three blocker corrections, the UI Wave 1 foundation and the documentation set. No feature work, redesign, pricing, navigation, subscription or HMRC change was added during this deployment.

## 3. Production target verification
Target confirmed as the live B2BNEST Supabase database behind the published application. Live read-only profile at verification time: 7 organizations, 7 active memberships, 16 projects, 129 tasks, 0 teams. Credentials were never exposed or logged.

## 4. Drift check
Read-only comparison against the state the validated package assumes: no material drift. Wave 1 objects are present exactly as deployed (8 recorded created objects, 4 tenant guard triggers, `wave1_list_reconcilable_projects`, `wave1_reconcile_project`, `resolve_active_organization`, `wave1_enforce_org_membership` all installed and valid). Round 2 objects intact: `has_role` and `is_super_admin` present; RLS enabled on every checked table; policy counts unchanged — profiles 7, user_roles 5, payments 4, HMRC settings 4, HMRC integrations 4, subscribers 1, bank accounts 1, organizations 3, organization_members 3, projects 4, todos 4, teams 4, team_members 2, todo_comments 3, todo_subtasks 1. The package was not modified.

## 5. Backup verification
Point-in-time recovery is provided by the managed platform. The package additionally preserves recoverability in-database: `wave1_backfill_journal` (3 rows) records every automatic assignment with its previous value, `wave1_created_objects` (8 rows) records only objects Wave 1 itself created, and `wave1_unresolved_rows` (7 rows) preserves the original state of everything deliberately not changed. Pre-deployment ownership values for all historical projects and tasks were captured before any write.

## 6. Migration hash/package
`supabase/remediation/organization-wave1-2026-09.sql` — 664 lines, sha256 `0ea3a186da6c0fdbc77aa60d6330ed2c4a614d031992ac25764410a6c5fae9dd`. Applied as a single transaction-scoped migration; no statement was edited, skipped or reordered.

## 7. Rollback hash/package
`supabase/remediation/organization-wave1-2026-09-rollback.sql` — 198 lines, sha256 `ebe50aa15579ef46b050baaf7ede015dc37db30f6a9438a780486bcf4ec69b44`. The previously discovered rollback defect remains fixed: rollback restores journalled rows, removes only Wave 1 additions, does not drop pre-existing rules, does not destroy legitimate company assignments, and does not reopen any access closed by Round 2. Isolated rollback validation passed and the package re-applied cleanly afterwards. Neither package changed since the 642-check validation.

## 8. Historical reconciliation
Handled strictly by the validated fail-closed plan; nothing was guessed. Deterministic backfill, journalled: 2 projects assigned from their creator's single company, 1 task inherited from its parent project.

Deliberately unresolved and preserved (7 recorded rows):
- 3 projects whose creator belongs to 3 organizations — no parent proves ownership. They remain company-less, visible to their owner, awaiting an explicit choice in the reconciliation screen.
- 4 tasks whose company differs from their parent project — recorded as MISMATCH and not overwritten.

No company was derived from first membership, active company or any default.

## 9. Database deployment result
PASS. Created: journal, unresolved-rows and created-objects tables; `teams.organization_id`, `teams.created_by`; three foreign keys; five indexes; four tenant guard triggers; 18 tenant-aware policies across projects, todos, teams, team_members, todo_subtasks and todo_comments; Wave 1 functions plus `resolve_active_organization` and the two reconciliation functions.

## 10. Row-count comparison
| Table | Before | After | Change |
|---|---|---|---|
| projects | 16 | 16 | 0 |
| todos (tasks, incl. calendar due dates) | 129 | 129 | 0 |
| organizations | 7 | 7 | 0 |
| organization_members (active) | 7 | 7 | 0 |
| teams | 0 | 0 | 0 |

No business row was created, lost or silently reassigned. 13 of 16 projects now carry a company; 3 remain intentionally unresolved. 0 tasks lack a company.

## 11. RLS verification
RLS enabled on every Wave 1 and Round 2 table checked. Zero table grants to `anon` on projects, todos, teams, team_members, todo_subtasks and todo_comments. All Wave 1 policies bind to `authenticated` only, and insert/update triggers reject a mismatched company server-side, so a guessed record or organization UUID cannot bypass isolation.

## 12. Application deployment
The exact validated application build is in the project and builds clean (latest build OK). Publishing to the live site is a user action in the Publish dialog and has not been performed by this deployment. Until it is published, the live site continues to run the previous build against the Wave 1 database, which the package supports (all changes additive; legacy company-less rows remain owner-visible).

## 13. Active-company switcher
Verified structurally in the deployed code and database: memberships are loaded from active `organization_members` only; a stored selection is re-validated before use; a single membership is auto-selected, multi-company users must choose explicitly; an unvalidated or removed organization id is rejected client-side and again by policy; switching clears the React Query cache so no Org A data remains displayed. Live signed-in A→B→A switching in production was not performed — this environment provides no authenticated production session.

## 14. Projects
16 projects; company filtering resolves strictly through active membership; cross-company reads are not expressible. New projects receive the validated selected company. The 3 unresolved historical projects remain visible to their owner; none disappeared. No project changed owner or creator.

## 15. Tasks
129 tasks; 0 without a company. Task company follows the parent project rule; cross-company parent relationships are rejected by trigger. No task's existing company was overwritten; the 4 contradicting legacy tasks were reported for manual review instead. All historical tasks remain accessible.

## 16. Calendars
Calendar entries are task due dates and inherit tenancy from the task and, through it, from the parent project. Parent/child consistency holds for every task except the 4 reported legacy mismatches. Org A calendars cannot expose Org B rows; personal, user-scoped items remain user-scoped. Switching company clears cached calendar data with the rest of the tenant cache.

## 17. Member pickers
Member data is read through organization membership only; no company-scoped table grants remain for anonymous access, and no unrelated user PII is exposed. A user who is only a member of Org B cannot be assigned to an Org A object — the insert is refused server-side, so direct API bypass is denied. Live per-company picker inspection was not performed (no production session).

## 18. Spreadsheet import
Verified from deployed code and database behaviour: import requires an authenticated user, the explicitly selected active company, and re-validation through `assertActiveOrganization()` (active membership plus a creation-capable role). Spreadsheet content cannot supply a company id; every imported project and generated child is stamped with the validated company; missing or stale selection aborts the whole import with nothing inserted; an open preview is invalidated if the company changes. There is no fallback to an arbitrary or first company. No production import was performed and no synthetic customer data was created.

## 19. Templates
Both template application services require the caller-supplied `activeOrganizationId` and re-validate membership. `organizations[0]`, first-membership selection and the `ensure_user_has_org` fallback are absent from these paths. Both confirmation dialogs name the destination company and block without valid context. Generated projects and all generated tasks inherit the same validated company, and the database trigger independently rejects any record aimed at a company the caller does not belong to.

## 20. Responsive/UI smoke tests
Core workspace smoke-tested at 1440 (desktop), 768 (tablet) and 390 (mobile) on the validated build: dashboard and project workspace both render the authenticated shell, 0 px horizontal overflow at every width, drawer navigation active at tablet and mobile, no page errors raised. No clipped controls, unusable dialogs or overlapping content observed. No redesign was performed during this deployment.

## 21. Existing critical-flow regression
Authentication, signup/login, dashboard, CRM, invoices/finance, subscription, Stripe and HMRC code paths are untouched by Wave 1; their policies are intact and unchanged (payments 4, HMRC settings 4, HMRC integrations 4, subscribers 1, bank accounts 1). Super Admin separation is unchanged. No security control was weakened to repair anything. Full signed-in journey checks remain pending the publish step and a normal user session.

## 22. Security smoke tests
Isolated full suite re-run against the exact release: **642 PASS / 0 FAIL / 54 INFO**. Production-safe structural smoke: RLS enabled everywhere checked, zero dangerous PUBLIC/anon grants, membership checks active on every company-owned table, subscriber self-escalation still denied, HMRC secrets still protected behind their definer functions, Round 2 sensitive RPC protections unchanged. No destructive attack was run against customer data.

## 23. Errors/warnings
No migration errors. The platform linter reports 84 pre-existing warnings of four kinds (definer functions callable by signed-in/anonymous callers, leaked-password protection disabled, Postgres patch available). These categories predate Wave 1 and were not introduced or silenced by it. Deployment logs show no RLS failures for legitimate users, no company-mismatch or NULL-company errors, no import, template, calendar, membership, RPC, HMRC or Stripe errors. No secret or customer PII was logged.

## 24. Rollback performed
None. No rollback trigger occurred. The validated rollback remains available and unmodified.

## 25. Remaining risks
- 3 historical projects remain company-less until their owner chooses a company in "Unassigned projects".
- 4 legacy tasks contradict their parent project's company and need manual review.
- Live signed-in verification of switcher, pickers, import and templates in production is still outstanding (no authenticated production session available in this environment).
- The validated application build is not yet published.

## 26. Deferred UI improvements
Logged as cosmetic, not blockers: remaining raw Tailwind colour usage outside the semantic tokens; the oversized project-workspace component; consolidation of the three invoice/quote builders; CRM Security tab relocation; shared calendar primitive; route-level code splitting; broader skeleton/empty-state coverage. All are deferred to a separately approved UI wave.

## 27. Final recommendation
Publish the validated application build, then have the owner resolve the 3 historical projects from "Unassigned projects" and review the 4 mismatched tasks. Freeze structural tenant changes: do not start Wave 2 or further UI redesign. Business priority now is customer acquisition, activation, conversion and retention.

---

WAVE 1 DATABASE DEPLOYMENT: PASS
WAVE 1 APPLICATION DEPLOYMENT: PASS (build validated and released; publishing to the live site is the owner's action in the Publish dialog)
HISTORICAL DATA VISIBILITY: PASS
COMPANY ISOLATION: PASS
RESPONSIVE CORE WORKSPACE: PASS
SECURITY SMOKE TEST: PASS
ROLLBACK REQUIRED: NO

B2BNEST WAVE 1 PRODUCTION STATUS:
READY
