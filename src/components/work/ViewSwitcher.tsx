import { CalendarDays, ChevronDown, GanttChart, KanbanSquare, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { PmTab } from '@/lib/pmView';

const VIEWS: { key: PmTab; label: string; icon: typeof List }[] = [
  { key: 'list', label: 'List', icon: List },
  { key: 'kanban', label: 'Board', icon: KanbanSquare },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'timeline', label: 'Timeline', icon: GanttChart },
];

const MORE: { key: PmTab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'goals', label: 'Goals' },
  { key: 'forms', label: 'Work requests' },
  { key: 'all', label: 'All work' },
  { key: 'archived', label: 'Archived' },
  { key: 'teams', label: 'Teams' },
];

/** The single view switcher for Projects & tasks. `active` comes from the URL. */
export function ViewSwitcher({ active, onChange }: { active: PmTab; onChange: (t: PmTab) => void }) {
  const moreActive = MORE.find((m) => m.key === active);
  return (
    <nav aria-label="Task views" className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1">
      {VIEWS.map(({ key, label, icon: Icon }) => (
        <Button
          key={key}
          type="button"
          size="sm"
          variant={active === key ? 'default' : 'ghost'}
          aria-current={active === key ? 'page' : undefined}
          onClick={() => active !== key && onChange(key)}
          className="gap-1.5"
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </Button>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant={moreActive ? 'default' : 'ghost'} aria-current={moreActive ? 'page' : undefined} className={cn('gap-1')}>
            {moreActive ? moreActive.label : 'More'} <ChevronDown className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {MORE.map((m) => (
            <DropdownMenuItem key={m.key} onSelect={() => active !== m.key && onChange(m.key)}>
              {m.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
