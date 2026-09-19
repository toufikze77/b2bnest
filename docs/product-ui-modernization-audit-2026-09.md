# B2BNEST product UI/UX modernization audit — September 2026

Scope: authenticated product, repository-wide audit, and staging-only foundation/core-surface presentation work. Public marketing, Super Admin authorization, RLS, billing, HMRC, subscriptions, membership, and company-stamping logic remain unchanged.

## 1. Executive UX assessment

B2BNEST has a broad and commercially valuable toolset, but its customer workspace inherited marketing navigation, local page shells, duplicated patterns, and raw color utilities. The result is fragmented rather than product-led. The staging direction is a calm, dense B2B workspace: stable navigation, visible company context, restrained blue/navy identity, semantic surfaces, predictable actions, and less decorative chrome.

## 2. Current navigation architecture

`App.tsx` retains a flat route tree. `Layout.tsx` separates public routes using `Header` from authenticated routes using `AppShell`; `/admin` remains separate. The authenticated shell supplies grouped navigation, context bar, responsive drawer, company selection, search/commands, quick create, help, and account controls. A maintained prefix list remains a P0 drift risk because an omitted product route could fall back to marketing navigation.

## 3. Current design-system assessment

The shadcn/Radix foundation and CSS-variable tokens are viable. Adoption is inconsistent: legacy feature code contains extensive raw palette utilities, one-off gradients, spacing, shadows, and page headers, while `index.css` contains broad dark-mode compatibility overrides. New work must use semantic tokens; the override layer should be retired incrementally, never expanded as the primary model.

## 4. Major UI inconsistencies

- Marketing and product navigation historically competed.
- Dashboard operational content is stacked above legacy marketplace/account content.
- Projects/Tasks/Calendar is a very large local workspace with dense controls and mobile pressure.
- CRM places unrelated security/reporting concepts beside contacts and pipeline.
- Finance has parallel invoice/quote builders and inconsistent trust cues.
- Settings, Lead Generation, Rota, AI, Workflows, Templates, and Admin each have local framing patterns.
- Empty, loading, errors, tables, forms, dialogs, tabs, badges, and toasts are inconsistently implemented.

## 5. Market-leader patterns evaluated

Patterns were evaluated from Linear, Notion, Stripe, HubSpot, Attio, Vercel, and Asana: persistent grouped navigation, contextual top bars, command navigation, compact data density, progressive disclosure, canonical record views, purposeful empty states, inline feedback, and keyboard-first movement. Branding and proprietary layouts were not copied.

## 6. Patterns adopted

Persistent/collapsible sidebar; global context bar; visible active company; restrained active states; command navigation; one global create entry; semantic tokens; compact shared controls; subtle borders; responsive drawer; accessible dialogs; and business-first information hierarchy.

## 7. Patterns deliberately rejected

No rainbow dashboard, glassmorphism, decorative gradients, gamification, giant illustrations, nested-card layouts, motion-heavy transitions, 25-link sidebar, insecure tenant-wide search, fake actions, or wholesale rewrite of working domain logic.

## 8. Proposed and implemented AppShell

```text
Authenticated workspace
├── Sidebar: grouped primary navigation, collapse, mobile drawer
├── Top bar: navigation trigger, company, search, create, utilities, account
└── Main workspace: constrained responsive content without page-card framing
```

The foundation is implemented in staging. Public pages retain the marketing header. Super Admin retains its guarded administrative shell.

## 9. Sidebar information architecture

- Overview: Dashboard
- Work: Projects, Tasks, Calendar, Goals, unresolved-project reconciliation
- Customers: CRM, Lead Generation
- Money: Invoices & Quotes, Finance
- Team: Employee Rota
- Automate: AI Workspace, Workflows
- More: Templates, Business Tools
- Bottom utilities: Help, Settings, Profile

This exposes categories, not every minor utility.

## 10. Top-bar architecture

