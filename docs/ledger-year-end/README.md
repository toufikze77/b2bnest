# Finance phase 5: financial year end (close and lock the year)

**Prepared, not applied.** Nothing here has been run on production. Bookkeeping tool. Not accounting, tax or legal advice.

An owner or admin sets the company's financial year end (a day and a month). Closing a year posts **one balanced
journal**, dated the year end, that moves that year's income and spending to **3200 Retained earnings**. The books are
then **locked** through that date. The most recent closed year can be **re-opened**, which reverses that journal and
moves the lock back.

## Files
- `proposal.sql`: one guarded transaction. It refuses to run if production differs from what it was written against.
- `rollback.sql`: puts everything back exactly. It refuses once any year has been closed.
- `fixture.sql`: nothing extra (production already has everything these tests need).
- `test.sql`: the suite (one transaction, rolled back).
- `run-test.sh`: runs everything on a throwaway local Postgres:
  - production's chain through phase 4 and 3c-2;
  - apply, then an exact empty rollback, then the suite;
  - every earlier ledger suite;
  - rollback refusals and drift refusals.

  Run it with `PG_RUN_USER=postgres bash docs/ledger-year-end/run-test.sh`. It currently gives 145 PASS and no FAIL.
- Front end:
  - `src/lib/ledgerYearEnd.ts` (dates, wording) and `src/components/finance/ledger/LedgerYearEnd.tsx`;
  - small changes to the Ledger tab, Reports, Journals, Trial balance, `ledgerApi.ts`, `ledger.ts` (messages) and `financeTabs.ts`;
  - Vitest: `src/lib/ledgerYearEnd.test.ts` and `src/components/finance/ledger/ledgerYearEnd.test.tsx`.

## The model (no new table)
- **Two new columns:** `ledger_settings.financial_year_end_month` and `financial_year_end_day` (both `smallint`, nullable).
  - There is **no default**: the owner enters the date.
  - The constraint `ls_year_end` allows both null, or a real month and day. 29 February is allowed and means the last day of February: 28 February in other years.
- **The year-end dates:**
  - The first year end is the first one **after** the ledger start date.
  - Each later one is a year after the one before.
  - So the first year can be shorter than 12 months. Example: books from 01/01/2025 with a 31 March year end gives a first year of 01/01/2025 to 31/03/2025 (90 days).
- **A closed year** is any year end on or before `ledger_settings.locked_through`, plus its `year_end` journal (if it had one).
  - No table records closed years.
  - `audit_logs` has a row for every set, close and re-open.
- **New journal type:** `journal_entries.je_source_type` gains `year_end`.

## The close journal
For the year being closed, the close takes each **income and expense account's balance** up to the year end. Earlier
years are already closed to nil, so this is the year's own result.
- An **income** account with a credit balance is **debited** by that balance.
- An **expense** account with a debit balance is **credited** by it.
- The difference goes to **3200 Retained earnings**: a **credit for a profit**, a **debit for a loss**.
- Accounts with no balance are left out.
- The journal itself:
  - source type `year_end`;
  - reason "Year end close <year>", for example "Year end close 2025";
  - memo "Year end close: year ending 31/03/2025";
  - every line's description is the account name.

### Worked example
Books from 01/01/2025, year end 31 March. In the year to 31/03/2025 the company has sales of 180.00 (4000 Sales) and
overheads of 120.50 (8200 Other overheads), so the profit is 59.50. The close journal, dated 31/03/2025:

| Account | Debit | Credit |
|---|---:|---:|
| 4000 Sales | 180.00 | |
| 8200 Other overheads | | 120.50 |
| 3200 Retained earnings | | 59.50 |
| **Totals** | **180.00** | **180.00** |

Then `locked_through` becomes 31/03/2025.

The suite posts exactly this and checks every figure below:
- **Profit and loss** for 01/01/2025 to 31/03/2025 still shows Sales 180.00 and Other overheads 120.50.
- **Balance sheet** at 31/03/2025 shows Retained earnings 59.50 and "Profit for the period" 0.00. Three months later, "Profit for the period" is only the new year's profit.
- **Trial balance** at 31/03/2025 shows Sales and Other overheads at nil and Retained earnings 59.50 credit, and it still balances.

