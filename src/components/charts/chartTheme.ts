import { useMediaQuery } from '@/hooks/use-media-query';

/** Series colours in fixed order (CSS variables in index.css, light and dark). Never cycled past 6. */
export const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
export const seriesColor = (i: number) => SERIES[Math.min(i, SERIES.length - 1)];

/** Axis and grid styling shared by every chart: dashed horizontal grid, no axis lines, 12.5px muted ticks. */
export const AXIS_TICK = { fontSize: 12.5, fill: 'hsl(var(--muted-foreground))' };
export const GRID = { stroke: 'var(--chart-grid)', strokeDasharray: '4 4', vertical: false } as const;

/** Short, calm animation; off when the user prefers reduced motion. */
export function useChartMotion() {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  return { isAnimationActive: !reduced, animationDuration: 450, animationEasing: 'ease-out' as const };
}

export const pct = (share: number) => `${Math.round(share * 1000) / 10}%`;

export interface DonutSlice { label: string; value: number }

/** Folds anything past the sixth slice into "Other" so a colour is never reused. */
export function foldSlices(data: DonutSlice[], max = SERIES.length): DonutSlice[] {
  if (data.length <= max) return data;
  const rest = data.slice(max - 1).reduce((n, d) => n + d.value, 0);
  return [...data.slice(0, max - 1), { label: 'Other', value: rest }];
}

