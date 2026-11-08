// COPY of src/lib/vat/treatments.ts for the Edge Functions (Deno needs .ts imports). Keep both identical: src/lib/vat/returnBoxes.parity.test.ts checks it.
// HMRC P4: the five UK VAT treatments B2BNEST records (standard scheme only). The ONE place the rates live: change a
// rate here (the database only checks that a stored rate and VAT agree with each other, docs/hmrc-p4/proposal.sql).
// Zero-rated, exempt and outside the scope of VAT all carry no VAT, but they are different treatments and are reported
// differently in a return (P5), so they are never merged.
export const VAT_TREATMENTS = ['standard', 'reduced', 'zero', 'exempt', 'outside_scope'] as const;
export type VatTreatment = typeof VAT_TREATMENTS[number];

export const VAT_RATES: Record<VatTreatment, number> = { standard: 20, reduced: 5, zero: 0, exempt: 0, outside_scope: 0 };

export const VAT_TREATMENT_LABELS: Record<VatTreatment, string> = {
  standard: `Standard rate (${VAT_RATES.standard}%)`,
  reduced: `Reduced rate (${VAT_RATES.reduced}%)`,
  zero: 'Zero rate (0%)',
  exempt: 'Exempt',
  outside_scope: 'Outside the scope of VAT',
};
/** Short names for totals grouped by treatment. */
export const VAT_TREATMENT_SHORT: Record<VatTreatment, string> = {
  standard: `Standard ${VAT_RATES.standard}%`, reduced: `Reduced ${VAT_RATES.reduced}%`, zero: 'Zero rate', exempt: 'Exempt', outside_scope: 'Outside scope',
};

export const VAT_SCHEME = 'standard' as const;
export const DEFAULT_TREATMENT: VatTreatment = 'standard';
/** Supplier invoices can round VAT differently: a record may differ from the calculated VAT by at most this (pence). */
export const SUPPLIER_ROUNDING_TOLERANCE_PENCE = 1;

export const VAT_NOT_RECORDED = 'VAT not recorded';

export const isVatTreatment = (v: unknown): v is VatTreatment => typeof v === 'string' && (VAT_TREATMENTS as readonly string[]).includes(v);
export const carriesVat = (t: VatTreatment) => VAT_RATES[t] > 0;
