# HMRC production credentials: request pack (draft answers)

Ready-to-paste answers, built only from what this repository proves. Last updated: 8 Nov 2026 (HMRC P7c).

- **NOT DONE: <what>** marks a gap that must be closed, or honestly declared, before applying.
- **Owner:** check every answer against HMRC's actual production questionnaire (Developer Hub → your application →
  "Get production credentials"). Its exact questions are **to confirm with HMRC**: they aren't in this repository.
- Never paste a client secret, token or key into the form, an email or this file.

**B2BNEST stays sandbox only.** Production is refused in code until a separate reviewed change:
`readEnvironment` / `readConfig` in `supabase/functions/_shared/hmrc/config.ts`, plus the
`hvs_environment CHECK (environment = 'sandbox')` on `hmrc_vat_submissions`.

## Owner decisions on record (8 Nov 2026)

- **Incident lead and responsible individual named to HMRC:** Toufik Zemri, director of Edeals Master Ltd.
- **Retention:** B2BNEST keeps its minimal HMRC trail (VAT returns sent, HMRC activity log) for **6 years**
  (**adviser to confirm**). Sandbox records: 12 months.
- **Contact mailbox:** info@b2bnest.online (the only one).

## Contact with HMRC

| | |
| --- | --- |
| Sent | 8 Nov 2026, by the owner, to HMRC Developer Hub support |
| HMRC reference | **2026-GYD243** |
| HMRC's answer to the ticket | It will reply within 2 working days, possibly longer because of high volumes. **Do not chase.** |
| Subject | The fraud prevention headers B2BNEST can't collect: `Gov-Client-Public-Port`, `Gov-Vendor-Public-IP`, `Gov-Vendor-Forwarded`, and the warning for `Gov-Vendor-License-IDs` |
| Reply | **pending** |

The three questions sent:

1. Our server code runs on a hosted platform (Supabase Edge Functions) whose gateway gives us the client's public IP
   address but not the client's source port. Is leaving `Gov-Client-Public-Port` out acceptable for a
   `WEB_APP_VIA_SERVER` application, and if not, what would you accept instead?
2. The same platform has no fixed outbound IP address, so we can't truthfully send `Gov-Vendor-Public-IP` or
   `Gov-Vendor-Forwarded`. Is leaving them out acceptable, or do you need us to route HMRC calls through a fixed
   address?
3. B2BNEST installs no licence on the person's device, so there is no value for `Gov-Vendor-License-IDs` and the
   validator shows a warning. Is leaving it out, with the warning, acceptable?

HMRC's reply (paste below when it arrives, with the date; no tokens or ids from the account):

```
(reply pending)
```

## 1. Organisation

| Question | Answer | Proof |
| --- | --- | --- |
| Legal name | Edeals Master Ltd, trading as B2BNEST | `src/components/Footer.tsx` |
| Registration | Company No. 15242148, incorporated in England & Wales on 27 October 2023 | Footer; terms page. Proof type: **Companies House registration number** (owner to attach a Companies House extract if asked) |
| Website | https://www.b2bnest.online | `index.html`, `public/sitemap.xml` |
| Privacy policy URL | https://www.b2bnest.online/privacy | `src/App.tsx`, `src/pages/PrivacyPolicy.tsx`. **Updated in HMRC P7d (9 Nov 2026, live once the front end is published):** HMRC test environment only, the fraud prevention information sent, what we keep, records of returns sent can't be changed or deleted, HMRC readings shown live and not stored, download and delete in Settings > Your data, retention (6 years; test environment 12 months; tokens only while connected). **NOT DONE: legal bases, the full processor list, Edge Function location and international transfers** (not published until confirmed; `privacy-wording.md`) |
| Terms URL | https://www.b2bnest.online/terms | `src/App.tsx`. **NOT DONE: no HMRC-specific terms reviewed** (owner and adviser) |
| Responsible individual | Toufik Zemri, director of Edeals Master Ltd (owner decision, 8 Nov 2026); contact info@b2bnest.online | Owner decision recorded in `docs/hmrc-p7b/README.md` |
| Security contact | info@b2bnest.online, published in `/.well-known/security.txt` | `public/.well-known/security.txt`. Confirmed by the owner. **Still to do: make sure someone reads it and answers security reports promptly** |

