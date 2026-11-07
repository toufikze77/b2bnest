# HMRC P4b: link invoices, expenses and bills to a company

**Status: SQL prepared, NOT applied.** Nothing is filed and nothing calls HMRC. The frontend works before and after the SQL is applied.

## What and why
- Today `invoices`, `expenses` and `bills` belong to a **person** (`user_id`), and every finance screen loads only the signed-in person's rows. The company in the header is only a label.
- HMRC connections and VAT numbers belong to a **company** (P0, P3), and a VAT return covers exactly one company's VAT registration.
- Without a company link, two things go wrong:
  - **one person with several companies** would mix their companies' sales and costs in one return;
  - **several people in one company** would each keep separate records, so one owner's return would miss the others'.
- P4b fixes the data model so P5 (the VAT return preview) can be correct.

## What the SQL does (`proposal.sql`)
One transaction. It refuses before changing anything if production differs from what it was written against:
- the columns of `invoices`, `expenses`, `bills` and `organization_members`;
- the triggers and policies on the three tables;
- the source of `vat_records_needing_attention`, `vat_check_invoice_lines`, `user_is_organization_member` and `demo_readonly_guard`.

These were read on 7 Nov 2026, after HMRC P4 was applied.

1. **`organization_id`** on `invoices`, `expenses` and `bills`:
   - nullable, no default, with an index;
   - `REFERENCES public.organizations(id) ON DELETE RESTRICT`. These are accounting records, so they are never cascaded away. A company that still has finance records can't be deleted.
   - Existing rows stay NULL ("no company yet"). Nothing is assigned.
   - `quotes`, `outgoings` and `bank_transactions` are not changed.
2. **Trigger `a1_finance_company_check`** (`public.finance_company_check()`, SECURITY INVOKER, `search_path ''`). It runs after the demo guard (`a0_…`), before INSERT and before UPDATE of `organization_id` or `vat_status`:
   - **Only your own companies.** A company may be set only where the signed-in person is an active member (`public.user_is_organization_member`, already in production). This is checked on INSERT and whenever the company changes. Another company's id, a made-up id, or a company the person has left: refused (`FINANCE_COMPANY_NOT_MEMBER`).
   - **The company is recorded when the VAT is.** A row that **becomes** `recorded` (inserted as recorded, or changed from not recorded to recorded) must have a company (`FINANCE_COMPANY_REQUIRED`).
     - Rows that were already `recorded` with no company stay valid and can still be edited. P5 leaves them out.
     - A recorded row can't have its company removed.
   - **Server writes are not checked:** role `service_role`, or the database owner (`postgres` / `supabase_admin`).
3. **`vat_records_needing_attention(p_organization_id uuid DEFAULT NULL)`** replaces the no-argument function.
   - The old call (no argument) gives the same counts as before (`scope = 'all'`), so the published app keeps working.
   - With a company it returns, separately:
     - `scope = 'company'`: the person's records of that company;
     - `scope = 'unassigned'`: the person's records with no company.
   - It is SECURITY INVOKER as before, and now always limited to `user_id = auth.uid()`. It stays "my own records" even if option A below is ever applied.

**No policy is added, changed or dropped.** Who can see what is exactly as today: each person sees only their own rows. Members' rows stay private to them, including from the company's owners.

## Decision for the owner: read access for owners and admins
A company return must include every member's records for that company, so its owner (and admins) must be able to use rows that other members tagged to the company. There are two prepared options. **Neither is in `proposal.sql`, and neither is applied.**

| | Option A: read policy (`decision-a-policy.sql`) | Option B: summary function (`decision-b-function.sql`) **recommended** |
|---|---|---|
| What it adds | One extra SELECT policy per table: an active owner or admin of company X can read **every row** tagged to X | `public.vat_company_records_summary(company, from, to)`: SECURITY DEFINER, `search_path ''` |
| What the owner gets | Whole rows of other members: client names, addresses, notes, lines | **Totals only** per record type: records counted, net, VAT, and how many were left out and why. Never a row or a client name |
| Checks | Existing restrictive `require_aal2_if_enrolled` policy | Explicit: signed in; `public.mfa_ok()` (two-step done when the person has it); owner or admin of that company; a valid period |
| Effect on the app | Screens filter by `user_id`, so they look the same. Any query without that filter would start returning other members' rows to owners and admins | None. Nothing becomes readable |
| Risk | Wider than P5 needs; personal data of other members' clients becomes readable; future code could leak it by accident | Narrow; P5 needs only totals. If P5 later needs line detail, that is a new, separate decision |
| Undo | `decision-a-rollback.sql` | `decision-b-rollback.sql` |

