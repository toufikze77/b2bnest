# HMRC P4: VAT data model (standard scheme, per-line VAT, "VAT not recorded" flag)

**Prepared, not applied.** No SQL has been run, nothing has been deployed, and no production data was changed or back-filled. Nothing is filed and nothing calls HMRC: P4 only stores and shows VAT, so that P5 can build a preview of boxes 1 to 9.

## Decisions (owner, not reopened)
1. **Standard scheme only.** VAT is counted at the invoice or bill date (the tax point). `vat_scheme` exists with one allowed value, `standard`, so other schemes can be added later.
2. **Five treatments**, with the rates in one file (`src/lib/vat/treatments.ts`):

   | Treatment | Rate | VAT | Notes for P5 (box mapping is P5's job) |
   |---|---|---|---|
   | `standard` | 20% | net × 20%, per line | Output VAT on sales; input VAT on reclaimable purchases |
   | `reduced` | 5% | net × 5%, per line | As standard |
   | `zero` | 0% | 0 | A taxable supply at 0%: counts in the net value boxes |
   | `exempt` | none | 0 | Not a taxable supply; reported differently from zero-rated |
   | `outside_scope` | none | 0 | Outside VAT altogether; usually left out of the return |

   Zero, exempt and outside scope all carry no VAT, but they are stored and grouped separately and never merged.
3. **Old records are flagged, never guessed.** Every existing invoice, expense and bill gets `vat_status = 'not_recorded'` from the column default.
   - Nothing splits an old gross amount, and nothing is filled in automatically.
   - Such records are excluded from VAT figures until the owner opens one, adds its VAT details and saves it.

## Rounding rule (one rule, everywhere)
- All money maths is in **integer pence** (`src/lib/vat/money.ts`).
- **VAT is worked out per line**, rounded to the penny **half away from zero** (0.5p goes up), **then the lines are summed**. This is the same as PostgreSQL's `round()`, which the database checks use.
- Mixed-rate invoices therefore reconcile exactly. For example, two 3p lines at 20% give 1p VAT each, 2p in total, not round(6p × 20%) = 1p.
- **From a gross amount:** VAT = gross × rate / (100 + rate), rounded; net = gross − VAT.
- **Expenses and bills** may differ from the calculated VAT by at most **1p** per record, to allow for how a supplier's invoice was rounded (`SUPPLIER_ROUNDING_TOLERANCE_PENCE`).

## What changed
### Database (`proposal.sql`, additive only)
- **`invoices`** gains `tax_point_date date`, `vat_scheme` (`standard` only) and `vat_status` (`recorded` | `not_recorded`, default `not_recorded`).
  - Per-line VAT lives in `items`: each line has `vat_treatment`, `vat_rate`, `net`, `vat` and `gross`, with `amount` = `net` for older screens.
  - Trigger `vat_invoice_lines_check` (`vat_check_invoice_lines()`: SECURITY INVOKER, `search_path = ''`, like the other triggers on these tables) only checks a `recorded` invoice:
    - every line has a valid treatment and `gross = net + vat`;
    - zero, exempt and outside-scope lines have rate 0 and VAT 0;
    - standard and reduced lines have VAT = round(net × rate / 100, 2);
    - the line nets equal `subtotal` and the line VAT equals `tax_amount`, to the penny, and `total_amount = subtotal + tax_amount`;
    - there is a tax-point date.
- **`expenses` and `bills`** gain `net_amount`, `vat_amount`, `vat_treatment`, `vat_rate`, `vat_status`, `vat_scheme`, `tax_point_date` and `vat_reclaimable` (default true; only meaningful for recorded rows).
  - A CHECK requires, for a `recorded` row:
    - every field present, and net + VAT = `amount` exactly;
    - VAT ≥ 0;
    - zero, exempt and outside scope with rate 0 and VAT 0;
    - standard and reduced with a rate above 0 and VAT within 1p of round(net × rate / 100, 2).
- **`vat_records_needing_attention()`**: SECURITY INVOKER (the caller's own RLS applies), granted to `authenticated` but not `anon`. It counts the caller's `not_recorded` rows:
  - invoices that are not drafts;
  - all expenses;
  - bills that are not cancelled.
- **The database never stores the rates themselves.** It only checks that a row's stored rate and VAT agree with each other and with the treatment, so a rate change is a one-line change in `treatments.ts`.
- **Not changed:**
  - `outgoings` (recurring definitions, not transactions: **P5 must not read them**), `quotes` (not supplies) and `bank_transactions`;
  - any `hmrc_*` table or function, any RLS policy, any column type.
- **No new table.** The demo read-only guard already covers all three tables, and the suite checks that a demo user is still refused.
- **Prechecks** (refuses and changes nothing if anything differs from production as read on 7 Nov 2026):
  - the column signatures of the three tables;
  - their exact trigger and policy sets;
  - `handle_updated_at` and `demo_readonly_guard` md5.

### Shared VAT logic (`src/lib/vat/`, pure functions)
- **`treatments.ts`:** treatments, rates and labels; the 1p tolerance.
- **`money.ts`:** `toPence`, `fromPence`, `splitFromGross`, `addToNet`, `sumLines` (per line, then summed, plus totals per treatment), `lineNetPence`.
- **`records.ts`:** `isRecorded`, `isRecordedInvoice`, `isRecordedMoneyOut` and `vatProblem` (the database rules, so the app never offers a save the database refuses), `vatGroupsOf`, `invoiceNeedsVat`, `moneyOutNeedsVat`, and `withOptionalVatColumns` (the fallback before the SQL is applied).
- **`expenseForm.ts`:** the expense form's VAT part.

### Invoice screen (`QuoteInvoiceCreationSection.tsx`)
- **Per line:** a VAT treatment, defaulting to Standard 20%. The single "Tax Rate (%)" box now shows for quotes only, and quotes work as before.
- **Tax point date:** defaults to today. For an older invoice it shows the date the invoice was created in B2BNEST, and is editable.
- **Totals:** net and VAT for each treatment, then the VAT total ("mixed rates" when lines differ), then the total.
- **The PDF** shows the same per-treatment lines and the tax point.
- **Saving** makes the invoice `recorded`.
  - `tax_amount` = the sum of line VAT, and `tax_rate` = the shared rate when every line has the same treatment, otherwise 0.
- **An older invoice** shows a note.
  - Each line must get a treatment before it can be saved again (nothing is guessed).
  - It changes only when the owner opens, fixes and saves it.
- **Not in GBP:** the VAT is stored as entered.
  - The form says such invoices are left out of VAT returns until currency conversion exists.
  - The invoice list tags them "Not GBP (USD)". No exchange rate is invented.
- **The invoice list:**
  - a "VAT not recorded" tag on issued invoices without a breakdown;
  - a "VAT not recorded N" filter chip.

### Expenses screen
- **The form adds:**
  - "The amount entered is: Including VAT / Excluding VAT";
  - the treatment (five choices);
  - "VAT on the receipt (optional)", within 1p of the calculated VAT;
  - "VAT can be reclaimed" (off for, for example, business entertainment).
- **The date is the tax point.** A live line shows "Net · VAT · Total".
- **Saving with a treatment** makes the expense `recorded`, with `amount` = the gross.
- **An older expense** opens with no treatment chosen ("None"). It can still be edited as before and stays "VAT not recorded" until a treatment is chosen and it is saved. Normal use is never blocked.
- **The list:**
  - a "VAT not recorded" badge;
  - a VAT column ("Not reclaimable" noted);
  - a "VAT not recorded" filter chip.

### Bills
- **Bills have no screen in B2BNEST.** Nothing in the app writes the `bills` table; production has 6 old rows.
- The columns and rules are added so a future bills screen, or an import, can record VAT the same way (`expenseForm.ts` works for bills too).
- Until then bills are counted in the attention panel (once the SQL is applied) and are all "VAT not recorded".

### The "VAT not recorded" panel and fix flow
- **The panel** sits on the Finance page, on every tab, for anyone who can see the finance data. It reads "N invoices, N expenses and N bills need VAT details", with buttons that open the invoice or expense list filtered to "VAT not recorded".
- **Counts:** invoices and expenses are counted from the lists already loaded. Bills come from `vat_records_needing_attention()`, and the bills line simply doesn't appear before the SQL is applied.
- **Demo accounts** see the counts with "Show …" buttons instead of "Add VAT details to …".
- **No new VAT figures are summed anywhere.** **P5 must read only `vat_status = 'recorded'` rows** (and only GBP invoices), and show how many rows it left out.
- **Bulk "Mark selected as standard-rated 20% (VAT included)": not built.** The list screens have no multi-select, and building it safely (selection, a confirmation showing the count and VAT total, non-GBP excluded) is more than this PR should carry. It is listed as a follow-up.

### Assistant knowledge
`ai-assistant/knowledge.ts` now says:
- VAT is recorded per line on invoices, and on expenses, for the standard scheme only;
- older records show "VAT not recorded" until fixed, and nothing is guessed;
- the Finance page shows the count;
- no VAT return is built or sent;
- flat rate and cash accounting aren't supported;
- never claim Making Tax Digital readiness.

## Whose records go into a company's return
**Finding:**
- `invoices`, `expenses` and `bills` belong to a **person** (`user_id`); RLS is "own rows only".
- Every finance screen loads `.eq('user_id', user.id)`; the active company is only a label in the page header.
- HMRC connections and VAT numbers belong to a **company** (P0, P3).

**What this implies:**
- A company's "VAT records" today are the records of the person signed in, whichever company is selected.
- **A person with several companies** has one set of finance records shared by all of them, so a return for company A would include company B's sales and costs.
- **Several people in one company** each have their own records, and a return built by one owner would miss the others' records.

**This is a real problem for P5.** A VAT return must cover exactly one VAT registration (VRN).

**Proposed fix, a separate item before P5:** add `organization_id` to `invoices`, `expenses` and `bills`.
- New records get the active company.
- A one-off, owner-confirmed assignment for existing records, like the existing "Unassigned projects" review in Settings → Company data.
- RLS by company membership.

P4 deliberately did not add `organization_id` or change RLS.

## Rollout order (owner)
1. **The owner reviews `docs/hmrc-p4/proposal.sql`.**
2. **The owner's assistant applies the SQL after review** (one transaction; refuses on any drift).
3. **Publish the frontend.** It is also safe to publish before step 2:
   - a save that includes the new VAT columns gets "column does not exist", and is sent once more without them (expenses show "Saved without VAT details…"; invoices say "VAT details will be recorded after a database update");
   - the records stay "VAT not recorded", and the panel shows no bills line.

Nothing needs deploying to Edge Functions.

## Owner test steps
1. **New invoice:** Finance → New invoice. Add two lines, Standard 20% and Zero rate, check the tax point date, and save. Expect net and VAT per treatment in the totals, and on the downloaded PDF.
2. **Older invoice:** open an older invoice. Expect the note, and a VAT choice needed on each line. Choose, save, and the "VAT not recorded" tag goes.
3. **New expense, including VAT:** Expenses → Add expense, £12 including VAT, Standard. Expect "Net £10.00 · VAT £2.00 · Total £12.00". Save; the VAT column shows £2.00.
4. **New expense, excluding VAT:** add £10 excluding VAT. It saves £12 with £2 VAT.
5. **Not reclaimable:** add a business entertainment expense with "VAT can be reclaimed" off. Expect "Not reclaimable" under its VAT.
6. **The panel:** on the Finance page, read the VAT panel's counts, press "Add VAT details to expenses", and expect the list filtered to "VAT not recorded".
7. **Non-GBP:** an invoice in USD shows "Not GBP (USD)" in the list.
8. **Demo:** as the demo account, the panel shows "Show …" buttons, and any save is refused by the database ("This is a demo account. It is view only.").

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx eslint .` | 510 (baseline 510) |
| `npx vitest run` | 1,536 / 1,536 pass (162 files), exit code 0, no "Unhandled" lines |
| `npm run build` | OK |
| Deno `ai-assistant` (knowledge and handler) | 29 / 29 pass |
| Local SQL suite (`PG_RUN_USER=postgres bash docs/hmrc-p4/run-test.sh`) | 57 / 57 PASS |

- **SQL suite** (the tests run in one transaction and are rolled back):
  - production table set and column signatures;
  - old rows `not_recorded` with nothing back-filled;
  - a valid recorded invoice for each of the five treatments, and a mixed-rate invoice;
  - refused: bad treatment, bad scheme, bad status, no tax point, zero or exempt with VAT or a rate, standard VAT not matching the rate, totals not adding up, no lines, a line without figures, an old invoice marked recorded;
  - expenses and bills valid for each treatment, the 1p tolerance (2p refused), net + VAT ≠ amount, negative VAT, missing tax point;
  - RLS unchanged (A can't see B's rows);
  - the attention counts (own rows only, drafts left out);
  - demo refused on all three tables, and anon refused;
  - exact empty and forced rollbacks, re-apply, a second apply refused, rollback refused while VAT is recorded;
  - drift refused (columns, policy, trigger), with nothing applied.
- **vitest:**
  - **money maths:** pence, rounding half away from zero, split from gross and add to net for each treatment, zero / exempt / outside scope at 0 VAT but distinct, mixed-rate reconciliation, line nets, recorded checks;
  - **the invoice form:** per-line VAT and payload, a single rate kept, an older invoice, the fallback before the SQL, the non-GBP note, quotes unchanged;
  - **the expense form:** including and excluding, outside scope and not reclaimable, the 1p tolerance, the fallback before the SQL, the old-record badge and filter;
  - **the panel:** counts, buttons, no bills line before the SQL, demo with no edit controls, hidden when nothing to fix;
  - **the invoice list:** tags and the VAT filter.
- **Existing finance tests:** green. Two changed only in their steps:
  - re-saving an older invoice now chooses a VAT treatment;
  - the expense form's new "The amount entered is" label doesn't collide with `/Amount/`.

## Risks
- **Company scoping** (above) must be fixed before P5 builds a return.
- **Expenses have no currency column.** They are in the account currency, so P5 must treat expenses as GBP only when the account currency is GBP.
- **Invoices' numeric columns are `numeric(10,2)`.** Very large invoices (over £99,999,999.99) can't be stored, as today.
- **Invoices default to USD in the database.** The app always sends the currency explicitly; old rows with a USD or empty currency show "Not GBP".
- **The tax point for an older invoice** is prefilled from the date it was created in B2BNEST, which the owner should check when fixing it.
- **`vat_reclaimable`** is stored but not yet used. P5 must leave non-reclaimable VAT out of input VAT.
- **Credit notes** (negative lines) round half away from zero but are otherwise not designed for. Credit notes are out of scope.

## Out of scope
Flat rate scheme, cash accounting, EU / Northern Ireland boxes, currency conversion, credit notes, a bills screen, the bulk "mark selected as standard-rated" helper, building or sending a VAT return (P5 onwards), and any HMRC call.
