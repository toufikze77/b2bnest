import { StatusBadge } from '@/components/data/StatusBadge';

export interface AgendaItem {
  id: string;
  title: string;
  /** yyyy-MM-dd calendar day (date-only; never converted through UTC). */
  day: string;
  type: 'task' | 'event';
  status?: string;
  priority?: string;
}

/** Groups items by calendar day, sorted ascending. Pure, for tests. */
export function groupAgenda(items: AgendaItem[], fromDay: string, toDay: string) {
  const map = new Map<string, AgendaItem[]>();
  items
    .filter((i) => i.day >= fromDay && i.day <= toDay)
    .sort((a, b) => a.day.localeCompare(b.day) || a.title.localeCompare(b.title))
    .forEach((i) => map.set(i.day, [...(map.get(i.day) || []), i]));
  return Array.from(map.entries());
}

const heading = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Agenda list for narrow screens: one row per item, grouped by day. */
export function CalendarAgenda({ items, fromDay, toDay, today, onOpen }: { items: AgendaItem[]; fromDay: string; toDay: string; today: string; onOpen: (i: AgendaItem) => void }) {
  const groups = groupAgenda(items, fromDay, toDay);
  if (!groups.length) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing scheduled this month.</p>;
  return (
    <ol aria-label="Agenda" className="space-y-4">
      {groups.map(([day, list]) => (
        <li key={day}>
          <h3 className={`mb-1.5 text-sm font-semibold ${day === today ? 'text-primary' : ''}`}>
            {heading(day)}{day === today && ' · Today'}
          </h3>
          <ul className="divide-y rounded-lg border bg-card">
            {list.map((i) => (
              <li key={`${i.type}-${i.id}`}>
                <button type="button" onClick={() => onOpen(i)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="min-w-0 truncate font-medium">{i.title}</span>
                  <span className="flex shrink-0 gap-1">
                    {i.type === 'event' ? <StatusBadge value="Event" tone="info" /> : <><StatusBadge value={i.status} prefix="Status" />{i.priority && <StatusBadge value={i.priority} prefix="Priority" />}</>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
