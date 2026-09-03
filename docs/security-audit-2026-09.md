# B2BNest security verification — read-only audit

Scope: static/database audit only. No code, schema, policy, data or configuration was changed.

## Environment limitation (important)

The Supabase project is **user-managed / external** (`LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged`). No isolated
test sessions can be minted and creating Company A/B test users would create real production auth users, which the
brief forbids. Therefore all tests that require an *authenticated* session (live cross-tenant SELECT/INSERT/UPDATE/
DELETE, live RPC abuse, live storage download) are reported **BLOCKED**, not passed. Everything reachable by catalog
inspection (RLS, policies, grants, function bodies, EXECUTE privileges, bucket config) was verified.

## Overall result

**NOT production-ready as a strict multi-tenant SaaS.** Platform (Super Admin) isolation looks sound; tenant-level
isolation has confirmed structural gaps: unguarded SECURITY DEFINER functions callable by `authenticated`/`anon`,
global `admin`/`owner` role policies that cross tenants, and all storage buckets being public.

## Test results

| Test | Result |
|---|---|
| 1 — Super Admin isolation | PASS (static) |
| 2 — Company A vs B data isolation | BLOCKED (no safe test accounts) + structural risks found |
| 3 — URL/API/RPC bypass | FAIL (unguarded definer RPCs) |
| 4 — Role escalation | PARTIAL FAIL (see below) |
| 5 — RLS coverage | PASS for enablement, PARTIAL for tenant scoping |
| 6 — SECURITY DEFINER functions | FAIL |
| 7 — Company admin boundaries | PARTIAL (org helpers correct; global roles bypass them) |
| 8 — Subscription/usage isolation | FAIL (`check_and_deduct_ai_credit`) |
| 9 — Storage | FAIL (all buckets public) |
| 10 — Audit log security | PARTIAL PASS |

### Test 1 — Super Admin isolation
1. Legitimate SUPER_ADMIN can use admin RPCs — PASS.
2/3/4/5. Normal user, COMPANY_OWNER, ADMIN, MEMBER — every `admin_*` function begins with
   `IF NOT public.is_super_admin(auth.uid()) THEN RAISE 'Not authorized'` — PASS (static).
6. Enforcement is in the database, not the router; anonymous calls to `admin_list_companies` / `admin_list_users`
   returned `P0001 Not authorized` — PASS (verified live).
7. `is_super_admin(auth.uid())` reading `public.user_roles` is the single authoritative platform check — PASS.
   Note: `admin_*` functions are also granted to `anon`; harmless today because of the internal check, but the grant
   should be narrowed to `authenticated`.

### Test 4 — Role escalation
- `user_roles` RLS lets a holder of the **global `owner` role** insert/update/delete other users' rows, and the
  policies do **not** exclude `role = 'super_admin'`. A user who ever obtains global `owner` can mint a super admin.
  Current distribution: 2 `admin`, 2 `super_admin`, 3 `user` — no `owner` exists today, so not currently exploitable,
  but the policy is a latent privilege-escalation path. **HIGH.**
- `handle_new_user` grants no platform role (org membership `admin` only) — good, self-signup cannot escalate.
- `admin_set_user_role` is super-admin gated and blocks self-role changes — good.

### Test 6 — SECURITY DEFINER (main failures)
All definer functions have an explicit `search_path` (0 missing) and no dynamic SQL. However, these are
`SECURITY DEFINER`, take caller-controlled IDs, contain **no authorization check**, and are executable by
`authenticated` **and `anon`**:

| Function | Impact |
|---|---|
| `add_project_member(project_id, user_id, role)` | Any user can add themselves to **any** project of any tenant → full cross-tenant project/task access. CRITICAL |
| `add_team_member(team_id, user_id, role)` | Same for teams. CRITICAL |
| `get_user_projects(p_user_id)` | Returns any user's project list (name, client, budget, deadline). HIGH |
| `get_user_teams(p_user_id)` | Any user's teams. MEDIUM |
| `get_team_members_with_profiles(p_team_id)` | Any team's members **including email/full name** — bypasses the profiles hardening. HIGH |
| `check_and_deduct_ai_credit(p_user_id, n)` | Can drain another tenant's AI credits, or create/reset a subscriber row. HIGH |
| `create_payment_record(...)` | Anyone (incl. anon) can insert arbitrary payment rows + audit entries. HIGH |
| `update_payment_status(status, session_id, ...)` | Anyone who knows/guesses a Stripe session id can mark a payment `paid`. HIGH |
| `create_user_organization()`, `create_team_with_owner(name)` | Unauthenticated resource creation (anon grant). MEDIUM |
| `decrypt_banking_data / decrypt_payment_data / decrypt_integration_token / decrypt_hmrc_token` | Raw decryption oracles granted to `anon`; any leaked ciphertext becomes plaintext. HIGH |
| `get_invitation_by_token(p_token)` | By design (unauthenticated invite lookup); token entropy is the only control. ACCEPTED |
| `preview_user_emissions(_user_id)`, `check_trial_status(user_id)` | Read other users' staking/trial state. LOW–MEDIUM |

