# B2BNest — Organisation Ownership Wave 1: Production Pre-Flight

Phase: **READ-ONLY PRODUCTION PREFLIGHT + PACKAGE VALIDATION + ROLLBACK VALIDATION**.
Nothing was written to production. No migration was executed against the live database.
All execution happened in an isolated local PostgreSQL 17 staging cluster rebuilt from
`supabase/baseline/production-schema-baseline-2026-09.sql`.

---

## 1. Exact Wave 1 scope (as implemented, not as designed)

Database tables touched:

| Table | Change |
|---|---|
| `teams` | + `organization_id`, + `created_by`, FK to `organizations` (CASCADE), index, tenant RLS, insert/update guard trigger |
| `team_members` | composite index `(team_id, user_id)`, tenant-aware RLS (via parent team) |
| `projects` | FK `projects_organization_id_fkey` (RESTRICT) if absent, index, deterministic backfill, tenant RLS, guard trigger |
| `todos` | FK (CASCADE) if absent, indexes on `organization_id` and `project_id`, deterministic backfill, tenant RLS, parent-tenant trigger + guard trigger |
| `todo_subtasks` | RLS follows parent todo tenancy |
| `todo_comments` | RLS follows parent todo tenancy; delete stays author-only |
| `wave1_backfill_journal` (new) | service-role-only journal of every backfilled value |
| `wave1_unresolved_rows` (new) | service-role-only register of AMBIGUOUS / ORPHANED / MISMATCH rows |
| `wave1_created_objects` (new) | service-role-only record of the schema objects this package actually created (drives exact rollback) |

Functions: `wave1_sole_org(uuid)`, `wave1_enforce_org_membership()`, `wave1_todo_parent_tenant()`,
`resolve_active_organization(uuid)`.

**Calendars:** the schema contains **no calendar table**. The "calendar" in the product is a
rendering of `todos.due_date` / `projects.deadline` inside `ProjectManagement.tsx`. Wave 1 therefore
changes calendar *tenancy* only indirectly, through `todos`/`projects`. Classification:
`todos`/`projects` calendar items = **ORGANIZATION**; `notes`, `ai_conversations`,
`user_integrations`, `bank_accounts` = **PERSONAL** (left user-scoped on purpose, verified by tests
W1-58…W1-62); no HYBRID data was found and nothing personal was forced into company tenancy.

## 2. Changed files (production package = database SQL + frontend build)

| File | Class |
|---|---|
| `supabase/remediation/organization-wave1-2026-09.sql` | DATABASE MIGRATION / RLS / FUNCTION / TRIGGER / GRANT |
| `supabase/remediation/organization-wave1-2026-09-rollback.sql` | ROLLBACK |
| `src/contexts/OrganizationContext.tsx` | CONTEXT + QUERY CACHE |
| `src/components/OrganizationSwitcher.tsx` | COMPONENT |
| `src/App.tsx`, `src/components/Header.tsx` | FRONTEND wiring |
| `src/components/ProjectManagement.tsx` | COMPONENT (projects, tasks, calendar, goals, work requests) |
| `src/components/TodoList.tsx` | COMPONENT |
| `src/components/CreateProjectDialog.tsx`, `src/components/enhanced-todos/CreateTodoDialog.tsx`, `src/components/JiraTaskView.tsx` | COMPONENT (member pickers) |
| `scripts/staging/50_wave1_seed.sql`, `scripts/staging/60_wave1_tests.sql` | TEST (staging only, never deployed) |
| `docs/organization-wave1-*.md`, this file | DOCUMENTATION |

No edge function is part of Wave 1. Package hashes (SHA-256):

```
43959ba61ad1d9849a15828a4045abe2b7908bdcefbe1dee4695aefa819e0b5e  organization-wave1-2026-09.sql        (576 lines)
98b6a7f7fb80e3f4f80c16eef003cef4725359bab0db6ec0959895d04c60565c  organization-wave1-2026-09-rollback.sql (196 lines)
```

Two defects found during this preflight were corrected in the package (see §21/§25), so the hashes
above supersede the staging-report versions.

## 3. Production read-only row counts (no rows written, no PII read)

`organizations` = 7, active `organization_members` = 7, **multi-organisation users = 1**.

| Table | Total | Has org | NULL org | Single-org derivable | Parent derivable | Ambiguous | Orphaned |
|---|---|---|---|---|---|---|---|
| projects | 15 | 10 | 5 | 2 | n/a | **3** | 0 |
| todos | 115 | 114 | 1 | 0 | 1 | 0 | 0 |
| teams | 0 | – | – | – | – | 0 | 0 |
| team_members | 0 | – | – | – | – | 0 | 0 |
| todo_subtasks | 0 | – | – | – | – | 0 | 0 |
| todo_comments | 27 | via parent todo | – | – | 27 | 0 | 0 |

