/**
 * Pure helpers for the CRM pipeline board (Phase 1). Columns come only from
 * stage text found on loaded deals; stored stage text is never rewritten.
 * Open/closed uses the same rule as the Dashboard (isClosedStage).
 */
import { CurrencyTotals, isClosedStage, sumByCurrency } from '@/lib/dashboardWidgets';
import { addDaysIso } from '@/lib/dashboardData';

export interface BoardDeal {
  id: string;
  title: string;
  stage: string | null;
  value: number | null;
  currency?: string | null;
  probability: number | null;
  close_date: string | null;
  contact_id: string | null;
  sort_order?: number | null;
}

/** Comparison key for stage text: case, dashes and underscores don't matter. '' = no stage. */
export const stageKey = (stage: string | null | undefined) =>
  (stage || '').toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

const OPEN_ORDER = ['prospecting', 'lead', 'qualified', 'proposal', 'negotiation'];
const WON = new Set(['won', 'closed won']);
const LOST = new Set(['lost', 'closed lost']);

/** Rank for column order: known open stages, then won, then lost, then anything else (99). */
export function stageRank(key: string): number {
  const i = OPEN_ORDER.indexOf(key);
  if (i >= 0) return i;
  if (WON.has(key)) return OPEN_ORDER.length;
  if (LOST.has(key)) return OPEN_ORDER.length + 1;
  return 99;
}

export interface BoardColumn<D extends BoardDeal = BoardDeal> {
  /** Stage key ('' for deals with no stage). */
  key: string;
  /** Stage text written when a deal is dropped here: the first stored text seen for this key. null = no stage (not a drop target). */
  stage: string | null;
  deals: D[];
  totals: CurrencyTotals;
}

/** Known columns as [key, stored stage text] pairs, in first-appearance order. */
export type StageSeen = [string, string | null][];

/** Adds stages from `deals` to `seen` without dropping ones seen earlier (so a column emptied by a move stays). */
export function rememberStages(seen: StageSeen, deals: BoardDeal[]): StageSeen {
  const out: StageSeen = [...seen];
  const keys = new Set(out.map(([k]) => k));
  for (const d of deals) {
    const k = stageKey(d.stage);
    if (!keys.has(k)) { keys.add(k); out.push([k, k ? (d.stage as string) : null]); }
  }
  return out;
}

const byOrder = <D extends BoardDeal>(a: D, b: D) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

/** Groups deals into ordered columns with one total per currency (never mixed). */
export function buildBoard<D extends BoardDeal>(deals: D[], seen: StageSeen = []): BoardColumn<D>[] {
  const stages = rememberStages(seen, deals);
  const firstSeen = new Map(stages.map(([k], i) => [k, i]));
  const ordered = [...stages].sort(([a], [b]) => {
    // No-stage column always last.
    if (!a || !b) return !a && !b ? 0 : !a ? 1 : -1;
    return stageRank(a) - stageRank(b) || firstSeen.get(a)! - firstSeen.get(b)!;
  });
  return ordered.map(([key, stage]) => {
    const inCol = deals.filter((d) => stageKey(d.stage) === key).sort(byOrder);
    return { key, stage, deals: inCol, totals: sumByCurrency(inCol, (d) => d.value, (d) => d.currency) };
  });
}

/** Summary cards. Won-this-month is not offered: deals have no won date (close_date is the expected date). */
export function boardSummary(deals: BoardDeal[], today: string, days = 30) {
  const open = deals.filter((d) => !isClosedStage(d.stage));
  const horizon = addDaysIso(today, days);
  const closing = open.filter((d) => d.close_date && d.close_date.slice(0, 10) >= today && d.close_date.slice(0, 10) <= horizon);
  return {
    openCount: open.length,
    openTotals: sumByCurrency(open, (d) => d.value, (d) => d.currency),
    closingCount: closing.length,
    closingTotals: sumByCurrency(closing, (d) => d.value, (d) => d.currency),
  };
}

/** Returns a copy of `deals` with one deal's stage changed. */
export const withStage = <D extends BoardDeal>(deals: D[], id: string, stage: string | null): D[] =>
  deals.map((d) => (d.id === id ? { ...d, stage } : d));

/**
 * Optimistic stage move: shows the new stage at once, saves, and on failure puts the
 * card back — but only if nothing else has moved it since (so a later move isn't undone).
 * `save` resolves truthy on success; falsy or a throw counts as failure.
 */
export async function moveDealStage<D extends BoardDeal>(opts: {
  deals: D[];
  id: string;
  to: string;
  update: (fn: (prev: D[]) => D[]) => void;
  save: () => Promise<unknown>;
}): Promise<{ ok: boolean; from: string | null }> {
  const deal = opts.deals.find((d) => d.id === opts.id);
  if (!deal) return { ok: false, from: null };
  const from = deal.stage;
  if (stageKey(from) === stageKey(opts.to)) return { ok: true, from };
  opts.update((prev) => withStage(prev, opts.id, opts.to));
  let ok = false;
  try { ok = !!(await opts.save()); } catch { ok = false; }
  if (!ok) opts.update((prev) => prev.map((d) => (d.id === opts.id && d.stage === opts.to ? { ...d, stage: from } : d)));
  return { ok, from };
}

export type DealsViewMode = 'table' | 'board';
export const dealsViewKey = (userId: string) => `b2bnest.crm.dealsView.${userId}`;
type KV = Pick<Storage, 'getItem' | 'setItem'>;
const store = (): KV | null => { try { return window.localStorage; } catch { return null; } };

/** Table is the safe default for unknown users, bad values and blocked storage. */
export function loadDealsView(userId: string | null | undefined, s: KV | null = store()): DealsViewMode {
  if (!userId || !s) return 'table';
  try { return s.getItem(dealsViewKey(userId)) === 'board' ? 'board' : 'table'; } catch { return 'table'; }
}

export function saveDealsView(userId: string | null | undefined, mode: DealsViewMode, s: KV | null = store()): boolean {
  if (!userId || !s) return false;
  try { s.setItem(dealsViewKey(userId), mode); return true; } catch { return false; }
}
