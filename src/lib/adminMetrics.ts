// Phase 36: one config per Platform Overview card. Each opens /admin/overview/:metric (AdminMetricDetail). Data comes
// only from the admin_* RPCs (super admin + aal2 on the server) and, for four sections, admin_overview_series
// (docs/phase36/proposal.sql). No invented numbers: what isn't stored is said on the page, not drawn.
import { planDisplayName, PLANS } from '@/lib/plans';
import {
  allZero, change, countBy, fmtBytes, fmtDate, fmtGbp, fmtInt, fmtPct, fmtUsd, label, num, perDay, splitPeriods, sumOf,
  USD_TO_GBP,
  type ChartSpec, type MetricConfig, type MetricResult, type MetricView, type Sources, type TableSpec, type ViewData,
} from '@/lib/adminMetricsCore';

/** How many rows the list RPCs are asked for. A page says so when there are more. */
export const LIST_LIMIT = 1000;
export const PHASE36_MISSING = 'Not available until the Phase 36 database update (docs/phase36) is applied.';
export const NO_AI_USAGE = 'No AI usage yet. Credits, costs and documents appear here as soon as people use the AI features.';

type Obj = Record<string, unknown>;
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v as Obj[]) : []);
const rowsOf = (v: unknown): { rows: Obj[]; total: number } => {
  const o = (v ?? {}) as Obj;
  const rows = arr(o.rows);
  return { rows, total: Math.max(num(o.total), rows.length) };
};
const capNote = (shown: number, total: number, what: string) =>
  total > shown ? `Based on the most recent ${fmtInt(shown)} of ${fmtInt(total)} ${what}.` : undefined;
const inLast = (iso: unknown, days: number, offsetDays = 0) => {
  if (typeof iso !== 'string') return false;
  const t = Date.parse(iso);
  const end = Date.now() - offsetDays * 86_400_000;
  return Number.isFinite(t) && t <= end && t > end - days * 86_400_000;
};
const daily = (title: string, data: Obj[], series: { key: string; label: string }[], kind: 'line' | 'bar', emptyText: string, unit = ''): ChartSpec => {
  const total = series.map((s) => `${s.label}: ${fmtInt(sumOf(data, s.key))}${unit}`).join('; ');
  return {
    title, kind, xKey: 'day', xLabel: 'Day', series, emptyText,
    data: allZero(data, series.map((s) => s.key)) ? [] : (data as ChartSpec['data']),
    summary: `${title}, ${data.length} days. Totals: ${total}.`,
  };
};
const dayData = (rows: Obj[], keys: string[]) => rows.map((r) => {
  const out: Record<string, string | number> = { day: String(r.day ?? '') };
  for (const k of keys) out[k] = num(r[k]);
  return out;
});

// ---------------------------------------------------------------------------------------------------------------------
// Users

