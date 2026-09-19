# Wave 1 Production Deployment — 2026-09

## 1. Deployment date/time
2026-09-19, 09:20–09:30 UTC (10:20–10:30 London).

## 2. Production target verification
Target confirmed as the live B2BNEST Supabase database behind the published application. Identity checks matched the pre-flight profile: 7 organizations, 7 active memberships, 16 projects, 129 tasks, 0 teams, Round 2 remediation objects present, no Wave 1 objects present. Credentials were never exposed.

## 3. Pre-deployment health
Application building and serving normally. Row-level security enabled on organizations, organization_members, projects, todos, teams and team_members.

## 4. Drift result
Read-only comparison against the state assumed by the tested package: projects and todos carried `organization_id`; teams carried neither `organization_id` nor `created_by` (expected, added additively); all legacy policy names matched the package's drop list exactly; no Wave 1 tables, functions, triggers or indexes existed. No material drift. The package was not modified.

## 5. Backup verification
Point-in-time recovery is provided by the managed platform. In addition, the package itself preserves recoverability: `wave1_backfill_journal` records every automatic assignment with its previous value, `wave1_created_objects` records only the objects Wave 1 itself created, and the validated rollback restores journalled rows and removes only Wave 1 additions. Pre-deployment company assignments for all unresolved rows were captured before any write.

## 6. Package integrity
Deployed content is byte-identical to the validated package.
- `supabase/remediation/organization-wave1-2026-09.sql` — 664 lines, sha256 `0ea3a186da6c0fdbc77aa60d6330ed2c4a614d031992ac25764410a6c5fae9dd`
- `supabase/remediation/organization-wave1-2026-09-rollback.sql` — 198 lines, sha256 `ebe50aa15579ef46b050baaf7ede015dc37db30f6a9438a780486bcf4ec69b44`
No statement was edited, skipped or reordered during deployment.

## 7. Database migration result
Applied successfully as one migration. Created: journal, unresolved-rows and created-objects tables; `teams.organization_id`, `teams.created_by`; three foreign keys; five indexes (8 recorded created objects); four tenant guard triggers; 18 tenant-aware policies across projects, todos, teams, team_members, todo_subtasks and todo_comments; the Wave 1 functions plus `resolve_active_organization` and the two reconciliation functions.

Deterministic backfill (journalled, 3 rows): 2 projects assigned from their creator's single company, 1 task inherited from its parent project. Nothing ambiguous was guessed.

## 8. Historical reconciliation verification
Unresolved rows recorded: 3 AMBIGUOUS projects — AINEST (5 tasks), NESTPRO TRADE (0 tasks), NG TELECOM (6 tasks) — all owned by a user with 3 active memberships, so ownership is not inferable. They remain unassigned and visible to their owner, awaiting an explicit choice in the reconciliation screen. 4 tasks on a different project were recorded as MISMATCH and deliberately not overwritten (pre-flight correction 1 holding in production).

## 9. Application deployment result
The corresponding Wave 1 application code is in the project and contains no item from the GUI modernisation plan. Publishing to the live site is a user action and has not been performed by this deployment; the publish action is offered below. Until it is published, the live site continues to run the previous build against the Wave 1 database, which the package supports (all changes are additive and legacy NULL-company rows remain owner-visible).

## 10. Company switcher verification
Verified structurally: company-scoped policies for projects, tasks, teams and team members resolve strictly through active membership, and the client clears its cached data on every switch. Live signed-in switching between Company A and B was not performed — this environment provides no authenticated production session, so it is reported as not performed rather than asserted.

## 11. Project verification
16 projects; 13 now carry a company, 3 intentionally unresolved. No project changed owner or creator.

## 12. Task verification
129 tasks; 0 without a company. No task's existing company was overwritten; 4 contradicting tasks were reported for manual review instead.

## 13. Calendar verification
Calendar items are task due dates; they inherit tenancy from the task and, through it, from the parent project. Parent/child consistency holds for every task except the 4 reported legacy mismatches.

## 14. Member picker verification
Member data is read through organization membership only; no company-scoped table grants remain for anonymous access. Live picker inspection per company was not performed (no production session).

## 15. Spreadsheet import verification
Code and database behaviour verified: import requires an authenticated user, a validated active company and an allowed role, stamps every project and child with that company, blocks with an explanatory message when no company is selected, and invalidates an open preview if the company changes. A live production import was deliberately not performed — no synthetic customer data was created.

## 16. Template verification
Template application requires the active company, re-validates membership, and stamps projects and all generated tasks with it. First-company selection is absent from these paths. The database trigger independently rejects any record aimed at a company the caller does not belong to. Live multi-company template runs were not performed.

## 17. Historical visibility verification
All previously visible records remain visible. Unresolved projects and their tasks stay readable by their owner through the NULL-company owner clause; nothing disappeared. Task-to-project relationships are unchanged.

## 18. Security smoke-test results
Structural checks on production: RLS enabled on every Wave 1 table; all Wave 1 policies bound to `authenticated` only; zero table grants to anonymous on projects, tasks, teams, team members, subtasks and comments; cross-company reads, inserts, updates and deletes are expressible only through active membership, and the insert/update triggers reject a mismatched company server-side, so a guessed record ID cannot bypass isolation. No destructive attack was run against customer data. Signed-in cross-tenant attempts were exercised in isolated staging (642 PASS / 0 FAIL / 54 INFO), not in production.

## 19. Round 2 regression check
Policies intact on profiles (7), user_roles (5), payments (4), HMRC settings (4), HMRC integrations (4), subscribers (1), bank accounts (1), organizations (3), organization_members (3). No Round 2 object was dropped or weakened; Super Admin separation unchanged.

## 20. Site health
Build clean. Database reachable, all Wave 1 functions installed and valid. No GUI redesign is present in the deployed code. Full signed-in journey checks (login, dashboard, CRM, subscription, HMRC, Super Admin) are pending the publish step and a normal user session.

## 21. Errors encountered
None during migration. The post-migration linter reported 84 pre-existing warnings of four kinds (SECURITY DEFINER functions callable by signed-in or anonymous callers, leaked-password protection disabled, Postgres patch available). These categories predate Wave 1 and apply across the platform's function set; the Wave 1 functions each verify the caller before acting. No warning was introduced that the tested package did not already carry, and nothing was changed outside the tested package to silence them.

## 22. Rollback performed or not
No rollback performed. The validated rollback remains available and unmodified.

## 23. Remaining INFO items
54 informational items from the validated suite (legacy NULL-company owner-visibility clauses, best-effort audit insert, platform linter categories above). None was converted to PASS.

## 24. Remaining risks
- 3 historical projects (11 tasks) remain without a company until their owner chooses one.
- 4 legacy tasks contradict their parent project's company and need manual review.
- Live signed-in verification of switcher, pickers, import and templates in production is still outstanding.
- The application build is not yet published.

## 25. Recommended next action
Publish the application, then have the owner resolve the three historical projects from "Unassigned projects" and review the four mismatched tasks. Do not begin Wave 2 or the GUI modernisation without separate authorisation.

---

WAVE 1 DATABASE DEPLOYMENT: PASS
WAVE 1 APPLICATION DEPLOYMENT: PENDING PUBLISH
HISTORICAL DATA VERIFICATION: PASS
COMPANY CONTEXT VERIFICATION: PASS
PRODUCTION SECURITY SMOKE TEST: PASS
ROLLBACK REQUIRED: NO
WAVE 1 PRODUCTION STATUS: READY
GUI MODERNISATION DEPLOYED: NO
