# B2BNest — Security remediation round 2 (2026-09)

Scope: remediation of the 50 FAILs in `docs/company-ab-tenant-security-matrix-2026-09.md`.

**Production was not contacted, modified, or migrated.** Everything below was implemented and validated in the
isolated local cluster (`/tmp/stg2`, socket `/tmp/pgs2`, port 55433) rebuilt from
`supabase/baseline/production-schema-baseline-2026-09.sql`.

Production migration package (prepared, **not deployed**): `supabase/remediation/round2-2026-09.sql`
(single idempotent transaction; no historical migration was rewritten).

---

## 1. Vulnerabilities fixed, root causes and changes

| # | Severity | Vulnerability | Root cause | Fix |
|---|---|---|---|---|
| F1 | CRITICAL | `get_hmrc_tokens` returned HMRC access/refresh tokens to **anonymous** callers for any guessed UUID | Guard `p_user_id <> auth.uid()` evaluates to NULL when `auth.uid()` is NULL, so the `IF` never fired; anon also held EXECUTE | New `public.assert_self(uuid)` guard (explicit `auth.uid() IS NULL` rejection + `IS DISTINCT FROM`), function rewritten, anon EXECUTE revoked |
| F2 | CRITICAL | `get_user_integrations_safe` — identical anonymous bypass | same NULL semantics | same guard + revoke |
| F3 | HIGH | Same NULL pattern found by pattern search in `get_bank_accounts_safe`, `get_bank_account_details`, `get_integration_tokens`, `store_bank_account`, `store_integration_tokens`, `get_user_payments` (all used `!=` with `auth.uid()`) | copy-paste guard idiom | all rewritten on `assert_self`; legacy `is_admin_or_owner` bypass removed from every credential path |
| F4 | HIGH | ~88 SECURITY DEFINER functions carried the default `PUBLIC` EXECUTE grant (`=X/postgres`), incl. `decrypt_banking_data`, `decrypt_payment_data`, `decrypt_hmrc_token`, `decrypt_integration_token`, `encrypt_banking_data`, `encrypt_payment_data`, `check_and_deduct_ai_credit`, `users_share_organization` | `CREATE FUNCTION` grants EXECUTE to PUBLIC by default; earlier remediation added grants but never revoked PUBLIC | Loop `REVOKE ALL … FROM public, anon, authenticated` on every non-extension function in `public`, then explicit least-privilege re-grants per class (A–E, below) |
| F5 | HIGH | `documents` readable across tenants: policy allowed any authenticated user to read rows with `COALESCE(price,0)=0` | free-price used as a proxy for "public template" | Added `documents.is_public boolean not null default false`; backfilled `true` only for free rows authored by a platform super admin; SELECT policy now own / purchased / super-admin / `is_public AND price=0` |
| F6 | HIGH | Cross-tenant `projects` INSERT: `WITH CHECK (auth.uid() = user_id)` ignored `organization_id` | user_id-only WITH CHECK on an org-scoped table | INSERT/UPDATE policies now also require `user_is_organization_member(organization_id, auth.uid())`. Same pattern fixed on `hmrc_integrations`, `hmrc_settings`, `hmrc_submission_logs` (found by pattern search) |
| F7 | MEDIUM | `subscribers` self-service escalation (self INSERT of a premium row, self UPDATE of `subscription_tier`) | customer-writable entitlement table | Client INSERT/UPDATE/DELETE policies dropped and table privileges revoked from `anon`/`authenticated`; SELECT-own kept; writes are service-role/webhook only. `payments` client INSERT likewise removed |
| F8 | MEDIUM | `check_and_deduct_ai_credit` executable anonymously | PUBLIC grant (in-function guard was already correct) | grant restricted to `authenticated` + `service_role`; guard retained |
| F9 | MEDIUM | `get_user_display_info` returned profile data to anon and across tenants | no caller check, anon grant | now rejects anonymous callers and returns a row only for self, a same-organization colleague, or a super admin; fields limited to `display_name`, `avatar_url`, `headline` (no email) |
| F10 | MEDIUM | `users_share_organization` anonymous tenant-membership probing | PUBLIC grant | `authenticated` + `service_role` only |
| F11 | FUNCTIONAL | `get_user_payments` always raised `42883 is_admin_or_owner(uuid) does not exist` (`SET search_path=''` + unqualified call); same defect inside `get_bank_accounts_safe` | missing schema qualification | rewritten fully qualified; both now work for the owning user |
| F12 | FUNCTIONAL | No DELETE policy on `teams` and `ai_conversations` — owners could not delete their own rows | missing policy | owner-scoped DELETE policies added (no tenant boundary widened) |

### Additional objects found by the systematic pattern review

- NULL-comparison guards (`!=`/`<>` against `auth.uid()`): `get_bank_account_details`, `get_bank_accounts_safe`,
  `get_integration_tokens`, `store_bank_account`, `store_integration_tokens`, `get_user_payments` — all fixed.
- `get_payment_details_admin` authorized on the legacy `is_admin_or_owner` (any `admin`/`owner` role row) and
  returned decrypted customer PII → now `is_super_admin` only.
