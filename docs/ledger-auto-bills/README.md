# Finance phase 3b: automatic ledger postings for bills and expenses

This extends phase 3a's automatic postings (`docs/ledger-auto/`) to bills and expenses. Phase 3b has its own folder; 3a's files are unchanged.

A company switches it on with a second switch: "Post bills and expenses to the ledger automatically". When it is on:
- a bill posts when it is received;
- the bill's payment posts when it is marked paid;
- an expense posts when it is approved or paid;
- a record that changes later is reversed and posted again.

Existing records get a one-click catch-up with a preview first.

It is a bookkeeping tool: "Bookkeeping tool. Not accounting, tax or legal advice."

**Status: prepared, not applied.**
- Nothing here has been run on production.
- Nothing talks to HMRC. The HMRC code, hide switch, fraud headers, plans, prices and Stripe are not touched.
- Existing bill, expense and VAT calculations are unchanged.

## Owner decisions this follows
- **Off by default, per company.** One switch covers bills and expenses. The invoice switch (3a) is separate and works as before.
- **One-click catch-up with a preview.** Records dated before the ledger start date are never posted.
- **Plans:** Business, Scale and the trial, through phase 2's `_ledger_rule`.
  - Owners and admins switch it, catch up and run.
  - Plain members can read.
  - Solo, trial ended, demo and closed companies are refused, as in 3a.
- **This PR is bills and expenses only.** Bank items (3c), credit notes, payroll, multi-currency, scheme-specific VAT and a period-lock screen come later.

## What already existed (read first)
- **The phase 3a engine is reused, not forked:**
  - the queue, the posting links and the needs-attention rows;
  - the journal writer `_ledger_auto_journal`;
  - the runner, the preview, the catch-up and "Post now";
  - the per-company advisory lock, the unique live-posting index and `version_hash`.
- **`bills`:**
  - `amount` is the gross and is plain `numeric`.
  - `net_amount` and `vat_amount` are `numeric(12,2)` and can be empty.
  - HMRC P4's CHECK `bills_vat_recorded_check` guarantees `net + VAT = amount` exactly, but only once `vat_status = 'recorded'`.
  - Statuses: `pending`, `paid`, `overdue`, `cancelled` (CHECK `bills_status_check`).
  - There is no `archived_at` column, so the only way to remove a bill is to delete it.
  - **Bills have no screen in the app.** They are edited in Company records (company and VAT details).
- **`expenses`:**
  - `amount` is the gross, `numeric(10,2)`; it has the same VAT columns and CHECK as bills.
  - Statuses seen: `pending`, `approved`, `paid`.
  - **No currency column.** As in the VAT return (HMRC P5), an expense counts as GBP when its owner's account currency (`profiles.currency_code`) is GBP.
  - No `archived_at`.
- **Categories are free text** (for example "Software and subscriptions", "software_subscriptions", "office_costs"), hence the category map below.
- **Where bills and expenses are saved:** the Expenses tab (`moneyOutApi('expenses')` in `BusinessFinanceAssistant.tsx`), and the Company records helper (assign a company, add VAT details) for bills and expenses.

## Posting rules (accrual, GBP only)
Fixed accounts are found by `system_key`: `creditors`, `vat_control`, `bank`, `cost_of_sales`. The expense account comes from the category map.

| When | Journal (`source_type`, memo) | Dated | Lines |
|---|---|---|---|
| Bill `pending`, `overdue` or `paid` | `auto_bill`, "Bill BILL-0012 from Acme received" ("Bill from Acme received" without a number) | `tax_point_date`, else `issue_date` | Dr expense account = net (+ VAT when not reclaimable); Dr VAT control = VAT when `vat_reclaimable` and VAT > 0; Cr Creditors = gross |
| Bill `paid` with `paid_date` | `auto_bill_payment`, "Bill BILL-0012 paid" | `paid_date` | Dr Creditors = gross; Cr Bank = gross (only after the bill itself is posted) |
| Expense `approved` or `paid` | `auto_expense`, "Expense: Travel 14 Nov" | `tax_point_date`, else `date` | Dr expense account = net (+ VAT when not reclaimable); Dr VAT control = reclaimable VAT; Cr Bank = gross |

- **Who posted it.** Each journal has reason "Automatic posting", `source_id` = the record id, `posted_by` = the record's `user_id` (opaque) and `posted_by_name` "Automatic posting".
- **Never posted:** cancelled bills; `pending`, `rejected` and any other expense status.
- **Needs attention** (not posted, with a plain reason):
  - not GBP (the bill's currency, or the expense owner's account currency);
  - **VAT details not recorded** (`vat_status` not `recorded`, or net/VAT empty);
  - amount missing, not whole pence, zero or negative (credit notes are later);
  - net + VAT ≠ gross to the penny;
  - the category is not mapped, or its account was deleted or made inactive;
  - the date is before the start date, or in a locked period;
  - the bill is paid without a paid date;
  - the payment can't post because its bill isn't posted;
  - processing failed 5 times.
