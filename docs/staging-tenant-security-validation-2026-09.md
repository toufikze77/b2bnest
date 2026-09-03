# B2BNest — Isolated staging environment & tenant security validation (2026-09)

**Outcome of this stage: the staging build stopped at Phase 2/3 (schema parity) exactly as the brief
requires. No security test from the 30-case matrix could be executed.**

---

## 1. Staging environment status

| Item | Status |
|---|---|
| Separate Supabase **staging project** | **NOT CREATED** — no capability in this environment to provision a second Supabase project (`LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged`, no Supabase CLI, no org admin credentials, no Docker). |
| Isolated **local** PostgreSQL 17 cluster | **CREATED** — unix socket `/tmp/pgsock`, port 55432, empty cluster created by `scripts/staging/build-staging.sh`. Contains no production data and no production credentials. |
| Supabase-compatible base layer | **CREATED** — `scripts/staging/00_supabase_shim.sql`: roles `anon`/`authenticated`/`service_role`/`authenticator`, `auth.users`, `auth.uid()`/`auth.jwt()`/`auth.role()` driven by `request.jwt.claims`, `storage.buckets`/`storage.objects` with `storage.foldername()`, `vault.secrets`, `net.http_post` stub, `pgcrypto`, `uuid-ossp`. |
| Repository migrations replayed | **PARTIAL — 57 of 175 applied, 118 failed.** |
| Synthetic users / tenant data | **NOT CREATED** — blocked by schema parity failure (see §3). |
| Test execution | **BLOCKED.** |

## 2. Confirmation production was untouched

- Every database write in this stage targeted the local cluster on `/tmp/pgsock:55432`.
- The only production interaction was **one read-only `SELECT`** of `pg_tables` (table-name inventory) used for the drift diff.
- No production migration was submitted, no RLS/policy/function/grant/storage/auth/secret/Stripe setting was changed, no production row was inserted, updated or deleted, and no production user was created.
- No production key or secret was copied into staging; the staging cluster uses local trust auth only.

## 3. Migration / schema parity status — **FAIL (drift)**

Replaying `supabase/migrations/*.sql` (175 files) in chronological order into an empty Supabase-shimmed database:

```
migrations applied: 57
migrations failed: 118
```

Full evidence: `scripts/staging/migration-replay-2026-09.log`.

Resulting staging schema: **35 tables**. Production: **92 tables**.

**57 tables missing from a clean replay**, including every core tenant object:

`organizations`, `organization_members`, `organization_invitations`, `profiles`, `projects`,
`project_members`, `project_activities`, `project_time_entries`, `project_share_logs`, `teams`,
`team_members`, `crm_contacts`, `crm_deals`, `invoices`, `quotes`, `expenses`, `outgoings`,
`suppliers`, `products_services`, `payments`, `payment_audit_logs`, `payment_notifications`,
`subscribers`-adjacent finance tables, `bank_accounts`, `bank_transactions`, `hmrc_integrations`,
`hmrc_settings`, `hmrc_submission_logs`, `integration_settings`, `user_integrations`,
`rota_employees`, `rota_shifts`, `rota_week_publications`, `audit_logs`, `security_audit_logs`,
`integration_audit_logs`, `notifications`, `messages`, `advertisements`, `advertisement_categories`,
`forum_posts`, `forum_replies`, `news_articles`, `staking_*`, `user_stakes`, `template_catalog`,
`template_events`, `business_insights`, `ai_workflows`, `user_ai_preferences`,
`user_document_templates`, `user_2fa_codes`, `user_2fa_settings`, `feedback_requests`.

Root causes visible in the log:
1. **Foundational migrations were never committed.** The repository has no `CREATE TABLE` for `profiles`, `quotes`, `organizations`, `projects` and others; later migrations `ALTER`/policy them and abort with `relation ... does not exist`.
2. **Missing shared helpers.** `public.handle_updated_at()`, `public.update_post_reply_stats()` and similar trigger functions are referenced but never created in source control (~30 failures).
3. **Dashboard/SQL-editor changes.** A large share of the production schema was created outside the migration flow, so source control is not the system of record.
4. One syntax-level failure (`syntax error at or near "location"`) in `20250708145517-*.sql`, i.e. a migration in the repo that is not currently applyable as written.

Per the brief's Phase 2 rule ("If the migrations cannot reproduce the current schema: STOP … Do NOT silently patch staging"), **no manual schema reconstruction was attempted** and the pipeline stopped here.

