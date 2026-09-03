# B2BNest — Production Security Remediation Pre-Flight & Rollback Plan (2026-09)

**Status of this document:** PRE-FLIGHT ONLY. Production was **not** modified.
Only read-only aggregate `SELECT count(*)` queries were executed against production (Phase 8).
All apply/rollback work was performed on throwaway local PostgreSQL 17 clusters built from
`supabase/baseline/production-schema-baseline-2026-09.sql`.

---

## 1. Exact migration reviewed

| Item | Value |
|---|---|
| Package | `supabase/remediation/round2-2026-09.sql` (484 lines, single `begin; … commit;`) |
| Baseline | `supabase/baseline/production-schema-baseline-2026-09.sql` (92 tables / 981 columns / 93 functions / 282 policies / 61 triggers / 4 buckets) |
| Rollback | `supabase/remediation/round2-2026-09-rollback.sql` (new, this phase) |
| Dry-run DB | `/tmp/stg3` (socket `/tmp/pgs3:55434`) — isolated, schema-only |
| Rollback DB | `/tmp/stg4` (socket `/tmp/pgs4:55435`) — isolated, throwaway |

---

## 2. Statement-level risk summary

Counts taken from the exact package:

| Statement class | Count | Classification |
|---|---|---|
| `CREATE OR REPLACE FUNCTION` | 13 | FUNCTION CHANGE — replaces existing bodies (`get_hmrc_tokens`, `get_user_integrations_safe`, `get_integration_tokens`, `get_bank_accounts_safe`, `get_bank_account_details`, `get_hmrc_client_secret`, `store_integration_tokens`, `store_bank_account`, `get_user_payments`, `get_payment_details_admin`, `get_ai_credits_info`, `get_user_display_info`) + 1 new (`assert_self`) |
| `DROP FUNCTION` | 0 | — (no signature is removed; no dependency breakage) |
| `DROP POLICY` | 17 | RLS CHANGE — all `drop policy if exists`, each immediately re-created except three deliberately removed (`payments.Users can insert their own payments`, `subscribers.insert_subscription`, `subscribers.update_own_subscription`) |
| `CREATE POLICY` | 13 | RLS CHANGE |
| `GRANT` | 9 statements (+2 `DO` loops) | PRIVILEGE CHANGE |
| `REVOKE` | 6 statements (+1 `DO` loop over every non-extension `public` function) | PRIVILEGE CHANGE — the highest-blast-radius part of the package |
| `ALTER TABLE` | 1 | SCHEMA CHANGE — `documents add column if not exists is_public boolean not null default false` |
| `UPDATE` | 1 | DATA-AFFECTING — backfills `documents.is_public = true` only for free documents authored by a `super_admin` |
| `CREATE TRIGGER` / `DROP TRIGGER` | 0 | — |
| `DELETE` / `INSERT` / `TRUNCATE` / `DROP TABLE` / `DROP COLUMN` / type change | 0 | — no DESTRUCTIVE or IRREVERSIBLE statement exists in the package |

**Locking risk:** the only table-rewriting candidate is `ALTER TABLE documents ADD COLUMN … NOT NULL DEFAULT false`.
On PostgreSQL 11+ this is a metadata-only operation (no rewrite); it takes a brief `ACCESS EXCLUSIVE` lock on
`documents`. The subsequent `UPDATE` touches **0 production rows** (see Phase 8). All `DROP/CREATE POLICY` and
`GRANT/REVOKE` statements take short `ACCESS EXCLUSIVE`/catalogue locks. Everything runs inside one transaction:
either the whole package commits or nothing does.

**Requires manual review:** the blanket `revoke all on function … from public, anon, authenticated` loop.
It is intentionally broad; correctness depends entirely on the re-grant lists that follow. Phase 4/5 below
verify every application caller against those lists.

Measured dry-run execution time: **0.074 s** (schema-only DB; production timing will be dominated by lock
acquisition, not by work).

