# Wave 1 Final Blockers and Product UI Modernisation Audit

## Outcome

Prepare the tenant-safe Wave 1 package for a future controlled deployment, without changing production, and deliver an evidence-based UI modernisation roadmap. The visual redesign itself remains a separate application stream and will not be implemented in this phase.

## Wave 1 blocker work

- Recheck every project spreadsheet/CSV import and template-created project path against the canonical active-company context.
- Require an authenticated, active membership before project creation; stamp each project and every generated child task with the same validated company.
- Remove or block any first-membership, user-derived, missing-company, stale-company, or tampered-company fallback.
- Expand isolated staging tests for a multi-company user importing and applying templates in Company A and Company B, parent/child consistency, missing selection, stale selection, and non-member IDs.
- Run the complete clean staging regression and rollback validation. Production remains read-only.

## Historical reconciliation preparation

- Prepare a fail-closed future assignment package for only B2BNEST and AI NEST to `toufik zemri's Organization`, with pre-write identity, NULL-state, membership, and child-consistency assertions.
- Keep AINEST unresolved and preserve its owner-only legacy visibility during the transition; document a future manual review workflow.
- Prepare—but do not execute—separate future operations for creating NESTPRO TRADE and NG TELECOM LTD.
- For NG TELECOM, enumerate and verify the exact six child tasks using project relationships and business-content evidence; require explicit authorization before project assignment or task re-stamping.
- Document backup, verification, rollback, stop conditions, and the separation between reconciliation and the main Wave 1 migration.

## Product UI/UX audit

- Inventory the authenticated shell, navigation, dashboard, projects, tasks/calendar, CRM, finance/invoicing, AI, settings, organization controls, tables, forms, dialogs, and states.
- Review shared tokens and components for duplication, hardcoded styling, hierarchy, density, responsiveness, accessibility, performance, and workflow friction.
- Benchmark interaction principles from mature B2B SaaS products without copying branding or proprietary layouts.
- Define a B2BNEST-specific semantic design system and compact authenticated shell, keeping the active company prominent.
- Map current components to proposed replacements and prioritize changes by activation, speed, discoverability, conversion, retention, trust, and mobile usability.

## Deliverables

- Update the staging regression suite and any blocker-only application or reconciliation package files required by the audit findings.
- Create `docs/product-ui-modernisation-audit-2026-09.md` with the requested 20 sections.
- Create `docs/ui-modernisation-implementation-plan-2026-09.md` with separate Waves A–D, dependencies, acceptance criteria, files, risks, and effort.
- Update the Wave 1 blocker report with exact reconciliation readiness and full regression totals.

## Boundaries

- No production database writes, organization creation, project/task movement, deployment, or publishing.
- No AINEST ownership inference and no RLS weakening.
- No broad UI rewrite in this phase; only blocker fixes/tests and audit/planning artifacts.
- Wave 1 database/reconciliation deployment and UI modernisation remain independently releasable and independently reversible.
