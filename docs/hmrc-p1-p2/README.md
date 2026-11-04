# HMRC P1 + P2: Hello World test call and fraud prevention headers (sandbox)

**Prepared, not applied.** No SQL has been run, no Edge Function has been deployed, and no secret has been set.

Owners and admins of a connected company on Business, Scale or the 14-day trial get two buttons under Settings → HMRC and in the HMRC tool:
- **Test the connection**: calls HMRC's Hello World `/hello/user` with the company's HMRC sign-in.
- **Check HMRC header test**: calls HMRC's Test Fraud Prevention Headers API and shows its errors and warnings (header names and messages only).

Members, Solo accounts and companies that aren't connected see nothing new. Every HMRC call from the server now carries the fraud prevention headers. There is no filing, VAT figure or obligation in this phase.

## What was read from HMRC (4 Nov 2026)
All the pages were reachable. They were read as data, not instructions.

| Fact | Status | Page |
|---|---|---|
| Hello World 1.0: `GET /hello/world` (no token), `/hello/application` (application token), `/hello/user` (user token, scope `hello`); replies `{"message":"Hello World"}`, `"Hello Application"`, `"Hello User"` | verified | Developer Hub → Hello World API (OAS) |
| `Accept: application/vnd.hmrc.1.0+json` | verified | Hello World API; Test Fraud Prevention Headers API |
| Sandbox API base `https://test-api.service.hmrc.gov.uk` | verified | Developer Hub → Testing in the sandbox; API OAS servers |
| Test Fraud Prevention Headers 1.0: `GET /test/fraud-prevention-headers/validate`, application-restricted, sandbox only, beta; reply `specVersion`, `code` (`VALID_HEADERS` / `POTENTIALLY_INVALID_HEADERS` / `INVALID_HEADERS`), `message`, `errors[]` and `warnings[]` of `{code, message, headers[]}` | verified | Test Fraud Prevention Headers API (OAS) |
| WEB_APP_VIA_SERVER: 16 headers, "You must submit data for all of these headers" | verified | Fraud prevention → Web application via server (spec v3.3) |
| Encoding: US-ASCII; key-value `k=v&k=v`, lists `a,b`; keys and values percent encoded, separators not | verified | Fraud prevention → Getting it right |
| Missing data: don't send placeholders (null, undefined…); contact HMRC about values you can't collect | verified | Getting it right |
| Browser-Plugins, Local-IPs and Do Not Track are not needed for this method | verified | Fraud prevention → Change log |
| OAuth authorise `https://test-www.tax.service.gov.uk/oauth/authorize` and token `https://test-api.service.hmrc.gov.uk/oauth/token` (the HMRC P0 constants are correct) | verified | Authorisation → User-restricted endpoints |
| Scopes are space-delimited; access token 4 hours; refresh token single use, a new one each time, stops after 18 months; a refresh invalidates the old access token | verified | User-restricted endpoints |
| `client_credentials` gives a 4-hour application token | verified | Authorisation → Application-restricted endpoints |
| VAT scopes `read:vat`, `write:vat` | verified | VAT (MTD) 1.0 OAS |
| 3 requests a second per application; 429 `MESSAGE_THROTTLED_OUT`; 401 `MISSING_CREDENTIALS` / `INVALID_CREDENTIALS` / `INCORRECT_ACCESS_TOKEN_TYPE`; 403 `INVALID_SCOPE`; 406 `ACCEPT_HEADER_INVALID`; 500/503 | verified | Reference guide |
| A correlation id response header | **not verified** (not in the pages read), so none is read | — |
| How hosted Supabase passes the client IP and port | **not verified** (not an HMRC page; not documented in what was read) | — |

### What changed in `_shared/hmrc/config.ts`
- Nothing was wrong in P0.
- Added `HMRC_VAT_SCOPES`, `HMRC_SANDBOX_TEST_SCOPES = ['hello']`, `scopesFor(env)` (sandbox asks for `read:vat write:vat hello`; production asks for the VAT scopes only), and an `api` base URL for each environment (one constant).
- **Existing sandbox connections lack `hello`.** They must reconnect once before "Test the connection" works. Until then the server answers `scope_missing` and the panel says so.

