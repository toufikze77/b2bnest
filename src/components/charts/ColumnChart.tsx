import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compactNumber } from '@/lib/money';
import { AXIS_TICK, GRID, seriesColor, useChartMotion } from './chartTheme';
import { TooltipCard } from './TooltipCard';

export interface ColumnDatum { label: string; value: number; [k: string]: unknown }

/**
 * Single-series column chart: rounded tops, columns capped at 24px, dashed horizontal grid,
 * no axis lines, compact ticks (12k, 1.2m). The currency symbol belongs in `axisTitle`, not on every tick.
 */
export function ColumnChart({ data, seriesLabel, format, axisTitle, color = seriesColor(0), height = 220, integer }: {
  data: ColumnDatum[]; seriesLabel: string; format: (n: number) => string; axisTitle?: string; color?: string; height?: number; integer?: boolean;
}) {
  const motion = useChartMotion();
  return (
    <div>
      {axisTitle && <p className="mb-1 text-small font-medium text-muted-foreground">{axisTitle}</p>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => compactNumber(v)} allowDecimals={!integer} />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={({ active, payload, label }) => {
              const p = active && payload?.[0];
              if (!p) return null;
              return <TooltipCard title={String(label)} rows={[{ color, label: seriesLabel, value: format(Number(p.value)) }]} />;
            }} />
            <Bar dataKey="value" name={seriesLabel} fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} {...motion} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
