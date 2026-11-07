# HMRC P3: read VAT obligations (sandbox only, read only)

**Prepared, not applied.** No SQL has been run, no Edge Function has been deployed, and no secret has been set.

In the sandbox only, a company owner or admin (trial, Business or Scale, not suspended) presses **Get VAT obligations** in Business Tools → HMRC Integration → **Obligations** and sees the company's VAT obligations as HMRC's test environment returns them.
- **Nothing is submitted.** Nothing is written to HMRC: the function makes one GET.
- **Nothing about obligations is stored.** They are read live each time.
- **Production stays refused**, exactly as today.

## What changed
- **`supabase/functions/hmrc-vat-obligations`** (`verify_jwt = true`), with the checks in `_shared/hmrc/vatObligations.ts`. Same pieces as `hmrc-test-call`.
  - **Order of checks:**
    1. Configuration. Production is refused with the existing `not_configured`.
    2. Session, and the two-step rule (aal2 when the person has an authenticator).
    3. Strict input check.
    4. `hmrc_manage_allowed`: owner or admin; trial, Business or Scale; not suspended. A refusal writes an audit row `refused`.
    5. A connected sandbox company with the `read:vat` scope.
    6. A VAT number.
    7. The rate limit.
    8. The fraud prevention headers, built exactly as `hmrc-test-call` does.
    9. The HMRC call, through `callHmrc`: user token, one refresh and one retry on a 401, then `needs_reconnect`; no retry on 429 or 5xx.
    10. An audit row for the result.
  - **The demo guard** (`guardedDenoServe`) refuses a demo person with 403 before any of this.
  - **Input:** `{ company_id, status?, from?, to?, scenario? }`.
    - `status` is `O` or `F`.
    - `from`/`to` are real `YYYY-MM-DD` dates, both or neither, in order, at most 366 days inclusive. They are required for `F`.
    - With nothing given, the default is `status=O`.
    - `scenario` must come from an 8-value allow-list of HMRC's documented sandbox scenarios.
  - **Output:** `{ obligations: [{ periodKey, start, end, due, status, received }], fetched_at, vrn_last3, status, from, to, scenario, omitted }`.
  - **What is never logged or returned:** a token, an HMRC body, or the VAT number beyond its last 3 digits. The logs show the path as `/organisations/vat/{vrn}/obligations`, plus HMRC's `X-CorrelationId` when present.
- **The VAT number** is read server-side, with the service role, from `hmrc_settings.vat_number`:
  - the company's own row (`organization_id`) first;
  - otherwise the caller's own business details with no company set;
  - spaces and an optional `GB` are removed, and it must be 9 digits.
  - If it is missing, the answer is `vrn_missing`, "Add your VAT number in Settings → HMRC first.", and nothing is called.
  - Settings → HMRC now explains the field.
- **New error codes**, in plain English, in `errors.ts` and `src/lib/hmrcConnection.ts`:

  | Code | When |
  |---|---|
  | `vrn_missing` | No usable VAT number saved |
  | `obligations_limit` | 10 an hour per company used up |
  | `vrn_invalid` | HMRC `VRN_INVALID` |
  | `vat_not_authorised` | HMRC `CLIENT_OR_AGENT_NOT_AUTHORISED` |
  | `vat_insolvent` | HMRC `RULE_INSOLVENT_TRADER` |

  - Existing codes reused:
    - `scope_missing`, when the stored scopes lack `read:vat` or HMRC says `INVALID_SCOPE`;
    - `not_connected` and `needs_reconnect`;
    - `hmrc_busy` for a 429, and `hmrc_unavailable` for 5xx or the network;
    - `bad_request` for other 400s, and `hmrc_refused` for anything else.
  - A 404 `NOT_FOUND` means no obligations, so it returns an empty list.
