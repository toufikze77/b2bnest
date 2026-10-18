/**
 * CRM Reports (Phase 5): pipeline forecast, win and loss, lead sources, needs attention.
 * Pure functions over the contacts and deals the CRM tab already loads. Nothing is estimated,
 * converted between currencies or filled in. Dates are compared as calendar dates (YYYY-MM-DD),
 * never as timestamps: a date-only value is taken as written, a timestamp as the local day.
 */
import { isClosedStage } from '@/lib/dashboardWidgets';
import { stageKey, stageRank } from '@/lib/dealBoard';
import { normalizeCurrency } from '@/lib/money';
import { statusLabel } from '@/components/data/StatusBadge';
import { AnalyticsContact, AnalyticsDeal, dealsInCurrency, isLost, isWon, monthKey } from '@/lib/crmAnalytics';

export interface ReportDeal extends AnalyticsDeal {
  id: string; title: string; probability: number | null; contact_id: string | null;
  created_at: string | null; updated_at?: string | null;
}
export interface ReportContact extends AnalyticsContact {
  id: string; name: string; last_contact: string | null;
}

/* ---------- Calendar days ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The calendar day of a stored date or timestamp, or null when missing/invalid. */
export function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? value : null; // rejects 2026-02-30
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : isoDay(d);
}
const dayNumber = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 864e5;
/** Whole days from `a` to `b` (both calendar days). */
export const daysBetween = (a: string, b: string) => Math.round(dayNumber(b) - dayNumber(a));
const addDays = (day: string, n: number) => { const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

/* ---------- Date range ---------- */

export type ReportRange = '30d' | '90d' | 'year' | 'all';
export const REPORT_RANGES: { value: ReportRange; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];
export const DEFAULT_RANGE: ReportRange = 'all';
export const rangeLabel = (r: ReportRange) => REPORT_RANGES.find((x) => x.value === r)?.label ?? 'All time';
/** The range inside a sentence: "created at any time", "created in the last 30 days", "created this year". */
export const rangePhrase = (r: ReportRange) => ({ '30d': 'in the last 30 days', '90d': 'in the last 90 days', year: 'this year', all: 'at any time' } as const)[r] ?? 'at any time';

/**
 * Inclusive calendar-day bounds. "Last 30 days" is today and the 29 days before it; "This year" is
 * 1 January to today. "All time" has no bounds (records without the date are then included too).
 */
export function rangeBounds(range: ReportRange, today = new Date()): { from: string | null; to: string | null } {
  const t = isoDay(today);
  if (range === '30d') return { from: addDays(t, -29), to: t };
  if (range === '90d') return { from: addDays(t, -89), to: t };
  if (range === 'year') return { from: `${t.slice(0, 4)}-01-01`, to: t };
  return { from: null, to: null };
}
/** True when the value's calendar day is inside the bounds (inclusive). With no bounds, always true. */
export function inBounds(value: string | null | undefined, b: { from: string | null; to: string | null }): boolean {
  if (!b.from && !b.to) return true;
  const d = dayOf(value);
  if (!d) return false;
  return (!b.from || d >= b.from) && (!b.to || d <= b.to);
}

type KV = Pick<Storage, 'getItem' | 'setItem'>;
const store = (): KV | null => { try { return window.localStorage; } catch { return null; } };
export const reportRangeKey = (userId: string) => `b2bnest.crm.reportRange.${userId}`;
/** Remembered per user like the report currency; "All time" if unknown, invalid or storage is blocked. */
export function loadReportRange(userId: string | null | undefined, s: KV | null = store()): ReportRange {
  if (!userId || !s) return DEFAULT_RANGE;
  try { const v = s.getItem(reportRangeKey(userId)); return REPORT_RANGES.some((r) => r.value === v) ? (v as ReportRange) : DEFAULT_RANGE; } catch { return DEFAULT_RANGE; }
}
export function saveReportRange(userId: string | null | undefined, range: ReportRange, s: KV | null = store()): boolean {
  if (!userId || !s) return false;
  try { s.setItem(reportRangeKey(userId), range); return true; } catch { return false; }
}

/* ---------- Shared ---------- */

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round2 = (n: number) => Math.round(n * 100) / 100;
/** A probability from 0 to 100, or null when it is missing or not a valid percentage. */
export function validProbability(p: unknown): number | null {
  if (p === null || p === undefined || p === '') return null;
  const n = Number(p);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
export const isOpenDeal = (d: { stage: string | null }) => !isClosedStage(d.stage);
const stageLabel = (stage: string | null) => (stage?.trim() ? statusLabel(stage) : 'No stage');

/* ---------- 1. Pipeline by stage (open deals, created in the range) ---------- */

export interface StageRow { key: string; stage: string; count: number; value: number; weighted: number; withProbability: number; noProbability: number }
export function pipelineByStage(deals: ReportDeal[], currency: string, bounds: { from: string | null; to: string | null }) {
  const open = deals.filter((d) => isOpenDeal(d) && inBounds(d.created_at, bounds));
  const { included, excluded } = dealsInCurrency(open, currency);
  const byKey = new Map<string, StageRow>();
  for (const d of included) {
    const key = stageKey(d.stage);
    const row = byKey.get(key) ?? { key, stage: stageLabel(d.stage), count: 0, value: 0, weighted: 0, withProbability: 0, noProbability: 0 };
    const v = num(d.value);
    const p = validProbability(d.probability);
    row.count++; row.value += v;
    if (p == null) row.noProbability++; else { row.withProbability++; row.weighted += (v * p) / 100; }
    byKey.set(key, row);
  }
  const rows = [...byKey.values()].map((r) => ({ ...r, value: round2(r.value), weighted: round2(r.weighted) }))
    .sort((a, b) => stageRank(a.key) - stageRank(b.key) || a.stage.localeCompare(b.stage));
  const sum = (f: (r: StageRow) => number) => round2(rows.reduce((n, r) => n + f(r), 0));
  return {
    rows,
    totals: { count: sum((r) => r.count), value: sum((r) => r.value), weighted: sum((r) => r.weighted), withProbability: sum((r) => r.withProbability), noProbability: sum((r) => r.noProbability) },
    excluded,
    openInRange: open.length,
  };
}

/* ---------- 2. Win and loss (by close date) ---------- */

/** Months covering the bounds (oldest first); for "All time", from the earliest to the latest close month, at most `cap`. */
export function monthsFor(bounds: { from: string | null; to: string | null }, days: string[], cap = 24) {
  let from = bounds.from, to = bounds.to;
  if (!from || !to) {
    if (!days.length) return { months: [] as { key: string; label: string }[], capped: false };
    const sorted = [...days].sort();
    from = sorted[0]; to = sorted[sorted.length - 1];
  }
  const months: { key: string; label: string }[] = [];
  let y = +from.slice(0, 4), m = +from.slice(5, 7);
  const endKey = to.slice(0, 7);
  for (;;) {
    const d = new Date(y, m - 1, 1);
    months.push({ key: monthKey(d), label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) });
    if (monthKey(d) >= endKey) break;
    m++; if (m > 12) { m = 1; y++; }
  }
  const capped = months.length > cap;
  return { months: capped ? months.slice(-cap) : months, capped };
}

/** `cap`: at most this many months for "All time" (the chart); the CSV passes Infinity so nothing is dropped. */
export function winLoss(deals: ReportDeal[], currency: string, bounds: { from: string | null; to: string | null }, cap = 24) {
  const closed = deals.filter((d) => isWon(d.stage) || isLost(d.stage));
  const noCloseDate = closed.filter((d) => !dayOf(d.close_date)).length;
  const inRange = closed.filter((d) => dayOf(d.close_date) && inBounds(d.close_date, bounds));
  // Win rate and sales cycle are counts and days, so every currency counts; money stays in one currency.
  const won = inRange.filter((d) => isWon(d.stage));
  const lost = inRange.filter((d) => isLost(d.stage));
  const rate = won.length + lost.length ? won.length / (won.length + lost.length) : null;

  let cycleDays = 0, cycleCount = 0, cycleSkipped = 0;
  for (const d of won) {
    const a = dayOf(d.created_at), b = dayOf(d.close_date);
    if (!a || !b || b < a) { cycleSkipped++; continue; }
    cycleDays += daysBetween(a, b); cycleCount++;
  }

  const { included, excluded } = dealsInCurrency(inRange, currency);
  const { months, capped } = monthsFor(bounds, included.map((d) => dayOf(d.close_date)!), cap);
  const rows = months.map((m) => ({ ...m, wonCount: 0, wonValue: 0, lostCount: 0, lostValue: 0 }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const d of included) {
    const r = byKey.get(dayOf(d.close_date)!.slice(0, 7));
    if (!r) continue; // older than the months shown for "All time" (the chart's cap)
    if (isWon(d.stage)) { r.wonCount++; r.wonValue = round2(r.wonValue + num(d.value)); } else { r.lostCount++; r.lostValue = round2(r.lostValue + num(d.value)); }
  }
  return {
    rows, capped, excluded,
    won: won.length, lost: lost.length, rate, noCloseDate,
    cycle: { averageDays: cycleCount ? Math.round((cycleDays / cycleCount) * 10) / 10 : null, count: cycleCount, skipped: cycleSkipped },
  };
}

/* ---------- 3. Lead sources (contacts created in the range, joined to deals by contact_id) ---------- */

export const NO_SOURCE = 'No source recorded';
/** Below this many contacts a source shows counts only: a percentage of 1 or 2 people says little. */
export const MIN_FOR_RATE = 5;

export interface SourceRow { label: string; contacts: number; withDeal: number; withWon: number; wonValue: number; wonDealsElsewhere: number; rate: number | null }
export function leadSourceReport(contacts: ReportContact[], deals: ReportDeal[], currency: string, bounds: { from: string | null; to: string | null }) {
  const cur = normalizeCurrency(currency);
  const byContact = new Map<string, ReportDeal[]>();
  const contactIds = new Set(contacts.map((c) => c.id));
  for (const d of deals) if (d.contact_id) byContact.set(d.contact_id, [...(byContact.get(d.contact_id) ?? []), d]);
  const groups = new Map<string, SourceRow>();
  for (const c of contacts) {
    if (!inBounds(c.created_at, bounds)) continue;
    const raw = (c.source || '').trim();
    const key = raw.toLowerCase() || '\u0000none';
    const g = groups.get(key) ?? { label: raw || NO_SOURCE, contacts: 0, withDeal: 0, withWon: 0, wonValue: 0, wonDealsElsewhere: 0, rate: null };
    g.contacts++;
    const own = byContact.get(c.id) ?? [];
    if (own.length) g.withDeal++;
    const wonDeals = own.filter((d) => isWon(d.stage));
    if (wonDeals.length) g.withWon++;
    for (const d of wonDeals) {
      if (cur && normalizeCurrency(d.currency) === cur) g.wonValue = round2(g.wonValue + num(d.value)); else g.wonDealsElsewhere++;
    }
    groups.set(key, g);
  }
  const rows = [...groups.values()]
    .map((g) => ({ ...g, rate: g.contacts >= MIN_FOR_RATE ? g.withWon / g.contacts : null }))
    .sort((a, b) => (a.label === NO_SOURCE ? 1 : 0) - (b.label === NO_SOURCE ? 1 : 0) || b.contacts - a.contacts || a.label.localeCompare(b.label));
  const unlinkedDeals = deals.filter((d) => !d.contact_id || !contactIds.has(d.contact_id)).length;
  return { rows, contactsInRange: rows.reduce((n, r) => n + r.contacts, 0), unlinkedDeals, wonElsewhere: rows.reduce((n, r) => n + r.wonDealsElsewhere, 0) };
}

/* ---------- 4. Needs attention (as of today; not filtered by the range) ---------- */

export const STALE_DAYS = 30;
export function needsAttention(contacts: ReportContact[], deals: ReportDeal[], today = new Date()) {
  const t = isoDay(today);
  const open = deals.filter(isOpenDeal);
  const overdue = open
    .filter((d) => { const c = dayOf(d.close_date); return !!c && c < t; })
    .map((d) => ({ deal: d, day: dayOf(d.close_date)!, days: daysBetween(dayOf(d.close_date)!, t) }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.deal.title.localeCompare(b.deal.title));
  const stale = open
    .map((d) => ({ deal: d, day: dayOf(d.updated_at) ?? dayOf(d.created_at) }))
    .filter((x): x is { deal: ReportDeal; day: string } => !!x.day && daysBetween(x.day, t) >= STALE_DAYS)
    .map((x) => ({ ...x, days: daysBetween(x.day, t) }))
    .sort((a, b) => a.day.localeCompare(b.day) || a.deal.title.localeCompare(b.deal.title));
  const cold = contacts
    .filter((c) => ['lead', 'prospect'].includes((c.status || '').trim().toLowerCase()))
    .map((c) => ({ contact: c, day: dayOf(c.last_contact) }))
    .filter((x) => !x.day || daysBetween(x.day, t) > STALE_DAYS)
    .map((x) => ({ ...x, days: x.day ? daysBetween(x.day, t) : null }))
    .sort((a, b) => (a.day ?? '').localeCompare(b.day ?? '') || a.contact.name.localeCompare(b.contact.name));
  return { overdue, stale, cold };
}

/* ---------- CSV per section (header row always present; one row per currency where money is involved) ---------- */

type Cell = string | number;
const currencies = (deals: ReportDeal[], first: string) => {
  const all = Array.from(new Set(deals.map((d) => normalizeCurrency(d.currency))));
  return all.sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)));
};