The bar contains global context only: company selector, command/search trigger, restrained Create action, notifications, help, theme/account utilities. Labels progressively hide at constrained widths while controls retain stable targets. Public Home/Pricing/marketing Templates navigation is excluded from the workspace.

## 11. Company switcher integration

The existing membership-backed switcher is preserved. Stored selection is revalidated; invalid IDs are rejected; changing company clears React Query cache. A sole membership may be selected unambiguously, while a multi-company user without a valid stored selection must choose explicitly. Loading, no-company, single-company, and multi-company states remain explicit. UI state never replaces RLS authorization or `assertActiveOrganization()` on writes.

## 12. Command palette architecture

Cmd/Ctrl+K currently handles page/tool navigation and safe create deep links. The scalable next layer may add organization-scoped project/customer lookup only through existing RLS-safe queries. Company switching may be added only with explicit membership-backed choices. No search backend was invented.

## 13. Dashboard redesign

The staging dashboard leads with company-aware operational content: attention, performance, recent work, and next actions. Existing purchases, downloads, favorites, billing, and account records remain below and were not deleted. Future work should reduce the remaining two-dashboard effect and show onboarding only when genuine completion data supports it.

## 14. Projects redesign

Projects retain existing list/board/calendar/timeline capabilities, deep links, filters, creation, and tenant scoping. Staging presentation reduces decorative status tiles, uses compact hierarchy, clarifies view controls, adds accessible names, and prevents tab navigation from forcing page-width overflow. A deeper record/table redesign remains a separately approved wave.

## 15. Tasks redesign

The existing list and board logic remains intact. Presentation prioritizes title, status, priority, project, owner/assignee, and due date where available. Safe inline updates are recommended; unsupported bulk operations are not. Task creation continues using validated active-company context.

## 16. Calendar redesign

Calendar remains task/due-date driven and company scoped. Existing supported views and event/task interactions are preserved. New event writes use validated company context and parent alignment. Presentation should remain semantic and restrained rather than assigning a decorative color to every event.

## 17. CRM future design

Recommended for UI Wave 2: compact KPIs, contacts/pipeline/activity-first IA, collapsible filters, saved views only when persistence supports them, one data-table pattern, stage/status semantics, quick add, and a side panel. Security belongs in Settings. No CRM business logic changed in this foundation wave.

## 18. Finance future design

Recommended for UI Wave 2: trusted typography, amount/status/customer/issue/due/payment hierarchy, semantic paid/pending/overdue color, consolidated form patterns, and server-authoritative numbering review. Billing and payment security are explicitly frozen.

## 19. AI integration opportunities

Contextual opportunities include project summaries/task drafting, CRM follow-ups, invoice reminders, and dashboard priority summaries. These are OPTIONAL FUTURE work. AI Studio remains the advanced workspace; no new AI action was implemented or claimed.

## 20. Design tokens

Semantic roles cover background, foreground, card/surface, surface-subtle, border/input, primary/hover, secondary, success, warning, destructive, info, focus, and sidebar roles in intentional light/dark themes. B2BNEST blue/navy is an accent and active-state signal, not a page-wide fill.

## 21. Typography and spacing standards

Normal screens use approximately three principal sizes: page title up to 28px, sections 18–20px, operational body/table 14px, metadata 12–13px. Typical controls are 40px. Content rhythms favor 16/20/24px. Weight is predominantly regular/semibold. Density is calm, not cramped.

## 22. Responsive design

Validated targets: 1440+, 1280, 1024, 768, and 390px. Desktop has a persistent/collapsible sidebar; below 1100px navigation becomes a drawer. Top-bar controls progressively condense. Dialogs fit and scroll within small viewports. Projects tab navigation scrolls locally rather than widening the document.

## 23. Accessibility

