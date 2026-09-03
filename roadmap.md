# Roadmap — Super Admin multi-tenant upgrade

- [x] Inspect existing schema, roles, RLS, admin RPCs
- [x] Migration: company status, company detail/list/update RPCs, users + stats upgrades
- [x] Companies list (search, plan/status filters, view/suspend/reactivate)
- [x] Company detail screen (overview, users, subscription, usage, activity, security)
- [ ] Users page: company, last login, plan filter, view/edit/suspend
- [ ] Dashboard metrics: trial/suspended/cancelled companies, ARR, new companies
- [ ] Register /admin/companies/:id route
- [ ] Tenant isolation test checklist doc
- [ ] Typecheck + build verification, KEEP/CHANGE/MISSING/RISK report
- [ ] Future feature (not built now): customer self-service data export
