# Finance phase 4: reports from the ledger

**Status: prepared, NOT applied.** Nothing here has been run against production.

Bookkeeping tool. Not accounting, tax or legal advice.

This phase adds three reports and a completeness check:

1. **Profit and loss** for a date range.
2. **Balance sheet** as at a date.
3. **Account detail** (a simple nominal ledger): every journal line on one account in a date range, with a running balance and the source of each line.

**Where the figures come from:**
- Every figure comes from the ledger only: `journal_entries`, `journal_lines` and `ledger_accounts`, with `ledger_postings` used only to label a line with its invoice or bill number.
- Never from invoices, expenses or any other table.

**What this phase does not do:**
- Nothing is posted, stored, filed or sent, and nothing talks to HMRC.
- No table, column, trigger, policy, grant or existing function changes. The suite compares the catalogue before and after.

## Files
| File | What |
|---|---|
| `proposal.sql` | Four new functions, one transaction, with a guard (below). |
| `rollback.sql` | Drops the four functions. Nothing else to undo: the reports store nothing. |
| `fixture.sql` | Local only. Nothing beyond the production chain. |
| `test.sql` | The suite: one transaction, rolled back. |
| `run-test.sh` | Builds production on a throwaway Postgres, then applies, tests, rolls back and checks drift. |

Run it with `PG_RUN_USER=postgres bash docs/ledger-reports/run-test.sh`.

## Production facts the guard checks (read read-only on 16 Nov 2026)
- **The table set:** exactly **160 tables** in `public` (phase 3c-1 applied). The hash method is the one in `docs/ledger-bank/proposal.sql`:
  ```sql
  SELECT md5(string_agg(relname, ',' ORDER BY relname))
    FROM pg_class
   WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p');
  ```
  It gives `b9fec97b9d0d8c836c6af78125e92371`. I read this from production and recomputed the same value locally from the chain in `run-test.sh`. Phase 4 adds no table, so it stays 160 after applying.
- **Function bodies.** Each `md5(prosrc)` is accepted raw, without whole-line comments, or without any comment:

  | Function | Hash |
  |---|---|
  | `_ledger_rule(uuid,uuid)` | `edf2117e8b0bdeb3826552b712faa227` |
  | `_ledger_org_open(uuid)` | `361077573d6cc7f9c83c6702808d61cd` |
  | `require_aal2_if_enrolled()` | `10b2ae7bd2f9a94ea20598f19b8aebf2` |
  | `ledger_trial_balance(uuid,date)` | `5a165b9517c73e03556e9e5aab72c95e` (read from production; the pattern copied) |
  | `mfa_ok()` | `20516f2e…` or `c6fd9b98…` |
  | `hmrc_manage_allowed(uuid,uuid)` | `9304f069…` or `80190851…` |

- **Columns read:** the type of every column read in `ledger_accounts`, `journal_entries`, `journal_lines` (`numeric(14,2)`), `ledger_postings`, `ledger_settings`, `ledger_auto_settings`, `ledger_post_queue`, `ledger_post_issues` and `ledger_bank_lines`.
- **Account types:** the `ledger_accounts.la_type` CHECK, so the five account types are as phase 2 made them.
- **Second apply** is refused ("already exist").

## The functions
Every function:
- is STABLE, SECURITY DEFINER, with `search_path = ''`;
- can be run by `authenticated` only (revoked from `PUBLIC`, `anon` and `service_role`);
- uses the same rule as `ledger_trial_balance`:
  - `require_aal2_if_enrolled()` comes first;
  - `_ledger_rule` must be `ok` or `not_admin`, so members can read;
  - anything else raises `LEDGER_<RULE>` with errcode 42501: not a member, demo account, closed company, plan not included, trial ended, suspended.

Money is `numeric(14,2)` straight from the ledger, never a float. Report dates are always the **entry date** (the accounting date), never when a journal was posted.

| Function | Returns |
|---|---|
| `ledger_report_profit_loss(p_org uuid, p_from date, p_to date)` | Rows: `account_id, code, name, type, is_active, amount` for every income or expense account with a line in the range (both ends included). `amount`: income = credits − debits; expense = debits − credits. |
| `ledger_report_balance_sheet(p_org uuid, p_as_of date)` | Rows: `account_id, code, name, type, is_active, balance, balanced`, explained below. |
| `ledger_report_account_detail(p_org uuid, p_account uuid, p_from date, p_to date)` | JSON, explained below. |
| `ledger_report_completeness(p_org uuid)` | JSON: `set_up`, `start_date`, `locked_through`, `invoices_auto_on`, `bills_auto_on`, `waiting` (records in the posting queue), `open_issues` (records held, e.g. VAT details missing), `last_posting_at`, `bank_unmatched` (bank statement lines still unmatched; 0 when none). |

