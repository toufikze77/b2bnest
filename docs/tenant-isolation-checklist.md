# B2BNest tenant isolation — security test checklist

Security model in use (unchanged by this upgrade):

- Ownership is established per row by `user_id` on most business tables.
- Tenant-scoped tables (`projects`, `hmrc_*`, `rota_*`, `job_postings`, `organization_*`) additionally carry `organization_id`
  and use security-definer helpers (`user_is_organization_member`, `user_can_access_project`, `is_project_member`, `owns_team`).
- Platform administration is gated by `public.is_super_admin(auth.uid())` inside every `admin_*` security-definer function.
  There is no generic "authenticated bypasses RLS" policy.
- RLS is enabled on every table in `public`. The only `USING (true)` SELECT policies are on deliberately public content:
  `forum_posts`, `forum_replies`, `news_articles`, `advertisement_categories`, `platform_plans`/`platform_tools`/`platform_settings`.

## Manual test matrix

Prepare: Company A (owner A1, member A2), Company B (owner B1, member B2), one Super Admin.

| # | Signed in as | Attempt | Expected |
|---|---|---|---|
| 1 | A2 | `select * from crm_contacts` (B rows) | 0 rows |
| 2 | A2 | `select * from projects where organization_id = <B>` | 0 rows |
| 3 | A2 | `select * from invoices` / `quotes` / `bills` / `expenses` (B rows) | 0 rows |
| 4 | A2 | `select * from todos` (B tasks) | 0 rows |
| 5 | A2 | `select * from ai_conversations` / `ai_workspaces` (B rows) | 0 rows |
| 6 | A2 | `select * from documents` (B files) | 0 rows |
| 7 | A2 | `update`/`delete` any B row by id | 0 rows affected |
| 8 | B2 | Same attempts against Company A | 0 rows |
| 9 | A1 (owner) | Read Company B organisation / members | 0 rows |
| 10 | A1 with company role ADMIN | Read Company B data | 0 rows |
| 11 | A2 (member) | `rpc('admin_list_companies')` | error `Not authorized` |
| 12 | A1 (owner) | `rpc('admin_company_detail', …)` | error `Not authorized` |
| 13 | Super Admin | `rpc('admin_list_companies')`, `admin_company_detail`, `admin_set_company_status` | succeeds, writes `admin_audit_logs` |
| 14 | Anonymous | Any `admin_*` RPC | error `Not authorized` |

## Roles

- Platform: `SUPER_ADMIN` (`user_roles.role = 'super_admin'`) — only role that can reach `/admin`.
- Customer: `COMPANY_OWNER` (`organizations.created_by`), `ADMIN`, `MEMBER` (`organization_members.role`).
- Customer roles never grant platform administration.

## Audit log

`admin_audit_logs` records admin id/email, action, target type/id, details and timestamp for:
company suspended/reactivated/updated, user suspended/reactivated, user role changed, plan changes, exports.

## Known gaps / future features

- Customer self-service business data export: not built (deliberately out of scope for this step).
- Per-tenant storage quota enforcement and business-tool usage counters: displayed as
  "Not currently tracked" where no metric exists.
- Some tables scope by `user_id` only; a user leaving a company retains their own rows.
