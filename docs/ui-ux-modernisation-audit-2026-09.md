# B2BNEST UI/UX Modernisation Audit — September 2026

## 1. Executive summary
B2BNEST already contains the beginnings of a strong authenticated product shell: a grouped sidebar, contextual top bar, canonical company switcher, command navigation, quick create, shared page headers, semantic tokens, and responsive drawer. The principal problem is inconsistency. Product routes can still fall back into the marketing header, major modules use independent local patterns, legacy dashboard content competes with operational content, and thousands of raw palette utilities require a broad dark-mode compatibility layer.

UI Wave 1 must therefore consolidate the foundation, not redesign individual tools. The selected direction is a refined product shell: restrained blue/navy identity, white or deep-neutral surfaces, subtle borders, minimal shadows, compact controls, and clear contextual hierarchy.

## 2. Existing UX architecture
- `App.tsx` uses a flat React Router tree under Auth, Organization, UserSettings, Theme, and React Query providers.
- `Layout.tsx` chooses the authenticated `AppShell` or public `Header` from a route-prefix list; `/admin` stays separate.
- `AppShell` provides grouped navigation, responsive/collapsible sidebar, company switcher, Cmd/Ctrl+K navigation, quick create, help, theme, and account controls.
- `OrganizationContext` loads active memberships, validates persisted organization selection, rejects invalid IDs, and clears React Query cache after switching.
- CRM, Projects, Lead Generation, Rota, Settings, Templates, Workflow Studio, and Super Admin each retain substantial local navigation or presentation systems.

## 3. Architecture risks
| Finding | User impact | Commercial impact | Recommendation | Priority |
|---|---|---|---|---|
| Authenticated shell selection is a manually maintained prefix list | Sidebar and company context can disappear on product routes | Lower trust, discoverability, and activation | Keep the current low-risk mechanism for Wave 1 but include confirmed product routes; replace with route metadata later | P0 |
| Marketing and product navigation coexist | Competing mental models | Slower time-to-value | Keep public Header for public pages and AppShell for product destinations | P0 |
| Multiple module-local shells | Product feels fragmented | Lower retention and cross-tool adoption | Normalize page framing progressively in later waves | P1 |
| All routes are eagerly imported | Larger startup bundle | Slower activation on weak devices | Introduce measured route-level lazy loading later | P2 |

## 4. Major-screen inventory

### Dashboard
**Current UX:** Operational, tenant-filtered overview stacked above a large legacy account/marketplace dashboard.  
**Problem:** Two dashboards compete; purchases, downloads, and favourites dilute daily business priorities.  
**User impact:** Weak first-session direction and many zero-value widgets.  
**Commercial impact:** Slower activation and time-to-value.  
**Recommendation:** In UI Wave 2, make operational KPIs, attention items, activity, and actions primary; reposition legacy account history without deleting it.  
**Priority:** P1 — **ACTIVATION, RETENTION, TIME-TO-VALUE**.

### Business Tools
**Current UX:** A 24-item catalogue mixing flagship modules and small utilities.  
**Problem:** Duplicates the sidebar and previously lost the authenticated shell.  
**User impact:** Core modules and utilities appear equal; orientation breaks.  
**Commercial impact:** Lower cross-module adoption and expansion.  
**Recommendation:** Keep it in the product shell now; later focus the catalogue on utilities and progressive discovery.  
**Priority:** P0 — **ACTIVATION, EXPANSION, TIME-TO-VALUE**.

### CRM
**Current UX:** Shared page header plus local tabs and mixed card/table patterns.  
**Problem:** Security is unexpectedly nested under CRM; raw technical errors and debug output reduce polish.  
**User impact:** Harder scanning and confusing settings discovery.  
**Commercial impact:** Trust and retention risk in a core revenue workflow.  
**Recommendation:** UI Wave 3 should establish compact KPIs, filters, data-table conventions, friendly feedback, and a clearer settings boundary.  
**Priority:** P1 — **RETENTION, SUPPORT COST**.

### Projects, tasks, and calendar
**Current UX:** A large multi-view workspace with List, Board, Calendar, Timeline, Goals, and deep-link support; creation is active-company gated.  
**Problem:** Very large component and multiple local patterns; sample-looking local state requires careful product review.  
**User impact:** Dense controls and uncertain hierarchy.  
**Commercial impact:** Slower daily workflows and higher regression risk.  
**Recommendation:** Preserve all tenancy and deep links; modernize view controls, filters, task hierarchy, empty states, and responsive data presentation in UI Wave 3.  
**Priority:** P1 — **ACTIVATION, RETENTION, TIME-TO-VALUE**.