**`ledger_report_balance_sheet`:**
- **Rows:** every asset, liability and equity account with a non-zero balance at the date, signed to its normal side (assets debit-positive; liabilities and equity credit-positive).
- **The PL row:** one row `code = 'PL'`, "Profit for the period (not yet closed to retained earnings)", type equity. It holds income minus expenses up to the date.
- **`balanced`:** assets = liabilities + equity. It is the same on every row.

**`ledger_report_account_detail`:**
- **What it returns:**
  - the account (code, name, type, normal side);
  - `opening_balance` (before `p_from`, signed to the normal side);
  - `rows`: date, journal id, `source_type`, `source_label`, memo, line description, debit, credit, running balance;
  - `total_debit`, `total_credit`, `closing_balance`, `line_count`, `truncated`.
- **Order:** entry date, then the order journals were posted, then line number.
- **Labels:** an automatic journal, or its reversal, carries its posting's label, e.g. the invoice number.
- **Wrong account:** an account that is not the company's gives `LEDGER_NOT_FOUND`, so nothing leaks.

**Ranges:** `p_from` must be on or before `p_to`, and the range at most 5 years: `p_to < p_from + 5 years`, so 2021-01-02 to 2026-01-01 is allowed. Anything else gives `LEDGER_BAD_RANGE`. Profit and loss and account detail accept any range; the screen warns when it starts before the books do.

**Reversals need no special case.** A reversal is its own journal dated on its own date, so a journal and its reversal cancel out in every report. The suite checks this.

## How each figure is computed: a worked example (standard chart)
The figures below are the suite's company A. Its books start on 1 Jan 2026 with opening balances: Bank 1,000.00, Fixed assets 5,000.00, Share capital 6,000.00.

| Date | What happened | Journal (automatic unless "manual") |
|---|---|---|
| 1 Jan | Opening balances | Dr 1200 Bank 1,000.00, Dr 0010 Fixed assets 5,000.00 / Cr 3000 Share capital 6,000.00 |
| 15 Jan | Bank charge, entered on 16 Nov for 15 Jan (manual) | Dr 7900 Bank charges 12.34 / Cr 1200 Bank 12.34 |
| 10 Feb | Invoice A-1 issued, 100.00 + 20.00 VAT | Dr 1100 Debtors 120.00 / Cr 4000 Sales 100.00, Cr 2200 VAT control 20.00 |
| 15 Feb | Bill AB-1 received, 200.00 + 40.00 VAT (Software) | Dr 7700 Software 200.00, Dr 2200 VAT control 40.00 / Cr 2100 Creditors 240.00 |
| 18 Feb | Taxi expense 30.00, no VAT | Dr 7400 Travel 30.00 / Cr 1200 Bank 30.00 |
| 20 Feb | Invoice A-1 paid | Dr 1200 Bank 120.00 / Cr 1100 Debtors 120.00 |
| 1 Mar | Bill AB-1 paid | Dr 2100 Creditors 240.00 / Cr 1200 Bank 240.00 |
| 5 and 6 Mar | Rent 500.00 posted, then reversed (manual) | Dr 7100 / Cr 1200 500.00, then the opposite |

**Profit and loss, 1 Jan to 31 Mar.**
- Sales 100.00, cost of sales 0.00, so gross profit 100.00.
- Overheads: software 200.00 + travel 30.00 + bank charges 12.34 + rent 0.00 (posted and reversed) = 242.34.
- **Net loss −142.34.**

This equals the trial balance's income and expense totals at 31 Mar, because the books start on 1 Jan. The bank charge is in January although it was entered in November.

**Balance sheet at 31 Mar.**
- Fixed assets 5,000.00. Bank 1,000 − 12.34 − 30 + 120 − 240 = 837.66.
- Debtors and creditors are cleared, so they are not listed. VAT control: 20.00 owed − 40.00 to reclaim = −20.00, shown under liabilities as a minus.
- Net assets: 5,837.66 − (−20.00) = 5,857.66.
- Equity: Share capital 6,000.00 + Profit for the period −142.34 = 5,857.66, which agrees.

**Account detail, 1200 Bank, 1 Feb to 31 Mar.**
- Opening 987.66 (the trial balance on 31 Jan).
- Then the lines: taxi −30.00, invoice A-1 +120.00, bill AB-1 −240.00, rent −500.00, reversal +500.00.
- Closing 837.66: the trial balance on 31 Mar.

