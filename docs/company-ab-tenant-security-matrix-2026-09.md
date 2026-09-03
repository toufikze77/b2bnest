# B2BNest — Company A/B tenant-isolation security matrix (2026-09)

Execution environment: **isolated local PostgreSQL 17 cluster** (`/tmp/stg2`, socket `/tmp/pgs2`, port 55433),
rebuilt from `supabase/baseline/production-schema-baseline-2026-09.sql` with the Supabase shim
(`scripts/staging/00_supabase_shim.sql`). **Production was never contacted, read, written or configured.**
No production credentials were used; `PGHOST` for the managed project is not available in this environment.

Automation:

| File | Purpose |
|---|---|
| `scripts/staging/rebuild-from-baseline.sh` | Wipes and rebuilds the local cluster; refuses any non-local host |
| `scripts/staging/10_seed_tenants.sql` | Synthetic identities, Company A/B tenant data, storage objects |
| `scripts/staging/20_security_harness.sql` | Session impersonation (`SET LOCAL ROLE` + `request.jwt.claims`), rollback-per-test, verdict engine |
| `scripts/staging/30_security_tests.sql` | The full matrix (511 executed cases) |

Full machine-readable evidence: `/mnt/documents/company-ab-matrix-results.csv`.

Actors (all synthetic, `@test.invalid`): A_OWNER, A_ADMIN, A_MEMBER, B_OWNER, B_ADMIN, B_MEMBER, SUPER_ADMIN,
UNASSIGNED, ANON, SERVICE_ROLE.
Org A `0a000000-0000-4000-8000-000000000001`, Org B `0b000000-0000-4000-8000-000000000001`.

## Result summary

| Verdict | Count |
|---|---|
| PASS | 409 |
| FAIL | 50 |
| INFO (by-design / not a pass-fail assertion) | 52 |
| **Total executed** | **511** |
| BLOCKED | 0 (schema-level); UI/PostgREST-level end-to-end still unverified |

The 30-case matrix from `docs/tenant-architecture-review-2026-09.md` §8 was executed in full and expanded
(per-resource CRUD over 20 resources, RPC, role/membership escalation, PII, storage, payments, AI credits, audit).

## What passed

- Cross-tenant SELECT/UPDATE/DELETE returned **0 rows** for every organization-scoped and user-scoped resource
  except `documents` (see F3): projects, todos, teams, CRM, invoices, quotes, bills, expenses, suppliers,
  products, payroll, notes, AI workspaces/conversations, bank accounts, integrations, subscribers, payments.
- Cross-tenant INSERT into `todos` with a foreign `organization_id` → RLS violation.
- ANON reads on every tenant table → 0 rows or `42501`.
- Role escalation: self-insert/update of `user_roles` to `admin`/`super_admin` → denied (policy + trigger);
  self-promotion in `organization_members` → denied; editing Company B membership/organization → 0 rows.
- All `admin_*` RPCs → `Not authorized` for ANON, UNASSIGNED, A_MEMBER, A_OWNER; succeed for SUPER_ADMIN and write `admin_audit_logs`.
- `add_project_member`, `add_team_member`, `get_user_projects`, `get_user_teams`,
  `get_team_members_with_profiles`, `check_and_deduct_ai_credit` (cross-user), `get_hmrc_client_secret`,
  `get_hmrc_tokens` (authenticated cross-user) → `Access denied` / `Not authorized`.
- Storage: writes/updates/deletes outside `auth.uid()/…` path prefix → denied in all four buckets.
- Audit tables: no UPDATE/DELETE by any tenant actor; no insert on behalf of another user.
- `profiles`: Company B profile rows invisible to Company A actors.

## Failures

