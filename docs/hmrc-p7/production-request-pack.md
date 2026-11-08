# HMRC production credentials: request pack (draft answers)

Ready-to-paste answers, built only from what this repository proves.

- **NOT DONE: <what>** marks a gap that must be closed, or honestly declared, before applying.
- **Owner:** check every answer against HMRC's actual production questionnaire (Developer Hub → your application →
  "Get production credentials"). Its exact questions are **to confirm with HMRC**: they aren't in this repository.
- Never paste a client secret, token or key into the form, an email or this file.

**B2BNEST stays sandbox only.** Production is refused in code until a separate reviewed change:
`readEnvironment` / `readConfig` in `supabase/functions/_shared/hmrc/config.ts`, plus the
`hvs_environment CHECK (environment = 'sandbox')` on `hmrc_vat_submissions`.

## 1. Organisation

| Question | Answer | Proof |
| --- | --- | --- |
| Legal name | Edeals Master Ltd, trading as B2BNEST | `src/components/Footer.tsx` |
| Registration | Company No. 15242148, incorporated in England & Wales on 27 October 2023 | Footer; terms page. Proof type: **Companies House registration number** (owner to attach a Companies House extract if asked) |
| Website | https://www.b2bnest.online | `index.html`, `public/sitemap.xml` |
| Privacy policy URL | https://www.b2bnest.online/privacy | `src/App.tsx`. **NOT DONE: the page doesn't yet describe HMRC data, fraud prevention data, processors or retention** (draft: `privacy-wording.md`) |
| Terms URL | https://www.b2bnest.online/terms | `src/App.tsx`. **NOT DONE: no HMRC-specific terms reviewed** (owner and adviser) |
| Responsible individual | [Name, role, email: OWNER TO FILL IN] | **NOT DONE** |
| Security contact | security@b2bnest.online, published in `/.well-known/security.txt` | `public/.well-known/security.txt`. **NOT DONE: the owner must confirm the mailbox exists and is read** |

## 2. Software

| Question | Answer | Proof |
| --- | --- | --- |
| Product | B2BNEST: a web application for UK small businesses (invoices, expenses, VAT records, VAT return preview and submission) | `docs/hmrc-plan` |
| Connection method | `WEB_APP_VIA_SERVER` | `supabase/functions/_shared/hmrc/fraudHeaders.ts` |
| APIs used | VAT (MTD) 1.0: `GET /organisations/vat/{vrn}/obligations` and `POST /organisations/vat/{vrn}/returns`. Sandbox only: Hello World 1.0 and Test Fraud Prevention Headers 1.0 | `vatObligations.ts`, `vatSubmit.ts`, `testCall.ts` |
| APIs **not** used | VAT liabilities, payments, view return; Income Tax (ITSA); PAYE / RTI; Corporation Tax | Not in the code. Don't tick them |
| Scopes | `read:vat`, `write:vat` (plus `hello` in the sandbox only) | `config.ts` `HMRC_VAT_SCOPES`, `scopesFor` |
| Who can use it | Business and Scale plans (and the trial). Company owners and admins only, with two-step sign-in | `hmrc_manage_allowed` (P0/P1 SQL), `handlers.ts` `canManage` |
| Agents | No: B2BNEST acts for the business itself, not as an agent | — |
| Box rules | The nine boxes are worked out from per-line VAT on invoices and expenses (standard scheme only). **NOT DONE: the box rules are not verified by an accountant or against every HMRC rule** (`docs/hmrc-p5/README.md`, `src/lib/vat/returnRules.ts`) | — |
| End-to-end in the sandbox | Connect → obligations → prepare → submit → receipt → history, with a test scenario picker. **NOT DONE: no recorded end-to-end sandbox run is filed in the repo** (owner to run and keep screenshots) | `docs/hmrc-p6/README.md` |

## 3. Fraud prevention headers

