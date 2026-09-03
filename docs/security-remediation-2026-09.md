# B2BNest security remediation — 2026-09

Implements the seven fixes recommended in `docs/security-audit-2026-09.md`. No product features, pricing, UI or
unrelated business logic were changed. No data was deleted and no test accounts were created.

## A. Migrations / files changed
- Migration 1: function hardening, grant/revoke tightening, tenant-scoped RLS rewrite, `user_roles` escalation guard.
- Migration 2: removed leftover `PUBLIC`/`anon` EXECUTE on `check_trial_status`, `preview_user_emissions`,
  `create_team_with_owner`.
- `docs/security-remediation-2026-09.md` (this file).
- No application/TypeScript source changes were required; all callers already use the correct client
  (`create_payment_record` / `update_payment_status` are only called by the Stripe edge functions with the service role,
  `check_and_deduct_ai_credit` only by `ai-assistant` with the service role).

## B. Functions changed
| Function | Change |
|---|---|
| `users_share_organization(uuid,uuid)` | **New** helper (definer, `search_path ''`): do two users share an active organization? |
| `add_project_member` | Requires `auth.uid()`; caller must own the project or be an admin of its organization; target user must belong to the same tenant; otherwise `Not authorized`. Removed the reference to a non-existent `updated_at` column. |
| `add_team_member` | Requires `auth.uid()`; caller must be the team owner; target user must share an organization with the caller. |
| `get_user_projects` | Only the user themself or a super admin may query; duplicate rows removed. |
| `get_user_teams` | Same self/super-admin restriction. |
| `get_team_members_with_profiles` | Caller must own or belong to the team; email/name is no longer retrievable for arbitrary teams. |
| `check_and_deduct_ai_credit` | Only the account owner or the server (service role) may deduct; credit amount validated. |
| `create_payment_record` | Service-role only, enforced in-function **and** by grants. |
| `update_payment_status` | Service-role only, enforced in-function **and** by grants. |
| `prevent_super_admin_escalation` | **New** trigger function on `user_roles`. |

All keep `SECURITY DEFINER` (required — they write across RLS-protected tables) with an explicit `search_path`.

## C. RLS policies changed
- `profiles`: dropped global `admin`/`owner` read policy → `is_super_admin()` read policy, plus a new tenant-scoped
  policy letting users see profiles of colleagues in their own organization.
- `crm_contacts`, `crm_deals`: dropped the global "Admins can view all …" policies (owner-only access remains).
- `documents`: replaced all `is_admin_or_owner` policies with owner (`user_id`) or `is_super_admin()` policies; SELECT
  still allows free documents and purchased documents.
- `audit_logs`, `banking_audit_logs`, `integration_audit_logs`, `payment_audit_logs`, `security_audit_logs`:
  cross-tenant `admin`/`owner` read policies replaced with `is_super_admin()`. Users still read their own rows.
- `user_roles`: dropped the three global-`owner` write policies; writes are now super-admin-only, cannot target the
  caller and cannot reference `super_admin`. Added a `BEFORE INSERT OR UPDATE` trigger that rejects any `super_admin`
  assignment coming from an API session (service role / direct SQL only).

## D. Storage configuration
Reviewed all four buckets. `company-logos`, `advertisement-images`, `user-avatars` and `service-images` contain only
**public presentation assets** that the application renders through `getPublicUrl` (avatars in the header, logos
embedded into generated cards/signatures/landing pages, marketplace/advertisement imagery). No customer business
documents are stored in Supabase Storage today — `documents.file_url` rows are external links.

Decision: these buckets stay public (making them private would break legitimate public assets), while write/update/
delete stay constrained to `auth.uid()`-prefixed paths, so cross-tenant writes and deletes remain impossible.
Any future private customer files must go into a new private bucket with membership-scoped policies and signed URLs.
This is recorded as an accepted residual risk (H2 below), not a fix.

## E. Grants / revokes
- `anon` EXECUTE removed from: `add_project_member`, `add_team_member`, `get_user_projects`, `get_user_teams`,
  `get_team_members_with_profiles`, `check_and_deduct_ai_credit`, `create_payment_record`, `update_payment_status`,
  `check_trial_status`, `preview_user_emissions`, `create_team_with_owner`, every `admin_*` function and every
  `encrypt_*` / `decrypt_*` function.
