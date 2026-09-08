# B2BNest — Organisation Ownership Wave 1: Staging Validation

Scope: isolated local staging only. **No production schema, data, or policy was changed.**

## Database package (staging)

- Package: `supabase/remediation/organization-wave1-2026-09.sql`
- Rollback: `supabase/remediation/organization-wave1-2026-09-rollback.sql`
- Tests: `scripts/staging/50_wave1_seed.sql`, `scripts/staging/60_wave1_tests.sql`

Baseline parity after clean rebuild: 92 tables, 981 columns, 225 constraints, 199 indexes,
93 functions, 61 triggers, 92 RLS-enabled tables, 282 policies, 4 storage buckets.

Regression after Wave 1 applied to a clean rebuild:

```
PASS|574
FAIL|0
INFO|54
```

Rollback validated: Wave 1 columns, functions and triggers removed cleanly; package reapplied afterwards.

### Backfill coverage (deterministic only)

| Table    | Rows | Backfilled | Unresolved |
|----------|------|-----------|------------|
| teams    | 5    | 3         | 2          |
| projects | 5    | 3         | 2          |
| todos    | 7    | 5         | 2          |

Unresolved rows belong to the multi-organisation user and require manual reconciliation;
they were intentionally left unassigned rather than guessed.

### Fixes made during validation

- `wave1_sole_org()` used `min(uuid)`, which Postgres does not provide; replaced with
  `(array_agg(om.organization_id))[1]`.
- The tenant-stamping trigger referenced `NEW.created_by` on tables that do not have it;
  the field access is now nested under the teams-specific branch.
- Test W1-60 expected zero rows where the Round 2 package intentionally denies the table
  grant; the expectation is now `DENY`.

## Application changes

- `src/contexts/OrganizationContext.tsx` — validated membership list, per-user persisted
  active organisation, rejects unvalidated ids, clears the React Query cache on switch.
- `src/components/OrganizationSwitcher.tsx` — company selector, shown only for
  multi-membership users.
- `src/App.tsx`, `src/components/Header.tsx` — provider and switcher wired in.
- `src/components/ProjectManagement.tsx` — project, task, calendar, goal and work-request
  reads are filtered by the active organisation; all project/todo inserts stamp
  `organization_id`; ad-hoc `organization_members` "first row" lookups removed.
- `src/components/TodoList.tsx` — reads scoped to the active organisation (falls back to
  own rows when no organisation context), inserts stamp `organization_id`.
- `src/components/CreateProjectDialog.tsx`, `src/components/enhanced-todos/CreateTodoDialog.tsx`,
  `src/components/JiraTaskView.tsx` — member pickers restricted to the active organisation.

Typecheck and build: PASS.

## Status

- WAVE 1 STAGING IMPLEMENTATION: PASS
- WAVE 1 SECURITY REGRESSION: PASS (574 / 0 FAIL)
- BACKFILL READINESS: PARTIAL (6 ambiguous rows require reconciliation)
- PRODUCTION CHANGES AUTHORISED: NO