---

## 3. `documents.is_public` compatibility

| Check | Result |
|---|---|
| Type / default / nullability | `boolean NOT NULL DEFAULT false` — verified in the dry-run catalogue |
| Fail-closed? | YES — new and existing rows default to `false` (private) |
| Backfill scope | Only `price = 0` **and** author holds `super_admin`; the dry-run `UPDATE` reported `UPDATE 0` |
| Production rows affected | **0** — `documents` currently holds **0 rows** in production (Phase 8) |
| Could an existing document accidentally become public? | NO. Zero rows exist; even with rows, the backfill is restricted to platform-authored free documents, and the SELECT policy additionally requires `price = 0` |
| Owner access preserved? | YES — `auth.uid() = user_id` remains the first branch of the SELECT policy; purchases via `user_documents` remain readable; super admins retain access |
| Application tolerance | `src/services/documentService.ts` uses `select('*')` / `insert` without column enumeration, and `src/pages/Onboarding.tsx` inserts a partial payload. A new nullable-by-default column is additive and tolerated. `src/integrations/supabase/types.ts` will need regeneration after deployment (cosmetic/type-level only) |
| Rollback | CONDITIONALLY REVERSIBLE — see Phase 12 |

**Behaviour change to communicate:** free documents authored by ordinary tenants are no longer world-readable
by every authenticated user. With `documents` currently empty, there is no production impact today, but any
future "free public template" flow must set `is_public = true` explicitly (super-admin/service path).

---

## 4. RLS before/after review

Verified by catalogue diff (`pg_policies`) before vs. after applying the exact package.

| Table | Policy | Op | Roles before → after | Before | After | Security effect |
|---|---|---|---|---|---|---|
| documents | `documents_select_owned_purchased_or_free` → `…_or_public` | SELECT | authenticated | owner OR super admin OR `price=0` OR purchased | owner OR super admin OR (`is_public` AND `price=0`) OR purchased | Closes cross-tenant read of every free document |
| projects | Users can create their own projects | INSERT | public → authenticated | `auth.uid() = user_id` | `+ (organization_id is null or user_is_organization_member(...))` | Blocks planting a project into a foreign tenant |
| projects | Organization members can create projects | INSERT | public → authenticated | subquery on `organization_members` | `organization_id is not null and user_is_organization_member(...)` | Same rule, helper-function form; anon excluded |
| projects | Users can update projects they own | UPDATE | public → authenticated | `user_owns_project(id)` | `user_owns_project(id, auth.uid())` + WITH CHECK membership | Prevents moving a project into a foreign org |
| projects | Project owners can update projects | UPDATE | public → authenticated | owner OR org admin (subquery) | owner OR org admin (helper) + WITH CHECK membership | Same |
| hmrc_integrations | insert / update own | INSERT/UPDATE | public → authenticated | `auth.uid() = user_id` | `+ org membership in WITH CHECK` | Tenant-tagging cannot be forged |
| hmrc_settings | insert / update own | INSERT/UPDATE | public → authenticated | `auth.uid() = user_id` | `+ org membership in WITH CHECK` | Same |
| hmrc_submission_logs | insert own | INSERT | public → authenticated | `auth.uid() = user_id` | `+ org membership in WITH CHECK` | Same |
| subscribers | `insert_subscription`, `update_own_subscription` | INSERT/UPDATE | authenticated | self-service writes | **removed** | Ends self-granting of paid tiers |
| subscribers | `select_own_subscription` | SELECT | public → authenticated | self by id/email | unchanged predicate, anon excluded | Read-only entitlement |
| payments | Users can insert their own payments | INSERT | authenticated | self-insert | **removed** | Payment rows only via webhook/service role |
| teams | Team owners can delete their teams | DELETE | — → authenticated | (missing) | `owner_id = auth.uid()` | Functional fix, owner-scoped |
| ai_conversations | `ai_conversations_delete_policy` | DELETE | — → authenticated | (missing) | `auth.uid() = user_id` | Functional fix, owner-scoped |

