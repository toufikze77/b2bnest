# Finance phase 2: ledger foundation

This adds a double-entry ledger to Finance:
- a chart of accounts;
- an accounting start date (start fresh, or import opening balances as one balanced journal);
- balanced manual journals and reversals;
- a trial balance at any date.

It is a bookkeeping tool. Every ledger screen says: "Bookkeeping tool. Not accounting, tax or legal advice."

**Status: prepared, not applied.**
- The SQL in this folder has not been run on production. I can only read production.
- The production facts below come from the repository. The owner's assistant re-checks them against production before applying.
- Nothing here talks to HMRC. The HMRC hide switch, HMRC functions and fraud headers are not touched.

## Owner decisions this follows
- **Limited companies first.** The standard chart is a UK small limited company chart.
- **Two ways in:** start fresh from a date, or import opening balances as one balanced journal dated the start date.
- **Plans:** the full ledger is for Business, Scale and the 14-day trial. Solo and an ended trial see an upgrade note.
  - This reuses the existing plan rule `hmrc_manage_allowed(company, user)` (docs/hmrc-plan). No new plan check was added.
- **No automatic postings.** Invoices, expenses, bills, payroll and VAT do not post to the ledger yet.

## What already existed (searched first)
No ledger, chart of accounts, journal or nominal code existed. The search turned up these, and none of them is a bookkeeping ledger, so none was reused or changed:

| Found | What it is |
|---|---|
| `ai_credit_ledger`, `admin_ai_ledger_summary`, `_shared/ai-ledger.ts` | AI credit balance per user (Phase 35–37) |
| `wave1_backfill_journal` (migration `20260919100312_…`) | A one-off data backfill log |
| `bank_accounts`, `bank_transactions` | Bank feed (TrueLayer) rows |
| Expense / cash-flow categories (`src/lib/cashFlowCategories.ts`, `src/lib/moneyOut.ts`) | Labels on money-out records, not accounts |

What the ledger does reuse:
- the plan rule `hmrc_manage_allowed`;
- `user_is_organization_member`;
- the MFA helpers `require_aal2_if_enrolled()` and `mfa_ok()`;
- the demo read-only trigger `demo_readonly_guard`;
- the P7b data-rights gate `_data_rights_gate_is_open` and the closed-company guard `_data_rights_closed_company_guard`;
- the per-user `audit_logs` table.

## Design

### Tables (all new; no existing table is altered)

| Table | Holds |
|---|---|
| `ledger_settings` | One row per company: `start_date`, `opening_mode` (`fresh`/`import`), `base_currency` (`GBP` only), `locked_through`, who set it up |
| `ledger_accounts` | The chart: `code` (unique per company), `name`, `type` (asset, liability, equity, income, expense), `normal_side`, `is_system` + `system_key`, `is_active` |
| `journal_entries` | One row per journal: date, memo, reason, `source_type` (`manual`, `opening_balance`, `reversal`), `reverses_entry_id` (unique: one reversal per journal), `idempotency_key`, `posted_by`, `posted_by_name`, `posted_at` |
| `journal_lines` | The lines: account, `debit` or `credit` (`numeric(14,2)`, exactly one side above 0), description |

### Rules (in the database)
- **Balanced at commit.**
  - A deferred constraint trigger on `journal_entries` and `journal_lines` refuses, at COMMIT, any journal with fewer than 2 lines (`LEDGER_TOO_FEW_LINES`) or with debits ≠ credits (`LEDGER_UNBALANCED`).
  - Lines can only be inserted by the posting function, which names the journal being posted.
- **Append-only.**
  - Journals and lines can't be updated, deleted or truncated (`LEDGER_APPEND_ONLY`). A mistake is fixed by reversing.
  - There are only two exceptions, both through the P7b gate:
    - deleting a closed company's rows (`company_close`);
    - setting `posted_by_name` to "Deleted user" when that person deletes their account (`anonymise`).
- **Dates.**
  - No journal before the start date (`LEDGER_BEFORE_START`) or within `locked_through` (`LEDGER_PERIOD_LOCKED`).
  - Opening balances are dated the start date.
  - The start date is fixed once a journal exists, and the lock can't move backwards.
- **Accounts.**
  - System accounts (17, such as Bank 1200, VAT control 2200, Share capital 3000, Sales 4000, Suspense 9999) keep their code and stay active.
  - An account with lines can't be deleted, only made inactive.
  - An inactive account can't take new lines, except in a reversal.
- **Access.**
  - **Reading:** members of the company, through RLS.
  - **Writing:** only through the RPCs below, by owners and admins, on a plan that includes the ledger, with aal2 when the person has two-step sign-in.
  - **Refused:** demo accounts, closed companies and anon.
  - The tables have no INSERT, UPDATE or DELETE grant for anyone.
- **Audit.** Every posting writes one row to the poster's own `audit_logs` (`ledger.journal_manual`, `…_opening_balance` or `…_reversal`).
- **Idempotency.** A manual journal carries a key from the form. Posting twice with the same key returns the first journal.

