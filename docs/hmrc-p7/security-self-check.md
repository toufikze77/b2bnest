# Security self-check (HMRC P7c, 8 Nov 2026)

> **This is a self-assessment with free tools. It is not an independent penetration test,** and the production
> request pack must not claim one. HMRC's terms of use (as read by the owner on 8 Nov 2026) say software as a service
> must *"pass penetration testing, either with your own tools or an independent supplier"*. This file records what we
> ran ourselves. An independent test is **NOT DONE** (options: `accountant-and-pentest-options.md`).

No secret, token, key or personal data is copied into this file. Findings are given by file and type only.

## 1. Dependencies: `npm audit`

| Run | Critical | High | Moderate | Low |
| --- | --- | --- | --- | --- |
| `npm audit --omit=dev` (what ships to the browser) | 0 | 1 | 3 | 2 |
| `npm audit` (including build and test tools) | 1 | 1 | 13 | 2 |

**High and critical, and what was done:**

| Package | Severity | Where | Status |
| --- | --- | --- | --- |
| `zod` 3.25.76 | High: memory exhaustion when validating oversized constrained collections | Shipped (form validation in the browser, in 4 files) | **Not fixed.** The fix is zod 4, a major upgrade with API changes. The risk is limited: zod only validates what the person types into their own browser, and the server never runs zod. Follow-up: plan the zod 4 upgrade with the form tests. |
| `vitest` 4.0.18 (`@vitest/mocker`) | Critical: arbitrary file read when the Vitest UI server is listening, and path traversal through the mocker's redirect | **Development only** (test runner, not shipped) | **Not fixed in this PR.** The same-major fix (4.1.12) exists, but `npm install` fails in this environment with an npm 10.9.4 bug (`Cannot read properties of null (reading 'edgesOut')`). The `--legacy-peer-deps` workaround rewrote the lockfile and dropped `@testing-library/dom`, so it was rejected. Exposure: CI and local runs use `vitest run`, never the UI server. Follow-up: upgrade on a machine where `npm install -D vitest@~4.1.12` works, then run the full suite. |

## 2. Secrets in the repository and its history

**Tools:**
- TruffleHog 2.2.1 (pip), regex rules, over the whole git history (`trufflehog --regex --entropy=False`);
- a targeted regex sweep of every added line in `git log -p --all` (76 MB) for:
  - Stripe live and test secret keys, restricted keys and webhook secrets;
  - private key blocks;
  - AWS, GitHub, Slack and Google keys;
  - OpenAI-style and Resend-style keys;
  - `client_secret` assignments;
  - JSON Web Tokens, decoded only to read their role.

| Finding | Where | Verdict |
| --- | --- | --- |
| TruffleHog "Generic Secret", 5 hits | `docs/hmrc-p0/fixture.sql`, `docs/hmrc-p0/proposal.sql` (2), `docs/phase25/owner-readonly.sql`, `docs/phase25/proposal.sql` | **False positive.** Each is a 32-character md5 fingerprint of a function body, next to a function name such as `encrypt_hmrc_settings_secret`. These fingerprints are public by design. |
| Slack-token pattern, 1 hit | `docs/phase9-honesty/run-test.sh` (local test script) | **False positive.** A 15-character, all-lowercase placeholder in a disposable local database test. Real Slack tokens are much longer and contain digits. |
| JWTs: 38, all with role **`anon`** | `.env`, `src/integrations/supabase/client.ts`, `src/pages/PublicWorkRequest.tsx`, two old migrations | **Expected.** The Supabase publishable (anon) key is public by design (`SECURITY.md`; `src/test/envProduction.test.ts`). **No `service_role` JWT anywhere in the history.** |
| Stripe keys, webhook secrets, private keys, cloud or chat tokens, `client_secret` values | — | **None found.** |

## 3. Security headers, TLS and CORS

**Not measured from this session.** The session's network doesn't reach `www.b2bnest.online` or securityheaders.com
(shell: proxy 403; web fetch: host not allowed). What the repository **configures** (`vercel.json`, every path):
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`, plus CSP `frame-ancestors 'none'`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` (camera, microphone, geolocation, payment and usb off);
- an enforcing `Content-Security-Policy`:
  - `default-src 'self'`; `script-src 'self'`;
  - `connect-src` limited to the Supabase project and one exchange-rate API;
  - `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`.

**Caveat:** the owner says the live site is served by **Lovable** hosting. Lovable may not apply `vercel.json`, and it
may limit which response headers can be set. So the live headers may differ from the file.

**Owner check (1 minute, PowerShell):**

```powershell
curl.exe -sI https://www.b2bnest.online/ | Select-String -Pattern "strict-transport|content-security|x-frame|x-content-type|referrer-policy|permissions-policy"
```

Or enter the address at securityheaders.com and paste the grade here.

**Follow-ups:**
- If any of the six headers are missing on the live site, ask Lovable support how to set them, or serve the site
  where `vercel.json` applies.
- **Edge Function CORS** is `Access-Control-Allow-Origin: *` (`supabase/functions/_shared/cors.ts`). Every call is
  authenticated with a Bearer token, not a cookie, so another site can't act as a signed-in person. Even so, narrowing
  the origin to `https://www.b2bnest.online` (plus the preview hosts) is a cheap hardening step.

## 4. Static review: HMRC and data-rights Edge Functions against the OWASP Top 10 (2021)

