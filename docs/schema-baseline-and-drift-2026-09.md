# B2BNest — Schema-only production baseline & migration drift (2026-09)

Phase goal: produce a safe, schema-only, reproducible non-production database baseline and rebuild an
isolated staging database from it. No production change of any kind was made.

---

## 1. Production remained read-only

Only `SELECT` statements were issued against production, all through the read-only query tool:
`pg_class`, `pg_attribute`, `pg_attrdef`, `pg_constraint`, `pg_indexes`, `pg_proc`, `pg_trigger`,
`pg_policies`, `pg_type`/`pg_enum`, `pg_extension`, `pg_views`/`pg_matviews`, `aclexplode(...)` and
`storage.buckets` (metadata columns only).

No `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER`, `CREATE`, `DROP`, `GRANT` or `REVOKE` was executed
against production. No migration was submitted. No production auth, storage, secret or Stripe configuration
was touched. All build/apply work happened on a throwaway local PostgreSQL 17 cluster
(`/tmp/stg2`, unix socket `/tmp/pgs2`, port `55433`, `listen_addresses=''` — not reachable off-host).

## 2. Extraction method

DDL was reconstructed from the production catalog and emitted as SQL text by the queries themselves:

| Object class | Source |
|---|---|
| extensions | `pg_extension` + `pg_namespace` |
| enums | `pg_type` / `pg_enum` |
| tables, columns, defaults, identity, NOT NULL | `pg_class` / `pg_attribute` / `pg_attrdef` / `format_type()` |
| PK / UNIQUE / CHECK / FK | `pg_constraint` + `pg_get_constraintdef()` |
| indexes (non-constraint) | `pg_indexes.indexdef` |
| views | `pg_views.definition` (no materialized views exist) |
| functions (incl. SECURITY DEFINER, volatility, `SET search_path`) | `pg_get_functiondef()` |
| triggers | `pg_get_triggerdef()` |
| RLS enablement | `pg_class.relrowsecurity` |
| policies (public + storage) | `pg_policies` (permissive/cmd/roles/using/with check) |
| table, view and function grants | `aclexplode(relacl / proacl)` restricted to `anon`, `authenticated`, `service_role` |
| storage buckets | `storage.buckets` — `id`, `name`, `public`, `file_size_limit` only |

Vault and `auth` internals are **not** exported; staging gets structural stand-ins from
`scripts/staging/00_supabase_shim.sql`.

## 3. Zero production row data

The baseline contains no `SELECT`-ed rows from any application table. The only top-level `INSERT`
statements in the file are the four storage **bucket configuration** rows (bucket id/name/public flag),
which are configuration, not customer data. Every other `INSERT` occurrence is source code *inside*
function bodies (e.g. `INSERT INTO public.audit_logs (...)` within `log_user_action`).

Verified on the rebuilt database: total row count across all 92 public tables = **0**.

Excluded as required: `auth.users`, identities, sessions, profiles, organizations, CRM, finance,
invoices, payroll, AI history, documents, payments, audit rows, `storage.objects`, vault contents.

## 4. Zero secrets

Static scan of the baseline file:

| Pattern | Hits |
|---|---|
| email addresses | 0 |
| UUID literals (real user/org ids) | 0 |
| JWT-shaped strings (`eyJ...`) | 0 |
| Stripe keys (`sk_live`, `sk_test`, `pk_live`, `whsec_`) | 0 |
| private key blocks | 0 |
| `service_role_key` / `jwt_secret` literals | 0 |
| `secret/password/api_key/token := '<literal>'` | 0 |
| top-level data `INSERT`s | 0 (only 4 bucket config rows) |

**No redaction was necessary** — no schema object embeds a secret literal. Encryption functions read their
key from `vault`/settings at runtime rather than a hardcoded constant (this was the earlier
`hardcoded_enc_fallback` remediation), so nothing sensitive is carried in the definitions.

## 5. Production vs repository drift

Comparison of the 92 production tables and 93 production functions with `supabase/migrations/` (175 files):

