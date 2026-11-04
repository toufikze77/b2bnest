# HMRC VAT (Making Tax Digital): read-only audit before building

**Read only.**
- No code was changed and no SQL was written.
- Nothing was deployed, HMRC was not called, no secrets were touched, and the production database was not connected to.
- Database facts come from `supabase/migrations/*` and `supabase/baseline/production-schema-baseline-2026-09.sql`, a schema-only dump read from the production catalogue in Sept 2026.

**Written:** 4 Nov 2026.

**HMRC's own pages could not be opened from this environment.** The network policy refused the host, so `curl` got HTTP 403 from the proxy for every URL tried:
- `developer.service.hmrc.gov.uk`
- `www.gov.uk`
- the web fetch tool, which reported that the host could not be resolved.

So every statement below about HMRC rules is marked **verified** or **not verified**. The only HMRC-sourced text available was a web search limited to `developer.service.hmrc.gov.uk`. It returned page titles and a summary. That is a search engine's summary, not the page itself, so it counts as **not verified against the page**.

**To verify the HMRC specifications in the next phases,** allow `developer.service.hmrc.gov.uk` (and `www.gov.uk`) under Network access in the environment settings: the environment menu in the session's title bar, then Edit, then Allowed domains. The steps are at <https://code.claude.com/docs/en/cloud-environments#network-access>.

---

## Summary
1. **Nothing talks to HMRC today except one OAuth token exchange.**
   - No VAT, obligations, Hello World or other MTD API is called.
   - Every VAT, obligations, payroll and tax screen shows **example figures** and a banner: "HMRC filing is not available yet. Nothing has been sent to HMRC."