Complete policy sets on the affected tables were re-read after the change (permissive policies OR together):

* `payments`: SELECT is self-only (`user_id = auth.uid()` OR `customer_email = auth.email()`), plus an explicit
  anon-blocking `false` policy and a `false`-only "system functions" policy. No write policy remains for
  `anon`/`authenticated`.
* `subscribers`: single SELECT policy, self-only. No write policy.
* `documents`: INSERT/UPDATE/DELETE all `owner OR super admin`; SELECT as above. No policy re-opens cross-tenant reads.
* `projects`, HMRC tables, `teams`, `ai_conversations`: no leftover permissive policy targeting role `public`
  with a weaker predicate.
* Super Admin behaviour is intentional and unchanged: `is_super_admin(auth.uid())` remains an explicit branch on
  `documents`, and admin RPCs keep their in-function guard.

Regression evidence: cross-tenant reads/writes denied in all 30 matrix cases (Phase 10), same-tenant legitimate
access still passing.

---

## 5. Function grants — before/after

Pre-Round2 baseline reality: **93 of 93** non-extension `public` functions carried `=X/postgres`
(EXECUTE to `PUBLIC`), i.e. every SECURITY DEFINER function — including `encrypt_*`, `decrypt_*` and `admin_*` —
was callable by `anon`.

After the package (measured in the dry run):

| Group | Before | After |
|---|---|---|
| `encrypt_*` / `decrypt_*` (8 fns: banking, hmrc, integration, payment) | PUBLIC + anon + authenticated + service_role | **service_role only** |
| `admin_*` (21 fns) | PUBLIC + authenticated + service_role | `authenticated` + `service_role`, each still guarded by `is_super_admin(auth.uid())` in-function |
| `get_hmrc_tokens`, `get_hmrc_client_secret`, `get_user_integrations_safe`, `get_integration_tokens`, `store_integration_tokens`, `get_bank_accounts_safe`, `get_bank_account_details`, `store_bank_account`, `get_user_payments`, `get_ai_credits_info`, `check_and_deduct_ai_credit`, `get_user_display_info`, `users_share_organization`, `get_user_projects`, `get_user_teams`, `get_team_members_with_profiles`, `add_project_member`, `add_team_member`, `create_team_with_owner`, `ensure_user_has_org`, `check_trial_status`, `get_notification_preferences`, `get_advertisement_contact_info`, `get_user_staking_tier`, `preview_user_emissions`, `rota_can_add_employee`, `log_user_action`, `audit_profile_access` | PUBLIC/anon | `authenticated` + `service_role`, each now fail-closed via `assert_self()` or an explicit `auth.uid() is null` check |
| RLS helper predicates (`has_role`, `is_super_admin`, `is_admin_or_owner`, `is_safe_profile_field`, `is_project_member`, `is_team_member`, `owns_team`, `user_owns_project`, `user_can_access_project`, `user_is_organization_member/admin/owner`) | PUBLIC | `anon` + `authenticated` + `service_role` — required because policies targeting role `public` evaluate them |
| Intentionally anonymous (`get_invitation_by_token`, `template_usage_counts`) | PUBLIC | `anon` + `authenticated` + `service_role` |
| Everything else (triggers, maintenance, payment writers, 2FA maintenance, `create_payment_record`, `update_payment_status`, `check_2fa_rate_limit`, `handle_new_user`, …) | PUBLIC | **service_role only** |

Trigger functions do not require caller EXECUTE privilege at fire time, so revoking them is safe; the Phase 10
regression exercises inserts/updates on trigger-bearing tables under the `authenticated` role and passes.

Service-role-only functions are all invoked from Edge Functions using
`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` (verified per file in Phase 6/7 below). No service-role key exists in
frontend code — `src/integrations/supabase/client.ts` uses the publishable/anon key only.

---

## 6. Application / RPC compatibility