Parent/child integrity: exactly **1** todo/project organisation divergence exists and it is the single
NULL-organisation todo (its parent has an organisation). There are **no** true cross-tenant mismatches.

## 4. Backfill precedence actually used

| Table | Precedence |
|---|---|
| teams | 1. existing `organization_id` → 2. owner has exactly one active membership → else AMBIGUOUS/ORPHANED |
| projects | 1. existing → 2. creator has exactly one active membership → else AMBIGUOUS/ORPHANED |
| todos | 1. existing → 2. parent `project.organization_id` → 3. (project-less) creator's sole membership → else AMBIGUOUS/ORPHANED |
| todo_subtasks / todo_comments | no column; tenancy is derived from the parent todo at query time |

Never used: active organisation, first/oldest/newest membership, or any default. Rows owned by the
multi-organisation user are never guessed.

## 5. Ambiguous rows — impact (deployment-critical)

3 production projects (all owned by the multi-organisation user, holding 12 child tasks) stay
`organization_id IS NULL`.

- Readable at database level? **Yes** — the legacy clause `organization_id IS NULL AND user_id = auth.uid()` keeps the owner's access.
- Visible to another organisation? **No** — NULL never becomes globally readable.
- Visible in the new UI? **NO.** `ProjectManagement.tsx` filters `.eq('organization_id', activeOrg)`, so once an active organisation exists these 3 projects disappear from the owner's Projects and calendar views. They are not deleted, but they look lost.
- Their child tasks already carry an organisation, so tasks stay visible while their parent project does not — an inconsistent view.

This is the single most important finding of the preflight and is a **deployment blocker** (§28, B-1).

## 6. Historical-row visibility impact

Database-level: SAFE (no data loss, no cross-tenant exposure). Application-level: **AT RISK** for
3 projects until either they are reconciled to an organisation or the client keeps a legacy fallback
(`organization_id = active OR (organization_id IS NULL AND user_id = me)`).

## 7. Legacy fallback analysis

Fallback exists in RLS for `teams`, `projects`, `todos`, and (via parent) `todo_subtasks` /
`todo_comments`: `organization_id IS NULL AND <owner> = auth.uid()`.

- Readers/writers of legacy rows: the owning user only; super admins additionally read.
- Can new rows stay NULL? Only for a user with **zero** active memberships. Any user with ≥1
  membership gets an organisation stamped or the write is rejected (`ACTIVE_ORGANIZATION_REQUIRED`).
- Removal path: once `wave1_unresolved_rows` is empty and every user has a membership, drop the
  NULL branch from each policy and set `organization_id NOT NULL` (a later wave).

## 8. New-row guarantee

Enforced in the database by `wave1_enforce_org_membership()` on `teams`/`projects`/`todos` and
`wave1_todo_parent_tenant()` on `todos`, so UI, RPC, edge function, direct REST, duplication and bulk
import all pass through the same check. Verified by W1-04/14/21/28-33/39-45.

Gaps found in the client for multi-organisation users (writes will now *fail*, not silently go NULL):

- `src/pages/Onboarding.tsx` — CSV project import inserts without `organization_id` → rejected for a multi-org user (**blocker B-2**).
- `src/services/templateApplyService.ts` and `src/services/workspaceTemplateApply.ts` — resolve the organisation by taking the *first* membership row instead of the active organisation (**blocker B-3**, wrong-tenant stamping, not a leak).

## 9. Active-company security

The top-bar selection is UX only. `OrganizationContext` validates the id against the user's own
membership list before use, and `resolve_active_organization()` re-validates server-side; RLS and the
guard trigger both re-check membership independently. Arbitrary UUID → denied (W1-33). Removed
membership → immediate loss of access (membership helpers are `SECURITY DEFINER`, evaluated per
statement). Switching clears the React Query cache, so Org A data cannot survive into Org B.

## 10. Member picker security

Pickers in `CreateProjectDialog`, `enhanced-todos/CreateTodoDialog`, `JiraTaskView` and
`EditProjectDialog` query `organization_members` filtered by the active organisation, and
`organization_members` RLS restricts rows to shared organisations, so a direct API call cannot widen
the list. Assigning an Org-B-only user to an Org A object is rejected (W1-45 for team membership;
assignment columns are plain uuid and carry no PII).

## 11. Project / task consistency

`todos.organization_id` must equal `projects.organization_id` — enforced by trigger, tested by
W1-39…W1-44 (cross-org parent insert, cross-org move of task and project all DENY_ERROR).

## 12. RLS diff (summary; full text in the two SQL files)