## Design
- **`_shared/hmrc/api.ts` → `callHmrc`**:
  - takes `{companyId, userId?, method, path, query?, body?, tokenKind: 'none'|'application'|'user', version, fraudHeaders}`;
  - uses the one sandbox base URL and `Accept: application/vnd.hmrc.<version>+json`;
  - application token: `client_credentials`, cached in memory until 60 s before expiry;
  - user token: `getFreshHmrcToken`, with the plan and suspension check for the acting person.
  - 401 on a user token: one forced refresh, one retry. A second 401 marks the connection `needs_reconnect` and writes an audit row (`refresh_failed`, `hmrc_401_after_refresh`).
  - 429 and 5xx: no retry.
  - Logs path, status and HMRC's error code only. It never logs a token, the Authorization header, a body or personal data.
  - Returns `{ok, status, hmrcCode?, reason?, body?}`.
- **`_shared/hmrc/fraudHeaders.ts`**: all header building, validators and encoders in one place.
- **`_shared/hmrc/testCall.ts` + `hmrc-test-call`** (`verify_jwt = true`), body `{company_id, kind, fraud}`:
  - `kind` is `hello_world`, `hello_application`, `hello_user` or `fraud_headers_validate`; the UI uses the last two.
  - Order of checks:
    1. configuration and session;
    2. the two-step rule (a verified authenticator needs aal2);
    3. `hmrc_manage_allowed` (owner or admin; trial, Business or Scale; not suspended; platform roles grant nothing) — a refusal writes an audit row `refused`;
    4. for `hello_user`: `not_connected` / `needs_reconnect` / `scope_missing`;
    5. the rate limit (10 an hour per company) via `hmrc_take_test_slot`, which also writes the `test_call` audit row;
    6. the HMRC call;
    7. an audit row `test_result` with `<kind>_<status or reason>`.
  - The reply holds no token and no raw HMRC body: `hello_*` gives `{message}`, and only one of HMRC's three known messages. `fraud_headers_validate` gives `{result: {code, message, errors, warnings}}`, keeping only items whose header names match `gov-…`, plus the list of headers sent and omitted.
- **Browser (`src/lib/hmrcFraud.ts`)**:
  - collects only the browser-side items on HMRC's list;
  - the device id is a random UUID in `localStorage` (`b2bnest.hmrc.deviceId`). It is not tied to the person. If storage is blocked, one id is kept in memory for the page.
- **UI (`HMRCTestTools.tsx`, inside `HMRCConnectionPanel`)**:
  - shown only when the server says `can_manage` and the company is connected;
  - results go to an `aria-live` status line;
  - buttons stack at phone width;
  - "Last tested 2 Nov 2026 (…)" comes from `hmrc_audit_events`, which owners and admins already read;
  - a privacy note sits under the buttons.

