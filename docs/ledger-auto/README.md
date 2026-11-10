# Finance phase 3a: automatic ledger postings for invoices

A company can switch on automatic postings. When it does:
- sending an invoice posts it to the ledger (phase 2, `docs/ledger/`);
- marking it paid posts the payment;
- changing it afterwards reverses the old journal and posts the new one.

The same screen offers a one-click catch-up (with a preview first) for existing invoices dated on or after the ledger start date.

It is a bookkeeping tool. The screens say: "Bookkeeping tool. Not accounting, tax or legal advice."

**Status: prepared, not applied.**
- Nothing in this folder has been run on production. I can only read production.
- The production facts below come from the repository. The owner's assistant re-checks them before applying.
- Nothing here talks to HMRC. The HMRC hide switch, HMRC functions, fraud headers, plans, prices and Stripe are not touched.
- Existing invoice and VAT calculations are not changed.

## Owner decisions this follows
- **Off by default, per company.** Nothing posts until an owner or admin switches it on.
- **One-click catch-up with a preview.** Invoices dated before the ledger start date are never posted.
- **This PR is invoices and invoice payments only.** Bills, expenses, bank items and credit notes come later.
- **Plans:** Business, Scale and the trial. This reuses phase 2's `_ledger_rule` (the `hmrc_manage_allowed` plan rule).
  - Owners and admins switch it and run the catch-up; plain members can read.
  - Solo, trial ended, demo and member states are exactly as in phase 2.

