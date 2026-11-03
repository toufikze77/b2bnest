// Phase 38: ROI Calculator maths. Pure functions (tested in roi.test.ts); the component only displays the results.
//
// Definitions (all money in pounds):
//   total cost      = initial investment + ongoing monthly cost x months
//   total return    = expected total return, or expected monthly return x months, plus any resale / residual value
//   net profit      = total return - total cost
//   ROI %           = net profit / total cost x 100
//   payback         = months until the money back covers the investment. Returns are treated as arriving evenly each
//                     month (a total return is spread over the months) and the residual value at the end.
//   annualised ROI  = ((total return / total cost) ^ (12 / months) - 1) x 100, compound; shown only for 12 months or more
//   break-even      = the monthly return needed for net profit to be zero
//   NPV             = -investment + each month's (return - cost) discounted at the monthly equivalent of the yearly
//                     rate, + the residual discounted from the last month. Only when a discount rate is given.
import { tableToCsv, type Cell, type Column } from '@/lib/adminMetricsCore';

export type ReturnMode = 'total' | 'monthly';
/** What the user typed (strings, so empty fields and bad input can be reported field by field). */
export interface RoiForm {
  name: string;
  investment: string;
  monthlyCost: string;
  mode: ReturnMode;
  totalReturn: string;
  monthlyReturn: string;
  months: string;
  residual: string;
  discountRate: string;
}
export const EMPTY_FORM: RoiForm = { name: '', investment: '', monthlyCost: '', mode: 'total', totalReturn: '', monthlyReturn: '', months: '12', residual: '', discountRate: '' };

export interface RoiInputs {
  investment: number; monthlyCost: number; mode: ReturnMode; totalReturn: number; monthlyReturn: number;
  months: number; residual: number; discountRate: number | null;
}
export interface RoiResult {
  totalCost: number;
  totalReturn: number;
  netProfit: number;
  roiPercent: number;
  /** Months to pay back (one decimal place), or null when not paid back within the timeframe. */
  paybackMonths: number | null;
  /** Null when the timeframe is under 12 months (not shown). */
  annualisedRoiPercent: number | null;
  breakEvenMonthlyReturn: number;
  /** Null when no discount rate was given. */
  npv: number | null;
}

export const MAX_MONEY = 1_000_000_000_000; // £1 trillion: anything larger is almost certainly a typing mistake
export const MAX_MONTHS = 600;
export const MAX_RATE = 100;