## 2. Software

| Question | Answer | Proof |
| --- | --- | --- |
| Product | B2BNEST: a web application for UK small businesses (invoices, expenses, VAT records, VAT return preview and submission) | `docs/hmrc-plan` |
| Connection method | `WEB_APP_VIA_SERVER` | `supabase/functions/_shared/hmrc/fraudHeaders.ts` |
| APIs used | VAT (MTD) 1.0: `GET /organisations/vat/{vrn}/obligations` and `POST /organisations/vat/{vrn}/returns`. **HMRC P8 (built, not yet deployed):** `GET /organisations/vat/{vrn}/returns/{periodKey}` (view return), `GET …/liabilities`, `GET …/payments`, `GET …/penalties`. Sandbox only: Hello World 1.0 and Test Fraud Prevention Headers 1.0 | `vatObligations.ts`, `vatSubmit.ts`, `vatReads.ts`, `testCall.ts` |
| APIs **not** used | VAT financial details and customer information (verified, not built); Income Tax (ITSA); PAYE / RTI; Corporation Tax | Not in the code. Don't tick them |
| Scopes | `read:vat`, `write:vat` (plus `hello` in the sandbox only). **HMRC P8 adds no scope:** the four reads use `read:vat` | `config.ts` `HMRC_VAT_SCOPES`, `scopesFor`; `docs/hmrc-p8/README.md` |
| Who can use it | Business and Scale plans (and the trial). Company owners and admins only, with two-step sign-in | `hmrc_manage_allowed` (P0/P1 SQL), `handlers.ts` `canManage` |
| Customer access switch | Customer access to HMRC features can be switched off by the owner; default hidden. Hidden, every HMRC Edge Function refuses customers (`hmrc_unavailable_for_now`) before any HMRC call; platform super admins and admins keep access for testing; disconnect always works. **Built 9 Nov 2026, SQL not applied, not deployed** | `docs/hmrc-hide/README.md`, `_shared/hmrc/access.ts`, `caller.ts` |
| Agents | No: B2BNEST acts for the business itself, not as an agent | — |
| Box rules | The nine boxes are worked out from per-line VAT on invoices and expenses (standard scheme only). **NOT DONE: the box rules are not verified by an accountant or against every HMRC rule** (`docs/hmrc-p5/README.md`, `src/lib/vat/returnRules.ts`). Low-cost options: `accountant-and-pentest-options.md` | — |
| End-to-end in the sandbox | **DONE (8 Nov 2026, owner):** connect → obligations → prepare → submit → receipt → history. HMRC's sandbox **accepted** the return for period **18A1**, form bundle **529735553360**, stored with its figures hash. A second submit for the same period was **refused as already accepted**. | `docs/hmrc-p6/README.md`; `hmrc_vat_submissions` (immutable) |

### HMRC P8 reads (8 Nov 2026: built and tested, NOT deployed, SQL NOT applied)

