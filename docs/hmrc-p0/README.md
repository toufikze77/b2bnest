# HMRC P0: a secure, server-side HMRC connection per company (sandbox first)

This fixes the P0 findings in `docs/hmrc-vat-audit/README.md` (PR #70).

**Prepared, not applied.** The SQL has not been run in production, no Edge Function has been deployed, no secret has been set, and HMRC has not been called: every test mocks it.

## Rollout order (owner)
1. **Apply `docs/hmrc-p0/proposal.sql`** after review. It runs in one transaction and refuses, changing nothing, if any of these differ from what I read in production (read-only, 4 Nov 2026):
   - the function hashes;
   - the HMRC data counts: 1 `hmrc_settings` row in sandbox mode, 0 `hmrc_integrations` rows, 0 `hmrc_submission_logs` rows;
   - the column shapes;
   - the grants.
2. **Set the five Edge Function secrets** (Supabase → Edge Functions → Secrets). Never paste a value into chat, a ticket or the repo.

   | Secret | Value |
   |---|---|
   | `HMRC_CLIENT_ID` | the B2BNEST sandbox application's Client ID (HMRC Developer Hub) |
   | `HMRC_CLIENT_SECRET` | the same application's Client Secret |
   | `HMRC_TOKEN_KEY` | 32 random bytes, base64. For example, made on your own computer with `openssl rand -base64 32` |
   | `HMRC_ENV` | `sandbox`. `production` is refused by the code until a later phase. |
   | `HMRC_REDIRECT_URI` | `https://www.b2bnest.online/hmrc/callback` |

   If any secret is missing or malformed (for example a key that isn't 32 bytes), the functions fail closed with "HMRC connection isn't set up yet."
3. **HMRC Developer Hub:** in the B2BNEST sandbox application, add the redirect URI `https://www.b2bnest.online/hmrc/callback`.
4. **Deploy the three functions:** `hmrc-connect-start`, `hmrc-connect-complete`, `hmrc-disconnect`. All three have `verify_jwt = true` in `supabase/config.toml`.
5. **Publish the frontend.**

**What people see before steps 1–4:**
- The HMRC page says "HMRC connection isn't set up yet." and nothing else breaks.
- The return screens keep their example figures and "Filing is not available yet".

## What I read first
- **The audit:** `docs/hmrc-vat-audit/README.md`. Production matches it:
  - `get_hmrc_tokens` and `get_hmrc_client_secret` returned decoded values to authenticated users;
  - `encrypt_hmrc_token` was base64;
  - users could write their own `hmrc_integrations` token rows;
  - the per-user client credentials lived in `hmrc_settings`.
- **Gates on the HMRC screens:**
  - `src/App.tsx`: `/business-tools` is not wrapped and `/settings` uses `ProtectedRoute`.
  - `src/pages/BusinessTools.tsx`: the HMRC tool is a paid tool, using `useSubscription().isPremium`, which is `access.hasAccess` (trial or paid).
  - `src/pages/Settings.tsx`: the HMRC tab has no role gate.
  - `src/lib/navItems.ts`: no HMRC entry.

  **No admin-only gate exists on any customer HMRC screen**, so none needed removing.
- **Company roles:** `user_is_organization_admin` (owner or admin, active membership) and `user_is_organization_member`. Both were hash-checked against production.
- **Access state:** `_access_state_for`, the same rule as the Time Tracker and the free tools.

## Final design
### Database (`proposal.sql`)
- **`hmrc_connections`:** one row per company and environment.
  - `access_token_enc` and `refresh_token_enc` hold ciphertext only. A CHECK enforces the `v1.<key id>.<iv>.<ciphertext>` format, so a plain token can't be stored.
  - Status is `connected`, `needs_reconnect` or `disconnected`. A disconnected row holds no tokens.
  - `updated_at` comes from the server clock. `refresh_lock_until` is for the refresh lock.
  - RLS is on, with the restrictive aal2 policy. **No client privilege at all**; the service role only.
- **`hmrc_oauth_states`:** single use, lasts at most 10 minutes (enforced by a CHECK), stores only the SHA-256 hash of the state, service role only. `hmrc_consume_state(hash, user)` uses it up atomically, and only for the same user.
- **`hmrc_audit_log`:** append-only. Triggers refuse UPDATE, DELETE and TRUNCATE even for the database owner, and the service role has no UPDATE or DELETE grant.
  - It records event codes (`connect_started`, `connected`, `refreshed`, `refresh_failed`, `disconnected`, `refused`) and a short reason code only (`^[a-z0-9_]{1,60}$`). Nothing else can be written there: no token, code, secret or HMRC response.
  - It has no foreign keys, so the history outlives the company and the user.
- **`hmrc_manage_allowed(company, user)`:** service role only. It is the single rule, giving one of:
  - `not_member`;
  - `suspended`;
  - `trial_ended`;
  - `not_admin` (an active owner or admin of the company is needed);
  - `ok`.

  **Platform roles grant nothing.** The Edge Functions and the two status functions below all use it.
- **Browser-callable functions** (SECURITY DEFINER, `search_path = ''`, the Phase 25 guard line, a guard log row, authenticated only):
  - `hmrc_can_manage(company)`: true or false.
  - `hmrc_connection_status(company)`: returns status, environment, who connected (name), when, expiry, `needs_reconnect` and scopes. **It never returns a token or ciphertext.**
    - Any active member gets it.
    - Trial-ended and suspended accounts get only that reason.
    - Non-members, including platform admins and master accounts who aren't members, get `HMRC_NOT_ALLOWED`.
  - `hmrc_audit_events(company)`: owners and admins only.
- **Old holes closed:**
  - These are dropped: `get_hmrc_tokens`, `get_hmrc_client_secret`, `encrypt_hmrc_token`, `decrypt_hmrc_token`, `encrypt_hmrc_settings_secret`, its trigger, and the two old guard log rows.
  - `hmrc_integrations` (0 rows) loses every client privilege.
  - On `hmrc_settings`, `client_id`, `client_secret` and `redirect_uri` are cleared and blocked by a CHECK. Users keep their business details (company name and number, UTR, VAT number, PAYE reference).
  - The one sandbox row's credential values are deleted, not copied anywhere.

### Edge Functions (code only, not deployed)
- **`_shared/hmrc/`:** these modules are only imported by the three functions (they aren't endpoints).
  - `config.ts`: secrets, fail closed, scopes and endpoints in single constants.
  - `crypto.ts`: AES-256-GCM with a random 96-bit IV per value.
    - Each value is bound by additional data to company, environment and field, so a value copied to another company or field doesn't decrypt.
    - The key id is derived from the key, and the keyring is ready for rotation.
  - `caller.ts`: JWT, the aal2 rule, the company rule.
  - `oauth.ts`: the HMRC token endpoint.
  - `handlers.ts`: start, complete and disconnect.
  - `token.ts`: `getFreshHmrcToken`, not an endpoint.
  - `store.ts`, `serve.ts`.
- **`hmrc-connect-start`:**
  - checks the configuration, the session, the two-step rule and the company rule;
  - creates the state (only its hash is stored);
  - writes the audit row;
  - returns the HMRC sign-in URL (scopes `read:vat write:vat`, the redirect URI).
- **`hmrc-connect-complete`:**
  - uses up the state: unused, unexpired, same user, and the same company when the browser sends it;
  - checks the company rule again;
  - exchanges the code using the server secrets;
  - encrypts both tokens, stores them and writes the audit row.

  HMRC refusals store nothing and the HMRC response is never passed on.
- **`hmrc-disconnect`:** owners and admins only. Deletes the stored tokens, marks the connection disconnected, writes the audit row.
- **`getFreshHmrcToken(companyId)`:**
  - decrypts the token, or refreshes it within 2 minutes of expiry under the per-company lock, so a second caller waits for the result instead of refreshing again;
  - stores what HMRC returns, keeping the old refresh token only when none comes back;
  - marks `needs_reconnect` when HMRC refuses the refresh; if HMRC is down, the connection stays connected;
  - writes an audit row each time.
- **MFA:** the service role skips the database's MFA rule, so each function checks it itself. It reads `aal` from the session token, which Supabase verified, and the person's factors through the Auth admin API. A caller with a verified authenticator at aal1 is refused with "Two-step sign-in is on for your account. Sign out, sign in again with your 6-digit code, then try again."
- **`oauth-hmrc` is deleted:**
  - The folder and its `config.toml` entry are removed.
  - The client no longer calls it: `useHMRCCallback` is deleted and `hmrcService` keeps only the business details and the submission-log reader.
  - **If it is still deployed in Supabase, undeploy it** (step 4). Without the dropped database functions it can't work anyway.
- **Logging:** event and reason codes only, plus the HMRC HTTP status for a failed exchange. Tests capture the console and check that no secret, token, code, state or key appears.

### Frontend
- **`HMRCConnectionPanel`** is shown at the top of Business Tools → HMRC Integration and in Settings → HMRC.
  - It shows a company picker (the app's `OrganizationSwitcher`, when a person has more than one company) and the "Sandbox (test)" badge.
  - It shows the status, plus who connected and when, as 2 Nov 2026.
  - Owners and admins get "Connect to HMRC" (or "Reconnect to HMRC") and "Disconnect", which asks first. Members get "Ask an owner or admin of … to connect or disconnect HMRC".
  - Other states each get a clear line:
    - not set up;
    - no access;
    - two-step required;
    - trial ended, with See plans;
    - suspended;
    - needs reconnect.
  - Changes are announced through `aria-live`.
- **`HMRCSettings`:** the credential fields, the sandbox switch, "automatic filing" and the notification settings are gone. It now holds the connection panel plus the business details.
- **`/hmrc/callback`** (signed in):
  - reads `code` and `state` once and removes them from the address bar straight away;
  - posts them, with the remembered company, to `hmrc-connect-complete`;
  - shows success or a plain error, and "Back to HMRC Integration".

  The code is never shown or stored.
- **Texts:**
  - The Help FAQ is rewritten; the "Where do I get my HMRC Client ID and Secret?" entry is removed.
  - `knowledge.ts` gets the new HMRC line (not deployed).
  - Filing stays "not available yet" everywhere.

## Access matrix (proved by the SQL suite, the Deno tests and vitest)
| Who | Sees the status | Connect / disconnect | Tokens |
|---|---|---|---|
| Company owner or admin (trial or paid, no platform role) | yes | **yes** | never (not even them) |
| Company member | yes | no ("Ask an owner or admin") | never |
| Platform super admin or master account, not in the company | **no** (`HMRC_NOT_ALLOWED`) | no | never |
| Owner of another company | no | no | never |
| Trial ended / suspended | the reason only | no | never |
| Two-step set up, code not entered (aal1) | no (`MFA_REQUIRED`) | no ("sign in again with your code") | never |
| Signed out / anon | no | no | never |

**What a platform admin can see:**
- **In the app:** nothing about a company's HMRC connection unless they are an owner, admin or member of that company. Then they get the same rights as anyone else in that role.
- **Through the database:** with the service role or the database owner (the Supabase dashboard), the tables are readable as with any table. `hmrc_connections` there holds **ciphertext only**: the key is an Edge Function secret, the database never has it, so tokens can't be read from the database.
- **Unchanged and still visible to them:** the existing `hmrc_submission_logs` policy "Admins can view all HMRC submission logs" (`is_admin_or_owner`). The table is empty and nothing writes it.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx eslint .` | 510 (baseline 510) |
| `npx vitest run` | 1,452 / 1,452 pass (149 files); 15 new in `src/components/hmrc/hmrcP0.test.tsx` |
| `npm run build` | OK |
| Deno `_shared/hmrc/hmrc_test.ts` | 17 / 17 pass |
| `deno check` of the three functions | clean |
| Deno `ai-assistant` (knowledge and handler) | 29 / 29 pass |
| Local SQL suite (`PG_RUN_USER=postgres bash docs/hmrc-p0/run-test.sh`) | 90 / 90 PASS |

Notes on how they were run:
- `deno.land` and `esm.sh` are blocked here, so the Deno runs used a local stand-in for `std/testing/asserts.ts`, and `deno check` used a stub for `createClient` (it checks our code, not supabase-js).
- **The SQL suite covers:**
  - production hashes and shape;
  - privileges on every new object;
  - tokens never selectable by authenticated or anon, and the status carrying no token;
  - the full role matrix;
  - states that are single use, 10-minute, same user and hash only;
  - the refresh lock;
  - the audit log being append-only for everyone, including the database owner;
  - the old functions gone and old holes closed;
  - a refused rollback with data, an exact forced rollback (catalogue fingerprint: functions, ACLs, column ACLs, constraints, policies, triggers, guard log), re-apply, a second apply refused, an empty rollback, and drift (data and function) refused.

## Security advisor expectations after applying
- **New `authenticated_security_definer_function_executable` (3):** `hmrc_can_manage`, `hmrc_connection_status`, `hmrc_audit_events`. These are intended: each carries the Phase 25 guard, checks `auth.uid()` against the company rule and returns no secret.
- **Gone (2):** `get_hmrc_tokens`, `get_hmrc_client_secret` (dropped).
- **No new `anon_*` warning.** New functions all pin `search_path`. RLS is on for the three new tables and the backup table. `hmrc_p0_backup` (RLS on, no policy) may show as "RLS enabled, no policy": that is intended, it is service-role only and is dropped by the rollback.

## Rollback
`rollback.sql` restores exactly what HMRC P0 replaced:
- the five functions, byte for byte, with their privileges (from `public.hmrc_p0_backup`);
- the trigger, the two guard log rows (with their original `applied_at`), the NOT NULL rule on the credential columns, and every anon, authenticated and PUBLIC table and column grant on `hmrc_integrations` and `hmrc_settings`.

It refuses while any HMRC P0 table has rows unless `SET LOCAL app.hmrc_p0_force = 'on'`.

**Not restored:** the cleared credential values of the one sandbox `hmrc_settings` row. They become `''`. That row was a customer's own developer credential and must not come back.

## Not verified (HMRC pages unreachable from this environment)
`developer.service.hmrc.gov.uk` and `www.gov.uk` were refused by the network policy, so all of these are **not verified**:
- **Scope names:** `read:vat`, `write:vat`, kept in `HMRC_SCOPES`.
- **Authorise and token endpoints:** the sandbox ones are `test-www.tax.service.gov.uk/oauth/authorize` and `test-api.service.hmrc.gov.uk/oauth/token`, the URLs already in the repo, kept in `HMRC_ENDPOINTS`.
- **The OAuth parameters.**
- **Access-token lifetime:** the code uses whatever `expires_in` HMRC returns.
- **Whether refresh tokens rotate:** the code stores whatever comes back.
- **The error codes:** any 4xx is treated as a refusal.
- **Whether HMRC has a token revocation endpoint:** none is called, so disconnect deletes B2BNEST's copy only. The grant at HMRC lapses on its own. If HMRC offers revocation, add it in `handlers.ts`.

Allow those two hosts in the environment's network settings so P1 can check them.

## Risks and not done
- **Stale callbacks:** the remembered company is in `sessionStorage`. If the HMRC sign-in opens in another tab, the callback sends no `company_id`, and the server uses the company stored with the state. That is still safe.
- **Scripts that use the dropped functions:** `scripts/staging/40_app_compat_tests.sql` refers to `encrypt_hmrc_token`, and old migrations still create the dropped functions. Re-running old migrations on a new database recreates them until the migration history is squashed. Production is unaffected.
- **Generated types:** `src/integrations/supabase/types.ts` is not regenerated. The new functions are called through typed wrappers in `src/lib/hmrcConnection.ts`.
- **Production environment:** not built. `HMRC_ENV=production` is refused until a later phase, after HMRC approval.
- **Not done:** reading VAT obligations, fraud prevention headers, Hello World. These are P1–P3.