- **Changes after posting.** A change to the amounts, date, category, number, vendor, status (for example back to pending or cancelled) or company, or a delete:
  - the automatic journal is reversed (dated like the original while that period is open, otherwise today);
  - then the new version posts.
  - A bill marked unpaid reverses the payment journal.
  - A journal someone reversed by hand is not posted again for the same version.
- **VAT schemes.** Each journal posts the VAT the record holds. Cash-accounting and flat-rate treatment are not applied, and the screen says so.

### Assumptions the owner can change (please check)
1. **Expense statuses.** I read an expense as money already spent:
   - `approved` and `paid` post (Cr Bank);
   - `pending` waits until approved;
   - anything else (for example `rejected`) never posts.
   - If approved expenses should instead post to a liability (an employee reimbursement owed), that is a small change to `_ledger_auto_expense_plan`.
2. **No VAT details means no posting.** A bill or expense whose VAT isn't recorded goes to Needs attention, not to the ledger with VAT guessed as zero.
   - The Company records VAT helper can add the details in bulk.
   - This may hold back many of today's 81 expenses until their VAT is recorded.
3. **Expense currency.** It follows the owner's account currency, as in the VAT return. An account with no currency set counts as not GBP.
4. **The category map** (below), including which categories go to 8200 Other overheads.

### The category map
`ledger_category_map(organization_id, category_key, account_id, is_default, created_at, updated_at)`.
- **The key.** `category_key` is the category in lower case with words joined by `_` (`_ledger_auto_category_key`), so "Software and subscriptions" and "software_and_subscriptions" are the same key.
- **The target.** `account_id` references the chart. Deleting the account sets it to empty, so the category needs attention rather than pointing at nothing.
- **Seeding.** The map is seeded with the standard codes when bills and expenses are switched on. Before that, the preview uses the same standard mapping, read only.
- **Editing** comes in a later PR; the screen shows the map read only.

| Account | Categories (keys) |
|---|---|
| 7100 Rent and rates | rent, rent_and_rates |
| 7200 Utilities | utilities, telephone_internet |
| 7400 Travel | travel |
| 7500 Office costs | office_costs, office_supplies, postage, stationery |
| 7600 Professional fees | professional_fees, design, accountancy, legal |
| 7700 Software and subscriptions | software, software_and_subscriptions, software_subscription, software_subscriptions, subscriptions |
| 7900 Bank charges | bank_charges |
| 8200 Other overheads | insurance, marketing, advertising, meals_and_entertainment, other, general |
| Cost of sales (system key) | stock_materials, cost_of_sales |

- **Why 8200 for those categories.** The standard chart has no account for insurance, marketing or entertainment, and they are plainly overheads. Each mapping is visible on the screen.
- **No fallback.** Any category not in the map is not posted: it needs attention.
- **Equipment is left out on purpose.** It may be a fixed asset, so it needs attention.

### Worked examples
1. **Bill BILL-0012 from Acme, £100.00 + £20.00 VAT (reclaimable), Software, received 3 March.**
   - Posted on 3 March: Dr 7700 Software and subscriptions £100.00, Dr VAT control £20.00, Cr Creditors £120.00.
   - Paid on 20 March: Dr Creditors £120.00, Cr Bank £120.00.
2. **Non-reclaimable VAT:** Insurance £50.00 + £10.00 VAT, `vat_reclaimable` false. Dr 8200 Other overheads £60.00, Cr Creditors £60.00.
3. **Approved expense:** Travel £20.00 + £4.00 VAT on 14 November. "Expense: Travel 14 Nov": Dr 7400 Travel £20.00, Dr VAT control £4.00, Cr Bank £24.00.
4. **Edited bill:** BILL-0012 becomes £200.00 + £40.00.
   - The 3 March journal is reversed (Dr Creditors £120.00, Cr 7700 £100.00, Cr VAT control £20.00, dated 3 March).
   - Then the new journal posts (£240.00).
   - If March were locked, the reversal would be dated today and the new version would wait under Needs attention (period locked).

