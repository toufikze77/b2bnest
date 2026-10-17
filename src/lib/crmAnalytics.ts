/**
 * CRM Analytics and Reports (Phase 1b): every figure is computed from the contacts and
 * deals the CRM already loads. Nothing is estimated, converted between currencies or filled
 * in with sample values. Months are local calendar months.
 */
import { isClosedStage } from '@/lib/dashboardWidgets';
import { stageKey } from '@/lib/dealBoard';
import { normalizeCurrency } from '@/lib/money';

export interface AnalyticsContact { status: string | null; source: string | null; created_at: string | null }
export interface AnalyticsDeal { stage: string | null; value: number | null; currency?: string | null; close_date: string | null }

/** "closed" is how the app's own add-deal form stores "Closed Won". */
const WON = new Set(['won', 'closed won', 'closed']);
const LOST = new Set(['lost', 'closed lost']);
export const isWon = (stage: string | null | undefined) => WON.has(stageKey(stage));
export const isLost = (stage: string | null | undefined) => LOST.has(stageKey(stage));

/* ---------- Report currency: account currency by default, a hand-picked one remembered per user ---------- */

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): KV | null => { try { return window.localStorage; } catch { return null; } };
export const reportCurrencyKey = (userId: string) => `b2bnest.crm.reportCurrency.${userId}`;

export function loadReportCurrency(userId: string | null | undefined, account: string, s: KV | null = store()): string {
  const fallback = normalizeCurrency(account);
  if (!userId || !s) return fallback;
  try { return normalizeCurrency(s.getItem(reportCurrencyKey(userId))) || fallback; } catch { return fallback; }
}
export function saveReportCurrency(userId: string | null | undefined, currency: string, s: KV | null = store()) {
  if (!userId || !s) return false;
  try { s.setItem(reportCurrencyKey(userId), normalizeCurrency(currency)); return true; } catch { return false; }
}
export function clearReportCurrency(userId: string | null | undefined, s: KV | null = store()) {
  if (!userId || !s) return false;
  try { s.removeItem(reportCurrencyKey(userId)); return true; } catch { return false; }
}

/** Splits deals into those stored in `currency` and a count of the rest per stored currency ('' = not set). */
export function dealsInCurrency<D extends AnalyticsDeal>(deals: D[], currency: string) {
  const cur = normalizeCurrency(currency);
  const included: D[] = [];
  const other = new Map<string, number>();
  for (const d of deals) {
    const c = normalizeCurrency(d.currency);
    if (cur && c === cur) included.push(d);
    else other.set(c, (other.get(c) ?? 0) + 1);
  }
  return { included, excluded: [...other.entries()].map(([currency, count]) => ({ currency, count })).sort((a, b) => b.count - a.count) };
}

/** "2 deals in USD and 1 deal with no currency are not included" — or null when nothing is left out. */
export function excludedNote(excluded: { currency: string; count: number }[]): string | null {
  if (!excluded.length) return null;
  const parts = excluded.map(({ currency, count }) => `${count} ${count === 1 ? 'deal' : 'deals'} ${currency ? `in ${currency}` : 'with no currency set'}`);
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  const total = excluded.reduce((n, e) => n + e.count, 0);
  return `${text} ${total === 1 ? 'is' : 'are'} not included, because there is no exchange-rate data and nothing is converted.`;
}

/* ---------- Lead sources ---------- */

export function leadSources(contacts: AnalyticsContact[]) {
  const groups = new Map<string, { label: string; count: number }>();
  for (const c of contacts) {
    const raw = (c.source || '').trim();
    const key = raw.toLowerCase() || '\u0000not-set';
    const g = groups.get(key) ?? { label: raw || 'Not set', count: 0 };
    g.count++;
    groups.set(key, g);
  }
  const total = contacts.length;
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((g) => ({ ...g, share: total ? g.count / total : 0 }));
}

/* ---------- Months ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** The last `count` months ending with the month of `today`, oldest first. */
export function lastMonths(count: number, today = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (count - 1 - i), 1);
    return { key: monthKey(d), label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) };
  });
}

/** YYYY-MM of a stored date or timestamp, or null when missing/invalid. Date-only strings are taken as written. */
function monthOf(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : monthKey(d);
}

