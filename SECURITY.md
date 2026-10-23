# Security

This page states only what has been checked, how, and when. It makes no score or certification claim.
To report a security problem, email the owner at the address on the site's contact page; please don't open a public issue.

## Checked facts (read-only queries on production `gvftvswyrevummbvyhxa`, 2026-10-23)

| Check | Result | How to re-check |
| --- | --- | --- |
| Row-level security on `public` tables | Enabled on all 114 tables | `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;` → 0 |
| `search_path` pinned on `public` functions | All 153 functions set it (142 are `security definer`) | `pg_proc.proconfig` contains `search_path=` |
| Supabase security advisor | 5 kinds of finding, listed below | Supabase dashboard → Advisors → Security |

### Open findings from the Supabase security advisor (2026-10-23)

| Level | Finding | Count | Notes |
| --- | --- | --- | --- |
| WARN | [Leaked password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) | 1 | Dashboard setting (Authentication → Passwords). Owner action. |
| WARN | [Postgres version has security patches available](https://supabase.com/docs/guides/platform/upgrading) | 1 | Platform upgrade. Owner action. |
| WARN | [`security definer` functions callable without signing in](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) | 16 | Some are intended (e.g. invitation preview by token); each needs review. |
| WARN | [`security definer` functions callable by any signed-in user](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) | 85 | Expected for RPCs that check permissions inside; each needs review. |
| INFO | [RLS enabled with no policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) | 2 | `onboarding_email_outbox`, `support_email_outbox`: deliberately unreadable through the API; only server functions use them. |

## Known limitations (true today)

- **Two-step sign-in is not enforced.** Signing in needs only a password. The screens say so; the design for real
  enforcement is in [`docs/phase11a/mfa-design.md`](docs/phase11a/mfa-design.md).
- **HMRC filing is not built.** Nothing is sent to HMRC. HMRC access/refresh tokens and the HMRC client secret are read
  into the browser through RPCs (`get_hmrc_tokens`, `get_hmrc_client_secret`), see `src/services/hmrcService.ts`. This
  should move server-side before any filing is built.
- **Plan user and admin limits are listed but not applied yet.** The plans and limits come from one catalogue
  (`src/lib/plans.ts`, matched by `supabase/functions/_shared/plans.ts`); enforcing the limits is a separate, approved
  database step prepared in [`docs/phase11b/`](docs/phase11b/README.md).
- Public browser settings (`VITE_SUPABASE_URL`, the publishable key) are committed on purpose; they are not secrets.
  Server secrets live in Supabase Edge Function secrets. `src/test/envProduction.test.ts` fails if anything else is added.

## Automated checks in this repository

- CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) on every pull request and push to `main`: `npm ci`, type check,
  `vitest run`, production build, and ESLint with a stored problem count (`.eslint-baseline`) that may only go down.
- Guard tests that fail the build if false claims come back: `src/test/noInventedClaims.test.ts` (also scans
  `supabase/functions` prompts), `src/test/twoStepHonesty.test.tsx`, `src/test/hmrcNoSimulatedFiling.test.tsx`.

Not done: penetration testing, an external audit, or any certification.
