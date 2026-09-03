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