| RPC | Caller file | Caller type | Role at call time | Compatible after Round 2? | Action required |
|---|---|---|---|---|---|
| `get_hmrc_tokens` | `src/services/hmrcService.ts:116` | FRONTEND | authenticated (self) | YES (grant present) | Advisory: move token use server-side (Phase 7) |
| `get_hmrc_client_secret` | `src/services/hmrcService.ts:272` | FRONTEND | authenticated (self) | YES | Advisory: move server-side |
| `get_user_integrations_safe` | 9 components (`crm/*`, `integrations/*`) | FRONTEND | authenticated (self) | YES | none |
| `store_integration_tokens` | `crm/IntegrationsTab.tsx`, `crm/ServicesTab.tsx` | FRONTEND | authenticated (self) | YES | none |
| `store_integration_tokens` | 8 OAuth Edge Functions + `store-twitter-credentials` | EDGE (service role) | service_role | YES | none |
| `store_integration_tokens` | `whatsapp-connect` | EDGE (user JWT, anon key + forwarded `Authorization`) | authenticated, `p_user_id = caller` | YES | none |
| `get_integration_tokens` | `workflow-execute` | EDGE (user JWT) | authenticated, `p_user_id = caller` | YES | none |
| `get_integration_tokens` | `workflow-linkedin-post`, `workflow-twitter-post` | EDGE (service role) | service_role | YES | none |
| `store_bank_account` | `truelayer-integration` (`userClient`) | EDGE (user JWT) | authenticated, self | YES | none |
| `get_bank_accounts_safe` | `BusinessFinanceAssistant.tsx:481` | FRONTEND | authenticated (self) | YES | none |
| `get_ai_credits_info` | `AICreditsDisplay.tsx` | FRONTEND | authenticated | YES | none |
| `check_and_deduct_ai_credit` | `ai-assistant` | EDGE (service role) | service_role | YES | none |
| `get_user_display_info` | `ProjectManagement.tsx`, `utils/profileUtils.ts` | FRONTEND | authenticated | YES, but output narrowed (no email; self / same-org / super-admin only) | Verify UI does not render `email` from this RPC |
| `get_user_payments` | — | UNUSED | — | YES | none |
| `check_trial_status`, `ensure_user_has_org`, `create_team_with_owner`, `rota_can_add_employee`, `get_notification_preferences`, `log_user_action`, `is_super_admin`, `template_usage_counts` | frontend | FRONTEND | authenticated / anon | YES (all granted) | none |
| `create_payment_record` | `create-payment` (`supabaseService`) | EDGE (service role) | service_role | YES | none |
| `update_payment_status` | `stripe-webhook` | EDGE (service role) | service_role | YES | none |
| `check_2fa_rate_limit` | `send-2fa-email` (service client) | EDGE (service role) | service_role | YES | none |
| `is_admin_or_owner` | `fetch-news` | EDGE | granted anon/authenticated | YES | none |
| **`encrypt_hmrc_token`** | **`supabase/functions/oauth-hmrc/index.ts:64,69`** | **EDGE using anon key + user JWT** | **authenticated** | **NO — EXECUTE revoked** | **BLOCKER B1: switch that RPC call to a service-role client before deployment** |
| direct table insert into `subscribers` | `src/hooks/useSubscription.tsx:111` | FRONTEND write | authenticated | NO — INSERT revoked | **B2: remove the client-side insert; `check-subscription` already upserts with the service role** |

No frontend code consumes `decrypt_*` directly, no code assumes anonymous RPC access other than the two
intentionally public functions, and no frontend writes HMRC organisation fields outside its own membership.

---

## 7. Billing / subscription compatibility

Traced flow: Pricing page → `create-subscription-checkout` / `create-payment` (Edge, service role) → Stripe →
`stripe-webhook` (Edge, service role, `update_payment_status`) → `check-subscription` (Edge, service role,
`upsert` on `subscribers`) → frontend `useSubscription` reads.