/** "£1,234.50", "45", "1,000" → number; '' → null; anything else → NaN. */
export function parseNumber(input: string): number | null {
  const t = input.trim().replace(/^£/, '').replace(/,/g, '');
  if (t === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return Number.NaN;
  return Number(t);
}

export type FieldErrors = Partial<Record<keyof RoiForm, string>>;

/** Checks every field; returns plain-English errors per field, or the parsed inputs. */
export function validate(form: RoiForm): { inputs: RoiInputs | null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const money = (key: keyof RoiForm, label: string, opts: { required?: boolean; allowZero?: boolean }) => {
    const v = parseNumber(form[key] as string);
    if (v === null) { if (opts.required) errors[key] = `Enter ${label}.`; return 0; }
    if (Number.isNaN(v)) { errors[key] = `Enter ${label} as a number, for example 1,250.50.`; return 0; }
    if (v < 0) { errors[key] = `${label[0].toUpperCase()}${label.slice(1)} can't be negative.`; return 0; }
    if (v === 0 && !opts.allowZero) { errors[key] = `${label[0].toUpperCase()}${label.slice(1)} must be more than £0.`; return 0; }
    if (v > MAX_MONEY) { errors[key] = `Enter at most £${MAX_MONEY.toLocaleString('en-GB')}.`; return 0; }
    return Math.round(v * 100) / 100;
  };
  if (form.name.trim().length > 80) errors.name = 'Use at most 80 characters.';
  const investment = money('investment', 'the initial investment', { required: true });
  const monthlyCost = money('monthlyCost', 'the monthly cost', { allowZero: true });
  const totalReturn = form.mode === 'total' ? money('totalReturn', 'the expected total return', { required: true, allowZero: true }) : 0;
  const monthlyReturn = form.mode === 'monthly' ? money('monthlyReturn', 'the expected monthly return', { required: true, allowZero: true }) : 0;
  const residual = money('residual', 'the resale or residual value', { allowZero: true });
  const m = parseNumber(form.months);
  let months = 0;
  if (m === null) errors.months = 'Enter the timeframe in months.';
  else if (Number.isNaN(m) || !Number.isInteger(m)) errors.months = 'Enter whole months, for example 12.';
  else if (m < 1) errors.months = 'The timeframe must be at least 1 month.';
  else if (m > MAX_MONTHS) errors.months = `Enter at most ${MAX_MONTHS} months (50 years).`;
  else months = m;
  const r = parseNumber(form.discountRate);
  let discountRate: number | null = null;
  if (r !== null) {
    if (Number.isNaN(r)) errors.discountRate = 'Enter a yearly percentage, for example 5.';
    else if (r < 0 || r > MAX_RATE) errors.discountRate = `Enter a rate between 0% and ${MAX_RATE}%.`;
    else discountRate = r;
  }
  if (Object.keys(errors).length > 0) return { inputs: null, errors };
  return { inputs: { investment, monthlyCost, mode: form.mode, totalReturn, monthlyReturn, months, residual, discountRate }, errors };
}

const finite = (x: number) => (Number.isFinite(x) ? x : 0);
const round = (x: number, dp: number) => Math.round(finite(x) * 10 ** dp) / 10 ** dp;

export function calculate(i: RoiInputs): RoiResult {
  const months = Math.max(1, i.months);
  const monthlyReturn = i.mode === 'monthly' ? i.monthlyReturn : i.totalReturn / months;
  const returns = i.mode === 'monthly' ? i.monthlyReturn * months : i.totalReturn;
  const totalCost = i.investment + i.monthlyCost * months;
  const totalReturn = returns + i.residual;
  const netProfit = totalReturn - totalCost;
  const roiPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  // Payback: the investment back from each month's (return - cost); the residual counts only at the end.
  const perMonth = monthlyReturn - i.monthlyCost;
  let paybackMonths: number | null = null;
  if (perMonth > 0 && i.investment / perMonth <= months) paybackMonths = round(i.investment / perMonth, 1);
  else if (-i.investment + perMonth * months + i.residual >= 0) paybackMonths = months;
  if (i.investment === 0) paybackMonths = 0;

  const annualisedRoiPercent = months >= 12 && totalCost > 0
    ? (Math.pow(Math.max(0, totalReturn) / totalCost, 12 / months) - 1) * 100
    : null;
  const breakEvenMonthlyReturn = Math.max(0, (totalCost - i.residual) / months);

  let npv: number | null = null;
  if (i.discountRate !== null) {
    const m = Math.pow(1 + i.discountRate / 100, 1 / 12) - 1;
    const factor = m === 0 ? months : (1 - Math.pow(1 + m, -months)) / m; // the sum of 1/(1+m)^k for k = 1..months
    npv = -i.investment + perMonth * factor + i.residual / Math.pow(1 + m, months);
  }
  return {
    totalCost: round(totalCost, 2), totalReturn: round(totalReturn, 2), netProfit: round(netProfit, 2), roiPercent: round(roiPercent, 2),
    paybackMonths, annualisedRoiPercent: annualisedRoiPercent === null ? null : round(annualisedRoiPercent, 2),
    breakEvenMonthlyReturn: round(breakEvenMonthlyReturn, 2), npv: npv === null ? null : round(npv, 2),
  };
}

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
/** "£1,234.50" (never NaN). */
export const money = (x: number) => GBP.format(finite(x));
/** "28.57%" (never NaN or Infinity). */
export const percent = (x: number) => `${finite(x).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export const monthsText = (x: number) => `${x.toLocaleString('en-GB', { maximumFractionDigits: 1 })} ${x === 1 ? 'month' : 'months'}`;

export const RESULT_NOTE = 'These results depend entirely on the numbers you entered. They are not financial advice.';
/** The plain-words verdict. Never advice. */
export function verdict(r: RoiResult, months: number): string {
  if (r.netProfit < 0) return `Loses money over this period: ${money(-r.netProfit)} less back than it costs over ${monthsText(months)}.`;
  if (r.netProfit === 0) return `Breaks even over ${monthsText(months)}: you get back exactly what it costs.`;
  if (r.paybackMonths === 0) return `Nothing to pay back: no initial investment, and ${money(r.netProfit)} profit over ${monthsText(months)}.`;
  const p = r.paybackMonths === null ? months : Math.ceil(r.paybackMonths);
  return `Pays back in ${monthsText(p)}, with ${money(r.netProfit)} profit over ${monthsText(months)}.`;
}
export function annualisedText(r: RoiResult): string {
  return r.annualisedRoiPercent === null
    ? 'Not shown for periods under a year: turning a few months into a yearly rate exaggerates small gains and losses.'
    : `${percent(r.annualisedRoiPercent)} a year, compounded.`;
}

// Scenarios (browser only).
export interface Scenario { id: string; name: string; form: RoiForm; savedAt: string }
export const MAX_SCENARIOS = 5;
export const SCENARIOS_KEY = 'b2bnest.roi.scenarios.v1';
export function loadScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter((s): s is Scenario => !!s && typeof s.id === 'string' && typeof s.name === 'string' && !!s.form && validate({ ...EMPTY_FORM, ...s.form }).inputs !== null)
      .map((s) => ({ ...s, form: { ...EMPTY_FORM, ...s.form } })).slice(0, MAX_SCENARIOS);
  } catch { return []; }
}
export function saveScenarios(list: Scenario[]): boolean {
  try { localStorage.setItem(SCENARIOS_KEY, JSON.stringify(list.slice(0, MAX_SCENARIOS))); return true; } catch { return false; }
}

/** Index of the scenario with the highest ROI, or -1. */
export function bestByRoi(results: RoiResult[]): number {
  let best = -1;
  results.forEach((r, i) => { if (best === -1 || r.roiPercent > results[best].roiPercent) best = i; });
  return best;
}

export const CSV_COLUMNS: Column[] = [
  { key: 'name', label: 'Scenario' }, { key: 'investment', label: 'Initial investment (GBP)', numeric: true }, { key: 'monthly_cost', label: 'Monthly cost (GBP)', numeric: true },
  { key: 'months', label: 'Months', numeric: true }, { key: 'total_cost', label: 'Total cost (GBP)', numeric: true }, { key: 'total_return', label: 'Total return (GBP)', numeric: true },
  { key: 'net_profit', label: 'Net profit (GBP)', numeric: true }, { key: 'roi', label: 'ROI %', numeric: true }, { key: 'payback', label: 'Payback (months)', numeric: true },
  { key: 'annualised', label: 'Annualised ROI %', numeric: true }, { key: 'npv', label: 'NPV (GBP)', numeric: true },
];
export function scenariosCsv(list: Scenario[]): string {
  const rows: Record<string, Cell>[] = list.flatMap((s) => {
    const { inputs } = validate(s.form);
    if (!inputs) return [];
    const r = calculate(inputs);
    return [{ name: s.name, investment: inputs.investment, monthly_cost: inputs.monthlyCost, months: inputs.months, total_cost: r.totalCost,
      total_return: r.totalReturn, net_profit: r.netProfit, roi: r.roiPercent, payback: r.paybackMonths, annualised: r.annualisedRoiPercent, npv: r.npv }];
  });
  return tableToCsv(CSV_COLUMNS, rows);
}

/** Phase 39: a form read back from storage or the account (every field a string, a known mode). */
export function isRoiForm(v: unknown): v is RoiForm {
  if (!v || typeof v !== 'object') return false;
  const f = v as Record<string, unknown>;
  return (f.mode === 'total' || f.mode === 'monthly')
    && (['name', 'investment', 'monthlyCost', 'totalReturn', 'monthlyReturn', 'months', 'residual', 'discountRate'] as const).every((k) => typeof f[k] === 'string');
}
