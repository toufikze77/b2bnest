# B2BNest Authenticated UI/UX Modernisation — 2026-09

## 1. Scope
Authenticated product surfaces only: shared shell, dashboard, projects, tasks, calendar, CRM entry, settings entry, template/import confirmations, and member selection. Public marketing and Super Admin retain separate frames.

## 2. Product direction
B2BNest is presented as one calm, precise business operating system. The implementation favours dense, scannable information, restrained surfaces, clear hierarchy, and fast actions over decorative dashboard styling.

## 3. Audit method
Reviewed the route tree, shared layout/header, dashboard, project/task/calendar, CRM, finance/invoice, admin, rota, Tailwind configuration, global CSS, shadcn primitives, loading/empty states, responsive patterns, accessibility labels, and tenant-context call paths.

## 4. Findings: shell and navigation
The authenticated app previously reused marketing navigation and page-specific wrappers. Core tools were hidden in menus, route context was weak, and duplicated back buttons depended on browser history.

## 5. Findings: visual consistency
Pages mixed gradients, raw palette colours, large shadows, inconsistent radii, arbitrary container widths, and divergent heading/spacing patterns. Semantic tokens existed but were bypassed widely.

## 6. Findings: hierarchy and density
Large monolithic screens mixed account, finance, documents, and operations. Some areas had excessive cards and whitespace while project controls and tables were cramped. The dashboard lacked a clear daily-operating summary.

## 7. Findings: states and feedback
Loading spinners and empty states were implemented ad hoc. Some failed queries appeared indistinguishable from valid empty data. Shared skeleton and empty-state conventions were underused.

## 8. Findings: responsive behaviour
Fixed multi-column tab bars and wide controls risked overflow below 480px. Repeated mobile navigation existed outside a canonical product shell. Dense tables need progressive row/detail adaptation in later waves.

## 9. Findings: accessibility
Accessible names and focus handling were inconsistent across icon actions. The previous product frame had no skip link. Status colour often carried too much meaning without a shared semantic variant.

## 10. Findings: performance
Large authenticated features are statically imported and several core components exceed 600 lines. Dashboard resources load behind coarse state. Route splitting and smaller loading boundaries remain valuable later work.

## 11. Information architecture
The shell groups existing routes only: Home; Work; Customers; Money; Team; Automate; More; Settings. Super Admin remains separate. No feature was invented or removed by the shell.

## 12. Authenticated app shell
Protected product routes now use one persistent, collapsible left sidebar and compact top bar. Desktop supports expanded/icon modes; smaller screens use the existing sidebar drawer. Public and admin routes keep their established frames.

## 13. Active-company control
The Wave 1 company switcher remains a first-class top-bar control with loading, none, single-company, and multi-company states. It uses `OrganizationContext`; no first-membership fallback was introduced.

## 14. Command and quick actions
Cmd/Ctrl+K opens route and action navigation over existing capabilities. The top-bar Create menu links to existing project, task, event, CRM, invoice, and quote entry points. Company-sensitive writes still validate active membership at the destination.

## 15. Design foundation
Added semantic app-surface and status tokens, restrained radii, Inter/system fallbacks, and neutral/info/success/warning badge variants. Added shared `PageHeader`, `EmptyState`, and skeleton usage while preserving the existing shadcn token model.

## 16. Dashboard modernisation
The dashboard now starts with real active-company project/task metrics, overdue work, user-scoped invoice totals, priority work, activity links, loading skeletons, and a meaningful empty state. Existing documents, billing, and account workflows remain below it.

## 17. Projects, tasks, and calendar
Projects use the shared page frame and support deep links for list, board, calendar, timeline, and creation. Project/task member queries use only the selected active company. Calendar items continue to be tenant-stamped task due dates, not a new ownership model.

## 18. Import and template confirmation
Spreadsheet project import requires a validated active company, displays “Import into”, stamps every project, and fails closed. Both template dialogs display “Create in” and block use without a validated active company.

## 19. Responsive verification
Checked 1440, 1024, and 390 pixel captures and the shell’s existing responsive breakpoints for 1280 and 768. The mobile top bar keeps the drawer, company context, and Create action without page overflow; desktop retains global search. Users can switch preview sizes with the device control above the preview.

## 20. Accessibility verification
The shell includes a skip link, named icon controls, keyboard-operable sidebar, menus and dialogs, visible focus styles, and semantic headings. Mobile truncation preserves control names for assistive technology. Full product-wide WCAG remediation remains a later broad sweep.

## 21. Tenant and security invariants
No auth, billing, HMRC, Stripe, subscription, Super Admin, RLS, or Round 2 boundary was weakened. New company-owned writes call `assertActiveOrganization`; RLS remains authoritative. Switching organizations clears the query cache. Transitional reads retain only the owner-scoped NULL-organization fallback documented for historical records.

## 22. Release boundary and remaining work
This frontend modernisation is separate from the Wave 1 database package and authorizes no production deployment. Historical AINEST, NESTPRO TRADE, and NG TELECOM decisions remain unresolved. Later UI waves may consolidate finance/CRM/settings and route splitting only after separate regression review.