### RPCs

| Function | Who | Does |
|---|---|---|
| `ledger_status(p_org)` | members | access (`ok`, `demo`, `plan_not_included`, `trial_ended`, `suspended`), `can_post`, `set_up`, start date, mode, lock, currency |
| `ledger_setup(p_org, p_start_date, p_mode, p_opening)` | writers | once per company: settings, the standard chart (30 accounts), and in `import` mode the opening journal |
| `ledger_post_journal(p_org, p_entry_date, p_memo, p_reason, p_lines, 'manual', p_idempotency_key)` | writers | a balanced manual journal; a reason of 3+ characters is required |
| `ledger_reverse_journal(p_entry, p_reason, p_entry_date)` | writers | the mirror journal, once; not a reversal of a reversal; reason required |
| `ledger_add_account(p_org, p_code, p_name, p_type, p_parent)` | writers | a new account |
| `ledger_update_account(p_account, p_name, p_code, p_is_active)` | writers | rename, recode (not system accounts), make inactive or active |
| `ledger_delete_account(p_account)` | writers | an unused, non-system account |
| `ledger_trial_balance(p_org, p_as_of)` | members on an included plan | per-account debit and credit totals up to a date |
| `ledger_seed_chart(p_org)` | internal only | the standard chart (no grant to anyone) |

Lines are JSON: `[{"account_code": "1200", "debit": "1500.00", "credit": "0.00"}, …]` (or `account_id`). Amounts are decimal strings with up to two places.

### Closure, data rights and export
- **Company close:** no SQL change needed. P7b already deletes every `organization_id` table through the `company_close` gate, and the ledger guards let that gate through.
- **Account delete:** `data_rights_delete_account` is replaced with the P7b body plus one line. It sets `journal_entries.posted_by_name` to "Deleted user" for that person, inside the existing `anonymise` gate, as P7b does for `hmrc_vat_submissions.submitted_by`.
- **Export:** the company export (`data-export`) now includes these, through `supabase/functions/_shared/data-rights/tables.ts` and `export.ts`:
  - `ledger_settings`, `ledger_accounts`, `journal_entries` and `journal_lines` as JSON;
  - `journal_lines.csv`.
- **Stale entry removed:** `NOT_EXPORTED` no longer lists `hmrc_integrations`. The table was removed by P7b and is gone from `types.ts`, so `src/test/dataExportCoverage.test.ts` ("no stale names") failed on main.

### Front end
- **Where:** Finance (Invoices & quotes) → **Bookkeeping → Ledger** (`?tab=ledger`).
- **Files:** `src/components/finance/ledger/*`, `src/lib/ledger.ts` (pure, integer pence), `src/lib/ledgerApi.ts`.
- **What it decides:** everything comes from `ledger_status`. Before the SQL is applied every call answers "not available" and the tab says "The ledger is not available yet."
- **What people see:**
  - **Solo / trial ended:** the upgrade note and a link to Pricing.
  - **Demo:** an inert notice. The database is not asked.
  - **Members who are not owners or admins:** read only.
- **Screens:**
  - **Setup wizard:**
    - start date;
    - fresh or import;
    - a balanced grid with the running difference;
    - CSV upload (`account_code,debit,credit`, problems listed by CSV line);
    - a preview;
    - one warning: "Once posted, a journal cannot be edited or deleted. It can only be reversed."
  - **Chart of accounts:** grouped by type. Add, rename (not system), make inactive or active.
  - **Journals:**
    - a list and a detail view;
    - New journal, with a required reason and a live balance check;
    - Reverse, with a required reason.
    - There is no edit or delete.
  - **Trial balance:** any date, with the totals check.

## Files
| File | What |
|---|---|
| `proposal.sql` | The change. A guard refuses it unless production matches the facts below. |
| `rollback.sql` | Undoes it. It refuses while any ledger row exists. |
| `fixture.sql` | Local only: the production `audit_logs` columns for the placeholder |
| `test.sql`, `run-test.sh` | The local suite |

### Production facts the guard checks (from the repository, 10 Nov 2026)
- **No ledger tables:** none of the four tables exists.
- **The 148 public tables:** md5 of the sorted names is `ca2f5c858ee858f9b3f7c14131e00b9f`.
- **Helper bodies:** `md5(prosrc)` of each helper it relies on matches. A body with its whole-line comments removed is also accepted. The helpers are:
  - `hmrc_manage_allowed`, `user_is_organization_member`, `require_aal2_if_enrolled`, `mfa_ok`, `demo_readonly_guard`;
  - `_data_rights_gate_is_open`, `_data_rights_closed_company_guard`, `_data_rights_company_tables`, `_data_rights_close_org`, `data_rights_delete_account`.
- **Columns:** the `audit_logs` columns and `organizations.closed_at` exist.

