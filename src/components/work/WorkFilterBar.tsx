import { useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FilterBar } from '@/components/data/FilterBar';
import { activeFilterCount, EMPTY_FILTERS, readWorkFilters, writeWorkFilters, WorkFilters } from '@/lib/workFilters';

export function useWorkFilters() {
  const [params, setParams] = useSearchParams();
  const filters = readWorkFilters(params);
  // Filter edits replace the history entry so typing doesn't flood Back/Forward.
  const update = (patch: Partial<WorkFilters>) =>
    setParams((prev) => writeWorkFilters(prev, patch), { replace: true });
  const clear = () => update(EMPTY_FILTERS);
  return { filters, update, clear, activeCount: activeFilterCount(filters) };
}

interface Props {
  statuses: { value: string; label: string }[];
  assignees: string[];
}

export function WorkFilterBar({ statuses, assignees }: Props) {
  const { filters, update, clear, activeCount } = useWorkFilters();
  return (
    <FilterBar
      search={filters.q}
      onSearch={(q) => update({ q })}
      searchLabel="Search tasks"
      activeCount={activeCount}
      onClear={clear}
      selects={[
        { id: 'status', label: 'Status', value: filters.status, onChange: (status) => update({ status }), options: [{ value: 'all', label: 'All statuses' }, ...statuses] },
        {
          id: 'priority', label: 'Priority', value: filters.priority, onChange: (priority) => update({ priority }),
          options: [{ value: 'all', label: 'All priorities' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }],
        },
        {
          id: 'assignee', label: 'Assignee', value: filters.assignee, onChange: (assignee) => update({ assignee }),
          options: [{ value: 'all', label: 'Anyone' }, { value: 'unassigned', label: 'Unassigned' }, ...assignees.map((a) => ({ value: a, label: a }))],
        },
      ]}
      extra={
        <div className="flex items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor="wf-from" className="text-xs text-muted-foreground">Due from</Label>
            <Input id="wf-from" type="date" value={filters.from} onChange={(e) => update({ from: e.target.value })} className="w-[150px]" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="wf-to" className="text-xs text-muted-foreground">Due to</Label>
            <Input id="wf-to" type="date" value={filters.to} onChange={(e) => update({ to: e.target.value })} className="w-[150px]" />
          </div>
        </div>
      }
    />
  );
}
