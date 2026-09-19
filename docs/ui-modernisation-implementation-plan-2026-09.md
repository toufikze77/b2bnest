# B2BNest UI Modernisation Implementation Plan

**Date:** 2026-09  
**Scope:** Authenticated product only  
**Status:** Ready for review; no UI wave has been implemented  
**Deployment boundary:** This work is independent from the Wave 1 database package.

## Success measures

Every change must improve activation, time-to-value, task completion speed,
discoverability, conversion, retention, trust, or mobile usability. Existing
features and tenant boundaries must remain intact. Metrics must come from real
data; no placeholder business statistics may be introduced.

## Wave A — Foundation

**Goal:** Establish the reusable product frame and visual language before page
redesigns.

1. Extend existing semantic tokens with app surfaces and success, warning,
   danger and information states. Replace hardcoded colours incrementally.
2. Add reusable `AppShell`, compact/collapsible sidebar, top bar, `PageHeader`,
   breadcrumbs, `EmptyState`, `StatCard` and data-table frame.
3. Put the active-company switcher first in the top bar. Switching must clear or
   invalidate every tenant-sensitive query before refetching.
4. Add a single quick-create menu for Project, Task, Contact, Deal, Invoice and
   Quote, filtered by access and plan.
5. Add command navigation for routes/tools first. Add record search only where
   current indexed queries can support it safely; do not build a new universal
   search service for appearance.
6. Route-split authenticated areas with `React.lazy` and scoped `Suspense`
   fallbacks. Remove the render-blocking remote font import.
7. Establish WCAG AA checks: skip link, keyboard navigation, focus visibility,
   accessible icon names, 44px mobile targets and reduced motion.

**Primary files:** `src/App.tsx`, `src/index.css`, `tailwind.config.ts`,
`src/components/Header.tsx`, `src/components/OrganizationSwitcher.tsx`, new
`src/components/shell/*`, and shared primitives under `src/components/ui/*`.

**Acceptance criteria**

- Public pages retain the existing marketing header; protected pages use the
  product shell.
- Company identity remains visible at 1440, 1280, 1024, 768 and 390 widths.
- Direct links and refreshes provide stable breadcrumbs, never history-only
  back navigation.
- Keyboard users can reach and operate navigation, company switching, search,
  quick-create and profile controls.
- No horizontal page overflow; initial route bundle excludes unrelated tools.
- Tenant switching cannot show stale records from the prior company.

**Effort:** Large. **Risk:** Medium because protected routing changes broadly.
Use a route-by-route feature flag and preserve the current shell as rollback.

## Wave B — Core activation

**Goal:** Get a new company to first value quickly and make daily work obvious.

1. Dashboard: answer “What needs attention today?” with a restrained real-data
   KPI row, work due, pipeline, projects, invoices, recent activity and actions.
2. Add a dismissible first-company checklist: company profile, first contact,
   project, invoice and teammate. Completion must be backed by existing data.
3. Projects: standard header actions (`New Project`, `Import`, `Templates`) and
   clear list/board/calendar views with status, progress, owner, due date and
   team.
4. Tasks: My Tasks/All Tasks plus list/board/calendar; allow safe inline status,
   priority, assignee and due-date changes.
5. Consolidate project and rota calendar behaviour behind shared date and
   accessibility primitives without changing business rules.
6. Replace blank states with contextual explanations and one clear next action.

**Primary files:** `src/components/UserDashboard.tsx`,
`src/components/ProjectManagement.tsx`, `src/components/TodoList.tsx`,
`src/components/project-management/ProjectCalendarView.tsx`, dashboard/project
pages, and new focused feature components.

**Acceptance criteria**

- New users can complete a first project or task without visiting settings.
- Dashboard sections load independently and distinguish errors from empty data.
- Project/task reads and writes remain scoped to the active company; switching
  companies clears the prior view.
- Core task and CRM lookup workflows remain usable at 390px without unreadable
  compressed tables.
- Existing list, board and calendar capabilities remain available.

**Effort:** Large. **Risk:** Medium. Migrate one surface at a time behind the
Wave A shell and run tenant-switch checks after every surface.

## Wave C — Revenue workflows

**Goal:** Make customer and money workflows commercially credible and coherent.

1. CRM: Contacts, Pipeline and Marketing become the primary areas; move Security
   to Settings and merge overlapping Reports/Analytics into Insights.
2. Standardise searchable/filterable contact tables and deal cards with owner,
   activity, value, stage and close date.
3. Consolidate the three invoice/quote builders around canonical types, totals,
   validation and templates. Preserve existing records and numbering behaviour
   until a separately reviewed server-side numbering change is approved.
4. Apply consistent paid-status, overdue, warning and empty/error states.

**Primary files:** `src/components/CRM.tsx`, `src/components/crm/*`, invoice and
quote creation components, finance pages, shared table/form primitives.

**Acceptance criteria**

- Existing contacts, deals, invoices and quotes render unchanged from source
  data and retain all actions.
- Tax, totals, currency and document output receive dedicated regression tests.
- No client-generated placeholder metrics or destructive schema changes.
- Tables support desktop density and mobile row/detail adaptation.

**Effort:** Large–extra large. **Risk:** Medium-high because finance correctness
and backward compatibility require dedicated QA.

## Wave D — Remaining tools

**Goal:** Apply proven shared patterns progressively, not through a bulk rewrite.

Migrate AI tools, Rota, Lead Generation, Templates and Settings in measured
batches. Split monoliths, standardise forms/dialogs/tables, replace ad-hoc
spinners and empty states, and complete accessible-name and contrast coverage.

**Acceptance criteria:** each migrated area passes desktop/mobile, keyboard,
loading/error/empty, dark-theme and active-company checks before the next area.

**Effort:** Medium per batch. **Risk:** Low per change, high if bundled; release
small vertical slices.

## Verification and release gates

For each wave:

1. Typecheck/build and targeted interaction tests pass.
2. Verify 1440, 1280, 1024, 768 and 390 widths with no overlap or page overflow.
3. Run keyboard, focus, labels, dialog focus and reduced-motion checks.
4. Verify loading, empty, error, permission-denied and plan-gated states.
5. Test Company A → Company B switching for stale cache/data leakage.
6. Compare route bundle sizes and key page request counts to the prior release.
7. Release behind a controlled application flag with a frontend-only rollback.

## Separation from Wave 1

The Wave 1 schema/RLS/backfill package, historical reconciliation operations and
their rollback remain a separate controlled database release. UI Waves A–D must
not be included in that deployment or used as its rollback mechanism. No Wave 1
production deployment is authorised by this plan.