### Settings
**Current UX:** Account, Notifications, and HMRC tabs; reconciliation is a separate sub-route.  
**Problem:** Billing, team, organization, and security concepts are fragmented; UK-specific HMRC receives universal prominence.  
**User impact:** Important controls are hard to locate.  
**Commercial impact:** More support demand and self-service friction.  
**Recommendation:** Reorganize settings IA in UI Wave 5 without changing HMRC, billing, membership, or security logic.  
**Priority:** P1 — **RETENTION, SUPPORT COST, EXPANSION**.

### AI Workspace
**Current UX:** Block workspace with generation and document actions; non-premium users see a paywall.  
**Problem:** Limited opportunity to understand value before upgrading.  
**User impact:** Upgrade decision lacks product evidence.  
**Commercial impact:** Lower conversion.  
**Recommendation:** Later add a safe read-only sample experience, classified OPTIONAL FUTURE.  
**Priority:** P2.

### Workflow Studio
**Current UX:** Dedicated builder with canvas, nodes, configuration, and execution history.  
**Problem:** Visually active actions may not all be implemented.  
**User impact:** Dead clicks damage confidence.  
**Commercial impact:** Conversion and retention risk.  
**Recommendation:** Audit action availability in UI Wave 5; hide or explicitly disable unsupported actions.  
**Priority:** P1 — **CONVERSION, RETENTION, SUPPORT COST**.

### Template Centre
**Current UX:** Strong browse, category, filtering, preview, and apply flow with explicit company destination.  
**Problem:** It previously fell back to marketing navigation.  
**User impact:** Context loss during a high-value activation flow.  
**Commercial impact:** Lower template-to-workspace conversion.  
**Recommendation:** Keep it in the authenticated shell; preserve tenant-private application behavior.  
**Priority:** P1 — **ACTIVATION, TIME-TO-VALUE**.

### Lead Generation
**Current UX:** A local module shell with overview, leads, forms, pages, and import.  
**Problem:** Separate navigation/presentation system and a data-storage model that needs dedicated validation before commercial claims change.  
**User impact:** Fragmented experience; possible multi-device expectation gap.  
**Commercial impact:** Trust and support risk.  
**Recommendation:** Align framing later; investigate persistence separately as a non-UI platform task.  
**Priority:** P0 investigation — **RETENTION, SUPPORT COST**.

### Employee Rota
**Current UX:** Clear employee/schedule tabs, admin gating, and free-tier limit messaging.  
**Problem:** Minor framing inconsistency.  
**User impact:** Feels like a separate mini-app.  
**Commercial impact:** Low.  
**Recommendation:** Preserve access and upgrade logic; align page framing in UI Wave 4.  
**Priority:** P2.

### Super Admin
**Current UX:** Separate guarded admin shell with consistent headers, tables, sheets, and destructive confirmations.  
**Problem:** No material P0/P1 presentation blocker found.  
**Recommendation:** Keep separate and unchanged in UI Wave 1; visual consistency only in UI Wave 6.  
**Priority:** P3 / DO NOT BUILD NOW.

## 5. Cross-cutting component audit
- **Navigation:** Product shell is directionally correct; authenticated route coverage was incomplete.
- **Company context:** Canonical and fail-closed. Never replace membership validation or query-cache clearing.
- **Cards:** Basic elevated container was overused; default should be subtle border with little or no shadow.
- **Buttons:** Functional but needed consistent compact sizing, restrained hierarchy, and stable focus treatment.
- **Tables:** Admin has the strongest shared pattern; customer modules remain inconsistent.
- **Forms:** Large forms need grouping and inline validation in later waves; complex forms must not be forced into small dialogs.
- **Dialogs:** Base dialog needed mobile width, viewport height, and internal scrolling safeguards.
- **Badges:** Semantic variants exist; warning contrast and focus behavior needed refinement.
- **Empty/loading states:** Shared primitives exist but adoption is inconsistent.
- **Toasts:** Two systems existed while Sonner calls had no mounted renderer; this is a feedback reliability defect.

## 6. Market-leader principles applied
- Persistent product navigation with progressive grouping rather than a wall of 25 tools.
- Contextual top bar, not duplicated product navigation.
- Search as navigation/actions first; no insecure tenant-wide data search.
- One visually dominant action per context.
- Compact, scannable operational density.
- Subtle surfaces and borders instead of gradients or heavy elevation.
- Predictable empty, loading, validation, and feedback behavior.

## 7. New information architecture
```text
Authenticated product
├── Overview: Dashboard
├── Work: Projects, Tasks, Calendar, Goals
├── Customers: CRM, Lead Generation
├── Money: Invoices & Quotes, Finance
├── Team: Employee Rota
├── Automate: AI Workspace, Workflows
├── More: Templates, Business Tools
└── Utility: Help, Settings, Profile

Separate: Public marketing site
Separate: Super Admin
```
Unassigned-project reconciliation remains available under Work during the Wave 1 stabilization period.