| OWASP | What the code does | Proof (tests) |
| --- | --- | --- |
| **A01 Broken access control** | Every HMRC and data-rights action checks, server-side, each time: a valid session, aal2 when two-step is enrolled, company membership and role (owner or admin; owner only for closing), plan, and not the demo account. Nothing trusts the browser's company or role. Destructive steps and downloads also need a fresh sign-in in the last 10 minutes. | `hmrc_test.ts` "start: the role matrix…", "two-step rule…", "disconnect: owners and admins only…"; `p3_test.ts` "who may ask: signed out, member, Solo, someone else's company…"; `p6_test.ts` "refused: member, Solo, not signed in, two-step not done, production…"; `data_rights_test.ts` "export company: owners and admins only; that company's rows only…", "export needs a fresh sign-in (10 minutes) for both scopes…", "company close: owners only…"; the P7b SQL suite (117 checks: cross-tenant, immutability, purge refused for non-service roles) |
| **A02 Cryptographic failures** | HMRC tokens use AES-256-GCM with a random IV and are bound to company, environment and field. The key exists only in Edge Function secrets. Tokens never reach the browser. | `hmrc_test.ts` "encryption: tampering, the wrong company or field, and an unknown key are all refused" |
| **A03 Injection** | No SQL is built from input in the functions: RPC parameters and the PostgREST query builder only. Dynamic SQL in the P7b functions uses `format('%I')` and parameters (`USING`). VRN, period key, dates and scenarios are checked against strict patterns or allow-lists. CSV export neutralises formulas. | `p3_test.ts` "VRN cleaning…", "dates: real calendar dates only…"; `p6_test.ts` "bad input: unknown action or a malformed period key"; `data_rights_test.ts` "csv: a value that would run as a formula is neutralised…" |
| **A04 Insecure design** | A VAT return POST is never retried. An unclear result is recorded as "unknown" with "Check with HMRC". There is one live submission per period. The confirmation token is signed and bound to company, period, figures and person, and expires after 10 minutes. The figures are always recomputed on the server. | `p6_test.ts` "no clear answer (5xx, network error): recorded as unknown, never retried…", "the confirmation token: signed, bound…", "the browser never supplies figures…" |
| **A05 Security misconfiguration** | Production HMRC is refused in code. Configuration fails closed. JWT verification is on for every HMRC and data-rights function (`supabase/config.toml`). | `hmrc_test.ts` "configuration fails closed…"; `p3_test.ts` "production stays refused; not configured" |
| **A06 Vulnerable components** | See section 1 (zod, vitest). | `npm audit` |
| **A07 Identification and authentication failures** | Supabase Auth with TOTP two-step sign-in. The HMRC and data-rights functions require aal2 when enrolled, plus a fresh sign-in for destructive steps and downloads. Passwords are checked by Supabase Auth in the browser and never sent to our functions. | `data_rights_test.ts` "account delete: needs the download tick, the typed email, a fresh sign-in…"; `src/lib/dataRights.test.ts` "confirming who you are…" |
| **A08 Software and data integrity** | VAT submissions and the HMRC audit log are immutable for everyone. The only exceptions are the reviewed, transaction-gated purge and "Deleted user" paths. | P6 and P7b SQL suites |
| **A09 Logging and monitoring** | Every HMRC and data-rights action writes an audit row (codes only). Logs never contain a token, a body, an email or an HMRC response. | `hmrc_test.ts` "nothing secret reaches console output on any path"; `p6_test.ts` "…HMRC's own text is never passed on"; `data_rights_test.ts` "…no email in the logs" |
| **A10 SSRF** | Outbound calls go only to fixed HMRC hosts (sandbox) and Supabase. No URL comes from the person. | `api.ts` (base URL from configuration only) |

**Rate limits:**
- HMRC obligations: 10 an hour per company;
- VAT submission attempts: 5 an hour per company;
- HMRC test calls: limited;
- data exports: 3 an hour per person and kind;
- deletions and closures: 5 an hour.

Tests: `p3_test.ts` "rate limit: 10 an hour per company", the P6 SQL suite, the P7b SQL suite.

**Error messages:** every error answer is our own code and plain message. HMRC's text, database errors and stack
traces never reach the browser (the `fail()` helpers; the "HMRC's own text is never passed on" assertions).

## 5. Supabase advisor (run by the owner's assistant, 8 Nov 2026)

| Finding | Status |
| --- | --- |
| Postgres has outstanding security patches | **Upgrade pending** (owner, Supabase dashboard → Settings → Infrastructure) |
| Leaked-password protection is off | **Needs a paid Supabase plan**; off until then |
| Many SECURITY DEFINER functions executable by `authenticated`, and 18 by `anon` | By design: each checks the caller inside (for example invitation preview by token, public forms). **Follow-up:** review the 18 `anon`-callable functions one by one and record why each must be public |
| 21 tables with RLS on and no policy | By design: server-only tables (outboxes, the HMRC audit log, the request log, the gate) that the browser must not read |

## 6. Summary

- **Done ourselves:** dependency audit, secrets scan (repository and history), configured-headers review, static
  OWASP review with test references, and the advisor review.
- **Not done:** an independent penetration test; measuring the live headers; the zod 4 and vitest upgrades; narrowing
  CORS; the review of the 18 `anon` functions; the Postgres upgrade.
