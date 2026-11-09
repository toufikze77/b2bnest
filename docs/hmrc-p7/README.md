# HMRC P7a: production gaps audit

> **Security contact:** Confirmed by the owner: info@b2bnest.online. Still to do: make sure someone reads it and answers
> security reports promptly. It is published in `public/.well-known/security.txt`, which expires on 2027-11-08: renew it before then.

**What this PR is:** an audit, small safe fixes and documents.

**What it doesn't do:**
- change any SQL, RLS or secret;
- touch Stripe, plans or prices;
- edit the live privacy or terms pages;
- change the immutability of `hmrc_vat_submissions`.

**B2BNEST stays sandbox only.** The production refusal in `config.ts` is unchanged, and nothing was applied to production.
Production was only read, for function names, column names, row counts and the project region.

## Documents

| File | What it is |
| --- | --- |
| [`public-port.md`](public-port.md) | Why `Gov-Client-Public-Port` is left out, and the wording to send HMRC |
| [`error-handling.md`](error-handling.md) | Every HMRC error case: what the code does, what the person sees, what changed, follow-ups |
| [`data-rights.md`](data-rights.md) | UK GDPR: what can be exported or deleted today, what is kept and why, and the proposed retention |
| [`incident-response.md`](incident-response.md) | One page: detect, contain, assess, tell HMRC, tell the ICO within 72 hours, tell customers, record |
| [`privacy-wording.md`](privacy-wording.md) | Draft privacy paragraphs (not live), with every legal claim marked "adviser to confirm" |
| [`accessibility.md`](accessibility.md) | Quick WCAG AA audit of the VAT screens, the fixes made, and what's left |
| [`production-request-pack.md`](production-request-pack.md) | Ready-to-paste answers for HMRC, with every gap marked NOT DONE |
| [`security-self-check.md`](security-self-check.md) | HMRC P7c: our own security checks with free tools (dependencies, secrets, headers, OWASP review, advisor). Not an independent penetration test |
| [`../hmrc-p7d/README.md`](../hmrc-p7d/README.md) | HMRC P7d: narrowed Edge Function CORS, the review of the 18 anon-callable database helpers (SQL not applied), the live Privacy Policy wording |
| [`../hmrc-p8/README.md`](../hmrc-p8/README.md) | HMRC P8: view return, liabilities, payments, penalties, receipt, reminders, pre-submit checks (verified endpoints; SQL not applied; functions not deployed) |
| [`accountant-and-pentest-options.md`](accountant-and-pentest-options.md) | HMRC P7c: low-cost ways to get the VAT box rules checked by an accountant and an independent security test later |

## Fixed in code

**HMRC error handling** (in `supabase/functions/_shared/hmrc`):
- `Retry-After` is read on a 429 or 503 (`api.ts` `retryAfterSeconds`). People see "Please try again in N seconds/minutes" (`errors.ts` `busy`) on obligations, submit and test calls.
- `NOT_SIGNED_UP_TO_MTD` has its own message, `vat_not_signed_up`.
- New submit codes: `RETURN_ALREADY_RECEIVED`, `NOT_FINALISED`, `INVALID_NUMERIC_VALUE`, `VAT_TOTAL_VALUE`, `VAT_NET_VALUE` and `MATCHING_RESOURCE_NOT_FOUND`. These are from memory and still to be verified.
- **Corrected in HMRC P7c (8 Nov 2026):** checked against HMRC's published VAT API definition. `NOT_SIGNED_UP_TO_MTD` and
  `RETURN_ALREADY_RECEIVED` are not in it and were removed. The box-total codes are nested inside `INVALID_REQUEST` and
  are now read from there. See `error-handling.md`, "Verification of the codes".
- The obligations read had no timeout; it now has 20 s.
- An accepted return with an unreadable receipt now says so (`receipt_complete: false`, audit `accepted_no_receipt`).

**Copy:**
- "HMRC-ready" is gone from three places: the marketing card, the knowledge-base meta and the welcome tour (which also promised payroll submissions that don't exist).
- Help now describes the sandbox-only submission honestly.
- New guard `src/test/noApprovalClaims.test.ts`.

**Accessibility:**
- On the submit panel:
  - focus moves to the result;
  - an accepted result is announced;
  - a disabled Submit says why;
  - decorative icons are hidden.
- On the VAT return screen: the period error is linked to the date fields and announced, and the radio group has a legend.
- The connection card's stale "in later steps" wording is fixed.

**Security contact:** `public/.well-known/security.txt`. `SECURITY.md` now points to it, and its stale HMRC line is corrected: the old browser token RPCs no longer exist in production.

## Owner decisions

1. Make sure someone reads info@b2bnest.online and answers security reports promptly (above), and name the incident lead and the responsible individual.
2. Retention for `hmrc_vat_submissions` and `hmrc_audit_log`. The proposal is 6 years, with an adviser.
3. Privacy policy wording (`privacy-wording.md`), with an adviser. Then update the live page in a separate PR.
4. Done: the unproven `SecurityGuide` claims (data protection officer, compliance audits, impact assessments, processing agreements) were removed.
5. Send the port question to HMRC (`public-port.md`). Decide on a fixed outbound IP (`HMRC_VENDOR_PUBLIC_IP`) or say it can't be provided.
6. Run the sandbox fraud-header validation and a full end-to-end run, and keep the results.
7. An accountant review of the box rules.
8. Penetration test, axe and screen reader testing, and self-service export and deletion. All are listed as NOT DONE.

## Checks

| Check | Result |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| `npx eslint .` (baseline 510) | 509 problems (one fewer) |
| `npx vitest run` | exit 0: 177 files, 1664 tests, no "Unhandled" |
| Deno tests (`supabase/functions/`) | 472 passed, 0 failed |
| `npm run build` | exit 0; `dist/.well-known/security.txt` is in the build |
