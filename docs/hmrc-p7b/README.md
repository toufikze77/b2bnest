# HMRC P7b: customer data export, account and company closure, retention purge, old table clean-up

**Status:** written and tested, NOT applied. No SQL has been run on production, no Edge Function is deployed, no job is
scheduled. Production was only read: names, columns, foreign keys, triggers, policies and row counts, never values.
HMRC stays sandbox only; the production refusal is unchanged. Stripe is untouched.

## Decisions already made by the owner

1. The 6-year duty to keep VAT records is the **customer's**, not B2BNEST's. People export first, then delete. Deletion is
   never refused "because the law says so".
2. B2BNEST keeps its own minimal HMRC trail for **6 years** (owner confirmed; **adviser to confirm**):
   `hmrc_vat_submissions` and `hmrc_audit_log` stay immutable, except for the one reviewed purge path below.
3. The incident lead, and the responsible individual named to HMRC, is the owner, **Toufik Zemri**.
4. The only contact mailbox is **info@b2bnest.online**.
5. HMRC stays sandbox only. Stripe go-live is deferred.

## What changed

| Part | Files | Applied? |
| --- | --- | --- |
| SQL: request log, rate limit, closed companies, account deletion, company closure, the purge, the gate, dropping `hmrc_integrations` | `docs/hmrc-p7b/proposal.sql`, `rollback.sql`, `test.sql`, `run-test.sh`, `fixture.sql` | **No** (owner reviews, then the assistant applies after approval) |
| Edge Functions `data-export`, `account-delete`, `company-close` | `supabase/functions/<name>/index.ts`, shared code in `supabase/functions/_shared/data-rights/`, `supabase/config.toml` (JWT on) | **No** (owner deploys) |
| Settings → **Your data** tab | `src/components/settings/YourData.tsx`, `src/lib/dataRights.ts`, `src/pages/Settings.tsx` | Ships with the front end. Safe before the rest: every button shows "This isn't available yet…" with the email fallback |
| Security Guide wording (no "30 days" / "90 days" claims; rights point at Settings → Your data, with the email fallback) | `src/pages/articles/SecurityGuide.tsx` | Ships with the front end |
| Guards | `src/test/dataExportCoverage.test.ts`, `src/test/noUnprovenPrivacyClaims.test.ts`, `docs/demo-readonly/tables.json` | — |

## What each download contains

Both downloads are one ZIP file: `README.txt` (what is in it, and what is left out and why), one JSON file per table,
`manifest.json` (row counts) and `files.json` (uploaded files, each with a link that works for **1 hour**; the files'
bytes are not copied). Exports work on every plan and after a trial ends.

**Both downloads need a fresh sign-in in the last 10 minutes**, like deletion: anyone at an unlocked computer could
otherwise take all of a company's data. `data-export` answers `reauth_required` (before any request slot is taken or
anything is read, and logged as `export_refused`). The screen then asks for the password (or the authenticator code
for people who use one), checks it with Supabase Auth in the browser, and retries the download once. The password is
never sent to our functions, logged or kept.

