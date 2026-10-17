/**
 * One money formatter for the CRM (Phase 1b). en-GB, Intl.NumberFormat, no guessing:
 * - a missing currency prints a plain number (never "$");
 * - an unknown code prints the number followed by the code;
 * - whole numbers by default; `cents: true` only where pennies matter.
 */

export const normalizeCurrency = (code: string | null | undefined) => (code || '').trim().toUpperCase();

const grouped = (amount: number, cents: boolean) =>
  new Intl.NumberFormat('en-GB', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(amount);

export function formatMoney(amount: number, currency: string | null | undefined, opts: { cents?: boolean } = {}): string {
  const cents = !!opts.cents;
  const n = Number.isFinite(amount) ? amount : 0;
  const code = normalizeCurrency(currency);
  if (!code) return grouped(n, cents);
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: code, minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(n);
  } catch {
    return `${grouped(n, cents)} ${code}`;
  }
}

/** The currency's symbol as en-GB prints it ("£", "US$", "€"), or '' when there is no usable code. */
export function currencySymbol(currency: string | null | undefined): string {
  const code = normalizeCurrency(currency);
  if (!code) return '';
  try {
    const part = new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }).formatToParts(0).find((p) => p.type === 'currency');
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/** Axis ticks: 950, 12k, 1.2m (no currency symbol; the axis title carries it). */
export function compactNumber(n: number): string {
  const a = Math.abs(n);
  const trim = (x: number) => (Math.round(x * 10) / 10).toString().replace(/\.0$/, '');
  if (a >= 1e9) return `${trim(n / 1e9)}bn`;
  if (a >= 1e6) return `${trim(n / 1e6)}m`;
  if (a >= 1e3) return `${trim(n / 1e3)}k`;
  return trim(n);
}

/** Per-currency totals as one string, never converted: "£1,200 + US$500". */
export const formatTotals = (totals: { currency: string; amount: number }[]) =>
  totals.length ? totals.map((t) => formatMoney(t.amount, t.currency)).join(' + ') : formatMoney(0, '');
