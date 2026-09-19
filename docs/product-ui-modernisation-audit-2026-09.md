# B2BNest Product UI Modernisation Audit
**Date:** 2026-09 · **Scope:** Authenticated frontend (dashboard, projects, CRM, calendar, finance/invoicing, settings, global shell) · **Method:** Static code inspection, read-only, file:line evidence · **Status:** Findings for prioritisation — no code changed.

---

## 1. Current Architecture (as-built)

### 1.1 Composition model
The app is a single Vite/React SPA (`react-router-dom`) with **no persistent authenticated app shell**. Every route is a top-level page that composes the public marketing `Header` (`src/components/Header.tsx`) plus its own ad-hoc body and a public `Footer`, rather than a dashboard shell with sidebar/nav/breadcrumbs.

- `src/components/Layout.tsx:9-16` — the only "shell" primitive in the repo; wraps `Header` + `children` + a tour overlay. It is optional (many pages, incl. `Dashboard`, `CRMPage`, `ProjectManagementPage`, `Settings`, don't even use it) and carries no concept of sidebar, breadcrumbs, or section chrome.
- `src/components/Header.tsx:44-96` — one global marketing nav bar (Home / Business Tools / Templates / AI Tools dropdown / Pricing / Help) is reused unmodified for logged-in users. Authenticated-only destinations (CRM, Lead Generation, Rota, Settings) are buried three levels deep inside a user-avatar `DropdownMenu` (`Header.tsx:157-193`), not in primary navigation.
- Each authenticated page independently re-implements page chrome:
  - `src/pages/CRMPage.tsx:12-27`, `src/pages/ProjectManagementPage.tsx:12-29`, `src/pages/Settings.tsx:11-17` each hand-roll: full-bleed gradient background, `container mx-auto px-4 py-8`, an `<ArrowLeft>` "Back" button that does `navigate(-1)` (browser-history dependent, not a real breadcrumb), and a manually styled `<h1>`/`<p>` header block.
  - `grep` shows **24 page files** independently declare `min-h-screen bg-gradient-to-br from-slate-50 to-blue-50` and **18 files** independently implement their own `ArrowLeft` back button — i.e. "navigation" is duplicated per page rather than provided once by a shell.
- The one place a real product-grade shell exists is `/admin` (`src/pages/admin/AdminLayout.tsx:1-58`): persistent left sidebar (`NavItems`, `AdminLayout.tsx:14-31,34-53`), active-state styling, a `Sheet` for mobile, `Outlet` for nested routes. This proves the pattern is already known in the codebase but was never extended to the customer-facing product (Dashboard/CRM/Projects/Finance/Settings) — the exact area users spend the most time in.

### 1.2 Page inventory (authenticated core)
| Area | Entry file | Pattern |
|---|---|---|
| Dashboard | `src/pages/Dashboard.tsx:6-13` → `src/components/UserDashboard.tsx` (801 lines) | Single monolithic component with a 6-way `Tabs` (`UserDashboard.tsx:445-450`: Purchases / Favorites / Invoices / Bills / Settings / Admin) mixing document-store history with finance data and account settings in one screen |
| Settings | `src/pages/Settings.tsx:19-46` | 3-tab page (`Account`/`Notifications`/`HMRC`), but `AccountSettings.tsx` (798 lines) *itself* contains security, localisation, currency, 2FA, feedback — settings-within-settings, no left-nav settings pattern |
| CRM | `src/pages/CRMPage.tsx` → `src/components/CRM.tsx` (641 lines) | 6-tab page (Contacts/Sales Pipeline/Marketing/Security/Reports/Analytics, `CRM.tsx:593-598`) — "Security" and "Reports" as CRM sub-tabs is a non-standard IA choice |
| Projects | `src/pages/ProjectManagementPage.tsx` → `src/components/ProjectManagement.tsx` + `src/components/project-management/ProjectCalendarView.tsx` (443 lines) | Kanban/list/calendar bundled behind local component state, no shared calendar primitive reused elsewhere (Rota has its own separate calendar/scheduling UI under `src/pages/rota/`, CRM has its own date pickers) |
| Finance/Invoicing | `src/components/InvoiceGenerator.tsx` (494 lines), `src/components/InvoiceCreationSection.tsx`, `src/components/QuoteInvoiceCreationSection.tsx` | Three parallel, independently-implemented invoice/quote builders with distinct data shapes (`Invoice`/`InvoiceItem` interfaces re-declared per file) |
| Lead-gen / Rota | `src/pages/lead-generation/*`, `src/pages/rota/*` | Each is its own isolated route tree with no shared shell either |

### 1.3 Design tokens
- `tailwind.config.ts:20-96` defines a reasonably orthodox shadcn token set (`background/foreground/primary/secondary/muted/accent/card/sidebar/border/ring`), and `src/index.css:9-33` defines the underlying HSL values for light/dark. This part is a legitimate foundation.
- However the tokens are **only sparingly honoured**. `src/index.css:76-152` contains ~80 lines of `.dark <utility-class> { ... !important }` overrides (e.g. `.dark .bg-white`, `.dark .text-gray-900`, `.dark .bg-blue-100`) whose sole purpose is to patch components that hardcode raw Tailwind palette classes instead of semantic tokens. This is a maintenance smell: dark mode is retrofitted with brute-force CSS overrides rather than being correct by construction.
- Evidence of raw-colour usage instead of tokens: 96 files contain literal `text-gray-900` / `bg-gray-50` / `bg-white` (`rg -l` count), and `bg-gradient-to-br from-slate-50 to-blue-50` (bespoke, non-token gradient) is repeated in 26 places across the repo, each a slightly different literal rather than one `bg-app-shell` token/class.

---

## 2. Issue Inventory (evidence-based)

### A. Navigation & Information Architecture
1. **No persistent authenticated shell/sidebar** — every authenticated destination (Dashboard, CRM, Projects, Settings, Rota, Lead-gen) is reached via a marketing header + browser-history "Back" button, not a stable nav. Evidence: `Header.tsx:44` (`<header>` used app-wide), zero sidebar in `Layout.tsx`, contrast with the *only* correct implementation at `AdminLayout.tsx:34-53`.
2. **Primary product surfaces hidden in a dropdown**: CRM, Lead Generation, Employee Rota, Onboarding — core paid features — only surface inside the user avatar menu (`Header.tsx:164-187`), competing for space with "Sign Out". No wayfinding for where a user currently is (no active/selected state, no breadcrumb).
3. **Back button anti-pattern**: `navigate(-1)` (`CRMPage.tsx:17`, `ProjectManagementPage.tsx:17`, and 16 more) breaks when a page is opened via direct link/bookmark/refresh — it can navigate the user *out of the app* to whatever was previously in history, or do nothing detectable.
4. **Duplicated, drifting page-header pattern**: 24 pages each hand-code `min-h-screen bg-gradient-to-br from-slate-50 to-blue-50` (`CRMPage.tsx:12`, `ProjectManagementPage.tsx:12`, `Settings.tsx:11` — note Settings additionally adds a `dark:` variant the others lack, so dark mode is inconsistent page-to-page) plus a hand-styled `<h1 className="text-3xl font-bold text-gray-900">`/`<p className="text-gray-600">` pairing that ignores the `text-foreground`/`text-muted-foreground` tokens already defined for this exact purpose.
5. **Inconsistent container widths**: page containers vary between `max-w-7xl` (27 uses), `max-w-6xl` (8), `max-w-4xl` (17), `max-w-3xl` (19), etc. with no documented breakpoint system — content width is arbitrary per page rather than shell-controlled.

### B. Dashboard
6. **Overloaded single dashboard**: `UserDashboard.tsx` (801 lines) combines document purchase history, favourites, quotes, invoices, bills, account settings and an admin escape hatch inside one 6-tab component (`UserDashboard.tsx:445-450`). There is no distinct "Overview" surface with KPIs/at-a-glance state — the first tab is a flat purchases table, not a summary.
7. **No unified empty/loading state contract**: `UserDashboard.tsx` fetches 5 independent resources in `Promise.all` (`UserDashboard.tsx:50-56`) behind a single `loading` boolean — a slow bills query blocks rendering of already-available purchases data (no per-section skeletons/suspense boundaries). Only 6 files in the whole repo use the shared `Skeleton` primitive vs 46 files using raw `animate-spin` divs — loading UX is inconsistent (full-page spinner vs inline spinner vs skeleton is chosen ad hoc per component, e.g. `AdminLayout.tsx:65-67` uses a hand-rolled spinner div rather than `<Skeleton>`).
8. **Bills/overdue logic embedded in the view layer**: overdue-status calculation happens inline inside the dashboard component (`UserDashboard.tsx:73`) rather than being a reusable status derivation — duplicated wherever bill status needs to be shown (finance widgets, invoices list) with risk of drift.

### C. Projects / Tasks / Calendar
9. **Three independent calendar implementations**: `project-management/ProjectCalendarView.tsx` (443 lines, hand-rolled month grid via `date-fns`), the Rota scheduling views under `src/pages/rota/`, and CRM/finance date pickers — no shared `<Calendar>`/`<Scheduler>` primitive, so date-grid behaviour (today-highlighting, week start, keyboard nav) will diverge across the product.
10. **Task/Kanban types duplicated locally**: `ProjectCalendarView.tsx:24-40` defines its own `Task` interface (status/priority/assignee/etc.) rather than importing a shared domain type — a second definition drifting from whatever `ProjectManagement.tsx`/DB types use is a correctness risk, not just a style one.

### D. CRM
11. **Non-standard CRM IA**: CRM tabs are Contacts / Sales Pipeline / Marketing / **Security** / Reports / Analytics (`CRM.tsx:593-598`). Bundling account/data "Security" (`SecurityTab.tsx`, 443 lines) as a CRM tab, alongside "Reports" *and* "Analytics" as two separate tabs, contradicts the mental model of every market CRM (contacts/pipeline/activities primary; security & reporting are settings/insights, not peers of contacts).

### E. Finance / Invoicing
12. **Triplicated invoice/quote builders**: `InvoiceGenerator.tsx` (494 lines, defines its own `Invoice`/`InvoiceItem`), `InvoiceCreationSection.tsx`, and `QuoteInvoiceCreationSection.tsx` each re-implement invoice creation with separate local state and separate type shapes rather than one canonical invoice/quote schema + form. This means: three surfaces to keep in sync for tax rules, numbering (`InvoiceGenerator.tsx:45-51` invents its own `INV-YYYYMM-###` numbering scheme, independent from whatever the quotes/bills tables use), currency formatting, and validation.
13. **Invoice numbering & totals computed client-side** with `Math.random()` (`InvoiceGenerator.tsx:50`) — a collision-prone, non-auditable approach for a legally significant document (invoice numbers), and a red flag for a finance feature being treated as an unstyled prototype rather than production billing UI.

### F. Settings
14. **798-line monolithic `AccountSettings.tsx`** mixes profile, password, 2FA, localisation/currency/timezone, and feedback in one file with only 3 outer tabs (`Settings.tsx:20-32`); no left-nav settings pattern (Profile / Security / Billing / Notifications / Integrations) despite this being the de facto standard for B2B SaaS settings once more than ~4 sections exist.

### G. Design system / consistency
15. **Design tokens defined but bypassed**: raw Tailwind palette classes (`text-gray-900`, `bg-white`, `bg-slate-50`, etc.) appear in 96 files instead of semantic tokens (`text-foreground`, `bg-card`, `bg-background`) that already exist in `tailwind.config.ts:21-46`. Dark mode is patched after the fact with ~80 lines of `!important` global overrides (`src/index.css:76-152`) instead of components being written against tokens — this is technical debt that will keep resurfacing every time a new component ships with a literal colour.
16. **No spacing/typography scale enforced** — headings are freely mixed (`text-3xl font-bold`, `text-2xl font-bold`, etc.) per page rather than driven by a shared `<PageHeader>`/`<Heading>` component; 5 separate `max-w-*` conventions in use with no documented rationale.
17. **Component duplication beyond finance**: two visually-similar template systems coexist — `src/components/template-card/` and `src/components/template-centre/` (note also `TemplateCenter.tsx` page vs `template-centre` folder — a spelling/naming split suggesting parallel/duplicated work rather than one canonical template browsing experience).

### H. Empty / loading / error states
18. Only 6 files use the shared `Skeleton` component versus 46 using ad hoc `animate-spin` markup — no house style for "loading" states.
19. ~50 files implement their own "No X found/yet" empty-state copy inline (`grep -rln "No .* found\|No .* yet"`) with no shared `<EmptyState icon/title/description/action>` component — each is a bespoke `<div>` with different icon sizes, copy tone, and (often missing) call-to-action.
20. Error handling is inconsistent: some flows surface failures via `toast()` (`UserDashboard.tsx:88-92`), others silently `console.error` and return `[]` (`UserDashboard.tsx:104-108,117-121,130-133` — a failed bills fetch is indistinguishable from "no bills yet" in the UI), which will actively mislead users about outstanding invoices/overdue bills.

### I. Accessibility
21. **Accessible-name coverage is thin**: only 11 files in the whole `src/` tree use `aria-label` at all, while a single `src/components/*.tsx` slice alone contains 37 raw `<button>` elements — most icon-only buttons across the product (tab triggers, table row actions, kanban card menus) likely have no accessible name. `Header.tsx:121-141` does add `aria-label`/`title` correctly for its icon buttons — showing the team knows the pattern, it's just not applied consistently elsewhere.
22. Mobile nav toggle in `Header.tsx:218-224` is one of the few components with correct `aria-expanded`/`aria-label` handling — good pattern, not propagated to feature areas (Kanban column headers, CRM row actions, Settings tab icons).
23. Colour-only status differentiation is common in bills/tasks/CRM badges (`Badge` colour by status) without confirmed accompanying text/icon in every instance — needs a contrast/redundant-encoding pass once instrumented (flagged as risk, not confirmed everywhere by static read).

### J. Performance
24. **No route-level code splitting observed**: `grep`-level check of `src/App.tsx` routes shows direct static imports of all ~60+ page components rather than `React.lazy`/`Suspense` per route — every visitor's initial bundle likely includes CRM, Rota, Project Management, Admin, Fundraising, Whitepaper, Tokenomics, etc. regardless of which single page they load. This is the single biggest concrete performance lever available without any redesign.
25. **`Promise.all` all-or-nothing dashboard fetch** (`UserDashboard.tsx:50-56`) forces every dashboard load to wait on the slowest of 5 queries before anything paints — no streaming/staggered rendering.
26. Multiple full-file components exceed 400–800 lines (`UserDashboard.tsx` 801, `AccountSettings.tsx` 798, `CRM.tsx` 641, `InvoiceGenerator.tsx` 494, `ProjectCalendarView.tsx` 443, `SecurityTab.tsx` 443) — large, non-code-split, non-memoised client components are a re-render and bundle-size risk as features grow.

### K. Responsive design
27. Mobile nav is handled once, well, in `Header.tsx:230-355`, but individual feature screens (CRM 6-tab `TabsList`, Settings, Dashboard 6-tab `TabsList`) use `grid-cols-N` tab bars (`Settings.tsx:20`, similar in CRM/Dashboard) that were not verified to reflow below ~480px — with 5–6 fixed columns these are a strong candidate for overflow/truncation on small screens; no `overflow-x-auto` or responsive column collapse pattern is visible in the tab-list markup inspected.

---

## 3. Market-Leader Interaction Principles (applicable, not to be copied verbatim)
Patterns broadly used by Linear, Notion, HubSpot, Stripe Dashboard, and Intercom that are directly relevant to the gaps above (described as principles, not pixel-for-pixel references):

1. **Persistent, collapsible app shell** with a left rail (product switcher/sections) + top bar (search, org switcher, notifications, avatar) that never re-renders per page — navigation state (active section) is always visible, unlike this app's per-page ad hoc headers.
2. **Command palette / global search** (⌘K pattern) as the primary way to jump between records/sections in data-dense B2B apps, reducing dependence on deep dropdown menus like `Header.tsx:157-193`.
3. **Canonical record/detail pattern**: one shared "entity page" shell (header + tabs + activity feed) reused for Contact, Deal, Project, Invoice — instead of each domain (CRM, Projects, Finance) inventing its own page composition.
4. **Section-scoped secondary navigation** (settings-style left nav, or CRM-style sub-tabs under a stable top-level "CRM" item) rather than encoding unrelated concerns (Security, Reports) as flat peer tabs.
5. **Optimistic UI + inline skeletons scoped to the smallest updating unit**, not full-page spinners gating unrelated data (contrasts with the current `Promise.all`+one `loading` boolean pattern).
6. **One empty-state component family** (icon + one-line explanation + primary action) applied everywhere data can be zero, so first-run experience is consistent instead of 50 bespoke variants.
7. **Systematic status/semantic colour tokens** (success/warning/danger/info) bound once and applied via `Badge`/`Alert` variants, not raw Tailwind palette classes needing an `!important` dark-mode patch layer.
8. **Route-level code splitting + suspense boundaries** as default engineering hygiene in large dashboards, keeping the first authenticated paint small regardless of total app surface area.

---

## 4. Proposed Semantic Design System (extends existing tokens, doesn't replace them)

Keep the existing shadcn/Tailwind CSS-variable foundation (`tailwind.config.ts`, `src/index.css`) — it is sound — and close the gaps:

- **Status tokens** (new): `--status-success`, `--status-warning`, `--status-danger`, `--status-info` (+ `-foreground` pairs), mapped to `Badge`/`Alert` variants (`success`/`warning`/`danger`/`info`) so bill-overdue, invoice-paid, task-priority, deal-stage all draw from one palette instead of literal `bg-red-100 text-red-800` scattered per component.
- **Surface tokens** (new): `--surface-app` (shell background), `--surface-panel` (card-on-shell), `--surface-sunken` (table/list zebra) to replace the 26-instance bespoke `bg-gradient-to-br from-slate-50 to-blue-50`.
- **Spacing/typography scale**: formalise `PageHeader` (title/description/actions slot) and `Heading` primitives so `text-3xl font-bold text-gray-900` is never hand-typed again (currently duplicated verbatim across `CRMPage.tsx:24`, `ProjectManagementPage.tsx:22`, and others).
- **Elevation tokens**: `--elevation-1/2/3` mapped to the existing `shadow-sm/md/lg` dark-mode override block (`src/index.css:129-131`) so shadows are token-driven instead of `!important`-patched per class name.
- **Component contracts to formalise in `src/components/ui`**: `EmptyState`, `PageHeader`, `SectionNav` (for settings-style left nav), `StatCard` (dashboard KPI), `DataTable` (shared list/table shell for Contacts/Deals/Invoices/Bills/Tasks) — currently each of these is reinvented per feature.
- **Migration mechanism**: introduce an ESLint rule (or `stylelint`/custom lint) flagging raw `text-gray-*`, `bg-gray-*`, `bg-slate-*` literals outside `src/components/ui`, to stop the 96-file drift from growing further while token adoption proceeds incrementally.

---

## 5. Proposed Shell

Replace the "marketing Header on every authenticated page" model with a true app shell for all `ProtectedRoute` destinations, following the pattern already proven at `src/pages/admin/AdminLayout.tsx`:

```
<AppShell>
  <Sidebar>            // collapsible; sections: Dashboard, Projects, CRM, Finance,
                         Lead Gen, Rota, Templates, Settings — mirrors AdminLayout NAV[] pattern
  <TopBar>             // breadcrumb (replaces navigate(-1) back-buttons), global search,
                         org switcher (existing OrganizationSwitcher.tsx), notifications, avatar menu
  <PageHeader>         // title + description + primary actions slot, replaces the
                         hand-rolled h1/p pairs duplicated on 24+ pages
  <main><Outlet/></main>
</AppShell>
```

- Marketing pages (`/`, `/pricing`, `/about`, `/blog`, etc.) keep the existing `Header`/`Footer` — no change needed there; the split is: **public site = current Header/Footer**, **authenticated product = new AppShell**, matching the split that already exists conceptually for `/admin`.
- Settings becomes a `SectionNav` (left list: Profile, Security, Notifications, Localisation, Integrations, HMRC) inside the shell instead of a 3-tab page hiding a 798-line monolith.
- Breadcrumbs replace all 18 `navigate(-1)` "Back" buttons, which are unsafe for deep-linked/refreshed pages.

---

## 6. Before/After Component Mapping

| Current (evidence) | Problem | Proposed |
|---|---|---|
| `Header.tsx` reused on every authenticated page | No section context, deep menu nesting (`Header.tsx:157-193`) | `AppShell` + `Sidebar` + slim `TopBar`; `Header` retained only for public/marketing routes |
| Per-page `<div className="min-h-screen bg-gradient-to-br ...">` + manual `<h1>/<p>` (`CRMPage.tsx:12-27`, ×24) | Duplicated, drifting, ignores tokens | Shared `PageHeader` + shell `<main>` background from `--surface-app` token |
| `navigate(-1)` back buttons (×18) | Breaks on deep link/refresh | Shell breadcrumb bound to route tree |
| `UserDashboard.tsx` 6-tab monolith (801 lines) | Overview, finance, and admin conflated | `Dashboard` overview page (KPI `StatCard`s) + separate `Invoices`/`Bills` routes under Finance section |
| `AccountSettings.tsx` 798 lines, 3 outer tabs | Settings-in-settings | `SectionNav` settings shell, one concern per route/file |
| `CRM.tsx` 6 flat tabs incl. Security/Reports (`CRM.tsx:593-598`) | Security/Reports not peers of Contacts | Contacts/Pipeline/Marketing as CRM tabs; Security → Settings; Reports+Analytics merged into one "Insights" tab |
| `InvoiceGenerator.tsx` + `InvoiceCreationSection.tsx` + `QuoteInvoiceCreationSection.tsx` (3 implementations) | Divergent types/numbering/logic | One `InvoiceForm`/`useInvoice` hook + one canonical `Invoice`/`Quote` type, numbering generated server-side |
| Ad hoc `animate-spin` divs (46 files) / inline empty-state `<div>`s (~50 files) | Inconsistent loading/empty UX | Shared `Skeleton` usage + one `EmptyState` component |
| `ProjectCalendarView.tsx` local `Task` interface (443 lines) | Type drift risk | Shared domain types imported from `src/types`, one `Calendar` primitive reused by Projects/Rota |

---

## 7. Delivery Waves

**Wave A — Foundation & Safety (low risk, high leverage)**
- Add status/surface design tokens; ESLint rule blocking new raw-Tailwind-colour usage in feature code.
- Route-level code splitting (`React.lazy`+`Suspense`) for `src/App.tsx` route table — addresses Issue 24 with no visual change.
- Introduce shared `EmptyState` and `PageHeader` components; wire into 2–3 pilot pages.
- *Files:* `tailwind.config.ts`, `src/index.css`, `src/App.tsx`, new `src/components/ui/empty-state.tsx`, `src/components/ui/page-header.tsx`.
- *Effort:* S–M. *Risk:* Low (additive, no navigation/behaviour change). *Business impact:* faster initial load, stops debt growth immediately.

**Wave B — App Shell & Navigation**
- Build `AppShell`/`Sidebar`/`TopBar`/breadcrumb; migrate `ProtectedRoute` destinations (Dashboard, CRM, Projects, Settings, Rota, Lead-gen) onto it; remove per-page gradient/back-button duplication.
- *Files:* new `src/components/shell/*`, `src/App.tsx` (route wrapper), `src/pages/Dashboard.tsx`, `CRMPage.tsx`, `ProjectManagementPage.tsx`, `Settings.tsx`, `src/pages/rota/*`, `src/pages/lead-generation/*`.
- *Effort:* L. *Risk:* Medium — touches every authenticated route; needs regression pass on deep links and mobile nav. *Business impact:* single biggest perceived-quality jump; makes CRM/Finance/Rota discoverable instead of hidden in a dropdown, likely improving feature adoption/retention.

**Wave C — Domain Consolidation (Finance, CRM, Settings, Projects)**
- Merge the three invoice/quote builders into one canonical form/type/numbering flow; move CRM Security tab into Settings and merge Reports+Analytics; convert `AccountSettings.tsx` into a `SectionNav`-based multi-route settings area; unify calendar primitive across Projects/Rota.
- *Files:* `InvoiceGenerator.tsx`, `InvoiceCreationSection.tsx`, `QuoteInvoiceCreationSection.tsx`, `CRM.tsx`, `crm/SecurityTab.tsx`, `crm/ReportsTab.tsx`, `crm/AnalyticsTab.tsx`, `AccountSettings.tsx`, `project-management/ProjectCalendarView.tsx`, `src/pages/rota/*`.
- *Effort:* L–XL (data-model touchpoints, needs product sign-off on IA changes). *Risk:* Medium-High — invoice numbering/type consolidation must preserve backward compatibility with existing `invoices`/`quotes`/`bills` tables; requires QA on financial correctness, not just visuals. *Business impact:* removes duplicate maintenance burden, reduces bugs from type drift, improves trust in a paid, revenue-critical (invoicing) feature.

**Wave D — Polish, Accessibility, Performance hardening**
- Systematic `aria-label` pass on icon-only buttons/tabs (11→full coverage), replace ad hoc `animate-spin`/empty divs with `Skeleton`/`EmptyState` everywhere, verify tab-bar reflow at mobile widths, split remaining 400–800 line components, add error vs empty-state distinction (fix silent `console.error` → `[]` pattern in `UserDashboard.tsx`).
- *Files:* broad sweep across `src/components/**`, `src/pages/**`.
- *Effort:* M, but wide (many small diffs). *Risk:* Low per-change, but requires a checklist/linting gate to avoid regressions at scale. *Business impact:* accessibility/compliance risk reduction, fewer "silent failure looks like empty state" support tickets (e.g. overdue-bill visibility, Issue 20).

---

## 8. Risk / Effort / Business Impact Summary

| Wave | Effort | Risk | Primary business impact |
|---|---|---|---|
| A – Foundation | S–M | Low | Faster load (code-split), stops further design debt |
| B – Shell/Nav | L | Medium (touches all authenticated routes) | Discoverability of paid features (CRM/Finance/Rota), consistent orientation, fewer "lost in the app" support tickets |
| C – Domain consolidation | L–XL | Medium–High (financial data correctness) | Fewer invoicing bugs, credible CRM IA, easier future feature work |
| D – Polish/A11y/Perf | M (wide) | Low per item | Accessibility/legal risk reduction, trust in status accuracy (bills/overdue) |

**Cross-cutting risk:** because there is no persistent shell today, Wave B is the highest-blast-radius change (every `ProtectedRoute` page moves under a new layout) and should be feature-flagged/rolled out route-by-route rather than in one release. Waves A and D are safe to parallelise with product work on other tracks.

## 9. Activation improvements

- Add a quiet, dismissible first-company checklist backed by real completion
  data: company profile, first contact, first project, first invoice and first
  teammate. This shortens time-to-value without replaying an intrusive tour.
- Put one role-aware `Create` menu in the product top bar for Project, Task,
  Contact, Deal, Invoice and Quote. This removes repeated navigation before a
  common action.
- Make every major empty state explain its purpose and offer one next action.
- Keep the active company visible beside global actions. Clear and refetch all
  company-sensitive data on a switch so context is unmistakable.
- Build route/tool command navigation first; add record search only where safe,
  efficient existing queries support it.

## 10. Responsive validation targets

The implementation must be verified at 1440, 1280, 1024, 768 and 390 pixels.
Desktop remains the primary dense business workspace. At 390px, navigation,
company switching, task updates, CRM lookup and quick-create remain available;
wide tables change to prioritised rows/details rather than shrinking columns to
illegibility. No viewport may introduce horizontal page overflow.

## 11. Deployment boundary

This audit authorises no visual implementation or production deployment. UI
modernisation is an application-only release stream, separate from the Wave 1
schema/RLS/reconciliation package and rollback. The detailed sequence and gates
are in `docs/ui-modernisation-implementation-plan-2026-09.md`.