2. **The connection design must be replaced before any real use.**
   - (a) Each user is asked to register **their own** HMRC Developer Hub app and paste its Client ID and Client Secret into B2BNEST. A software vendor's MTD integration normally uses the vendor's single application (not verified against HMRC's pages, see §2.1).
   - (b) The browser can read the decrypted client secret and the decrypted HMRC access and refresh tokens through two RPCs.
   - (c) The "encryption" is **base64 encoding**, not encryption.
   - (d) Nothing refreshes tokens.
   - (e) Connections are per user, not per company, and nothing checks company owner or admin.
3. **No fraud prevention headers exist anywhere in the repo.**
4. **The finance data is not good enough for a correct VAT return yet.**
   - Invoices have one tax rate per document and no tax-point date; currency can be anything.
   - Expenses, bills and outgoings store a gross amount with **no VAT**, so Box 4 (VAT reclaimed) cannot be produced.
   - There is no VAT-scheme field and no EU flags.
5. **Proposed order** (each one PR):
   - **P0:** rebuild the connection server-side (vendor credentials as secrets, real encryption, no tokens in the browser, company binding, owner/admin only, refresh).
   - **P1:** Hello World.
   - **P2:** fraud prevention headers and HMRC's header test.
   - **P3:** read VAT obligations.
   - **P4:** VAT data model (per-line VAT on sales and purchases, scheme, tax-point date).
   - **P5:** VAT return preview, nothing sent.
   - **P6:** sandbox submission with an immutable audit log and idempotency.
   - **P7:** production readiness checklist.

   P2 comes before P3 on purpose: obligations are an MTD call, and HMRC's pages (not verified) say the headers are required on every MTD call.

---

## 1. What exists today
| File | What it does | Real or placeholder |
|---|---|---|
| `supabase/functions/oauth-hmrc/index.ts` | Takes `{code}` from the browser (lines 39–43). Reads the caller's `hmrc_settings` (client id, secret, redirect URI, sandbox flag) with the **service role** (47–51). Decrypts the secret via `decrypt_hmrc_token` (57–59). POSTs to `https://test-api.service.hmrc.gov.uk/oauth/token`, or `https://api.service.hmrc.gov.uk/oauth/token` when `sandbox_mode` is false (5–6, 64–79). Stores the tokens "encrypted" in `hmrc_integrations` (91–139). Does not return tokens to the browser (148–151). `verify_jwt = true` (`supabase/config.toml` lines 9–10). | **Real** (the only HMRC call in the repo). |
| `src/services/hmrcService.ts` | `getAuthorizeUrl` and `startOAuth` (62–82): builds `https://test-www.tax.service.gov.uk/oauth/authorize` (or `www.` for production) with `scope=read:vat write:vat read:customs-financials-api`, and keeps a random `state` in `sessionStorage`. `handleOAuthCallback` (84–100) checks `state` in the browser, then invokes `oauth-hmrc`. `getToken` (102–118) calls the `get_hmrc_tokens` RPC and receives **decrypted tokens in the browser**. `getSettings` (181–211) calls `get_hmrc_client_secret` and receives the **decrypted client secret in the browser**. `clearSettings` (214–220) deletes the user's `hmrc_settings` and `hmrc_integrations` rows. Lines 126–127: no submission API is called. | Real OAuth start; no MTD calls. |
| `src/hooks/useHMRCCallback.tsx` | Reads `code`, `state` and `hmrc-callback` from the URL, calls `handleOAuthCallback`, then reloads the page. | Real. |
| `src/components/HMRCIntegration.tsx` | The "HMRC Integration Suite" tool (`/business-tools?tool=hmrc-integration`, a premium tool: `src/pages/BusinessTools.tsx` lines 108–110, 287). Shows connect and disconnect; tabs for VAT, payroll, tax, obligations, settings and logs. Text: "Save your HMRC details and preview returns. Filing is not available yet." (line 145). | UI. |
| `src/components/hmrc/filingStatus.tsx` | `HMRC_FILING_AVAILABLE = false`. Banner text: "HMRC filing is not available yet. Nothing has been sent to HMRC." plus "Example figures to show the layout…". The submit button is always disabled: "Submit to HMRC (not available yet)". | Placeholder (honest). |
| `src/components/hmrc/HMRCVATReturns.tsx` | One hard-coded example return (`EXAMPLES`, lines 21–23: "Q4 2024", vatDue 4250…). Not from B2BNEST data or HMRC. | **Placeholder.** |
| `src/components/hmrc/HMRCObligations.tsx` | "Example deadlines to show the layout (preview only). These are not read from HMRC." (line 136). | **Placeholder.** |
| `HMRCTaxReturns.tsx`, `HMRCPayrollSubmissions.tsx` | Example figures plus the banner. | **Placeholder.** |
| `HMRCSubmissionLogs.tsx` | Reads `hmrc_submission_logs`, says "Nothing has been sent to HMRC". Nothing in the app writes this table (`hmrcService.ts` 126–127). | Empty by design. |
| `HMRCSettings.tsx` | Company name, company number, UTR, VAT number, PAYE ref, **Client ID, Client Secret**, redirect URI (default `${origin}/business-tools?hmrc-callback=true`, line 47), sandbox toggle, a disabled "Automatic VAT filing (not available yet)" switch. Also on Settings → HMRC (`src/pages/Settings.tsx` lines 19, 47). | Real form. |
| `src/pages/Help.tsx` lines 31, 35 | Tells users to register at the HMRC Developer Hub and paste their own Client ID and Secret. | Text to change in P0. |

No `Gov-Client-*` or `Gov-Vendor-*` header, and no other `api.service.hmrc.gov.uk` URL, appears anywhere in `src/` or `supabase/`. I searched for `service.hmrc.gov.uk`, `tax.service.gov.uk`, `Gov-Client`, `Gov-Vendor` and "fraud prevention".

### Database (from migrations and the Sept 2026 baseline)
**Tables** (created in `20251107004724_…sql`, lines 2–56):
- **`hmrc_integrations`:** `user_id`, `organization_id`, `access_token` NOT NULL, `refresh_token`, `expires_at`, `token_type`, `scope`, `is_connected`, `connected_at`, `last_refreshed_at`. UNIQUE(user_id, organization_id).
- **`hmrc_settings`:** `user_id`, `organization_id`, `company_name`, `company_number`, `utr`, `vat_number`, `paye_reference`, `client_id` NOT NULL, `client_secret` NOT NULL, `redirect_uri` NOT NULL, `auto_submit_vat`, `email_notifications`, `reminder_days`, `sandbox_mode` (default true). UNIQUE(user_id, organization_id).
- **`hmrc_submission_logs`:** `submission_type`, `submission_id`, `period`, `status`, `request_payload`, `response_data`, `error_message`. It has an `updated_at` trigger, i.e. it is designed to be updated, so it is not an immutable audit log.

**RLS:** enabled on all three.
- Own-row policies (`auth.uid() = user_id`) for select, insert, update and delete on integrations and settings, and for select and insert on logs (same file, lines 64–104).
- Admins see all logs via `is_admin_or_owner(auth.uid())` (106–108).
- `20260903231518_…sql` lines 433–445 adds "organisation member" checks to the insert/update policies on integrations and settings.
- Phase 25 adds restrictive `require_aal2_if_enrolled` policies on the HMRC tables (`docs/phase25/proposal.sql` lines 158–163; table list in `docs/phase25/README.md` line 197).
- **Users may insert and update their own `hmrc_integrations` rows directly**, so a browser can write arbitrary token values for itself.

**Grants:**
- Token columns: `access_token` and `refresh_token` are revoked from anon and authenticated (`20260523142210`, `20260604233121`, `20260605222340`, `20260606014947`, `20260624151058`, `20260624153720`).
- `client_secret` is revoked from anon and authenticated; authenticated keeps a column list without it (`20260823112950_…sql` lines 27–33).
- No anon grants on HMRC tables in the latest migrations.

**Functions:**
- **`encrypt_hmrc_token` / `decrypt_hmrc_token`** (`20251107004724` lines 147–175; same in the baseline lines 2491, 2618): `'ENC:' || base64(token)`. **This is encoding, not encryption.** Anyone with table read access, a backup or a log can decode it. The decrypt function passes plain text through unchanged.
  - Both are service-role only (`20260903231518` lines ~372–373: "encrypt_*/decrypt_* … stay service_role-only").
  - A trigger `encrypt_hmrc_settings_secret` applies the same encoding to `client_secret` (`20260823112950` lines 18–41).
- **`get_hmrc_tokens(p_user_id)`** (latest in `20261016193000_hmrc_tokens_decrypt.sql`): SECURITY DEFINER, `assert_self`, returns the **decoded** `access_token` and `refresh_token` to the caller. It is granted to authenticated ("CREATE OR REPLACE keeps the existing grants (authenticated only, no anon)").
- **`get_hmrc_client_secret(p_user_id)`** (`20260903231518` lines 133–141): returns the **decoded client secret** to the caller.
- **Phase 25:** `docs/phase25/README.md` lines 100–101 lists both under the "enrolled → aal2" guard, so a user with two-step sign-in set up must have entered the code. A user **without** two-step sign-in can call them at aal1.

**A secret in the repo?** No HMRC secret, token or key is committed:
- `.env.example`, `.env.development` and `.env.production` contain no HMRC keys;
- matches for `client_secret` in migrations and source are column names only.

---

## 2. The connection flow
| Question | Fact (file) |
|---|---|
| Start | Browser: `hmrcService.startOAuth` → `getAuthorizeUrl`, with the user's own `client_id` and `redirect_uri` from `hmrc_settings` (`hmrcService.ts` 62–82; `HMRCIntegration.tsx` 58–80). |
| Redirect URI | Whatever the user typed. Default `${window.location.origin}/business-tools?hmrc-callback=true` (`HMRCSettings.tsx` 47). Whether HMRC accepts a query string in a registered redirect URI is **not verified**. |
| Scopes | `read:vat write:vat read:customs-financials-api` (`hmrcService.ts` 72). The sandbox app's listed subscriptions don't include a customs-financials API, so the extra scope may make HMRC refuse the authorisation (**not verified**). VAT needs `read:vat` and `write:vat` (owner's brief; **not verified** against HMRC's page). |
| State / CSRF | Random 16 bytes in `sessionStorage`, compared in the browser only (`hmrcService.ts` 77–88). `oauth-hmrc` receives `state` but ignores it. There's no server-side binding of state to the user. |
| Token exchange | `oauth-hmrc`, service role, user identified from the JWT (`getUser`, lines 22–32). The code is exchanged with the **user's own** client credentials. |
| Storage | `hmrc_integrations`, base64-"encrypted" (see §1). `expires_at` is computed from `expires_in`. |
| Who can read tokens | The user, decoded, through `get_hmrc_tokens`. Service role directly. Organisation admins: no policy gives them tokens. Company owner/admin is **not** required to connect: any signed-in user who can open the premium tool can. |
| Company binding | `organization_id` = the caller's **first** active membership (`oauth-hmrc` 112–125, `.limit(1)`). With several companies this is arbitrary. |
| Refresh | **None.** `getToken` returns null when expired (`hmrcService.ts` 112). `last_refreshed_at` is never written. No function uses `refresh_token`. HMRC access-token lifetime: **not verified**. |
| Disconnect | Browser deletes its own `hmrc_settings` and `hmrc_integrations` rows (`hmrcService.ts` 214–220). HMRC is not told: no token revocation call; whether HMRC offers one is **not verified**. |
| MFA (aal2) | Database: restrictive aal2 policies on the HMRC tables, and the guard in `get_hmrc_tokens` / `get_hmrc_client_secret` (Phase 25), for users who have two-step set up. **`oauth-hmrc` uses the service role, so database MFA rules don't apply to it.** It checks only that the JWT is valid (`getUser`); it doesn't check the session's `aal`. |

### 2.1 Per-user client credentials
**Facts:** `hmrc_settings.client_id` and `client_secret` are NOT NULL per user, and `Help.tsx` lines 31 and 35 tell customers to create their own Developer Hub app.

**Implication:** for B2BNEST to be "the software", the owner's single HMRC application ("B2BNEST", sandbox) would be used for every customer. Its client id and secret would live only as Edge Function secrets, never in a table or the browser. This matches how the owner's brief describes the sandbox app.

**Not verified:** HMRC's requirement on this point, because HMRC's pages could not be opened.

---

## 3. Fraud prevention headers
- **In the repo:** none. No `Gov-Client-*` or `Gov-Vendor-*` header is built or sent anywhere.
- **From HMRC's specification:** the page for this connection method (<https://developer.service.hmrc.gov.uk/guides/fraud-prevention/connection-method/web-app-via-server/>) could not be opened (403 / host not resolved). The only HMRC text available is a web search summary of `developer.service.hmrc.gov.uk`. It names the following, but they are **not verified against the page**, and no value formats are given here on purpose:

| Header name (as named in the search summary) | Status |
|---|---|
| `Gov-Client-Connection-Method` (value `WEB_APP_VIA_SERVER`) | not verified against the page |
| `Gov-Client-Public-IP` | not verified |
| `Gov-Vendor-Version` | not verified |
| `Gov-Vendor-Public-IP` | not verified |

The search summary also said that for this method `Gov-Client-Browser-Plugins`, `Gov-Client-Local-IPs` and `Gov-Client-Local-IPs-Timestamp` need not be sent, and that Do Not Track is optional (change log, version 3.2). **Not verified.**

**Not listed because they could not be verified:** the rest of the `Gov-Client-*` / `Gov-Vendor-*` set for `WEB_APP_VIA_SERVER`, every value format, and which headers are mandatory. This includes headers about the client's device, user IDs, timezone, screen, window, browser, multi-factor details, public port, vendor licence and forwarding. **P2 must start by reading the page.**

**HMRC also publishes a "Test Fraud Prevention Headers" API.** Search result: <https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/txm-fph-validator-api/1.0/oas/page>; endpoint details not verified. The owner says it is being added to the sandbox app.

---

## 4. Data B2BNEST holds for a VAT return
**What the tables hold** (from `src/integrations/supabase/types.ts` and the components):
- **`invoices`:** `subtotal`, `tax_rate` (**one rate per document**), `tax_amount`, `total_amount`, `currency` (any currency), `items` (jsonb; each line has description, quantity, rate and amount, **no per-line VAT**; `src/components/QuoteInvoiceCreationSection.tsx` ~190–250), `status`, `created_at`, `due_date`, `paid_at`.
  - There is **no issue date or tax-point column**, only `created_at`.
  - The table is keyed by `user_id`; there's no `organization_id` in the generated types.
- **`quotes`:** same shape; quotes are not supplies and don't belong in a return.
- **`expenses`:** `amount`, `category`, `date`, `status`, `supplier_id`. **No VAT amount, no rate, no net/gross split** (`src/components/finance/ExpensesTab.tsx` line 16). No currency column (line 22: account currency).
- **`bills`:** `amount`, `issue_date`, `paid_date`, `currency`, vendor fields. **No VAT.**
- **`outgoings`:** recurring definitions (`amount`, `frequency`, `next_payment_date`), not transactions. **No VAT.**
- **`bank_transactions`:** raw `amount`, `category`, `transaction_date`, `currency`. **No VAT.**
- **VAT registration number:** `hmrc_settings.vat_number` (per user, free text, not validated).
- **VAT scheme** (standard, flat rate, cash accounting): **no field anywhere.**
- **Accounting periods:** **no field.** Periods would come from HMRC obligations (P3).
- **EU fields:** no EU, country or "goods vs services" flags on any table.

| Box (owner's wording) | Can B2BNEST supply it today? | What's missing |
|---|---|---|
| 1. VAT due on sales | **Partly.** Sum of `invoices.tax_amount` for the period. | Tax-point date (only `created_at`, `paid_at`); per-line rates (mixed-rate invoices are wrong); GBP only (non-GBP invoices have no conversion); credit notes don't exist; draft and void statuses would need rules; cash accounting would need `paid_at` plus part-payments (none). |
| 2. VAT due on acquisitions (EU) | **No.** | No EU flags. Whether this box still applies to GB businesses after Brexit is **not verified** (owner's wording used; may be Northern Ireland only). |
| 3. Total VAT due (1+2) | Derived; only as good as 1 and 2. | — |
| 4. VAT reclaimed on purchases | **No.** | Expenses, bills and outgoings have no VAT amount or rate. |
| 5. Net VAT (3−4) | Derived; not possible without 4. | — |
| 6. Total sales ex VAT | **Partly.** `invoices.subtotal` for the period. | Same date and currency problems as box 1. Rounding rules (whole pounds?) are **not verified**. |
| 7. Total purchases ex VAT | **No.** | Only gross amounts on expenses and bills. |
| 8. Supplies to EU | **No.** | No EU or goods flags. |
| 9. Acquisitions from EU | **No.** | No EU or goods flags. |

**Honest conclusion:** B2BNEST cannot produce a correct VAT return from today's data. At most it can produce a sales-side **estimate** (boxes 1 and 6, GBP invoices only), and it should say so on screen.

---

## 5. Gaps and risks (most severe first)
1. **Secrets and tokens reachable by the browser** (critical):
   - `get_hmrc_tokens` and `get_hmrc_client_secret` return decoded values to authenticated users;
   - storage is base64, not encryption;
   - users can write their own `hmrc_integrations` rows directly.

   Fix: tokens only ever inside an Edge Function; real encryption (for example Supabase Vault or pgsodium, or an Edge-Function-held key; choice to be made); revoke the RPCs and the client write grants.
2. **Wrong credential model** (critical): each customer pastes their own Developer Hub app. Fix: the owner's app credentials go into Edge Function secrets only; drop `client_id`/`client_secret` from `hmrc_settings` (after a data decision for existing rows).
3. **No server-side authorisation of who may connect or submit** (high): today any user with the tool can. The rule should be the company owner or admin only, checked in the Edge Function (service role skips RLS), plus an aal2 check of the caller's JWT inside the function.
4. **Double submission** (high): there's no idempotency. A submission needs a unique key (company, VRN, period key), a record written *before* the call, and a "submitted" state that can't be repeated. HMRC's own duplicate behaviour is **not verified**.
5. **No immutable audit log** (high): `hmrc_submission_logs` can be updated, and its writes come from the browser. Needed: an append-only record written by the Edge Function only (request summary, HMRC response, correlation id, who confirmed, exact figures, timestamps); no update or delete grants. Whether HMRC requires a receipt or correlation id to be kept is **not verified**.
6. **Data not fit for a return** (high, see §4): per-line VAT on sales and purchases, tax-point date, GBP only, credit notes, VAT scheme.
7. **Fraud prevention headers missing** (high): HMRC states they are required on MTD calls (search summary only, **not verified**). The Edge Function needs browser-collected values passed to it, and server-side values added.
8. **Token expiry and refresh** (medium): nothing refreshes. Needed: refresh inside the Edge Function before each call, with locking so two calls don't refresh at once. Lifetimes and refresh-token rotation are **not verified**.
9. **Company binding** (medium): `organization_id` comes from the first membership. It must be the company chosen in the app, and the caller must be its owner or admin.
10. **HMRC errors and rate limits** (medium): there's no handling. Needed: map HMRC error codes to plain words, retry and back-off, and never auto-retry a submission. HMRC's rate limits are **not verified**.
11. **Confirmation step** (medium): the person must see the exact nine figures and the period, and make the declaration, before submitting. The exact declaration wording HMRC requires is **not verified**.
12. **OAuth state** (low to medium): browser-only check; bind state server-side, with a single-use row.
13. **Scope** (low): drop `read:customs-financials-api` unless it's needed.

---

## 6. Proposed phases (each one PR; nothing applied or deployed by the PR author)
| # | Phase | SQL | Edge Functions | Tests | Owner must |
|---|---|---|---|---|---|
| **P0** | **Rebuild the connection** | New `hmrc_connections` per company: real encryption, no client columns, no client grants. Revoke `get_hmrc_tokens` / `get_hmrc_client_secret` from authenticated (or drop them). Server-side `hmrc_oauth_states`. Guard and RLS as in Phase 25. Data decision for old rows. | `hmrc-connect-start` (makes state; owner/admin and aal2 checked), `hmrc-connect-callback` (exchanges the code with **vendor** credentials from secrets), `hmrc-disconnect`. A shared token helper with refresh. | Local Postgres suite; Deno tests with HMRC mocked; vitest for the UI and Help text. | Add `HMRC_CLIENT_ID` / `HMRC_CLIENT_SECRET` (sandbox) as function secrets. Register the exact redirect URI in the sandbox app. Decide the encryption method. |
| **P1** | **Hello World** | none | `hmrc-hello` (application- and user-restricted hello) | Deno with HMRC mocked; one manual sandbox run by the owner. | Run it in the sandbox. Create a sandbox test user (Create Test User API). |
| **P2** | **Fraud prevention headers** | none | Shared header builder; browser collector for client values. Call HMRC's Test Fraud Prevention Headers API. | Deno: every header present and formatted **per HMRC's page (read first)**. | Allow `developer.service.hmrc.gov.uk` so the spec can be read; add the test API to the app. |
| **P3** | **Read VAT obligations** | `hmrc_vat_obligations` cache (company, VRN, period key, dates, status, fetched_at), read-only for members. | `hmrc-vat-obligations` (owner/admin, aal2, refresh, headers). | Deno; suite; vitest for the Obligations tab (real data instead of examples). | Sandbox test user with a VRN. |
| **P4** | **VAT data model** | Per-line VAT rate and amount on invoice items; VAT on expenses, bills and outgoings; tax-point date; VAT scheme on the company; credit notes (scope to agree). | none | Suite; vitest for the forms. | Decide which schemes to support first (suggest standard only). |
| **P5** | **VAT return preview** | Optional `vat_return_drafts`. | none, or a calculation function | vitest for the box calculations against hand-worked examples. | Check the figures with an accountant. |
| **P6** | **Sandbox submission** | `hmrc_vat_submissions`, append-only and unique per company/VRN/period key; write-once receipt. | `hmrc-vat-submit`: owner/admin, aal2, confirmation token, idempotency, headers, no automatic retry. | Deno; suite (double submit refused, no update or delete); vitest for the confirmation screen. | Run in the sandbox; keep evidence for HMRC. |
| **P7** | **Before production credentials** | — | — | — | HMRC's production checklist (production approval, fraud-header evidence, terms of use, any recognition listing): **not verified**, since the pages couldn't be read. To be listed from HMRC's pages once reachable. |

---

## 7. Questions for the owner (blocking only)
1. **Credentials:** confirm customers will connect through **B2BNEST's one HMRC application**, so the per-user Client ID/Secret fields and Help text are removed. Do any customers have saved credentials that need a migration message?
2. **Encryption:** Supabase Vault/pgsodium, or a key held only by the Edge Functions?
3. **Who may connect and submit:** company **owner and admins only**, or owner only?
4. **VAT scope for the first release:** standard scheme only (no flat rate, no cash accounting, no EU boxes), GBP only. Agreed?
5. **Allow `developer.service.hmrc.gov.uk` and `www.gov.uk`** in this environment's network settings, so P2 and P7 can be checked against HMRC's own pages.

---

## Sources
- Repo files as cited above (paths and line numbers as of `main` at `d9404f2`).
- HMRC, via web search results only (the pages themselves were not opened):
  - [Web application via server - Fraud prevention - HMRC Developer Hub](https://developer.service.hmrc.gov.uk/guides/fraud-prevention/connection-method/web-app-via-server/)
  - [What you need to send - HMRC Developer Hub](https://developer.service.hmrc.gov.uk/guides/fraud-prevention/connection-method/)
  - [Change log - Fraud prevention](https://developer.service.hmrc.gov.uk/guides/fraud-prevention/change-log/)
  - [Test Fraud Prevention Headers API](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/txm-fph-validator-api/1.0/oas/page)
