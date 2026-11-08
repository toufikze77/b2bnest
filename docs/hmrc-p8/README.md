# HMRC P8: see what HMRC holds, receipt, deadline reminders, pre-submit checks

**B2BNEST stays sandbox only.** `readConfig` still refuses production. Nothing was applied, deployed or sent to HMRC
from this work. The only production access was read-only: table names, function bodies (md5 only) and the audit event
rule, on 8 Nov 2026.

**Who can use it:** unchanged. Business, Scale and the trial; owners and admins only; aal2 when an authenticator is
enrolled; demo people refused (demo guard); suspended accounts refused (`hmrc_manage_allowed`).

## 0. What was verified

**Source:** HMRC's published VAT (MTD) API 1.0 definition, from HMRC's own repository:
https://raw.githubusercontent.com/hmrc/vat-api/main/resources/public/api/conf/1.0/application.yaml (OpenAPI 3.0.3),
read on **8 Nov 2026**. HMRC's Developer Hub (developer.service.hmrc.gov.uk) couldn't be fetched from this session
(blocked by the network), so nothing below was checked there.

Base URL (sandbox): `https://test-api.service.hmrc.gov.uk`. Header `Accept: application/vnd.hmrc.1.0+json`. All five
are user-restricted.

| Capability | Path, version, scope | Query | 200 response (fields we use) | Errors (HTTP) | Gov-Test-Scenario | Status |
| --- | --- | --- | --- | --- | --- | --- |
| View VAT return | `GET /organisations/vat/{vrn}/returns/{periodKey}`, 1.0, `read:vat` | none (`periodKey` 4 characters; `#` sent as `%23`) | `periodKey` and the nine boxes: `vatDueSales`, `vatDueAcquisitions`, `totalVatDue`, `vatReclaimedCurrPeriod`, `netVatDue`, `totalValueSalesExVAT`, `totalValuePurchasesExVAT`, `totalValueGoodsSuppliedExVAT`, `totalAcquisitionsExVAT` | 400 `VRN_INVALID`, `PERIOD_KEY_INVALID`; 403 `DATE_RANGE_TOO_LARGE`, `CLIENT_OR_AGENT_NOT_AUTHORISED`, `RULE_INSOLVENT_TRADER`; 404 `NOT_FOUND` | `DATE_RANGE_TOO_LARGE`, `INSOLVENT_TRADER`. The sandbox returns what was submitted to it, and 404 for a period not submitted | **VERIFIED** (8 Nov 2026, OpenAPI file) |
| Liabilities | `GET /organisations/vat/{vrn}/liabilities`, 1.0, `read:vat` | `from`, `to` (both required, YYYY-MM-DD; at most 365 days; up to today; HMRC documents 2017-12-01 as the earliest date) | `liabilities[]`: `taxPeriod {from, to}`, `type` (required), `originalAmount` (required), `outstandingAmount`, `due` | 400 `VRN_INVALID`, `DATE_FROM_INVALID`, `DATE_TO_INVALID`, `DATE_RANGE_INVALID`; 403 `CLIENT_OR_AGENT_NOT_AUTHORISED`, `RULE_INSOLVENT_TRADER`; 404 `NOT_FOUND` | none (no data), `SINGLE_LIABILITY` (2017-01-02 to 2017-02-02), `MULTIPLE_LIABILITIES` (2017-04-05 to 2017-12-21), `SINGLE_LIABILITY_2018_19` (2018-01-02 to 2018-02-02), `MULTIPLE_LIABILITIES_2018_19` (2018-04-05 to 2018-12-21), `INSOLVENT_TRADER` | **VERIFIED** (8 Nov 2026, OpenAPI file) |
| Payments | `GET /organisations/vat/{vrn}/payments`, 1.0, `read:vat` | as liabilities | `payments[]`: `amount` (required), `received` | as liabilities | `SINGLE_PAYMENT` (2017-01-02 to 2017-02-02), `MULTIPLE_PAYMENTS` (2017-02-27 to 2017-12-21), `SINGLE_PAYMENT_2018_19`, `MULTIPLE_PAYMENTS_2018_19` (2018-02-27 to 2018-12-21), `INSOLVENT_TRADER` | **VERIFIED** (8 Nov 2026, OpenAPI file) |
| Penalties | `GET /organisations/vat/{vrn}/penalties`, 1.0, `read:vat` | none | `totalisations`, `lateSubmissionPenalty {summary, details[]}`, `latePaymentPenalty {details[]}` | 400 `VRN_INVALID`; 403 `CLIENT_OR_AGENT_NOT_AUTHORISED` | `DEFAULT`, `NO_PENALTIES`, `LATE_SUBMISSION`, `LATE_PAYMENT`, `MULTIPLE_PENALTIES`, `MULTIPLE_LATE_PAYMENT_PENALTIES`, `MULTIPLE_LATE_SUBMISSION_PENALTIES`, `MULTIPLE_INACTIVE_LATE_SUBMISSION_PENALTIES`, `THRESHOLD_LATE_SUBMISSION_PENALTIES`, `CHARGE_LATE_SUBMISSION_PENALTIES` | **VERIFIED** (8 Nov 2026, OpenAPI file). **Caveat:** HMRC's schema and its own example name some detail fields differently, so we accept both sets, whitelisted |
| Financial details | `GET /organisations/vat/{vrn}/financial-details/{penaltyChargeReference}`, 1.0, `read:vat` | none | (not used) | 400 `VRN_INVALID`, `CHARGE_REFERENCE_INVALID`; 403 `CLIENT_OR_AGENT_NOT_AUTHORISED`; 404 `MATCHING_RESOURCE_NOT_FOUND` | `DEFAULT` | **VERIFIED, NOT BUILT** (follow-up) |
| Customer information | `GET /organisations/vat/{vrn}/information`, 1.0, `read:vat` | none | (not used) | 400 `VRN_INVALID`; 401 `INVALID_CREDENTIALS`; 403 `CLIENT_OR_AGENT_NOT_AUTHORISED`; 404 `NOT_FOUND` | — | **VERIFIED, NOT BUILT** (not requested) |

