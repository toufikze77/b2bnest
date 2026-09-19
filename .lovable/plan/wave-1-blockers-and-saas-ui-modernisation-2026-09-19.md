# Wave 1 Blockers and SaaS UI Modernisation

## Outcome

Complete the three Wave 1 blockers in isolated staging, then modernise only the shared authenticated foundation and the Dashboard, Projects, Tasks, Calendar, and member-selection surfaces. Production data, schema, organizations, projects, tasks, and deployment remain untouched.

## 1. Close Wave 1 blockers

- Preserve the corrected historical inventory: five unresolved projects, not the earlier three. Prepare deterministic B2BNEST and AI NEST mappings only; keep AINEST unresolved; keep NESTPRO TRADE and NG TELECOM LTD as separately authorised future operations.
- Preserve owner-only access to unresolved legacy records while every new company-owned write fails closed without a validated active company.
- Show the selected company in project-import confirmation and both template-application dialogs.
- Validate the active membership before import/template creation and stamp parent and child records with the same company. Keep RLS authoritative.
- Extend isolated staging checks for valid, missing, stale, tampered, cross-company, multi-company, and parent/child cases.

## 2. Build the shared authenticated foundation

- Reuse the existing sidebar, command, button, form, dialog, table, badge, and skeleton primitives.
- Split public marketing pages from protected product pages without changing authentication or route URLs.
- Add one responsive authenticated shell: collapsible desktop sidebar, mobile drawer, contextual top bar, visible company switcher, search/command access, quick create, AI, notifications/help, profile, breadcrumb, and page action area.
- Use actual existing destinations grouped as Home, Work, Customers, Money, Team, Automate, Insights, More, and Settings. Keep Super Admin separate.
- Add semantic surface/status/focus tokens and shared page-header, empty-state, loading, badge, form, and table patterns. Preserve the B2BNest blue/navy identity and current theme support.
- Ensure company switching clears tenant-sensitive cached data and protected searches/actions consume the current company context.

## 3. Modernise Wave 1 work surfaces

- Dashboard: create a restrained operational overview using only real data, attention items, upcoming work, activity, and existing quick actions.
- Projects and Tasks: retain all current capabilities while simplifying page chrome, filters, list/board/calendar controls, statuses, due dates, ownership, and empty/loading states.
- Calendar: align its page structure and status semantics with Projects/Tasks while preserving company isolation.
- Member picker: show only members of the active company and use consistent loading, empty, and validation states.
- Keep historical unresolved owner records visible through the documented transitional path; never use it for new writes.

## 4. Responsive, accessibility, and performance validation

- Verify the authenticated experience at 1440, 1280, 1024, 768, and 390 widths.
- Check navigation, company switching, dialogs, overflow, light/dark themes, keyboard access, visible focus, labels, tooltips, touch targets, reduced motion, empty/loading/error states, and console/runtime errors.
- Add compatible route-level lazy loading where it does not destabilise routing. Avoid new heavy UI dependencies and unnecessary animation.

## 5. Quality and security gates

- Run TypeScript, configured lint, preview build checks, route/navigation checks, and browser visual verification.
- Rebuild isolated staging and run the complete security regression exactly once, including all new blocker checks; require zero failures.
- Validate rollback equivalence and package reapplication. Do not execute reconciliation files or write to production.

## 6. Documentation and final report

- Create `docs/ui-ux-modernisation-2026-09.md` with the requested audit, architecture, implementation, screenshots/viewport results, accessibility/performance findings, changed files, tests, remaining screens, and Phase 3 recommendation.
- Update the Wave 1 production pre-flight and blocker report with factual historical counts, import/template resolution, exact test totals, remaining business decisions, and deployment recommendation.
- Report the exact requested final status lines. Production deployment remains a separate authorisation.