## 8. Authenticated shell and navigation design
- Calm light surface sidebar with subtle border; deliberate deep-neutral dark equivalent.
- Persistent desktop navigation, icon collapse, keyboard toggle, and mobile drawer.
- Group labels support scanning; active state uses a restrained primary tint.
- Public marketing navigation remains isolated.
- Template Centre and Business Tools retain the product shell for authenticated workspace continuity.

## 9. Top-bar design
- Left: navigation trigger and visibly validated active company.
- Right: navigation command, Create, AI shortcut, notifications placeholder, help, and profile.
- Controls collapse progressively on smaller screens; company context remains visible.
- Cmd/Ctrl+K remains limited to pages and safe deep-linked actions.

## 10. Company switcher treatment
The switcher remains membership-backed and fail-closed. Loading, no-company, single-company, and multi-company states remain explicit. Switching must continue clearing React Query cache. No UI element may infer, guess, or silently substitute an organization.

## 11. Design tokens
Semantic roles: background, foreground, card/surface, surface-subtle, border, input, primary, success, warning, danger, info, focus, and sidebar-specific roles. Light mode uses soft neutral workspace background with white working surfaces; dark mode uses deep neutral navy surfaces. Existing raw-color dark-mode overrides remain a compatibility shim, not a model for new work.

## 12. Typography and spacing
Inter/system remains the operational typeface. Page titles are 28px maximum on desktop, section headings 18–20px, card headings 14–16px, body 14px, and metadata 12–13px. Spacing favors 16/20/24px content rhythms, 40px controls, and restrained line heights.

## 13. Card, button, table, and form standards
- Cards: 8px radius, subtle border, minimal shadow by default, stronger treatment only when interactive.
- Buttons: 40px default, clear primary/secondary/outline/ghost/destructive hierarchy, visible focus, stable icon gaps.
- Tables: shared toolbar, aligned columns, row actions, loading and purposeful empty states; bulk actions only when permissions support them.
- Forms: persistent labels, grouped sections, nearby errors, clear required state, full pages for complex workflows.

## 14. Dashboard recommendation
In UI Wave 2, present greeting/company context, core KPIs, attention required, recent activity, quick actions, then useful insight. Legacy marketplace metrics should be repositioned, not deleted.

## 15. Mobile strategy
Desktop sidebar collapses; tablet/mobile use an accessible drawer. The top bar keeps the company selection and primary create action visible while lower-priority shortcuts progressively hide. Data tables should choose horizontal scrolling or compact row summaries per workflow, not compress unreadably.

## 16. Accessibility findings
- Preserve skip link, semantic navigation, keyboard sidebar and Cmd/Ctrl+K behavior.
- Normalize focus-visible treatments.
- Ensure icon-only controls have accessible names.
- Add descriptions to dialogs during their owning feature wave.
- Base dialogs must fit and scroll within mobile viewports.
- Warning color required a small light-mode contrast correction.

## 17. Performance findings
The flat eager route graph increases initial bundle cost; route-level lazy loading is recommended after the shell stabilizes. Avoid broad animation libraries, large icon imports, duplicated queries, and speculative memoization. UI Wave 1 adds no animation or data fetching.

## 18. Feature classification
- **REQUIRED FOR UX NOW:** authenticated shell continuity, visible company context, responsive navigation, semantic primitives, reliable toasts.
- **OPTIONAL FUTURE:** tenant-scoped entity search, saved CRM views, AI sample workspace, route lazy loading.
- **DO NOT BUILD NOW:** new business modules, unsupported bulk actions, cross-tenant search, business-logic rewrites.

## 19. Implementation waves
1. **UI Wave 1:** Tokens, shell, navigation, top bar, switcher presentation, typography, buttons, cards, dialogs, responsive foundation.
2. **UI Wave 2:** Operational dashboard and legacy-content repositioning.
3. **UI Wave 3:** CRM, Projects, Tasks, Calendar.
4. **UI Wave 4:** Finance, Invoices, Quotes, Team, Rota.
5. **UI Wave 5:** AI, Workflows, Integrations, Settings, remaining tools.
6. **UI Wave 6:** Super Admin visual consistency only.

## 20. Risks and controls
- **Tenant regression:** freeze `OrganizationContext` and data-query logic; verify switch clearing and company visibility.
- **Route-shell drift:** test all product prefixes; replace the duplicated route model later.
- **Legacy colors:** keep compatibility CSS and prohibit new raw palette usage in Wave 1 files.
- **Scope creep:** no page-level feature redesign or backend changes.
- **Release collision:** preview only; do not combine with the pending validated Wave 1 application publish.

## 21. Recommended next step
Complete UI Wave 1 preview validation and visual review. Only after explicit approval and the separate Wave 1 application publish should a UI release be considered.