| Question | Answer | Proof |
| --- | --- | --- |
| Endpoints | View return, liabilities, payments, penalties (GET only). Verified against HMRC's VAT API 1.0 definition on 8 Nov 2026 | `docs/hmrc-p8/README.md` §0 |
| Sandbox scenarios offered | View return: `DATE_RANGE_TOO_LARGE`, `INSOLVENT_TRADER`. Liabilities: `SINGLE_LIABILITY`, `MULTIPLE_LIABILITIES`, `SINGLE_LIABILITY_2018_19`, `MULTIPLE_LIABILITIES_2018_19`, `INSOLVENT_TRADER`. Payments: `SINGLE_PAYMENT`, `MULTIPLE_PAYMENTS`, `SINGLE_PAYMENT_2018_19`, `MULTIPLE_PAYMENTS_2018_19`, `INSOLVENT_TRADER`. Penalties: the ten HMRC documents | `vatReads.ts` |
| Audit actions | `vat_return_view_call` / `_result`, `vat_liabilities_call` / `_result`, `vat_payments_call` / `_result`, `vat_penalties_call` / `_result` (codes only) | `docs/hmrc-p8/proposal.sql` |
| Rate limit | 10 an hour per company for each read | `hmrc_take_read_slot` |
| What is stored | Nothing that HMRC returns. Read live each time | `vatReads.ts` |
| Sandbox test | **NOT DONE** (after rollout; owner steps in `docs/hmrc-p8/README.md` §2) | — |

## 3. Fraud prevention headers

| Question | Answer | Proof |
| --- | --- | --- |
| Status | Every `WEB_APP_VIA_SERVER` header is built in one module and checked with the Test Fraud Prevention Headers API from the app ("Validate fraud prevention headers") | `fraudHeaders.ts`, `testCall.ts`, `HMRCTestTools.tsx` |
| Headers left out | `Gov-Client-Public-Port`: no truthful source (`public-port.md`). `Gov-Vendor-Public-IP` and `Gov-Vendor-Forwarded`: `HMRC_VENDOR_PUBLIC_IP` is unset, so there is no fixed outbound IP. `Gov-Vendor-License-IDs`: no licence on the device | `fraudHeaders.ts` |
| Validation result | **Run by the owner on 8 Nov 2026** ("Check HMRC header test", HMRC's Test Fraud Prevention Headers API, sandbox). **Errors:** `gov-client-public-port`, `gov-vendor-forwarded`, `gov-vendor-public-ip`. **Warning:** `gov-vendor-license-ids`. **Every other header accepted.** These are exactly the headers we can't collect truthfully; asked HMRC about them (ref. 2026-GYD243, reply pending) | `HMRCTestTools.tsx`, `testCall.ts` |
| Client IP source | `X-Forwarded-For` (first entry), `cf-connecting-ip`, `x-real-ip`. **NOT DONE: not confirmed for hosted Supabase** | `clientIpFrom` |
| Port exemption | Asked HMRC on 8 Nov 2026 (ref. **2026-GYD243**, **reply pending**; see "Contact with HMRC") | `public-port.md` |

## 4. Error handling

Every HMRC answer is mapped to a plain message:

- a VAT return is never sent twice automatically;
- a 5xx or timeout on submit is recorded as "unknown", and the person is sent to "Check with HMRC";
- a 429 shows when to try again.

See `error-handling.md`. **Checked 8 Nov 2026** against HMRC's published VAT (MTD) API 1.0 definition (HMRC's own
GitHub repository `hmrc/vat-api`, `resources/public/api/conf/1.0/application.yaml`):
- the codes HMRC documents for our two endpoints are mapped;
- codes not in that definition were removed;
- HMRC's general platform errors (`INVALID_SCOPE`, `MATCHING_RESOURCE_NOT_FOUND`, `MESSAGE_THROTTLED_OUT`) stay marked
  **"memory, not verified"**. HMRC's reference guide on developer.service.hmrc.gov.uk couldn't be fetched from the
  session that did the check.

## 5. Data protection and security