## Design
- **Saving can't fail or slow down.** One AFTER trigger, `ledger_auto_record`, on `bills` and on `expenses` (function `_ledger_auto_record_changed`) only:
  - checks the company's `bills_enabled`;
  - inserts one small queue row, and only when a field the ledger uses changed.
  - Everything sits in `BEGIN … EXCEPTION WHEN OTHERS THEN NULL`, exactly like `ledger_auto_invoice`.
  - The suite forces the queue insert to fail and checks the bill and expense are still saved.
  - During company closure it queues nothing.
  - For expenses, `user_id` counts as a ledger field, because the owner's currency decides GBP.
- **Plans:** `_ledger_auto_bill_plan` and `_ledger_auto_expense_plan` say what each journal should be, in whole pence, or why not.
- **One applier:** `_ledger_auto_apply_record` does the 3a steps for both:
  - reverse what no longer matches (a payment before its bill);
  - post what is missing (a bill before its payment);
  - record or resolve needs attention (`_ledger_auto_flag`, the bills/expenses version of `_ledger_auto_issue`).
- **The runner** `ledger_process_queue` dispatches each queue row by `source_table`:
  - invoices go through the unchanged 3a `_ledger_auto_apply`;
  - bills and expenses go through `_ledger_auto_apply_record`.
  - It handles at most 200 per run, each in its own sub-transaction.
  - A source whose switch is off, whose plan ended or whose company closed loses its waiting rows (`_ledger_auto_source_ready`).
