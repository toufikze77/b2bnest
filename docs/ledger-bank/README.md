# Finance phase 3c-1: bank statement import and matching

**Status: prepared, NOT applied.** Nothing here has been run against production.

Bookkeeping tool. Not accounting, tax or legal advice.

A company imports its bank statement as a CSV file. Each statement line is then **matched** to a payment the ledger already holds. Phases 3a and 3b already post these payments to the Bank account (1200, system key `bank`):

| Payment | Ledger posting kind | Direction |
|---|---|---|
| An invoice paid | `invoice_paid` | money in |
| A bill paid | `bill_paid` | money out |
| An approved or paid expense | `expense` | money out |

**3c-1 posts nothing:**
- no journal, no posting;
- no change to any existing table, trigger or function.

So nothing can be counted twice. Lines that match nothing stay "unmatched" until 3c-2 (below) lets them be posted.

The old per-user `bank_accounts` / `bank_transactions` tables are left alone. They hold the "Demo Bank (sample data)" and an empty account. They are not changed, and nothing new reads them (the suite checks this).

## Files
| File | What |
|---|---|
| `proposal.sql` | The change, in one transaction. A guard refuses it unless production matches the facts below. |
| `rollback.sql` | Drops the new functions and tables. Refuses while any statement line exists, and says why. |
| `fixture.sql` | Local only. Nothing beyond the production chain. |
| `test.sql` | The local suite: one transaction, rolled back. |
| `run-test.sh` | Builds the production chain on a throwaway Postgres, then applies, tests, rolls back and checks drift. |

Run it with `PG_RUN_USER=postgres bash docs/ledger-bank/run-test.sh`.

## Production facts the guard checks (read read-only on 15 Nov 2026)
- **The table set:** 157 tables in `public`, md5 of the sorted names `e8b4d718206034884fa5766884b831d5`. After applying there are **160**: the three below are added. The suite checks this.
- **`ledger_postings.lp_kind`:** exactly as phase 3b left it: `invoice_issued`, `invoice_paid`, `bill_received`, `bill_paid`, `expense`.
- **Columns read:** the types of the columns this reads, in `ledger_postings`, `journal_entries`, `journal_lines` (`numeric(14,2)`), `ledger_accounts` and `audit_logs`.
- **Function bodies.** Each `md5(prosrc)` is accepted raw, without whole-line comments, or without any comment. All 13 were confirmed against production on 15 Nov 2026:

  | Function | Hash |
  |---|---|
  | `_ledger_rule(uuid,uuid)` | `edf2117e8b0bdeb3826552b712faa227` |
  | `_ledger_org_open(uuid)` | `361077573d6cc7f9c83c6702808d61cd` |
  | `_ledger_require_writer(uuid)` | `75ecf4a981581daae33e90dc554f01c4` |
  | `require_aal2_if_enrolled()` | `10b2ae7bd2f9a94ea20598f19b8aebf2` |
  | `user_is_organization_member(uuid,uuid)` | `1fb55538d44b2451875f8baf1b6e4388` |
  | `demo_readonly_guard()` | `087b5fe2695b95b8ba2ba6eb195ba995` |
  | `_data_rights_gate_is_open(text)` | `b22b22eda6bd86e8ff363a6a58bfe3a3` |
  | `_data_rights_closed_company_guard()` | `2ec2d8630e284aed65d010c61a442a53` |
  | `_data_rights_company_tables()` | `c4497fd5fa0245618d1168f9c19bffe1` |
  | `mfa_ok()` | `20516f2e…` or `c6fd9b98…` |
  | `hmrc_manage_allowed(uuid,uuid)` | `9304f069…` or `80190851…` |
  | `_data_rights_close_org(uuid,uuid)` | `b0c5e82f…` or `6c379a1d…` |
  | `data_rights_delete_account(uuid,uuid,boolean)` | `b1922b79…` or `4492cbbb…` |

- **A second apply is refused** ("already exist (applied twice?)").
- **Nothing existing is replaced.** The suite checks that every existing function body is identical after applying, and that no trigger was added to an existing table.

## Data model (three new tables)
All three tables:
- carry `organization_id`;
- have RLS on: members read; MFA is required (the restrictive `require_aal2_if_enrolled` policy); closed companies are hidden;
- grant `SELECT` only, never `INSERT`, `UPDATE` or `DELETE`, to `authenticated`; `anon` has nothing;
- have the `a0_demo_readonly_guard` and `data_rights_closed_company` triggers;
- have a `ledger_bank_guard` trigger that keeps them append-only in spirit.

People are stored as opaque ids with no foreign key (`created_by`, `imported_by`, `matched_by`), like `ledger_settings.created_by`.

