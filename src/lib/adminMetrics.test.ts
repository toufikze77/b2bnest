import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LIST_LIMIT, METRICS, metricById, metricForCard, metricPath, NO_AI_USAGE, PHASE36_MISSING } from '@/lib/adminMetrics';
import {
  change, createSources, csvCell, fmtPct, perDay, splitPeriods, tableToCsv, USD_TO_GBP, type MetricResult, type Rpc,
} from '@/lib/adminMetricsCore';

const dashboard = fs.readFileSync(path.resolve(__dirname, '../pages/admin/AdminDashboard.tsx'), 'utf8');
const cardLabels = [...new Set([...dashboard.matchAll(/label: '([^']+)'/g)].map((m) => m[1]))];

const days = (n: number, fill: (i: number) => Record<string, number> = () => ({})) =>
  Array.from({ length: n }, (_, i) => ({ day: new Date(Date.now() - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10), users: 0, projects: 0, documents: 0, ai: 0, social: 0, revenue: 0, ...fill(i) }));

/** Everything empty: a brand-new platform (and the ledger before anyone uses AI). */
function emptyRpc(opts: { phase36?: boolean } = {}): Rpc {
  return (async (fn: string, args: Record<string, unknown> = {}) => {
    const d = Number(args._days ?? 30);
    switch (fn) {
      case 'admin_overview_stats': return {};
      case 'admin_analytics_series': return days(d + 1);
      case 'admin_list_companies': case 'admin_list_subscriptions': case 'admin_list_projects': return { rows: [], total: 0 };
      case 'admin_documents_summary': return { rows: [], total: 0, categories: [], this_month: 0, storage_bytes: 0 };
      case 'admin_support_overview': return { rows: [], total: 0, open: 0, pending: 0, resolved: 0, urgent: 0 };
      case 'admin_social_stats': return { total_posts: 0, top_authors: [] };
      case 'admin_ai_ledger_summary': return { credits_spent: 0, credits_refunded: 0, net_credits: 0, requests: 0, cost_usd: 0, unpriced_calls: 0, refund_rate: null,
        by_feature: [], by_day: days(d).map((r) => ({ day: r.day, credits: 0, cost_usd: 0, requests: 0 })), top_users: [], documents_by_type: [] };
      case 'admin_overview_series':
        if (!opts.phase36) throw Object.assign(new Error('Could not find the function public.admin_overview_series'), { code: 'PGRST202' });
        return args._metric === 'ai_daily' ? days(d).map((r) => ({ day: r.day, requests: 0, refunded_requests: 0, credits_spent: 0, credits_refunded: 0, cost_usd: 0 })) : [];
      default: throw new Error(`unexpected ${fn}`);
    }
  }) as Rpc;
}

/** Some real-looking activity. */
function busyRpc(): Rpc {
  const base = emptyRpc({ phase36: true });
  const now = new Date().toISOString();
  return (async (fn: string, args: Record<string, unknown> = {}) => {
    const d = Number(args._days ?? 30);
    switch (fn) {
      case 'admin_overview_stats': return { total_users: 8, active_users: 7, suspended_users: 1, total_companies: 3, active_companies: 2, trial_companies: 1,
        suspended_companies: 1, cancelled_companies: 0, active_subscriptions: 2, no_plan_users: 6, mrr: 148, arr: 1776, total_revenue: 300, trials: 5, total_projects: 4, active_projects: 3 };
      case 'admin_analytics_series': return days(d + 1, (i) => ({ users: i % 3, projects: i % 2, documents: 1, social: i % 4, revenue: i === d ? 59 : 0 }));
      case 'admin_list_companies': return { total: 1200, rows: [
        { name: 'Acme Ltd', status: 'active', subscription_plan: 'Professional', owner_email: 'a@acme.test', members: 3, created_at: now },
        { name: 'Shut Ltd', status: 'suspended', plan: 'free', owner_email: 's@shut.test', members: 1, created_at: now, suspended_at: now },
      ] };
      case 'admin_list_subscriptions': return { total: 2, rows: [
        { email: 'a@acme.test', company: 'Acme Ltd', status: 'active', plan_key: 'professional', billing_interval: 'month', value: 59, ai_credits_remaining: 50, ai_credits_limit: 1000 },
        { email: 'b@scale.test', company: 'Big Co', status: 'active', plan_key: 'enterprise', billing_interval: 'month', value: 89, ai_credits_remaining: 4000, ai_credits_limit: 5000 },
      ] };
      case 'admin_ai_ledger_summary': return { credits_spent: 40, credits_refunded: 10, net_credits: 30, requests: 5, cost_usd: 0.1, unpriced_calls: 1, refund_rate: 0.2,
        by_feature: [{ feature: 'legal_document', requests: 3, credits: 20, refunded: 10, cost_usd: 0.09 }],
        by_day: days(d).map((r, i) => ({ day: r.day, credits: i === d - 1 ? 30 : 0, cost_usd: i === d - 1 ? 0.1 : 0, requests: i === d - 1 ? 5 : 0 })),
        top_users: [{ user_id: 'u', user_name: 'Ann', credits: 30, requests: 5, cost_usd: 0.1 }], documents_by_type: [{ doc_type: 'service_agreement', documents: 2 }] };
      case 'admin_overview_series':
        if (args._metric === 'trials_ending') return [{ company: 'Trial Ltd', owner_email: 't@trial.test', trial_ends_at: now, days_left: 2 }];
        if (args._metric === 'ai_top_users') return [{ name: 'Ann', email: 'ann@acme.test', company: 'Acme Ltd', credits: 30, requests: 5, cost_usd: 0.1 }];
        if (args._metric === 'ai_by_plan') return [{ plan_key: 'professional', subscribers: 1, credits: 30, cost_usd: 0.1, monthly_price_pence: 5900 }];
        return base(fn, args);
      default: return base(fn, args);
    }
  }) as Rpc;
}

/** Every string a page would show, to look for NaN / Infinity / undefined. */
const shown = (r: MetricResult) => JSON.stringify(r);

describe('Platform Overview metrics (Phase 36)', () => {
  it('every one of the 21 cards has a page; ids and cards are unique', () => {
    expect(cardLabels).toHaveLength(21);
    for (const c of cardLabels) expect(metricForCard(c), c).toBeDefined();
    expect(METRICS).toHaveLength(21);
    expect(new Set(METRICS.map((m) => m.id)).size).toBe(21);
    expect(new Set(METRICS.map((m) => m.card)).size).toBe(21);
    expect(METRICS.map((m) => m.card).sort()).toEqual([...cardLabels].sort());
    for (const m of METRICS) {
      expect(metricById(m.id)).toBe(m);
      expect(metricPath(m.id)).toBe(`/admin/overview/${m.id}`);
      expect(m.definition.length).toBeGreaterThan(20);
      expect(m.views.length).toBeGreaterThan(0);
    }
  });

  it.each(METRICS.map((m) => [m.id, m]))('%s: empty data renders states, never NaN / Infinity / undefined', async (_id, m) => {
    for (const d of [7, 30, 90]) {
      const r = await m.load(createSources(emptyRpc()), d);
      const views = m.views.filter((v) => r.views[v]);
      expect(views.length).toBeGreaterThan(0);
      for (const v of Object.keys(r.views)) expect(m.views).toContain(v);
      expect(shown(r)).not.toMatch(/NaN|Infinity|undefined/);
      for (const v of views) {
        const view = r.views[v]!;
        for (const c of view.charts ?? []) expect(c.data).toEqual([]); // empty data: the empty text, not a flat chart
        for (const t of view.tables ?? []) expect(t.emptyText.length).toBeGreaterThan(5);
      }
    }
  });

  it('AI usage with an empty ledger says "No AI usage yet" on every view that charts it', async () => {
    const r = await metricById('ai-usage')!.load(createSources(emptyRpc({ phase36: true })), 30);
    expect(r.views.management!.emptyState).toBe(NO_AI_USAGE);
    expect(r.views.operations!.emptyState).toBe(NO_AI_USAGE);
    expect(r.views.management!.headlines.find((h) => h.label === 'Average cost per document')!.value).toBe('–');
    expect(r.views.management!.warnings).toEqual([]);
  });

  it('sections that need docs/phase36 say so while it is not applied', async () => {
    const ai = await metricById('ai-usage')!.load(createSources(emptyRpc()), 30);
    expect(ai.views.business!.tables!.find((t) => t.csvName === 'ai-by-plan')!.emptyText).toBe(PHASE36_MISSING);
    expect(ai.views.operations!.headlines.find((h) => h.label === 'Refunded requests')!.hint).toBe(PHASE36_MISSING);
    const trials = await metricById('companies-trial')!.load(createSources(emptyRpc()), 30);
    expect(trials.views.business!.tables![0].emptyText).toBe(PHASE36_MISSING);
  });

  it.each(METRICS.map((m) => [m.id, m]))('%s: with activity, every view has headlines and no NaN', async (_id, m) => {
    const r = await m.load(createSources(busyRpc()), 30);
    expect(shown(r)).not.toMatch(/NaN|Infinity|undefined/);
    for (const v of m.views) if (r.views[v]) expect(r.views[v]!.headlines.length).toBeGreaterThan(0);
  });

  it('AI usage with activity: GBP at the stated rate, unpriced warning, near-limit list, top users with email', async () => {
    const r = await metricById('ai-usage')!.load(createSources(busyRpc()), 30);
    const m = r.views.management!;
    expect(m.headlines.find((h) => h.label === 'OpenAI cost')!.hint).toBe(`about £${(0.1 * USD_TO_GBP).toFixed(2)}`);
    expect(m.notes!.join(' ')).toContain(`$1 = £${USD_TO_GBP} (assumed`);
    expect(m.warnings![0]).toMatch(/1 AI call\(s\) used a model with no price/);
    expect(m.headlines.find((h) => h.label === 'Average cost per document')!.value).toBe('US$0.045');
    expect(m.tables!.find((t) => t.csvName === 'ai-top-users')!.rows[0]).toMatchObject({ email: 'ann@acme.test', company: 'Acme Ltd' });
    const near = r.views.business!.tables!.find((t) => t.csvName === 'ai-near-limit')!;
    expect(near.rows).toEqual([{ email: 'a@acme.test', company: 'Acme Ltd', plan: 'Business', left: 50, limit: 1000 }]);
    expect(r.views.business!.tables!.find((t) => t.csvName === 'ai-by-plan')!.rows[0]).toMatchObject({ plan: 'Business', price: '£59' });
  });

  it('money: real plan names and prices, and says what history is not stored', async () => {
    const r = await metricById('mrr')!.load(createSources(busyRpc()), 30);
    const mix = r.views.management!.tables![0].rows;
    expect(mix.map((x) => x.plan)).toEqual(['Solo', 'Business', 'Scale']);
    expect(mix.find((x) => x.plan === 'Business')!.mrr_text).toBe('£59.00');
    expect(r.views.management!.notes!.join(' ')).toContain('Subscription history is not stored');
    expect(r.views.management!.notes!.join(' ')).toContain('Solo £19 a month or £190 a year');
  });

  it('lists capped at LIST_LIMIT say so', async () => {
    const r = await metricById('companies-total')!.load(createSources(busyRpc()), 30);
    expect(LIST_LIMIT).toBe(1000);
    expect(r.views.management!.tables![0].note).toBe('Based on the most recent 2 of 1,200 companies.');
  });

  it('each RPC is called once per page load, however many sections use it', async () => {
    const calls: string[] = [];
    const base = busyRpc();
    const rpc = (async (fn: string, args?: Record<string, unknown>) => { calls.push(`${fn}:${JSON.stringify(args ?? {})}`); return base(fn, args); }) as Rpc;
    await metricById('ai-usage')!.load(createSources(rpc), 30);
    expect(calls.length).toBe(new Set(calls).size);
  });
});

describe('CSV export', () => {
  it('escapes commas, quotes and newlines', () => {
    expect(csvCell('Acme, Ltd')).toBe('"Acme, Ltd"');
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(12.5)).toBe('12.5');
  });
  it('neutralises spreadsheet formulas (= + - @, tab, carriage return) in text, not in numbers', () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
    expect(csvCell('+44 20')).toBe("'+44 20");
    expect(csvCell('-1+1')).toBe("'-1+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tcmd')).toBe("'\tcmd");
    expect(csvCell(-5)).toBe('-5');
  });
  it('builds a header row from the column labels', () => {
    expect(tableToCsv([{ key: 'a', label: 'Name' }, { key: 'b', label: 'Count' }], [{ a: '=1', b: 2 }, { a: 'x,y', b: null }]))
      .toBe("Name,Count\r\n'=1,2\r\n\"x,y\",");
  });
});

describe('period helpers', () => {
  it('splits 2 × days + 1 rows into this period and the one before', () => {
    const rows = Array.from({ length: 15 }, (_, i) => i);
    expect(splitPeriods(rows, 7)).toEqual({ current: [8, 9, 10, 11, 12, 13, 14], previous: [1, 2, 3, 4, 5, 6, 7] });
  });
  it('counts per day with zeros, ignoring dates outside the window', () => {
    const now = new Date('2026-11-02T12:00:00Z');
    expect(perDay(['2026-11-02T08:00:00Z', '2026-11-01T23:00:00Z', '2026-11-02T01:00:00Z', '2026-10-01T00:00:00Z', null], 3, now))
      .toEqual([{ day: '2026-10-31', count: 0 }, { day: '2026-11-01', count: 1 }, { day: '2026-11-02', count: 2 }]);
  });
  it('change and share never divide by zero', () => {
    expect(change(5, 0)).toBeNull();
    expect(change(15, 10)).toBe(50);
    expect(fmtPct(1, 0)).toBe('–');
  });
});
