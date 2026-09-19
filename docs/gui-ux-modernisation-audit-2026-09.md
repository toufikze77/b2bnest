# B2BNEST GUI/UX Modernisation Audit — 2026-09

Read-only audit of the authenticated application. No redesign is deployed by this document.

## 1. Current frontend architecture
React 18 + Vite 5 + TypeScript + Tailwind v3 + shadcn/Radix. Routing in `src/App.tsx` (largely eager imports). `Layout.tsx` selects between the marketing `Header` frame, the authenticated `AppShell`, and the separate `AdminLayout`. Tenancy flows from `OrganizationContext` (active company, validated memberships, query-cache clear on switch) and `src/lib/activeOrganization.ts` (`assertActiveOrganization`) as the single creation gate. Data access is Supabase client + React Query; RLS is authoritative.

## 2. Current UX problems
- Feature breadth (25+ tools) exceeds the navigational hierarchy; discovery depends on memory.
- Dashboard historically mixed operational work with account/billing/document records, so "what needs attention today" is not answered at a glance.
- Several screens are monolithic (600+ lines) and mix filters, tables, dialogs and business logic.
- Onboarding gives no sample data path; first value requires manual setup.
- Some flows repeat company choice even though the top bar already determines it.

## 3. Visual consistency problems
Historic mixing of gradients, raw palette colours, arbitrary radii, large shadows, inconsistent container widths and heading scales. Semantic tokens existed but were bypassed. Status meaning is often carried by colour alone.

## 4. Navigation problems
Marketing navigation was reused for product routes; tool links buried in menus; duplicated back buttons relying on browser history; no persistent structure communicating where the user is.

## 5. Dashboard problems
Widget-first rather than decision-first. Coarse loading state, no differentiation between "empty" and "failed", no overdue/priority focus, quick actions absent.

## 6. Tables and forms problems
Tables are hand-rolled per feature: search, sort, filter, pagination, bulk selection, row actions and empty/loading states differ everywhere. Rows are tall, wasting vertical space. Forms vary in label placement, required indicators, validation timing and save/cancel hierarchy; date pickers and member pickers are not standardised.

## 7. Responsive problems
Fixed multi-column tab bars and wide toolbars risk overflow below 480px; dense tables need row/detail adaptation; dialogs can approach viewport width on mobile; repeated mobile nav implementations outside a canonical shell.

## 8. Accessibility problems
Inconsistent accessible names on icon-only buttons, uneven focus visibility, colour-only status, missing skip link historically, and dialogs that do not always return focus. Target WCAG 2.2 AA.

## 9. Performance opportunities
Eager route imports inflate the initial bundle; oversized components rerender broadly; dashboard queries are coarse; duplicate date/icon utilities; unoptimised images. Recommend route-level lazy loading, component splitting, narrower React Query keys with tenant scoping, skeletons, and prefetch only on likely navigation.

## 10. Duplicate components and patterns
Multiple page-header implementations, multiple empty/loading treatments, several bespoke stat cards, repeated status-badge colour maps, repeated member-select queries, repeated filter toolbars.

## 11. Design-system proposal
Reuse shadcn/Radix/Tailwind — do not add another framework. Consolidate on semantic tokens only: `background`, `surface`, `surface-muted`, `border`, `text-primary`, `text-secondary`, `brand`, `brand-hover`, `success`, `warning`, `danger`, plus a restrained radius (sm/md/lg), two shadow levels, 4px spacing scale, and a 6-step type scale. Keep the B2BNEST blue/navy identity; colour is used for state and one primary action per view.

## 12. Navigation proposal
HOME (Dashboard) · CUSTOMERS (CRM, Contacts, Deals) · WORK (Projects, Tasks, Calendar, Goals) · MONEY (Invoices, Finance) · AUTOMATION & AI (AI Studio, Workflows) · TEAM (Members, Roles) · CONNECT (Integrations) · ADMIN (Settings, Unassigned projects). Only existing routes are exposed. Super Admin stays in its own frame.

## 13. App-shell proposal
One persistent collapsible left sidebar (expanded/icon on desktop, drawer on mobile) plus a compact top bar: Company Switcher | Global Search | Quick Create | Notifications | Help | User. Skip link, keyboard-operable nav, Cmd/Ctrl+K command palette over real routes and actions.

## 14. Dashboard proposal
Decision-first order: key metrics → work needing attention (overdue, due today) → pipeline → active projects → cash/invoices → recent activity → quick actions. Skeletons per block, distinct error vs empty states, no widget wall.

## 15. Commercial/activation UX
| Change | Metric |
| --- | --- |
| Guided first-run with sample project/board | Activation, time to first value |
| Quick-create command palette | Retention, task volume |
| Guided first CRM contact + first invoice | Time to first value, paid conversion |
| Invite teammates in onboarding | Team adoption, seat expansion |
| Usage/limit visibility with contextual upgrade prompts | Upgrades, paid conversion |
| Clear, action-bearing empty states | Activation |

## 16. Market-leader principles (principles only, no cloning)
Linear: keyboard-first, dense calm surfaces. Stripe: typographic hierarchy and restrained colour. Notion: progressive disclosure. HubSpot: pipeline clarity. Monday/ClickUp: view switching without losing context. Asana: task focus states. Attio: table quality and inline editing.

## 17. Exact files likely to change
`src/index.css`, `tailwind.config.ts`, `src/App.tsx`, `src/components/shell/*`, `src/components/ui/*` (variants only), `src/components/PageHeader.tsx`, `src/components/EmptyState.tsx`, `src/pages/Dashboard.tsx`, `src/components/dashboard/*`, `src/pages/CRMPage.tsx`, `src/pages/ProjectManagementPage.tsx`, `src/components/TodoList.tsx`, invoice/finance components, `src/pages/Settings.tsx`, `src/pages/admin/*`.

## 18. Components to reuse
shadcn Sidebar, Command, Dialog, Sheet, Tabs, Table, Badge, Skeleton, Toast, Form; existing `AppShell`, `PageHeader`, `EmptyState`, `GlobalCommand`, `OrganizationSwitcher`, `StatsCard`.

## 19. Components to consolidate or remove
Collapse bespoke page headers into `PageHeader`; bespoke spinners/empties into `Skeleton`/`EmptyState`; bespoke stat cards into one `StatCard`; per-feature tables into one `DataTable` + `FilterBar` + `SearchInput`; status colour maps into one `StatusBadge`; member selects into one organisation-scoped `MemberPicker`.

## 20. UI implementation waves
A: tokens, shell, sidebar, top bar, company switcher, typography, buttons, cards, page headers.
B: dashboard, DataTable, FilterBar, search, empty/loading/error states.
C: CRM, Projects, Tasks, Calendar.
D: Invoices, Finance, AI Studio, Goals, Integrations.
E: Settings, Team/Roles, Super Admin, responsive and accessibility polish.

## 21. Regression risks
Token renames breaking dark mode; shell changes affecting deep links; table refactors altering filter semantics; lazy loading changing auth-redirect timing; form refactors touching tenant-stamping paths. Mitigation: no business-logic edits inside UI waves, per-wave responsive and accessibility checks, and the Wave 1 suite re-run after any wave touching create paths.

## 22. Metrics per major change
Shell/navigation → activation, feature discovery. Dashboard → retention, daily active use. Tables → task throughput, time on task. Forms → completion rate, error rate. Onboarding → time to first value. Upgrade surfaces → paid conversion. Responsive/accessibility → mobile retention, enterprise trust.
