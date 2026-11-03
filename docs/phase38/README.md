# Phase 38: free tools for everyone, a proper ROI calculator, tool fixes, advert banner

This phase is frontend only: no SQL, no Edge Function changes, no deploys and no new dependencies.

## Which tools are free
The list lives in one place, `src/lib/freeTools.ts` (`FREE_TOOL_IDS`). Business Tools decides "free or premium" from it, so the badges, the Free filter count and the Premium count all follow it.

- **Newly free:** ROI Calculator, Goal Tracker, Customer Survey Builder, Cost Calculator, Business Setup Checklist, Compliance Checker and Best Practices Guide.
- **Already free:** Create Coupon, QR Code Generator, Currency Converter, Business Resources and NotePro.
  - NotePro still needs signing in. It saves notes to the account (`notes` table), so it can't work without one. Nothing changed there.
- **Who can open them:** signed-out visitors, accounts with no plan, trial-ended and suspended accounts, and paying accounts.
  - There is no sign-in prompt, no upgrade prompt and no database call.
  - `PaywallGate` now lets `/business-tools?tool=<free tool>` through for trial-ended and suspended accounts. The overview page (`/business-tools`) is gated as before.
- **Unchanged:** the Business Finance Assistant, HMRC, CRM and every other premium tool keep their account and plan rules.

## Browser-only data
Nothing new is stored on B2BNEST's servers. Each tool that keeps data says: "Saved in this browser only. Clearing your browser data removes it, and it does not appear on your other devices."

| Tool | What is kept, and where |
|---|---|
| ROI Calculator | up to 5 scenarios, in `localStorage` (`b2bnest.roi.scenarios.v1`) |
| Goal Tracker | up to 10 goals, in `localStorage` (`goalTrackerGoals`); goals saved before still load |
| Customer Survey Builder | up to 5 surveys, in `localStorage` (`b2bnest.surveys.v1`) |
| Business Setup Checklist | ticked steps, in `localStorage` (`b2bnest.setupChecklist.v1`) |
| Cost Calculator, Compliance Checker, Best Practices Guide | nothing saved |
| Advert card | "hidden for now", in `sessionStorage` (this browser session only) |

Every read and write is wrapped in try/catch. Broken saved data is skipped, not shown.

## Advert card
The component is `src/components/FreeToolsBanner.tsx`; its content is in `src/data/freeToolsPromos.ts`.

- **Where it appears:** above every free tool, and on the overview when the Free filter is on.
- **Compliance:**
  - a visible "Advert" label;
  - "Not financial advice. Check the terms with the provider.";
  - dismissed for the browser session only;
  - no tracking, no analytics and no cookies.
- **Business Finance Assistant:** the copy matches what it does today: quotes, invoices, what is owed, expenses, outgoings, suppliers and products.
  - It says it needs an account and a plan, with a 14-day trial.
  - It links to `/business-tools?tool=business-finance-assistant`.
