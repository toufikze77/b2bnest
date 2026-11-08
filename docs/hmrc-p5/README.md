# HMRC P5: VAT return preview (nothing is sent)

**Status: SQL prepared, NOT applied.** No HMRC write or submit call exists anywhere. Nothing is stored. Production HMRC stays refused. Nothing in B2BNEST claims Making Tax Digital readiness.

## What changed
- **SQL (`proposal.sql`, not applied):** one new read-only function, `public.vat_company_return_preview(company, from, to)`.
  - SECURITY DEFINER, `search_path ''`, executable by `authenticated` only (not `anon`).
  - **Gates, in order:**
    1. signed in;
    2. `mfa_ok()`: the two-step code has been entered when the person has an authenticator;
    3. not the demo account;
    4. `hmrc_manage_allowed(company, caller) = 'ok'`. This is the **existing** plan and role rule every HMRC feature uses since P0: an active member, on Business (`professional`), Scale (`enterprise`), the trial or an owner account, not suspended, **and** an owner or admin of the company. It is reused, not copied, so the plan rule is enforced in SQL as well as in the app;
    5. a valid period (from ≤ to).
  - **It returns totals only.** It never returns a row, a name, an address, a note or a single record's amount. The output is:
    - **included:** per source (invoices = sales, read **per line** from `items`; expenses and bills = purchases) and per VAT treatment, it gives the record count, net, VAT (reclaimable VAT only, for purchases) and VAT not reclaimable;
    - **left out:** per source and reason, a count (and the VAT, for "VAT not reclaimable"). The reasons are not recorded, no company, not GBP, draft, archived, cancelled, tax point outside the period, and VAT not reclaimable.
  - **Rounding:** it sums the stored line and record amounts in `numeric`. Nothing is recalculated.
  - **Never read:** `quotes`, `outgoings`, `bank_transactions`. No table, policy or other function is changed.
  - **Drift guards:** like P4b, it refuses if production differs from what was read on 8 Nov 2026 (P4, P4b and P4b option B applied). It checks the column signatures of `invoices`, `expenses`, `bills` and `organization_members`, plus `profiles.currency_code`, `demo_readonly_users`, and the sources of `hmrc_manage_allowed`, `mfa_ok`, `user_is_organization_member` and `vat_company_records_summary`.
- **`src/lib/vat/returnRules.ts`:** every HMRC rule the preview uses, each marked **not verified**, in one file so each is easy to change. It includes `WHOLE_POUND_ROUNDING = 'down'`.
- **`src/lib/vat/returnBoxes.ts`:** turns the function's output into boxes 1 to 9.
  - It works in integer pence, and boxes 6 to 9 are in whole pounds.
  - It also provides `explainBox(n)`, the left-out labels, and the CSV.
- **HMRC → VAT Returns** (`src/components/hmrc/HMRCVATReturns.tsx`) replaces the example figures:
  - **Period:** "Choose dates" or "Use an HMRC obligation". Obligations are read from the test environment (open, and fulfilled from the last year) and are only available when the company is connected. If HMRC can't be read, the dates still work and the screen says the period is **not confirmed by HMRC**.
  - **The nine boxes:** each with its figure, a one-line explanation, and "not supported yet" on 2, 8 and 9. Box 5 says "to pay", "to reclaim" or "nothing to pay".
  - **"How this was worked out":** totals per treatment for sales and purchases.
  - **Left-out panel:** counts and reasons, with links to fix them (Finance → Invoices, Expenses, Company records).
  - **Warnings, when relevant:** records not recorded, records with no company, non-GBP records, a period that hasn't ended. Always shown: boxes 2, 8 and 9 aren't supported, and there are no credit notes.
  - **Download preview (CSV):** the nine boxes and the per-treatment totals, written in the browser. It contains no individual record.
  - **No submit button, no "ready to file" wording, nothing stored.** The amber banner stays: "HMRC filing is not available yet. Nothing has been sent to HMRC." with "Preview only: nothing is sent to HMRC. …".
  - **States:**
    - a member sees "Only owners and admins can see the VAT return.";
    - Solo sees "HMRC tools are included in the Business and Scale plans.";
    - the demo account sees no controls;
    - a production connection shows "Production is not available yet.";
    - there are also two-step, loading, empty, error (with Try again) and "not available yet" states (the last one appears while the SQL is not applied).
- **Assistant** (`supabase/functions/ai-assistant/knowledge.ts`): describes the preview. It is a preview only, standard scheme only, the rules are not verified, nothing is filed, and members, Solo and the demo account can't see it. `knowledge_test.ts` has a new test.

## HMRC facts used (all from memory, NOT verified)
This environment cannot open HMRC's pages (`www.gov.uk` and `developer.service.hmrc.gov.uk` are not reachable here). Every rule below is **not verified** and should be checked against HMRC's VAT guidance (for example VAT Notice 700/12, "How to fill in and submit your VAT Return") before P6. They live in `src/lib/vat/returnRules.ts`.