**Scopes:** every one uses `read:vat`, which B2BNEST already asks for at connect. **No new scope.**

**Box constraints** (same file, used by the pre-submit checks): boxes 1 to 4 are −9,999,999,999,999.99 to
9,999,999,999,999.99; **box 5 (`netVatDue`) is 0 to 99,999,999,999.99, so it can't be negative**; boxes 6 to 9 are
whole pounds, −9,999,999,999,999 to 9,999,999,999,999. `totalVatDue` must equal `vatDueSales + vatDueAcquisitions`
(`VAT_TOTAL_VALUE`) and `netVatDue` must be their absolute difference with box 4 (`VAT_NET_VALUE`).

**NOT VERIFIED:** HMRC's Test Fraud Prevention Headers page and the VAT end-to-end service guide (both blocked here).

## 1. What was built

### Edge Functions (read only; GET to HMRC only; sandbox only)

| Function | What it does | Audit rows |
| --- | --- | --- |
| `hmrc-vat-return-view` | For a period **we sent and HMRC accepted**, reads HMRC's copy and compares the nine boxes with `hmrc_vat_submissions.figures`. Answers `{ matches, differences: [{ box, field, ours, hmrc }] }`. Writes nothing but the audit. A period we never sent is refused (`not_submitted`) before HMRC is asked | `vat_return_view_call` / `vat_return_view_result` (`matches`, `differs`, `not_found` or HMRC's code) |
| `hmrc-vat-liabilities` | Liabilities for `from` to `to` (strict dates with `dayOf`, at most 365 days, up to today). HMRC's 404 means none | `vat_liabilities_call` / `vat_liabilities_result` |
| `hmrc-vat-payments` | Payments HMRC received, same rules | `vat_payments_call` / `vat_payments_result` |
| `hmrc-vat-penalties` | Late submission and late payment penalties, with the line "This is what HMRC shows. Check your HMRC account for the final position." | `vat_penalties_call` / `vat_penalties_result` |

They all follow `hmrc-vat-obligations`. The shared code is `supabase/functions/_shared/hmrc/vatReads.ts`, served by `readServe.ts`:
- the same `identify`, `canManage`, `callHmrc` and fraud headers;
- a 20 s timeout;
- the 4xx/5xx mapping, including the nested `errors` codes (P7c);
- **one audit row before the call** (`<kind>_call`, written by the slot function) and **one after** (`<kind>_result`). Both hold codes only.

**Never retried.** The only repeat is the shared one-off token refresh on a 401, exactly as for obligations: it
refreshes the token and repeats the same GET once. A 429, 5xx or timeout is never repeated.

**Never logged or returned:** a token, an HMRC response body, or more than the last 3 digits of the VAT number.
- Only whitelisted, well-formed fields are passed on.
- Strings are short codes, references and dates; numbers are amounts.
- Nothing HMRC returns is stored.

**Rate limit:** 10 an hour per company **for each read**, in its own bucket (obligations, test calls and submissions
are not affected). If the P8 SQL isn't applied yet, each function answers **"This isn't available yet."** (503
`not_available`) and HMRC isn't called.