A **loss year** works the other way round. The suite's second year has sales 300.00, rent 400.00 and other income 1.00, a loss of 99.00:
- Sales is debited 300.00;
- Other income is debited 1.00;
- Rent and rates is credited 400.00;
- Retained earnings is **debited** 99.00.

**A year with no income or spending** (decided): it closes without a journal, because there is nothing to move. The lock still moves and an audit row is written. Re-opening it just moves the lock back. The screen says "no journal is posted. Closing only locks the books."

## Rules
**Closing** (`ledger_year_end_close`) is refused when:
- the person is not an owner or admin (`LEDGER_NOT_ADMIN`), is the demo account (`LEDGER_DEMO`), or the company is closed (`LEDGER_CLOSED`);
- the two-step sign-in rule isn't met (`MFA_REQUIRED`, as for every ledger write);
- no year end is set (`LEDGER_YEAR_END_NOT_SET`);
- the date isn't one of the company's year ends, or is before the first one (`LEDGER_YEAR_END_BAD_DATE`). This covers "on or before the start date";
- an earlier year isn't closed (`LEDGER_YEAR_END_OUT_OF_ORDER`): years close in order;
- the year end is in the future (`LEDGER_YEAR_END_FUTURE`);
- something in the year may be missing and `p_acknowledge` is not true (`LEDGER_YEAR_END_NEEDS_ACK`). Three counts can trigger this:
  - **waiting**: invoices, bills or expenses in `ledger_post_queue` whose document date (or paid date) falls in the year;
  - **held**: open `ledger_post_issues` for documents dated in the year;
  - **bank_unmatched**: bank statement lines dated in the year that are still unmatched;
- an inactive income or expense account has a balance (`LEDGER_YEAR_END_INACTIVE_ACCOUNT`). The ledger refuses lines on inactive accounts, so make it active first;
- 3200 Retained earnings is missing or inactive (`LEDGER_YEAR_END_NO_RETAINED_EARNINGS`).

Closing a year that is already closed returns `unchanged`: no journal, no audit row. The close re-checks everything under the per-company advisory lock, whatever the preview said.

**The lock:**
- After a close, any journal dated in the closed year (manual, automatic, bank line or reversal) is refused with the existing `LEDGER_PERIOD_LOCKED`. On screen this reads "That date is in a locked period. Closed years are locked."
- A `year_end` journal can only be written by the close (`LEDGER_YEAR_END_ONLY_BY_CLOSE`).
- It can only be reversed by the re-open (`LEDGER_YEAR_END_REOPEN_ONLY`), so Journals shows no Reverse button for it.

**Re-opening** (`ledger_year_end_reopen`):
- Only the **most recent** closed year can be re-opened (`LEDGER_YEAR_END_NOT_LATEST`; `LEDGER_YEAR_END_NOT_CLOSED` for an open year).
- It moves `locked_through` back to the previous year end, or to none for the first year.
- It then reverses the close journal with the unchanged `ledger_reverse_journal`: a separate `reversal` journal dated the year end, reason "Year end re-opened <year>".
- The reversal is dated the year end, so the balance sheet and trial balance at that date are back to where they were before the close.
- The year can then be closed again with new figures. That posts a new close journal; the old one and its reversal stay, because journals are never deleted.

**Changing the year end** (`ledger_year_end_set`):
- It is allowed only while nothing is locked (`LEDGER_YEAR_END_FIXED`), so re-open every closed year first.
- Setting the same date again returns `unchanged`, with no audit row.

### Why the lock guard changed, and how narrowly
The phase 2 guard on `ledger_settings` refuses any backwards move of `locked_through` (`LEDGER_LOCK_BACKWARDS`). Now it allows one only when the transaction-local setting `ledger.year_end_reopen` names that exact move, as company id, old lock date and new lock date.

Only `ledger_year_end_reopen` sets this flag:
- in the same transaction, after its checks;
- immediately before it reverses that year's close journal;
- and it clears the flag afterwards.

Nothing else can move the lock backwards. The suite checks, as the database owner:
- a plain update;
- a flag for another company;
- a flag naming a different move.

## The functions
New RPCs (all `SECURITY DEFINER`, `search_path ''`, `authenticated` only; not `anon`, `PUBLIC` or `service_role`):