The seven remediation fixes themselves **are** in source control
(`supabase/migrations/20260903212008_*.sql` — `users_share_organization`, hardened
`add_project_member`/`add_team_member`, RPC guards, `prevent_super_admin_escalation`), but they
could not be applied to staging because their dependency tables are absent from the replay.

## 4. Environment map (Phase 1)

Secret **values** are never printed; only presence is reported.

| Dimension | PRODUCTION | STAGING (intended) | LOCAL/TEST (built) |
|---|---|---|---|
| Supabase project ref | `gvftvswyrevummbvyhxa` (external, user-managed) | none — not provisioned | n/a |
| Database | Supabase Postgres, live customer data | own DB, synthetic data | local PG 17 cluster, empty |
| Auth | Supabase GoTrue, real users | own GoTrue | shim `auth.users` + `request.jwt.claims` |
| Storage | 4 public buckets (`user-avatars`, `company-logos`, `advertisement-images`, `service-images`), created by dashboard, **not** in migrations | to be recreated | shim `storage.buckets/objects` tables only |
| API keys | anon key present in `.env` / client; service-role key **not stored** in this workspace | would need its own pair | none (local trust auth) |
| Service role | Supabase-managed; used by edge functions | separate | shim role `service_role` |
| Stripe / payments | live keys held as Supabase function secrets | must be test-mode keys | not exercised |
| Edge functions | 51 functions deployed, JWT settings in `supabase/config.toml` | would need separate deploy | not deployed |
| Frontend env | `.env` → production URL + publishable key | `.env.staging` (does not exist) | n/a |

Production-only dependencies that block a faithful isolated environment: storage bucket creation,
auth provider/email settings, per-function secrets (OAuth, HMRC, Stripe, SMTP, encryption key),
and the ~57 tables that exist only in the live database.

## 5–13. Test results

| Phase | Scope | Result |
|---|---|---|
| 4 | Synthetic users A_OWNER/A_ADMIN/A_MEMBER, B_*, TEST_SUPER_ADMIN, UNASSIGNED_USER | **BLOCKED** — `profiles`, `organizations`, `organization_members` absent from staging; creating them in production is forbidden. |
| 5 | Synthetic tenant data for A and B | **BLOCKED** — same cause. |
| 6 | 30-case matrix (`docs/tenant-architecture-review-2026-09.md` §8) | **BLOCKED — all 30 cases.** See table below. |
| 7 | Cross-tenant CRUD attacks | **BLOCKED** |
| 8 | Role/privilege escalation | **BLOCKED** (the `prevent_super_admin_escalation` trigger exists in source control but was not executable in staging) |
| 9 | RPC security (`add_project_member`, `add_team_member`, `get_user_projects`, `get_user_teams`, `get_team_members_with_profiles`, `check_and_deduct_ai_credit`, `create_payment_record`, `update_payment_status`, `users_share_organization`, `admin_*`, `encrypt_*`/`decrypt_*`, token accessors) | **BLOCKED for authenticated/role-based cases.** Only the previously recorded *anonymous* result stands (all return `42501 permission denied for function` with the production anon key) — that evidence predates this stage and is unchanged. |
| 10 | Membership attacks | **BLOCKED** |
| 11 | User-scoped table classification | **NOT RE-TESTED** — the static classification in `docs/tenant-architecture-review-2026-09.md` §2 stands; live behavioural confirmation is still outstanding. |
| 12 | Storage tests | **BLOCKED** — buckets exist only in production; testing writes/deletes there would create production objects. No private business files are stored in the four buckets (`documents.file_url` holds external links) — unchanged static finding. |
| 13 | Super Admin tests | **BLOCKED** for positive (super-admin) cases; negative anonymous cases already denied at the grant level. |
| 14 | Automated suite | **PARTIAL** — harness created (§ below), test cases not yet written because they cannot be executed. |

### 30-case matrix results

Every case from `docs/tenant-architecture-review-2026-09.md` §8.1 (cases 1–11) and §8.2 (cases 12–30):