- **No double posting:** one live posting per record and kind (3a's `ledger_postings_one_live`), plus `version_hash`.
- **No foreign key to bills or expenses,** so deleting one is never blocked.
- **The cron job** (`docs/ledger-auto/schedule.sql`) and instant posting from the screens work unchanged; they now cover bills and expenses too.

### Changes to existing objects (the only ones)
- **CHECKs, widened:**
  - `journal_entries.je_source_type` (+ `auto_bill`, `auto_bill_payment`, `auto_expense`);
  - `ledger_post_queue.lpq_source_table`, `ledger_postings.lp_source_table` and `ledger_post_issues.lpi_source_table` (+ `bills`, `expenses`);
  - `ledger_postings.lp_kind` and `ledger_post_issues.lpi_kind` (+ `bill_received`, `bill_paid`, `expense`);
  - `ledger_post_issues.lpi_reason` (+ `vat_details_missing`, `category_not_mapped`, `category_account_missing`, `category_account_inactive`). This is a reason CHECK on a 3a table, the same kind of change as the kind CHECK.
- **One new column:** `ledger_auto_settings.bills_enabled boolean NOT NULL DEFAULT false`.
- **Replaced with `CREATE OR REPLACE`** (same signatures):

  | Function | What changes |
  |---|---|
  | `ledger_process_queue(uuid,integer)` | Dispatches by source; per-source readiness |
  | `ledger_auto_status(uuid)` | Adds `bills_enabled`; every 3a field unchanged |
  | `ledger_auto_set(uuid,boolean)` | Now calls the new three-argument switch with `'invoices'`, so switching invoices off clears only invoice queue rows |
  | `ledger_auto_preview(uuid)` | The 3a body unchanged, plus a `bills_and_expenses` key |
  | `ledger_auto_run(uuid)` | Either switch on is enough |

- **Unchanged and still used:** `_ledger_auto_apply`, `_ledger_auto_plan`, `_ledger_auto_journal`, `_ledger_auto_issue`, `_ledger_auto_pence`, `_ledger_auto_history_guard`, `_ledger_auto_invoice_changed`, `ledger_auto_catch_up(uuid)`.
- **Left in place:** `_ledger_auto_org_ready` stays but is no longer called; the runner uses `_ledger_auto_source_ready`.
- **Not touched:** the phase 2 append-only and balance guards, the P7b gate exceptions, every trigger and policy.

### Tables
`ledger_category_map` is new. The 3a tables gain the CHECK values above and the one column.

### RPCs
| Function | Who | Does |
|---|---|---|
| `ledger_auto_set(p_org, p_enabled, p_switch)` (new) | owners and admins (aal2 when enrolled; demo and closed refused) | `p_switch` is `invoices` or `bills_and_expenses`. Seeds the category map when bills go on, clears that source's queue when off, writes one `audit_logs` row on change (`ledger.auto_bills_on/off`; invoices keep `ledger.auto_invoices_on/off`). |
| `ledger_auto_catch_up(p_org, p_switch)` (new) | owners and admins, that switch on | Queues every bill and expense of the company and runs the first batch (≤ 200). `'invoices'` calls the 3a catch-up. |
| `ledger_auto_status`, `ledger_auto_preview`, `ledger_auto_run` | as 3a | As listed above |

- **Internal, not executable by `authenticated` or `service_role`:** `_ledger_auto_category_key`, `_ledger_auto_default_categories`, `_ledger_auto_seed_category_map`, `_ledger_auto_category_account`, `_ledger_auto_want`, `_ledger_auto_bill_plan`, `_ledger_auto_expense_plan`, `_ledger_auto_record_plan`, `_ledger_auto_flag`, `_ledger_auto_apply_record`, `_ledger_auto_source_ready`, `_ledger_auto_record_changed`, `_ledger_auto_preview_records`, `ledger_process_queue`.
- Every function sets `search_path = ''`.

### Security
The same pattern as 3a. `ledger_category_map` has:
- RLS: members read; no grant for INSERT, UPDATE or DELETE;
- the restrictive `require_aal2_if_enrolled` and `ledger_hide_closed` policies;
- the demo guard and the P7b closed-company guard;
- anon has no access.

Cross-tenant tests: A's people can't read, switch, preview or catch up B, and the reverse.

### Data rights
- **Export:** `ledger_category_map` is exported as JSON (`supabase/functions/_shared/data-rights/tables.ts`). Bill and expense postings and issues were already exported through the 3a tables.
- **Company close:** no change. P7b deletes every `organization_id` table through the gate; the bill and expense trigger queues nothing while the gate is open. Tested.
- **Account deletion:** no change; the new table has no `user_id`.
  - A deleted person's company bills and expenses pass to a successor.
  - The expense owner change is looked at again, and posts nothing when the version is the same. Tested.
- **Demo:** `ledger_category_map` is in the demo coverage lists (`not_in_production` until applied).

### Front end
- **Where:** Ledger → Automatic postings has a "Bills and expenses" card (`LedgerAutoBills.tsx`). The invoice card is unchanged.
- **The card:**
  - the switch, showing On or Off. There is no "since" date, because only the invoice switch has `enabled_at`, and the brief allowed only one new column;
  - a worked example, computed by the tested `billPosting()` function;
  - the VAT scheme note;
  - the preview rows: bills, bill payments and expenses to post, to reverse, already posted, skipped by reason;
  - "Post existing bills and expenses" with a confirmation;
  - the category mapping, read only.
- **The switch** makes one call per click and is busy while it runs. Switching off asks first. A two-step refusal shows "Confirm with your authenticator app, then try again."
- **Needs attention** covers bills (link: Company records) and expenses (link: Expenses).
- **Journals** show "Bill BILL-0012" or "Expense: Travel" as the source.
- **Instant posting:** the expense writes and the Company records helper call `runLedgerAutoSoon` (silent, debounced, never blocks).
- **Before the 3b SQL is applied** the card says "Automatic postings for bills and expenses are not available yet."; the rest works as before.

## Files
| File | What |
|---|---|
| `proposal.sql` | The change. A guard refuses it unless production matches the facts below. |
| `rollback.sql` | Puts the five replaced functions back to their exact 3a bodies, restores the CHECKs, drops the column, the table, the triggers and the new functions. Refuses while any bill or expense posting, automatic bill/expense journal or issue exists. |
| `fixture.sql` | Local only. Nothing beyond the 3a chain. |
| `test.sql`, `run-test.sh` | The local suite. It also re-runs the 3a and phase 2 suites with 3b applied. |

### Production facts the guard checks (14 Nov 2026)
- **No 3b objects:** `ledger_category_map` doesn't exist, `ledger_auto_settings.bills_enabled` doesn't exist, and there is no `ledger_auto_record` trigger.
- **The 156 public tables:** md5 of the sorted names is `78b3091d6049d5a502c5ee819a502465`.
- **CHECKs:** the seven CHECKs above are exactly as phase 3a created them.
- **Columns:** the `bills` and `expenses` column types listed in the guard, and `profiles.currency_code` is text.
- **Function bodies:** the 14 phase 3a functions match the md5 values you supplied, plus the phase 2 helpers recorded in `docs/ledger-auto/README.md`.
- **How a body is compared:** raw; with whole-line comments removed; or with all `--` comments removed.
  - **Note:** production stores `_ledger_auto_invoice_changed` and `_ledger_auto_plan` without any comments, including the ones at the end of code lines. Their repository bodies give different hashes raw (`fe3f4ea9…`, `a9cd0a61…`) and with only whole-line comments removed (`18e63f95…`, `9fea247e…`).
  - With all comments removed, both give exactly the production hashes (`89af0faa…`, `0832f99e…`).
  - So the guard also accepts that form, compared only against the production hash. Nothing else is relaxed.
- **Production data** (from the brief): 6 bills (pending, overdue, paid) and 81 expenses (pending, approved, paid).
  - Bill categories: Design, Equipment, Insurance, Marketing, Postage, Software.
  - Expense categories include Insurance, Marketing, Meals and entertainment, Office supplies, office_costs, other, Professional fees, Software and subscriptions, Software subscription, software_subscriptions, stock_materials, telephone_internet, Travel, utilities and Utilities.
  - All of these except Equipment are in the standard map; this is tested.

## Owner steps
1. **Review** this README, `proposal.sql` and the PR.
2. **The owner's assistant verifies the production facts above, and after your approval applies `docs/ledger-auto-bills/proposal.sql`** in the Supabase SQL editor.
   - If the guard refuses, stop: production differs from the repository.
   - No new cron job: the existing `b2bnest-ledger-auto-queue` job now covers bills and expenses too.
3. **Redeploy the data-rights Edge Functions.**
   - `data-export` must be redeployed: it exports `ledger_category_map`.
   - `account-delete` and `company-close` bundle the same `tables.ts`, so redeploy them to keep the three in step. Their behaviour is unchanged.
   - No new function, no secret. JWT verification stays on; never use `--no-verify-jwt`.
   ```powershell
   cd C:\b2bnest-deploy
   git pull
   npx.cmd supabase functions deploy data-export --project-ref gvftvswyrevummbvyhxa --use-api
   npx.cmd supabase functions deploy account-delete --project-ref gvftvswyrevummbvyhxa --use-api
   npx.cmd supabase functions deploy company-close --project-ref gvftvswyrevummbvyhxa --use-api
   ```
4. **Publish** the front end. It is safe to publish before step 2: the card then says "not available yet".

## Owner test steps (in the test company, after applying)
1. **Switch on.** Ledger → Automatic postings → Bills and expenses: switch it on. The category mapping appears.
2. **Preview.** Check the bills, bill payments and expenses to post against your records, and the skipped reasons (for example VAT not recorded, Equipment not mapped).
3. **Catch-up.** "Post existing bills and expenses", read the confirmation, "Yes, post them".
   - Journals shows "Automatic: bill" and "Automatic: expense" rows with their source.
4. **Mark a bill paid** (Company records or your usual route): a "Bill … paid" journal appears (Dr Creditors, Cr Bank).
5. **Edit a bill's amount:** the old journal is reversed and the new one posts.
6. **Approve an expense** in the Expenses tab: "Expense: … " posts straight away.
7. **Trial balance:** Creditors equals unpaid bills; the totals agree.
8. **Switch off:** change a bill; nothing new posts, and every journal is still there.

## Rollback
- **When:** `docs/ledger-auto-bills/rollback.sql` refuses while any bill or expense posting, automatic bill/expense journal or needs-attention row exists. Switching bills and expenses off is the way to stop them.
- **What it does, with none of those:**
  - deletes waiting bill and expense queue rows;
  - drops the triggers, the new functions, `ledger_category_map` and the column;
  - puts the five replaced functions back to their exact 3a bodies and the CHECKs back to 3a.
  - The suite checks the database fingerprint is then exactly as before.

## Checks run here
| Check | Result |
|---|---|
| `PG_RUN_USER=postgres bash docs/ledger-auto-bills/run-test.sh` | 135 PASS, 0 FAIL, including the 3a suite (122 checks) and the phase 2 suite (105 checks) re-run with 3b applied |
| `docs/ledger-auto/run-test.sh` | 142 PASS, 0 FAIL (unchanged) |
| `docs/ledger/run-test.sh` | 127 PASS, 0 FAIL (unchanged) |
| Deno `_shared/data-rights` + `cors_test.ts`; `deno check` of the three data-rights functions | 22 passed; clean |
| vitest (whole suite) | 194 files, 1861 tests passed, exit 0, no unhandled errors |
| `tsc --noEmit`, `eslint .`, `npm run build` | clean; 509 problems (baseline 510); build OK |

## Risks
- **Many records will wait on VAT details.** Records without recorded VAT details won't post until they are added. This is deliberate, see assumption 2.
- **Category mapping is read only in this release.** An unmapped category (for example Equipment) waits until a later PR adds editing.
- **A currency change isn't noticed.** Changing an expense owner's account currency doesn't queue their expenses again. The next catch-up picks it up.
- **Assumed statuses.** The expense status reading is an assumption (above).
- **Volume.** The preview reads every bill and expense of the company; that is fine at today's volumes.

## Not in this PR
- bank items (3c);
- credit notes and refunds;
- payroll;
- multi-currency;
- scheme-specific VAT;
- a period-lock screen;
- editing the category map;
- reports from the ledger.