**New answer codes** (same wording in `errors.ts` and `src/lib/hmrcConnection.ts`):
- `not_available` (503);
- `read_limit` (429);
- `not_submitted` (409);
- `return_not_found` (409);
- `dates_invalid` (400).

**Small shared change:** `api.ts` now accepts `%XX` in a path, so a period key with `#` can be sent as `%23`. The
other functions' paths are unaffected.

**config.toml:** each new function has `verify_jwt = true`. They are in the demo guard's refuse list
(`demo-guard_test.ts`) and in `docs/demo-readonly/README.md`.

### SQL (written and tested, NOT applied): needed

`docs/hmrc-p8/proposal.sql` is additive, `SET search_path = ''`, and doesn't change any immutability trigger. It does two things:
1. `hmrc_audit_log.event` also allows the eight new events: `vat_return_view_*`, `vat_liabilities_*`, `vat_payments_*`
   and `vat_penalties_*`, each as `_call` and `_result`. `hal_reason` is unchanged: codes only.
2. `public.hmrc_take_read_slot(company, user, environment, kind, limit 10)`:
   - service role only, SECURITY INVOKER;
   - takes a per-company, per-kind advisory lock;
   - counts `<kind>_call` rows in the last hour; an unknown kind is refused;
   - the limit is capped at 60.

It refuses unless production matches what was read on 8 Nov 2026:
- 148 tables;
- the 15-event rule;
- the md5 of `_hmrc_audit_append_only`, `_hmrc_vat_submission_guard`, `hmrc_manage_allowed` and `hmrc_take_obligations_slot`. P7b's two bodies were applied without their comment lines, so either form is accepted.

`rollback.sql` refuses while P8 audit rows exist, unless `SET app.hmrc_p8_force = 'on'`. The old rule then comes back
as NOT VALID, and the history stays.

**Tests:** `PG_RUN_USER=postgres bash docs/hmrc-p8/run-test.sh`, on a disposable local Postgres: **37 PASS, 0 FAIL**. They cover:
- production's shape;
- an empty rollback restoring the exact fingerprint;
- the slot (10 an hour, separate buckets, older rows not counted, cap 60);
- the event rule;
- the audit log staying append-only;
- no access for `authenticated` or `anon`;
- refusals on a second apply and on drift;
- the forced rollback.

### Screens (VAT Returns page)