/** Won deals per month by close date, in one currency. Won deals without a close date are counted, not placed. */
export function monthlyWon(deals: AnalyticsDeal[], currency: string, months: number, today = new Date()) {
  const { included, excluded } = dealsInCurrency(deals.filter((d) => isWon(d.stage)), currency);
  const range = lastMonths(months, today);
  const rows = range.map((m) => ({ ...m, value: 0, count: 0 }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  let noCloseDate = 0;
  let outsideRange = 0;
  for (const d of included) {
    const k = monthOf(d.close_date);
    if (!k) { noCloseDate++; continue; }
    const r = byKey.get(k);
    if (!r) { outsideRange++; continue; }
    r.value += Number(d.value) || 0;
    r.count++;
  }
  return { rows, noCloseDate, outsideRange, excluded, wonInCurrency: included.length };
}

/** Contacts added per month (created date) and how many of those are customers now. Rate only for months with ≥ 5 contacts. */
export function contactsAdded(contacts: AnalyticsContact[], months: number, today = new Date(), minForRate = 5) {
  const rows = lastMonths(months, today).map((m) => ({ ...m, added: 0, customersNow: 0, rate: null as number | null }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  let noDate = 0;
  for (const c of contacts) {
    const k = monthOf(c.created_at);
    if (!k) { noDate++; continue; }
    const r = byKey.get(k);
    if (!r) continue;
    r.added++;
    if ((c.status || '').toLowerCase() === 'customer') r.customersNow++;
  }
  for (const r of rows) r.rate = r.added >= minForRate ? r.customersNow / r.added : null;
  return { rows, noDate };
}

/** Won / (won + lost) among deals with those stages; null rate when no deal is won or lost yet. */
export function winRate(deals: AnalyticsDeal[]) {
  const won = deals.filter((d) => isWon(d.stage)).length;
  const lost = deals.filter((d) => isLost(d.stage)).length;
  return { won, lost, rate: won + lost > 0 ? won / (won + lost) : null };
}

/** Average value of won deals, one row per stored currency (never mixed). */
export function averageWonDeal(deals: AnalyticsDeal[]) {
  const m = new Map<string, { total: number; count: number }>();
  for (const d of deals) {
    if (!isWon(d.stage)) continue;
    const c = normalizeCurrency(d.currency);
    const cur = m.get(c) ?? { total: 0, count: 0 };
    cur.total += Number(d.value) || 0;
    cur.count++;
    m.set(c, cur);
  }
  return [...m.entries()].map(([currency, v]) => ({ currency, average: v.total / v.count, count: v.count })).sort((a, b) => b.count - a.count);
}

/** Open pipeline and won value per stored currency (for the report). */
export function totalsByCurrency(deals: AnalyticsDeal[]) {
  const m = new Map<string, { open: number; openCount: number; won: number; wonCount: number }>();
  for (const d of deals) {
    const c = normalizeCurrency(d.currency);
    const cur = m.get(c) ?? { open: 0, openCount: 0, won: 0, wonCount: 0 };
    const v = Number(d.value) || 0;
    if (!isClosedStage(d.stage)) { cur.open += v; cur.openCount++; } else if (isWon(d.stage)) { cur.won += v; cur.wonCount++; }
    m.set(c, cur);
  }
  return [...m.entries()].map(([currency, v]) => ({ currency, ...v }));
}

/* ---------- CSV ---------- */

/** RFC 4180: quote fields containing comma, quote, CR or LF; double inner quotes. Also neutralises spreadsheet formulas. */
export function csvField(v: string | number | null | undefined): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows: (string | number | null | undefined)[][]) => rows.map((r) => r.map(csvField).join(',')).join('\r\n');

/** The detailed report: real figures only, one row per currency where money is involved. */
export function reportRows(contacts: AnalyticsContact[], deals: AnalyticsDeal[], today = new Date()) {
  const rows: (string | number)[][] = [['Section', 'Metric', 'Currency', 'Value', 'Count', 'Note']];
  rows.push(['Contacts', 'Total contacts', '', contacts.length, contacts.length, '']);
  for (const s of leadSources(contacts)) rows.push(['Lead sources', s.label, '', Math.round(s.share * 1000) / 10, s.count, 'Value is % of contacts']);
  for (const t of totalsByCurrency(deals)) {
    rows.push(['Pipeline', 'Open pipeline', t.currency || 'Not set', t.open, t.openCount, 'Deals not won or lost']);
    rows.push(['Pipeline', 'Won value', t.currency || 'Not set', t.won, t.wonCount, 'All time']);
  }
  for (const a of averageWonDeal(deals)) rows.push(['Pipeline', 'Average won deal', a.currency || 'Not set', Math.round(a.average * 100) / 100, a.count, '']);
  const w = winRate(deals);
  rows.push(['Pipeline', 'Win rate', '', w.rate == null ? '' : Math.round(w.rate * 1000) / 10, w.won + w.lost, w.rate == null ? 'No won or lost deals yet' : `${w.won} won, ${w.lost} lost; value is %`]);
  const added = contactsAdded(contacts, 12, today);
  for (const r of added.rows) rows.push(['Contacts added', r.key, '', r.added, r.customersNow, 'Count = customers now']);
  return rows;
}
