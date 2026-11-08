# HMRC error handling: audit (P7a)

**What was compared:**
- `_shared/hmrc/api.ts` (`callHmrc`), `errors.ts`, `handlers.ts`, `testCall.ts`, `vatObligations.ts`, `vatSubmit.ts`;
- the screens `HMRCConnectionPanel`, `HMRCVATReturns`, `HMRCVATSubmit` and the messages in `src/lib/hmrcConnection.ts`.

**What it was compared against:** HMRC's error handling guidance as we remember it. HMRC's pages are not in this
repository. Error codes marked *(memory)* are **to confirm with HMRC's API documentation** before production.

**Rules that hold everywhere (and are tested):**
- A VAT return POST is never retried automatically: `noRetry: true`, so a 401 is not refreshed and resent.
- No HMRC response body, token or code is logged or returned to the browser. Only our own codes and plain messages go back.

## Verification of the codes (HMRC P7c, 8 Nov 2026)

**Source checked:** HMRC's published VAT (MTD) API 1.0 definition, from HMRC's own repository:
https://github.com/hmrc/vat-api/blob/main/resources/public/api/conf/1.0/application.yaml (OpenAPI 3.0.3), read
8 Nov 2026.

**Pages that could not be fetched** from the session doing the check, so these are not verified there:
- https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/vat-api/1.0
- HMRC's general "Reference guide" error list

The general platform codes below are therefore still marked **(memory, not verified)**.

| Code | HMRC's definition (8 Nov 2026) | What we did |
| --- | --- | --- |
| `VRN_INVALID` (400) | Documented for POST returns and GET obligations | Kept |
| `PERIOD_KEY_INVALID` (400) | Documented for POST returns, at the top level and nested | Kept |
| `INVALID_REQUEST` (400) | Documented for POST returns, **with a nested `errors` list**: `PERIOD_KEY_INVALID`, `VAT_TOTAL_VALUE`, `VAT_NET_VALUE`, `INVALID_NUMERIC_VALUE`, `INVALID_MONETARY_AMOUNT`, `MANDATORY_FIELD_MISSING` | **Changed:** `api.ts` now reads the nested codes (codes only), and `vatSubmit.ts` uses the most useful one for the message, so "the boxes do not add up" now actually appears |
| `VAT_TOTAL_VALUE`, `VAT_NET_VALUE`, `INVALID_NUMERIC_VALUE`, `INVALID_MONETARY_AMOUNT` | Documented, **nested** inside `INVALID_REQUEST` (not top level) | Kept; now matched when nested |
| `MANDATORY_FIELD_MISSING` | Documented, nested | **Added**: "HMRC said a box was missing from the return. Nothing was filed." |
| `NOT_FINALISED`, `DUPLICATE_SUBMISSION`, `TAX_PERIOD_NOT_ENDED`, `CLIENT_OR_AGENT_NOT_AUTHORISED`, `RULE_INSOLVENT_TRADER` (403) | Documented for POST returns | Kept |
| `INVALID_DATE_FROM`, `INVALID_DATE_TO`, `INVALID_DATE_RANGE`, `INVALID_STATUS` (400) | Documented for GET obligations | Handled as `bad_request`. We validate the dates first, so they shouldn't reach HMRC |
| `CLIENT_OR_AGENT_NOT_AUTHORISED`, `RULE_INSOLVENT_TRADER` (403), `NOT_FOUND` (404) | Documented for GET obligations | Kept in `vatObligations.ts`. **Added** to the obligations read inside "prepare" (`vatSubmit.ts`), which used to say "couldn't be reached" for them |
| `NOT_SIGNED_UP_TO_MTD` | **Not in the VAT API definition** | **Removed** (code `vat_not_signed_up` removed). It now gets the general refusal |
| `RETURN_ALREADY_RECEIVED` | **Not in the definition** | **Removed**. `DUPLICATE_SUBMISSION` is HMRC's documented code |
| `INVALID_PERIODKEY`, `INSOLVENT_TRADER` | **Sandbox `Gov-Test-Scenario` names only**, not response codes (the codes are `PERIOD_KEY_INVALID`, `RULE_INSOLVENT_TRADER`) | **Removed** from the error map |
| `NOT_FOUND` on POST returns | Documented for obligations and other GET endpoints, not for POST returns | Kept as a harmless mapping |
| `INVALID_CREDENTIALS` (401) | Appears in the definition (on another endpoint), so it is a real HMRC code | Already handled: refresh once on reads, never a second POST |
| `MATCHING_RESOURCE_NOT_FOUND` (404) | In the definition only for financial-details; otherwise a general platform error | Kept, **(memory, not verified)** |
| `INVALID_SCOPE` (401/403), `MESSAGE_THROTTLED_OUT` (429) | General platform errors, not in this definition | Kept, **(memory, not verified)** |
| Sandbox scenarios for POST returns | Documented: `INVALID_VRN`, `INVALID_PERIODKEY`, `INVALID_PAYLOAD`, `DUPLICATE_SUBMISSION`, `TAX_PERIOD_NOT_ENDED`, `INSOLVENT_TRADER` | **Changed** the picker (server and screen) to exactly this list. `NOT_FOUND` was not a POST scenario and is removed |