| # | Rule | Verified? |
|---|---|---|
| 1 | Nine boxes: 1 VAT due on sales; 2 VAT due on acquisitions from the EU / NI; 3 total VAT due; 4 VAT reclaimed on purchases; 5 net VAT; 6 total sales excluding VAT; 7 total purchases excluding VAT; 8 supplies of goods to the EU / NI; 9 acquisitions of goods from the EU / NI | not verified |
| 2 | Box 3 = box 1 + box 2 | not verified |
| 3 | Box 5 = the difference of 3 and 4, entered as a positive figure; to pay or to reclaim follows from which is larger | not verified |
| 4 | Boxes 1 to 5 in pounds and pence; 6 to 9 in whole pounds | not verified |
| 5 | Boxes 6 to 9: pence dropped (rounded down), `WHOLE_POUND_ROUNDING = 'down'` | not verified |
| 6 | Box 6 includes standard, reduced, zero-rated and exempt sales; outside the scope of VAT is left out. Box 7 the same for purchases | not verified |
| 7 | Box 1 = VAT on standard and reduced sales | not verified |
| 8 | Box 4 = reclaimable VAT on purchases; non-reclaimable VAT is left out of box 4, but the net still counts in box 7 | not verified |
| 9 | Standard scheme: VAT is counted at the tax point (invoice date for sales; bill or expense date for purchases) | not verified |

## Box rules (what the preview does)
| Box | Built from | Unit |
|---|---|---|
| 1 | VAT on **standard and reduced** sales **lines** | £ and pence |
| 2 | 0.00: EU / NI acquisitions not supported yet | £ and pence |
| 3 | 1 + 2 | £ and pence |
| 4 | **Reclaimable** VAT on expenses and bills (standard and reduced) | £ and pence |
| 5 | \|3 − 4\|, with to pay / to reclaim / nothing to pay | £ and pence |
| 6 | Net of standard, reduced, zero-rated and exempt sales lines (outside scope left out) | whole £, rounded down |
| 7 | Net of standard, reduced, zero-rated and exempt purchases, **including** purchases whose VAT isn't reclaimable (outside scope left out) | whole £, rounded down |
| 8 | 0: not supported yet | whole £ |
| 9 | 0: not supported yet | whole £ |

**What counts (the P5 rule from P4b):**
- `vat_status = 'recorded'`, `organization_id` = the company, and the tax point inside the period (inclusive);
- **invoices:** not draft, not archived, currency GBP;
- **bills:** not cancelled, currency GBP;
- **expenses:** these have no currency column, so they count when **their owner's** account currency (`profiles.currency_code`) is GBP. This is the same "account currency" the expense screen uses.

