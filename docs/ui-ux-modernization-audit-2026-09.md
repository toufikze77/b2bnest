# B2BNEST — Post-Wave-1 Product Experience / UI Modernization Audit (September 2026)

Read-only audit. No redesign was implemented as part of this document. Wave 1 tenant architecture (organizations, organization_members, active-company context, company switcher, organization-aware queries, RLS, member pickers, Wave 1 stamping, Round 2 controls) was not modified and must not be modified by any wave proposed here.

Measured repository facts used throughout: 43 page files, 125 feature components, 51 shadcn/ui primitives, 83 route declarations in `src/App.tsx` (none lazily loaded), 146 files using raw Tailwind palette classes, 70 files using gradients, 31 page files independently declaring their own `min-h-screen bg-gradient-*` page background, 45 files using a raw `animate-spin` loader against 8 files using the shared `Skeleton`, 2 files using a shared `EmptyState`, 14 files using any `aria-label`, and 183 dark-mode override lines inside a 367-line `src/index.css`.

---

## 1. Executive UX assessment

B2BNEST is functionally broad and structurally sound, but it presents as a collection of separately built tools rather than one product. Wave 1 delivered the missing foundation — a real authenticated shell (`src/components/shell/AppShell.tsx`, 162 lines: grouped sidebar, company switcher, ⌘K command, quick create, mobile drawer) — and that shell is good. The problem is that only the shell was modernized: the 43 pages inside it still each paint their own background, their own heading scale, their own loaders and their own colour choices.

Concretely: 31 of 43 pages set their own gradient page background, which the shell then has to contain; 146 files bypass the semantic tokens, which is why dark mode needs 183 lines of override CSS; and the busiest screen in the product, `ProjectManagement.tsx`, is a single 3,865-line component holding ten tabs.

Verdict: the foundation is modern, the surfaces are not. This is a finishing problem, not a rebuild, and it is tractable in staged waves.

## 2. Current design-system inventory

Present and healthy: the full shadcn/Radix primitive set (51 files), a clean `tailwind.config.ts`, semantic HSL tokens declared in `index.css` (background, foreground, card, muted, border, primary, destructive, sidebar-*, plus Wave 1 additions surface/shadow-xs/warning), a shared `PageHeader`, a mounted Sonner toaster, and dialog sizing/overflow defaults.

Present but weak: the token layer is declared and then routinely ignored. 146 files use `bg-blue-600`, `text-slate-500`, `bg-gradient-to-br from-slate-50 to-blue-50` and similar. The 183 dark-mode override lines exist purely to repair that bypass; they are a symptom, not a design.

Absent: a canonical `DataTable`, `MetricCard`, `FilterBar`, `StatusBadge`, `Breadcrumbs`, `UserPicker`/`CompanyPicker`, and a single `EmptyState` family in real use (2 files).

Maturity: LOW — tokens exist, adoption does not.

## 3. Navigation audit

The Wave 1 sidebar already groups destinations as Overview / Work / Customers / Money / Team / Automate / More, which is the right instinct. Issues found:

- **Query-string destinations.** Tasks, Calendar and Goals point at `/project-management?view=list`, `?view=calendar`, `?tab=goals`, but `ProjectManagement.tsx` drives its tabs from local `activeTab` state and does not read search params. These three links therefore land on the default tab and never show an active state.
- **Duplicate targets.** "Invoices & quotes" and "All business tools" both resolve to `/business-tools`.
- **Operational leakage.** "Unassigned projects" — a one-off Wave 1 reconciliation screen — sits in primary Work navigation.
- **Missing groups.** No Insights group; Team contains only Employee rota; Settings/Integrations/Billing/Security are reachable only through the avatar menu.
- **Flat directory pressure.** `BusinessTools.tsx` (804 lines) is a second, competing navigation surface listing tools with equal visual weight — exactly the "25+ flat tools" problem.

## 4. Top-bar audit

The top bar is already correct in principle: company switcher, global search trigger, quick create, theme, avatar; no marketing links. Refinements needed: the selected company should read as the workspace anchor (slightly stronger weight/label), the search trigger collapses to an icon below `md` and should keep a visible affordance at tablet, and notifications have no top-bar surface at all despite `notifications` existing in the database.

## 5. Dashboard audit