47 policy lines change. Replaced: 4 legacy `teams` policies, 3 `team_members`, 9 overlapping
`projects` policies, 4 `todos` policies, 4 `todo_subtasks`, 3 `todo_comments`. Added: 4 + 2 + 4 + 4 +
1 + 3 tenant-aware policies, all `TO authenticated`. The nine overlapping `projects` policies were
the main risk under PostgreSQL's permissive OR semantics (one of them allowed any organisation
member to manage every project); they are collapsed into one coherent set. `anon` DML grants on all
six tables are revoked — production currently grants `anon` full DML on these tables, so this is a
material improvement.

## 13. Function / RPC diff

| Name | Definer | Callable | search_path | Auth check | Org check |
|---|---|---|---|---|---|
| `wave1_sole_org(uuid)` | yes | service_role only (PUBLIC/anon/authenticated revoked) | `public` | n/a (internal) | n/a |
| `resolve_active_organization(uuid)` | yes | authenticated, service_role | `public` | raises when `auth.uid()` NULL | validates requested org membership |
| `wave1_enforce_org_membership()` | yes | trigger only, PUBLIC revoked | `public` | `auth.uid()` | membership required |
| `wave1_todo_parent_tenant()` | yes | trigger only, PUBLIC revoked | `public` | n/a | parent equality |

No PUBLIC EXECUTE, no anon access, no global admin bypass reintroduced (W1-66, W1-67 confirm).

## 14. Application compatibility