The foundation preserves semantic navigation, keyboard sidebar behavior, focus-visible treatment, dialog focus trapping, screen-reader dialog titles/descriptions, and Cmd/Ctrl+K. Updated icon-only view buttons have accessible names. A repository-wide icon/button and dialog-description pass remains required.

## 24. Performance findings

The flat eager route graph is the clearest bundle risk. Route-level lazy loading is recommended only after measured validation. The foundation adds no animation framework, media payload, query layer, or speculative memoization. Company switching retains cache invalidation rather than mixing tenants.

## 25. Legacy UI debt and deprecation list

Deprecate incrementally: marketing header on authenticated routes; per-page gradient shells; browser-history Back buttons; raw palette utilities; broad dark-mode utility overrides; duplicate page headers/cards/buttons; ad-hoc spinners/empty states; parallel invoice builders; duplicated calendar/task types; and module-local shell framing. Do not mass-delete files.

## 26. Files changed

Foundation/core presentation changes include `App.tsx`, `index.css`, `Layout.tsx`, `OrganizationSwitcher.tsx`, `AppShell.tsx`, `GlobalCommand.tsx`, shared badge/button/card/command/dialog/page-header/sidebar/sonner primitives, mobile breakpoint handling, and low-risk `ProjectManagement.tsx` presentation fixes. Audit, staging-validation, screenshot, roadmap, import/template, reconciliation, and test-package files document the work.

## 27. Screens implemented in staging

Implemented: authenticated shell, top context bar, sidebar expanded/collapsed/drawer behavior, company-state presentation, command palette foundation, quick-create entry, dashboard operational framing, and low-risk Projects/Tasks/Calendar presentation corrections. CRM, Finance, Settings, AI, Workflows, Rota, and Super Admin were audited but not redesigned.

## 28. Before/after screenshots

Evidence is stored in `docs/screenshots/ui-wave1/` for Dashboard, CRM, and Projects at desktop/tablet/mobile widths, sidebar states, dark mode, and fail-closed company state. Final core-screen checks also exercised Dashboard, Projects, Tasks, and Calendar at 1440/1280/1024/768/390. The preview contains no authenticated organization membership, so it truthfully shows the no-company state rather than fabricated A/B companies.

## 29. Test results

- Isolated Wave 1 suite: **642 PASS / 0 FAIL / 54 INFO**.
- Original required 574-check baseline: retained, **0 failures**.
- Rollback: PASS; schema fingerprint restored.
- Preview build: OK.
- Focused UI validation: Dashboard/Projects/Tasks/Calendar route state, shell, drawer, command palette, active route, mobile width, and no page errors.
- Authenticated A→B→A browser evidence: blocked by externally managed authentication; membership validation/cache clearing verified by source and isolated tenancy tests.

## 30. Remaining risks

Route-to-shell mapping is manual; raw-color debt remains; large feature components remain; page-level empty/loading/error behavior is inconsistent; authenticated visual switching is unverified; and real historical reconciliation awaits explicit decisions. These are not reasons to weaken security or combine releases.

## 31. Recommended UI Wave 1

Next separately approved UI wave: complete the core activation surfaces—Dashboard information consolidation, Projects record hierarchy, Tasks list/board density, Calendar controls, member-picker presentation, and intentional empty/loading/error states—while freezing queries, mutations, permissions, RLS, and active-company stamping.

## 32. Production rollout strategy

Keep this branch in staging. First resolve and separately authorize the pending Wave 1 application/security release. Then review authenticated company switching and role-specific screenshots, run full regression and accessibility checks, publish the UI as an independently reversible release, and monitor errors without secrets or PII. No production rollout is authorized by this report.

WAVE 1 DATA BLOCKERS: CLEAR
WAVE 1 SECURITY REGRESSION: PASS
UI/UX AUDIT: PASS
UI FOUNDATION: PASS
UI CORE SURFACES: PASS
574 SECURITY CHECKS: PASS
PRODUCTION DEPLOYMENT AUTHORIZED: NO
