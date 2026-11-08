# Accessibility (WCAG 2.2 AA): quick audit of the HMRC VAT screens (P7a)

**This is a quick manual audit, not a WCAG conformance claim.**
- The repository has no axe tooling (no `axe-core`, `vitest-axe` or `@axe-core/playwright` in `package.json`), and adding a dependency was out of scope.
- The checks below come from reading the code, and from the testing-library tests that pin the fixes.
- **No screen reader or full keyboard walk-through has been done.** That is the main follow-up.

**Screens covered:**
- the VAT return screen (`src/components/hmrc/HMRCVATReturns.tsx`);
- the submit panel and the submission history table (`HMRCVATSubmit.tsx`);
- the HMRC connection card (`HMRCConnectionPanel.tsx`).

## Checklist

| Check (WCAG) | VAT return screen | Submit panel | Connection card | History table |
| --- | --- | --- | --- | --- |
| **Labels** (1.3.1, 3.3.2, 4.1.2) | Pass: date fields, obligation select and radios all labelled. **Fixed:** the radio group now has a real `<legend>` instead of `aria-label` | Pass: obligation and scenario selects, the period-key field, and the declaration checkbox (wrapped in its label) | Pass: buttons have visible text; icons are `aria-hidden` | Pass: `<caption>` (screen-reader only), `scope="col"`, the download button has `aria-label="Download receipt for <period>"` |
| **Focus order** (2.4.3) | Pass: follows the visual order | **Fixed:** after Submit the button disappears, so focus fell back to the page. Focus now moves to the result (`vats-result`, `tabIndex=-1`) | Pass | Pass |
| **Visible focus** (2.4.7) | Pass: shared `Button`, `Input` and select classes use `focus-visible:ring-2` | Pass. Native checkbox: browser focus ring | Pass | Pass |
| **Keyboard use of the confirm box** (2.1.1) | — | Pass: Tab goes checkbox (Space ticks) → period key → Submit. Nothing needs a mouse. The fraud-header check is a native `<details>` | Pass | Pass |
| **Status not by colour alone** (1.4.1) | **Fixed:** the period error was red text only and not tied to the fields. It now has `role="alert"`, and both date fields get `aria-invalid` and `aria-describedby`. Badges are text ("Not confirmed by HMRC", "not supported yet") | Pass: every result has a title in words ("accepted", "Not accepted", "We don't know if HMRC received it") plus an icon; the colour is extra | Pass: the state is a sentence ("Connected to HMRC") | Pass: the status is a word ("Accepted", "Rejected", "Unknown: check with HMRC") |
| **Status messages announced** (4.1.3) | Pass: notes `role="status"`, failures `role="alert"` | **Fixed:** an accepted result had no role, so it wasn't announced. It is now `role="status"`; rejected and unknown are `role="alert"` | Pass: `aria-live="polite"` line | — |
| **Why a control is disabled** (3.3.2) | Partly: Show preview is disabled with an error | **Fixed:** a hint "Tick the declaration and type the period key to turn on the submit button", linked with `aria-describedby` while the button is off | — | — |
| **Contrast** (1.4.3) | Computed from the tokens in `src/index.css`. `--muted-foreground` #4A5873 on white is about 7.4:1 and on #F2F5FA about 6.8:1. Dark mode: 70% lightness on 8% background, well above 4.5:1. Amber, red and emerald alerts use 950-shade text on 50-shade backgrounds (above 10:1) | as left | as left | as left |
| **Tables** (1.3.1) | Pass: the nine boxes use `<th scope="row">`, the totals tables have captions | Pass: the prepared-return table has a caption and row headers | — | Pass |
| **Reflow at 320px** (1.4.10) | Tables scroll inside `overflow-x-auto`. Not checked in a browser | as left | as left | `min-w-[560px]` inside a scroll box. Not checked in a browser |

## Tests pinning the fixes

- `src/components/hmrc/hmrcP6.test.tsx` → "P7a: accessibility of the submit section":
  - the hint and `aria-describedby`;
  - focus moves to the result;
  - the accepted result has `role="status"`.
- `src/components/hmrc/hmrcP5.test.tsx` → "a back-to-front period…":
  - the error has `role="alert"`;
  - the fields get `aria-invalid` and `aria-describedby`;
  - the group is named by its legend.

## Follow-ups (not done here)

1. Run axe on these screens (add `@axe-core/playwright` or `vitest-axe` as a dev dependency) and fix what it finds.
2. A keyboard-only and screen reader pass (NVDA with Firefox, VoiceOver with Safari) through connect → obligations → prepare → submit → check.
3. Reflow and 200% zoom check at 320px wide in a real browser.
4. The rest of the app has not been audited. Don't describe B2BNEST as WCAG AA compliant until this has been done.