## Header table (WEB_APP_VIA_SERVER, spec v3.3)
| Header | Source | Spec rule | B2BNEST |
|---|---|---|---|
| Gov-Client-Connection-Method | server | `WEB_APP_VIA_SERVER` | sent |
| Gov-Client-Browser-JS-User-Agent | browser `navigator.userAgent` | as reported by the browser | sent (percent encoded outside US-ASCII) |
| Gov-Client-Device-ID | browser localStorage | UUID, persistent, not expiring; new one if deleted | sent |
| Gov-Client-Multi-Factor | server, from the session's JWT `amr` | `type`, `timestamp` (UTC, at least `yyyy-MM-ddThh:mmZ`), `unique-reference` (a hash, not the secret) | sent only when this session used the authenticator (aal2 with a `totp` amr entry): `type=TOTP`, the time of that step, and a SHA-256 of the person's authenticator factor ids. Otherwise **omitted**: no MFA is ever claimed that didn't happen |
| Gov-Client-Public-IP | server: first `X-Forwarded-For` entry, then `CF-Connecting-IP`, then `X-Real-IP` | public IPv4 or IPv6 | sent when public; private, loopback, link-local and similar ranges are dropped, not invented |
| Gov-Client-Public-IP-Timestamp | server, when the request arrived | `yyyy-MM-ddThh:mm:ss.sssZ` | sent with the IP |
| Gov-Client-Public-Port | — | the client's TCP port, 1–65535, not 80/443 | **omitted**: Supabase Edge Functions don't receive it. HMRC says to contact them about data you can't collect |
| Gov-Client-Screens | browser | `width`, `height`, `scaling-factor`, `colour-depth`; positive whole numbers | sent |
| Gov-Client-Timezone | browser `getTimezoneOffset` | `UTC±hh:mm` | sent |
| Gov-Client-User-IDs | server | key-value of the user's identifiers; HMRC says to include the sign-in identifier, for example the email | `b2bnest=<user uuid>` **only**. See the risks |
| Gov-Client-Window-Size | browser `innerWidth`/`innerHeight` | `width`, `height`, positive whole numbers | sent |
| Gov-Vendor-Forwarded | server | `by=<server public IP>&for=<client public IP>` per hop | sent when `HMRC_VENDOR_PUBLIC_IP` is set and the client IP is known |
| Gov-Vendor-License-IDs | — | hashed licence keys on the device; no value if there are none | **omitted**: B2BNEST puts no licence on the device |
| Gov-Vendor-Product-Name | server | percent encoded | `B2BNEST` |
| Gov-Vendor-Public-IP | server env `HMRC_VENDOR_PUBLIC_IP` (optional, not a secret) | public IP the browser's requests go to | sent when set; otherwise **omitted** |
| Gov-Vendor-Version | browser + server | key-value of the versions handling the request | `b2bnest-web=1.0.0&b2bnest-server=1.0.0` (our own labels: `package.json` has no release number) |

Email addresses, names and tokens are never put in any header. A test checks this.

## Database: `proposal.sql` (for the owner to apply)
- `hmrc_audit_log.hal_event` CHECK: adds `test_call` and `test_result`. `hal_reason` is unchanged (codes only).
- `hmrc_take_test_slot(company, user, environment, kind, limit default 10)`:
  - service role only, SECURITY INVOKER, `search_path = ''`;
  - under a per-company advisory lock, counts that company's `test_call` rows in the last hour;
  - writes one row and returns true below the limit, false otherwise.
- **Prechecks** (refuses and changes nothing if any differ from production as read on 4 Nov 2026):
  - the function is absent;
  - md5 of `hmrc_manage_allowed` `9304f069…`, `hmrc_connection_status` `8d04b8c0…`, `hmrc_can_manage` `1d40a67e…`, `hmrc_audit_events` `47b3d4d7…`, `_hmrc_audit_append_only` `8f283e3f…`;
  - the exact six-event CHECK;
  - the `hmrc_audit_log` privileges.
- No new table, no new SECURITY DEFINER function, no grant change on any existing function.