`/dashboard` renders `OperationalOverview` above the legacy `UserDashboard.tsx` (801 lines, six tabs mixing purchases, favourites, invoices, bills, settings and admin). The result is two dashboards stacked. Marketplace-era metrics (purchases, downloads, favourites) sit at the same visual weight as business metrics. There is no "needs attention" region derived from real data (overdue tasks, overdue invoices, upcoming deadlines all exist in the schema and are not surfaced), and quick actions enumerate features rather than responding to state.

## 6. Onboarding/activation audit

A brand-new company lands on a populated-shaped dashboard filled with zeros and empty cards. `Onboarding.tsx` exists but is effectively a CSV import wizard, not an activation path. There is no progressive checklist, no "create your first contact/project/invoice" sequence, and no invite-teammate moment. Time-to-first-value is currently undefined and unmeasured — the single biggest activation gap found.

## 7. Component consistency audit

- Page chrome: 31 self-declared page backgrounds, 18 hand-rolled back buttons, inconsistent page-title sizes.
- Cards: metrics, filters, controls and even navigation are each wrapped in their own rounded card; nested cards are common.
- Buttons: the shared `Button` variants exist, but many screens hand-roll `bg-blue-600 hover:bg-blue-700 rounded-md` instead, and several pages present three or more equally weighted CTAs.
- Icons: mixed sizing (`h-4`/`h-5`/`h-6`) and decorative coloured icon tiles used as ornament.
- Badges: status colour is chosen ad hoc per screen; no `StatusBadge` contract.
- Oversized components: `ProjectManagement.tsx` 3,865, `BusinessFinanceAssistant.tsx` 2,173, `NotePro.tsx` 915, `BusinessTools.tsx` 804, `UserDashboard.tsx` 801, `AccountSettings.tsx` 797, `AIWorkspace.tsx` 746.

## 8. Forms audit

`EditProjectDialog.tsx` (583 lines) and `QuoteInvoiceCreationSection.tsx` (664 lines) are long single-column forms with no grouping and no progressive disclosure, presented inside dialogs. Labels are inconsistent (some placeholder-only), validation messages appear in three different styles, required fields are not consistently marked, and defaults are rarely pre-filled from the active company. Long forms belong on routed pages, not in modals.

## 9. Tables audit

There is no shared table pattern. CRM, projects, finance and admin each implement their own header, sorting, filtering and row actions, or skip them. Filters, where present, occupy permanent vertical space. Bulk actions exist in no customer-facing surface. Pagination is inconsistent. On smaller widths several tables become stacked full-width cards, losing scannability.

## 10. Empty/loading/error-state audit

Loading: 45 files use a bare spinner, 8 use `Skeleton`. Empty: only 2 files use a shared empty state; most render nothing or "No data found". Error: several fetchers swallow failures into an empty array (`console.error` then `[]`), so a failed load is indistinguishable from genuinely having no overdue bills — a trust problem in a finance product. Permission-denied and zero-search-results states are largely undesigned.

## 11. Responsive audit

Wave 1 validation holds: dashboard and project workspace show 0 px horizontal overflow at 1440 / 1280 / 1024 / 768 / 390, the drawer activates at tablet and below, and dialogs are height-capped and scrollable. Remaining gaps are inside pages rather than the shell: table-to-card reflow is uncontrolled on the finance and CRM surfaces, some toolbars wrap into three rows at 390, and several touch targets fall below 44 px. Mobile is currently a shrunk desktop rather than a prioritized view.

## 12. Accessibility audit

- Contrast: the Wave 1 token pass fixed `--warning`; muted text over tinted surfaces in the raw-colour screens still needs checking.
- Keyboard: shell, dialogs and the command palette trap and restore focus correctly; custom card-as-button patterns in the tools grids are not keyboard reachable.
- Labels: only 14 files use `aria-label`; roughly 25 icon-only buttons remain unlabelled.
- Headings: several pages start at `h3` or skip levels.
- Reduced motion: no `prefers-reduced-motion` handling anywhere.

Target WCAG 2.2 AA is reachable; the blockers are labels, touch targets and custom clickable cards.

## 13. Performance observations

