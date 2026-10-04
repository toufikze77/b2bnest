import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'accent';

export type Priority = 'urgent' | 'high' | 'medium' | 'low';

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  info: 'bg-primary/10 text-primary border-primary/20',
  warning: 'bg-accent/40 text-foreground border-accent',
  success: 'bg-secondary text-secondary-foreground border-border',
  danger: 'bg-destructive/10 text-destructive border-destructive/30',
  accent: 'bg-primary text-primary-foreground border-primary',
};

/** Shared priority palette for every task view. */
export const PRIORITY_STYLES: Record<Priority, string> = {
  urgent: 'border-priority-urgent-border bg-priority-urgent text-priority-urgent-foreground',
  high: 'border-priority-high-border bg-priority-high text-priority-high-foreground',
  medium: 'border-priority-medium-border bg-priority-medium text-priority-medium-foreground',
  low: 'border-priority-low-border bg-priority-low text-priority-low-foreground',
};

const KNOWN: Record<string, { label: string; tone: Tone }> = {
  backlog: { label: 'Backlog', tone: 'neutral' },
  todo: { label: 'To do', tone: 'neutral' },
  'in-progress': { label: 'In progress', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'info' },
  review: { label: 'Review', tone: 'warning' },
  done: { label: 'Done', tone: 'success' },
  completed: { label: 'Completed', tone: 'success' },
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'info' },
  high: { label: 'High', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'danger' },
  critical: { label: 'Critical', tone: 'danger' },
  lead: { label: 'Lead', tone: 'info' },
  prospect: { label: 'Prospect', tone: 'warning' },
  customer: { label: 'Customer', tone: 'success' },
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  overdue: { label: 'Overdue', tone: 'danger' },
};

export const statusLabel = (value?: string | null) =>
  value ? KNOWN[value.toLowerCase()]?.label ?? value.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—';

export function StatusBadge({ value, tone, className, prefix }: { value?: string | null; tone?: Tone; className?: string; prefix?: string }) {
  const known = value ? KNOWN[value.toLowerCase()] : undefined;
  const t = tone ?? known?.tone ?? 'neutral';
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', TONES[t], className)}>
      {prefix && <span className="sr-only">{prefix}: </span>}
      {statusLabel(value)}
    </span>
  );
}

export function PriorityBadge({ value, className }: { value?: string | null; className?: string }) {
  const priority = value?.toLowerCase();
  const style = priority && priority in PRIORITY_STYLES ? PRIORITY_STYLES[priority as Priority] : TONES.neutral;
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', style, className)}>
      <span className="sr-only">Priority: </span>
      {statusLabel(value)}
    </span>
  );
}
