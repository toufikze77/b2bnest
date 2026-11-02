import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Download, Info, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminStatCard from '@/components/admin/AdminStatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminRpc } from '@/lib/adminApi';
import { metricById } from '@/lib/adminMetrics';
import {
  createSources, DEFAULT_RANGE, RANGES, tableToCsv, VIEW_LABELS,
  type ChartSpec, type MetricResult, type MetricView, type RangeDays, type TableSpec, type ViewData,
} from '@/lib/adminMetricsCore';

const COLOURS = ['hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--success))'];

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function MetricChart({ chart }: { chart: ChartSpec }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{chart.title}</CardTitle></CardHeader>
      <CardContent>
        {chart.data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground" data-testid="chart-empty">{chart.emptyText}</p>
        ) : (
          <>
            <div className="h-[260px]" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                {chart.kind === 'line' ? (
                  <LineChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey={chart.xKey} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    {chart.series.map((s, i) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={COLOURS[i % COLOURS.length]} dot={false} />)}
                  </LineChart>
                ) : (
                  <BarChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey={chart.xKey} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    {chart.series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLOURS[i % COLOURS.length]} />)}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
            {/* Text alternative: a summary and the data as a table, for screen readers. */}
            <p className="sr-only">{chart.summary}</p>
            <table className="sr-only">
              <caption>{chart.title}</caption>
              <thead><tr><th scope="col">{chart.xLabel}</th>{chart.series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
              <tbody>
                {chart.data.slice(0, 400).map((r, i) => (
                  <tr key={i}><td>{String(r[chart.xKey])}</td>{chart.series.map((s) => <td key={s.key}>{String(r[s.key])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MetricTable({ table }: { table: TableSpec }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">{table.title}</CardTitle>
          {table.note && <p className="mt-1 text-xs text-muted-foreground">{table.note}</p>}
        </div>
        <Button type="button" size="sm" variant="outline" disabled={table.rows.length === 0}
          onClick={() => download(table.csvName, tableToCsv(table.columns, table.rows))} aria-label={`Download ${table.title} as CSV`}>
          <Download className="mr-1 h-4 w-4" aria-hidden />CSV
        </Button>
      </CardHeader>
      <CardContent>
        {table.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground" data-testid="table-empty">{table.emptyText}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  {table.columns.map((c) => <th key={c.key} scope="col" className={`px-2 py-2 font-medium ${c.numeric ? 'text-right' : ''}`}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    {table.columns.map((c) => (
                      <td key={c.key} className={`px-2 py-2 ${c.numeric ? 'text-right tabular-nums' : ''}`}>
                        {r[c.key] === null || r[c.key] === undefined || r[c.key] === '' ? '–' : typeof r[c.key] === 'number' ? (r[c.key] as number).toLocaleString('en-GB') : String(r[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ViewPanel({ view, days }: { view: ViewData; days: number }) {
  return (
    <div className="space-y-6">
      {view.warnings?.map((w) => (
        <div key={w} role="alert" className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />{w}
        </div>
      ))}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {view.headlines.map((h) => (
          <AdminStatCard key={h.label} label={h.label} value={h.value} change={h.change} changeLabel={`vs previous ${days} days`} hint={h.hint ?? ' '} />
        ))}
      </div>
      {view.emptyState && (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="view-empty">{view.emptyState}</p>
      )}
      {/* With nothing yet, the message above replaces the charts (they would only repeat it). */}
      {!view.emptyState && (view.charts?.length ?? 0) > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">{view.charts!.map((c) => <MetricChart key={c.title} chart={c} />)}</div>
      )}
      {(view.tables?.length ?? 0) > 0 && (
        <div className="grid gap-4 xl:grid-cols-2">{view.tables!.map((t) => <MetricTable key={t.title} table={t} />)}</div>
      )}
      {(view.notes?.length ?? 0) > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {view.notes!.map((n) => <li key={n} className="flex items-start gap-1.5"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{n}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Phase 36: one page for every Platform Overview card (/admin/overview/:metric). Super admin only (AdminLayout guard). */
export default function AdminMetricDetail({ rpc = adminRpc }: { rpc?: typeof adminRpc }) {
  const { metric } = useParams();
  const config = metricById(metric);
  const [days, setDays] = useState<RangeDays>(DEFAULT_RANGE);
  const [result, setResult] = useState<MetricResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    if (!config) return;
    let live = true;
    setResult(null); setError(null);
    config.load(createSources(rpc), days)
      .then((r) => { if (live) setResult(r); })
      .catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : 'Something went wrong'); });
    return () => { live = false; };
  }, [config, days, rpc, attempt]);

  const views = useMemo(() => (config && result ? config.views.filter((v) => result.views[v]) : []), [config, result]);

  const back = (
    <Link to="/admin" className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
      <ArrowLeft className="h-4 w-4" aria-hidden />Back to Platform Overview
    </Link>
  );

  if (!config) {
    return (
      <div className="space-y-4">
        {back}
        <p className="text-sm text-muted-foreground" role="alert">There is no page for this metric.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}
      <AdminPageHeader title={config.title} description={config.definition} />
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
        <span className="text-sm text-muted-foreground">Period:</span>
        {RANGES.map((r) => (
          <Button key={r} type="button" size="sm" variant={days === r ? 'default' : 'outline'} aria-pressed={days === r} onClick={() => setDays(r)}>
            Last {r} days
          </Button>
        ))}
      </div>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <span>Couldn't load this page: {error}</span>
          <Button type="button" size="sm" variant="outline" onClick={retry}><RefreshCw className="mr-1 h-4 w-4" aria-hidden />Try again</Button>
        </div>
      ) : !result ? (
        <div className="space-y-4" data-testid="metric-loading">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : views.length === 1 ? (
        <ViewPanel view={result.views[views[0]]!} days={days} />
      ) : (
        <Tabs defaultValue={views[0]}>
          <TabsList className="flex h-auto flex-wrap">
            {views.map((v: MetricView) => <TabsTrigger key={v} value={v}>{VIEW_LABELS[v]}</TabsTrigger>)}
          </TabsList>
          {views.map((v) => (
            <TabsContent key={v} value={v} className="mt-4"><ViewPanel view={result.views[v]!} days={days} /></TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