83 routes, zero lazy loading — every page ships in the initial bundle, including the 3,865-line project workspace and the 2,173-line finance assistant. Charts and the AI surfaces are imported eagerly. Several dashboards issue sequential dependent queries rather than parallel ones. Gradients and blur on full-page backgrounds cost paint time on mobile. Route-level code splitting is the single highest-value, lowest-risk performance change available.

## 14. Market-leader pattern comparison

| Reference pattern | Why it works | How it applies to B2BNEST |
|---|---|---|
| Linear — grouped, quiet sidebar with a strong active state | Scales past 25 destinations without visual noise | Keep the Wave 1 groups, quieten inactive items, fix the three broken active states |
| Linear/Vercel — ⌘K as the primary jump | Removes navigation depth entirely for power users | Palette exists; extend to records only behind the org-scoped query contract |
| Stripe — restrained brand colour, colour reserved for status | Reads as trustworthy financial software | Reserve blue for primary actions and active state; status colours only for paid/pending/overdue |
| Stripe/Attio — dense, aligned data tables with right-aligned numerics | Scannable at volume | One `DataTable` contract across CRM, projects, finance, admin |
| Attio — record detail in a side panel | Avoids losing list context | CRM contacts and project rows open a panel, not a full page |
| Notion — progressive disclosure, shallow nesting | Reduces perceived complexity | Collapse the 25-tool directory into grouped nav plus an "All tools" browse surface |
| HubSpot — activation checklist that retires itself | Drives time-to-first-value | 3–5 step first-run checklist, dismissible, hidden once the company is active |
| Asana/ClickUp — compact view switcher (List/Board/Calendar) | One surface, several lenses | Replace the ten-tab project workspace with 3–4 real views |
| Vercel — one empty-state family that teaches the next action | Turns dead screens into onboarding | Single `EmptyState` with title, one sentence, one primary action |
| Monday — mobile prioritizes status and quick actions | Mobile is a different job, not a smaller screen | Mobile shows attention items, tasks and quick actions first |

Explicitly rejected: cloned branding, glassmorphism, neon accents, animated dashboards, per-tool accent colours, giant illustrations.

## 15. Growth/activation opportunities

- **Signup → activation:** 3–5 step checklist (create company → add first contact → create first project → send first quote/invoice → invite teammate). Highest expected impact in the whole audit.
- **First value:** seeded sample data or a template one-click start so the first screen is never empty.
- **Habit:** a real "needs attention" block gives a daily reason to open the product.
- **Paid:** contextual plan-limit moments at the point of friction (approaching AI credit limit, inviting a teammate beyond plan) instead of persistent upgrade banners.
- **Expansion:** invite-teammate surfaced from project and task assignment, where the need is felt.
- **Retention/support:** consistent empty and error states reduce "is it broken or empty?" support contacts.

## 16. Technical debt affecting UI

146 raw-colour files; 183 dark-mode override lines; 31 duplicated page backgrounds; 18 hand-rolled back buttons; three parallel invoice/quote builders with independent numbering; two dashboards on one route; no shared table, metric, status-badge, breadcrumb or picker primitives; 3,865-line project workspace with its own local `Task` interface; no route splitting; pre-existing lint errors (any/exhaustive-deps) across ~23 files.

## 17. Components to preserve

`AppShell`, `OrganizationSwitcher`, `GlobalCommand`, `PageHeader`, the shadcn/Radix primitive set, `AdminLayout` and the admin pages (the strongest internal pattern), `TemplateCenter`'s facet/preview UX, the Rota upgrade-banner pattern, and every organization-aware hook, context and query. `OrganizationContext` and `assertActiveOrganization` are frozen.

## 18. Components to refactor

`Dashboard`/`UserDashboard` (split, retire marketplace metrics into a clearly secondary area), `ProjectManagement` (extract views from the 3,865-line component; List/Board/Calendar plus real routes), `BusinessTools` (grouped browse surface, not a second nav), `AccountSettings` (section nav), `CRM` (drop the non-standard tab IA, add table + side panel), `EditProjectDialog` and `QuoteInvoiceCreationSection` (grouped, routed forms), all 31 page backgrounds (delete, inherit from the shell).

## 19. Components to replace

Introduce and standardize on: `DataTable`, `FilterBar`, `MetricCard`, `StatusBadge`, `EmptyState` (single family), `Breadcrumbs`, `UserPicker`, `CompanyPicker`, `PageContainer`. Replace 45 raw spinners with scoped skeletons, 18 hand-rolled back buttons with breadcrumbs, and the three invoice/quote builders with one canonical form and numbering source.