## Owner steps
1. **Review** this README, `proposal.sql` and the PR.
2. **The assistant applies** `docs/ledger/proposal.sql` in the Supabase SQL editor, after re-checking the facts above against production.
   - If the guard refuses, stop: production differs from the repository.
3. **Redeploy the data-rights Edge Functions.**
   - `data-export` changed: the ledger tables and the journal lines CSV.
   - `account-delete` and `company-close` bundle the same `tables.ts`, so redeploy them too to keep the three in step. Their behaviour is unchanged.
   - In PowerShell:
   ```powershell
   cd C:\b2bnest-deploy
   git pull
   npx.cmd supabase functions deploy data-export --project-ref gvftvswyrevummbvyhxa --use-api
   npx.cmd supabase functions deploy account-delete --project-ref gvftvswyrevummbvyhxa --use-api
   npx.cmd supabase functions deploy company-close --project-ref gvftvswyrevummbvyhxa --use-api
   ```
   - No new function, no `config.toml` change, and no secret.
4. **Publish** the front end. It is safe to publish before step 2: the Ledger tab then says "The ledger is not available yet."

## Owner test steps (after applying)
1. **Business or trial owner:** open Finance → Ledger. Set up with a start date and "Import opening balances":
   - enter Bank 1200 debit 1,000 and Share capital 3000 credit 1,000;
   - check the difference reads "Balanced";
   - preview, then set up.
2. **Journals:** the opening journal is listed.
   - Post a new journal with a reason, for example Rent 7100 debit 250 and Bank 1200 credit 250.
   - Reverse it with a reason. Its Reverse button disappears, and the reversal can't be reversed.
3. **Trial balance:** today shows Bank £1,000 Dr and Share capital £1,000 Cr (the rent journal and its reversal cancel out), and "Debits and credits agree."
4. **Chart of accounts:**
   - Bank shows "System" with no buttons.
   - Add 7150 Insurance, rename it, then make it inactive. It disappears from the New journal account list.
5. **A Solo account** sees the upgrade note. **A plain member** of a Business company sees the ledger with no buttons.
6. **Settings → Your data → Download company data:** the ZIP has `company/journal_entries.json`, `company/journal_lines.json` and `company/journal_lines.csv`.

## Checks run here
| Check | Result |
|---|---|
| `PG_RUN_USER=postgres bash docs/ledger/run-test.sh` (disposable local Postgres 16) | 127 PASS, 0 FAIL |
| Deno `_shared/data-rights` + `_shared/cors_test.ts` | 22 passed |
| `deno check` of `data-export`, `account-delete`, `company-close` | clean |
| vitest (whole suite) | 191 files, 1801 tests passed, exit 0, no unhandled errors |
| New vitest | `src/lib/ledger.test.ts` (22), `src/components/finance/ledger/ledgerTab.test.tsx` (19) |
| `tsc --noEmit`, `eslint .` | clean; 509 problems (baseline 510) |
| `npm run build` | OK |

- **The SQL suite covers:**
  - setup (fresh and import, twice refused, bad mode or date);
  - posting validation (amounts, one side, unknown or inactive account, too few or too many lines, unbalanced);
  - idempotency; reversal (once, not of a reversal, reason required);
  - the chart (system accounts, codes, used accounts);
  - RLS (members read; outsiders, anon and closed companies see nothing; no direct writes for authenticated, service_role or the table owner);
  - the plan rule (Business, trial, Solo, trial ended, member, demo); MFA;
  - dates and locks;
  - account deletion → "Deleted user"; company close through the gate;
  - commit-time balance checks; TRUNCATE refused;
  - the rollback fingerprint restored exactly, the rollback refused while rows exist, and drift refused.
- **Deno blocks:** `deno.land` is blocked here, so the Deno run used the local import map stand-ins, as in P7b.

## Rollback
- **When:** `docs/ledger/rollback.sql` refuses while any ledger row exists. There is no force switch: journals are business records, so export them first (Settings → Your data).
- **What it does:**
  - puts back the P7b `data_rights_delete_account` exactly;
  - drops the ledger functions, triggers and the four tables.
- **Edge Functions:** redeploying the previous `data-export` is optional. Without the tables the export simply has no ledger files.

## Risks
- **Plan rule shared with HMRC.** If `hmrc_manage_allowed` changes, the ledger follows it. That is intended (one plan rule), and the guard checks its body before applying.
- **The chart is fixed at setup.** It is the standard chart only. Companies add or rename accounts afterwards. Other charts (sole traders, charities) are not covered.
- **No period lock screen.** `locked_through` exists and is enforced, but there is no screen to set it yet.
- **Reversals are dated today.** The RPC takes a date, but the screen doesn't offer one yet.
- **Trial balance size.** It is computed on every view. That is fine at small-company volumes, but has no summary table.

## Not in this PR
- automatic postings (invoices, expenses, bills, payroll, VAT, bank feeds);
- reports from the ledger (P&L, balance sheet);
- year-end;
- tax;
- multi-currency;
- budgets;
- attachments;
- a period-lock screen;
- editing or deleting journals (by design).
