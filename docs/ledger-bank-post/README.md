# Finance phase 3c-2: post unmatched bank statement lines to the ledger

**Status: prepared, NOT applied.** Nothing here has been run against production.

Bookkeeping tool. Not accounting, tax or legal advice.

Phase 3c-1 imports a bank statement and matches each line to a payment the ledger already holds. Some lines match nothing: bank fees, interest, transfers, owner loans, money in or out with no invoice.

**What 3c-2 adds:** a manager can **post** such a line to the ledger, as one balanced two-line journal against one counter account they choose, so the ledger bank balance can agree with the statement.

**Safety rules:**
- This is the first bank feature that writes to the ledger.
- Nothing is ever posted automatically; a person confirms every line.
- A posted line can be undone: its journal is reversed by a separate reversal journal. Nothing is deleted or edited.

## Files
| File | What |
|---|---|
| `proposal.sql` | The change, in one transaction, with a guard (below). The five replaced 3c-1 functions are the 3c-1 text with small, marked edits. |
| `rollback.sql` | Puts 3c-1 back exactly: the constraints, the five function bodies, and drops the new columns and functions. Refuses in two cases (below). |
| `fixture.sql` | Local only. Nothing beyond the production chain. |
| `test.sql` | The suite: one transaction, rolled back. |
| `run-test.sh` | Builds production (through 3c-1 and phase 4) on a throwaway Postgres, then applies, tests, rolls back and checks drift. |

Run it with `PG_RUN_USER=postgres bash docs/ledger-bank-post/run-test.sh`.

## The model (no new table)
- **`journal_entries.je_source_type`** gains `'bank_line'`. Every existing value is kept, and nothing else on the table changes.
- **A bank-line journal:**
  - `source_type = 'bank_line'`, `source_id` = the bank line's id;
  - `reason` "Bank statement line", memo "Bank: <the line's description>", dated the line's date;
  - `posted_by` = the person, and `posted_by_name` their display name, recorded the way `_ledger_post` records it for manual journals. So the Journals screen shows the person, like manual journals and their reversals, never "Automatic posting".
- **`ledger_bank_lines`:**
  - `lbl_status` gains `'posted'`;
  - new nullable columns: `posted_entry_id` (foreign key to `journal_entries`, unique), `posted_account_id` (foreign key to `ledger_accounts`), `posted_by` (an opaque id, like `matched_by`) and `posted_at`;
  - `lbl_state`: `posted` requires the journal, the account and the time, and every match and ignore field empty. Every other status requires the `posted_*` fields empty.

  Existing rows (6 in production, on the test company) are unmatched, matched or ignored, so the new columns start empty and the checks hold.
- **`_ledger_bank_guard`:** the `posted_*` columns are added to the fields that may change. Nothing else: date, amount, description, balance, reference, hash and row number still never change. INSERT is still only `unmatched`; DELETE and TRUNCATE are unchanged. A posted line must name its own bank-line journal (`source_id` = the line) and an account of the same company, even when written directly.

