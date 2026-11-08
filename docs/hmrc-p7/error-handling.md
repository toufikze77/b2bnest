# HMRC error handling: audit (P7a)

**What was compared:**
- `_shared/hmrc/api.ts` (`callHmrc`), `errors.ts`, `handlers.ts`, `testCall.ts`, `vatObligations.ts`, `vatSubmit.ts`;
- the screens `HMRCConnectionPanel`, `HMRCVATReturns`, `HMRCVATSubmit` and the messages in `src/lib/hmrcConnection.ts`.

**What it was compared against:** HMRC's error handling guidance as we remember it. HMRC's pages are not in this
repository. Error codes marked *(memory)* are **to confirm with HMRC's API documentation** before production.

**Rules that hold everywhere (and are tested):**
- A VAT return POST is never retried automatically: `noRetry: true`, so a 401 is not refreshed and resent.
- No HMRC response body, token or code is logged or returned to the browser. Only our own codes and plain messages go back.

## Case by case

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

1. Verify every *(memory)* code, and the 409 meaning, against HMRC's VAT (MTD) API documentation.
2. 409: a specific message once the code is known.
3. Obligations: say "some items from HMRC couldn't be read" when `normalise` drops any.
4. 503 on a POST: consider showing "HMRC asked us to wait N minutes before checking" from `Retry-After`.
5. A per-company back-off after a 429, kept server-side, so repeated clicks don't hit HMRC. Today the 10-an-hour rate
   limit on obligations is the only guard.
6. A 200 with a body that isn't JSON should be "HMRC couldn't be reached", not an empty list (small change in `api.ts`/`vatObligations.ts`; left out here because it changes what `callHmrc` returns for every caller).