| # | Severity | Finding | Evidence |
|---|---|---|---|
| F1 | **CRITICAL** | `get_hmrc_tokens(uuid)` and `get_user_integrations_safe(uuid)` are callable by **anon** and their guards use `p_user_id <> auth.uid()`, which evaluates to NULL when `auth.uid()` is NULL — the `IF` is skipped and data is returned. Anonymous callers retrieve HMRC access/refresh tokens and integration metadata for any guessed user UUID. | X1, X3: `ANON` → `ROWS=1` (returned `SYNTHETIC-B-HMRC`) |
| F2 | **HIGH** | `encrypt_/decrypt_banking_data`, `decrypt_payment_data`, `encrypt_payment_data`, `decrypt_hmrc_token`, `decrypt_integration_token`, `check_and_deduct_ai_credit`, `users_share_organization`, `get_user_display_info` still carry the default `PUBLIC` EXECUTE grant (`=X/postgres`). 88 of the SECURITY DEFINER functions in `public` are PUBLIC-executable. Anon/unassigned callers execute them successfully. | 9/RPC P9 rows, AI2, M9 |
| F3 | **HIGH** | `documents` SELECT policy allows any authenticated user to read rows where `COALESCE(price,0)=0`. Seeded free tenant documents were readable by Company B and by a user with no organization. Paid documents were correctly hidden (X6 PASS). If real business documents are stored with no price, they are world-readable to all customers. | CRUD 6/10/11, X7 |
| F4 | **HIGH** | Cross-tenant INSERT into `projects`: policy `Users can create their own projects` checks only `auth.uid() = user_id`, so a Company A member can create a project carrying Company B's `organization_id`, which then becomes visible to Company B. | CRUD 9, X9: `ROWS=1` |
| F5 | **MEDIUM** | `subscribers` allows the user to INSERT and UPDATE their own row including `subscription_tier`/`subscribed`. A customer can self-grant a premium plan; billing state is not service-role-only. | PAY6, case 23 |
| F6 | **MEDIUM** | `get_user_display_info(uuid)` (anon-executable) returns display name/avatar/headline of any user, including other tenants. Acceptable only if profiles are intentionally public. | PII5, 9/RPC P9 |
| F7 | **LOW / functional** | `get_user_payments(uuid)` is `SET search_path=''` but calls `is_admin_or_owner` unqualified → always `42883`. Same break inside `get_bank_accounts_safe`. Fails closed, but the features are broken. | S13, X4 |
| F8 | **LOW / functional** | No DELETE policy on `teams` and `ai_conversations` — owners cannot delete their own rows (`ROWS=0`). | CRUD 5 |
| F9 | **INFO** | `user_integrations` and `hmrc_integrations` have no SELECT grant for `authenticated` (accessor-RPC only). Correct by design; recorded as FAIL only because the test expected an RLS-level zero-row result. | U-user_integrations, X8 |

## Recommended remediation (not applied — this run was test-only)

1. Rewrite every definer guard as `auth.uid() IS NULL OR p_user_id <> auth.uid()` (or `is distinct from`), and
   `REVOKE EXECUTE … FROM PUBLIC, anon` on all token accessors (F1).
2. `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;` then re-grant explicitly per function (F2).
3. Split `documents` into a public template catalogue and tenant documents; drop the `price = 0` read path for
   tenant-owned rows (F3).
4. Add `WITH CHECK (organization_id IS NULL OR user_is_organization_member(organization_id))` to every
   `projects` INSERT/UPDATE policy, and audit sibling tables for the same pattern (F4).
5. Make `subscribers` writes service-role only; keep owner SELECT (F5).
6. Confirm profile publicity intent; otherwise gate `get_user_display_info` on `users_share_organization` (F6).
7. Fully qualify `public.is_admin_or_owner` inside `search_path=''` functions (F7) and add owner DELETE policies (F8).

## Scope limits

- Executed against the schema baseline through direct SQL sessions with `role`+JWT claims, which is equivalent to
  PostgREST RLS evaluation but does **not** cover PostgREST-layer behaviour, Edge Functions, or the UI.
- Storage tests used `storage.objects` policies only; no object bytes exist locally.
- Vault-backed encryption keys are absent locally, so `decrypt_*` output values are not meaningful — only their
  *executability* by unauthorised roles is asserted.

STRICT MULTI-TENANCY: FAIL
PRODUCTION READINESS: NOT READY