- **Referral partners (follow-up to #65):** partners are grouped by category, in `REFERRAL_GROUPS` and `REFERRAL_PARTNERS` in `src/data/freeToolsPromos.ts`.
  - It ships with one group, **"Banking & finance"**, shown by default, and one entry: **Revolut Business**.
  - The Revolut name, description and referral link live in `src/data/referralLinks.ts`. The Business Resources page and the card both use that file, so the link is kept in one place.
  - The card never shows a group without entries, or an entry without a link.
  - With two or more groups that have entries, the card shows a group selector. It works with arrow keys, Home and End, and the selected group is announced. "Banking & finance" comes first, and the choice is remembered for this browser session only.

### How to change the referral partners
- **The Revolut link:** edit `REVOLUT_BUSINESS.url` in `src/data/referralLinks.ts`. The card and the Business Resources page both change.
- **An offer line:** add `offer: '<exactly as the partner states it>'` to the entry in `REFERRAL_PARTNERS`, and remove it when it ends.
  - Don't add rates, bonuses or fees the partner hasn't given you in writing.
- **Another partner:** add an entry to `REFERRAL_PARTNERS`:

  ```ts
  { id: 'unique-id', name: "<the partner's own name>", description: '<one line>', url: 'https://<your referral link>', group: 'banking' }
  ```

  Without a `url` it isn't shown.
- **Another group** (for example accounting software, insurance, payments or legal):
  - add `{ id: 'accounting', label: 'Accounting software' }` to `REFERRAL_GROUPS`, in the order it should appear;
  - give its entries `group: 'accounting'`;
  - the selector appears once two groups have entries.

Next to the links, the card always shows "We may earn a commission if you open an account through these links". The links open in a new tab with `rel="sponsored noopener noreferrer"`.

## What was found and fixed, per tool

### ROI Calculator
Rebuilt; the maths is in `src/lib/roi.ts`.

Found:
- amounts in US dollars;
- kept in React state only, so everything was lost on refresh;
- annualised ROI used returns ÷ investment, ignored ongoing costs, and was stored as a fraction but shown as a percentage;
- a timeframe of 0 silently became 12;
- errors appeared in toasts only;
- invented labels ("Excellent", "Good");
- "Delete one to add another", but there was no delete button.

Now:
- **Inputs:** investment, optional monthly cost, total or monthly return, months, optional residual value and an optional yearly discount rate.
- **Outputs**, each with a one-line explanation:
  - net profit, and ROI on the total cost;
  - payback;
  - compound annualised ROI, for 12 months or more (it says why not for shorter periods);
  - monthly break-even, and NPV.
- **Verdict:** a one-line summary that is never advice.
- **Scenarios:** up to 5 compared side by side.
  - The best ROI is marked "(best ROI)" in text.
  - A chart with a table version, CSV export through `tableToCsv`, and "Clear all".

### Cost Calculator
Rebuilt for the UK; the logic is in `src/lib/costCalculator.ts`.

Found:
- US structures and fees: LLC, EIN, state filing, registered agent, and a "State" field;
- `$` and `£` figures mixed together;
- a "Business size" field that did nothing.

Now:
- **Structures:** sole trader, partnership, limited company and LLP.
- **Steps:** required and optional steps, each with a GOV.UK link and an amount the user types.
- **Totals:** required, included optional, and how many required items have no amount yet; plus CSV export.
- **No fee figures are filled in:**
  - `www.gov.uk` was blocked by this session's network policy, so no fee could be verified. Each step says to check the current fee on its official page.
  - The links are the GOV.UK URLs already in the repo (`src/data/ukOfficialLinks.ts`).

### Goal Tracker
Found:
- no edit, although an edit icon was imported;
- a US-style "$10K" example;
- dates went through UTC, so they could show a day out;
- days were counted by hours, not calendar days;
- completed goals couldn't be reopened;
- broken saved data could show "Invalid Date";
- delete didn't ask first.

Fixed:
- **Edit:** goals can now be edited.
- **Dates:** due dates in words ("Overdue by 2 days", "Due today", "Completed"), and dates as 2 Nov 2026.
- **Progress:** a labelled progress bar with a text value; ±10% buttons, which can also reopen a completed goal.
- **Errors:** shown under the field.
- **Delete** asks first, and broken saved data is skipped.

### Customer Survey Builder
Found:
- "Publish" said "Your survey is now live and ready to collect responses";
- an info card promised share options (email, SMS, website embed), analytics and exports;
- **none of this existed**: there was no link, and nothing collected answers;
- kept in React state only;
- no edit, delete or reorder.

Fixed:
- **Honest copy:** Publish and the false claims are removed. The tool says plainly that it doesn't publish surveys or collect answers.
- **Saving:** surveys are saved in the browser.
- **Editing:** edit, delete, move questions up and down, a required flag, and a preview.
- **Taking it elsewhere:** copy or download the questions as text, to paste into your own form or an email.

### Business Setup Checklist
Found:
- US steps: an EIN from the IRS, state filings, federal licences;
- not saved;
- cards that only a mouse could tick;
- invented "resources" that linked nowhere, and invented time estimates.

Fixed:
- **UK steps:** structure, name, Companies House, HMRC, VAT, bank, records, insurance, data protection and the ICO, and PAYE.
- **Links:** each step has a GOV.UK link where one exists.
- **Interaction:** real checkboxes, saved in the browser, a Reset button and an accessible progress bar.

### Compliance Checker
Found:
- US rules: I-9, workers' compensation, the IRS, "state";
- penalties in dollars;
- two industries with no data at all.

Fixed:
- **UK questions:** structure, employing staff, personal data and the VAT threshold.
- **Results:** the UK duties that follow, each linked to the GOV.UK page it is based on.
- **Disclaimer:** a clear "General guidance, not legal advice" line.
- **No figures:** no penalties or other figures are stated.

### Best Practices Guide
Found:
- unsupported ratings ("high impact", difficulty levels) and invented time estimates;
- invented resource names;
- a wrong category ("AI Automation");
- "proven strategies" and "legally-sound";
- US spellings.

Fixed:
- **Removed:** the ratings, time estimates, resource names, wrong category and claims.
- **Spelling:** UK spelling throughout.
- **Links:** GOV.UK record-keeping links where relevant.
- **Disclaimer:** a general-guidance line.

The steps and common mistakes are kept.

## Text updated
- **Help FAQ ("Do I need an account…"):** the free tools work without an account and keep their data in the browser.
- **`ai-assistant/knowledge.ts`** (text only, not deployed):
  - lists the free tools and their limits;
  - describes the ROI, Survey and Cost tools accurately;
  - `knowledge_test.ts` is updated for the new sentence.
- **Financial tools guide:** what the ROI Calculator now calculates. It still doesn't calculate IRR.
- **`src/test/noInventedClaims.test.ts`:** "Net present value" is no longer a banned claim, because it is built now.

## Checks
- tsc: clean.
- eslint: 510. The baseline is lowered from 512.
- vitest: 1,377 / 1,377 pass.
- build: OK.
- Deno `ai-assistant` tests: 29 / 29 pass.