## How a line is posted
| Line | Journal (two lines, dated the line's date) |
|---|---|
| Money out (negative amount) | Dr counter account, Cr Bank |
| Money in (positive amount) | Dr Bank, Cr counter account |

Bank is the bank account's `ledger_account_id` (1200, system key `bank`). There is **no VAT split** in v1: bank fees and interest are normally exempt. Anything that needs VAT stays an invoice, bill or expense, or a manual journal. The screen says "No VAT is added here."

**How the journal is written.**
- It is written the way `_ledger_auto_journal` writes an automatic journal, because that is the existing path that records `source_id`; `_ledger_post` has no source parameter.
- Nothing is duplicated: the ledger's own triggers still check the start date, the period lock, one company and active accounts, and the deferred balanced-at-commit trigger still runs (`SET CONSTRAINTS … IMMEDIATE` then `DEFERRED`, as `_ledger_auto_journal` does).

**Worked example: the £5.50 monthly fee.**
1. The statement shows 3 Mar, "MONTHLY ACCOUNT FEE", −£5.50, balance £994.50. The ledger has £1,000.00 in the bank (opening balance), so the summary shows a difference of −£5.50.
2. The manager presses **Post to ledger**. The panel suggests 7900 Bank charges ("Suggested from the description") and shows "Money out £5.50: Bank charges (7900) debit, Bank credit".
3. Post creates the journal: Dr 7900 Bank charges 5.50 / Cr 1200 Bank 5.50, dated 3 Mar.
4. The ledger bank balance is now £994.50, and the **difference reads £0.00**.
5. Profit and loss shows Bank charges £5.50, the balance sheet still balances, and the completeness check's `bank_unmatched` drops by one.

## Rules
- **Which lines:** only an `unmatched` line can be posted.
  - An ignored line gives `LEDGER_BANK_IGNORED` (un-ignore it first).
  - A matched line gives `LEDGER_BANK_ALREADY_MATCHED`.
  - A posted line again: with the same account the answer is `unchanged`; with another account, `LEDGER_BANK_ALREADY_POSTED`.
- **Which counter accounts:** any active account of the company except:
  - the bank account itself;
  - the accounts driven elsewhere: `debtors`, `creditors`, `vat_control`, `paye_ni`, `corporation_tax`.

  These give `LEDGER_BANK_ACCOUNT_NOT_ALLOWED`, and the screen says "Use a manual journal for this". Allowed examples: 7900 Bank charges, 4900 Other income, 8200 Other overheads, 2310 Directors' loan account, 3000 Share capital, 2300 Loans, 1210 Cash, or any account the company added. The screen also says: "Expenses and invoices posted there match your bank lines automatically."
- **Dates:** the ledger's own rules apply. A line before the ledger start date gives `LEDGER_BEFORE_START`; a line within `locked_through` gives `LEDGER_PERIOD_LOCKED`.
- **Who:** only the ledger's managers (`_ledger_require_writer`: the MFA rule, the plan, the demo account, closed companies), under the company's advisory lock. Members read.
- **Audit:** one `audit_logs` row per real change:
  - `ledger.bank_post`, resource type `bank_statement_line`, details: line id, `amount_pence`, account code, entry id;
  - `ledger.bank_unpost`.

  No description text is copied.

## The functions
| Function | What |
|---|---|
| `ledger_bank_post(p_org, p_line, p_account, p_idempotency_key DEFAULT NULL)` | Posts one line. The optional key is stored on the journal; a key already used is refused (`LEDGER_BANK_KEY_USED`). |
| `ledger_bank_post_many(p_org, p_account, p_lines uuid[])` | The same rules for up to 50 distinct lines, one account, all or nothing. Returns `posted`, `unchanged` and the entry ids. |
| `ledger_bank_unpost(p_org, p_line)` | Only for a `posted` line (otherwise `LEDGER_BANK_NOT_POSTED`). Reverses the journal with the unchanged `ledger_reverse_journal`, then returns the line to `unmatched` with every `posted_*` field cleared. |
| `_ledger_bank_post_line`, `_ledger_bank_allowed_account` | Internal (no grants). |

**How `ledger_bank_unpost` dates the reversal:** on the line's date, unless that date is before the ledger start or locked; then it is dated today, and the result says which (`reversal_dated`). If the journal was already reversed on the Journals screen, it is not reversed again (`how: already_reversed`, and the audit row says so).

**Replaced phase 3c-1 functions:** same signatures and grants, re-checked after replacing.

| Function | Change |
|---|---|
| `_ledger_bank_guard` | As above. |
| `_ledger_bank_match_run` | First, every posted line whose journal was reversed on the Journals screen goes back to `unmatched`, with a `ledger.bank_unpost` audit row (reason `journal_reversed`). It then matches as before, only ever touching `unmatched` lines. |
| `ledger_bank_match`, `ledger_bank_ignore` | Refuse a posted line (`LEDGER_BANK_ALREADY_POSTED`). |
| `ledger_bank_overview` | Adds: the posted count, the posted list (account code and name, journal id, date, amount), and `post_broken` lines under Needs attention next to `match_broken`. The reconciliation summary is unchanged. |

**A posted journal reversed elsewhere.** This was the main risk. If someone reverses a bank-line journal on the Journals screen:
- **Nothing silent:** the line is not left posted. The overview shows it under **Needs attention** (`post_broken`).
- **Fixing it:** the next match run returns it to unmatched (no second reversal), or the manager presses "Back to Unmatched".
- **Tests:** both paths are tested, as are un-posting after such a reversal, and posting again afterwards.

`ledger_report_completeness` (phase 4) is unchanged. It counts `status = 'unmatched'`, so a posted line is no longer counted (tested).

## Production facts the guard checks (read read-only on 17 Nov 2026)
- **The table set:** exactly **160 tables**, with md5 of the sorted names joined with commas = `b9fec97b9d0d8c836c6af78125e92371`. No table is added.
- **Constraints:** `je_source_type`, `je_reversal`, `lbl_status` and `lbl_state` exactly as production has them. The types of the `journal_entries` columns used are checked too.
- **Replaced function bodies** (the 3c-1 bodies as production stores them):

  | Function | Old hash |
  |---|---|
  | `_ledger_bank_guard()` | `81d91fd52972bbfc89479f1c5beb16af` (production stores it without whole-line comments) |
  | `_ledger_bank_match_run(uuid,uuid)` | `ed3fb594c45a3d9cf42d911e7422f4ea` |
  | `ledger_bank_match(uuid,uuid,uuid)` | `a0149562bed66a17bec6d12bdb384a5b` |
  | `ledger_bank_ignore(uuid,uuid,text)` | `c5e5f59fed8085bf214f68e8df2da433` |
  | `ledger_bank_overview(uuid,uuid,date,integer)` | `b8571c12cddb23ebe25dddb554a336ee` |

- **Functions called or relied on, unchanged:**
  - `_ledger_rule` `edf2117e…`, `_ledger_require_writer` `75ecf4a9…`, `_ledger_org_open` `36107757…`, `require_aal2_if_enrolled` `10b2ae7b…`;
  - `ledger_reverse_journal` `22157acb…`, `_ledger_post` `019a0b8e…` (comment-stripped form);
  - `_ledger_entry_guard` `727748e6…`, `_ledger_line_guard` `041398b1…`, `_ledger_balance_check` `ee84f8fd…`, `_ledger_append_only` `f47e341b…`;
  - `_ledger_bank_audit` `3d0ebe1c…`, `_ledger_bank_open_payments` `48024e02…`, `_ledger_bank_posting_pence` `2a4e1151…`;
  - `ledger_bank_match_run` `33a0fcbc…`, `ledger_bank_unmatch` `475f35dc…`, `ledger_bank_unignore` `71d86e85…`;
  - `ledger_report_completeness` `6d8cf9d4…`;
  - `demo_readonly_guard`, `_data_rights_gate_is_open`, `_data_rights_closed_company_guard`.

  All of these were read from production on 17 Nov 2026.
- **Second apply** is refused ("already exists").
- **Nothing else changes:** the suite compares every other function, constraint, column, trigger, policy, table grant and RLS flag before and after.

## On screen (Ledger → Bank)
- **The top note:** "Importing and matching never change your ledger. Posting a line you choose does, and you can undo it."
- **Post to ledger** on each unmatched line opens a panel with:
  - the effect in plain words ("Money out £5.50: Bank charges (7900) debit, Bank credit");
  - an account picker (code and name, allowed accounts only, search by typing);
  - the suggestion pre-selected with "Suggested from the description";
  - the hints about Expenses and invoices, "No VAT is added here", and the blocked accounts.

  After posting: "Posted. Your ledger bank balance now includes this line.", and the summary refreshes.
- **Post selected:** tick up to 50 unmatched lines, choose one account, and see the lines and their total before posting.
- **Tabs:** Unmatched, Matched, Ignored, **Posted**, Needs attention. Posted shows each line's account and an **Undo**, which first confirms: "This reverses the journal. Nothing is deleted."
- **Access:** managers act; members read. Demo and closed companies behave as on the other ledger screens. MFA_REQUIRED shows the usual message. One call at a time (no double submit).
- **Journals screen:** a bank-line journal shows as "Bank statement line". Phase 4's account detail labels it the same way.

## Assumptions the owner can change
1. **Blocked counter accounts:** the bank account, debtors, creditors, VAT control, PAYE and NI, and Corporation Tax. Everything else active is allowed.
2. **VAT:** none on bank lines in v1.
3. **Bulk limit:** at most 50 lines per "Post selected".
4. **Suggestions** (`src/lib/ledgerBankPost.ts`, unit-tested; looked up by code in the company's own chart, never assumed):
   - fee, charge or commission → 7900 Bank charges;
   - interest, money in → 4900 Other income;
   - interest, money out → 8200 Other overheads;
   - transfer, tfr or own account → no suggestion;
   - anything else → no suggestion.
5. **Reversal date:** the line's date, or today when that date is before the books start or locked.
6. **The journal's memo:** "Bank: " plus the line's description (cut to 200 characters).

## Rollback
`rollback.sql` refuses:
- if 3c-2 is not applied;
- while **any line is posted** ("un-post them first");
- once **any bank-line journal exists**, even one that was un-posted. Journals are never deleted, so the `bank_line` journal type must then stay; in that case leave 3c-2 in place.

Otherwise it puts the 3c-1 constraints and the five 3c-1 function bodies back exactly, and drops the new columns and functions. The suite checks every refusal and the exact restore.

## Owner steps
1. **Review** `proposal.sql` and this README.
2. **The owner's assistant re-reads the production facts** above (read-only), and after your approval applies `docs/ledger-bank-post/proposal.sql` in the Supabase SQL editor. If the guard refuses, stop.
3. **Publish** the front end.
   - Before the SQL is applied, the Bank screen looks exactly as it does now. The Post buttons, the checkboxes and the Posted tab appear only once the overview reports posted lines, which only the 3c-2 overview does.
   - No Edge Function changes.

## Still later
- Rules that post automatically, for example every "MONTHLY ACCOUNT FEE" to Bank charges.
- VAT on bank lines.
- Splitting one line across several accounts.
- Transfers between two of the company's own bank accounts (one line on each statement, one journal).
- A live bank feed.