- `authenticated` EXECUTE removed from all `encrypt_*` / `decrypt_*`, `create_payment_record`, `update_payment_status`
  (service role only).
- `PUBLIC` grants stripped on every function touched above.

## F. Security issues fixed
1. Cross-tenant project membership injection (`add_project_member`).
2. Cross-tenant team membership injection (`add_team_member`).
3. IDOR reads of other tenants' projects/teams/member profiles and cross-user AI-credit and payment manipulation.
4. Anonymous decryption oracles (`decrypt_*`) and anonymous encryption/admin RPC access.
5. Cross-tenant reads by holders of the global `admin`/`owner` role on profiles, documents, CRM and audit tables.
6. `user_roles` privilege-escalation path to `super_admin`.

## G. Intentionally not changed
- Public content policies (`forum_*`, `news_articles`, `advertisement_categories`, `platform_plans/tools/settings`,
  published `template_catalog`) — deliberately public.
- `get_invitation_by_token` — unauthenticated invite lookup by design; token entropy is the control.
- Bucket visibility (see D).
- Legacy `app_role` values. Findings: `owner`, `admin`, `manager`, `moderator`, `user` remain in the enum and in data
  (2 `admin`, 2 `super_admin`, 3 `user`; no `owner` rows). After this change none of them grants cross-tenant data
  access or any write on `user_roles`; only `super_admin` (via `is_super_admin`) carries platform authority, and
  `has_role`/`is_admin_or_owner` are no longer used in any cross-tenant policy. They are now cosmetic/legacy labels.

## H. Remaining risks
1. **MEDIUM** — Many business tables (`invoices`, `quotes`, `bills`, `expenses`, `crm_*`, `notes`, AI tables, payroll,
   integrations) scope by `user_id` only, not `organization_id`. Data is private per user but not shared/organization-
   isolated by design; a company admin cannot see colleagues' records. Migrating these to organization scope is a
   separate project.
2. **MEDIUM** — All storage buckets remain public asset buckets (see D). Object paths are guessable
   (`<user_id>/<file>`), so avatars/logos uploaded by any tenant are readable by anyone with the path.
3. **LOW/PLATFORM** — Leaked-password protection is disabled and Postgres has pending security patches (both are
   Supabase dashboard actions for the project owner).

## I. Tests that could not be performed
The Supabase project is external/production; creating Company A/B test users was forbidden, so all authenticated
cross-tenant CRUD, live storage download attempts and live role-escalation attempts remain **BLOCKED**. Verification
was done via catalog inspection (policies, grants, function bodies) plus live anonymous RPC probes.

## J. Validation results
| # | Check | Result |
|---|---|---|
| 1 | `add_project_member` cross-tenant denied | PASS (static: explicit tenant checks) / live authenticated test BLOCKED |
| 2 | `add_team_member` cross-tenant denied | PASS (static) / live BLOCKED |
| 3 | Unauthorized RPC execution denied | PASS (static + in-function `Not authorized`) |
| 4 | `anon` cannot execute protected RPCs | PASS (live: `42501 permission denied` for all probed functions) |
| 5 | `decrypt_*` not executable by anon or authenticated | PASS (live + grant inspection) |
| 6 | Customer admin/owner policies tenant-scoped | PASS (policy inspection) |
| 7 | `user_roles` cannot grant `super_admin` | PASS (policy + trigger) / live BLOCKED |
| 8 | Buckets with customer data private | N/A — no customer-data buckets exist; public asset buckets retained (H2) |
| 9 | Known-path cross-tenant storage reads denied | FAIL/ACCEPTED for public asset buckets (H2) |
| 10 | `super_admin` protected | PASS |
| 11 | Legitimate owner/admin functionality intact | PASS (static review of all call sites) |
| 12 | RLS enabled on all protected tables | PASS |

**Final status: NOT PRODUCTION READY (for strict multi-tenancy).**
The seven audit findings are addressed, but item H1 (user-scoped rather than organization-scoped business tables) and
H2 (public storage buckets) mean the platform is not yet a strictly tenant-isolated SaaS, and the authenticated
cross-tenant test matrix could not be executed against the production project.