## Rollout order (owner)
1. **Apply `docs/hmrc-p1-p2/proposal.sql`** after review.
2. **Deploy `hmrc-test-call`.** Optionally set `HMRC_VENDOR_PUBLIC_IP` (the public IP your users' browsers reach). This is not a secret, and leaving it unset only omits two headers.
3. **Publish the frontend.**
4. Each sandbox company **reconnects once** to grant the `hello` scope.

## Owner test steps (sandbox)
Use an owner on Business, Scale or the trial, with the HMRC P0 secrets set.
1. Settings → HMRC → **Connect to HMRC** (or **Disconnect**, then Connect, if already connected). Sign in with an HMRC sandbox test user and grant access.
2. **Test the connection** → "The connection works. HMRC replied: Hello User." The "Last tested" line shows today's date.
3. **Check HMRC header test** → HMRC's summary, then errors and warnings by header name. Expect at least `gov-client-public-port`, which is omitted. Expect `gov-vendor-public-ip` and `gov-vendor-forwarded` too if `HMRC_VENDOR_PUBLIC_IP` isn't set.
4. Sign in as a member, and as a Solo account: no test buttons. Solo sees the plan message.
5. Run the test 11 times in an hour → the 11th says "You can run 10 HMRC tests an hour for this company."

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx eslint .` | 510 (baseline 510) |
| `npx vitest run` | 1,473 / 1,473 pass (152 files) |
| `npm run build` | OK |
| Deno `_shared/hmrc/` (`hmrc_test.ts` + `p1p2_test.ts`) | 34 / 34 pass (15 new) |
| `deno check` of the four HMRC functions and both test files | clean |
| Deno `ai-assistant` | 29 / 29 pass |
| Local SQL suite (`PG_RUN_USER=postgres bash docs/hmrc-p1-p2/run-test.sh`) | 36 / 36 PASS |

- **Deno** covers:
  - `callHmrc`: token kinds and Accept; 401 refresh-and-retry-once then `needs_reconnect`; 429 and 5xx without retry; not connected; no secrets in captured logs.
  - `fraudHeaders`: HMRC's examples; encoding; omitted not invented; no email or token; MFA only when true.
  - The handler matrix: session, aal2, member, platform admin not in the company, Solo, trial_ended, suspended, rate limit, not connected, needs reconnect, scope missing, HMRC busy.
- **vitest** covers browser collection (spec fields, storage blocked, timezone examples) and the panel states (owner buttons, results, errors, header feedback, last tested date, member, Solo, not connected).
- **The SQL suite** covers:
  - production hashes and constraint;
  - the full slot matrix;
  - anon and authenticated denied;
  - the exact rollback fingerprint, re-apply, and a second apply refused;
  - rollback refused with test rows, then forced;
  - drift refused.
- `deno.land` and `esm.sh` are blocked here, so the Deno runs used the local asserts stand-in and `createClient` stub, as in HMRC P0.

## Security advisor expectations
No new warnings. `hmrc_take_test_slot` is SECURITY INVOKER and service-role only. The same three authenticated-callable SECURITY DEFINER functions as HMRC P0 remain.

## Rollback
1. Undeploy `hmrc-test-call`.
2. Run `rollback.sql`. It drops `hmrc_take_test_slot` and restores the six-event CHECK.
   - If test rows exist, it refuses unless `SET app.hmrc_p1_p2_force = 'on'`.
   - When forced, it restores the CHECK as `NOT VALID`, because the audit log is append-only and the history is kept.
3. If the frontend is left published, the buttons still show for connected owners and admins, but pressing one only says "HMRC connection isn't set up yet." Nothing else breaks.

## Privacy wording: proposed, for the owner's adviser to review
- **In the panel** (small text, in place now): "HMRC requires this information to help prevent fraud: your IP address, a random device ID kept in this browser, your browser's user agent, screen and window size, time zone, your B2BNEST user ID (not your email address), and whether you used your authenticator app when you signed in."
- **For the privacy policy:** the page has no HMRC section today, so nothing was changed there. Suggested text: "When you use B2BNEST's HMRC tools, we send HMRC the fraud prevention information it requires for software connecting to its APIs: your IP address and the time of the request, a random device identifier stored in your browser, your browser's user agent, screen and window size and time zone, your B2BNEST user ID, and whether you used two-step sign-in. We don't send your name or email address in this information." This makes no legal claims; the lawful basis and retention are for the adviser.

## Risks and not done
- **Gov-Client-User-IDs vs email.** HMRC's spec says to include the identifier the user signs in with (for example the email). The owner's rule forbids email, so only the internal user id is sent. HMRC's header test may warn about this. **Owner decision needed.**
- **Gov-Client-Public-Port is missing.** It isn't available in Supabase Edge Functions. HMRC says to contact them about data you can't collect, so the owner should raise it with HMRC (SDSTeam) before production.
- **The client IP source is unverified for hosted Supabase.** It is taken from the first `X-Forwarded-For` entry, which a client can set if the edge doesn't overwrite it. Check it with "Check HMRC header test" and HMRC's validation feedback.
- **`HMRC_VENDOR_PUBLIC_IP`** must be set by hand and kept current. If it's wrong, Vendor-Public-IP and Forwarded are wrong.
- **MFA reference with several authenticators.** The reference hashes all of the person's TOTP factor ids together, because the JWT doesn't say which factor was used. It is stable, but it changes when a factor is added or removed.
- **No correlation id** is read; none was documented in the pages read.
- **The rate limit counts test calls only**, not other HMRC calls. HMRC's own limit is 3 a second per application.
- **Not done:** filing, VAT figures and obligations (P3 onwards); production credentials; changes to the privacy policy page.