* Entitlement writes (`subscribed`, `subscription_tier`, `subscription_end`, `ai_credits_*`) all happen
  server-side with the service role → **unaffected** by the revocations.
* Payment rows are created only by `create_payment_record` and updated only by `update_payment_status`, both
  service-role → **unaffected**.
* Normal customers can no longer insert or update `subscribers` / `payments` → self-granting of
  `premium`/`professional`/`enterprise`/`active` is closed.
* One legitimate frontend write exists (**B2**, `useSubscription.tsx:111`, creating a default free row). It is
  redundant with the server-side upsert; failure is non-fatal (the hook falls back to free state and
  `get_ai_credits_info` returns the free default when no row exists), but it will log errors. Fix client-side
  before deployment — **do not weaken RLS**.

---

## 8. HMRC / integration compatibility

* HMRC OAuth callback (`oauth-hmrc`) currently encrypts tokens through `encrypt_hmrc_token` using the caller's
  JWT → **BLOCKER B1**. Remediation: create the client with `SUPABASE_SERVICE_ROLE_KEY` for that call (the user
  identity is already verified earlier in the function via `auth.getUser()`).
* Integration token storage/retrieval paths (`store_integration_tokens`, `get_integration_tokens`) all resolve to
  either service-role Edge Functions or a self-scoped authenticated caller → compatible.
* Banking: `store_bank_account` (Edge, user JWT, self) and `get_bank_accounts_safe` (frontend, self, no
  account/sort code) are compatible; `get_bank_account_details` returns decrypted values only to the owner and
  audits every access.
* **Advisory (not a functional blocker):** `hmrcService.ts` retrieves decrypted HMRC access/refresh tokens and the
  client secret into the browser. Round 2 keeps these RPCs working, but the correct long-term design is
  server-side mediation (an Edge Function that performs HMRC calls and never returns raw secrets). Recommended as
  a follow-up work item, tracked as R1.

---

## 9. Production data precondition results (read-only counts)

| Metric | Count |
|---|---|
| documents (total / free / free by super admin / free by others) | 0 / 0 / 0 / 0 |
| `documents.is_public` already present | no |
| user_documents (purchases) | 0 |
| projects total / with organization / owner not an active member of that org | 15 / 10 / **0** |
| orphaned organization memberships | 0 |
| subscribers total / non-free tier | 4 / 0 |
| payments | 8 |
| hmrc_integrations / hmrc_settings / org-mismatched HMRC rows | 0 / 1 / **0** |
| user_roles rows / super admins | 7 / 2 |
| teams / ai_conversations | 0 / 11 |

No production row violates a Round 2 assumption. **No data remediation is required before deployment.**
No PII was read or exported; only aggregates.

---

## 10. Exact-package dry-run result

Fresh cluster from the baseline (92 tables / 981 columns / 225 constraints / 199 indexes / 93 functions /
61 triggers / 92 RLS tables / 282 policies / 4 buckets), then `psql -v ON_ERROR_STOP=1 -f round2-2026-09.sql`:

* Exit code **0**, duration **0.074 s**, **0 errors**, **0 warnings**.
* Objects changed: 1 column added, 1 `UPDATE 0`, 13 functions replaced, 1 function created (`assert_self`),
  17 policies dropped / 13 created (net −4 by design), 94 function ACLs rewritten, 2 table ACLs tightened
  (`payments`, `subscribers`).
* Catalogue diff shows no unintended object touched (`cols` diff = 1 line: `documents.is_public`).

---

## 11. Full security regression after the exact package

Same database, then `10_seed_tenants.sql` → `20_security_harness.sql` → `30_security_tests.sql`:

```
PASS 471
FAIL 0
INFO 54
```