| Table | Holds |
|---|---|
| `ledger_bank_accounts` | `name` (1–80, unique per company in any case), `last4` (four digits or empty, **never** a full account number or sort code), `currency` = GBP, `ledger_account_id` (v1: always the company's Bank account; the guard trigger checks it), `is_active`. At most 10 per company. |
| `ledger_bank_imports` | One row per import call: `file_name` (trimmed, at most 120 characters, for display only), `file_hash` (md5 of the normalised rows), `row_count`, `first_date`, `last_date`, `newest_first` (the file's order), `imported_by`. **No file is stored.** |
| `ledger_bank_lines` | `line_date`, `description` (1–500), `amount_pence` (signed bigint: money in positive, out negative, never 0), `balance_pence` (optional), `external_ref` (optional), `row_no` (position in the file), `dedupe_hash`, `status` (`unmatched` / `matched` / `ignored`), `matched_posting_id` (FK to `ledger_postings`), `match_kind` (`auto` / `manual`), `matched_by`, `matched_at`, `ignore_reason` (`not_business` / `handle_later`). |

Constraints on the lines:
- **Duplicates:** unique `(bank_account_id, dedupe_hash)`, so an overlapping statement skips lines already imported.
- **One line per payment:** a unique partial index on `matched_posting_id`, so a payment is matched by at most one line.
- **Consistent state:** a CHECK (`lbl_state`) makes the status and the match fields agree. A matched line must name its payment; an ignored line must have a reason.
- **Same company:** composite foreign keys keep a line, its import and its bank account in one company. The guard trigger checks that a matched payment is the same company's, and that it is a payment.

Changes after import:
- No `DELETE`, ever, except by a company close, through the P7b gate. No `TRUNCATE`.
- An import is never edited. A line's date, amount, description, balance and reference never change. Only the status, match and ignore fields change, and only through the RPCs.
- 3c-2 will add `posted` to the status list. Nothing else in 3c-1 has to change for that.

**Audit.** Every real change writes one `audit_logs` row. Repeating an action that changes nothing writes none. The suite checks this.
- **The actions:** `ledger.bank_import`, `ledger.bank_match`, `ledger.bank_unmatch`, `ledger.bank_ignore`, `ledger.bank_unignore` (an extra action, added for un-ignoring), `ledger.bank_account_create` and `ledger.bank_account_update`.
- **Contents:** each row holds the company, the bank account, the payment and the counts. It never copies a statement description.

## The RPCs
All the RPCs are:
- SECURITY DEFINER with `search_path = ''`;
- callable by `authenticated` and `service_role`, never `anon`;
- writers only for the ledger's managers (`_ledger_require_writer`: the MFA rule, the plan, the demo account and closed companies);
- under the company's advisory lock on every write (`hashtextextended('ledger:'||org, 0)`).

| RPC | What |
|---|---|
| `ledger_bank_account_save(p_org, p_id, p_name, p_last4, p_active)` | Create (`p_id` null) or update the name, last 4 or active flag. Needs the ledger set up. |
| `ledger_bank_import(p_org, p_bank_account, p_file_name, p_rows)` | See "Importing" below. |
| `ledger_bank_match_run(p_org, p_bank_account)` | Re-links broken matches, then auto-matches (rules below). |
| `ledger_bank_match(p_org, p_line, p_posting)` | Manual match. |
| `ledger_bank_unmatch(p_org, p_line)` | Undo a match (also for a broken one). |
| `ledger_bank_ignore(p_org, p_line, p_reason)` | `not_business` or `handle_later`. Ignored lines stay visible, never hidden. |
| `ledger_bank_unignore(p_org, p_line)` | Back to unmatched. |
| `ledger_bank_overview(p_org, p_bank_account, p_as_at, p_page)` | Read only, described below. |

**Importing (`ledger_bank_import`).**
- **Rows:** `p_rows` is an array of `{date 'YYYY-MM-DD', description, amount_pence, balance_pence?, ref?, seq?}`, at most 2,000 per call.
- **All or nothing:** every row is checked in the database. The checks:
  - a real date between 1 Jan 2000 and tomorrow;
  - whole pence, not zero;
  - the lengths of the text fields;
  - JSON types: a text amount is refused.

  If any row fails, nothing is stored. The answer lists the rows and reasons, and no audit row is written.
- **Duplicates:** rows already imported are skipped and counted.
- **Answer:** `imported`, `skipped_duplicates`, `rejected`, `problems`, and `imported_before` (the same `file_hash` was imported to this account before). The matcher then runs on the new lines.

**The overview (`ledger_bank_overview`).**
- **Who can read it:** members of the company (`ok` and `not_admin`), and the demo account for its own company only. `_ledger_rule` answers `demo` before checking membership, so the overview checks membership itself.
- **What it returns:**
  - the bank accounts, and counts of unmatched, matched, ignored and needs-attention lines;
  - the unmatched lines, in pages of 200, each with up to 3 suggestions;
  - the matched lines, the ignored lines, and the needs-attention lines;
  - the ledger payments not matched by any line, within the dates the imports cover;
  - the last 20 imports;
  - the reconciliation summary (described further down).

## Matching rules
A **payment** is a live posting (`reversed_at IS NULL`) of the company, of kind `invoice_paid`, `bill_paid` or `expense`, that no line has matched yet.

**How a payment's amount is read.** The amount comes from its journal lines on the Bank account, in signed pence (debit = money in). No other column is trusted. An invoice payment must be money in; a bill payment or an expense must be money out.

**Automatic** (on import, and on "Match again"). A line is matched only when:
- exactly one payment has the **same signed amount** within **7 calendar days**, AND
- that payment fits no other unmatched line of the company.

Anything else is left for a person, and the screen shows the suggestions.

**By hand.** The same amount and direction, up to **31 days** apart. It is refused if:
- the line or the payment is already matched;
- the line is ignored;
- the payment was reversed;
- the payment is another company's, or not a payment.

Never across companies.

Examples (from the suite):

| Statement line | Ledger | Result |
|---|---|---|
| 6 Mar, +£120.00 | Invoice A-1 paid 5 Mar, £120.00 | matched automatically (1 day apart) |
| 9 Mar, −£240.00 | Bill AB-1 paid 8 Mar, £240.00 | matched automatically |
| 11 Mar, +£50.00 | Invoices A-2 (10 Mar) and A-3 (12 Mar), £50.00 each | left unmatched, with both as suggestions |
| Two lines on 15 Mar, −£30.00 each | One taxi expense, 15 Mar, £30.00 | both left unmatched: one payment fits two lines |
| 20 Mar, +£75.00 | Invoice A-4 paid 1 Mar | not automatic (19 days); allowed by hand |
| 1 Mar, +£99.99 | Invoice A-5 paid 25 Jan | refused even by hand (35 days) |
| 6 Mar, −£120.00 | Invoice A-1, +£120.00 | no match: wrong direction |
| Company B, 6 Mar, +£120.00 | B's own invoice B-1 | matched to B's payment only, never A's |

**A matched payment is reversed later.** This was the main risk. For example, an invoice's paid date changes, and phase 3a reverses its payment journal and posts a new one.
- **Nothing silent:** the line keeps pointing at the reversed posting. The overview shows it under **Needs attention** (`match_broken`), never as matched.
- **The next match run** (on import, or "Match again"):
  - clears every such link (one `ledger.bank_unmatch` audit row each, with reason `posting_reversed` and the old payment's id);
  - then matches as usual, so the line re-matches the reposted payment when it qualifies;
  - when the invoice is simply unpaid again, the line stays unmatched.
- **Nothing on existing tables:** this check lives in the match run and the overview, not in a trigger on `ledger_postings`. A failing trigger there could break the 3a/3b posting engine, so none was added.

Both paths are tested: reversed and reposted, then re-matched; reversed only, then unmatched.

**Duplicates.**
- `dedupe_hash` = md5 of: the bank account, the date, the amount, the normalised description (trimmed, single spaces), the reference, and the occurrence number among identical rows in the same file.
- So two genuine identical payments in one file are both kept, and a re-import or an overlapping statement skips what is already there.
- **Files sent in parts:** the browser sends a file in parts of 500 rows, and numbers identical rows across the whole file (`seq`). The parts therefore agree with one another, and with a later re-import of the whole file.

## Reconciliation summary
- **Ledger bank balance as at the date:** the sum of the journal lines on the Bank account up to that date. This is the trial balance's logic, so opening balances are included. The suite checks it equals the trial balance's 1200 figure on two dates.
- **Statement balance:**
  - the latest line balance on or before the date;
  - within one day, the latest row by the file's order (`newest_first`);
  - shown only when the lines carry balances.
- **Difference** = statement balance − ledger balance. The plain wording on screen: "The difference includes anything not yet imported or not yet in the ledger, for example bank fees, interest, or a payment recorded on another date."
- **Several bank accounts:** if they share the one ledger Bank account (v1), the screen says the ledger balance covers all of them.

## Front end (Ledger tab → Bank, `?ledger=bank`)
- **Code:**
  - `LedgerBank.tsx`: accounts, the summary, the review tabs;
  - `LedgerBankImport.tsx`: the import;
  - `src/lib/bankCsv.ts`: the parser, pure functions;
  - `src/lib/ledgerBank.ts`: types and wording;
  - wrappers in `src/lib/ledgerApi.ts`, and messages in `src/lib/ledger.ts`.
- **Who sees what:** members read everything. Only managers see Add bank account, Import, Match, Ignore, Unmatch, Un-ignore and Match again.
- **Calls:** one call at a time, and a second click is ignored. `MFA_REQUIRED` shows "Confirm with your authenticator app, then try again." and starts the app's step-up, as elsewhere.
- **The file:**
  - It is read in the browser. Only each line's date, description, amount, balance and reference are sent; the file itself is never uploaded.
  - The parser handles quotes, commas and newlines in fields, a BOM, CRLF, and comma, semicolon or tab separators.
  - Dates are read in UK order (`01/03/2026` is 1 March), plus ISO dates and forms like `1 Mar 2026`.
  - Amounts may have £, thousands separators, brackets for negative, a trailing minus, or CR/DR. The pence come from the text, never a float.
  - A header row below an account summary is found.
- **Mapping:** columns are detected automatically, with one Amount column or Money in / Money out columns. A person can change them.
- **Preview:** the first 10 rows, totals, and warnings. Unreadable rows and out-of-range dates are listed by line and left out; zero rows are skipped.
- **Import:** in parts of 500. The result says, for example, "120 imported, 4 already imported, 0 rejected", plus a warning when the same file was imported before.
- **Review tabs:** Unmatched (with suggestions and one-click Match), Matched, Ignored, Needs attention. Below Unmatched: payments in the ledger not found on the statement.
- **Wording kept:** "Importing and matching never changes your ledger. Lines that match nothing stay here until a later release lets you post them." The Ledger tab keeps "Bookkeeping tool. Not accounting, tax or legal advice."
- **Plans:** the ledger's existing gating (Business, Scale, trial) applies unchanged.

## Data rights and privacy
- **Personal data:** statement lines can contain personal names, for example a customer's or an employee's name in a description. They are company records, read only by the company's members.
- **Company export:** all three tables are in the company export (`supabase/functions/_shared/data-rights/tables.ts`), as JSON. A CSV of the lines would need a change to the data-export function, which was out of scope.
- **Company close:** it removes them with the rest of the company, through the P7b gate. Tested.
- **Account deletion:** there is no `user_id` column, so nothing changes. The opaque person ids stay, as for the ledger.
- **Retention** follows the company's records: lines stay until the company is closed.
- **Demo:** the three tables are in the demo coverage lists (`not_in_production` until applied), and `check-coverage.sql` passes with them.

## Assumptions the owner can change
1. **Automatic window:** 7 calendar days.
2. **Manual window:** 31 days.
3. **File format:** one statement format family, CSV, with a date, a description, and either one signed amount or money in / money out (optional balance and reference). There is no OFX/QIF yet.
4. **Currency:** GBP only.
5. **Ledger account:** one bank ledger account per company in v1. Every bank account maps to 1200 Bank.
6. **Limits:** at most 10 bank accounts per company, 2,000 rows per call (the browser sends 500), 10,000 rows and 5 MB per file.
7. **Ignore reasons:** two, "not a business transaction" and "handle later".

## Rollback
`rollback.sql`:
- refuses if 3c-1 is not applied;
- refuses while **any statement line exists**, with a message naming the count. Lines are company records, so export the companies concerned first, then decide.
- otherwise drops the eight RPCs, the internal helpers and the three tables. Accounts and imports with no lines go with the tables.

The ledger itself was never changed, so nothing else needs undoing. The audit rows stay.

## Owner steps
1. **Review** `proposal.sql` and this README.
2. **The owner's assistant re-reads the production facts** above (read-only), and after your approval applies `docs/ledger-bank/proposal.sql` in the Supabase SQL editor. If the guard refuses, stop.
3. **Publish** the front end.
   - Before the SQL is applied, the Bank section says "Bank statement import is not available yet."
   - No Edge Function changes.

## What 3c-2 added (done: docs/ledger-bank-post)
Finance phase 3c-2 is prepared in `docs/ledger-bank-post/` (see its README):
- **Posting:** a manager posts an unmatched line (a bank fee, interest, a transfer, owner money) as one balanced two-line journal against a counter account they choose, after confirming. A line can also be posted in a batch of up to 50.
- **Status:** each such line becomes `posted`, linked to its journal.
- **Undo** reverses the journal and returns the line to unmatched.

Still later: rules a company can reuse ("always post 'BANK FEE' to Bank charges"), and a period lock tied to a reconciled statement.