| Class | Objects |
|---|---|
| **A. MISSING CREATE MIGRATION** | `organizations`, `organization_members`, `profiles`, `project_members`, `notifications` — no `CREATE TABLE` statement exists anywhere in the repository |
| **B. MISSING ALTER MIGRATION** | Columns added out-of-band on `profiles`, `projects`, `advertisements`, `organizations` (status/plan fields) — visible as "column does not exist" during replay |
| **C. MISSING FUNCTION** | none by name: all 93 functions appear in some migration, but 18 replay failures are `public.handle_updated_at() does not exist` because the migrations that define shared helpers are ordered *after* the migrations that use them, and themselves failed |
| **D. MISSING TRIGGER** | none uniquely missing — triggers fail only as a consequence of A/C |
| **E. MISSING POLICY** | none uniquely missing — policies fail only as a consequence of A |
| **F. MISSING GRANT** | table-level grants for `anon`/`authenticated`/`service_role` are largely implicit in production (Supabase defaults) and are not reproduced by repository migrations; the baseline captures the real ACLs |
| **G. MANUAL / OUT-OF-BAND** | the five root tables above, several column additions, `supabase_realtime` publication membership, `pg_cron`/`pg_net`/`supabase_vault` extensions |
| **H. UNKNOWN** | one migration with `syntax error at or near "location"`; one with `input parameters after one with a default value must also have defaults` — both are broken as committed and never applied in this form |

## 6. Root causes of the 118 failed migrations

The failures are **not** independent. Grouped by first cause:

| Root cause | Direct errors | Cascaded migrations |
|---|---|---|
| `public.profiles` never created | 21 | largest cascade — profiles is referenced by policies, FKs, views (`public_profiles`) and admin functions |
| `public.projects` missing (depends on organizations) | 11 | project members/activities/time entries/share logs |
| `public.organizations` + `organization_members` missing | 7 | every org-scoped policy, HMRC, rota, todos org path |
| `public.advertisements` / `advertisement_categories` missing | 11 | ad policies, contact-info RPC |
| `handle_updated_at()` not yet defined at use time | 18 | all `updated_at` triggers |
| other missing relations (payments, quotes, teams, staking, security_audit_logs, user_integrations, hmrc_*) | ~23 | domain-local |
| unavailable extensions (`pg_cron`, `pg_net`) in the local cluster | 2 | scheduled jobs / http calls |
| genuinely broken SQL in two committed migrations | 2 | – |
| `supabase_migrations.schema_migrations` / `supabase_realtime` publication absent locally | 2 | – |

Conclusion: **the repository migration history is not replayable from zero.** It only ever worked as a
sequence of deltas applied on top of a database whose foundation tables were created outside version
control (dashboard/table-editor or squashed history).

## 7/8. Missing schema objects and helpers

- Tables with no create migration: `organizations`, `organization_members`, `profiles`, `project_members`,
  `notifications`.
- Shared helpers unavailable at replay time: `handle_updated_at()`, `update_post_reply_stats()`,
  `check_trial_status()`, plus every helper defined in a migration that failed earlier
  (`is_super_admin`, `has_role`, `user_is_organization_member/admin/owner`, `user_can_access_project`,
  `is_project_member`, `owns_team`, `is_team_member`, `users_share_organization`).
- View `public.public_profiles` (depends on `profiles`).

All of these are now present in the baseline.

## 9. Baseline file location

```
supabase/baseline/production-schema-baseline-2026-09.sql   (~372 KB, 7.3k lines)
scripts/staging/00_supabase_shim.sql                       (Supabase-compatible prerequisites)
scripts/staging/rebuild-from-baseline.sh                   (local-only rebuild + parity report)
```

It is deliberately **outside** `supabase/migrations/`, so `supabase db push` will never pick it up, and the
file header states *FOR NEW STAGING / TEST ENVIRONMENTS ONLY*. `rebuild-from-baseline.sh` refuses to run
against a non-local `PGHOST`.

## 10. Safety / redaction scan result

**PASS — no production data or secrets.** See section 3 and 4. Nothing was redacted because nothing
sensitive was found.

## 11. Fresh rebuild result