## On screen (Ledger tab → Reports, `?ledger=reports`)
- **Where:** between Trial balance and Automatic postings. The report, dates and account are in the URL (`report=`, `from=`, `to=`, `as_of=`, `account=`), so refresh and Back keep them.
- **Profit and loss:** From and To dates, with quick choices:
  - This month, Last month, This quarter (calendar quarters);
  - This tax year and Last tax year (6 April to 5 April);
  - Since the books started.

  The layout:
  - Income: Sales (4xxx except 49xx) and Other income (49xx, or any income account outside 4xxx);
  - Cost of sales (expense 5xxx), then Gross profit or Gross loss;
  - Overheads (every other expense account, in code order);
  - Net profit or Net loss for the period.

  A loss is shown with a minus and the word, never colour alone. "Show empty accounts" adds active income and expense accounts with no activity at 0.00.
- **Balance sheet:**
  - "As at" date;
  - Fixed assets (asset accounts with a code below 1000), Current assets, Current liabilities (every liability account), Net assets;
  - Equity, including the "Profit for the period" line, explained in one sentence;
  - "Assets and liabilities agree." or the same support wording the trial balance uses.
- **Account detail:**
  - an account picker (code and name, active and inactive), From and To;
  - an opening balance row, each line with its source ("Invoice payment A-1", "Manual journal", "Reversal", "Opening balance"), a running balance, and closing totals;
  - over 2,000 lines, it asks for a shorter period.
- **Drill-down:** each account in the profit and loss or balance sheet links to its account detail for the same dates. From the balance sheet the dates are the books' start to the as-at date, within 5 years.
- **Completeness notes** from `ledger_report_completeness`, in plain words and never blocking. They appear when:
  - invoices, or bills and expenses, are not posted automatically;
  - records are waiting or held;
  - bank lines are unmatched.

  Each note links to Automatic postings or Bank.
- **Download CSV:**
  - built in the browser from the rows already loaded, with no extra call;
  - UTF-8 BOM, a title line, then "Bookkeeping tool. Not accounting, tax or legal advice.";
  - dd/mm/yyyy dates and plain numbers with two decimals;
  - a text cell starting with `=`, `+`, `-`, `@`, a tab or CR gets a leading apostrophe;
  - file names `profit-and-loss-<from>-to-<to>.csv`, `balance-sheet-<date>.csv`, `account-<code>-<from>-to-<to>.csv`.
- **Print:** the browser's print dialog, with a print stylesheet that shows only the report and the disclaimer. No PDF library.
- **Access:** read only. Members open everything; demo accounts, closed companies and plans behave as the trial balance does (the database decides).

## Assumptions the owner can change
1. **Tax year:** 6 April to 5 April (the UK personal tax year), for the quick choices. A company's own financial year comes with year-end close.
2. **Range limit:** 5 years for profit and loss and account detail.
3. **Row limit:** 2,000 lines per account detail call (the totals still cover the whole range).
4. **The "Profit for the period" line:** there is no year-end close yet, so the balance sheet shows the profit or loss since the books started as one equity line. Once a year-end close exists, past years move into Retained earnings (3200).
5. **Currency:** GBP only.
6. **Report sections by code:**
   - Sales are 4xxx except 49xx; Other income is 49xx or outside 4xxx;
   - Cost of sales is 5xxx; every other expense is an overhead;
   - Fixed assets are codes below 1000.

   These are code ranges and account types, never account names, so accounts a company adds fall into place.
7. **Liabilities:** all are shown as current. The standard chart has no long-term section; 2300 Loans is current until a split is wanted.

## Rollback
`rollback.sql` drops the four functions. It refuses if they are not there. The suite checks that everything else is exactly as before.

## Owner steps
1. **Review** `proposal.sql` and this README.
2. **The owner's assistant re-reads the production facts** above (read-only): the 160-table hash and the function hashes. After your approval, they apply `docs/ledger-reports/proposal.sql` in the Supabase SQL editor. If the guard refuses, stop.
3. **Publish** the front end.
   - Before the SQL is applied, Reports says "Reports are not available yet."
   - No Edge Function changes.

## Later (not in this phase)
- Year-end close (moving profit to retained earnings), and a company's own financial year.
- Comparison with the previous year or period, and budgets.
- Cash-flow statement.
- PDF output, and an accountant pack (reports plus account detail in one download).
- VAT return figures from the ledger.
- Accounts for Companies House.
