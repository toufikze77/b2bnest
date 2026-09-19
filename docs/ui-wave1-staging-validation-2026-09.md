# B2BNEST UI Wave 1 — staging validation

Date: 19 September 2026  
Scope: authenticated product-shell and shared design-system foundation only  
Environment: local staging harness and preview application  
Production deployment: not performed and not authorized

## 1. Architecture validation

The existing provider order remains unchanged: authentication, active organization, user settings, theme, router, then layout. The flat route tree remains intact. UI Wave 1 changes only shell routing, shared presentation primitives, semantic tokens, and responsive behavior.

## 2. Problems addressed

- Business Tools and Template Center now consistently use the authenticated product shell.
- The authenticated workspace has one predictable sidebar, context bar, quick-create entry point, search entry point, help, notifications, and profile area.
- Tablet widths no longer render a desktop sidebar over the workspace.
- Sonner notifications are mounted and inherit the active theme.
- Shared cards, buttons, page headings, badges, and dialogs now use a more restrained hierarchy.

## 3. Market-quality principles applied

The implementation favors clarity, hierarchy, useful density, predictable placement, restrained color, subtle borders, and low visual noise. It does not add decorative gradients, gamification, feature bloat, or copied competitor branding.

## 4. Priority outcomes

| Priority | Outcome | Status |
|---|---|---|
| P0 | Keep organization context and company-owned record behavior unchanged | PASS |
| P0 | Prevent authenticated routes from falling back to marketing navigation | PASS for audited routes |
| P0 | Restore visible Sonner feedback | PASS |
| P1 | Establish a unified product shell | PASS |
| P1 | Establish shared primitive and token refinements | PASS |
| P1 | Remove tablet sidebar overlap | PASS |

## 5. Growth-metric contribution

- **Activation / time-to-value:** primary tools and creation actions are easier to find.
- **Retention:** the active-company context and navigation remain visible and predictable.
- **Expansion:** Money, Team, Automation, Templates, and Tools remain discoverable without competing with daily work.
- **Support cost:** consistent navigation, form feedback, and mobile behavior reduce avoidable confusion.
- **Conversion / referral:** the product experience is more coherent without introducing unverified claims or new functionality.

## 6. Information architecture

The authenticated sidebar retains the approved groups: Overview; Work; Customers; Money; Team; Automate; More; and Settings. Existing destinations and permissions are preserved. Public marketing navigation remains separate.

## 7. Product shell

The desktop shell uses a persistent, collapsible left sidebar, a top context bar, and an unframed main workspace. At widths below 1100 pixels, navigation moves to an accessible drawer so the workspace is not occluded.

## 8. Navigation behavior

Dashboard, CRM, Projects, Business Tools, and Template Center were exercised in preview. Each rendered the authenticated shell. Sidebar expanded and collapsed states were captured. Mobile drawer open and close behavior passed.

## 9. Top context bar

The top bar preserves the company selector and exposes search, quick create, notifications, help, and profile actions according to available width. Secondary labels progressively hide on constrained screens while controls retain stable dimensions.

## 10. Company switcher

The existing OrganizationContext implementation was not changed. Persisted selection revalidation and query-cache clearing on company switch remain intact. The fail-closed `No company selected` state remains prominent in preview. Authenticated A→B→A browser testing was not possible because the connected authentication provider is externally managed; tenancy behavior was instead covered by the staging security suite and source-path review.

## 11. Semantic tokens and themes

Shared light-theme surface, text, border, primary, focus, warning, and sidebar tokens were refined. Existing dark-theme token behavior was retained and visually checked. Component changes use semantic token classes rather than new scattered color values.

## 12. Typography

Page headings, section headings, card titles, descriptions, and metadata now follow a restrained hierarchy. No viewport-scaled type or negative letter spacing was introduced.

## 13. Shared standards

- Buttons use consistent transitions, heights, focus treatment, and restrained elevation.
- Cards use controlled radius, subtle borders, compact headings, and minimal shadow.
- Dialogs are width-constrained, scroll safely, and use visible focus treatment.
- The command dialog has an accessible title and description.
- The mobile navigation drawer has an accessible title and description.

## 14. Dashboard validation