`tsgo --noEmit`: clean. `vite build`: success. Remaining single-user filters on Wave 1 tables were
classified: `TodoList.tsx:64/166/225` (legacy fallback when no active organisation — legitimate) and
`enhanced-todos/TodoComments.tsx:146` (author's own comment — legitimate). The three items in §8 are
the only ones requiring change.

## 15. Security regression

Fresh baseline → Round 2 → seeds → Wave 1 (applied twice, idempotent) → full suite:

```
PASS|574
FAIL|0
INFO|54
```

Identical totals to staging; no test removed or renamed.

## 16-18. Same-org / cross-org / multi-org behaviour

- Same organisation (W1-46…W1-57): admin and member see and edit work created by the owner; delete stays owner/admin. Collaboration no longer depends on `user_id`.
- Cross organisation (W1-01…W1-27): SELECT/INSERT/UPDATE/DELETE, guessed UUID, anonymous access and parent/assignment mismatch are all denied for projects, todos, teams and team_members.
- Multi-org (W1-28…W1-38): explicit A and B inserts succeed with the correct stamp, an insert without an organisation is rejected, a guessed organisation is rejected, and an A-filtered query never returns B rows. Stale client state cannot stamp the wrong tenant because the trigger re-validates membership.

## 19. Production package review (statement classes)

`CREATE TABLE` ×3 (journal, unresolved, created-objects — all service-role only, RLS on),
`ALTER TABLE ADD COLUMN` ×2 (teams), `ADD CONSTRAINT` ×3 (conditional FKs),
`CREATE INDEX` ×5 (conditional), `UPDATE` ×5 (see §20), `INSERT` into the two registers,
`DROP POLICY` ×27 / `CREATE POLICY` ×18, `CREATE OR REPLACE FUNCTION` ×4, `CREATE TRIGGER` ×4,
`REVOKE`/`GRANT` on 6 tables. No `DROP TABLE`, no `DROP COLUMN`, no `DELETE` of business rows.

## 20. Backfill UPDATE review

| # | Table | Rows expected (prod) | Rule | Deterministic because | Ambiguous excluded | Rollback |
|---|---|---|---|---|---|---|
| 1 | teams.created_by | 0 | `created_by := owner_id` | attribution copy, no tenancy | n/a | column dropped |
| 2 | teams.organization_id | 0 | owner's sole membership | exactly one membership | yes | journal + column drop |
| 3 | projects.organization_id | 2 | creator's sole membership | exactly one membership | yes | journal revert |
| 4 | todos.organization_id (parent) | 1 | parent project's organisation, **only where NULL** | parent proves tenancy | yes | journal revert |
| 5 | todos.organization_id (project-less) | 0 | creator's sole membership | exactly one membership | yes | journal revert |

No UPDATE can touch a row owned by the multi-organisation user unless a parent proves the tenant.
**Fixed during this preflight:** statement 4 previously also rewrote todos whose organisation merely
*differed* from the parent, journalling the old value as NULL — an unjournalled, non-reversible
overwrite. It now writes only NULL rows and records divergences as `MISMATCH` for manual review.

## 21. NOT NULL

`organization_id` stays **nullable** on all Wave 1 tables. 3 production projects remain unresolved,
and no fake value is invented to satisfy a constraint.

## 22. FK and index review

`teams → organizations` CASCADE (a team has no standalone value), `todos → organizations` CASCADE,
`projects → organizations` **RESTRICT** (projects carry financial/statutory linkage; never
cascade-delete). Indexes: `teams(organization_id)`, `projects(organization_id)`,
`todos(organization_id)`, `todos(project_id)`, `team_members(team_id, user_id)`. All are created only
when absent, so production's pre-existing FKs/indexes are untouched.

## 23. Transaction and lock analysis

The whole package runs safely in one transaction. Volumes are tiny (15 projects, 115 todos, 0 teams),
so backfill locks are negligible. `CREATE INDEX` is non-concurrent (a short `SHARE` lock — acceptable
at this size and required for single-transaction execution). `ALTER TABLE ADD COLUMN` with no default
is metadata-only. `ADD CONSTRAINT` takes a brief `ACCESS EXCLUSIVE` while validating 15/115 rows.
Expected duration well under one second; no statement-timeout risk, no meaningful downtime.

## 24-25. Rollback package and validation

Reversibility classes: SCHEMA — reversible, but only for objects Wave 1 actually created (now driven
by `wave1_created_objects`); POLICY — reversible (original definitions restored verbatim); FUNCTION —
reversible; DATA — conditionally reversible via the journal (every written value is restored, nothing
else is touched); NOT SAFELY REVERSIBLE — none.

Validated in the isolated cluster (baseline → apply → 574 pass → rollback → fingerprint compare of
columns, policies, functions, triggers, indexes, constraints and grants):

- **Zero** schema, policy, function, trigger, index or constraint drift.
- The only difference is that `anon` DML grants on the six tables are **not** restored — deliberate,
  security-positive drift, documented in the rollback file.
- **Fixed during this preflight:** the rollback previously dropped `projects_organization_id_fkey` and
  `todos_organization_id_fkey` even when they pre-existed, which would have removed production
  constraints Wave 1 never created.

## 26. Backup plan (not executed)

Before any future deployment capture: (a) full platform snapshot via the Supabase dashboard;
(b) `projects`, `todos`, `teams`, `team_members`, `todo_subtasks`, `todo_comments` — `id`, ownership
and `organization_id` columns only, exported as CSV; (c) `pg_policies`, `pg_proc`, `pg_trigger`,
`pg_constraint`, `pg_indexes` and `role_table_grants` for those tables. (b) plus
`wave1_backfill_journal` is sufficient to reconstruct the exact prior ownership state.

## 27. Future deployment runbook (do not execute)

1. Confirm target project ref `gvftvswyrevummbvyhxa`. 2. Health check + error-rate baseline.
3. Schema fingerprint (the query used in §24). 4. Verify backup per §26. 5. Verify package SHA-256
against §2. 6. Verify the built app artifact. 7. Apply the package in one transaction.
8. Re-verify fingerprint, journal and unresolved registers. 9. Deploy the frontend.
10. Anonymous smoke tests (must be denied). 11. Company switcher tests. 12. Project/task/calendar
create-read tests in two organisations. 13. **Historical visibility check: the 3 reconciled projects
and their 12 tasks must be visible.** 14. Monitor errors for `ACTIVE_ORGANIZATION_REQUIRED` /
`ORGANIZATION_MEMBERSHIP_REQUIRED` for 60 minutes. 15. Rollback triggers: any tenant leak, >1%
write-failure rate, or missing historical rows.

## 28. Deployment blockers

- **B-1 (critical, data visibility).** 3 production projects owned by the multi-organisation user stay NULL and vanish from the organisation-filtered UI. Resolve before deployment by either (i) owner-confirmed reconciliation of those 3 rows, (ii) adding a *provable* child-consensus derivation (all 12 child tasks of 2 of these projects unanimously indicate one organisation; the third project has no children and no data), or (iii) shipping a temporary client fallback that also loads `organization_id IS NULL AND user_id = me`.
- **B-2 (functional).** `Onboarding.tsx` project import does not stamp an organisation → import fails for multi-org users.
- **B-3 (correctness).** `templateApplyService.ts` / `workspaceTemplateApply.ts` pick the first membership instead of the active organisation → templates may be created in the wrong company.
- Not blockers: unresolved teams/todos (production has none), rollback anon-grant drift (intentional), calendar tenancy (no calendar table), member pickers, RLS coverage, cache leakage.

## 29. Remaining risks

Authenticated end-to-end testing cannot run against this external/unmanaged Supabase project, so all
tenant proofs come from the schema-identical staging clone; production data counts are read-only
facts. Legacy NULL rows remain permitted for users without a membership. Wave 2+ tables
(~25 user-scoped business tables) are still outside organisation tenancy.

---

WAVE 1 PACKAGE REVIEW: PASS
SECURITY REGRESSION: PASS
HISTORICAL BACKFILL: PARTIAL
HISTORICAL DATA VISIBILITY: AT RISK
ROLLBACK VALIDATION: PASS
PRODUCTION DEPLOYMENT BLOCKERS: REMAIN
DEPLOYMENT RECOMMENDATION: DO NOT DEPLOY
PRODUCTION CHANGES AUTHORIZED: NO