**Unchanged on purpose:**
- a VAT return POST is never retried automatically;
- a 5xx, network error or timeout on submit is still recorded as **unknown** with "Check with HMRC".

**Tests:** `supabase/functions/_shared/hmrc/p6_test.ts`, the three "P7c:" tests:
- undocumented codes get the general rejection;
- nested `INVALID_REQUEST` reasons give the right words, with one POST only;
- the scenario list matches HMRC's.

`p3_test.ts` also covers an undocumented 403 on obligations, which is a plain refusal.

**Redeploy needed:** `hmrc-vat-submit`, `hmrc-vat-obligations` and `hmrc-test-call`. All three use the shared
`_shared/hmrc` code that changed.

## Case by case (P7a; see the verification above for the codes)

| Case | What the code does | What the person sees | P7a change |
| --- | --- | --- | --- |
| **400** with a known code (`INVALID_REQUEST`, `INVALID_MONETARY_AMOUNT`, `VRN_INVALID`, `INVALID_PERIODKEY`, `PERIOD_KEY_INVALID`) | Mapped by `HMRC_SUBMIT_ERRORS`; the submission is recorded `rejected` | "HMRC said the return is not in the right form. Nothing was filed." or the specific message | Added *(memory)*: `INVALID_NUMERIC_VALUE`, `NOT_FINALISED`, `VAT_TOTAL_VALUE`, `VAT_NET_VALUE` ("the boxes do not add up") |
| **400**, unknown code | `invalid_return`, recorded `rejected` | The general "not in the right form" message | none |
| **401** on a read (obligations, test calls) | One token refresh and one retry; if 401 again, the connection is marked `needs_reconnect` and audited | "Reconnect to HMRC" | none |
| **401** on a VAT return POST | No refresh-and-resend; recorded `rejected` as `hmrc_unauthorised` | "Reconnect to HMRC" message; a new attempt is possible | none |
| **403** `NOT_SIGNED_UP_TO_MTD` *(memory)* | Was a generic 403 | Now: "HMRC says this VAT number isn't signed up for Making Tax Digital for VAT…" (`vat_not_signed_up`) | **Added**, on obligations and submit |
| **403** `DUPLICATE_SUBMISSION` / `RETURN_ALREADY_RECEIVED` *(memory)* | `duplicate_submission`, recorded `rejected` | "HMRC says a return for this period has already been submitted." | `RETURN_ALREADY_RECEIVED` **added** |
| **403** `TAX_PERIOD_NOT_ENDED`, `INSOLVENT_TRADER`, `CLIENT_OR_AGENT_NOT_AUTHORISED`, `INVALID_SCOPE` | Mapped to their own messages | Specific plain words | none |
| **404** | Obligations: an empty list (HMRC uses 404 for "none found"). Submit: `not_found` | "HMRC couldn't find this VAT registration or period." | `MATCHING_RESOURCE_NOT_FOUND` *(memory)* **added** |
| **409** | Submit: recorded `rejected` with a generic code | "HMRC didn't accept the return…" (generic) | Follow-up: no specific 409 code is known |
| **429** | No retry. Now reads `Retry-After` (seconds or an HTTP date, capped at 1 hour) | Before: "HMRC is busy". Now: "HMRC is busy right now. Please try again in 30 seconds / 5 minutes." The submit is recorded `rejected` (nothing filed) with `retry_after` in the reply | **Added** (`retryAfterSeconds`, `busy()`), on obligations, submit and test calls |
| **500 / 502 / 504** on a read | `hmrc_unavailable` | "HMRC couldn't be reached. Please try again." | none |
| **500 / 503** on a VAT return POST | Recorded `unknown`, never retried. The screen says "Do not submit again. Check with HMRC." | The **Check with HMRC** button reads the obligation live | none (by design). `Retry-After` on a 503 is kept but not shown, because the answer is "check", not "retry" |
| **Network error / timeout** on a read | Obligations had **no timeout**; now 20 s. `hmrc_unavailable` | "HMRC couldn't be reached." | **Added** `OBLIGATIONS_TIMEOUT_MS`, also on the obligations read inside submit |
| **Network error / timeout** on a VAT return POST | 30 s timeout. Recorded `unknown`, never retried | "We don't know if HMRC received it. Do not submit again. Check with HMRC." | none |
| **Malformed 201** (accepted, receipt unreadable) | Before: accepted with empty receipt fields, no explanation | Now: still `accepted` (HMRC said 201), `receipt_complete: false`, audit reason `accepted_no_receipt`, and the screen says the receipt couldn't be read in full | **Added** |
| **Malformed obligations body** | Bad items are dropped and counted (`normalise` returns `dropped`). A 200 whose body isn't JSON gives an empty list | A shorter list, or "no open obligations". That is misleading for a non-JSON body | Follow-ups 3 and 6 |