- **Recommendation: option B.** It gives a company return exactly what it needs (totals of the company's recorded, GBP records) with explicit checks, and changes nothing anyone can see.
- **To apply option B:** after `proposal.sql`, run `decision-b-function.sql` (one transaction). The two options refuse to run together, and `rollback.sql` refuses while either is applied.
- Option B uses the P5 rule below. Expenses have no currency column, so they are in the account currency. P5 must check that the account currency is GBP.

## The rule P5 will use
A company's VAT return reads only rows where all of these hold:
- `vat_status = 'recorded'`;
- GBP (invoices and bills by their currency; expenses by the account currency);
- `organization_id` = the company;
- a tax point in the period.

It leaves out invoices that are drafts or archived, and bills that are cancelled. It always says how many records were left out, and why: not recorded, not GBP, or no company.

## What changed in the app
- **New records carry the company.**
  - **New invoices and expenses** are saved with the active company (`useActiveOrganization`). The form shows a **Company** field with only the person's own companies, preset to the active one; with several companies and none active, the person must choose.
  - **An older invoice or expense with no company,** opened for editing, must have a company chosen before it is saved. Its VAT is then recorded for that company. It is never chosen for the person.
  - **Bills** have no screen in B2BNEST: they are assigned in the review below.
- **Reads are unchanged** (the person's own rows). The Invoices and Expenses lists show a **Company** column ("No company" when none). It only appears once the database has the column.
- **Finance → Company records** ("Records with no company") follows the "Unassigned projects" pattern:
  - it lists the person's own invoices, expenses and bills with no company. Filters: no company, VAT not recorded, or either; and by type. Drafts and non-GBP records are shown and can be assigned like any other;
  - **company picker** (only companies the person belongs to), checkboxes, and "Select all N shown" (the current filter);
  - **Assign to company** opens a confirmation that states how many records of which kind go to which company ("3 invoices and 1 expense will be assigned to Company Y."). One company per confirmation;
  - the update is `update({ organization_id }).in('id', …).eq('user_id', me).is('organization_id', null)`: own rows that still have no company, nothing already linked is moved. The database re-checks membership.
- **Set VAT on selected** (the bulk VAT helper, owner-approved), in the same selection:
  - **Choose** a treatment (default Standard 20%) and whether expense amounts include VAT.
  - **Preview:** records, net, VAT and total; what is left out, and why (not GBP, bills, already recorded, can't be worked out); how many totals change; and which records with no company will be assigned to the chosen company.
  - **Confirm**, then save.
  - **Invoices:** the treatment goes on every line, and VAT is added per line (P4 rules). Line prices are before VAT, as in the invoice form. The tax point is the invoice's date.
  - **Expenses:** "including VAT" keeps the amount; "excluding" adds VAT on top. The tax point is the expense's date.
  - **GBP only.** Expenses count as GBP only when the account currency is GBP.
  - **Records** are saved as `recorded`, each with an update filtered by id and `user_id`. Records with no company get the chosen company in the same save, because the database requires one.
  - It never runs without the preview and the confirmation.
- **The VAT panel** ("N records need VAT details") counts, labelled separately, the active company's records and the person's records with no company yet. Other companies' records are not counted. It links to the review.
- **Demo accounts** see the lists and counts, but no checkboxes, company picker, or assign/VAT buttons. The database still refuses their writes (tested).
- **Before the SQL is applied:**
  - rows have no `organization_id` key, so the Company columns and the assign controls are hidden, with a note;
  - a save that includes `organization_id` gets "column does not exist" and is sent once more without it (`withOptionalCompany`);
  - the panel falls back to the old no-argument call.

## Rollout order (owner)
1. **The owner reviews `docs/hmrc-p4b/proposal.sql`** (and decides on option A or B; B is recommended).
2. **The owner's assistant applies `proposal.sql` after approval:** one transaction, refuses on any drift. If chosen, `decision-b-function.sql` follows.
3. **Publish the frontend.** It is safe to publish before step 2 too (see "Before the SQL is applied").

Nothing is deployed to Edge Functions. No HMRC function or table changes.

## Owner test steps
1. **New expense:** Finance → Expenses → Add expense. The Company field shows your active company. Save. The list shows it under Company.
2. **New invoice:** Finance → New invoice. The Company field shows your active company. Save as draft. The Invoices list shows the company.
3. **Older expense:** open an expense that shows "No company". Saving asks you to choose a company first. Choose one and save.
4. **Review:** Finance → Company records.
   1. Choose a company.
   2. Tick some records, or "Select all".
   3. Press **Assign to company**. The confirmation says how many invoices, expenses and bills will go to which company.
   4. Confirm. The records disappear from "No company".
5. **Bulk VAT:**
   1. In the same screen, choose **VAT not recorded**.
   2. Tick some records and press **Set VAT on selected**.
   3. Check the preview: net, VAT and total, and what is left out (non-GBP, bills).
   4. Press Continue, then **Save VAT details**. The records now show "Recorded".
6. **The panel:** with a company selected, the VAT panel shows "Company X: …" and "With no company yet: …" on separate lines.
7. **Another company:** switch to another company (one you belong to) and add an expense. It gets that company. The first company's counts don't include it.
8. **Demo:** as the demo account, Company records shows the list without checkboxes or buttons.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx eslint .` | 509 (baseline 510) |
| `npx vitest run` | 168 files, 1,577 tests, exit 0, no "Unhandled" |
| `npm run build` | OK |
| `PG_RUN_USER=postgres bash docs/hmrc-p4b/run-test.sh` | 66 PASS, 0 FAIL (disposable local Postgres; production never touched) |

`run-test.sh` checks:
- **Production shape:** 146 tables, column signatures, and the sources of the functions P4b uses or replaces, all matching production.
- **Apply and roll back:** apply, then an empty rollback restores functions (with grants), columns, constraints, indexes, triggers and policies exactly; re-apply works.
- **Tagging and isolation:**
  - a member can tag to their own company, not to another company, a made-up id, or a company they left;
  - NULL is allowed, old rows are untouched, and a row recorded before P4b still edits;
  - a record becoming recorded needs a company, and a recorded record keeps its company;
  - cross-company isolation (B can't read or change A's rows), members' rows stay private (C and admin D of the same company see nothing of A's);
  - the attention counts work with no argument (as before) and with a company (split);
  - the demo account is refused on all three tables; service_role is not checked; anon can't call the counts.
- **The two options** (applied, tested and rolled back exactly, each in turn):
  - option A: the owner and admin read members' tagged rows, read only; unassigned rows stay private; another company's owner sees nothing; aal1 with an authenticator sees nothing;
  - option B: the totals cover recorded GBP rows with left-out counts; plain members, other companies' owners, aal1 with an authenticator, a bad period and anon are all refused;
  - the options refuse to run together.
- **Refusals:**
  - a second apply;
  - rollback while records are linked (then forced, exact);
  - rollback while a decision is applied;
  - deleting a company with records (RESTRICT);
  - column, policy or function drift. Nothing is applied after a refusal.

## Risks
- **Saving needs a company once the SQL is applied.** A record can't become VAT-recorded without one. Every person in production has at least one active company today (read 7 Nov 2026: 0 without). Someone with none would see the save refused with a plain message.
- **ON DELETE RESTRICT:** a company with finance records can't be deleted until its records are moved or deleted. This is deliberate, for accounting.
- **Someone who leaves a company** keeps their own tagged records (still only theirs). They can edit them but can't re-tag records to that company. With option B, the company's owner still gets their totals.
- **Already-recorded rows with no company** are allowed to exist, and P5 leaves them out (and counts them). The review screen's "No company" filter finds them.
- **The bulk VAT helper changes invoice totals** when old invoices had no tax. The preview counts how many totals change. Nothing is saved without the confirmation.
- **Expenses have no currency column.** They are treated as the account currency, and the bulk helper works on them only when that is GBP.
