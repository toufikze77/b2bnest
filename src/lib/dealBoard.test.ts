import { describe, expect, it } from 'vitest';
import {
  BoardDeal, boardSummary, buildBoard, dealsViewKey, loadDealsView, moveDealStage, rememberStages, saveDealsView, stageKey, stageRank,
} from './dealBoard';

let n = 0;
const deal = (stage: string | null, over: Partial<BoardDeal> = {}): BoardDeal => ({
  id: `d${++n}`, title: `Deal ${n}`, stage, value: 100, currency: 'GBP', probability: null, close_date: null, contact_id: null, ...over,
});

describe('board grouping and ordering', () => {
  it('orders known stages first, then won, then lost, then other text by first appearance; no stage last', () => {
    const deals = [deal('Custom B'), deal('lost'), deal(null), deal('negotiation'), deal('closed won'), deal('Custom A'), deal('prospecting'), deal('lead'), deal('qualified'), deal('proposal')];
    expect(buildBoard(deals).map((c) => c.stage)).toEqual(['prospecting', 'lead', 'qualified', 'proposal', 'negotiation', 'closed won', 'lost', 'Custom B', 'Custom A', null]);
  });

  it('only creates columns for stages present in the deals', () => {
    expect(buildBoard([deal('proposal'), deal('proposal')]).map((c) => c.key)).toEqual(['proposal']);
    expect(buildBoard([])).toEqual([]);
  });

  it('groups stage text case- and dash-insensitively, but never rewrites it', () => {
    const a = deal('Closed-Won'), b = deal('closed won'), c = deal('CLOSED_WON');
    const cols = buildBoard([a, b, c]);
    expect(cols).toHaveLength(1);
    expect(cols[0].stage).toBe('Closed-Won'); // first stored text seen
    expect(cols[0].deals.map((d) => d.stage)).toEqual(['Closed-Won', 'closed won', 'CLOSED_WON']);
    expect(stageKey('Closed_Won')).toBe('closed won');
    expect(stageRank('closed won')).toBe(stageRank('won'));
  });

  it('keeps a column that a move has emptied', () => {
    const seen = rememberStages([], [deal('lead'), deal('proposal')]);
    const cols = buildBoard([deal('proposal')], seen);
    expect(cols.map((c) => [c.key, c.deals.length])).toEqual([['lead', 0], ['proposal', 1]]);
  });

  it('orders cards in a column by sort_order', () => {
    const cols = buildBoard([deal('lead', { title: 'B', sort_order: 2 }), deal('lead', { title: 'A', sort_order: 1 })]);
    expect(cols[0].deals.map((d) => d.title)).toEqual(['A', 'B']);
  });
});

describe('per-currency totals', () => {
  it('keeps one total per currency in each column and never adds currencies together', () => {
    const [col] = buildBoard([deal('lead', { value: 100, currency: 'GBP' }), deal('lead', { value: 50, currency: 'usd' }), deal('lead', { value: 25, currency: 'GBP' }), deal('lead', { value: null, currency: null })]);
    expect(col.totals).toEqual([
      { currency: 'GBP', amount: 125, count: 2 },
      { currency: '', amount: 0, count: 1 },
      { currency: 'USD', amount: 50, count: 1 },
    ]);
  });

  it('summary counts open deals only and those expected to close in the next 30 days', () => {
    const today = '2026-10-17';
    const s = boardSummary([
      deal('proposal', { value: 1000, close_date: '2026-10-20' }),
      deal('lead', { value: 200, currency: 'EUR', close_date: '2026-11-16' }),
      deal('lead', { value: 5, close_date: '2026-11-17' }), // day 31: outside
      deal('negotiation', { value: 7, close_date: '2026-10-16' }), // past: outside
      deal('won', { value: 9999, close_date: '2026-10-18' }),
      deal('Closed Lost', { value: 9999 }),
      deal('closed', { value: 9999 }),
    ], today);
    expect(s.openCount).toBe(4);
    expect(s.openTotals).toEqual([{ currency: 'GBP', amount: 1012, count: 3 }, { currency: 'EUR', amount: 200, count: 1 }]);
    expect(s.closingCount).toBe(2);
    expect(s.closingTotals).toEqual([{ currency: 'EUR', amount: 200, count: 1 }, { currency: 'GBP', amount: 1000, count: 1 }]);
  });
});

describe('stage update with rollback', () => {
  const harness = (deals: BoardDeal[]) => {
    let state = deals;
    const seenStates: (string | null)[][] = [];
    return {
      get: () => state,
      update: (fn: (p: BoardDeal[]) => BoardDeal[]) => { state = fn(state); seenStates.push(state.map((d) => d.stage)); },
      seenStates,
    };
  };

  it('moves at once and keeps the move when the save succeeds', async () => {
    const d = deal('lead');
    const h = harness([d]);
    let shownBeforeSave: string | null = null;
    const r = await moveDealStage({ deals: h.get(), id: d.id, to: 'proposal', update: h.update, save: async () => { shownBeforeSave = h.get()[0].stage; return { id: d.id }; } });
    expect(shownBeforeSave).toBe('proposal');
    expect(r).toEqual({ ok: true, from: 'lead' });
    expect(h.get()[0].stage).toBe('proposal');
  });

  it('puts the card back when the save fails or throws', async () => {
    for (const save of [async () => undefined, async () => { throw new Error('network'); }]) {
      const d = deal('lead');
      const h = harness([d, deal('won')]);
      const r = await moveDealStage({ deals: h.get(), id: d.id, to: 'proposal', update: h.update, save });
      expect(r.ok).toBe(false);
      expect(h.get().map((x) => x.stage)).toEqual(['lead', 'won']);
      expect(h.seenStates[0]).toEqual(['proposal', 'won']);
    }
  });

  it('does not undo a later move of the same card', async () => {
    const d = deal('lead');
    const h = harness([d]);
    const r = await moveDealStage({ deals: h.get(), id: d.id, to: 'proposal', update: h.update, save: async () => { h.update((p) => p.map((x) => ({ ...x, stage: 'negotiation' }))); return false; } });
    expect(r.ok).toBe(false);
    expect(h.get()[0].stage).toBe('negotiation');
  });

  it('dropping in the same stage does not save', async () => {
    const d = deal('Lead');
    let saved = false;
    const r = await moveDealStage({ deals: [d], id: d.id, to: 'lead', update: () => {}, save: async () => { saved = true; return true; } });
    expect(r.ok).toBe(true);
    expect(saved).toBe(false);
  });
});

describe('remembered view', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };
  it('is per user, defaults to table, and survives blocked storage', () => {
    const s = mem();
    expect(loadDealsView('u1', s)).toBe('table');
    expect(saveDealsView('u1', 'board', s)).toBe(true);
    expect(loadDealsView('u1', s)).toBe('board');
    expect(loadDealsView('u2', s)).toBe('table');
    expect([...s.m.keys()]).toEqual([dealsViewKey('u1')]);
    s.setItem(dealsViewKey('u1'), 'kanban??');
    expect(loadDealsView('u1', s)).toBe('table');
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    expect(loadDealsView('u1', broken)).toBe('table');
    expect(saveDealsView('u1', 'board', broken)).toBe(false);
    expect(loadDealsView(null, s)).toBe('table');
  });
});
