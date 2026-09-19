# B2BNEST Wave 1 final blockers — September 2026

## Release boundary

This report covers staging code, an isolated production-parity database harness, and read-only production evidence. No production database write, reconciliation, application publish, RLS change, billing change, or HMRC change was performed.

## Evidence reconciliation

The original blocker brief described three historical projects and 12 tasks. Two different evidence sets must not be conflated:

- **Staging safety fixture:** exactly three unresolved projects and 12 dependent tasks owned by a multi-organization user. This fixture validates explicit assignment, inheritance, denial, and rollback.
- **Current read-only production evidence:** five projects currently have a NULL organization. B2BNEST and AI NEST have deterministic sole-membership and child-task evidence; AINEST, NESTPRO TRADE, and NG TELECOM remain held for explicit decisions. The three held projects have 11 tasks in total, all already stamped to an organization; NG TELECOM's six task stamps would contradict the proposed dedicated organization.

No assignment is inferred from `user_id`. Production evidence supersedes the old count for future execution planning, while the exact 3-project/12-task fixture remains the regression contract.

## Blocker 1 — historical projects

The Wave 1 package provides an owner-driven, fail-closed reconciliation mechanism:

1. `wave1_list_reconcilable_projects()` reveals only unresolved projects the authenticated owner may reconcile.
2. `/settings/unassigned-projects` requires the owner to choose one of their active companies and confirms the project, selected company, and affected task count.
3. `wave1_reconcile_project(project_id, organization_id)` revalidates authentication, ownership/access, unresolved state, organization existence, and active membership in the selected company.
4. It rejects any child task carrying a contradictory company, stamps the project, fills only NULL child-task company values from the parent, and preserves creator attribution.
5. Arbitrary project IDs, non-member company IDs, stale rows, and cross-company reads/writes are denied by database rules, not trusted UI state.
6. The rollback package returns all 12 fixture tasks and three projects to their original state and restores the pre-Wave-1 schema fingerprint.

### Current production decision table

| Project | Current evidence | Prepared action | Status |
|---|---|---|---|
| B2BNEST | Sole active membership; six children already agree | Explicit future assignment to the evidenced company | Prepared, not executed |
| AI NEST | Sole active membership; one child already agrees | Explicit future assignment to the evidenced company | Prepared, not executed |
| AINEST | Multi-org owner; legacy child evidence is not sufficient business ownership proof | Owner review only | Held |
| NESTPRO TRADE | No suitable organization exists; no children | Separate authorization to create its organization, then owner reconciliation | Held |
| NG TELECOM | Dedicated organization does not exist; six children currently point to Dev Team | Separate organization creation and explicit task re-stamp authorization | Held |

The resolution of all historical records is documented before production. Ambiguous records remain visible only through the transitional owner-safe path until an authorized owner decides; nothing is guessed.

## Blocker 2 — project spreadsheet import

All located project spreadsheet/CSV paths use the active company from `OrganizationContext`, then revalidate it through `assertActiveOrganization()` before insertion. Spreadsheet content cannot supply a company UUID. Imported projects receive the validated `organization_id`; generated children inherit the same ID. Missing selection, stale selection, non-membership, anonymous access, tampered IDs, parent/child mismatch, and partial batch behavior fail closed. Organization initialization now auto-selects only an unambiguous single membership; a multi-company user without a valid stored choice remains unselected instead of inheriting an arbitrary first row.

The isolated test sequence covers Company A import, switch to Company B, Company B import, A/B visibility isolation, no NULL company, and atomic rejection. The open import preview is invalidated if the selected company changes.

## Blocker 3 — project templates

Both template creation services require the caller-supplied active company and revalidate it. First-membership selection and `ensure_user_has_org` fallback behavior were removed. Both confirmation dialogs show the destination company and block without valid context. Every generated project and task receives the same validated company.

The isolated sequence covers applying the same template in Company A and Company B, non-member and stale company IDs, missing selection, parent/child consistency, and cross-company visibility.

## Creation-path review

The audit covered direct project/task dialogs, Jira-style task creation, team helpers, onboarding import, CSV parsing, catalog templates, and workspace templates. No company-owned creation path may fall back to a first membership or silently create a NULL-organization project/task.

## Regression and rollback evidence

Fresh isolated production-parity run on 19 September 2026:

```text
Original required baseline: 574 checks, 0 failures
Expanded current suite:      642 PASS, 0 FAIL, 54 INFO
Rollback:                    PASS
```

The expanded suite preserves the original checks and adds blocker-specific import, template, switching, picker, parent/child, reconciliation, tamper, and rollback assertions. INFO rows are diagnostics and are not counted as PASS.

## Remaining production risks

- Real reconciliation still requires explicit authorization and owner decisions.
- AINEST ownership remains unresolved.
- NESTPRO TRADE and NG TELECOM require separately authorized organization creation.
- NG TELECOM requires explicit authorization before six existing task company stamps can change.
- Authenticated browser A→B→A testing is unavailable against the externally managed authentication provider; database-level tenancy behavior is covered by the isolated suite.

## Production status

The three application blockers are cleared in staging/package terms. That does not authorize production deployment or real-data reconciliation.

WAVE 1 DATA BLOCKERS: CLEAR
WAVE 1 SECURITY REGRESSION: PASS
574 SECURITY CHECKS: PASS
PRODUCTION DEPLOYMENT AUTHORIZED: NO