## Tests added

- `supabase/functions/_shared/hmrc/p6_test.ts`: 5 tests.
  - `Retry-After` parsing;
  - a 429 with `Retry-After` on submit;
  - `NOT_SIGNED_UP_TO_MTD`, `RETURN_ALREADY_RECEIVED` and a 409;
  - a malformed 201;
  - every submit-flow call carries an `AbortSignal`.
- `supabase/functions/_shared/hmrc/p3_test.ts`: 2 tests.
  - obligations: a 429 with `Retry-After`, a plain 429, `NOT_SIGNED_UP_TO_MTD`, a 503 and a timeout;
  - the obligations GET carries a signal.
- `src/components/hmrc/hmrcP6.test.tsx`: the incomplete receipt is shown.

## Follow-ups (not done here)

1. Done 8 Nov 2026 for the VAT API definition (above). Still open: HMRC's general reference guide (`INVALID_SCOPE`, `MATCHING_RESOURCE_NOT_FOUND`, `MESSAGE_THROTTLED_OUT`) and the meaning of a 409, from developer.service.hmrc.gov.uk.
2. 409: a specific message once the code is known.
3. Obligations: say "some items from HMRC couldn't be read" when `normalise` drops any.
4. 503 on a POST: consider showing "HMRC asked us to wait N minutes before checking" from `Retry-After`.
5. A per-company back-off after a 429, kept server-side, so repeated clicks don't hit HMRC. Today the 10-an-hour rate
   limit on obligations is the only guard.
6. A 200 with a body that isn't JSON should be "HMRC couldn't be reached", not an empty list (small change in `api.ts`/`vatObligations.ts`; left out here because it changes what `callHmrc` returns for every caller).