All are in the TEST ENVIRONMENT, for owners and admins.
- **"Check what HMRC holds"**, in the submission history, for each accepted submission: "Matches what you sent", or
  the boxes that differ (yours and HMRC's).
- **"Receipt"**, for each accepted submission, built from our stored row only (no HMRC call). It shows:
  - the form bundle number;
  - the period;
  - the nine boxes;
  - the date and time, and who sent it;
  - the company name;
  - the last 3 digits of the VAT number;
  - "Sent via B2BNEST to HMRC";
  - the TEST ENVIRONMENT label.

  "Print or save as PDF" uses the browser's print with print-only CSS (`src/index.css`, `print-hmrc-receipt`). No new dependency.
- **"What you owe and what HMRC received"**: liabilities and payments for a date range (default: the last 365 days)
  in GBP, with "test data, not your real HMRC account". Scenario pickers are for the sandbox only.
- **"Penalties"**: totals, the late submission summary and details, late payment details, and the "check your HMRC
  account" line.
- **Every new button** has loading, error and "This isn't available yet." states. The not-available state covers a
  function that isn't deployed (404 or unreachable) or SQL that isn't applied.

### Deadline reminders (no HMRC call)

- An in-app banner when an open return is due within 14, 7 or 1 days, is due today, or is overdue. The most urgent
  return comes first, with a count of the others.
- It uses the obligations the page has already read, from either "Get obligations" button. It makes **no extra HMRC
  call** and nothing is stored, so the banner appears once obligations have been read on the page.
- **Email reminders: not built.** There is no existing safe pattern. A reminder email would need a scheduled job that
  either reads obligations from HMRC for every company or stores due dates. Both are owner decisions (a new
  scheduled job, and storing HMRC data).

### Pre-submit checks (front end)

- **Blocks** (HMRC itself rejects these, per the API definition above):
  - box 3 ≠ box 1 + box 2;
  - box 5 ≠ |box 3 − box 4|;
  - a negative box 5.
- **Warns only:** a box more than 50% higher or lower than in the last accepted return for another period.
- Every other box may be negative, so it isn't flagged.
- The wording ends "This is a check, not tax advice."
- The server's own blocking rules (`vatSubmit.ts`) are unchanged.
- The server builds box 3 and box 5 itself, so the blocking checks are a safety net.

## 2. Owner test steps (sandbox)

Do these after the rollout below, as an owner of the test company that is connected to HMRC's sandbox.
1. **View return for 18A1:** VAT Returns → Submission history → the accepted 18A1 row → **Check what HMRC holds**.
   Expect "Matches what you sent". Reload, and the audit has `vat_return_view_call` and `vat_return_view_result:matches`.
2. **Liabilities:** "What you owe…": set From 2017-01-02 and To 2017-02-02, choose the `SINGLE_LIABILITY` scenario,
   then **Get liabilities and payments**. Expect one liability in GBP. With no scenario, expect "HMRC shows no
   liabilities".
3. **Payments:** the same dates with `SINGLE_PAYMENT`. Expect one payment. Try 2017-02-27 to 2017-12-21 with
   `MULTIPLE_PAYMENTS`.
4. **Penalties:** choose `MULTIPLE_PENALTIES` and **Get penalties**. Expect totals and details, plus the "check your
   HMRC account" line. `NO_PENALTIES` gives "HMRC shows no penalties".
5. **Receipt:** on the 18A1 row choose **Receipt**, then **Print or save as PDF**. Only the receipt prints. Check the
   form bundle number (529735553360), the boxes and "Sent via B2BNEST to HMRC".
6. **Reminder banner:** choose **Get open obligations from HMRC** (for example with the obligations scenario
   `QUARTERLY_NONE_MET`). If an open obligation is due within 14 days or overdue, the banner appears.
7. **Rate limit:** the 11th read of one kind in an hour says "You can do this 10 times an hour…".
8. Keep screenshots and the dates of each step.

## 3. Rollout (owner, in this order)

1. **SQL** (only after review): apply `docs/hmrc-p8/proposal.sql` in the Supabase SQL editor (one transaction).
2. **Functions:** in PowerShell:

   ```powershell
   cd C:\b2bnest-deploy
   git pull
   npx.cmd supabase functions deploy hmrc-vat-return-view --project-ref gvftvswyrevummbvyhxa --use-api
   npx.cmd supabase functions deploy hmrc-vat-liabilities --project-ref gvftvswyrevummbvyhxa --use-api
   npx.cmd supabase functions deploy hmrc-vat-payments --project-ref gvftvswyrevummbvyhxa --use-api
   npx.cmd supabase functions deploy hmrc-vat-penalties --project-ref gvftvswyrevummbvyhxa --use-api
   ```

   - JWT verification stays on (`supabase/config.toml`). **Never use `--no-verify-jwt`.**
   - No new secret is needed.
   - Redeploy `hmrc-vat-obligations` and `hmrc-vat-submit` too. They import the shared `api.ts`, whose `%XX` change is harmless to them. The rest of the PR doesn't change them.
3. **Front end:** publish the app. Before steps 1 and 2 are done, the new buttons say "This isn't available yet."

**Rollback:** publish the previous front end, delete the four functions, then run `docs/hmrc-p8/rollback.sql`.

## 4. Risks

- **Field names in penalties.** HMRC's schema and its example differ, so a field we don't know is dropped. The
  screen then shows less, never something wrong.
- **Sandbox data is test data.** The screens say so. The sandbox's liabilities and payments scenarios use 2017 and 2018
  dates, which are earlier than HMRC's documented earliest date. We let HMRC judge the earliest date, so those
  scenarios work.
- **The reminder depends on obligations being read on the page.** It is not a substitute for HMRC's own reminders.
- **Shared change in `api.ts`** (`%XX` in a path). Covered by the P8 tests and the existing suites (504 Deno tests pass).

## 5. Out of scope (NOT DONE)

- Production (refused in code). Any write to HMRC beyond the existing P6 submission.
- Financial details (`/financial-details/{penaltyChargeReference}`) and customer information: verified, not built.
- Email reminders, and any scheduled job.
- Storing liabilities, payments or penalties.
- HMRC's Test Fraud Prevention Headers page and the end-to-end guide: not verified (blocked here).
- An accountant review of the box rules; an independent penetration test; HMRC approval. **None of these is claimed.**

## Checks

| Check | Result |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| `npx eslint .` (baseline 510) | 509 problems (unchanged) |
| `npx vitest run` | exit 0: 184 files, 1726 tests, no "Unhandled" |
| Deno tests (`supabase/functions/`) | 504 passed, 0 failed (17 new in `_shared/hmrc/p8_test.ts`) |
| `docs/hmrc-p8/run-test.sh` | 37 PASS, 0 FAIL |
| `npm run build` | exit 0 |
