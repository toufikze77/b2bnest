import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { DonutSlice, foldSlices, pct, seriesColor, useChartMotion } from './chartTheme';
import { TooltipCard } from './TooltipCard';

/**
 * Donut with a thick ring, the total in the middle and a ranked legend (dot, label, count, share).
 * The legend sits beside the ring on wide screens and below it on phones.
 */
export function Donut({ data, totalLabel, format = (n) => n.toLocaleString('en-GB') }: { data: DonutSlice[]; totalLabel: string; format?: (n: number) => string }) {
  const motion = useChartMotion();
  const slices = foldSlices(data);
  const total = slices.reduce((n, d) => n + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius="64%" outerRadius="96%" paddingAngle={slices.length > 1 ? 1.5 : 0}
              stroke="hsl(var(--card))" strokeWidth={2} startAngle={90} endAngle={-270} {...motion}>
              {slices.map((s, i) => <Cell key={s.label} fill={seriesColor(i)} />)}
            </Pie>
            <Tooltip cursor={false} content={({ active, payload }) => {
              const p = active && payload?.[0];
              if (!p) return null;
              const i = slices.findIndex((s) => s.label === p.name);
              return <TooltipCard title={String(p.name)} rows={[{ color: seriesColor(i), label: 'Count', value: format(Number(p.value)), share: total ? pct(Number(p.value) / total) : undefined }]} />;
            }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tabular-nums text-foreground">{format(total)}</span>
          <span className="text-small text-muted-foreground">{totalLabel}</span>
        </div>
      </div>
      <ol className="w-full min-w-0 flex-1 space-y-2" aria-label="Legend, largest first">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3 text-body">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: seriesColor(i) }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-foreground">{s.label}</span>
            <span className="tabular-nums font-semibold text-foreground">{format(s.value)}</span>
            <span className="w-14 text-right tabular-nums text-muted-foreground">{total ? pct(s.value / total) : '—'}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
