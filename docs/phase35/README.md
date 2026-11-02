# Phase 35: AI credit ledger, real AI cost, trial credits 10 → 50

Nothing here is applied. The owner reviews; the SQL is applied through the Supabase tools after approval.

## Rollout order
1. `docs/phase35/proposal.sql` (one transaction; refuses on any drift from the 2 Nov 2026 production bodies, hashes and
   privileges). Until step 2 the old two-argument calls keep working (the new parameters are defaulted).
2. Deploy the flattened Edge Functions (`node scripts/flatten-function.mjs <name> <outdir>`):
   - `ai-assistant`: changed `handler.ts`, `index.ts`, `knowledge.ts`; new `shared_ai-ledger.ts`.
   - `generate-legal-document`: changed `handler.ts`, `index.ts`; new `shared_ai-ledger.ts`.
   - `generate-template`, `business-insights`: unchanged (byte-identical flattened output).
3. Publish the frontend.

Rollback: Edge Functions to the previous deployment first, then `docs/phase35/rollback.sql` (drops the ledger: export it
first if you want the history).

## Tests
`PG_RUN_USER=postgres bash docs/phase35/run-test.sh`: a disposable Postgres 16 with the Supabase shim, Supabase's default
privileges for new objects, and the replaced functions copied verbatim from production (their md5 is checked against
production first). 87 checks: apply, every rule, a second apply refused, a drifted body refused with nothing applied,
rollback to the exact production bodies / privileges / Phase 25 guard log rows, and apply again.

## Privileges copied (pg_proc.proacl, production, 2 Nov 2026)
| Function | Old | New (same set) |
|---|---|---|
| `check_and_deduct_ai_credit` | `{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}` | `(uuid,integer,text,uuid)`: postgres, service_role, authenticated |
| `refund_ai_credit` | `{postgres=X/postgres,service_role=X/postgres}` | `(uuid,integer,text,uuid)`: postgres, service_role |
| `get_ai_credits_info` | unchanged (CREATE OR REPLACE keeps it) | |
| `record_ai_usage` (new) | | postgres, service_role |
| `admin_ai_ledger_summary` (new) | | postgres, service_role, authenticated (as `admin_ai_stats`; guarded inside) |

The proposal checks the saved privileges equal these sets before granting, and that anon can execute none of them.

## Security advisor expectations (`get_advisors`, security; baseline read 2 Nov 2026)
- `authenticated_security_definer_function_executable` (WARN, 92 today): `check_and_deduct_ai_credit` and
  `get_ai_credits_info` stay listed (as today, now with the new signature); `admin_ai_ledger_summary` is added (+1), the
  same as `admin_ai_stats` (guarded by `require_aal2_admin()` + `is_super_admin`). `refund_ai_credit` and
  `record_ai_usage` are not executable by `authenticated`, so they are not listed.
- `anon_security_definer_function_executable` (17): no change (anon can execute none of the new functions).
- `rls_enabled_no_policy` (INFO, 13): `phase35_function_backup` and `phase35_guard_log_backup` are added (+2, service-role
  backups, like `phase12_*_backup` and `phase25_mfa_guard_log`). `ai_credit_ledger` and `ai_model_prices` are not listed:
  they carry the Phase 25 restrictive policy.
- `function_search_path_mutable`: none; every new function sets `search_path ''`.
- Performance: the ledger FK `user_id` is covered by the `(user_id, created_at)` index.

## Decisions
- `generate-template` is not changed: it never calls `check_and_deduct_ai_credit`. It uses its own reserve / settle /
  refund RPCs (`ai_reserve_generation` …), which do not exist in production (template generation is switched off), so it
  cannot spend credits today. When it is switched on, it should be moved onto this ledger (feature `template`).
- Usage is recorded for every reply that has a `usage` block, including refused documents (too short) and empty answers:
  those tokens are a real cost.
- Usage is awaited for at most 1.5 s after the response is built (Supabase Edge Functions cannot run work after
  returning without `EdgeRuntime.waitUntil`, which the tests cannot exercise); a failure is logged with codes only.
- A failed refund is retried once with the same request id; the database refunds at most once per (user, request id).
- The optional "raise existing free 10-credit rows to 50" statement touches **0 rows today**: the 7 non-subscribed rows
  have tier NULL and limits 250 / 1,000 / 5,000. It is in the proposal, commented, with the count queries.
- Feature labels are validated by pattern, not a fixed list (so later features need no SQL). A user calling
  `check_and_deduct_ai_credit` directly can only label their own spending.
- Retention: 25 months; the table is append-only (trigger). A future purge sets `app.ai_ledger_purge = 'on'` in its own
  transaction.