| Function | Who | What |
|---|---|---|
| `ledger_year_end_status(p_org)` | members | settings, closed years (dates, journal, profit or loss), the next year end and its start, `can_close_now`, `can_manage` |
| `ledger_year_end_set(p_org, p_month, p_day)` | owner/admin | set or change the year end (only while nothing is locked) |
| `ledger_year_end_preview(p_org, p_year_end)` | members | the exact lines, profit, lock date, warnings, `needs_acknowledgement`, and `problem` (why it can't close now) |
| `ledger_year_end_close(p_org, p_year_end, p_acknowledge DEFAULT false)` | owner/admin | as above |
| `ledger_year_end_reopen(p_org, p_year_end)` | owner/admin | as above |

The internal helpers (`_ledger_ye_date`, `_ledger_ye_first`, `_ledger_ye_next`, `_ledger_ye_lines`, `_ledger_ye_warnings`) and the trigger function `_ledger_year_end_entry_guard` are executable by nobody. The new trigger is `ledger_year_end_guard`, `BEFORE INSERT ON journal_entries`.

The preview and the close both build their lines from `_ledger_ye_lines`; the suite checks that the posted journal equals the preview line for line.

### Existing objects replaced or changed (and why)
| Object | Change | Production md5 (the guard) |
|---|---|---|
| `_ledger_settings_guard()` (phase 2) | The lock may move back only inside the re-open (above). The year end may not change while locked. All else unchanged. | `cb0e157fa5a50c502488b2284bf751bb` |
| `ledger_report_profit_loss(uuid,date,date)` (phase 4) | Leaves out `year_end` journals and their reversals, so a closed year keeps its real figures. | `454e361e260262a419ced37829cef745` |
| `journal_entries.je_source_type` | + `year_end` | its exact definition |
| `ledger_settings` | + 2 columns and `ls_year_end` | its exact column list |
| `journal_entries` triggers | + `ledger_year_end_guard` | the exact trigger list |

**Not replaced**, although the brief expected the balance sheet would need it:
- **`ledger_report_balance_sheet`** already sums every journal up to the date, the close included.
  - After a close, the income and expense accounts are nil at the year end, and the closed result sits in 3200.
  - So its "Profit for the period" row already covers only the open year: the profit since the last closed year end.
  - The suite proves it at the year end, three months after, after a loss year, and after a re-open.
  - Replacing it would add risk for no change in output, so its body is only guarded (md5 `8f77d74be234303e6e3d18cbd174df6a`).
  - Its row label "Profit for the period (not yet closed to retained earnings)" stays accurate. The on-screen explanation under it now says "since the last closed year end, or since your books started".
- **`ledger_trial_balance`** is unchanged, as the brief asked. After a close it correctly shows the close journal; the screen now says so.
- **`ledger_reverse_journal`** is unchanged, and the re-open calls it.

## Production facts the guard checks (read read-only on 22 Nov 2026, PostgreSQL 17.12)
- **Tables:** 160 tables in `public`, `md5(string_agg(relname, ',' ORDER BY relname))` = `b9fec97b9d0d8c836c6af78125e92371`.
- **Function bodies:** the md5 of each function body is accepted in three forms: raw, without whole-line comments, or without any `--` comment.
  - `_ledger_settings_guard` `cb0e157fa5a50c502488b2284bf751bb`
  - `ledger_report_profit_loss` `454e361e260262a419ced37829cef745`
  - `ledger_report_balance_sheet` `8f77d74be234303e6e3d18cbd174df6a`
  - `ledger_trial_balance` `5a165b9517c73e03556e9e5aab72c95e`
  - `ledger_reverse_journal` `22157acb97b8b8cb3ade3318177353b9`
  - `_ledger_post` `019a0b8e74b6d142e5623b09f7de27d6`
  - `_ledger_entry_guard` `727748e665991e8105a96e15f7f9929c`
  - `_ledger_line_guard` `041398b1d1ecbd5856c7cab85aff8479`
  - `_ledger_balance_check` `ee84f8fd18cb93fcd9fa1dfbd6aa36e7`
  - `_ledger_append_only` `f47e341b7cca2f0118e8e70493984e56`
  - `_ledger_rule` `edf2117e8b0bdeb3826552b712faa227`
  - `_ledger_require_writer` `75ecf4a981581daae33e90dc554f01c4`
  - `require_aal2_if_enrolled` `10b2ae7bd2f9a94ea20598f19b8aebf2`
  - `ledger_report_completeness` `6d8cf9d49296fec90687f3ad0fb95acf`
  - `_ledger_bank_guard` `b6def894d0a6f851870b47f642268f3e`
- **Constraints:** `je_source_type`, `je_reversal` and `ls_locked_through`, each exactly as `pg_get_constraintdef` shows it today.
- **`ledger_settings` columns** (sorted): `base_currency:text`, `created_at:timestamptz`, `created_by:uuid`, `locked_through:date`, `opening_mode:text`, `organization_id:uuid`, `start_date:date`.
- **Triggers on `journal_entries`:**
  - `a0_demo_readonly_guard`
  - `data_rights_closed_company`
  - `ledger_append_only`
  - `ledger_balanced`
  - `ledger_entry_guard`
  - `ledger_no_truncate`

  The trigger `ledger_settings_guard` on `ledger_settings` uses `_ledger_settings_guard()`.

## On screen (Ledger → Year end, after Reports)
- **Everyone in the company** can read it:
  - the year end, or "Not set yet. There is no default";
  - the closed years, with their profit or loss;
  - the next year end, and its preview.
- **Owners and admins** also get:
  - **The year end:** Day and Month pickers. February offers 29 days. Before saving, the screen says how long the first year would be.
  - **Preview the close:** the close journal as a table, the profit or loss, and anything that stops the close.
  - **Warnings:** one box per warning, shown only when there is a warning.
  - **Confirmation:** "This locks the books through 31/03/2027. You can re-open the most recent year." **Close year** works only once the confirmation and every warning box are ticked.
  - **Re-open year:** on the latest closed year only, with a confirm that says where the lock goes back to.
- **Reports, Profit and loss:** "This financial year" and "Last financial year" appear once a year end is set. They are worked out from the company's year end; the tax-year choices stay.
- **Balance sheet:** the explanation of "Profit for the period" now mentions the last closed year end.
- **Journals:** the close shows as "Year end close", with no Reverse button.
- **Trial balance:** a note says it includes the close journal.
- **Messages:** a locked date reads "That date is in a locked period. Closed years are locked."
- **Before the SQL is applied:** the Year end section says "Year end is not available yet." and Reports shows no financial-year choices. Everything else is unchanged.
- `src/integrations/supabase/types.ts` is not edited. As in earlier ledger PRs, the calls go through `ledgerApi.ts` with their own types.

## Assumptions the owner can change
- **The first year runs from the start date to the first year end after it**, so it is at most 12 months.
  - A **longer** first period (UK companies can have up to 18 months) is not offered: `ledger_year_end_set` takes only a day and month, as specified.
  - If you need it, add an optional "first year end" to the setting later.
- **A year with no income or spending closes without a journal.** Alternative: refuse it.
- **Warnings count documents by their own date:**
  - invoices: tax point, else created date; paid date for a held payment;
  - bills: tax point, else issue date; paid date for a held payment;
  - expenses: tax point, else date.
- **Inactive accounts with a balance block the close.** Alternative: the close could post to them as a reversal does.
- **Members can preview;** only owners and admins act.
- **Re-open dates its reversal on the year end**, not today, so the year's balances return exactly.

## Rollback
`rollback.sql` refuses:
- if phase 5 is not applied;
- once **any `year_end` journal exists**, even one that was re-opened. Journals are never deleted, so the type must stay;
- once **any year was closed without a journal**, as `audit_logs` shows.

Otherwise it puts the phase 2 guard, the phase 4 profit and loss and `je_source_type` back exactly, and drops the trigger, the functions and the two columns. A year end that was set but never used goes with its columns. The suite checks an exact empty rollback and each refusal.

## Owner steps
1. **Review** `proposal.sql` and this README.
2. **The owner's assistant re-reads the production facts** above (read-only), and after your approval applies `docs/ledger-year-end/proposal.sql` in the Supabase SQL editor. If the guard refuses, stop.
3. **Publish** the front end. No Edge Function changes.

## Still later
- corporation tax;
- accounts filing;
- dividends;
- prior-year comparatives in reports;
- more than one year-end date per company (a changed accounting reference date);
- a longer first period;
- a screen to lock part of a year.