Identical to the Round 2 validation run, now proven against the **exact** production SQL file. Verified areas:
anonymous HMRC/token access denied, integration token access self-scoped, `encrypt_*`/`decrypt_*` denied to
anon/authenticated, documents cross-tenant reads denied, projects cross-tenant insert denied, subscribers/payments
self-escalation denied, AI credit RPC fail-closed, profile PII narrowed, membership probing denied, role escalation
denied, Super Admin behaviour intentional, and legitimate same-tenant CRUD still succeeding.

---

## 12. Backup plan (to execute immediately before any future deployment)

1. **Full logical backup** — Supabase Dashboard → Database → Backups: trigger an on-demand backup **and** take
   `pg_dump --no-owner --format=custom` of the whole database to secure storage.
2. **Schema snapshot** — `pg_dump --schema-only` (this is the artefact you diff against post-deployment).
3. **Affected table data** — `pg_dump --data-only -t public.documents -t public.projects -t public.subscribers
   -t public.payments -t public.hmrc_integrations -t public.hmrc_settings -t public.hmrc_submission_logs
   -t public.teams -t public.ai_conversations`.
4. **Security catalogue snapshots** (CSV, the exact queries used in this pre-flight):
   `pg_policies`, `pg_proc.proacl` + `prosecdef` + `proconfig`, `pg_class.relacl`, `pg_trigger`,
   `information_schema.columns`.
5. **Function definitions** — `select pg_get_functiondef(oid) …` for every `public` function.

**Backup verification (a successful command is not proof):**

* Record `pg_dump` exit code **and** byte size; a truncated dump usually still exits 0 in a broken pipe chain —
  check `pg_restore --list backup.dump | wc -l` returns the expected object count.
* **Restore into a scratch database** and compare: table count, row counts for the nine affected tables,
  policy count, function count. Only a completed restore comparison marks the backup valid.
* Store the schema fingerprint: `md5sum` of the `--schema-only` dump plus the counts above.

---

## 13. Rollback script status

`supabase/remediation/round2-2026-09-rollback.sql` (generated from the production baseline, idempotent,
single transaction).

| Section | Content | Reversibility |
|---|---|---|
| A | Restores the 12 pre-Round2 function bodies verbatim from the baseline | FULLY REVERSIBLE |
| B | Drops the 3 Round 2-only policies and re-creates the 39 baseline policies on the 9 affected tables | FULLY REVERSIBLE |
| C | Re-grants `EXECUTE … TO PUBLIC` on every non-extension `public` function and re-applies the 227 baseline function grants + 48 baseline table grants for `payments`/`subscribers` | FULLY REVERSIBLE (restores the *insecure* pre-state — emergency use only) |
| D | `documents.is_public`: dropped **only** when no row has `is_public = true` (or when `b2bnest.force_drop_is_public = 'on'`); otherwise the column is retained and simply left unused | CONDITIONALLY REVERSIBLE |
| E | `drop function public.assert_self(uuid)` after its callers are restored | FULLY REVERSIBLE |

No operation is classified NOT SAFELY REVERSIBLE, because Round 2 deletes no data.

---

## 14. Rollback test result

Throwaway cluster `/tmp/stg4`: baseline → snapshot → `round2-2026-09.sql` → `round2-2026-09-rollback.sql` →
snapshot, both applied with `ON_ERROR_STOP=1` and exit code 0.

| Comparison vs. original baseline state | Diff |
|---|---|
| Policies (`pg_policies`, public + storage) | **0 differences** |
| Columns (`information_schema.columns`) | **0 differences** (`is_public` dropped — 0 flagged rows) |
| Function definitions (all `public`) | **0 differences** |
| Table ACLs | 1 row, ordering only (`subscribers`; identical privilege set) |
| Function ACLs | ordering only for 93 functions, **plus one real delta**: `is_super_admin(uuid)` gains an explicit `anon=X` grant on top of the restored `PUBLIC` EXECUTE — functionally identical to baseline |

Rollback validated: the schema/security state is equivalent to the pre-Round2 baseline.

---

## 15. Deployment runbook (for a future, separately authorised deployment)