## What already existed (searched first)
- **The phase 2 ledger** (merged in #98 and #99, and applied): tables, `_ledger_rule`, the append-only and balance guards, and `ledger_reverse_journal`. All of it is reused unchanged, apart from the one CHECK below.
- **No automatic posting code existed.** There was no queue, link table or invoice trigger for the ledger.
- **`invoices` already has five triggers:** `a0_demo_readonly_guard`, `a1_finance_company_check`, `invoices_notify_paid`, `update_invoices_updated_at` and `vat_invoice_lines_check`. They are untouched; one new AFTER trigger is added beside them.
- **No issue-date column.** `invoices` has no separate issue date: `created_at`, `due_date`, `tax_point_date` and `paid_at` are the only dates.
- **How the app changes status** (`src/lib/documentActions.ts`):
  - new invoices start as `draft`;
  - "Mark as sent" sets `sent`;
  - "Mark as paid" sets `paid` with `paid_at` now;
  - "Mark as unpaid" sets `sent` and clears `paid_at`.
  - Archive sets `archived_at`; "Delete forever" deletes the row.

## Posting rules (accrual, GBP only)
The accounts are found by `system_key`, never by code: `debtors`, `sales`, `vat_control` and `bank`. Suspense is not used: anything that can't be classified goes to "Needs attention".

| When | Journal (`source_type`, memo) | Dated | Lines |
|---|---|---|---|
| Status `sent`, `overdue` or `paid` | `auto_invoice`, "Invoice INV-0012 issued" | `tax_point_date`, else the UK calendar day of `created_at` | Dr Debtors = total; Cr Sales = subtotal; Cr VAT control = VAT (no line when the VAT is 0) |
| Status `paid` with `paid_at` | `auto_invoice_payment`, "Invoice INV-0012 paid" | the UK calendar day of `paid_at` | Dr Bank = total; Cr Debtors = total |

- **Who posted it.** Every automatic journal has reason "Automatic posting", `source_id` = the invoice id, `posted_by` = the invoice's `user_id` (opaque) and `posted_by_name` "Automatic posting".
- **Order.** A payment posts only after the invoice's issue journal; a paid invoice that was never sent gets its issue journal first.
- **Never posted:**
  - drafts (and any status other than sent, overdue or paid);
  - archived invoices;
  - invoices with no company.
- **Needs attention** (not posted, with a plain reason), when:
  - the currency is not GBP;
  - the subtotal or total is missing;
  - an amount is not whole pence, or is negative (credit notes are later);
  - the total is zero;
  - subtotal + VAT ≠ total, to the penny;
  - the date is before `ledger_settings.start_date`;
  - the date is on or before `locked_through`;
  - the invoice is paid with no paid date.
- **Changes after posting.** If the number, amounts, date or status change, or the invoice is archived or deleted:
  - the earlier automatic journal is reversed (a `reversal` journal, the same mechanics as `ledger_reverse_journal`);
  - then the new version posts, if it still applies.
  - "Mark as unpaid" reverses the payment journal.
  - History is never edited.
  - The reversal is dated like the original while that period is open, otherwise today.
- **Reversed by hand.** A journal someone reversed with Reverse is recorded as reversed by hand. That version is not posted again; change the invoice and the new version posts.
- **VAT schemes.** Each journal posts the VAT the invoice records. Cash accounting and flat-rate treatment are not applied, and the screen says so.
- **Money** is in whole pence throughout. The money columns are `numeric(10,2)`, and nothing compares floats.

**Why the UK calendar day, not `paid_at::date`.** Supabase sessions run in UTC. A payment marked at 00:30 on 1 June (BST) would otherwise be dated 31 May. The SQL uses `(paid_at AT TIME ZONE 'Europe/London')::date`, and the same for `created_at`. The suite checks this: 23:30 UTC on 31 March is dated 1 April.

### Worked examples
1. **Invoice INV-0012 for £100.00 + £20.00 VAT, sent on 3 March.** One journal on 3 March: Dr Debtors £120.00, Cr Sales £100.00, Cr VAT control £20.00.
   - **Marked paid on 20 March:** Dr Bank £120.00, Cr Debtors £120.00.
   - **Result:** Debtors are back to £0; Bank +£120; Sales £100; VAT control £20.
2. **The same invoice is edited to £200.00 + £40.00 before it is paid.**
   - The 3 March journal is reversed (Dr Sales £100, Dr VAT control £20, Cr Debtors £120, dated 3 March).
   - Then a new journal posts Dr Debtors £240, Cr Sales £200, Cr VAT control £40.
   - Both journals stay in the list.
   - If March had been locked, the reversal would be dated today, and the new version would go to "Needs attention" (period locked).

## Design
- **Saving an invoice can't fail or slow down because of the ledger.** The trigger `ledger_auto_invoice` (AFTER INSERT/UPDATE/DELETE on `invoices`) only:
  - checks the company's switch;
  - inserts one small row into `ledger_post_queue`.
  - It runs only when a field the ledger uses changed: status, `paid_at`, amounts, currency, `tax_point_date`, `created_at`, number, `archived_at` or company.
  - Its whole body sits in `BEGIN … EXCEPTION WHEN OTHERS THEN NULL`, so any error is swallowed and the invoice is saved.
  - The suite forces the queue insert to fail and checks the invoice is still saved.
  - It does no posting. During company closure it queues nothing.
- **Posting happens in `ledger_process_queue(p_org, p_limit)`:**
  - at most 200 invoices per run, oldest first;
  - each invoice in its own sub-transaction, so one failure never stops the rest;
  - the same per-company advisory lock as `_ledger_post`.
  - The balance rule is checked straight after each journal (`SET CONSTRAINTS public.ledger_balanced IMMEDIATE`), so a bad journal fails inside its own sub-transaction rather than at commit.
  - A failure keeps the queue row with the SQLSTATE only. After 5 tries the invoice goes to "Needs attention".
- **When the runner runs:**
  - every minute by pg_cron (`schedule.sql`);
  - on demand: "Post existing invoices" (`ledger_auto_catch_up`) and "Post now" (`ledger_auto_run`).
- **No double posting:**
  - `ledger_postings` allows one live posting per invoice and kind (unique index `ledger_postings_one_live`);
  - `version_hash` (an md5 of the number, date and amounts in pence) detects a changed invoice;
  - running twice posts nothing (tested).
- **A company stops posting when it isn't ready.** It needs to be open, set up, switched on, and to have at least one active owner or admin whose plan includes the ledger (`_ledger_rule` = `ok`). Otherwise its waiting rows are dropped; switching back on and "Post existing invoices" picks everything up again.
- **Switching off** stops new postings and clears that company's queue. It never deletes or reverses a journal.

### Tables (all new)

| Table | Holds |
|---|---|
| `ledger_auto_settings` | Per company: `invoices_enabled` (default false), `enabled_at`, `enabled_by` (opaque, no FK), `updated_at` |
| `ledger_post_queue` | Invoices waiting: company, `source_id`, `attempts`, `last_error` (SQLSTATE only). Short-lived. |
| `ledger_postings` | Which journal posted which invoice version: `source_label` (the invoice number), `kind` (`invoice_issued` / `invoice_paid`), `version_hash`, `entry_id`, and once reversed `reversal_entry_id`, `reversed_how` (`automatic` / `by_hand`), `reversed_at`. No FK to invoices, so deleting an invoice is never blocked. |
| `ledger_post_issues` | Needs attention: `source_label`, `kind`, `reason_code`, `created_at`, `resolved_at` (set automatically when the invoice is fixed). |

### The one change to an existing table
`journal_entries.je_source_type` now also allows `auto_invoice` and `auto_invoice_payment` (DROP and ADD of the CHECK).
- **Unchanged:** every other constraint, trigger and policy of phase 2, including the append-only guard and its P7b gate exceptions, the balance trigger, `je_reversal` and the entry and line guards.
- **Reversals:** a reversal of an automatic journal is still `source_type = 'reversal'`, so `ledger_reverse_journal` works on it like any other journal.

### RPCs

| Function | Who | Does |
|---|---|---|
| `ledger_auto_status(p_org)` | members | `access`, `can_manage`, `set_up`, `invoices_enabled`, `enabled_at`, `waiting`, `open_issues` |
| `ledger_auto_set(p_org, p_enabled)` | owners and admins (aal2 when enrolled; demo and closed companies refused) | Switch on or off. Needs the ledger set up. One `audit_logs` row when the state changes. |
| `ledger_auto_preview(p_org)` | members | Read only. Invoices and payments to post (counts and totals in pence), journals to reverse, already posted, not issued, skipped by reason. |
| `ledger_auto_catch_up(p_org)` | owners and admins, switch on | Queues every invoice of the company and runs the first batch (≤ 200). Returns `queued`, `processed`, `failed`, `dropped`, `remaining`. |
| `ledger_auto_run(p_org)` | owners and admins, switch on | One batch (≤ 200) of the company's waiting invoices |
| `ledger_process_queue(p_org, p_limit)` | internal (pg_cron) | The runner. Not executable by `authenticated` or `service_role`. |

Internal, not executable by anyone but the owner: `_ledger_auto_plan`, `_ledger_auto_apply`, `_ledger_auto_journal`, `_ledger_auto_issue`, `_ledger_auto_pence`, `_ledger_auto_org_ready`, `_ledger_auto_invoice_changed` and `_ledger_auto_history_guard`. Every function sets `search_path = ''`.

### Security
The same pattern as phase 2.
- **RLS:**
  - members read their company's rows;
  - no INSERT, UPDATE or DELETE grant for `authenticated` or `service_role`;
  - restrictive `require_aal2_if_enrolled` and `ledger_hide_closed` policies;
  - anon has no access.
- **Triggers:** demo guard triggers and the P7b closed-company guard on all four tables.
- **History guard:** `ledger_postings` rows only ever gain their reversal, and `ledger_post_issues` rows only ever get resolved. Both go only with the company (the `company_close` gate).
- **Cross-tenant tests:** company A's people can't read, switch, preview or catch up company B, and the reverse.

### Data rights
- **Export:** `ledger_auto_settings`, `ledger_postings` and `ledger_post_issues` are in the company export as JSON (`supabase/functions/_shared/data-rights/tables.ts`). `ledger_post_queue` is listed in `NOT_EXPORTED`: it is a short-lived list, and what was posted is in `ledger_postings`.
- **Company close:** no change needed. P7b deletes every `organization_id` table through the `company_close` gate, and the history guard lets that gate through. The invoice trigger queues nothing while the gate is open. Tested.
- **Account deletion:** no change needed, because the new tables have no `user_id` column.
  - The person's company invoices pass to a successor without being queued, since the invoice owner is not a ledger field.
  - **Note:** phase 2's existing account-deletion step renames journals whose `posted_by` is the deleted person to "Deleted user". That includes automatic journals of invoices they owned, which lose the "Automatic posting" name. Their `source_type` (`auto_invoice`, `auto_invoice_payment`) still shows they were automatic, and the screen labels them from it. I didn't change `data_rights_delete_account` to keep this PR to the one CHECK change. Tested and recorded here.
- **Demo:** the four tables are in the demo coverage lists (`docs/demo-readonly/tables.json`, under `not_in_production` until applied). `run-test.sh` runs `check-coverage.sql` against them.

### Front end
- **Where:** Ledger tab → **Automatic postings** (`src/components/finance/ledger/LedgerAuto.tsx`, `src/lib/ledgerAuto.ts`).
- **The screen:**
  - the switch, with its state ("Off", or "On since 3 March 2026");
  - a plain explanation with the worked example, computed by the tested `invoicePosting()` function;
  - the VAT scheme note;
  - the preview table;
  - "Post existing invoices", with a confirmation that repeats the counts and totals and the reversal-only warning;
  - "Post now" while invoices are waiting;
  - the "Needs attention" list, with plain reasons and a link to the invoices.
- **Journals:** the list and detail show the source ("Invoice INV-0012") for automatic journals and their reversals. Reverse works on them as on any journal.
- **Before the SQL is applied:** the tab says "Automatic postings are not available yet.", and the rest of the ledger works as before.
- **Other states:** Solo, trial ended and demo never see the tab (phase 2's gate); members see it read only.

## Files
| File | What |
|---|---|
| `proposal.sql` | The change. A guard refuses it unless production matches the facts below. |
| `schedule.sql` | The pg_cron job, applied after `proposal.sql` |
| `rollback.sql` | Undoes it. Refuses while any automatic posting exists. |
| `fixture.sql` | Local only. Nothing is needed beyond the phase 2 chain. |
| `test.sql`, `run-test.sh` | The local suite. It also re-runs the phase 2 suite with phase 3a applied. |

### Production facts the guard checks (from the repository, 10 Nov 2026)
- **No phase 3a tables:** none of the four tables exists, and `invoices` has no `ledger_auto_invoice` trigger.
- **The 152 public tables** (phase 2 applied): md5 of the sorted names is `185ba338b34d22b6189306e30de56545`.
- **`je_source_type`** is exactly `CHECK ((source_type = ANY (ARRAY['manual'::text, 'opening_balance'::text, 'reversal'::text])))`.
- **`invoices` columns:**
  - `id`, `organization_id`, `user_id`: uuid;
  - `invoice_number`, `status`, `currency`: text;
  - `subtotal`, `tax_amount`, `total_amount`: numeric(10,2);
  - `paid_at`, `created_at`, `archived_at`: timestamptz;
  - `tax_point_date`: date.
- **Other columns:** `organization_members.is_active` exists.
- **Helper bodies:** for each helper below, the guard accepts the md5 of the raw body or of the body with whole-line comments removed (production stores some bodies that way). **The assistant re-verifies these against production:**

| Function | Raw | Comment-stripped |
|---|---|---|
| `hmrc_manage_allowed(uuid,uuid)` | `9304f069f05402aab62d343b3626cd65` | `801908512427b85279c33bfffd64922e` |
| `user_is_organization_member(uuid,uuid)` | `1fb55538d44b2451875f8baf1b6e4388` | same |
| `require_aal2_if_enrolled()` | `10b2ae7bd2f9a94ea20598f19b8aebf2` | same |
| `mfa_ok()` | `20516f2ec203220b3ac08d1230c7c306` | `c6fd9b98a36055f056bbd682cb57f3aa` |
| `demo_readonly_guard()` | `087b5fe2695b95b8ba2ba6eb195ba995` | same |
| `_data_rights_gate_is_open(text)` | `b22b22eda6bd86e8ff363a6a58bfe3a3` | same |
| `_data_rights_closed_company_guard()` | `2ec2d8630e284aed65d010c61a442a53` | same |
| `_data_rights_company_tables()` | `c4497fd5fa0245618d1168f9c19bffe1` | same |
| `_data_rights_close_org(uuid,uuid)` | `b0c5e82fc596390a6275b53524947531` | `6c379a1d11b0e469c13ec57e4f054678` (the hash used when phase 2 was applied) |
| `data_rights_delete_account(uuid,uuid,boolean)` (the **phase 2** body, with the journals line) | `b1922b7985b959d094e72248019551fa` | `4492cbbb945bbe7a7f72b83b249bcaef` |
| `_ledger_rule(uuid,uuid)` | `edf2117e8b0bdeb3826552b712faa227` | same |
| `_ledger_org_open(uuid)` | `361077573d6cc7f9c83c6702808d61cd` | same |
| `_ledger_require_writer(uuid)` | `75ecf4a981581daae33e90dc554f01c4` | same |
| `_ledger_append_only()` | `f47e341b7cca2f0118e8e70493984e56` | same |
| `_ledger_entry_guard()` | `727748e665991e8105a96e15f7f9929c` | same |
| `_ledger_line_guard()` | `1c805547e284b65803d2f9bbb480d761` | `041398b1d1ecbd5856c7cab85aff8479` |
| `_ledger_balance_check()` | `ee84f8fd18cb93fcd9fa1dfbd6aa36e7` | same |
| `ledger_reverse_journal(uuid,text,date)` | `22157acb97b8b8cb3ade3318177353b9` | same |

- **`data_rights_delete_account`:** the P7b comment-stripped hash `6cb32ccf…` in `docs/ledger/README.md` was the check *before* phase 2 replaced the body. Production should now hold the phase 2 body, so check it against the two values in the table.
- **If any value differs:** the guard refuses and nothing changes. Tell me the production value, and I'll update the guard only after checking the body is the same apart from comments.
- **Production row counts** (from the brief): about 51 invoices across all companies, 31 with `paid_at`. The suite covers 205 invoices in one company in two batches.

## Owner steps
1. **Review** this README, `proposal.sql`, `schedule.sql` and the PR.
2. **The assistant applies the SQL** after your approval.
   - First it verifies the production facts above.
   - Then it applies `docs/ledger-auto/proposal.sql` in the Supabase SQL editor.
   - If the guard refuses, stop: production differs from the repository.
   - Then it applies `docs/ledger-auto/schedule.sql` (the pg_cron job).
3. **Redeploy the data-rights Edge Functions.**
   - `data-export` changed: the three new tables.
   - `account-delete` and `company-close` bundle the same `tables.ts`, so redeploy them to keep the three in step. Their behaviour is unchanged.
   - No new function, no `config.toml` change, no secret. JWT verification stays on; never use `--no-verify-jwt`.
   ```powershell
   cd C:\b2bnest-deploy
   git pull
   npx.cmd supabase functions deploy data-export --project-ref gvftvswyrevummbvyhxa --use-api
   npx.cmd supabase functions deploy account-delete --project-ref gvftvswyrevummbvyhxa --use-api
   npx.cmd supabase functions deploy company-close --project-ref gvftvswyrevummbvyhxa --use-api
   ```
4. **Publish** the front end. It is safe to publish before step 2: the tab then says "Automatic postings are not available yet."

## Owner test steps (in a test company, after applying)
1. **Switch on.** Ledger → Automatic postings: the switch shows "Off". Switch it on; it shows "On since …".
2. **Preview.** Check the counts and totals against your invoices.
   - Invoices dated before the start date, non-GBP invoices and invoices whose amounts don't add up should show as skipped.
3. **Catch-up.** Press "Post existing invoices", read the confirmation, then "Yes, post them".
   - Journals shows "Automatic: invoice" rows with the source "Invoice …".
   - "Needs attention" lists the skipped ones.
4. **Mark an invoice paid.** Within a minute (or press "Post now"), an "Invoice … paid" journal appears.
5. **Edit an invoice's amount.** The old journal is reversed and a new one posts; both stay in the list.
6. **Trial balance.** Debtors equals the invoices not yet paid, and the totals agree.
7. **Switch off.** Change another invoice: nothing new posts, and every journal is still there.

## Rollback
- **When:** `docs/ledger-auto/rollback.sql` refuses while any automatic posting (or automatic journal) exists, because journals are append-only business records. Switching automatic postings off is the way to stop them.
- **What it does, with no postings:**
  - drops the invoice trigger, the functions and the four tables;
  - puts `je_source_type` back to its phase 2 values.
  - The suite checks that the database fingerprint is then exactly as before.
- **The cron job:** unschedule it first with `SELECT cron.unschedule('b2bnest-ledger-auto-queue');`.

## Checks run here
| Check | Result |
|---|---|
| `PG_RUN_USER=postgres bash docs/ledger-auto/run-test.sh` | 142 PASS, 0 FAIL, including the phase 2 suite re-run with phase 3a applied |
| `PG_RUN_USER=postgres bash docs/ledger/run-test.sh` | 127 PASS, 0 FAIL (unchanged) |
| Deno `_shared/data-rights` + `cors_test.ts` | 22 passed; `deno check` of the three functions clean |
| vitest (whole suite) | 192 files, 1820 tests passed, exit 0, no unhandled errors |
| `tsc --noEmit`, `eslint .`, `npm run build` | clean; 509 problems (baseline 510); build OK |

## Risks
- **The cron job.**
  - If it isn't scheduled, postings wait until someone presses "Post now" or "Post existing invoices".
  - If pg_cron is unavailable, the queue just grows; it is bounded by invoice changes.
- **Plan ended.** While no owner or admin has an included plan, waiting rows are dropped. After renewing, press "Post existing invoices".
- **Reversed by hand.** That version isn't posted again until the invoice changes. This is deliberate; the README and screen say so.
- **Many before-start invoices.** A company with many invoices before the start date gets one "Needs attention" row each, as the rules ask.
- **Account deletion renames automatic journals** to "Deleted user", as explained above.
- **The preview** reads every invoice of the company. That is fine at today's volumes (about 51 invoices in production).

## Not in this PR
- bills, expenses, bank items and credit notes;
- scheme-specific VAT (cash accounting, flat rate);
- multi-currency;
- a period-lock screen;
- reports from the ledger.