- **`callHmrc`** gains two optional fields: `logPath`, and `testScenario`. `testScenario` sends `Gov-Test-Scenario` in the sandbox only and is dropped otherwise. It also logs HMRC's correlation id. Nothing else changed for P1/P2.
- **Obligations tab** (`src/components/hmrc/HMRCObligations.tsx`): the example deadlines are gone.
  - **Owners and admins** get:
    - the Open / Fulfilled filter;
    - a date range for Fulfilled (default: the last 12 months, checked to at most 366 days);
    - a sandbox test-scenario picker;
    - **Get VAT obligations**;
    - a table with period, period key, due date, Open / Open, due date passed / Fulfilled, and received date, with dates like 7 Aug 2017;
    - an `aria-live` result line.
  - **Others:**
    - members see the status only;
    - Solo sees the plan message with See plans;
    - demo accounts get no button;
    - a production connection shows "Production is not available yet.";
    - not connected, needs reconnecting and scope missing each say what to do.
  - **A note** at the top says "HMRC filing is not available yet. Nothing has been sent to HMRC." and that the data comes from HMRC's test environment. The VAT return, payroll and tax screens keep their "Preview only" banner.
- **`ai-assistant/knowledge.ts`:** obligations can be read from HMRC's test environment only, and nothing is filed.
- **The demo read-only table** (`docs/demo-readonly/README.md` and its Deno test) lists `hmrc-vat-obligations` as refused.

## Database (`proposal.sql`, needed for the audit events and the rate limit)
- **`hmrc_audit_log.event`** also allows:
  - `obligations_call`, written before HMRC is called, with reason `open` / `fulfilled` / `all`;
  - `obligations_result`, with reason `ok` / `not_found` / HMRC's code in lower case / the failure reason.

  Codes only: `hal_reason` is still `^[a-z0-9_]{1,60}$`, so a VAT number or token can't be written.