A brand-new throwaway cluster was initialised and built with exactly two files:

1. `scripts/staging/00_supabase_shim.sql` — roles (`anon`, `authenticated`, `service_role`,
   `authenticator`, supabase admin roles), schemas (`auth`, `storage`, `extensions`, `vault`, `realtime`,
   `graphql_public`), structural `auth.users/identities/sessions`, `storage.buckets/objects`,
   `auth.uid()/jwt()/role()/email()`, `net.http_post` stub. **0 errors.**
2. `supabase/baseline/production-schema-baseline-2026-09.sql`. **0 errors.**

One correction was required during this phase and is already applied: production installs `uuid-ossp` into
the `extensions` schema (column defaults call `extensions.uuid_generate_v4()`), so the shim now creates it
there; and the baseline now includes the `public_profiles` view, which the first draft omitted.

## 12. Schema parity result

| Metric | Production | Rebuilt staging | Match |
|---|---|---|---|
| public tables | 92 | 92 | YES |
| public columns | 981 | 981 | YES |
| views / materialized views | 1 / 0 | 1 / 0 | YES |
| PK+UNIQUE+CHECK+FK constraints | 225 | 225 | YES |
| indexes | 199 | 199 | YES |
| functions (excluding extension-owned) | 93 | 93 | YES |
| triggers | 61 | 61 | YES |
| tables with RLS enabled | 92 | 92 | YES |
| policies (public + storage) | 282 | 282 | YES |
| enum types | 2 | 2 | YES |
| storage buckets | 4 | 4 | YES |
| rows of application data | (production) | **0** | intended |

## 13. Remaining differences (documented and accepted)

1. `pg_cron`, `pg_net`, `pg_stat_statements`, `supabase_vault` are not installed in the local cluster;
   `net.http_post` is a no-op stub and vault is a structural schema only. Any scheduled job or outbound
   HTTP call is inert in staging.
2. `pgcrypto` lives in `public` locally (plus `extensions`), adding 36 extension-owned functions that do
   not count toward application parity.
3. `auth.*` is a structural stand-in: no GoTrue, no password hashing, no JWT issuance. Test sessions must
   be simulated with `set local request.jwt.claims`.
4. `storage.objects` is a structural table; no object storage backend. Storage policy logic is testable,
   file transfer is not.
5. Realtime publication membership (`supabase_realtime`) is not reproduced.
6. Supabase-managed roles (`supabase_auth_admin` etc.) are local stand-ins with different privileges.
7. Production platform settings outside the database (leaked-password protection, Postgres minor version)
   are unchanged and out of scope here.

None of these affect RLS, policy, grant or function-level tenant-isolation testing.

## 14. Recommended canonical migration strategy

- **Fresh staging / test builds:** `00_supabase_shim.sql` → `production-schema-baseline-2026-09.sql`.
  Do **not** replay the 175 historical migrations — they are not replayable from zero and the baseline
  already contains their net effect.
- **Future development:** write new migrations normally in `supabase/migrations/`. Every new migration
  applied to production must also apply cleanly on top of the baseline; regenerate the baseline after each
  significant schema change (or at least quarterly).
- **Production upgrades:** unchanged — forward-only migrations through the migration tool. The baseline is
  never executed against production.
- **Do not** squash or edit the historical migration files: they record what production actually received.
- Optional hardening: commit a dated regeneration of the baseline so staging can be rebuilt at any point in
  time, and add the parity query from `rebuild-from-baseline.sh` to CI.

## 15. Readiness for Company A/B testing

Structural parity is complete: all 92 tables, 981 columns, 225 constraints, 199 indexes, 93 functions,
61 triggers, 282 policies and RLS on every table are reproduced with zero data. The environment can now
host synthetic Company A / Company B tenants and execute the 30-case matrix from
`docs/tenant-architecture-review-2026-09.md` §8 using simulated JWT claims.

Caveat carried forward: the tests will exercise **database** authorisation (RLS, grants, SECURITY DEFINER),
not GoTrue login or real object storage.

---

SCHEMA PARITY: PASS

TENANT SECURITY TESTING: READY