| Test | Resource | Actor | Action | Target tenant | Expected | Actual | Status | Evidence / reason |
|---|---|---|---|---|---|---|---|---|
| 1–11 | CRM, projects, todos, teams, invoices, quotes, bills, expenses, payroll, documents, AI, org members, subscriptions, audit logs, storage | A1/A2/B1/B2/ANON | SELECT / INSERT / UPDATE / DELETE | own + cross | ALLOW / 0 rows / denied | not executed | **BLOCKED** | No authenticated staging session; tenant tables absent from replayed staging schema |
| 12 | Direct PostgREST cross-tenant query | A2 | GET | B | 0 rows | not executed | **BLOCKED** | No staging user JWT |
| 13–19 | `admin_*`, `add_project_member`, `add_team_member`, `get_user_projects`, `get_user_teams`, `get_team_members_with_profiles`, `check_and_deduct_ai_credit` | A2 / ANON | RPC | B / platform | `Not authorized` / `42501` | ANON: `42501 permission denied` (prior evidence); member/owner cases not executed | **PARTIAL / BLOCKED** | Anonymous denial verified earlier at grant level; role-based in-function authorization untested live |
| 20–21 | `user_roles`, `organization_members` self-escalation | A2 | INSERT/UPDATE | self | denied by policy + trigger | not executed | **BLOCKED** | Trigger present in source control only |
| 22–25 | Cross-tenant org/subscriber/audit writes | A1 / A2 | UPDATE/INSERT/DELETE | B / audit | 0 rows / denied | not executed | **BLOCKED** | — |
| 26–28 | Storage upload/update/delete/download on another tenant's path | A2 | write/read | B | denied | not executed | **BLOCKED** | Would require writing to production storage |
| 29–30 | All `admin_*` RPCs + audit entries | SA | RPC | platform | ALLOW + audit row | not executed | **BLOCKED** | No super-admin test session (production super admins must not be used) |

**No BLOCKED result has been converted to PASS.**

## 14. Automated test coverage created

Committed, rerunnable, credential-free:

- `scripts/staging/00_supabase_shim.sql` — Supabase-compatible auth/storage/vault/role layer for a local cluster.
- `scripts/staging/build-staging.sh` — creates the isolated cluster, applies the shim, replays every repository migration chronologically, reports applied/failed counts and refuses to run if `PGHOST` points anywhere non-local.
- `scripts/staging/migration-replay-2026-09.log` — evidence of the 118 failures.

The RLS/RPC assertion suite (cross-tenant SELECT/INSERT/UPDATE/DELETE, escalation, RPC grants, membership manipulation, failing the test run on any success) is **not yet written**: it needs a schema-complete staging target, which does not exist. `build-staging.sh` is the entry point it will hang off.

## 15. Failed tests

None failed — none could run.

## 16. Blocked tests

All of Phases 4–13 (see §5–13). Blockers, in order of severity:

| # | Blocker | Severity |
|---|---|---|
| B1 | Repository migrations cannot rebuild the schema (118/175 fail, 57/92 tables missing) — source control is **not** the system of record for the database | HIGH |
| B2 | No staging Supabase project can be provisioned from this environment (external user-managed project, no CLI/credentials) | HIGH |
| B3 | Storage buckets, auth settings and function secrets exist only as production dashboard configuration | MEDIUM |
| B4 | No authenticated test sessions can be minted (`external_unmanaged`); creating test users in production is forbidden | HIGH |

## 17. Recommended schema changes — DO NOT IMPLEMENT YET

1. **Repair migration history first.** Generate a baseline `supabase/migrations/00000000000000_baseline.sql` from a production **schema-only** dump (`pg_dump --schema-only --schema=public --schema=storage`) and mark the existing 175 files as historical, so a clean replay reproduces production exactly. This is the precondition for every remaining test.
2. Add the missing shared helpers (`handle_updated_at`, `update_post_reply_stats`, …) to the baseline.
3. Fix the unapplyable migration `20250708145517-*.sql`.
4. Then, and only then, the organization-scoping migrations listed in `docs/tenant-architecture-review-2026-09.md` §9 (`teams` first, then CRM/finance, then documents/AI).
5. Private `tenant-documents` bucket with `organization_id/...` paths before any real customer file upload ships.

## 18. Recommended production changes — DO NOT IMPLEMENT YET

- Create the `b2bnest-staging` Supabase project (owner action) and store its URL/anon key as `.env.staging`; never place service-role keys in source control.
- Enable leaked-password protection and upgrade Postgres (dashboard actions, pending since the audit).
- Export storage bucket + auth configuration into source control so environments are reproducible.
- Retire the legacy `app_role` values (`owner`, `admin`, `manager`, `moderator`).

## 19. Final production-readiness assessment

The seven remediation fixes are applied in production and statically verified, and anonymous RPC
denial is confirmed. But the authenticated Company A vs Company B matrix has still **never been
executed**, and this stage additionally revealed that the database cannot currently be rebuilt from
source control — which means an isolated, faithful staging environment cannot be produced until the
migration baseline is repaired.

**STRICT MULTI-TENANCY: BLOCKED**

**PRODUCTION READINESS: NOT READY**