## 20. Proposed design tokens

Colour (semantic, HSL, light + dark authored deliberately): `background`, `surface`, `surface-subtle`, `surface-elevated`, `border`, `border-strong`, `text-primary`, `text-secondary`, `text-muted`, `primary`, `primary-hover`, `secondary`, `success`, `warning`, `danger`, `focus`. Brand navy/blue is reserved for primary actions, active navigation and key highlights only.

Typography: 28–30 page title / 18–20 section / 14–16 card title / 14 body and table / 12–13 metadata; two weights (regular 400, semibold 600).

Spacing: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48. Radius: 6 controls, 8 cards, 12 dialogs. Shadow: none default, `xs` for raised controls, `md` for overlays only. Container: 1440 max content, 1280 comfortable, 24 page gutter (16 mobile). Control heights: 32 compact, 36 default, 40 large. Table density: 40 compact / 48 default rows. Icons: 16 inline, 20 navigation, 24 feature. Breakpoints: 390 / 768 / 1024 / 1280 / 1440.

## 21. Proposed information architecture

Built only from routes that exist today:

```text
HOME        Dashboard (/dashboard)
SALES       CRM (/crm) · Lead generation (/lead-generation) · Quotes (/business-tools)
WORK        Projects · Tasks · Calendar · Goals (real routes under /project-management)
MONEY       Invoices (/business-tools) · Finance (/business-overview)
AUTOMATE    AI workspace (/ai-workspace) · AI Studio (/ai-studio) · Workflows (/workflow-studio)
TEAM        Employee rota (/rota) · Members (Settings > Team)
MORE        Templates (/template-center) · All business tools (/business-tools) · Help (/help)
BOTTOM      Settings (/settings) · Integrations · Account
```

"Unassigned projects" moves out of primary navigation into Settings, surfaced by a badge only while rows remain. No link is created for a feature that does not exist.

## 22. Proposed AppShell

Keep the current shell; complete it. Sidebar (groups above, Help/Settings/Account pinned bottom) | Top bar (company switcher, search, quick create, notifications, theme, avatar) | Workspace (breadcrumb + `PageHeader` + content, single inherited background, no per-page gradient). Every authenticated route renders through it; public marketing and Super Admin keep their own frames.

## 23. Desktop structure (≥1280)

Persistent 248 px expanded sidebar, collapsible to a 56 px icon rail with tooltips and a remembered preference; 56 px top bar; content max 1440 with 24 px gutters; tables at default density; record detail in a right side panel.

## 24. Tablet structure (768–1279)

