// Phase 36: shared types and helpers for the Platform Overview metric pages (super admin). Pure: no React, no network.

export type MetricView = 'management' | 'operations' | 'business';
export const VIEW_LABELS: Record<MetricView, string> = {
  management: 'Management',
  operations: 'Operations',
  business: 'Business development',
};
export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];
export const DEFAULT_RANGE: RangeDays = 30;

/**
 * Assumption shown on the AI page next to every GBP figure: OpenAI bills in US dollars. Change this one constant when
 * the rate moves; the page says "at $1 = £0.79 (assumed)".
 */
export const USD_TO_GBP = 0.79;

export interface Headline { label: string; value: string; change?: number | null; hint?: string }
export interface ChartSeries { key: string; label: string }
export interface ChartSpec {
  title: string;
  kind: 'line' | 'bar';
  data: Record<string, string | number>[];
  xKey: string;
  xLabel: string;
  series: ChartSeries[];
  /** Plain-language summary for screen readers. */
  summary: string;
  emptyText: string;
}
export interface Column { key: string; label: string; numeric?: boolean }
export type Cell = string | number | null;
export interface TableSpec { title: string; columns: Column[]; rows: Record<string, Cell>[]; emptyText: string; csvName: string; note?: string }
export interface ViewData {
  headlines: Headline[];
  charts?: ChartSpec[];
  tables?: TableSpec[];
  /** Plain statements about what is and isn't available. */
  notes?: string[];
  /** Something that needs attention (for example AI calls without a price). */
  warnings?: string[];
  /** Shown instead of the charts when there is nothing yet (for example "No AI usage yet"). */
  emptyState?: string;
}
export interface MetricResult { views: Partial<Record<MetricView, ViewData>> }

/** Admin RPC caller (adminRpc in the app, a fake in tests). */
export type Rpc = <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<T>;

/** What a metric page asks for. `optional` answers null when the RPC is missing or fails (that section says so). */
export interface Sources {
  get<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T>;
  optional<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T | null>;
}

/** Calls each RPC once per page load (several sections share a source). */
export function createSources(rpc: Rpc): Sources {
  const cache = new Map<string, Promise<unknown>>();
  const get = <T,>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
    const key = `${fn}:${JSON.stringify(args)}`;
    if (!cache.has(key)) cache.set(key, rpc(fn, args));
    return cache.get(key) as Promise<T>;
  };
  return {
    get,
    optional: <T,>(fn: string, args: Record<string, unknown> = {}) => get<T>(fn, args).catch(() => null),
  };
}

export interface MetricConfig {
  id: string;
  /** The card label on Platform Overview, exactly. */
  card: string;
  title: string;
  /** One line: what is and isn't counted. */
  definition: string;
  views: MetricView[];
  load: (src: Sources, days: number) => Promise<MetricResult>;
}

// ---------------------------------------------------------------------------------------------------------------------
// Numbers. Never NaN or Infinity on screen.

export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const fmtInt = (v: unknown) => Math.round(num(v)).toLocaleString('en-GB');
export const fmtGbp = (v: unknown, digits = 0) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(num(v));
export const fmtUsd = (v: unknown, digits = 2) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(num(v));
/** "12.5%", or "–" when the denominator is 0. */
export const fmtPct = (part: unknown, whole: unknown, digits = 1) =>
  num(whole) > 0 ? `${((num(part) / num(whole)) * 100).toFixed(digits)}%` : '–';
export const fmtBytes = (v: unknown) => {
  const b = num(v);
  if (b <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), units.length - 1);
  return `${(b / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};
export const fmtDate = (v: unknown) => {
  if (typeof v !== 'string' || !v) return '–';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
/** % change from previous to current, or null when there is nothing to compare with. */
export const change = (current: number, previous: number): number | null =>
  previous > 0 ? ((current - previous) / previous) * 100 : null;

// ---------------------------------------------------------------------------------------------------------------------
// Periods.

export interface DayRow { day: string; [k: string]: string | number }

/**
 * admin_analytics_series(2 x days) answers 2 x days + 1 days, oldest first. The last `days` are this period, the `days`
 * before them the previous one.
 */
export function splitPeriods<T>(rows: T[], days: number): { current: T[]; previous: T[] } {
  const current = rows.slice(-days);
  const previous = rows.slice(Math.max(0, rows.length - 2 * days), Math.max(0, rows.length - days));
  return { current, previous };
}
export const sumOf = (rows: Record<string, unknown>[], key: string) => rows.reduce((t, r) => t + num(r[key]), 0);
export const allZero = (rows: Record<string, unknown>[], keys: string[]) => rows.every((r) => keys.every((k) => num(r[k]) === 0));

/** Counts rows per calendar day (YYYY-MM-DD, UTC) over the last `days` days, oldest first, zeros included. */
export function perDay(dates: (string | null | undefined)[], days: number, now = new Date()): { day: string; count: number }[] {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: { day: string; count: number }[] = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
    index.set(day, out.length);
    out.push({ day, count: 0 });
  }
  for (const d of dates) {
    if (!d) continue;
    const day = String(d).slice(0, 10);
    const i = index.get(day);
    if (i !== undefined) out[i].count += 1;
  }
  return out;
}

/** Group and count, biggest first. */
export function countBy<T>(rows: T[], key: (r: T) => string): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export const label = (s: unknown) => {
  const t = String(s ?? '').replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Not set';
};

// ---------------------------------------------------------------------------------------------------------------------
// CSV. Client side, only what the table shows.

/**
 * A cell that a spreadsheet would run as a formula (starts with = + - @, or a tab / carriage return) gets a leading
 * apostrophe (OWASP CSV injection). Only text cells: numbers stay numbers (so -5 is still -5).
 */
export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function tableToCsv(columns: Column[], rows: Record<string, Cell>[]): string {
  const head = columns.map((c) => csvCell(c.label)).join(',');
  return [head, ...rows.map((r) => columns.map((c) => csvCell(r[c.key] ?? null)).join(','))].join('\r\n');
}
