# Super Admin multi-tenant upgrade — status

- [x] Inspect existing schema, auth, roles, RLS (no new architecture introduced)
- [x] Additive migration: `organizations.status/suspended_at/suspension_reason`
- [x] Admin RPCs: `admin_list_companies`, `admin_company_detail`, `admin_set_company_status`,
      `admin_update_company`, enriched `admin_list_users`, extended `admin_overview_stats`
- [x] Drop superseded function overloads (PostgREST ambiguity fixed)
- [x] `/admin/companies` list + `/admin/companies/:id` detail (overview, users, subscription, usage, activity, security)
- [x] `/admin/users`: company, company role, plan filter, last login, suspend/reactivate, role change
- [x] Dashboard cards: trial / suspended / cancelled / new companies, MRR + ARR
- [x] Tenant isolation checklist: `docs/tenant-isolation-checklist.md`
- [x] Verified: anonymous + non-admin calls to admin RPCs return `Not authorized`; super admin calls succeed
- [ ] Customer self-service data export (deliberately not built)

# Wave 1 final blockers and product UI modernisation audit

- [x] Prepare fail-closed deterministic reconciliation for B2BNEST and AI NEST (staging/package only)
- [x] Keep AINEST unresolved while preserving owner-only transitional access
- [x] Prepare, but do not execute, future NESTPRO TRADE and NG TELECOM LTD operations
- [x] Verify every project import and template path uses the validated active company
- [x] Expand multi-company import/template/tamper regression coverage and rerun the full staging suite
- [x] Complete authenticated product UI/UX, responsive, accessibility, and performance audit
- [x] Write the UI modernisation audit and separate Wave A–D implementation plan
- [x] Confirm no production database, organisation, project, task, or deployment changes

# UI/UX modernisation — UI Wave 1 preview

- [x] Complete repository and major-screen UX audit
- [x] Select refined product-shell direction
- [x] Implement semantic shell and shared primitive refinements
- [x] Preserve company switching and cache isolation; verify via staging suite and source review
- [x] Validate Dashboard, CRM, and Projects at requested viewports
- [x] Run regression/security checks and write staging validation report
- [x] Publish the exact final blocker report and canonical 32-section UI audit
- [x] Remove multi-company first-membership fallback and validate core mobile overflow
- [ ] Production publish (blocked by explicit prohibition; separate authorization required)

# Post-Wave-1 product experience / UI modernization (backlog — not authorized)

- [x] Deep codebase UI audit and 30-section report: `docs/ui-ux-modernization-audit-2026-09.md`
- [ ] Wave 1 operational completion first: publish validated build; assign 3 unassigned projects; review 4 mismatched tasks; production smoke test; freeze Wave 1
- [ ] UI Wave 1 — Foundation completion (tokens, page surface, sidebar IA fixes, breadcrumbs, notifications, route lazy loading)
- [ ] UI Wave 2 — Activation (dashboard consolidation, needs-attention, first-run checklist, empty/loading/error families)
- [ ] UI Wave 3 — Work & customers (projects views, tasks, calendar, CRM table + side panel)
- [ ] UI Wave 4 — Money & insights (invoices/quotes consolidation, finance tables, analytics)
- [ ] UI Wave 5 — Scale (AI Studio, integrations, team, settings, admin token alignment)
- [ ] Constraint: Wave 1 tenant architecture and Round 2 controls frozen; each wave gated by 642 PASS / 0 FAIL and five-width visual checks