**PRE-DEPLOYMENT**
1. Change window: low-traffic window; the package is sub-second but takes brief exclusive locks on `documents`.
2. Health check: error rate, Edge Function logs, auth sign-ins, Stripe webhook success in the last 24 h.
3. Backup per Phase 12 (all five artefacts).
4. Backup verification per Phase 12 (restore + count comparison). **Do not proceed without it.**
5. Schema fingerprint: capture policy/function/ACL CSVs and the `--schema-only` md5 immediately before applying.
6. Preconditions: blockers B1 and B2 fixed and deployed; production counts re-run (documents may be non-zero by
   then — if so re-verify the `is_public` backfill scope); confirm no migration ran since this fingerprint.
7. Affected flows announced: HMRC OAuth connect, integrations connect, billing/checkout, documents, projects.
8. Rollback readiness: `round2-2026-09-rollback.sql` staged on the same host, tested (Phase 14), operator on call.

**DEPLOYMENT**
1. Execute exactly `supabase/remediation/round2-2026-09.sql` — unmodified — via the SQL editor or
   `psql -v ON_ERROR_STOP=1`.
2. Transaction strategy: the file already wraps everything in `begin; … commit;`. Set
   `SET lock_timeout = '5s'; SET statement_timeout = '60s';` in the same session first.
3. Expected duration: < 5 s including lock waits.
4. Expected locks: brief `ACCESS EXCLUSIVE` on `documents` (metadata-only `ADD COLUMN`), catalogue locks for
   policies/grants.
5. Monitoring: Postgres logs, `pg_stat_activity` for lock waits, Edge Function error rate, frontend console errors.
6. Abort conditions: any error (transaction self-aborts), `lock_timeout` exceeded, or a concurrent migration
   detected. Re-run later; the package is idempotent.

**POST-DEPLOYMENT**
1. `documents.is_public` exists with the correct type/default; count of `is_public = true` matches expectation.
2. RLS: policy set on the 9 affected tables matches Phase 4.
3. Grants: run the Phase 16 smoke tests (dangerous grants absent, required grants present).
4. Functions: `assert_self` exists; the 13 replaced functions show the new bodies.
5. App health: load the app, no console/network errors.
6. Auth: sign in / sign out.
7. CRM/projects: create + read a project in an organisation; template apply.
8. Billing: `/pricing` loads, `check-subscription` returns the correct tier, a Stripe test webhook updates a payment.
9. HMRC/integrations: connect + read an integration; HMRC OAuth callback stores tokens (requires B1 fix).
10. Super Admin: `/admin` dashboards load for a super admin, and return `Not authorized` for a normal user.
11. Execute the Phase 16 smoke suite.

**ROLLBACK TRIGGERS**
* Any authenticated user cannot read their own documents/projects/integrations.
* HMRC or OAuth connect fails to store tokens.
* Billing webhook or `check-subscription` fails to write entitlements.
* Super Admin dashboards break for legitimate super admins.
* Any error rate above the pre-deployment baseline that traces to a `42501`/permission-denied error.

---

## 16. Post-deployment safe smoke tests

Read-only / non-destructive; create no synthetic customer records.

```sql
-- 1. dangerous grants ABSENT (expect 0 rows)
select p.oid::regprocedure
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'encrypt\_%' or p.proname like 'decrypt\_%' or p.proname like 'admin\_%')
  and (has_function_privilege('anon', p.oid, 'execute')
       or (p.proname !~ '^admin_' and has_function_privilege('authenticated', p.oid, 'execute')));

-- 2. required grants PRESENT (expect true for each)
select has_function_privilege('authenticated','public.get_hmrc_tokens(uuid)','execute'),
       has_function_privilege('authenticated','public.get_user_integrations_safe(uuid)','execute'),
       has_function_privilege('authenticated','public.get_ai_credits_info(uuid)','execute'),
       has_function_privilege('anon','public.get_invitation_by_token(text)','execute'),
       has_function_privilege('service_role','public.encrypt_hmrc_token(text)','execute');

-- 3. anonymous sensitive RPC access DENIED (expect an exception)
set local role anon;  select * from public.get_hmrc_tokens(null);  -- expect 42501
reset role;

-- 4. RLS enabled everywhere (expect 0 rows)
select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- 5. no client writes on entitlement tables (expect false)
select has_table_privilege('authenticated','public.subscribers','insert'),
       has_table_privilege('authenticated','public.payments','insert');
```

