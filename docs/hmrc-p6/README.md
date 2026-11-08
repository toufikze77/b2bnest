# HMRC P6: submit a VAT return to HMRC's TEST environment (sandbox)

**Status: SQL prepared, NOT applied. `hmrc-vat-submit` written, NOT deployed.**
- **Sandbox only.** Production is refused exactly as before (`readConfig`: `HMRC_ENV` other than `sandbox` → "not configured"). There is no production URL path, flag or credential in this PR, and the new table's `environment` column only accepts `'sandbox'`.
- **Nothing is filed with HMRC for real.** Nothing claims Making Tax Digital readiness.

## What changed
- **Database** (`proposal.sql`, not applied):
  - **New table `hmrc_vat_submissions`:** one row per attempt. It holds the nine boxes **exactly as sent** and their SHA-256, the request id, who and when, HMRC's receipt, the HTTP status, a short error code and message, the last 3 digits of the VAT number, and the test scenario.
  - **One live submission per period:** a partial unique index on `(organization_id, environment, period_key)` for rows that are `submitting`, `accepted` or `unknown`.
  - **Immutable:** a trigger enforces it for everyone, service role and database owner included. RLS lets owners and admins read their company's rows (with the Phase 25 restrictive policy); the browser has no write grant. The demo guard trigger is on the table.
  - **`hmrc_begin_vat_submission(...)`** (service role): rate limit (5 an hour per company), the `submitting` row and the `vat_submit_start` audit row in one transaction.
  - **`hmrc_audit_log.event`:** also allows `vat_submit_start`, `vat_submit_result`, `vat_submit_unknown`, `vat_submit_check`, `fraud_validate`. The log stays append-only.
  - **Why not `hmrc_submission_logs`:** it can be written and changed from the browser, per user, with no company rule (audit §5 item 5), so it can't be the record. It is left untouched.
- **Edge Function `hmrc-vat-submit`** (`_shared/hmrc/vatSubmit.ts`, `submitStore.ts`): JWT on; demo refused by `guardedDenoServe`. It runs the same checks as `hmrc-vat-obligations`: sandbox only, a valid session, aal2 when an authenticator is enrolled, `hmrc_manage_allowed` (owner or admin, Business, Scale or trial, not suspended), the connection, a VAT number, and the same fraud prevention headers. It has three actions:
  - **`prepare`:**
    - reads the **open** obligations live from HMRC (must contain the period key);
    - recomputes the nine boxes on the server: the P5 SQL function **with the caller's own JWT**, then the shared box maths;
    - returns the figures, the left-out counts, any blocking issues (period not ended; records not recorded or with no company in the period; already submitted, submitting or unknown);
    - and, when nothing blocks, a **10-minute signed confirmation token** (HMAC-SHA256 over company, period key, figures hash, person and expiry, keyed by the Edge secret `HMRC_VAT_CONFIRM_SECRET`).
  - **`submit`:**
    - **Checks:** `declaration: true` and the token (signature, expiry, same person, company and period).
    - **Recomputes:** reads the obligation and the figures again; if the hash differs, it refuses with `figures_changed` ("Your records changed: review the return again").
    - **Starts:** `hmrc_begin_vat_submission` takes the rate limit and writes the `submitting` row. The unique index makes a second concurrent call fail cleanly as "already being submitted".
    - **Sends once:** **one** POST to HMRC (no 401 refresh-and-retry: `noRetry`; a 30-second timeout).
    - **Records the result:** 201 → `accepted` with the receipt; a clear refusal → `rejected` with a stable code and plain words; a network error, timeout or 5xx → `unknown` (never retried).
    - **The browser never supplies figures:** any it sends are ignored.
  - **`check`:** for an `unknown` attempt, it reads the period's obligation live.
    - **Fulfilled:** `accepted`, recorded as "HMRC shows this period as fulfilled; no receipt".
    - **Still open:** the person may record "HMRC did not receive it" → `rejected`, which allows one new attempt.
    - **No second POST** is possible while a row is `unknown`.
  - **Fraud-header validation** reuses the existing P2 `hmrc-test-call` (`fraud_headers_validate`), shown inside the new section. The `fraud_validate` audit event is allowed for later use but not written yet.
  - **Box maths:** shared through an identical copy in `supabase/functions/_shared/vat/`. `src/lib/vat/returnBoxes.parity.test.ts` checks the files are identical and give identical results.
  - **`callHmrc`** gained `noRetry` and `timeoutMs` (existing calls unchanged).