- **`hmrc_take_obligations_slot(company, user, environment, kind, limit 10)`**:
  - service role only, SECURITY INVOKER, `search_path = ''`;
  - a per-company advisory lock;
  - 10 an hour per company, in its own bucket (test calls don't count).
- **No new table, and nothing about obligations is stored.** No HMRC function, policy or grant changes.
- **Prechecks** (refuses and changes nothing on any difference):
  - the function is absent;
  - the eight-event rule;
  - the `hmrc_audit_log` privileges;
  - md5 of `hmrc_manage_allowed` `9304f069…`, `hmrc_connection_status` `8d04b8c0…`, `hmrc_take_test_slot` `be8ab280…`, `_hmrc_audit_append_only` `8f283e3f…` (production, 6 Nov 2026).

## HMRC facts
| Fact | Status |
|---|---|
| `GET /organisations/vat/{vrn}/obligations`, VRN "a nine-digit number" | **verified**: HMRC VAT (MTD) 1.0 OpenAPI file from the Developer Hub (downloaded 4 Nov 2026 in this session's earlier phase; not re-downloaded today) |
| `from` / `to` YYYY-MM-DD, "Mandatory unless the status is O"; `status` O or F, omit for all | **verified** (same file) |
| Range "must be 366 days or less" (`INVALID_DATE_RANGE`) | **verified** (same file). Whether 366 is inclusive is **not verified**; B2BNEST allows at most 366 days inclusive. |
| Response `{ obligations: [{ start, end, due, status, periodKey, received? }] }`, sorted by start; `periodKey` four alphanumeric characters, "occasionally" with `#` | **verified** (same file) |
| User-restricted, scope `read:vat` | **verified** (same file). `HMRC_VAT_SCOPES` in `config.ts` already asks for `read:vat`. |
| `Accept: application/vnd.hmrc.1.0+json` | **verified**: Reference guide ("Using the Accept header for versioning") and the API version 1.0 |
| Errors: 400 `VRN_INVALID`, `INVALID_DATE_FROM`, `INVALID_DATE_TO`, `INVALID_DATE_RANGE`, `INVALID_STATUS`; 403 `CLIENT_OR_AGENT_NOT_AUTHORISED`, `RULE_INSOLVENT_TRADER`; 404 `NOT_FOUND` ("no associated data is found") | **verified** (same file) |
| `X-CorrelationId` response header (36 characters) | **verified** (same file) |
| `Gov-Test-Scenario` (sandbox only): `QUARTERLY_NONE_MET`, `QUARTERLY_ONE_MET` … `QUARTERLY_FOUR_MET`, `MONTHLY_NONE_MET`, `MONTHLY_ONE_MET`, `NOT_FOUND`, and others | **verified** (same file). There is **no `OBLIGATIONS_NOT_FOUND`** in that file; its "no data" scenario is `NOT_FOUND`, which is what B2BNEST allows. |
| Default sandbox data is "quarterly obligations and one is fulfilled"; the example dates are in 2017 and the named scenarios use 2018 | **verified** (same file). Which dates the live sandbox really returns is **not verified**. |
| Fraud prevention headers required on this call | From the P2 reading of the fraud prevention pages (docs/hmrc-p1-p2). **Not re-checked today.** |
| The sandbox app must be subscribed to VAT (MTD), and test users with a VAT enrolment come from "Create Test User" | **not verified** in this phase (the general testing page says to create test users; the subscription step comes from the Developer Hub's usual flow) |

If the sandbox behaves differently, the endpoint is in `OBLIGATIONS_API`, the scenario list in `OBLIGATION_SCENARIOS` (server) and `VAT_TEST_SCENARIOS` (browser), and the range limit in `MAX_RANGE_DAYS`, all in `_shared/hmrc/vatObligations.ts` and `src/lib/hmrcVat.ts`.

## Owner prerequisites (not done by me)
1. **Developer Hub:** subscribe the B2BNEST sandbox application to **VAT (MTD)**.
2. **Developer Hub → Create Test User:** create an organisation test user with the **VAT** service (MTD VAT enrolment). Note its VRN, user ID and password.
3. **Settings → HMRC → Business details:** save that VRN as the VAT registration number, while the company you'll test with is selected.
4. **Connect HMRC with that test user.** If the company was connected with another test user, disconnect and connect again with this one; otherwise HMRC answers "not authorised".

## Rollout order (owner)
1. **Apply `docs/hmrc-p3/proposal.sql`** in the SQL editor after review.
2. **Deploy the function** with JWT on:
   `npx.cmd supabase functions deploy hmrc-vat-obligations --project-ref gvftvswyrevummbvyhxa --use-api`
3. **Publish the frontend.**
4. **Reconnect once if needed:** each sandbox company whose connection lacks `read:vat` connects again. Today's connection (4 Nov) already has `read:vat`, `write:vat` and `hello`.

## Owner test steps (sandbox)
1. Sign in as the owner (Business, Scale or trial) and go to Business Tools → HMRC Integration → **Obligations**.
2. Show **Open**, then **Get VAT obligations**. Expect a table, or "HMRC returned no VAT obligations for this search."
3. Show **Fulfilled**, set From 2017-01-01 and To 2017-12-31 (HMRC's example dates), and get them again.
4. **Test scenario (sandbox):** pick "Quarterly, two met" and get the obligations again; then "No obligations found".
5. **Without a VAT number:** clear the VAT number and get them again. Expect "Add your VAT number in Settings → HMRC first."
6. **As a member:** no button. **As a Solo account:** the plan message.
7. **Rate limit:** an 11th request in an hour says "You can get VAT obligations 10 times an hour for this company."
8. **Audit trail:** Settings → HMRC shows `obligations_call` / `obligations_result` rows for owners and admins.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx eslint .` | 510 (baseline 510) |
| `npx vitest run` | 1,505 / 1,505 pass (158 files) |
| `npm run build` | OK |
| Deno, all function tests | 446 / 446 pass (11 new in `_shared/hmrc/p3_test.ts`) |
| Deno `ai-assistant` (knowledge and handler) | 29 / 29 pass |
| `deno check` of the five HMRC functions and the HMRC test files | clean |
| Local SQL suite (`PG_RUN_USER=postgres bash docs/hmrc-p3/run-test.sh`) | 42 / 42 PASS |

- **Deno covers:**
  - URL and query building, Accept, the user token, `Gov-Test-Scenario`;
  - fraud headers present, with no email, name or token in any `Gov-` header, Public-Port and the two vendor-IP headers omitted;
  - VRN cleaning and date validation (leap year, 366 vs 367 days, order, both or neither, status, scenario allow-list);
  - normalising HMRC's example;
  - the access matrix (signed out, member, Solo with its message, another company), production and not-configured refusals;
  - not connected, needs reconnect, scope missing, VRN missing, the rate limit;
  - 401 refresh-and-retry then `needs_reconnect`, 403/400/404/406/429/500/503 mapping with no retry;
  - demo refusal before anything runs;
  - no secret, token or full VRN in logs, audit rows or responses.
- **vitest:**
  - the tab in each state: loading, admin success with table, fulfilled range and scenario, empty, errors, member, Solo, demo, not connected, needs reconnect, scope missing, production, and a status error;
  - the helpers.
  - `hmrcNoSimulatedFiling` still passes: the banner is shown, and there is no submit button.
- **The SQL suite:**
  - production hashes;
  - the slot (10 then refused, its own bucket, per company, a smaller limit, results don't count);
  - codes only;
  - append-only;
  - browser and anon refused;
  - the owner sees the rows in the audit trail, the member doesn't;
  - the demo coverage check still passes;
  - exact empty rollback, re-apply, second apply refused, rollback refused with rows then forced, drift refused.
- `deno.land` and `esm.sh` are blocked here, so the Deno runs used local stand-ins, as in the earlier phases.

## Security advisor expectations
No new warnings. `hmrc_take_obligations_slot` is SECURITY INVOKER and service-role only. No new SECURITY DEFINER function, table or policy.

## Rollback
1. Undeploy `hmrc-vat-obligations`.
2. Run `rollback.sql`. It drops the function and puts back the eight-event rule.
3. If obligations audit rows exist (they stay, append-only), it refuses unless `SET app.hmrc_p3_force = 'on';`. Forced, the old rule comes back as NOT VALID.

## Fixed after release (7 Nov 2026): business details belong to a company
**What went wrong:**
- Settings → HMRC read and saved the business details by person only (`hmrc_settings` by `user_id`, `.maybeSingle()`) and never set `organization_id`.
- The same row was therefore shown under every company the person belongs to, and saved wherever that row happened to be tagged.
- An owner saved a VAT number that landed on a row for another company, so **Get VAT obligations** for the connected company said the VAT number was missing.
- Production was corrected by hand (one row re-tagged). This fix changes no data and needs no database change.

**The rule now:**
1. **Settings → HMRC shows the details of the company selected there** (the same company as the connection panel), with "Saving for: {company}".
   - Switching company reloads the details, and the old company's details are cleared first.
   - Owners and admins can save; members see the details read-only, with no save button.
2. **Load:** your row for `(you, that company)`. If you have none, your old row with no company is shown, with a note asking you to save it for this company.
3. **Save:** updates your row for that company, or creates it with `organization_id` set.
   - An old no-company row is left as it is, and is never copied to other companies.
   - The browser cannot move a row to another company (the existing column grants allow no `organization_id` update), and no grant or policy was widened.
4. **The server** (`pickVatNumber` in `_shared/hmrc/store.ts`) picks the VAT number for HMRC calls in this order:
   1. the caller's own row for the company;
   2. otherwise the newest row for the company saved by someone who is now an owner or admin of it (a member's row is never used, although RLS lets members save their own);
   3. otherwise the caller's own no-company row.

   A row for another company is never used. If none fits, the result is "Add your VAT number in Settings → HMRC for {company} first."

**Tests:**
- Deno, in `p3_test.ts`:
  - two companies each get their own number;
  - another company's row is never used;
  - the no-company row is the only fallback;
  - a member's row is ignored.
- vitest, in `hmrcBusinessDetails.test.tsx`:
  - loads per company;
  - switching company changes the shown number;
  - saving updates or creates the company's own row;
  - the old no-company row is shown once and left alone;
  - a member cannot save.

## Risks
- **The VAT number comes from `hmrc_settings`, which people write from the browser.** Since the fix above, only rows saved by a current owner or admin of the company, or the caller's own no-company row, are used. RLS still lets a member save their own row for the company; it is ignored. Tightening the policy itself would be a database change, and is not needed for correctness.
- **The VAT number and the connection must belong to the same HMRC test user**, or HMRC answers `CLIENT_OR_AGENT_NOT_AUTHORISED`.
- **The sandbox data may have fixed dates** (2017/2018 in HMRC's examples), so "Open" may show old periods as "due date passed". That is HMRC's test data, not a B2BNEST calculation.
- **Known header gaps** (as in P2): `Gov-Client-Public-Port` is omitted and should be raised with HMRC; `HMRC_VENDOR_PUBLIC_IP` is unset, so Vendor-Public-IP and Vendor-Forwarded are omitted.
- **Not done:** storing obligations, production, any submit or write call to HMRC, and VAT figures or returns (P4 onwards).