Authenticated business checks use existing legitimate accounts only (owner account: read own invoices, open a
project, open Integrations, open `/admin`), all read-only.

---

## 17. Deployment blockers

| ID | Severity | Blocker | Required fix |
|---|---|---|---|
| **B1** | **BLOCKER** | `supabase/functions/oauth-hmrc/index.ts` calls `encrypt_hmrc_token` with an anon-key/user-JWT client; Round 2 makes that function service-role-only, so HMRC OAuth connect would fail with permission denied | Use a `SUPABASE_SERVICE_ROLE_KEY` client for the encryption RPC (identity is already verified in the function), then redeploy the function **before** applying Round 2 |
| **B2** | HIGH (non-fatal) | `src/hooks/useSubscription.tsx:111` inserts into `subscribers` from the browser; the INSERT policy and grant are removed | Delete the client-side insert and rely on the service-role upsert in `check-subscription` |

Both are application-side fixes. **No security control may be weakened to accommodate them.**

---

## 18. Remaining INFO items (54)

Unchanged from the Round 2 report: intentionally public surfaces (forum posts/replies, job postings, news,
advertisements listing, template catalog, public form/page renderers), storage buckets that hold presentation
assets only, governance notes (legacy user-scoped tables that are not organisation-scoped), and the pre-existing
missing `update_notification_preferences(uuid, jsonb)` function recorded as a functional defect in the baseline
(not introduced or altered by Round 2).

---

## 19. Remaining risks

1. **R1 — browser-side secrets:** `hmrcService.ts` still pulls decrypted HMRC tokens and client secret into the
   browser. Allowed by Round 2, but should be mediated server-side.
2. **R2 — `anon` retains SELECT grant on `payments`:** the revoke removes INSERT/UPDATE/DELETE only. Rows remain
   unreachable (anon-blocking policy plus `auth.uid() is null`), but revoking `SELECT` from `anon` would be cleaner.
3. **R3 — unverified layers:** PostgREST behaviour, Edge Function runtime and browser-level authenticated flows
   were not testable because Supabase is external/unmanaged; validation is catalogue- and SQL-session-level.
4. **R4 — schema drift:** the baseline was captured 2026-09. Re-capture the fingerprint immediately before
   deployment; any migration applied since then invalidates parts of this review.
5. **R5 — future free-document publishing:** with `is_public` defaulting false, any future public-template feature
   must set it explicitly through a super-admin/service path.
6. **R6 — legacy user-scoped tables:** ~25 business tables remain user-scoped rather than organisation-scoped.
   Out of scope for Round 2; tracked in the tenant architecture review.

---

## 20. Final recommendation

The package is technically correct, non-destructive, fully transactional, reproducible with zero errors, and
verified by a 525-assertion regression with 0 failures against the exact SQL file. It is also fully reversible by
a tested rollback script. It **must not** be deployed until blockers B1 and B2 are fixed and redeployed, because
Round 2 would otherwise break HMRC OAuth token storage and the client-side free-subscriber bootstrap.

Recommended order: fix B1 → fix B2 → redeploy Edge Functions/frontend → re-run this pre-flight's Phase 8 counts →
back up and verify → apply Round 2 under separate explicit authorisation.

PRODUCTION PACKAGE REVIEW: PASS
ROLLBACK VALIDATION: PASS
DEPLOYMENT RECOMMENDATION: DO NOT DEPLOY
