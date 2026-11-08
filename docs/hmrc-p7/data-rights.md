# UK GDPR data rights: what exists today (P7a)

**How this was checked:**
- the code in this repository;
- read-only queries on production `gvftvswyrevummbvyhxa` on 2026-11-08: function names, column names and row counts only (no values were read).

**The short answer:**
- **There is no self-service export or deletion of an account or a company.** Production has no export, erase or
  delete-account function, and the app has no such button.
- Requests go by email to `privacy@b2bnest.online` (`src/pages/articles/SecurityGuide.tsx`), handled by hand.
- Admins can export platform-wide CSVs (`src/pages/admin/AdminExport.tsx`). That is an admin tool, not a customer export.

## Separation and encryption

- **Each company's data is kept separate:**
  - row-level security is on for every `public` table (`SECURITY.md`);
  - HMRC tables are keyed by `company_id` / `organization_id`;
  - `hmrc_manage_allowed` checks plan, owner/admin and two-step sign-in;
  - the tenant tests are in `docs/company-ab-tenant-security-matrix-2026-09.md`, the P0/P3/P6 suites and `src/test/demoReadonlyCoverage.test.ts`.
- **HMRC tokens are encrypted** with AES-256-GCM (`supabase/functions/_shared/hmrc/crypto.ts`):
  - the key, `HMRC_TOKEN_KEY`, exists only in Edge Functions;
  - each value is bound to its company, environment and field, so a value copied to another row won't decrypt.
- **Supabase encrypts the database at rest.** That is the provider's statement, **to confirm** from Supabase's security documentation for the owner's plan.

## Table

| Data | Where it's stored | Export today? | Delete today? | What is kept and why |
| --- | --- | --- | --- | --- |
| Account (email, password hash, two-step factors) | Supabase Auth `auth.users`; `profiles`; `user_2fa_*` | No: by email request | No self-service; an admin can suspend (`admin-set-user-ban`). Deleting a user is a manual Supabase action | Kept until deleted by hand |
| Company and membership | `organizations`, `organization_members`, `organization_invitations` | No | No self-service. **A company with an HMRC submission can't be deleted**: `hmrc_vat_submissions.organization_id` is `ON DELETE RESTRICT` | — |
| Business records (invoices, quotes, expenses, payroll, CRM, projects, notes, documents, rota, time) | The matching `public` tables, per company | Partly: some screens download CSV or PDF (invoice PDF, VAT preview CSV, receipt CSV, holiday CSV, admin exports) | Most records can be deleted one by one in the app | The customer's own records |
| HMRC connection (encrypted tokens, scopes, who connected, when) | `hmrc_connections` | No | **Yes: Disconnect** nulls both tokens and marks the row `disconnected` (`handlers.ts` `disconnect`). A database CHECK forbids tokens on a disconnected row (`hc_disconnected_no_tokens`). Tested in `_shared/hmrc/hmrc_test.ts` ("disconnect: owners and admins only; tokens deleted; audited") | The row stays (status, who and when) without tokens. Whole row removed when the company is deleted (`ON DELETE CASCADE`) |
| HMRC sign-in state (short-lived) | `hmrc_oauth_states` | No | Cascades with the user and the company | Short-lived by design |
| HMRC settings (VAT number, UTR, PAYE reference) | `hmrc_settings` (legacy, per user/company) | No | No self-service | Owner to review: the UTR and PAYE fields aren't used by the current HMRC code |
| Legacy HMRC token table | `hmrc_integrations`: plain-text `access_token` / `refresh_token` columns, **0 rows** in production | — | — | Follow-up: drop the table (SQL, not in this PR) |
| HMRC audit log (event codes only: connected, refreshed, refused…; no token, no HMRC body) | `hmrc_audit_log` (append-only, no foreign keys on purpose) | No | **No: permanent by design** | See retention below |
| VAT return submissions (the nine boxes sent, HMRC's receipt, who submitted, the last 3 digits of the VAT number) | `hmrc_vat_submissions` (immutable; sandbox only) | Yes: per row, as a receipt CSV on the VAT Returns screen | **No: permanent by design** | See retention below |
| Fraud prevention data (device ID, user agent, screens, window size, timezone, public IP, two-step info, user ID) | **Not stored.** Built for each HMRC call and sent to HMRC only (`fraudHeaders.ts`). The device ID lives in the person's browser storage | — | The person can clear browser storage | Not kept by B2BNEST |
| Marketing consent | `marketing_consents`, `email_optouts` | No | Opt-out in Settings and by the email link | Kept as proof of consent or opt-out |
| AI conversations and credits | `ai_conversations`, `ai_credit_ledger`, `ai_credit_lots` | No | Conversations: partly in the app | Credits ledger kept for billing |
| Billing | Stripe (processor); `subscribers`, `payments`, `stripe_webhook_events` | Through the Stripe customer portal (`customer-portal`) | No | Financial records |

## Retention for the two permanent HMRC tables (owner and adviser to decide)

**Owner and adviser to decide. Nothing here changes the immutability.**

| Table | Why it's kept | Proposed period |
| --- | --- | --- |
| `hmrc_vat_submissions` | The record of what was sent to HMRC and HMRC's receipt. The business needs it to answer HMRC and to stop a period being sent twice. VAT records must normally be kept for 6 years (HMRC VAT Notice 700/21, **adviser to confirm**) | 6 years after the end of the VAT period, then deleted by a reviewed, audited job that is the only path allowed to delete. Sandbox rows could be kept for less, for example 12 months |
| `hmrc_audit_log` | Security record of who connected, refreshed, disconnected or was refused. HMRC may ask about access to a customer's data | 6 years, to match the submissions, **adviser to confirm**. It holds user IDs, not names or emails |

**What to tell a person who asks for erasure:** their account can be removed by hand. These two tables keep their user ID
(and, in submissions, the name shown at the time) because of a legal duty to keep tax records (UK GDPR Article 17(3)(b),
**adviser to confirm**).

## Small fixes in this PR

None were needed in code. Disconnect already deletes the tokens, and that is tested. Everything below needs SQL or a
policy decision, so it is listed, not built.

## Follow-ups

1. A self-service "Download my data" (account) and "Download company data" (owner), as JSON/CSV per table. Needs a
   security definer export function per scope. SQL.
2. An account deletion flow:
   - removes `auth.users` and personal rows;
   - keeps the HMRC records, as decided above;
   - makes sure the person isn't the last owner of a company. SQL plus an Edge Function.
3. A company deletion flow that copes with `ON DELETE RESTRICT` on submissions: archive the company, keep its HMRC records for the retention period.
4. Revoke the HMRC grant at disconnect. No revoke endpoint was verified in P0. **To confirm with HMRC.**
5. Drop `hmrc_integrations` (0 rows, plain-text token columns). Review the unused `hmrc_settings` fields (UTR, PAYE reference, `client_secret`, currently empty).
6. `src/pages/articles/SecurityGuide.tsx` claims things this audit couldn't prove:
   - a Data Protection Officer;
   - "regular compliance audits";
   - "privacy impact assessments conducted";
   - data processing agreements.
   The owner must confirm these or remove them (see `privacy-wording.md`).
