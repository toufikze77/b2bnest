# B2BNEST GUI/UX Modernisation Implementation Plan — 2026-09

Separate release track from the Wave 1 database package. Nothing here is deployed by this document.

## Principles
- Reuse shadcn/Radix/Tailwind; no new UI framework.
- Semantic tokens only; no hardcoded colour utilities in components.
- No business-logic or tenancy changes inside UI waves; `assertActiveOrganization` and RLS remain untouched.
- Each wave is independently releasable and independently reversible.

## Wave A — Foundation
Scope: token set in `src/index.css` + `tailwind.config.ts`, `AppShell`, sidebar groups, top bar (Company Switcher | Search | Quick Create | Notifications | Help | User), typography scale, button/card/page-header consolidation.
Depends on: none.
Acceptance: all authenticated routes render inside one shell; no hardcoded colour utilities in touched files; 1440/1280/1024/768/390 clean; keyboard path through nav and top bar; dark mode intact.
Effort: M.

## Wave B — Dashboard and data surfaces
Scope: decision-first dashboard blocks; shared `DataTable`, `FilterBar`, `SearchInput`, `StatusBadge`, `EmptyState`, skeletons and error states.
Depends on: Wave A tokens and shell.
Acceptance: one table implementation used by at least two features; every list has distinct loading, empty and error states; row height reduced without loss of legibility.
Effort: L.

## Wave C — CRM, Projects, Tasks, Calendar
Scope: migrate these screens onto the shared table, filter, form and picker components; split components over 600 lines; organisation-scoped `MemberPicker`.
Depends on: Wave B.
Acceptance: no behavioural change to create/update paths; member lists limited to the active company; Wave 1 suite re-run green.
Effort: L.

## Wave D — Invoices, Finance, AI Studio, Goals, Integrations
Scope: consistent page frames, tables, forms and status treatment; contextual usage/upgrade surfaces.
Depends on: Wave B.
Acceptance: consistent money formatting and status semantics; no change to billing, HMRC or subscription logic.
Effort: M.

## Wave E — Settings, Team/Roles, Super Admin, polish
Scope: settings information architecture, role management clarity, Super Admin frame alignment, responsive and WCAG 2.2 AA sweep, route-level lazy loading and bundle trimming.
Depends on: Waves A–D.
Acceptance: contrast and focus checks pass on core screens; initial bundle reduced; Super Admin separation preserved.
Effort: M.

## Cross-wave requirements
- Responsive verification at 1440, 1280, 1024, 768, 390 per wave.
- Accessibility verification: focus order, accessible names, dialog focus return, reduced motion.
- Re-run the isolated Wave 1 suite after any wave touching creation paths.

## Risks and mitigations
Token drift → single source in `index.css`. Shell regressions → keep existing route paths and deep-link params. Table refactor regressions → migrate one feature first, compare outputs. Lazy loading → verify auth redirects and protected-route skeletons.

## Explicit exclusions
No new features, no expansion of the tool catalogue, no rebuild of screens that already pass the consistency check, no GUI deployment alongside Wave 1.
