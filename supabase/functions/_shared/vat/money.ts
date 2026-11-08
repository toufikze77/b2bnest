// COPY of src/lib/vat/money.ts for the Edge Functions (Deno needs .ts imports). Keep both identical: src/lib/vat/returnBoxes.parity.test.ts checks it.
// HMRC P4: VAT money maths in integer pence (no floating point in the sums). One rounding rule everywhere:
// VAT is worked out PER LINE and rounded to the penny, half away from zero (0.5p goes up for positive amounts, the
// same as PostgreSQL's round()), then the lines are added up. Mixed-rate invoices therefore reconcile exactly.
import { VAT_RATES, VAT_TREATMENTS, type VatTreatment } from './treatments.ts';

/** Pounds (number or text, 2 dp) to integer pence. Exact for any amount written with at most 2 decimals. */
export function toPence(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === '') return 0;
  const s = typeof amount === 'number' ? amount.toFixed(6) : String(amount).trim();
  const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m) return NaN;
  const whole = Number(m[2] || '0');
  const frac = (m[3] ?? '').padEnd(3, '0');
  // Round the third decimal half away from zero (only used for inputs with more than 2 decimals).
  const pence = whole * 100 + Number(frac.slice(0, 2)) + (Number(frac[2]) >= 5 ? 1 : 0);
  return m[1] ? -pence : pence;
}
/** Integer pence to pounds (2 dp number) for storing. */
export const fromPence = (p: number): number => Math.round(p) / 100;

/** a × b / c rounded half away from zero, all integers. */
function mulDivRound(a: number, b: number, c: number): number {
  const n = a * b;
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  return sign * Math.floor((abs * 2 + c) / (2 * c));
}

/** VAT on a net amount (pence) for a treatment. */
export const vatOnNet = (netPence: number, treatment: VatTreatment): number => (VAT_RATES[treatment] > 0 ? mulDivRound(netPence, VAT_RATES[treatment], 100) : 0);

export interface VatSplit { net: number; vat: number; gross: number; rate: number; treatment: VatTreatment }

/** An amount that INCLUDES VAT: VAT = gross × rate / (100 + rate), rounded; net = gross − VAT. */
export function splitFromGross(grossPence: number, treatment: VatTreatment): VatSplit {
  const rate = VAT_RATES[treatment];
  const vat = rate > 0 ? mulDivRound(grossPence, rate, 100 + rate) : 0;
  return { net: grossPence - vat, vat, gross: grossPence, rate, treatment };
}
/** An amount that EXCLUDES VAT: VAT = net × rate / 100, rounded; gross = net + VAT. */
export function addToNet(netPence: number, treatment: VatTreatment): VatSplit {
  const vat = vatOnNet(netPence, treatment);
  return { net: netPence, vat, gross: netPence + vat, rate: VAT_RATES[treatment], treatment };
}

export interface VatLine { treatment: VatTreatment; netPence: number }
export interface LineTotals { lines: VatSplit[]; net: number; vat: number; gross: number; byTreatment: Partial<Record<VatTreatment, { net: number; vat: number; gross: number }>> }
/** Per-line VAT, rounded per line, then summed; plus totals per treatment (for the invoice and P5). */
export function sumLines(lines: VatLine[]): LineTotals {
  const out: LineTotals = { lines: [], net: 0, vat: 0, gross: 0, byTreatment: {} };
  for (const l of lines) {
    const s = addToNet(l.netPence, l.treatment);
    out.lines.push(s);
    out.net += s.net; out.vat += s.vat; out.gross += s.gross;
    const g = out.byTreatment[l.treatment] ?? { net: 0, vat: 0, gross: 0 };
    g.net += s.net; g.vat += s.vat; g.gross += s.gross;
    out.byTreatment[l.treatment] = g;
  }
  return out;
}
/** The treatments present, in the fixed order (for showing groups). */
export const treatmentsIn = (t: LineTotals) => VAT_TREATMENTS.filter((x) => t.byTreatment[x]);

/** A line's net in pence: quantity × unit price, rounded half away from zero to the penny. */
export function lineNetPence(quantity: number | string, unitPrice: number | string): number {
  const q = Number(quantity);
  const unit = toPence(unitPrice);
  if (!Number.isFinite(q) || !Number.isFinite(unit)) return NaN;
  // Quantities may have up to 3 decimals: work in thousandths.
  const q1000 = Math.round(q * 1000);
  return mulDivRound(unit, q1000, 1000);
}