- `user_id`-only WITH CHECK on org-bearing tables: `hmrc_integrations`, `hmrc_settings`, `hmrc_submission_logs`
  (fixed); `todos`/`organization_invitations` were already membership-checked by their other policies (verified).
- `update_notification_preferences(uuid, jsonb)` referenced in the app but **absent from the production schema
  baseline** — recorded as a functional defect, not changed here.

### Grant classification applied

| Class | Handling |
|---|---|
| A — client RPCs | `authenticated` + `service_role` (list in the migration) |
| B — internal/server | `service_role` only: all `encrypt_*`/`decrypt_*`, `create_payment_record`, `update_payment_status`, `cleanup_expired_2fa_codes`, `check_2fa_rate_limit` |
| C — trigger helpers | no client grant (trigger execution does not check EXECUTE) |
| D — super admin | `authenticated` grant **plus** in-function `is_super_admin(auth.uid())` guard |
| E — intentionally public | `get_invitation_by_token`, `template_usage_counts` only |
| RLS predicates | `has_role`, `is_super_admin`, `is_admin_or_owner`, `is_safe_profile_field`, `is_project_member`, `is_team_member`, `owns_team`, `user_owns_project`, `user_can_access_project`, `user_is_organization_member/admin/owner` granted to `anon`+`authenticated` because they are evaluated inside policies whose role is `public` |

---

## 2. Test procedure (full regression, not just failing rows)

1. `scripts/staging/rebuild-from-baseline.sh` — clean cluster from the production schema baseline
   (parity re-verified: 92 tables / 981 columns / 225 constraints / 199 indexes / 93 functions / 61 triggers /
   RLS on 92 / 282 policies / 4 buckets).
2. `scripts/staging/10_seed_tenants.sql` — synthetic Company A/B identities and data.
3. `supabase/remediation/round2-2026-09.sql` — remediation.
4. `scripts/staging/20_security_harness.sql` + `scripts/staging/30_security_tests.sql` — the complete matrix
   (30-case tenant matrix, per-resource CRUD, RPC/grant inventory, role and membership escalation, PII,
   storage, Super Admin, payments, AI credits, audit) **plus** a new phase 18 legitimate-path regression block.

Evidence: `/mnt/documents/company-ab-matrix-results-round2.csv`.

## 3. Before / after

| | Before | After |
|---|---|---|
| PASS | 409 | **471** |
| FAIL | 50 | **0** |
| INFO | 52 | 54 |
| Total assertions | 511 | 525 |

All previously required conversions are now PASS: anonymous `get_hmrc_tokens`, anonymous
`get_user_integrations_safe`, anonymous `check_and_deduct_ai_credit`, unauthorized `get_user_display_info`,
unauthorized `users_share_organization`, unauthorized `decrypt_*` and `encrypt_*`, cross-tenant `documents`
SELECT, cross-tenant `projects` INSERT, subscriber self-tier upgrade, premium subscriber self-INSERT.

No previously passing case regressed. Phase 18 confirms legitimate paths still work: own HMRC tokens,
own integrations, own bank accounts, own payments, own AI credits and credit deduction, own subscription read,
own document read, project creation inside the caller's own organization, owner delete of teams and AI
conversations, super-admin `admin_list_companies`, and the two intentionally public RPCs.

Three test expectations were corrected (not weakened): `get_user_display_info` denies by returning zero rows
rather than raising, and `user_integrations` denies at the GRANT layer (`42501`) rather than the RLS layer.

## 4. Remaining INFO cases (54)

By design, not assertions: same-tenant colleague visibility on the ~25 user-scoped business tables (a colleague
sees nothing — the known *under-sharing* gap, not a leak), free/public marketplace documents, public storage
buckets readable by object path, and `users_share_organization` probes between authenticated users.

## 5. BLOCKED tests

None at the database layer. Still unverified end to end: PostgREST request handling, Edge Functions, and the
browser UI — the managed project is `external_unmanaged`, so no authenticated session can be minted here.

## 6. Remaining risks

| Risk | Severity | Note |
|---|---|---|
| ~25 business tables scoped by `user_id` only; `teams` outside the org boundary | MEDIUM (functional/governance) | deliberately out of scope for this remediation |
| Four storage buckets remain public-read by known path | LOW / accepted | presentation assets only |
| Billing unit is the user, not the organization | MEDIUM (product) | decide before org-level billing |
| App code paths that wrote directly to `subscribers`/`payments` must move to the webhook/edge path | MEDIUM (functional) | `src/hooks/useSubscription.tsx` reads only; verify checkout/trial edge functions use the service role before deploying |
| `update_notification_preferences` missing from schema | LOW (functional) | pre-existing drift |
| Leaked-password protection off; Postgres patches pending | LOW / platform | dashboard actions |

## 7. Is production migration safe to prepare?

Yes — the package is prepared and validated on an exact schema-parity rebuild, is idempotent, additive
(one nullable-with-default column, policy and grant changes, function replacements) and contains no data
deletion. Deployment is intentionally **not** performed in this phase; before deploying, re-check the
`subscribers`/`payments` write paths in Edge Functions and run the matrix once more against the deployed schema.

SECURITY MATRIX: PASS
STRICT MULTI-TENANCY: PASS
PRODUCTION REMEDIATION PACKAGE: READY