| Question | Answer | Proof |
| --- | --- | --- |
| Where data is processed | Supabase, region **eu-west-2 (London)** for the database, sign-in and storage (project settings, checked 2026-11-08). Edge Functions: location **to confirm with Supabase**. Website hosting: Lovable (owner's statement, 8 Nov 2026; the repository also carries a `vercel.json`). Other processors are listed in `privacy-wording.md` | `get_project` (read-only) |
| Token protection | AES-256-GCM. The key lives only in Edge Function secrets. Each value is bound to its company, environment and field. Tokens are never sent to the browser and never logged | `_shared/hmrc/crypto.ts`, `store.ts`; P0 tests |
| Customer separation | Row-level security on every public table; checks per company inside every HMRC function | `SECURITY.md`, `docs/company-ab-tenant-security-matrix-2026-09.md`, the P0/P3/P6 test suites |
| Access control | Owners and admins only; two-step sign-in (TOTP) required for HMRC actions; demo accounts refused; rate limits | `handlers.ts`, `vatObligations.ts`, `_shared/demo-guard.ts` |
| Audit | An append-only HMRC audit log (codes only); immutable VAT submission records | `docs/hmrc-p0/proposal.sql`, `docs/hmrc-p6/proposal.sql` |
| Secrets handling | No secret in the repo (`src/test/envProduction.test.ts`); CI checks on every PR | `.github/workflows/ci.yml` |
| UK GDPR rights | Self-service in Settings → Your data: download my data, download company data (owners and admins), close a company (owners), delete my account; email info@b2bnest.online as a fallback. Disconnect deletes tokens. **DONE (8 Nov 2026):** HMRC P7b SQL applied to production (148 public tables; `hmrc_integrations` dropped; request log; closed-company support; purge function present, **not scheduled**). `data-export` (v3), `account-delete` (v2) and `company-close` (v2) deployed with JWT verification on. Export tested by the owner for both scopes, including the authenticator code prompt. HMRC P7d: the live Privacy Policy now describes these steps | `docs/hmrc-p7b/`, `supabase/functions/_shared/data-rights/`, `src/components/settings/YourData.tsx` |
| Retention | B2BNEST keeps its minimal HMRC record (VAT returns sent, HMRC activity log) for 6 years (owner decision; adviser to confirm); sandbox records 12 months. The purge is applied (8 Nov 2026) and tested (`hmrc_purge_expired_audit`, dry run by default). **NOT DONE: the purge is not scheduled** (owner decision) | `docs/hmrc-p7b/proposal.sql` |
| Breach process | One page: tell HMRC immediately, the ICO within 72 hours. Incident lead: Toufik Zemri (owner decision) | `incident-response.md`. **NOT DONE: no breach log set up yet** |
| Penetration test | HMRC's terms of use (as read by the owner on 8 Nov 2026, https://www.tax.service.gov.uk/api-documentation/docs/terms-of-use) say software as a service must *"pass penetration testing, either with your own tools or an independent supplier"*. **Our status: self-assessed with free tools, see `security-self-check.md`. Independent test NOT DONE.** Don't claim a penetration test | `security-self-check.md`, `accountant-and-pentest-options.md` |
| Accessibility | A quick manual audit of the VAT screens, with small fixes | `accessibility.md`. **NOT DONE: no WCAG AA conformance claim; no axe or screen reader test** |
| Supabase advisor findings (run 8 Nov 2026) | Postgres security patches outstanding (upgrade pending); leaked-password protection off (needs a paid plan); many SECURITY DEFINER functions executable by `authenticated` and 18 by `anon`, by design with checks inside (review listed as a follow-up); 21 tables with RLS and no policy, by design (server-only) | `security-self-check.md`, `SECURITY.md` |

## 6. Marketing

- Until HMRC lists B2BNEST, say nothing about recognition.
- After listing, say "HMRC recognised" only, never "approved" or "accredited".
- `src/test/noApprovalClaims.test.ts` fails the build on "HMRC approved / accredited / certified / recognised / ready",
  "MTD ready", "ready for Making Tax Digital" and "accredited" / "certified" in app copy, Edge Function copy, the
  assistant knowledge, `index.html` and `llms.txt`.
- **Owner:** when B2BNEST is listed, add a reviewed exception for the exact phrase "HMRC recognised".