export function pipelineCsvRows(deals: ReportDeal[], currency: string, range: ReportRange, today = new Date()): Cell[][] {
  const b = rangeBounds(range, today);
  const rows: Cell[][] = [['Stage', 'Currency', 'Open deals', 'Total value', 'Weighted forecast', 'Deals with no probability', 'Date range', 'Filtered by']];
  const open = deals.filter((d) => isOpenDeal(d) && inBounds(d.created_at, b));
  for (const c of currencies(open, normalizeCurrency(currency))) {
    const p = pipelineByStage(open, c, { from: null, to: null });
    if (!c) { rows.push(['All stages', 'Not set', open.filter((d) => !normalizeCurrency(d.currency)).length, '', '', '', rangeLabel(range), 'Created date']); continue; }
    for (const r of p.rows) rows.push([r.stage, c, r.count, r.value, r.weighted, r.noProbability, rangeLabel(range), 'Created date']);
    rows.push(['Total', c, p.totals.count, p.totals.value, p.totals.weighted, p.totals.noProbability, rangeLabel(range), 'Created date']);
  }
  return rows;
}

export function winLossCsvRows(deals: ReportDeal[], currency: string, range: ReportRange, today = new Date()): Cell[][] {
  const b = rangeBounds(range, today);
  const rows: Cell[][] = [['Month', 'Currency', 'Won deals', 'Won value', 'Lost deals', 'Lost value', 'Date range', 'Filtered by']];
  const closed = deals.filter((d) => (isWon(d.stage) || isLost(d.stage)) && dayOf(d.close_date) && inBounds(d.close_date, b));
  for (const c of currencies(closed, normalizeCurrency(currency))) {
    if (!c) {
      const none = closed.filter((d) => !normalizeCurrency(d.currency));
      rows.push(['All months', 'Not set', none.filter((d) => isWon(d.stage)).length, '', none.filter((d) => isLost(d.stage)).length, '', rangeLabel(range), 'Close date']);
      continue;
    }
    for (const r of winLoss(closed, c, b, Infinity).rows) if (r.wonCount || r.lostCount) rows.push([r.key, c, r.wonCount, r.wonValue, r.lostCount, r.lostValue, rangeLabel(range), 'Close date']);
  }
  const w = winLoss(deals, currency, b);
  rows.push(['Win rate (%)', 'All currencies', w.won, '', w.lost, '', rangeLabel(range), w.rate == null ? 'Close date; no won or lost deals' : `Close date; ${Math.round(w.rate * 1000) / 10}%`]);
  rows.push(['Average sales cycle (days)', 'All currencies', w.cycle.count, w.cycle.averageDays ?? '', '', '', rangeLabel(range), `Created to close date; ${w.cycle.skipped} skipped`]);
  return rows;
}