- **Screen** (HMRC → VAT Returns, below the P5 preview): **Submit to HMRC (test environment)**, with the banner "TEST ENVIRONMENT. Nothing here is filed with HMRC for real."
  - **Steps:** Get open obligations → pick one (and optionally a sandbox test scenario) → **Prepare the return**. You see the nine boxes, the left-out counts and any blocking issues.
  - **Confirm:** the declaration checkbox, and typing the period key (for example `18A1`). **Submit** is disabled until both are done, and a second click while submitting does nothing.
  - **Result card:**
    - **accepted:** processing date, form bundle number, payment indicator;
    - **rejected:** the reason in plain words;
    - **unknown:** "We don't know if HMRC received it. Do not submit again. Check with HMRC", with **Check with HMRC**, then **Record that HMRC did not receive it** if HMRC still shows the period open.
  - **Submission history:** period, date, who, status, receipt, scenario. No edit or delete; **Download receipt (CSV)** per row.
  - **States:** members, Solo, demo and production-connected companies see no section (the P5 states). A company that isn't connected sees "Connect … first", and a connection without `write:vat` sees "Connect to HMRC again". The other tabs keep their "Preview only" banners, and P5 is unchanged.
- **Assistant:** `knowledge.ts` says submissions go to the test environment only, nothing is filed for real, each attempt is recorded permanently, and an unknown result means check, not resubmit.
- **Config:** `supabase/config.toml` has `[functions.hmrc-vat-submit] verify_jwt = true`. The demo-guard list (test and `docs/demo-readonly/README.md`) includes `hmrc-vat-submit`.

## HMRC facts (all from memory: NOT verified)
This environment can't open HMRC's pages. Each fact is in **one constants place**: `VAT_RETURN_API`, `SUBMIT_SCENARIOS` and `HMRC_SUBMIT_ERRORS` in `supabase/functions/_shared/hmrc/vatSubmit.ts`.

