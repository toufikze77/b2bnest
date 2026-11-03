// Phase 38: the UK start-up cost calculator. No fee is filled in: fees change and none could be checked when this was
// written (see src/data/ukOfficialLinks.ts), so each official step links to GOV.UK and the user types the amount.
import { tableToCsv, type Cell, type Column } from '@/lib/adminMetricsCore';
import { GOV } from '@/data/ukOfficialLinks';

export type Structure = 'sole_trader' | 'partnership' | 'limited_company' | 'llp';
export const STRUCTURES: { id: Structure; label: string; link: string }[] = [
  { id: 'sole_trader', label: 'Sole trader', link: GOV.soleTrader },
  { id: 'partnership', label: 'Partnership', link: GOV.setUpBusiness },
  { id: 'limited_company', label: 'Limited company', link: GOV.limitedCompany },
  { id: 'llp', label: 'Limited liability partnership (LLP)', link: GOV.setUpBusiness },
];

export interface CostItem { id: string; name: string; required: boolean; note: string; link?: string }

const COMMON_OPTIONAL: CostItem[] = [
  { id: 'bank', name: 'Business bank account', required: false, note: 'Fees vary by bank. Keeping business money separate makes records and tax easier.' },
  { id: 'accountant', name: 'Accountant or bookkeeping software', required: false, note: 'Prices vary. Type in quotes you have had.' },
  { id: 'insurance', name: 'Business insurance', required: false, note: "Prices vary. Some cover is required by law, for example employers' liability insurance once you employ people.", link: GOV.employingStaff },
  { id: 'ico', name: 'Data protection fee (ICO)', required: false, note: 'Most organisations that use personal data must pay a fee to the ICO unless they are exempt. Check whether it applies to you.', link: GOV.dataProtection },
  { id: 'vat', name: 'VAT registration', required: false, note: 'Needed if your taxable turnover goes over the VAT threshold, or if you choose to register. Check the current threshold.', link: GOV.registerVat },
];

export const COST_ITEMS: Record<Structure, CostItem[]> = {
  sole_trader: [
    { id: 'sa', name: 'Register for Self Assessment with HMRC', required: true, note: 'Check the official page for how and when to register.', link: GOV.soleTrader },
    ...COMMON_OPTIONAL,
  ],
  partnership: [
    { id: 'partnership_hmrc', name: 'Register the partnership and each partner with HMRC', required: true, note: 'Check the official page for how and when to register.', link: GOV.setUpBusiness },
    { id: 'agreement', name: 'Partnership agreement (drawn up by a solicitor)', required: false, note: 'Not required by law, but common. Prices vary.' },
    ...COMMON_OPTIONAL,
  ],
  limited_company: [
    { id: 'incorporation', name: 'Register the company with Companies House', required: true, note: 'Check the current fee on the official page.', link: GOV.limitedCompany },
    { id: 'ct', name: 'Register for Corporation Tax with HMRC', required: true, note: 'Check the official page for when to register.', link: GOV.limitedCompany },
    { id: 'confirmation', name: 'Confirmation statement (each year)', required: true, note: 'A yearly filing at Companies House. Check the current fee.', link: GOV.limitedCompany },
    { id: 'office', name: 'Registered office address service', required: false, note: 'Only if you do not want to use your own address. Prices vary.' },
    ...COMMON_OPTIONAL,
  ],
  llp: [
    { id: 'llp_incorporation', name: 'Register the LLP with Companies House', required: true, note: 'Check the current fee on GOV.UK.', link: GOV.setUpBusiness },
    { id: 'llp_members', name: 'Register each member for Self Assessment', required: true, note: 'Check the official page for how and when to register.', link: GOV.setUpBusiness },
    { id: 'llp_confirmation', name: 'Confirmation statement (each year)', required: true, note: 'A yearly filing at Companies House. Check the current fee.', link: GOV.setUpBusiness },
    { id: 'llp_agreement', name: 'LLP agreement (drawn up by a solicitor)', required: false, note: 'Not required by law, but common. Prices vary.' },
    { id: 'office', name: 'Registered office address service', required: false, note: 'Only if you do not want to use your own address. Prices vary.' },
    ...COMMON_OPTIONAL,
  ],
};

/** "1,250.50" (a leading pound sign is allowed) or "1250.5" → pence; '' → null; anything else → 'invalid'. */
export function parseAmount(input: string): number | null | 'invalid' {
  const t = input.trim().replace(/^£/, '').replace(/,/g, '');
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return 'invalid';
  const p = Math.round(Number(t) * 100);
  return p > 100_000_000_00 ? 'invalid' : p;
}

export interface CostTotals { requiredPence: number; optionalPence: number; totalPence: number; requiredMissing: number }
/** Totals of what the user typed: required items always, optional items only when included. */
export function totals(items: CostItem[], amounts: Record<string, string>, included: Record<string, boolean>): CostTotals {
  let requiredPence = 0; let optionalPence = 0; let requiredMissing = 0;
  for (const it of items) {
    const a = parseAmount(amounts[it.id] ?? '');
    const v = typeof a === 'number' ? a : 0;
    if (it.required) { requiredPence += v; if (a === null || a === 'invalid') requiredMissing += 1; }
    else if (included[it.id]) optionalPence += v;
  }
  return { requiredPence, optionalPence, totalPence: requiredPence + optionalPence, requiredMissing };
}

const CSV_COLUMNS: Column[] = [
  { key: 'item', label: 'Item' }, { key: 'type', label: 'Required or optional' }, { key: 'included', label: 'Included' },
  { key: 'amount', label: 'Amount (GBP)', numeric: true }, { key: 'source', label: 'Official page' },
];
export function costsCsv(items: CostItem[], amounts: Record<string, string>, included: Record<string, boolean>): string {
  const rows: Record<string, Cell>[] = items.map((it) => {
    const a = parseAmount(amounts[it.id] ?? '');
    return { item: it.name, type: it.required ? 'Required' : 'Optional', included: it.required || included[it.id] ? 'Yes' : 'No',
      amount: typeof a === 'number' ? a / 100 : null, source: it.link ?? '' };
  });
  return tableToCsv(CSV_COLUMNS, rows);
}
export const NO_FIGURES_NOTE = 'No fees are filled in: they change, so open the official page for today\'s fee and type in what you see, or the quotes you have had. Nothing you type is saved or sent anywhere.';
