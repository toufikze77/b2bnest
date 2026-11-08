// COPY of src/lib/vat/returnRules.ts for the Edge Functions (Deno needs .ts imports). Keep both identical: src/lib/vat/returnBoxes.parity.test.ts checks it.
// HMRC P5: the VAT return rules the preview uses, in ONE place so each is easy to change. These are written from
// memory: this environment cannot open HMRC's pages, so every one is marked NOT VERIFIED until checked against HMRC's
// own guidance (VAT Notice 700/12, "How to fill in and submit your VAT Return"). docs/hmrc-p5/README.md lists them.
import type { VatTreatment } from './treatments.ts';

export interface ReturnRule { id: string; text: string; verified: boolean }

export const VAT_RETURN_RULES: ReturnRule[] = [
  { id: 'nine_boxes', text: 'A VAT return has nine boxes (1 VAT due on sales, 2 VAT due on acquisitions from the EU/NI, 3 total VAT due, 4 VAT reclaimed on purchases, 5 net VAT, 6 total sales excluding VAT, 7 total purchases excluding VAT, 8 supplies of goods to the EU/NI, 9 acquisitions of goods from the EU/NI).', verified: false },
  { id: 'box3', text: 'Box 3 = box 1 + box 2.', verified: false },
  { id: 'box5', text: 'Box 5 is the difference between boxes 3 and 4, entered as a positive figure; whether it is to pay or to reclaim follows from which is larger.', verified: false },
  { id: 'pence', text: 'Boxes 1 to 5 are in pounds and pence; boxes 6 to 9 in whole pounds.', verified: false },
  { id: 'whole_pounds', text: 'For boxes 6 to 9 the pence are dropped (rounded down).', verified: false },
  { id: 'box6_treatments', text: 'Box 6 includes standard, reduced, zero-rated and exempt sales; sales outside the scope of VAT are left out. Box 7 is the same for purchases.', verified: false },
  { id: 'box1', text: 'Box 1 is the VAT on standard- and reduced-rated sales.', verified: false },
  { id: 'box4', text: 'Box 4 is the VAT you can reclaim on purchases; VAT you cannot reclaim (for example business entertainment) is left out of box 4, but the purchase still counts in box 7 (excluding VAT).', verified: false },
  { id: 'standard_scheme', text: 'On the standard scheme VAT is counted at the tax point (the invoice date for sales, the bill or expense date for purchases).', verified: false },
];

/** Boxes 6 to 9: whole pounds, pence dropped. NOT VERIFIED (see VAT_RETURN_RULES 'whole_pounds'). */
export const WHOLE_POUND_ROUNDING = 'down' as const;
/** Treatments that count in boxes 6 and 7 (values excluding VAT). NOT VERIFIED. */
export const VALUE_BOX_TREATMENTS: readonly VatTreatment[] = ['standard', 'reduced', 'zero', 'exempt'];
/** Treatments whose VAT counts in box 1 (sales) and box 4 (purchases). NOT VERIFIED. */
export const VAT_BOX_TREATMENTS: readonly VatTreatment[] = ['standard', 'reduced'];
/** Boxes B2BNEST can't fill yet: EU / Northern Ireland acquisitions and supplies. Always 0. */
export const UNSUPPORTED_BOXES = [2, 8, 9] as const;