| | Download my data (anyone) | Download company data (owners and admins) |
| --- | --- | --- |
| Who | The person signed in | Owners and admins of the active company |
| How it is read | With the person's **own sign-in** (RLS applies) wherever a browser read policy exists; 8 tables have none and are read with the service role, filtered by the person's id | With the service role, after the owner/admin check, **always filtered by that one company** (B2BNEST's RLS is per person, so an admin's own sign-in can't see colleagues' company records) |
| Personal | Profile, settings and preferences, marketing consent and opt-outs, notifications, AI conversations and credits, roles, memberships, own requests | — |
| Business records | The records each person keeps for themselves: notes, quotes, CRM contacts and deals, products, suppliers, outgoings, payroll, documents, marketing, AI workspaces, time settings, and invoices, expenses, bills, projects and todos **not tagged to a company** | Company row, members (id and role), invitations (without email), billing assignment, invoices, expenses, bills, projects (+ members, activity), todos (+ sub-tasks, comments, history), time entries, rota (staff, shifts, weeks, holiday allowances and requests), teams (+ members), template applications, support (settings, categories, agents, customers, tickets, messages, attachment records, feedback, notification preferences) |
| HMRC | HMRC settings not tagged to a company | HMRC settings, the old HMRC submission log, **every VAT return sent (the nine boxes as sent, HMRC's receipt)**, the HMRC connection **status only** (never its tokens), B2BNEST's HMRC activity log for the company |
| CSV | — | `invoices.csv`, `expenses.csv`, `bills.csv`, `vat_submissions.csv` (formulas neutralised) |
| Files | Uploaded pictures (`user-avatars`, `company-logos`, `advertisement-images`, `service-images`, under the person's id) | Support ticket attachments (`support-attachments`, under the company's id) |
| Never | Passwords, two-step secrets and codes, tokens, API keys, `HMRC_*` secrets, Stripe customer/subscription ids, other people's rows, other companies' rows. Column rule: `SENSITIVE_COLUMN` in `_shared/data-rights/tables.ts`. Tables left out on purpose: `NOT_EXPORTED` (with reasons) | Same |

Note: B2BNEST stores quotes, CRM, products, suppliers, notes, payroll and documents **per person**, not per company.
They are in each person's own download, and closing a company doesn't delete them (deleting the account does).

**Coverage test:** `src/test/dataExportCoverage.test.ts` reads every table in `src/integrations/supabase/types.ts` and in
every `docs/*/proposal.sql`. It fails when a table with `user_id`, `organization_id` or `company_id` is neither exported
nor excluded with a reason, so a new table can't silently miss the export. It also fails when a token, secret or
password column isn't caught by the redaction rule.

## Account deletion (Settings → Your data → Delete my account)

1. **Check** (read-only). Refused, with the reason in plain words, when the person:
   - is the **last active owner of a company with other members**: they must make someone else an owner, or close the
     company, first;
   - has an **active paid subscription** that isn't set to cancel: they must cancel it in Settings → Billing first. No
     Stripe write call is made;
   - **pays for a company that stays open** (`organization_billing`): another owner must take over the billing first.
2. **Confirm:** the download offer, the tick "I have downloaded what I need", the typed account email, and a **fresh
   sign-in in the last 10 minutes** (a new authenticator code for people who use one; otherwise signing in again with
   the password, done by Supabase Auth in the browser, so no password reaches our functions). Two-step sign-in (aal2)
   is required when enrolled. Demo accounts are refused. Limit: 5 attempts an hour.
3. **Delete** (one transaction, `data_rights_delete_account`):
   - companies where they are the only member and an owner are **closed** (below);
   - in companies that stay, the records they made there (invoices, expenses, bills, projects, todos, teams, HMRC
     settings and logs) **pass to another owner, admin or member**, so the company keeps its books. If that person
     already has HMRC settings for the company, theirs stay and the leaver's go (one row per person and company);
   - **time entries are not moved**: they record who did the work, and production refuses an owner change on them
     (`_time_entry_guard`). They are deleted with the person;
   - **tasks assigned to them are unassigned**. The task history needs a person for each change, so each change is
     recorded under that task's owner;
   - every other row of theirs is **deleted** (every table with `user_id`, found from the catalogue, so new tables are
     covered);
   - references that must stay on company records lose the person (`organizations.created_by`, `invited_by`,
     `created_by` in rota and teams, `organization_billing.set_by`, `payment_audit_logs.user_id`);
   - AI credit, top-up and payment records keep the row without the person (their foreign keys already `SET NULL`);
   - **HMRC trail:** `hmrc_vat_submissions.submitted_by_name` becomes **"Deleted user"**; `submitted_by` and
     `hmrc_audit_log.user_id` keep the **opaque id** only (see "Why keep the opaque id");
   - the profile and the `auth.users` row are deleted; then the Edge Function removes their uploaded files and the
     closed companies' attachments.
4. Final screen: "Your account is deleted. If you needed your records, you should have downloaded them first."

**Why keep the opaque id.** Once the account and profile are gone, the random id links to no name, email or profile
anywhere in B2BNEST. It still lets B2BNEST show that the same (now deleted) account did a set of HMRC actions, which is
the point of the 6-year trail. Basis: UK GDPR Article 17(3)(b) (a legal obligation) and 17(3)(e) (legal claims), and
HMRC's terms of use for software. **Adviser to confirm.** If the adviser prefers, the id can be replaced with one fixed
"deleted" id. That is a one-line change in `data_rights_delete_account`, with the same gated opening.

## Company closure (owners only)

`hmrc_vat_submissions.organization_id` stays `ON DELETE RESTRICT`. Closing a company instead:

- **deletes** every row of the company (every table with `organization_id`, or a `company_id` that references
  organizations), its members and invitations;
- **disconnects HMRC**: the connection row and both tokens are deleted, and `disconnected` / `company_closed` is
  written to the HMRC trail;
- sets `organizations.closed_at` (a new, additive column) and renames the row to **"Closed company"** (slug, logo,
  settings and creator cleared).

A closed company:
- is hidden from every signed-in person (a restrictive RLS policy) and can't be renamed or reopened;
- can't get members, invitations, an HMRC connection or sign-in, or a new submission (triggers);
- keeps its HMRC trail and its shell row until the purge.

The same safeguards apply as for deletion, plus the typed company name. Limit: 5 attempts an hour.

## Retention purge (written, NOT scheduled)

`public.hmrc_purge_expired_audit(p_dry_run boolean DEFAULT true)` is service role only and does a **dry run by
default**, returning counts only. With `false` it deletes:
- `hmrc_vat_submissions` whose `period_end` is over **6 years** old (sandbox: **12 months**);
- `hmrc_audit_log` rows over 6 years old;
- closed companies with no remaining submissions.

**How the immutability stays.** The two guard functions keep their production bodies, plus one gated opening each. A
private table `_data_rights_gate` (no grants to anyone) holds "this transaction may purge / anonymise / close". Only
the reviewed SECURITY DEFINER functions write to it, and they remove their row before returning.
`_data_rights_gate_is_open(kind)` is true only inside that same transaction. A direct DELETE or UPDATE by anyone,
service role or table owner included, is refused exactly as before. A session setting is no way round it, unlike the
older `app.ai_ledger_purge` switch on `ai_credit_ledger` (see Findings). `test.sql` proves:
- nobody else can open the gate;
- the gate is shut again after the purge, even in the same transaction;
- TRUNCATE is still refused.

## Clean-up

- **Dropped: `hmrc_integrations`** (plain-text `access_token` / `refresh_token` columns). The proposal refuses to drop
  it unless it still has **0 rows**, **no foreign key points at it**, **no view uses it** and **no function mentions
  it**. The code was searched: only the generated `types.ts` names it. `rollback.sql` recreates it empty, with its
  columns, keys, indexes, policies, triggers and grants as read from production.
- **Reported, not changed: `hmrc_settings`** (1 row in production). It has `utr`, `paye_reference`, `client_id`,
  `client_secret` (empty) and `vat_number`. The current HMRC code uses only `vat_number`. **Owner decision:** keep, clear
  or drop the other columns. The export already leaves out `client_secret` and `client_id`.

## Owner test steps (after the SQL is applied and the functions are deployed)

Use a test account and a test company, never a real customer's.

1. **Export.** Sign in as the test owner, then wait more than 10 minutes. Go to Settings → Your data and choose
   **Download my data**. A box asks "For your security, enter your password to download your data." (people who use
   an authenticator app are asked for its code instead). Enter a wrong password first: you see an error and nothing
   downloads. Then enter the right one: the download starts. Straight after signing in, no box appears. Open the ZIP and
   check:
   - `README.txt` explains each file;
   - `account/profiles.json` is you;
   - no password, token or secret appears anywhere.
   Then choose **Download company data** and check `company/vat_submissions.csv` and `company/hmrc_connections.json`
   (status only).
2. **Close a test company.** Create "Test Close Ltd" with only you in it. Choose **Close this company…**, download its
   data, tick the box, type the name, enter your code and close it. It disappears from the company switcher. In the SQL
   editor, `select name, closed_at from organizations where name = 'Closed company'` shows the shell.
3. **Delete a test account.** Sign in as a second test account that isn't the last owner of a shared company. Choose
   **Delete my account…**, download, tick, type the email, sign in again (or enter the code) and delete. You see the
   final screen. You can't sign in again with that account.
4. **Dry-run the purge.** In the SQL editor, run `select * from public.hmrc_purge_expired_audit();`. It returns counts
   and deletes nothing. Don't run it with `false` until you decide to schedule it.

## Rollout order

1. **Owner reviews** `docs/hmrc-p7b/proposal.sql` (and `rollback.sql`).
2. **The assistant applies the SQL** after the owner's approval. The proposal refuses (and changes nothing) unless
   production is exactly as read on 9 Nov 2026.
3. **Owner deploys the three Edge Functions from PowerShell** (no new secrets: they use `SUPABASE_URL`,
   `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase provides; JWT verification is on, from
   `supabase/config.toml`):
   ```powershell
   cd C:\path\to\b2bnest
   git pull
   npx.cmd supabase login
   npx.cmd supabase functions deploy data-export --project-ref gvftvswyrevummbvyhxa --use-api
   npx.cmd supabase functions deploy account-delete --project-ref gvftvswyrevummbvyhxa --use-api
   npx.cmd supabase functions deploy company-close --project-ref gvftvswyrevummbvyhxa --use-api
   ```
4. **Publish the front end.** It is safe earlier too: until steps 2 and 3, each button answers "This isn't available
   yet. Please try again later, or email info@b2bnest.online and we will help."

## Owner decisions still open

- **Schedule the purge** (for example monthly, with `pg_cron`), or keep running it by hand. Not done here.
- How long to keep `data_rights_requests` (the record that requests were handled). Proposed: 6 years, like the HMRC
  trail. Not purged today.
- `hmrc_settings` extra columns (above).
- Opaque id vs a fixed "deleted" id on the HMRC trail (above, adviser to confirm).
- Revoking the HMRC grant at disconnect (no revoke endpoint verified; to confirm with HMRC).

## Risks

- **Deletion is permanent.** There is no undo after step 3, by design. Backups follow Supabase's own backup window.
- The SQL deletes from **every** table with `user_id` (found from the catalogue). A future table whose `user_id` means
  something other than "this person's row" must be added to the keep list in `data_rights_delete_account`.
- `auth.users` is deleted from inside the SQL function (owner `postgres`), as Supabase documents for self-deletion. If
  a future Supabase change refused that, the function would fail and change nothing (one transaction).
- The local skeleton can't show every production trigger. The ones that fire during a deletion were read from
  production and copied into `fixture.sql`: `log_todo_changes`, `_time_entry_guard`, `ai_credit_ledger_append_only`
  and the HMRC guards. Others were read and judged safe: `finance_company_check` returns early for the owner role;
  `organization_members_guard` only checks inserts and updates; `wave1_*` returns early under the service role; the
  rota leave guards only re-check overlaps. If any trigger still refuses (for example `vat_check_invoice_lines` on an
  old recorded invoice that no longer passes today's line rule), the whole deletion fails and nothing changes. The
  person is told to try again or email info@b2bnest.online.
- Records tagged to a company the person had **already left** (not one they are a member of) are not moved. Where
  their foreign key cascades (for example `bills.user_id`), they go with the person.
- Exports are capped at 20,000 rows per table and 40 MB per file. Above that, the README inside says what was cut, and
  the person is told to email info@b2bnest.online.
- The local test database is a skeleton of production. `fixture.sql` adds production's 133 foreign keys where their
  columns exist (every person and company key does), the guard and ledger trigger bodies, and the organisations RLS.
  Child-table keys that the skeleton lacks columns for are skipped and noted.

## Findings (not changed here)

- `ai_credit_ledger_append_only` allows DELETE when the session setting `app.ai_ledger_purge = 'on'`, which any role
  that can delete from the table can set. Today only the service role can delete there. Consider the same gate pattern.
- Most business tables (quotes, CRM, products, suppliers, notes, payroll, documents) have no company column: they are
  per person. A future "move to a company" change would make the company download more complete.

## Out of scope

- HMRC production, Stripe go-live and plans or prices.
- New mailboxes.
- The live privacy and terms pages.
- Scheduling any job.
- Any change to RLS or immutability outside the gated paths above.

## Checks

| Check | Result |
| --- | --- |
| `PG_RUN_USER=postgres bash docs/hmrc-p7b/run-test.sh` | 117 PASS, 0 FAIL (shape = production, empty rollback restores the exact fingerprint, suite, demo coverage, second apply refused, rollback refused after a closure, drift refused) |
| Deno: `supabase/functions/` | 483 passed, 0 failed (11 new in `_shared/data-rights/data_rights_test.ts`) |
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| `npx eslint .` (baseline 510) | 509 |
| `npx vitest run` | exit 0: 181 files, 1693 tests, no "Unhandled" |
| `npm run build` | exit 0 |