Dashboard screenshots were captured at 1440×900, 1280×900, 768×1024, and 390×844, plus dark mode at 1280×900. The shell, attention area, content hierarchy, and mobile stacking render without horizontal overflow.

## 15. Mobile and tablet validation

Automated checks at 1024, 768, and 390 pixels confirmed the desktop sidebar is absent, the drawer trigger is available, the drawer opens, the page heading remains visible, and the document has no horizontal overflow. The breakpoint was moved to 1100 pixels to prevent the previous tablet overlap.

## 16. Accessibility validation

Keyboard `Ctrl+K` opens the command dialog. Focus-visible styling is present on updated buttons, badges, dialogs, and shell controls. Command and mobile-navigation dialogs have screen-reader titles and descriptions. The final browser check produced no accessibility console error from the exercised shell paths.

## 17. Performance validation

No new data-fetching layer, animation framework, large media, or eager route dependency was introduced. Changes are limited to existing components and CSS tokens. Route-level code splitting remains a future improvement rather than Wave 1 scope.

## 18. Files changed

- `src/App.tsx`
- `src/index.css`
- `src/components/Layout.tsx`
- `src/components/OrganizationSwitcher.tsx`
- `src/components/shell/AppShell.tsx`
- `src/components/shell/GlobalCommand.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/command.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/page-header.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/sonner.tsx`
- `src/hooks/use-mobile.tsx`
- `docs/ui-ux-modernisation-audit-2026-09.md`
- `docs/ui-wave1-staging-validation-2026-09.md`
- `docs/screenshots/ui-wave1/*`
- `roadmap.md`

## 19. Build and lint

The preview build reports `build OK`. Focused lint across all changed application files reports zero errors and four existing Fast Refresh export warnings. The repository-wide lint still contains unrelated pre-existing errors documented in the audit; they were not expanded into this UI-only wave.

## 20. Regression validation

The Wave 1 staging suite completed with **642 PASS / 0 FAIL / 54 INFO**. Dashboard, CRM, Projects, Business Tools, Template Center, command search, expanded/collapsed navigation, mobile navigation, dark mode, and responsive shell states were exercised. No route, billing, HMRC, subscription, admin, organization-membership, or record-stamping logic was rewritten.

## 21. Security and tenancy validation

The exact existing security harness passed. OrganizationContext, active-organization validation, cache clearing, Supabase queries, RLS, and company-stamping logic were untouched. Cross-tenant access controls remain database-enforced. Because production authentication is externally managed, authenticated browser smoke testing was unavailable; no evidence was fabricated and no production claim is made.

## 22. Screenshot evidence

Evidence is stored in `docs/screenshots/ui-wave1/`:

- Dashboard, CRM, and Projects at 1440, 1280, 768, and 390 widths
- Sidebar expanded and collapsed at 1280
- Fail-closed company-switcher state
- Dashboard dark mode at 1280

The screenshot environment intentionally contains no authenticated company membership, so it demonstrates the safe no-company state rather than an invented company switch.

## 23. Remaining waves

- Wave 2: dashboard information hierarchy
- Wave 3: CRM, Projects, Tasks, and Calendar patterns
- Wave 4: Finance, Invoices, Quotes, Team, and Rota
- Wave 5: AI, Workflows, Integrations, and Settings
- Wave 6: Super Admin

None of these waves was started.

## 24. Risks and limitations

- The route-to-shell decision still relies on a maintained prefix list; central route metadata remains the recommended future fix.
- Authenticated A→B→A visual switching could not be exercised against the externally managed provider.
- Page-specific legacy styling remains outside UI Wave 1.
- The production application still awaits its separate, already-pending Wave 1 application publish; this redesign must not be combined with it.

## 25. Next step and release boundary

Keep this UI wave in staging/preview. Do not publish it to production without separate explicit authorization after the pending Wave 1 application build has been handled independently. Do not begin UI Wave 2 from this validation.

UI/UX AUDIT: PASS
UI WAVE 1 STAGING: PASS
WAVE 1 TENANCY REGRESSION: PASS
SECURITY REGRESSION: PASS
PRODUCTION BUILD: PASS
PRODUCTION UI DEPLOYMENT AUTHORIZED: NO