Correctly guarded (for reference): `get_bank_account_details`, `get_hmrc_tokens`, `get_hmrc_client_secret`,
`get_integration_tokens`, `get_user_payments`, `get_bank_accounts_safe`, `get_user_integrations_safe`,
`store_bank_account`, `store_integration_tokens`, `get_payment_details_admin`, `admin_log_action`, all `admin_*`.

### Test 5 — RLS coverage
- RLS is **enabled on every table** in `public`; no unprotected table found. No `anon` table grants exist on any
  sensitive table (verified).
- Tenant key is inconsistent: `organizations`, `organization_members`, `projects`, org-scoped `todos`, `hmrc_*`,
  `rota_*`, `job_postings` use `organization_id` + membership helpers (correct). `crm_contacts`, `crm_deals`,
  `invoices`, `quotes`, `bills`, `expenses`, `documents`, `notes`, AI tables, payroll, integrations scope by
  `user_id` only — private, but **not** organization-isolated, so "company data" is really "per-user data".
- `profiles`, `documents`, `crm_contacts`, `crm_deals` and several audit tables carry global policies of the form
  `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner')`. These ignore organization boundaries: any holder of
  the global `admin`/`owner` role reads **all tenants**. Two `admin` rows exist today. **HIGH.**
- `USING (true)` SELECT exists only on intentionally public content (forum, news, ad categories, platform plans/
  tools/settings, published `template_catalog`) — accepted.

### Test 7/8 — Company admin & entitlement boundaries
Organization helpers (`user_is_organization_member/admin/owner`, `user_can_access_project`, `is_project_member`,
`owns_team`) are definer functions with `search_path TO ''` and fully-qualified references; they default to
`auth.uid()` and are used correctly by policies — no caller bypass through RLS. The boundary is broken only by the
global-role policies and the unguarded RPCs above. Entitlements: `check_and_deduct_ai_credit` is cross-user writable
(above); subscriber self-update paths should be re-reviewed once test accounts exist.

### Test 9 — Storage
All four buckets — `company-logos`, `advertisement-images`, `user-avatars`, `service-images` — have `public = true`.
Write/update/delete policies constrain the first path segment to `auth.uid()`, so cross-tenant *writes* are blocked,
but **reads are unauthenticated for anyone with the object path**, and object paths are predictable
(`<user_id>/<filename>`). Company A cannot delete or overwrite Company B files; it *can* read them. FAIL for
confidentiality, PASS for integrity.

### Test 10 — Audit logs
`admin_audit_logs` and the domain audit tables have no user UPDATE/DELETE policies and mostly service-role-only
INSERT — customers cannot alter or erase history. Gap: `create_payment_record`/`update_payment_status` let any caller
insert `payment_audit_logs` rows attributed to another user (fake privileged entries). Read access to several audit
tables is again granted to the global `admin`/`owner` roles across tenants.

## Recommended fixes (not implemented)

1. Add `auth.uid()` + membership checks to `add_project_member`, `add_team_member`, `get_user_projects`,
   `get_user_teams`, `get_team_members_with_profiles`, `check_and_deduct_ai_credit`, `preview_user_emissions`,
   `check_trial_status`; move `create_payment_record` / `update_payment_status` to service-role only (Stripe webhook).
2. `REVOKE EXECUTE ... FROM anon, authenticated` on all `decrypt_*` / `encrypt_*` helpers and on `admin_*` from `anon`.
3. Rewrite `user_roles` write policies to be super-admin only and explicitly reject `super_admin`/`owner` grants.
4. Replace global `admin`/`owner` policies on `profiles`, `documents`, CRM and audit tables with `is_super_admin()`
   or organization-scoped checks.
5. Make `user-avatars`/`company-logos` decisions explicit: keep public only for genuinely public assets; move any
   business documents to a private bucket with membership-scoped SELECT policies.
6. Add `organization_id` to the user-scoped business tables and migrate policies to membership helpers.
7. Enable leaked-password protection and upgrade Postgres (pre-existing linter warnings).

## Blocked / must be re-run with test accounts
Live Company A vs B CRUD matrix, live RPC abuse confirmation, live storage download attempt, subscription/plan
tamper attempts. These require two isolated seeded companies with owner/admin/member logins.