Sidebar becomes the drawer (already active at Wave 1's 1100 px breakpoint) or an icon rail; top bar keeps the company switcher and a visible search affordance; two-column metric grids; tables drop secondary columns rather than scrolling horizontally.

## 25. Mobile structure (≤767)

Drawer navigation, sticky top bar with company switcher and search; content prioritized as attention items → tasks → quick actions → everything else; tables become list rows with drill-down; dialogs become full-height sheets; all touch targets ≥44 px.

## 26. Priority matrix

| # | Recommendation | Priority | User impact | Revenue impact | Effort | Risk |
|---|---|---|---|---|---|---|
| 1 | First-run activation checklist + first-value path | P0 | High | High | Medium | Low |
| 2 | Remove the second dashboard; add a real "needs attention" block | P0 | High | High | Medium | Low |
| 3 | Single `EmptyState` family across major screens | P0 | High | Medium | Low | Low |
| 4 | Fix broken sidebar active states and duplicate targets | P0 | Medium | Low | Low | Low |
| 5 | Surface real load errors instead of empty arrays | P0 | High | Medium | Low | Low |
| 6 | Token migration + delete 183 dark-override lines | P1 | Medium | Medium | High | Medium |
| 7 | Shared `DataTable`/`FilterBar`/`StatusBadge` | P1 | High | Medium | Medium | Medium |
| 8 | Route-level lazy loading | P1 | High | Medium | Low | Low |
| 9 | Split the 3,865-line project workspace into real views | P1 | High | Medium | High | Medium |
| 10 | Contextual upgrade moments replacing static banners | P1 | Medium | High | Medium | Low |
| 11 | Skeletons replacing 45 spinners | P2 | Medium | Low | Medium | Low |
| 12 | Accessibility pass (labels, targets, headings, reduced motion) | P2 | Medium | Low | Medium | Low |
| 13 | Merge the three invoice/quote builders | P2 | Medium | Medium | High | Medium |
| 14 | Record side panels in CRM | P3 | Medium | Medium | Medium | Low |
| 15 | Breadcrumbs replacing 18 back buttons | P3 | Low | Low | Low | Low |

## 27. Implementation waves

- **UI Wave 1 — Foundation completion:** tokens finished and adopted in shared primitives, per-page backgrounds removed, sidebar IA/active-state fixes, top-bar notifications, breadcrumbs, `PageContainer`, route lazy loading.
- **UI Wave 2 — Activation:** dashboard consolidation, needs-attention block, first-run checklist, empty/loading/error families, contextual quick create.
- **UI Wave 3 — Work & customers:** projects split into List/Board/Calendar, tasks fast-edit, calendar chrome reduction, CRM table + side panel.
- **UI Wave 4 — Money & insights:** invoices/quotes consolidation, finance tables, status colour discipline, analytics.
- **UI Wave 5 — Scale:** AI Studio, integrations, team, settings section nav, admin token alignment.

Each wave ends with the isolated safety suite and the five-width visual check.

## 28. Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Token migration causes visual regressions across 146 files | High | Medium | Migrate per surface, screenshot diff each wave, never in one sweep |
| Refactoring the project workspace disturbs company stamping | Medium | High | Presentation-only extraction; queries, mutations and `assertActiveOrganization` untouched; suite must stay 642 PASS / 0 FAIL |
| Dashboard consolidation removes something a customer relies on | Medium | Medium | Reposition marketplace metrics, delete nothing without approval |
| Lazy loading breaks a deep link | Low | Medium | Route-level only, Suspense fallback, verify every route |
| Scope creep back into a big-bang redesign | Medium | High | Wave gates, explicit authorization per wave |
| Any weakening of tenant isolation | Low | Critical | Wave 1 architecture frozen; UI adapts to security, never the reverse |

## 29. Recommended UI Wave 1

**Foundation completion** — finish what the Wave 1 shell started: complete the semantic token set and adopt it in the shared primitives, delete the 31 per-page gradient backgrounds so pages inherit one surface, fix the three broken sidebar destinations and the duplicate Money/More targets, move "Unassigned projects" into Settings, add breadcrumbs and a `PageContainer`, surface notifications in the top bar, and introduce route-level lazy loading. High impact, low risk, no business-logic change, and it unblocks every later wave.

## 30. Exact files expected to change (UI Wave 1)

- `src/index.css` — complete the token set; begin retiring the 183 dark-override lines
- `tailwind.config.ts` — expose new surface/text tokens
- `src/components/shell/AppShell.tsx` — sidebar IA, active state, notifications slot, collapse preference
- `src/components/OrganizationSwitcher.tsx` — anchor weight only, no behaviour change
- `src/components/Layout.tsx` — single inherited page surface
- `src/App.tsx` — route-level lazy loading with Suspense fallbacks
- `src/components/ui/page-header.tsx`, `card.tsx`, `button.tsx`, `badge.tsx`, `skeleton.tsx` — token adoption
- New: `src/components/ui/page-container.tsx`, `breadcrumbs.tsx`, `empty-state.tsx`, `status-badge.tsx`
- The 31 page files declaring `min-h-screen bg-gradient-*` — background removal only
- `docs/` — per-wave validation report and screenshots

Not touched in any wave: `src/contexts/OrganizationContext.tsx`, `src/lib/activeOrganization.ts`, `src/hooks/useAuth.tsx`, every organization-scoped query, all RLS/policy/function SQL, billing, HMRC and Super Admin authorization.

---

UI/UX AUDIT: PASS
DESIGN SYSTEM MATURITY: LOW
NAVIGATION MODERNIZATION: REQUIRED
DASHBOARD MODERNIZATION: REQUIRED
MOBILE EXPERIENCE: NEEDS WORK
RECOMMENDED FIRST UI WAVE: UI Wave 1 — Foundation Completion
IMPLEMENTATION AUTHORIZED: NO
