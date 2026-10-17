import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compactNumber } from '@/lib/money';
import { AXIS_TICK, GRID, seriesColor, useChartMotion } from './chartTheme';
import { TooltipCard } from './TooltipCard';

export interface TrendSeries { key: string; label: string }

/**
 * Thin lines (2px) with a soft area wash and ringed dots, one shared y-axis (never two).
 * Two or more series always get a legend; colour is never the only signal (the legend
 * names each line and the tooltip lists every value).
 */
export function TrendChart({ data, series, format = (n) => n.toLocaleString('en-GB'), axisTitle, height = 220, integer = true }: {
  data: ({ label: string } & Record<string, unknown>)[]; series: TrendSeries[]; format?: (n: number) => string; axisTitle?: string; height?: number; integer?: boolean;
}) {
  const motion = useChartMotion();
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        {axisTitle ? <p className="text-small font-medium text-muted-foreground">{axisTitle}</p> : <span />}
        {series.length > 1 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
            {series.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2 text-small text-foreground">
                <span className="h-0.5 w-4 rounded-full" style={{ background: seriesColor(i) }} aria-hidden="true" />{s.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} allowDecimals={!integer} tickFormatter={(v: number) => compactNumber(v)} />
            <Tooltip cursor={{ stroke: 'var(--chart-grid)' }} content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return <TooltipCard title={String(label)} rows={series.map((s, i) => ({ color: seriesColor(i), label: s.label, value: format(Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0)) }))} />;
            }} />
            {series.map((s, i) => (
              <Area key={s.key} type="linear" dataKey={s.key} name={s.label} stroke={seriesColor(i)} strokeWidth={2} fill={seriesColor(i)} fillOpacity={0.1}
                dot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))', fill: seriesColor(i) }} activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }} {...motion} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