| # | Fact | Verified? |
|---|---|---|
| 1 | `POST {api}/organisations/vat/{vrn}/returns`, scope `write:vat`, `Accept: application/vnd.hmrc.1.0+json`, `Content-Type: application/json`, the company's user token | not verified (the Accept header format and `write:vat` scope were verified in P1/P3 for other endpoints) |
| 2 | Body fields `periodKey`, `vatDueSales`, `vatDueAcquisitions`, `totalVatDue`, `vatReclaimedCurrPeriod`, `netVatDue` (non-negative), `totalValueSalesExVAT`, `totalValuePurchasesExVAT`, `totalValueGoodsSuppliedExVAT`, `totalAcquisitionsExVAT`, `finalised: true` | not verified |
| 3 | Boxes 1-5 at most 2 decimals; boxes 6-9 whole pounds | not verified |
| 4 | Period key: 4 characters, may contain `#` | not verified (P3 accepts the same shape from HMRC's obligations) |
| 5 | Success: 201 with `processingDate`, `paymentIndicator` (`DD`, `BANK` or none), `formBundleNumber`, `chargeRefNumber` (may be absent) | not verified |
| 6 | Errors: 400 invalid body; 403 `DUPLICATE_SUBMISSION`, `TAX_PERIOD_NOT_ENDED`, `INVALID_PERIODKEY`, `INSOLVENT_TRADER`; 404 `NOT_FOUND`; 401; 429; 5xx | not verified (401, 429, 5xx behaviour verified in P1 for the API in general) |
| 7 | Sandbox `Gov-Test-Scenario` values for this endpoint: `DUPLICATE_SUBMISSION`, `TAX_PERIOD_NOT_ENDED`, `INVALID_PERIODKEY`, `INSOLVENT_TRADER`, `NOT_FOUND` | not verified |
| 8 | A submitted period shows as fulfilled (`F`) in the obligations (used by `check`) | not verified |
| 9 | Test Fraud Prevention Headers validate endpoint (P2) | verified in P2 (4 Nov 2026) |

## State machine
| From | To | When |
|---|---|---|
| (none) | `submitting` | `hmrc_begin_vat_submission` wrote the row: rate limit OK, no live row for the period |
| `submitting` | `accepted` | HMRC answered 201 (receipt stored) |
| `submitting` | `rejected` | a clear refusal (400, 401, 403, 404, 429, or the request never left) |
| `submitting` | `unknown` | a network error, a timeout or a 5xx: nothing is retried |
| `unknown` | `accepted` | **check:** HMRC shows the period fulfilled (no receipt) |
| `unknown` | `rejected` | **check:** still open and the person recorded "HMRC did not receive it" |
| `accepted` / `rejected` | — | final, forever |

**Idempotency.**
- The partial unique index allows only one row per company, environment and period while it is `submitting`, `accepted` or `unknown`. `hmrc_begin_vat_submission` inserts under a per-company advisory lock.
- A double click, two tabs, or two people at once: exactly one row is written and exactly one POST reaches HMRC. The others get "already being submitted".
- A `rejected` row frees the period for a new attempt.

**Immutability.**
- The trigger refuses DELETE, TRUNCATE, an INSERT that isn't `submitting` with no result, and any change to the identity, period, figures, hash, request id, who, when, VAT digits or scenario.
- It allows only the moves in the table above. A result field can be written once.
- `service_role` has no DELETE grant, and the trigger stops even the database owner.
- The rollback refuses while any submission (or P6 audit row) exists. **There is no force switch.**

## Owner rollout order
1. **Review `docs/hmrc-p6/proposal.sql`.**
2. **The owner's assistant applies it after approval:** one transaction, refused on any drift from production as read on 8 Nov 2026.
3. **Set the confirmation-token secret** in Supabase → Edge Functions → Secrets: `HMRC_VAT_CONFIRM_SECRET`. Use a new random value of at least 32 characters, for example the output of `openssl rand -base64 48`. Don't reuse another secret. Without it the function answers "VAT submission to HMRC's test environment isn't set up yet."
4. **Deploy:** `npx.cmd supabase functions deploy hmrc-vat-submit --project-ref gvftvswyrevummbvyhxa --use-api` (JWT verification on, from `supabase/config.toml`).
5. **Publish the frontend.**
6. **Reconnect if needed:** if the company's sandbox connection was made without `write:vat`, the section says "Connect to HMRC again". Connect again in Settings → HMRC.

## Owner test steps
Use a sandbox test company with a VAT number (an HMRC test user) and an **open** obligation.

**Happy path**
1. **Records:** add VAT-recorded invoices and expenses for the company, dated in the obligation's period (the P5 worked example works). Make sure nothing in the period is "VAT not recorded" or has no company.
2. **Prepare:** open HMRC Integration → VAT Returns → **Submit to HMRC (test environment)** → **Get open obligations from HMRC**. Pick the period and press **Prepare the return**. Check that the nine boxes match the P5 preview.
3. **Confirm:** tick the declaration and type the period key. **Submit** becomes active.
4. **Submit:** press it. Expect "HMRC's test environment accepted the return" with a processing date and a form bundle number. The history shows the attempt as **Accepted**.
5. **Receipt:** press the download icon on that row. The CSV has the boxes and the receipt.

**A scenario rejection**
6. **Choose a scenario:** pick another open period. Under **Test scenario** choose `TAX_PERIOD_NOT_ENDED`, then prepare, confirm and submit.
7. **Expect:** "Not accepted" with the reason in plain words. The history shows **Rejected**.
8. **Try again:** set the scenario back to None, then prepare and submit the same period again. A rejected attempt may be retried.

**A double click**
9. **Click twice:** prepare and confirm a period, then click **Submit** twice quickly. Only one attempt appears in the history.

**The unknown path** (it can't be forced from the screen; HMRC's sandbox decides)
10. **Unknown result:** if HMRC is slow or fails (a 5xx or a timeout), you see "We don't know if HMRC received it. Do not submit again." Preparing that period again shows "outcome unknown", and Submit is not offered.
11. **Check:** press **Check with HMRC**.
    - **Fulfilled at HMRC:** the attempt becomes Accepted, with "no receipt".
    - **Still open at HMRC:** press **Record that HMRC did not receive it**. The attempt becomes Rejected, and you may submit again.

**Other states**
12. **Member, Solo, demo:** a member sees "Only owners and admins can see the VAT return.", Solo sees the plan message, and the demo account sees no controls.
13. **Fraud headers:** under **Validate fraud prevention headers (test environment)**, run the header test. HMRC's feedback should include the known warning about the missing client public port.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx eslint .` | 509 (baseline 510) |
| `npx vitest run` | 176 files, 1,655 tests, exit 0, no "Unhandled" |
| `npm run build` | OK |
| `PG_RUN_USER=postgres bash docs/hmrc-p6/run-test.sh` | 53 PASS, 0 FAIL (disposable local Postgres) |
| `deno test supabase/functions/` | 465 passed, 0 failed (local import map; `deno.land` is blocked here) |

**The SQL suite** covers:
- a duplicate live submission blocked, a rejected period retried, and an accepted or unknown period refused;
- unknown → accepted after a check;
- changes to figures, hash, period or a recorded receipt refused, and accepted → rejected refused;
- DELETE refused for the service role (no grant) and for the owner (trigger), TRUNCATE refused, an insert as accepted refused, `production` refused;
- 5 an hour, then `limit`;
- reads: owner and admin read; member, Solo and anon don't; cross-company isolation; aal1 with an authenticator reads nothing;
- the browser and the demo account can't write;
- the five new audit events accepted, others refused, and the log still append-only.

The runner also checks production's shape, an exact empty rollback, the demo coverage check, that the rollback refuses while a submission exists, and drift refusals.

**Deno** (`p6_test.ts`, 16) covers:
- **The request:** body fields and rounding, `netVatDue` non-negative, `finalised`; URL and headers (Accept, Content-Type, fraud headers, no public port, no token, email or name in the fraud headers); figures from the browser ignored.
- **The token:** bound to company, period, figures and person; expires after 10 minutes.
- **Refusals:** member, Solo, not signed in, aal1, production, a missing secret, `write:vat` missing, demo; the declaration, a bad or expired token, `figures_changed`; blocking issues; the rate limit.
- **HMRC's answers:** each mapped error (rejected, retry allowed afterwards); 401, 429 and 400 with exactly one POST and no refresh.
- **Concurrency:** two concurrent submits give exactly one POST.
- **Unknown:** 5xx and network error give unknown, no retry, then check (still open → not received → retry; fulfilled → accepted).
- **Secrets:** no token, VRN or secret in logs, audit rows or responses.

**Vitest:**
- `hmrcP6.test.tsx` (16): every section state, the declaration and typed-key gating, submitting, accepted, rejected, unknown with check and not received, blocking, no open obligation, history and receipt CSV, double click submits once, and the member, Solo, demo, production and scope-missing states on the tab;
- `returnBoxes.parity.test.ts` (5).

## Risks
- **`Gov-Client-Public-Port` is still not sent**: Supabase Edge Functions don't see the client's port (P1/P2). HMRC's header check warns about it. `HMRC_VENDOR_PUBLIC_IP` stays unset.
- **The box rules are not verified** against HMRC's guidance (P5), and neither are the submit API facts above.
- **No credit notes or corrections** in B2BNEST, and EU / NI boxes are always 0.
- **Sandbox data is fake:** an "accepted" in the test environment proves the flow, not that the figures are right.
- **An `unknown` attempt needs a person to check.** Nothing retries on its own, by design.
- **History stays readable:** an owner or admin can still see their company's history after the plan changes. The plan only gates new submissions.

## Still missing before production (P7)
- **HMRC production approval** for B2BNEST's application (production credentials, terms of use, any recognition listing).
- **Fraud-header validation passing in production terms**, including a solution or accepted exemption for the client public port.
- **A real-world check of the box rules by an accountant**, and verification of every "not verified" fact above against HMRC's pages.
- **Privacy policy wording** for HMRC submissions and the data kept.
- **A data retention decision** for `hmrc_vat_submissions` and `hmrc_audit_log` (kept forever today), and how that meets legal retention periods.
- **A deliberate, reviewed change to `readConfig`** to allow production. That change is not in this PR.
