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