**What is counted as left out:** only records dated in the period (by tax point, or by the record's own date). The reasons are draft, archived, cancelled, not recorded, not GBP, and a tax point outside the period although the record is dated inside it. "No company" counts records by this company's **active members** that are dated in the period and not linked to any company.

## Out of scope
- Flat rate scheme, cash accounting, annual accounting.
- EU / Northern Ireland boxes 2, 8 and 9 (shown as 0).
- Credit notes and bad-debt relief: there are no credit notes in B2BNEST.
- Partial exemption.
- Imports, postponed VAT accounting and reverse charge.
- Non-GBP records: there is no currency conversion.
- Rounding of partial periods.
- Storing a return, submitting it to HMRC (P6), and production HMRC.

## Rollout order (owner)
1. **The owner reviews `docs/hmrc-p5/proposal.sql`.** It needs HMRC P0, P4, P4b and P4b option B in production, which is the case as of 8 Nov 2026.
2. **The owner's assistant applies it after approval:** one transaction, refused on any drift.
3. **Publish the frontend.** Before step 2 the VAT return tab works but answers "The VAT return preview is not available yet." It does not crash.

Nothing is deployed to Edge Functions. No secret is needed.

## Owner test steps
### A worked example you can check by hand
Use a company you own (Business, Scale or trial) and a quiet test period, for example a past month with no other records. All amounts in GBP.

1. **Sales:** create and send four invoices dated in that period:
   - **Standard:** one line at Standard 20%, £1,000.00 (VAT £200.00).
   - **Reduced:** one line at Reduced 5%, £100.00 (VAT £5.00).
   - **Zero:** one line at Zero rate, £50.00.
   - **Outside scope:** one line at Outside the scope of VAT, £300.00.
2. **Purchases:** add two expenses dated in that period:
   - **Reclaimable:** £360.00 **including** VAT, Standard 20%, VAT can be reclaimed: net £300.00, VAT £60.00.
   - **Not reclaimable:** £180.00 including VAT, Standard 20%, **VAT can be reclaimed off** (for example business entertainment): net £150.00, VAT £30.00.
3. **Open the preview:** HMRC Integration → VAT Returns → Choose dates (that period) → **Show the preview**.
4. **Check the boxes.** By hand:

   | Box | Expected | Why |
   |---|---|---|
   | 1 | 205.00 | 200 + 5 (zero and outside scope have no VAT) |
   | 2 | 0.00 | not supported |
   | 3 | 205.00 | 205 + 0 |
   | 4 | 60.00 | the non-reclaimable £30 is left out |
   | 5 | 145.00, to pay | 205 − 60 |
   | 6 | 1150 | 1,000 + 100 + 50; the £300 outside-scope sale is left out |
   | 7 | 450 | 300 + 150; the purchase with non-reclaimable VAT still counts |
   | 8 | 0 | not supported |
   | 9 | 0 | not supported |

5. **Check the breakdown:** open **How this was worked out**. Expect four sales treatments (the outside-scope line on its own), and purchases at Standard 20% with net £450.00, VAT £60.00 and not reclaimable £30.00.
6. **Check the left-out panel:** "1 expense: VAT not reclaimable … (£30.00 of VAT)".
7. **Download:** press **Download preview (CSV)** and open it. Expect the nine boxes and the per-treatment totals, and no invoice numbers or names.

### The other states
8. **Missing VAT details:** add an invoice in the same period without VAT details (an older one), or leave one unlinked to a company. Expect it under "Left out", with a link to fix it, and the figures unchanged.
9. **Obligations:** if the company is connected to HMRC's test environment, choose **Use an HMRC obligation**, press **Get obligations**, pick one, and show the preview. The badge reads "HMRC obligation (test environment)".
10. **Member:** as a plain member of the company, expect "Only owners and admins can see the VAT return."
11. **Solo:** on a Solo account, expect "HMRC tools are included in the Business and Scale plans."
12. **Demo:** as the demo account, expect no controls.

**Check every figure with your accountant before relying on it.** The rules above are not verified against HMRC.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx eslint .` | 509 (baseline 510) |
| `npx vitest run` | 174 files, 1,633 tests, exit 0, no "Unhandled" |
| `npm run build` | OK |
| `PG_RUN_USER=postgres bash docs/hmrc-p5/run-test.sh` | 46 PASS, 0 FAIL (disposable local Postgres; production never touched) |
| `deno test supabase/functions/ai-assistant/` | 30 passed (run with `--no-check=remote` and a local import map: `deno.land` is blocked here) |

**The SQL suite** (`test.sql`) covers:
- a mixed-rate invoice split per line (standard, reduced, outside scope), plus zero and exempt;
- outside scope as its own line;
- non-reclaimable VAT kept out of reclaimed VAT but shown in the left-out panel;
- GBP only, including an expense whose owner's currency is USD;
- draft, archived and cancelled records, and not recorded, outside the period and no company, each counted;
- inclusive period edges, and the next period;
- another company's records and unassigned records never counted;
- totals only;
- refused: a plain member, another company's owner, a plan without HMRC tools, the demo account, a person with an authenticator at aal1 (then allowed at aal2), no sign-in, and anon;
- nothing written.

The runner also checks production's shape, apply and an exact rollback, that the preview changes nothing, a refused second apply, and that drift (a column or the plan rule) is refused before anything changes.

**Vitest:**
- `returnBoxes.test.ts`:
  - the worked example;
  - box 3 = 1 + 2, and box 5 with to pay, to reclaim and nil;
  - whole-pound rounding down;
  - outside scope excluded, zero-rated and exempt included;
  - exact pence;
  - explanations, and every rule not verified;
  - the CSV.
- `hmrcP5.test.tsx`:
  - the role and plan states: admin, member, Solo, demo, production, loading;
  - not connected (dates, not confirmed);
  - success, the left-out panel and the warnings, a period not ended, empty;
  - SQL missing, the database refusals and the error state, and a back-to-front period;
  - an obligation sets the period, and a failed HMRC read falls back to dates;
  - the CSV.
- `src/test/hmrcNoSimulatedFiling.test.tsx` still passes: the banner shows and there is no enabled submit button.

## Risks
- **Rules not verified:** the box rules come from memory, not from HMRC's pages. Treat every figure as a preview to check with an accountant.
- **Data quality decides the figures.** Records without VAT details or a company are left out, and the screen counts them. Old invoices bulk-set to VAT may change totals (P4b).
- **Expenses' currency:** this follows each expense owner's account currency. A member whose account currency isn't GBP has their expenses left out as "not GBP".
- **"No company" counts** look at the company's active members. A member who works for several companies may have unassigned records that belong elsewhere: the count is a prompt, not a figure.
- **Left-out counts** only cover records dated in the period. A not-recorded record from another period isn't counted here.
- **No credit notes and no corrections**, so a period with refunds or errors can't be shown correctly.
- **Obligations come from HMRC's test environment** (sandbox) only.
- **The phone layout** was checked only through the components' responsive classes (the tables scroll sideways). It was not checked in a real signed-in browser.
