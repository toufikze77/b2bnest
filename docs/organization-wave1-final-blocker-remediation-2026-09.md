# B2BNest — Wave 1 Final Blocker Remediation (2026-09)

Scope: staging + application code only. **Production was read-only throughout.**
No production schema, data, RLS, Edge Function or deployment change was made.

---

## 1. Historical data investigation (read-only production)

The pre-flight report stated "3 projects + 12 tasks". Current production data
contradicts that statement and the correct figures are below.

| Project | ID | Owner | Owner orgs | Tasks | Child-task org evidence | Class |
|---|---|---|---|---|---|---|
| B2BNEST | cb4c260b-4905-433c-9563-9f381ea3912d | 66a8af46… | 1 | 6 | d2d372cd… | SINGLE-MEMBERSHIP (derivable) |
| AI NEST | 499fdffe-5741-4984-99c5-8b654f82d555 | 66a8af46… | 1 | 1 | d2d372cd… | SINGLE-MEMBERSHIP (derivable) |
| AINEST | b7ac8fb5-09b0-438b-8cfa-042e3f024b1a | 3eac00c6… | 3 | 5 | 69fd39aa… | AMBIGUOUS — human decision |
| NESTPRO TRADE | d13672f8-f5f4-4e2a-a4e1-35df0cf0ff32 | 3eac00c6… | 3 | 0 | none | AMBIGUOUS — no evidence |
| NG TELECOM | 271ce96c-2341-4f9b-a9db-96d3ad54a9ec | 3eac00c6… | 3 | 6 | 136792c5… | AMBIGUOUS — human decision |

- NULL-organisation projects: **5**, not 3.
- Tasks under the ambiguous multi-organisation subset: **11**, not 12
  (5 under AINEST, 0 under NESTPRO TRADE, 6 under NG TELECOM). All 11 already
  carry an organisation id consistent with their siblings.
- Nothing was inferred or written. Assignment requires explicit human approval.

## 2. Blocker 2 — spreadsheet import did not stamp the company

`src/pages/Onboarding.tsx` now resolves the tenant from the top-bar active
company (`useActiveOrganization`), re-validates it with
`assertActiveOrganization()` and stamps `organization_id` on every imported
project. Validation failure aborts the whole import with a clear message and
inserts nothing.

## 3. Blocker 3 — template application picked the first membership

`src/services/templateApplyService.ts` and
`src/services/workspaceTemplateApply.ts` no longer query "first active
membership" (`.limit(1).maybeSingle()`) and no longer call
`ensure_user_has_org`. Both now require the caller-supplied active organisation
and validate it. `UseTemplateDialog.tsx` and `UseWorkspaceTemplateDialog.tsx`
pass the switcher's organisation.

## 4. Canonical tenant helper

New `src/lib/activeOrganization.ts` → `assertActiveOrganization(orgId)`:
requires an authenticated user, an explicitly selected organisation, an active
membership, and a creation-capable role (owner/admin/manager/member). RLS
enforces the same rule server-side; this is the fail-fast client gate.

## 5. Anti-pattern sweep

- `.limit(1)` membership selection: found only in the two template services —
  both removed.
- `memberships[0]` / `organizations[0]` / `orgs[0]`: no occurrences.
- Wave 1 creation paths reviewed: `ProjectManagement.tsx`, `TodoList.tsx`,
  `EnhancedTodoView.tsx`, `CreateProjectDialog.tsx`, `CreateTodoDialog.tsx`,
  `JiraTaskView.tsx`, `teamProjectHelpers.ts`, both template services,
  `Onboarding.tsx`. Personal/user-scoped tables were deliberately left
  user-scoped.

## 6. Validation

New suite `scripts/staging/70_wave1_import_template_tests.sql` covers:
import tenancy (incl. manipulated payload, anonymous, non-member, batch
atomicity), template application, company switching / cache isolation, member
pickers, and parent/child tenant consistency.

Full clean pipeline on the isolated staging rebuild (schema parity: 92 tables,
981 columns, 225 constraints, 199 indexes, 93 functions, 61 triggers, 92 RLS
tables, 282 policies, 4 buckets):

```
TOTAL RESULTS: 666
PASS:          612
FAIL:           0
INFO:          54
```

The blocker phases contributed 44 passing assertions: Import 12, Template 9,
Switching 7, Member Picker 5 and Parent/Child 11. An earlier appended run showed
two stale failures after expectations were corrected; the database was rebuilt
from baseline and every suite was then executed exactly once to produce the
clean totals above.

Backfill journal: teams 3, projects 1, todos 2 (parent-derived 1).
Unresolved (reported, never guessed): projects AMBIGUOUS 1 / ORPHANED 1,
teams AMBIGUOUS 1 / ORPHANED 1, todos AMBIGUOUS 1 / MISMATCH 1 / ORPHANED 1.

Rollback: applied after the package and the scoped schema fingerprint (policies,
functions, triggers and columns) was **identical** to the pre-Wave-1 capture;
the package then re-applied cleanly and restored all eight journalled objects.
TypeScript and preview builds pass.

## 7. Reconciliation package

`supabase/remediation/organization-wave1-historical-reconciliation-2026-09.sql`
is a fail-closed template: it aborts unless a human enters approved
project → organisation rows, asserts each target is still NULL, the owner is an
active member, and no child task contradicts the choice; it assigns children
strictly from the parent and ends in `rollback`. **Not approved, not executed.**

## 8. Historical reconciliation status

Explicit future mappings are prepared for B2BNEST and AI NEST. AINEST remains
unresolved by instruction. NESTPRO TRADE and NG TELECOM LTD require separately
authorised organization creation; NG TELECOM also requires verification and
re-stamping of its six child tasks. Owner-only NULL-organization reads remain as
the transitional path, while every new write requires an explicit validated
organization. No reconciliation operation was executed.

## 9. Production read-only confirmation

The final read-only check found zero NESTPRO TRADE/NG TELECOM organizations,
five unresolved projects, and no Wave 1 staging tables in production. No
production organization, project, task, schema or deployment was changed.

---

IMPORT FIX: PASS
TEMPLATE FIX: PASS
CREATION PATH AUDIT: PASS
VALIDATION: 612 PASS / 0 FAIL / 54 INFO
ROLLBACK: PASS
HISTORICAL RECONCILIATION: PARTIAL
PRODUCTION CHANGES: NONE
DEPLOYMENT RECOMMENDATION: DO NOT DEPLOY
