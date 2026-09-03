# B2BNest — Controlled Production Security Deployment (2026-09)

Scope: authorized deployment of the validated Round 2 security remediation package
(`supabase/remediation/round2-2026-09.sql`) and the two associated application fixes
to PRODUCTION (Supabase project `gvftvswyrevummbvyhxa`).

## 1. Target verification (PASS)

- Project ref: `gvftvswyrevummbvyhxa` (b2bnest.online / www.b2bnest.online)
- PostgreSQL 17.4
- Pre-deployment catalog: 92 public tables, 981 columns, 93 public functions,
  61 triggers, 92 RLS-enabled tables, 270 public policies + 12 storage policies
  (matches the 282-policy schema baseline).
- Round 2 markers absent before deployment (`documents.is_public`, `assert_self`) —
  confirming the package had not previously been applied.

## 2. Drift check (PASS)

Function-definition, policy, trigger and column fingerprints compared against
`supabase/baseline/production-schema-baseline-2026-09.sql`: no material drift.

## 3. Backup / rollback readiness (PASS)

- Schema baseline restored and verified locally: 92 tables, 981 columns, 93 functions,
  61 triggers, 92 RLS tables, 282 policies, 4 buckets.
- Rollback package present and previously validated end-to-end in isolated staging:
  `supabase/remediation/round2-2026-09-rollback.sql`.

## 4. Package integrity (PASS)

| Artifact | SHA-256 |
| --- | --- |
| `supabase/remediation/round2-2026-09.sql` (484 lines) | `4c73479083b79e7cafa6ba79f75229dbe25c054de18d3a82af520efac6895f71` |
| `supabase/remediation/round2-2026-09-rollback.sql` | `270f9a6055aef2b909f25f52306ff2807d505297c1f36801deb4167ac4bdbb67` |
| `supabase/baseline/production-schema-baseline-2026-09.sql` | `239e001551aafe1be68cd7616418683dc4c27b3fbec7615570e6ffdecf498b4a` |

The exact reviewed package was applied — no edits, no partial application.

## 5. Application artifact scan (PASS)

- Typecheck and production build succeeded (only the pre-existing Vite large-chunk warning).
- Bundle secret scan: `NO_MATCHES`.
- Embedded JWT role scan: `anon` only — no service-role key in client artifacts.

## 6. Database remediation (PASS)

Round 2 applied in a single transaction. Post-migration verification:

| Check | Result |
| --- | --- |
| `public.assert_self` exists | yes |
| `documents.is_public` column exists | yes |
| `documents_select_owned_purchased_or_public` policy | present |
| `subscribers` policies | 1 (`select_own_subscription` only) |
| `subscribers` INSERT/UPDATE/DELETE grants to anon/authenticated | 0 |
| `payments` INSERT/UPDATE/DELETE grants to anon/authenticated | 0 |
| "Users can insert their own payments" policy | removed |
| Public tables / policies | 92 / 269 |
| Row counts (unchanged) | projects 15, subscribers 4, payments 8, profiles 5 |

Function privilege verification:

- All `encrypt_*` / `decrypt_*` functions and `assert_self`: no EXECUTE for `anon` or `authenticated` (service-role only).
- `get_hmrc_tokens`, `get_ai_credits_info`, `get_user_display_info`: `authenticated` only.
- `get_invitation_by_token`: intentionally `anon` + `authenticated`.

No data loss; no destructive change beyond the intended policy/grant tightening.

## 7. Application deployment (PASS)

Edge Functions deployed from the reviewed source:

- `oauth-hmrc` — authenticates the caller with the anon/user-JWT client, then performs
  settings lookup, client-secret decryption, HMRC token exchange, token encryption and
  storage exclusively through the in-function service-role client.
- `check-subscription`, `stripe-webhook` — trusted entitlement writers (now the only
  paths able to write `subscribers`).

Frontend fixes are in the built artifact (`hmrcService.ts` sends only `{ code, state }`;
`useSubscription.tsx` no longer inserts into `subscribers`; `LivePurchaseNotification.tsx`
degrades silently on restricted reads). They go live with the next publish of the site.

## 8. Production security smoke tests (PASS)

Anonymous (anon key) requests against production:

| Test | Expected | Observed |
| --- | --- | --- |
| `rpc/get_hmrc_tokens` | denied | 401 `permission denied for function get_hmrc_tokens` |
| `rpc/decrypt_hmrc_token` | denied | 401 `permission denied for function decrypt_hmrc_token` |
| `GET /subscribers` | denied | 401 `permission denied for table subscribers` |
| `POST /subscribers` (self-escalation) | denied | 401 `permission denied for table subscribers` |
| `GET /documents` | no cross-tenant rows | 200 `[]` |
| `POST /functions/v1/oauth-hmrc` unauthenticated | denied | 401 `UNAUTHORIZED_NO_AUTH_HEADER` |
| Site health `https://b2bnest.online/` | reachable | 302 (canonical redirect) |

## 9. Post-deployment linter notes (informational)

The Supabase linter reports `SECURITY DEFINER` functions executable by `anon` (14) and
`authenticated` (61). These are the intentional, least-privilege grants defined by the
reviewed package: RLS helper predicates (`has_role`, `is_super_admin`, organization
membership checks) that must be callable inside policies, the two intentionally public
functions, and the guarded per-user/admin RPCs — each of which now enforces
`assert_self()` or `is_super_admin()` internally. Two platform-level warnings remain and
require account-owner action in the Supabase dashboard:

- Leaked-password protection is disabled (Auth settings).
- A Postgres security patch upgrade is available.

## 10. Rollback

Not required. Rollback package remains available and validated if needed.

```text
DATABASE REMEDIATION: PASS
APPLICATION DEPLOYMENT: PASS
PRODUCTION SECURITY SMOKE TEST: PASS
ROLLBACK REQUIRED: NO
B2BNEST PRODUCTION SECURITY STATUS:
READY
```