async function usersMetric(src: Sources, days: number, focus: 'total' | 'active' | 'new'): Promise<MetricResult> {
  const [stats, series] = await Promise.all([
    src.get<Obj>('admin_overview_stats'),
    src.get<Obj[]>('admin_analytics_series', { _days: days * 2 }),
  ]);
  const { current, previous } = splitPeriods(arr(series), days);
  const newNow = sumOf(current, 'users'), newBefore = sumOf(previous, 'users');
  const total = num(stats.total_users), active = num(stats.active_users), suspended = num(stats.suspended_users);
  const headlines = [
    { label: 'Total users', value: fmtInt(total) },
    { label: `New in the last ${days} days`, value: fmtInt(newNow), change: change(newNow, newBefore), hint: `${fmtInt(newBefore)} in the ${days} days before` },
    { label: 'Active share', value: fmtPct(active, total), hint: `${fmtInt(active)} active, ${fmtInt(suspended)} suspended` },
  ];
  if (focus === 'new') headlines.unshift(headlines.splice(1, 1)[0]);
  if (focus === 'active') headlines.unshift(headlines.splice(2, 1)[0]);
  const topDays = [...current].filter((r) => num(r.users) > 0).sort((a, b) => num(b.users) - num(a.users) || String(b.day).localeCompare(String(a.day))).slice(0, 10);
  return {
    views: {
      management: {
        headlines,
        charts: [daily('Sign-ups per day', dayData(current, ['users']), [{ key: 'users', label: 'Sign-ups' }], 'bar', `No sign-ups in the last ${days} days.`)],
        tables: [{
          title: 'Top sign-up days', csvName: 'top-signup-days', emptyText: `No sign-ups in the last ${days} days.`,
          columns: [{ key: 'day', label: 'Day' }, { key: 'users', label: 'Sign-ups', numeric: true }],
          rows: topDays.map((r) => ({ day: fmtDate(String(r.day)), users: num(r.users) })),
        }],
        notes: ['A user is a profile (one per sign-up). "Active" means the account is not suspended; it does not measure recent sign-ins, which are not stored.'],
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Companies

const COMPANY_STATUSES = ['active', 'trial', 'suspended', 'cancelled'];

async function companiesMetric(src: Sources, days: number, focus: string): Promise<MetricResult> {
  const [stats, list, trials] = await Promise.all([
    src.get<Obj>('admin_overview_stats'),
    src.get<Obj>('admin_list_companies', { _search: null, _limit: LIST_LIMIT, _offset: 0, _status: 'all', _plan: 'all' }),
    src.optional<Obj[]>('admin_overview_series', { _metric: 'trials_ending', _days: days }),
  ]);
  const { rows, total } = rowsOf(list);
  const newNow = rows.filter((r) => inLast(r.created_at, days)).length;
  const newBefore = rows.filter((r) => inLast(r.created_at, days, days)).length;
  const byStatus = countBy(rows, (r) => String(r.status ?? 'active'));
  const statusRows = [...COMPANY_STATUSES, ...byStatus.map((s) => s.name).filter((n) => !COMPANY_STATUSES.includes(n))]
    .map((s) => ({ status: label(s), companies: byStatus.find((b) => b.name === s)?.count ?? 0, share: fmtPct(byStatus.find((b) => b.name === s)?.count ?? 0, rows.length) }));
  const focusCount: Record<string, [string, number]> = {
    total: ['Total companies', num(stats.total_companies)], active: ['Active companies', num(stats.active_companies)],
    trial: ['Trial companies', num(stats.trial_companies)], suspended: ['Suspended companies', num(stats.suspended_companies)],
    cancelled: ['Cancelled companies', num(stats.cancelled_companies)], new: [`New in the last ${days} days`, newNow],
  };
  const [focusLabel, focusValue] = focusCount[focus] ?? focusCount.total;
  const headlines = [
    { label: focusLabel, value: fmtInt(focusValue), ...(focus === 'new' ? { change: change(newNow, newBefore) } : {}) },
    ...(focus === 'total' ? [] : [{ label: 'Total companies', value: fmtInt(stats.total_companies) }]),
    ...(focus === 'new' ? [] : [{ label: `New in the last ${days} days`, value: fmtInt(newNow), change: change(newNow, newBefore) }]),
  ];
  const cap = capNote(rows.length, total, 'companies');
  const listed = (status: string): TableSpec => ({
    title: `${label(status)} companies`, csvName: `${status}-companies`, emptyText: `No ${status} companies.`, note: cap,
    columns: [{ key: 'company', label: 'Company' }, { key: 'owner_email', label: 'Owner email' }, { key: 'plan', label: 'Plan' },
      { key: 'members', label: 'Members', numeric: true }, { key: 'since', label: status === 'suspended' ? 'Suspended on' : 'Created on' }],
    rows: rows.filter((r) => r.status === status).slice(0, 25).map((r) => ({
      company: String(r.name ?? ''), owner_email: String(r.owner_email ?? ''), plan: planDisplayName(String(r.subscription_plan ?? r.plan ?? '')),
      members: num(r.members), since: fmtDate(status === 'suspended' ? (r.suspended_at as string) ?? (r.created_at as string) : (r.created_at as string)),
    })),
  });
  const trialTable: TableSpec = {
    title: 'Trials ending in the next 7 days (who to contact)', csvName: 'trials-ending', emptyText: trials ? 'No trials end in the next 7 days.' : PHASE36_MISSING,
    columns: [{ key: 'company', label: 'Company' }, { key: 'owner_email', label: 'Owner email' }, { key: 'ends', label: 'Trial ends' }, { key: 'days_left', label: 'Days left', numeric: true }],
    rows: arr(trials).map((t) => ({ company: String(t.company ?? ''), owner_email: String(t.owner_email ?? ''), ends: fmtDate(t.trial_ends_at), days_left: num(t.days_left) })),
    note: 'At most 25, soonest first. Only companies with no active subscription.',
  };
  const plans = countBy(rows.filter((r) => r.status === 'active'), (r) => planDisplayName(String(r.subscription_plan ?? r.plan ?? '')));
  const views: Partial<Record<MetricView, ViewData>> = {
    management: {
      headlines,
      charts: [daily('New companies per day', perDay(rows.map((r) => r.created_at as string), days), [{ key: 'count', label: 'New companies' }], 'bar', `No new companies in the last ${days} days.`)],
      tables: [{ title: 'Companies by status', csvName: 'companies-by-status', emptyText: 'No companies yet.', note: cap,
        columns: [{ key: 'status', label: 'Status' }, { key: 'companies', label: 'Companies', numeric: true }, { key: 'share', label: 'Share' }], rows: statusRows }],
      notes: ['A company is an organisation in B2BNest. Its status comes from its owner: an active subscription, a running trial, or suspended / cancelled by an admin.'],
    },
    business: {
      headlines: [{ label: 'Trials ending in 7 days', value: trials ? fmtInt(arr(trials).length) : '–', hint: trials ? undefined : PHASE36_MISSING },
        { label: 'Trial companies', value: fmtInt(stats.trial_companies) }],
      tables: [trialTable, { title: 'Active companies by plan', csvName: 'active-companies-by-plan', emptyText: 'No active (paying) companies yet.', note: cap,
        columns: [{ key: 'name', label: 'Plan' }, { key: 'count', label: 'Companies', numeric: true }], rows: plans }],
      notes: ['Trial-to-paid conversion is not shown: when a trial started and when it became a subscription are not stored together, so the rate would be a guess.'],
    },
  };
  if (focus === 'suspended' || focus === 'cancelled') {
    views.operations = { headlines: [{ label: focusLabel, value: fmtInt(focusValue) }], tables: [listed(focus)] };
  }
  return { views };
}

// ---------------------------------------------------------------------------------------------------------------------
// Subscriptions and money

async function moneyMetric(src: Sources, days: number, focus: string): Promise<MetricResult> {
  const [stats, subs, series, trials] = await Promise.all([
    src.get<Obj>('admin_overview_stats'),
    src.get<Obj>('admin_list_subscriptions', { _status: 'all', _search: null, _limit: LIST_LIMIT, _offset: 0 }),
    src.get<Obj[]>('admin_analytics_series', { _days: days * 2 }),
    focus === 'no_plan' ? src.optional<Obj[]>('admin_overview_series', { _metric: 'trials_ending', _days: days }) : Promise.resolve(null),
  ]);
  const { rows, total } = rowsOf(subs);
  const active = rows.filter((r) => r.status === 'active');
  const mixRows = [...PLANS.map((p) => p.id as string), 'other'].map((key) => {
    const mine = active.filter((r) => (key === 'other' ? !PLANS.some((p) => planDisplayName(String(r.plan_key ?? r.plan ?? '')) === p.name)
      : planDisplayName(String(r.plan_key ?? r.plan ?? '')) === PLANS.find((p) => p.id === key)!.name));
    const mrr = mine.reduce((t, r) => t + num(r.value), 0);
    return {
      plan: key === 'other' ? 'Other / not mapped' : PLANS.find((p) => p.id === key)!.name,
      monthly: mine.filter((r) => r.billing_interval !== 'year').length,
      annual: mine.filter((r) => r.billing_interval === 'year').length,
      mrr, share: fmtPct(mrr, num(stats.mrr)),
    };
  }).filter((r) => r.plan !== 'Other / not mapped' || r.monthly + r.annual > 0);
  const { current, previous } = splitPeriods(arr(series), days);
  const revNow = sumOf(current, 'revenue'), revBefore = sumOf(previous, 'revenue');
  const cap = capNote(rows.length, total, 'subscription records');
  const priceList = PLANS.map((p) => `${p.name} ${fmtGbp(p.monthly)} a month or ${fmtGbp(p.annual)} a year`).join('; ');
  const planChart: ChartSpec = {
    title: 'Monthly recurring revenue by plan', kind: 'bar', xKey: 'plan', xLabel: 'Plan', series: [{ key: 'mrr', label: 'MRR (£)' }],
    data: mixRows.some((r) => r.mrr > 0) ? mixRows.map((r) => ({ plan: r.plan, mrr: r.mrr })) : [],
    emptyText: 'No paying subscribers yet.', summary: mixRows.map((r) => `${r.plan}: ${fmtGbp(r.mrr)} a month`).join('; ') + '.',
  };
  const mixTable: TableSpec = {
    title: 'Plan mix (active subscriptions)', csvName: 'plan-mix', emptyText: 'No active subscriptions yet.', note: cap,
    columns: [{ key: 'plan', label: 'Plan' }, { key: 'monthly', label: 'Monthly', numeric: true }, { key: 'annual', label: 'Annual', numeric: true },
      { key: 'mrr_text', label: 'MRR' }, { key: 'share', label: 'Share of MRR' }],
    rows: mixRows.map((r) => ({ plan: r.plan, monthly: r.monthly, annual: r.annual, mrr_text: fmtGbp(r.mrr, 2), share: r.share })),
  };
  const head: Record<string, [string, string]> = {
    active_subscriptions: ['Active subscriptions', fmtInt(stats.active_subscriptions)],
    paid_subscribers: ['Paid subscribers', fmtInt(stats.active_subscriptions)],
    no_plan: ['No plan', fmtInt(stats.no_plan_users ?? stats.free_users)],
    mrr: ['Monthly recurring revenue', fmtGbp(stats.mrr)],
    arr: ['Annual recurring revenue', fmtGbp(stats.arr)],
    total_revenue: ['Total revenue', fmtGbp(stats.total_revenue)],
  };
  const [fl, fv] = head[focus];
  const management: ViewData = {
    headlines: [
      { label: fl, value: fv },
      ...(['mrr', 'arr', 'total_revenue'].includes(focus) ? [] : [{ label: 'Monthly recurring revenue', value: fmtGbp(stats.mrr) }]),
      ...(focus === 'arr' ? [] : [{ label: 'Annual recurring revenue', value: fmtGbp(stats.arr), hint: 'MRR × 12' }]),
      ...(focus === 'mrr' || focus === 'arr' ? [{ label: 'Active subscriptions', value: fmtInt(stats.active_subscriptions) }] : []),
    ],
    charts: [planChart],
    tables: [mixTable],
    notes: [
      `MRR uses each subscription's real Stripe price; annual plans count as a twelfth. Current list prices: ${priceList}.`,
      num(stats.mrr_estimated) > 0 ? `${fmtInt(stats.mrr_estimated)} subscription(s) have a Stripe price that isn't mapped yet; they are counted at today's list price.` : '',
      'Subscription history is not stored, so there is no MRR trend and no new-versus-cancelled chart: these are today\'s figures.',
    ].filter(Boolean),
  };
  const revenue: ViewData = {
    headlines: [
      { label: 'Total revenue', value: fmtGbp(stats.total_revenue) },
      { label: `Revenue in the last ${days} days`, value: fmtGbp(revNow), change: change(revNow, revBefore), hint: `${fmtGbp(revBefore)} in the ${days} days before` },
    ],
    charts: [daily('Payments received per day (£)', dayData(current, ['revenue']), [{ key: 'revenue', label: 'Revenue (£)' }], 'bar', `No payments in the last ${days} days.`)],
    tables: [{ title: 'Days with payments', csvName: 'revenue-by-day', emptyText: `No payments in the last ${days} days.`,
      columns: [{ key: 'day', label: 'Day' }, { key: 'revenue', label: 'Revenue (£)', numeric: true }],
      rows: current.filter((r) => num(r.revenue) > 0).reverse().map((r) => ({ day: fmtDate(String(r.day)), revenue: num(r.revenue) })) }],
    notes: ['Revenue is the sum of payments recorded as paid. Refunds and Stripe fees are not subtracted.'],
  };
  const views: Partial<Record<MetricView, ViewData>> = focus === 'total_revenue' ? { management: revenue } : { management };
  if (focus === 'paid_subscribers' || focus === 'mrr' || focus === 'arr') views.business = revenue;
  if (focus === 'no_plan') {
    views.business = {
      headlines: [{ label: 'No plan', value: fmtInt(stats.no_plan_users ?? stats.free_users) }, { label: 'On a trial', value: fmtInt(stats.trials) }],
      tables: [{ title: 'Trials ending in the next 7 days (who to contact)', csvName: 'trials-ending', emptyText: trials ? 'No trials end in the next 7 days.' : PHASE36_MISSING,
        columns: [{ key: 'company', label: 'Company' }, { key: 'owner_email', label: 'Owner email' }, { key: 'ends', label: 'Trial ends' }, { key: 'days_left', label: 'Days left', numeric: true }],
        rows: arr(trials).map((t) => ({ company: String(t.company ?? ''), owner_email: String(t.owner_email ?? ''), ends: fmtDate(t.trial_ends_at), days_left: num(t.days_left) })) }],
      notes: ['"No plan" counts accounts without an active subscription: on their trial, or after it ended.'],
    };
  }
  return { views };
}

// ---------------------------------------------------------------------------------------------------------------------
// AI usage (the Phase 35 ledger)

export interface AiSummary {
  credits_spent?: number; credits_refunded?: number; net_credits?: number; requests?: number; cost_usd?: number;
  unpriced_calls?: number; refund_rate?: number | null;
  by_feature?: Obj[]; by_day?: Obj[]; top_users?: Obj[]; documents_by_type?: Obj[];
}
export const ledgerIsEmpty = (s: AiSummary | null | undefined) => !s || (num(s.requests) === 0 && num(s.credits_spent) === 0 && num(s.cost_usd) === 0);
const FEATURE_NAMES: Record<string, string> = { ai_assistant: 'AI assistant and Advisor', legal_document: 'Contracts and legal notices', template: 'AI templates' };
const featureName = (f: unknown) => FEATURE_NAMES[String(f)] ?? label(f);

async function aiMetric(src: Sources, days: number): Promise<MetricResult> {
  const [s, both, stats, dailyRows, byPlan, top, subs] = await Promise.all([
    src.get<AiSummary>('admin_ai_ledger_summary', { _days: days }),
    src.get<AiSummary>('admin_ai_ledger_summary', { _days: days * 2 }),
    src.get<Obj>('admin_overview_stats'),
    src.optional<Obj[]>('admin_overview_series', { _metric: 'ai_daily', _days: days }),
    src.optional<Obj[]>('admin_overview_series', { _metric: 'ai_by_plan', _days: days }),
    src.optional<Obj[]>('admin_overview_series', { _metric: 'ai_top_users', _days: days }),
    src.get<Obj>('admin_list_subscriptions', { _status: 'all', _search: null, _limit: LIST_LIMIT, _offset: 0 }),
  ]);
  const empty = ledgerIsEmpty(s);
  const net = num(s.net_credits), netPrev = num(both.net_credits) - net;
  const cost = num(s.cost_usd), costPrev = num(both.cost_usd) - cost;
  const costGbp = cost * USD_TO_GBP;
  const revenueInPeriod = num(stats.mrr) * days / 30;
  const legal = arr(s.by_feature).find((f) => f.feature === 'legal_document');
  const docs = arr(s.documents_by_type).reduce((t, d) => t + num(d.documents), 0);
  const rateNote = `GBP at $1 = £${USD_TO_GBP} (assumed; OpenAI bills in US dollars).`;
  const warnings = num(s.unpriced_calls) > 0
    ? [`${fmtInt(s.unpriced_calls)} AI call(s) used a model with no price in ai_model_prices, so their cost is missing from these totals. Add the price with SQL.`]
    : [];

  const management: ViewData = {
    emptyState: empty ? NO_AI_USAGE : undefined,
    headlines: [
      { label: 'Credits used (net)', value: fmtInt(net), change: change(net, netPrev), hint: `${fmtInt(s.credits_spent)} spent, ${fmtInt(s.credits_refunded)} refunded` },
      { label: 'Requests', value: fmtInt(s.requests) },
      { label: 'OpenAI cost', value: fmtUsd(cost), change: change(cost, costPrev), hint: `about ${fmtGbp(costGbp, 2)}` },
      { label: 'Cost vs revenue', value: revenueInPeriod > 0 ? fmtPct(costGbp, revenueInPeriod) : '–',
        hint: revenueInPeriod > 0 ? `${fmtGbp(costGbp, 2)} of about ${fmtGbp(revenueInPeriod)} (MRR × ${days} ÷ 30)` : 'No subscription revenue yet' },
      { label: 'Average cost per document', value: docs > 0 ? fmtUsd(num(legal?.cost_usd) / docs, 3) : '–', hint: docs > 0 ? `${fmtInt(docs)} documents delivered` : 'No documents yet' },
    ],
    charts: [
      daily('Credits used per day', dayData(arr(s.by_day), ['credits']), [{ key: 'credits', label: 'Credits (net)' }], 'bar', NO_AI_USAGE),
      daily('OpenAI cost per day (US$)', dayData(arr(s.by_day), ['cost_usd']), [{ key: 'cost_usd', label: 'Cost (US$)' }], 'line', NO_AI_USAGE),
    ],
    tables: [
      { title: 'By feature', csvName: 'ai-by-feature', emptyText: NO_AI_USAGE,
        columns: [{ key: 'feature', label: 'Feature' }, { key: 'requests', label: 'Requests', numeric: true }, { key: 'credits', label: 'Credits (net)', numeric: true },
          { key: 'refunded', label: 'Refunded', numeric: true }, { key: 'cost_usd', label: 'Cost (US$)', numeric: true }],
        rows: arr(s.by_feature).map((f) => ({ feature: featureName(f.feature), requests: num(f.requests), credits: num(f.credits), refunded: num(f.refunded), cost_usd: num(f.cost_usd) })) },
      { title: 'Documents delivered by type', csvName: 'ai-documents-by-type', emptyText: 'No documents delivered yet.',
        columns: [{ key: 'doc_type', label: 'Document type' }, { key: 'documents', label: 'Documents', numeric: true }],
        rows: arr(s.documents_by_type).map((d) => ({ doc_type: label(d.doc_type), documents: num(d.documents) })) },
      top
        ? { title: 'Top 10 users by credits', csvName: 'ai-top-users', emptyText: NO_AI_USAGE,
            columns: [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'company', label: 'Company' },
              { key: 'credits', label: 'Credits', numeric: true }, { key: 'requests', label: 'Requests', numeric: true }, { key: 'cost_usd', label: 'Cost (US$)', numeric: true }],
            rows: top.map((u) => ({ name: String(u.name ?? ''), email: String(u.email ?? ''), company: String(u.company ?? ''), credits: num(u.credits), requests: num(u.requests), cost_usd: num(u.cost_usd) })) }
        : { title: 'Top 10 users by credits', csvName: 'ai-top-users', emptyText: NO_AI_USAGE, note: 'Email and company appear once the Phase 36 database update is applied.',
            columns: [{ key: 'name', label: 'Name' }, { key: 'credits', label: 'Credits', numeric: true }, { key: 'requests', label: 'Requests', numeric: true }, { key: 'cost_usd', label: 'Cost (US$)', numeric: true }],
            rows: arr(s.top_users).map((u) => ({ name: String(u.user_name ?? ''), credits: num(u.credits), requests: num(u.requests), cost_usd: num(u.cost_usd) })) },
    ],
    warnings,
    notes: [rateNote, 'From the AI credit ledger: every credit taken, refunded and every AI call\'s tokens. It holds no prompts, answers or documents.'],
  };

  const refundRate = s.refund_rate === null || s.refund_rate === undefined ? '–' : `${(num(s.refund_rate) * 100).toFixed(1)}%`;
  const refunded = arr(dailyRows).reduce((t, d) => t + num(d.refunded_requests), 0);
  const operations: ViewData = {
    emptyState: empty ? NO_AI_USAGE : undefined,
    headlines: [
      { label: 'Refund rate', value: refundRate, hint: 'Requests whose credits were given back because the AI failed' },
      { label: 'Refunded requests', value: dailyRows ? fmtInt(refunded) : '–', hint: dailyRows ? undefined : PHASE36_MISSING },
      { label: 'Calls without a price', value: fmtInt(s.unpriced_calls) },
    ],
    charts: dailyRows ? [{
      ...daily('Refund rate per day (%)', arr(dailyRows).map((d) => ({ day: String(d.day), rate: num(d.requests) > 0 ? Math.round((num(d.refunded_requests) / num(d.requests)) * 1000) / 10 : 0, requests: num(d.requests) })),
        [{ key: 'rate', label: 'Refund rate (%)' }], 'line', NO_AI_USAGE, '%'),
      summary: `Refund rate per day: ${refundRate} over ${days} days, ${fmtInt(refunded)} refunded of ${fmtInt(s.requests)} requests.`,
    }] : [],
    tables: [{ title: 'Requests and refunds per day', csvName: 'ai-refunds-by-day', emptyText: dailyRows ? NO_AI_USAGE : PHASE36_MISSING,
      columns: [{ key: 'day', label: 'Day' }, { key: 'requests', label: 'Requests', numeric: true }, { key: 'refunded', label: 'Refunded', numeric: true },
        { key: 'credits_spent', label: 'Credits spent', numeric: true }, { key: 'credits_refunded', label: 'Credits refunded', numeric: true }],
      rows: arr(dailyRows).filter((d) => num(d.requests) > 0).reverse().map((d) => ({ day: fmtDate(String(d.day)), requests: num(d.requests), refunded: num(d.refunded_requests), credits_spent: num(d.credits_spent), credits_refunded: num(d.credits_refunded) })) }],
    warnings,
    notes: ['A rising refund rate means the model, or the document quality check, is failing more often: check the Edge Function logs.'],
  };

  const subsRows = rowsOf(subs).rows;
  const nearLimit = subsRows
    .filter((r) => r.status === 'active' && num(r.ai_credits_limit) > 0 && num(r.ai_credits_remaining) / num(r.ai_credits_limit) <= 0.2)
    .sort((a, b) => num(a.ai_credits_remaining) / num(a.ai_credits_limit) - num(b.ai_credits_remaining) / num(b.ai_credits_limit))
    .slice(0, 25);
  const business: ViewData = {
    headlines: [
      { label: 'Paying users close to their limit', value: fmtInt(nearLimit.length), hint: '20% or less of their monthly credits left' },
      { label: 'Credits used (net)', value: fmtInt(net) },
    ],
    tables: [
      { title: 'Close to their monthly limit (bigger plan or a top-up pack)', csvName: 'ai-near-limit', emptyText: 'No paying user is close to their limit.',
        columns: [{ key: 'email', label: 'Email' }, { key: 'company', label: 'Company' }, { key: 'plan', label: 'Plan' },
          { key: 'left', label: 'Credits left', numeric: true }, { key: 'limit', label: 'Monthly credits', numeric: true }],
        rows: nearLimit.map((r) => ({ email: String(r.email ?? ''), company: String(r.company ?? ''), plan: planDisplayName(String(r.plan_key ?? r.plan ?? '')), left: num(r.ai_credits_remaining), limit: num(r.ai_credits_limit) })),
        note: 'At most 25, least left first. Top-up packs are not on sale yet.' },
      { title: 'Credits used per plan against plan price', csvName: 'ai-by-plan', emptyText: byPlan ? NO_AI_USAGE : PHASE36_MISSING,
        columns: [{ key: 'plan', label: 'Plan' }, { key: 'subscribers', label: 'Active subscribers', numeric: true }, { key: 'credits', label: 'Credits (net)', numeric: true },
          { key: 'cost', label: 'OpenAI cost' }, { key: 'price', label: 'Monthly price' }, { key: 'per_sub', label: 'Cost per subscriber' }],
        rows: arr(byPlan).map((p) => ({
          plan: p.plan_key === 'none' ? 'No plan' : planDisplayName(String(p.plan_key)), subscribers: num(p.subscribers), credits: num(p.credits),
          cost: `${fmtUsd(p.cost_usd)} (about ${fmtGbp(num(p.cost_usd) * USD_TO_GBP, 2)})`,
          price: p.monthly_price_pence === null || p.monthly_price_pence === undefined ? '–' : fmtGbp(num(p.monthly_price_pence) / 100),
          per_sub: num(p.subscribers) > 0 ? fmtGbp((num(p.cost_usd) * USD_TO_GBP) / num(p.subscribers), 2) : '–',
        })) },
    ],
    notes: [rateNote, `The cost is for the last ${days} days; the price is a month's list price.`],
  };
  return { views: { management, operations, business } };
}

// ---------------------------------------------------------------------------------------------------------------------
// Projects, documents, storage, support, social

async function projectsMetric(src: Sources, days: number): Promise<MetricResult> {
  const [stats, list, series] = await Promise.all([
    src.get<Obj>('admin_overview_stats'),
    src.get<Obj>('admin_list_projects', { _search: null, _status: 'all', _limit: LIST_LIMIT, _offset: 0 }),
    src.get<Obj[]>('admin_analytics_series', { _days: days * 2 }),
  ]);
  const { rows, total } = rowsOf(list);
  const { current, previous } = splitPeriods(arr(series), days);
  const cap = capNote(rows.length, total, 'projects');
  return {
    views: {
      management: {
        headlines: [
          { label: 'Active projects', value: fmtInt(stats.active_projects), hint: 'Not archived, not completed' },
          { label: 'All projects', value: fmtInt(stats.total_projects) },
          { label: `New in the last ${days} days`, value: fmtInt(sumOf(current, 'projects')), change: change(sumOf(current, 'projects'), sumOf(previous, 'projects')) },
        ],
        charts: [daily('New projects per day', dayData(current, ['projects']), [{ key: 'projects', label: 'New projects' }], 'bar', `No new projects in the last ${days} days.`)],
        tables: [{ title: 'Projects by status', csvName: 'projects-by-status', emptyText: 'No projects yet.', note: cap,
          columns: [{ key: 'name', label: 'Status' }, { key: 'count', label: 'Projects', numeric: true }],
          rows: countBy(rows, (r) => (r.archived_at ? 'Archived' : label(r.status ?? 'active'))) }],
      },
      operations: {
        headlines: [{ label: 'Companies with projects', value: fmtInt(new Set(rows.map((r) => r.company).filter(Boolean)).size) }],
        tables: [{ title: 'Companies with the most projects', csvName: 'projects-by-company', emptyText: 'No projects yet.', note: cap,
          columns: [{ key: 'name', label: 'Company' }, { key: 'count', label: 'Projects', numeric: true }],
          rows: countBy(rows, (r) => String(r.company ?? 'No company')).slice(0, 25) }],
      },
    },
  };
}

async function documentsMetric(src: Sources, days: number, focus: 'documents' | 'storage'): Promise<MetricResult> {
  const [docs, series] = await Promise.all([
    src.get<Obj>('admin_documents_summary', { _limit: LIST_LIMIT, _offset: 0 }),
    src.get<Obj[]>('admin_analytics_series', { _days: days * 2 }),
  ]);
  const { rows, total } = rowsOf(docs);
  const { current, previous } = splitPeriods(arr(series), days);
  const cap = capNote(rows.length, total, 'documents');
  const byCat = new Map<string, { count: number; bytes: number }>();
  for (const r of rows) {
    const k = label(r.category ?? 'uncategorised');
    const v = byCat.get(k) ?? { count: 0, bytes: 0 };
    v.count += 1; v.bytes += num(r.file_size);
    byCat.set(k, v);
  }
  const catRows = [...byCat.entries()].map(([name, v]) => ({ name, count: v.count, size: fmtBytes(v.bytes), bytes: v.bytes }));
  if (focus === 'storage') {
    return {
      views: {
        operations: {
          headlines: [{ label: 'Storage used', value: fmtBytes(docs.storage_bytes) }, { label: 'Documents', value: fmtInt(docs.total) }],
          tables: [{ title: 'Storage by category', csvName: 'storage-by-category', emptyText: 'No documents stored yet.', note: cap,
            columns: [{ key: 'name', label: 'Category' }, { key: 'count', label: 'Documents', numeric: true }, { key: 'size', label: 'Size' }],
            rows: catRows.sort((a, b) => b.bytes - a.bytes).map(({ name, count, size }) => ({ name, count, size })) }],
          notes: ['The total of the file sizes recorded on documents. Support ticket attachments are not included.'],
        },
      },
    };
  }
  return {
    views: {
      management: {
        headlines: [
          { label: 'Documents created', value: fmtInt(docs.total) },
          { label: `In the last ${days} days`, value: fmtInt(sumOf(current, 'documents')), change: change(sumOf(current, 'documents'), sumOf(previous, 'documents')) },
          { label: 'This month', value: fmtInt(docs.this_month) },
        ],
        charts: [daily('Documents created per day', dayData(current, ['documents']), [{ key: 'documents', label: 'Documents' }], 'bar', `No documents created in the last ${days} days.`)],
        tables: [{ title: 'Documents by category', csvName: 'documents-by-category', emptyText: 'No documents yet.',
          columns: [{ key: 'category', label: 'Category' }, { key: 'count', label: 'Documents', numeric: true }],
          rows: arr(docs.categories).map((c) => ({ category: label(c.category), count: num(c.count) })) }],
        notes: ['Counts saved documents (templates and uploads). AI-drafted contracts and notices are kept in the browser and appear on the AI usage page instead.'],
      },
    },
  };
}

async function supportMetric(src: Sources, days: number): Promise<MetricResult> {
  const sup = await src.get<Obj>('admin_support_overview', { _status: 'all', _limit: LIST_LIMIT, _offset: 0 });
  const { rows, total } = rowsOf(sup);
  const cap = capNote(rows.length, total, 'requests');
  const created = perDay(rows.map((r) => r.created_at as string), days);
  const now = rows.filter((r) => inLast(r.created_at, days)).length;
  const before = rows.filter((r) => inLast(r.created_at, days, days)).length;
  const t = (title: string, csvName: string, key: (r: Obj) => string): TableSpec => ({
    title, csvName, emptyText: 'No support requests yet.', note: cap,
    columns: [{ key: 'name', label: title.replace(/^By /, '').replace(/^./, (c) => c.toUpperCase()) }, { key: 'count', label: 'Requests', numeric: true }],
    rows: countBy(rows, key),
  });
  return {
    views: {
      operations: {
        headlines: [
          { label: 'Open', value: fmtInt(sup.open) }, { label: 'Pending', value: fmtInt(sup.pending) },
          { label: 'Urgent or high priority', value: fmtInt(sup.urgent) }, { label: 'Resolved or closed', value: fmtInt(sup.resolved) },
          { label: `New in the last ${days} days`, value: fmtInt(now), change: change(now, before) },
        ],
        charts: [daily('Requests received per day', created, [{ key: 'count', label: 'Requests' }], 'bar', `No support requests in the last ${days} days.`)],
        tables: [t('By status', 'support-by-status', (r) => label(r.status ?? 'open')), t('By priority', 'support-by-priority', (r) => label(r.priority ?? 'not set')),
          t('By category', 'support-by-category', (r) => label(r.category ?? r.type ?? 'not set'))],
        notes: ['Counts feedback and support requests sent from the app (the Support page in Admin). Company support desk tickets are not included.'],
      },
    },
  };
}

async function socialMetric(src: Sources, days: number): Promise<MetricResult> {
  const [soc, series] = await Promise.all([
    src.get<Obj>('admin_social_stats', { _limit: 10 }),
    src.get<Obj[]>('admin_analytics_series', { _days: days * 2 }),
  ]);
  const { current, previous } = splitPeriods(arr(series), days);
  return {
    views: {
      management: {
        headlines: [
          { label: 'Posts', value: fmtInt(soc.total_posts) },
          { label: `Posts in the last ${days} days`, value: fmtInt(sumOf(current, 'social')), change: change(sumOf(current, 'social'), sumOf(previous, 'social')) },
          { label: 'Comments', value: fmtInt(soc.comments) }, { label: 'Likes', value: fmtInt(soc.likes) },
          { label: 'Active authors (30 days)', value: fmtInt(soc.active_authors) }, { label: 'Forum posts', value: fmtInt(soc.forum_posts) },
        ],
        charts: [daily('Posts per day', dayData(current, ['social']), [{ key: 'social', label: 'Posts' }], 'bar', `No posts in the last ${days} days.`)],
        tables: [{ title: 'Top authors', csvName: 'social-top-authors', emptyText: 'No posts yet.',
          columns: [{ key: 'author', label: 'Author' }, { key: 'posts', label: 'Posts', numeric: true }],
          rows: arr(soc.top_authors).map((a) => ({ author: String(a.author ?? ''), posts: num(a.posts) })) }],
        notes: ['Post text is not shown here; moderate posts on the Social / Community page.'],
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The 21 cards, in Platform Overview order.

const def = (id: string, card: string, title: string, definition: string, views: MetricView[], load: MetricConfig['load']): MetricConfig =>
  ({ id, card, title, definition, views, load });

export const METRICS: MetricConfig[] = [
  def('users-total', 'Total Users', 'Users', 'Everyone who has signed up (one profile each), including suspended accounts.', ['management'], (s, d) => usersMetric(s, d, 'total')),
  def('users-active', 'Active Users', 'Active users', 'Users whose account is not suspended. Recent sign-ins are not stored, so this is not "logged in lately".', ['management'], (s, d) => usersMetric(s, d, 'active')),
  def('users-new', 'New Users (30d)', 'New users', 'Sign-ups in the chosen period, compared with the period before.', ['management'], (s, d) => usersMetric(s, d, 'new')),
  def('companies-total', 'Total Companies', 'Companies', 'Every organisation created in B2BNest, whatever its status.', ['management', 'business'], (s, d) => companiesMetric(s, d, 'total')),
  def('companies-active', 'Active Companies', 'Active companies', 'Companies that are not suspended or cancelled (trials included).', ['management', 'business'], (s, d) => companiesMetric(s, d, 'active')),
  def('companies-trial', 'Trial Companies', 'Trial companies', 'Companies whose owner is on the free trial and not suspended or cancelled.', ['management', 'business'], (s, d) => companiesMetric(s, d, 'trial')),
  def('companies-suspended', 'Suspended Companies', 'Suspended companies', 'Companies suspended by an admin (or switched off).', ['management', 'operations', 'business'], (s, d) => companiesMetric(s, d, 'suspended')),
  def('companies-cancelled', 'Cancelled Companies', 'Cancelled companies', 'Companies marked as cancelled by an admin.', ['management', 'operations', 'business'], (s, d) => companiesMetric(s, d, 'cancelled')),
  def('companies-new', 'New Companies (30d)', 'New companies', 'Companies created in the chosen period, compared with the period before.', ['management', 'business'], (s, d) => companiesMetric(s, d, 'new')),
  def('subscriptions-active', 'Active Subscriptions', 'Active subscriptions', 'Subscriptions Stripe reports as active, trialing, past due or unpaid (still entitled).', ['management'], (s, d) => moneyMetric(s, d, 'active_subscriptions')),
  def('no-plan', 'No plan', 'No plan', 'Accounts without an active subscription: on their trial, or after it ended.', ['management', 'business'], (s, d) => moneyMetric(s, d, 'no_plan')),
  def('paid-subscribers', 'Paid Subscribers', 'Paid subscribers', 'The same count as active subscriptions: everyone currently entitled to a paid plan.', ['management', 'business'], (s, d) => moneyMetric(s, d, 'paid_subscribers')),
  def('mrr', 'Monthly Recurring Revenue', 'Monthly recurring revenue', 'What active subscribers pay a month at their real Stripe price (annual plans ÷ 12). Excludes VAT and one-off payments.', ['management', 'business'], (s, d) => moneyMetric(s, d, 'mrr')),
  def('arr', 'Annual Recurring Revenue', 'Annual recurring revenue', 'Monthly recurring revenue × 12. Not a forecast.', ['management', 'business'], (s, d) => moneyMetric(s, d, 'arr')),
  def('total-revenue', 'Total Revenue', 'Total revenue', 'All payments recorded as paid, since the start. Refunds and Stripe fees are not subtracted.', ['management'], (s, d) => moneyMetric(s, d, 'total_revenue')),
  def('ai-usage', 'AI Usage', 'AI usage', 'AI credits taken and given back, and what the AI calls cost us at OpenAI, from the AI credit ledger.', ['management', 'operations', 'business'], (s, d) => aiMetric(s, d)),
  def('active-projects', 'Active Projects', 'Projects', 'Projects that are not deleted, archived or completed.', ['management', 'operations'], (s, d) => projectsMetric(s, d)),
  def('documents', 'Documents Created', 'Documents', 'Documents saved in B2BNEST (templates and uploads), not AI-drafted contracts kept in the browser.', ['management'], (s, d) => documentsMetric(s, d, 'documents')),
  def('storage', 'Storage Used', 'Storage', 'The total file size of saved documents.', ['operations'], (s, d) => documentsMetric(s, d, 'storage')),
  def('support', 'Support Tickets', 'Support requests', 'Feedback and support requests sent from the app; "open" means not resolved or closed.', ['operations'], (s, d) => supportMetric(s, d)),
  def('social', 'Social Activity', 'Social activity', 'Posts on the B2BNest community feed, with comments, likes and forum posts.', ['management'], (s, d) => socialMetric(s, d)),
];

export const metricById = (id: string | undefined) => METRICS.find((m) => m.id === id);
export const metricForCard = (card: string) => METRICS.find((m) => m.card === card);
export const metricPath = (id: string) => `/admin/overview/${id}`;
