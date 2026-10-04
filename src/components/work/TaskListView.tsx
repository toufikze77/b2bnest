import { Edit as EditIcon, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PriorityBadge, StatusBadge } from '@/components/data/StatusBadge';
import { NoResults } from '@/components/ui/states';
import { formatDueDate } from '@/lib/dashboardData';
import { toDay } from '@/lib/workFilters';

export interface ListTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee?: string;
  dueDate: Date | null;
  project?: string;
}

interface Props<T extends ListTask> {
  tasks: T[];
  onEdit: (t: T) => void;
  onArchive: (id: string) => void;
  onClearFilters?: () => void;
  filtered?: boolean;
}

/** List view: one row per task, title opens the shared editor. */
export function TaskListView<T extends ListTask>({ tasks, onEdit, onArchive, onClearFilters, filtered }: Props<T>) {
  if (tasks.length === 0) {
    return filtered ? (
      <NoResults onClear={onClearFilters} />
    ) : (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No tasks yet. Use “New Task” to add one.</p>
    );
  }
  const today = toDay(new Date());
  return (
    <>
    <ul aria-label="Tasks" className="divide-y rounded-lg border bg-card md:hidden">
      {tasks.map((t) => {
        const day = toDay(t.dueDate);
        const overdue = !!day && day < today && t.status !== 'done';
        return (
          <li key={t.id} className="flex items-start justify-between gap-2 p-3">
            <div className="min-w-0 space-y-1">
              <button type="button" onClick={() => onEdit(t)} className="rounded-sm text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t.title}</button>
              <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                <StatusBadge value={t.status} prefix="Status" /><PriorityBadge value={t.priority} />
                <span className={overdue ? 'font-medium text-destructive' : ''}>{day ? formatDueDate(day) : 'No due date'}</span>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" aria-label={`Actions for ${t.title}`}><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEdit(t)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onArchive(t.id)}>Archive</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        );
      })}
    </ul>
    <div className="hidden w-full overflow-x-auto rounded-lg border bg-card md:block">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Task</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Priority</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Assignee</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Due</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Project</th>
            <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const day = toDay(t.dueDate);
            const overdue = !!day && day < today && t.status !== 'done';
            return (
              <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <button type="button" onClick={() => onEdit(t)} className="rounded-sm text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {t.title}
                  </button>
                </td>
                <td className="px-3 py-2.5"><StatusBadge value={t.status} prefix="Status" /></td>
                <td className="px-3 py-2.5"><PriorityBadge value={t.priority} /></td>
                <td className="px-3 py-2.5 text-muted-foreground">{t.assignee && t.assignee !== 'Unassigned' ? t.assignee : 'Unassigned'}</td>
                <td className={`px-3 py-2.5 whitespace-nowrap ${overdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                  {day ? formatDueDate(day) : '—'}{overdue && <span className="sr-only"> (overdue)</span>}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{t.project || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => onEdit(t)} aria-label={`Edit task ${t.title}`}>
                      <EditIcon className="mr-1 h-4 w-4" />Edit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" aria-label={`More actions for ${t.title}`}><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onEdit(t)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onArchive(t.id)}>Archive</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