export function leadSourcesCsvRows(contacts: ReportContact[], deals: ReportDeal[], currency: string, range: ReportRange, today = new Date()): Cell[][] {
  const b = rangeBounds(range, today);
  const rows: Cell[][] = [['Source', 'Currency', 'Contacts', 'With a deal', 'With a won deal', 'Won value', 'Won rate (%)', 'Date range', 'Filtered by']];
  const won = deals.filter((d) => isWon(d.stage));
  const curs = currencies(won, normalizeCurrency(currency)).filter(Boolean);
  const base = leadSourceReport(contacts, deals, currency, b);
  for (const r of base.rows) {
    const rate = r.rate == null ? `Not shown (fewer than ${MIN_FOR_RATE} contacts)` : Math.round(r.rate * 1000) / 10;
    const perCur = curs.map((c) => ({ c, v: leadSourceReport(contacts, deals, c, b).rows.find((x) => x.label === r.label)?.wonValue ?? 0 })).filter((x) => x.v > 0);
    if (!perCur.length) rows.push([r.label, '', r.contacts, r.withDeal, r.withWon, 0, rate, rangeLabel(range), 'Contact created date']);
    for (const { c, v } of perCur) rows.push([r.label, c, r.contacts, r.withDeal, r.withWon, v, rate, rangeLabel(range), 'Contact created date']);
  }
  return rows;
}

export function needsAttentionCsvRows(contacts: ReportContact[], deals: ReportDeal[], today = new Date()): Cell[][] {
  const n = needsAttention(contacts, deals, today);
  const rows: Cell[][] = [['List', 'Name', 'Stage or status', 'Date', 'Days', 'Value', 'Currency']];
  for (const x of n.overdue) rows.push(['Close date passed', x.deal.title, stageLabel(x.deal.stage), x.day, x.days, num(x.deal.value), normalizeCurrency(x.deal.currency) || 'Not set']);
  for (const x of n.stale) rows.push([`Not updated for ${STALE_DAYS}+ days`, x.deal.title, stageLabel(x.deal.stage), x.day, x.days, num(x.deal.value), normalizeCurrency(x.deal.currency) || 'Not set']);
  for (const x of n.cold) rows.push([`Lead or prospect, no contact for over ${STALE_DAYS} days`, x.contact.name, statusLabel(x.contact.status), x.day ?? 'Never', x.days ?? '', '', '']);
  return rows;
}

export const csvFileName = (section: string, today = new Date()) => `crm-${section}-${isoDay(today)}.csv`;