| Question | Answer | Proof |
| --- | --- | --- |
| Status | Every `WEB_APP_VIA_SERVER` header is built in one module and checked with the Test Fraud Prevention Headers API from the app ("Validate fraud prevention headers") | `fraudHeaders.ts`, `testCall.ts`, `HMRCTestTools.tsx` |
| Headers left out | `Gov-Client-Public-Port`: no truthful source (`public-port.md`). `Gov-Vendor-Public-IP` and `Gov-Vendor-Forwarded`: `HMRC_VENDOR_PUBLIC_IP` is unset, so there is no fixed outbound IP. `Gov-Vendor-License-IDs`: no licence on the device | `fraudHeaders.ts` |
| Validation result | **NOT DONE: no saved `VALID_HEADERS` result from HMRC's validator.** The owner should run it in the sandbox and keep the result, without any token | — |
| Client IP source | `X-Forwarded-For` (first entry), `cf-connecting-ip`, `x-real-ip`. **NOT DONE: not confirmed for hosted Supabase** | `clientIpFrom` |
| Port exemption | **NOT DONE: ask HMRC** (wording in `public-port.md`) | — |

## 4. Error handling

Every HMRC answer is mapped to a plain message:

- a VAT return is never sent twice automatically;
- a 5xx or timeout on submit is recorded as "unknown", and the person is sent to "Check with HMRC";
- a 429 shows when to try again.

See `error-handling.md`. **NOT DONE: the error codes marked "(memory)" are not verified against HMRC's documentation.**

## 5. Data protection and security

| Question | Answer | Proof |
| --- | --- | --- |
| Where data is processed | Supabase, region **eu-west-2 (London)** for the database, sign-in and storage (project settings, checked 2026-11-08). Edge Functions: location **to confirm with Supabase**. Website hosting: Vercel. Other processors are listed in `privacy-wording.md` | `get_project` (read-only) |
| Token protection | AES-256-GCM. The key lives only in Edge Function secrets. Each value is bound to its company, environment and field. Tokens are never sent to the browser and never logged | `_shared/hmrc/crypto.ts`, `store.ts`; P0 tests |
| Customer separation | Row-level security on every public table; checks per company inside every HMRC function | `SECURITY.md`, `docs/company-ab-tenant-security-matrix-2026-09.md`, the P0/P3/P6 test suites |
| Access control | Owners and admins only; two-step sign-in (TOTP) required for HMRC actions; demo accounts refused; rate limits | `handlers.ts`, `vatObligations.ts`, `_shared/demo-guard.ts` |
| Audit | An append-only HMRC audit log (codes only); immutable VAT submission records | `docs/hmrc-p0/proposal.sql`, `docs/hmrc-p6/proposal.sql` |
| Secrets handling | No secret in the repo (`src/test/envProduction.test.ts`); CI checks on every PR | `.github/workflows/ci.yml` |
| UK GDPR rights | Requests by email; disconnect deletes tokens. **NOT DONE: no self-service export or deletion** (`data-rights.md`) | — |
| Retention | **NOT DONE: owner and adviser to decide** (proposed 6 years, `data-rights.md`) | — |
| Breach process | One page: tell HMRC immediately, the ICO within 72 hours | `incident-response.md`. **NOT DONE: incident lead not named; no breach log set up** |
| Penetration test | **NOT DONE: no penetration test has been carried out.** Don't claim one | — |
| Accessibility | A quick manual audit of the VAT screens, with small fixes | `accessibility.md`. **NOT DONE: no WCAG AA conformance claim; no axe or screen reader test** |
| Supabase advisor findings | Open WARNs: leaked-password protection off, Postgres patches pending, and security definer functions to review | `SECURITY.md` |

## 6. Marketing

- Until HMRC lists B2BNEST, say nothing about recognition.
- After listing, say "HMRC recognised" only, never "approved" or "accredited".
- `src/test/noApprovalClaims.test.ts` fails the build on "HMRC approved / accredited / certified / recognised / ready",
  "MTD ready", "ready for Making Tax Digital" and "accredited" / "certified" in app copy, Edge Function copy, the
  assistant knowledge, `index.html` and `llms.txt`.
- **Owner:** when B2BNEST is listed, add a reviewed exception for the exact phrase "HMRC recognised".
