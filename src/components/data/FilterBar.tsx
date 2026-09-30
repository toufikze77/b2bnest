import { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface FilterSelect {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

interface FilterBarProps {
  search: string;
  onSearch: (v: string) => void;
  searchLabel?: string;
  selects?: FilterSelect[];
  extra?: ReactNode;
  activeCount?: number;
  onClear?: () => void;
}

/** Shared filter bar: search + labelled selects + clear. Used by work views and CRM. */
export function FilterBar({ search, onSearch, searchLabel = 'Search', selects = [], extra, activeCount = 0, onClear }: FilterBarProps) {
  return (
    <div role="search" className="flex flex-wrap items-end gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label={searchLabel} placeholder={`${searchLabel}…`} value={search} onChange={(e) => onSearch(e.target.value)} className="pl-9" />
      </div>
      {selects.map((s) => (
        <Select key={s.id} value={s.value} onValueChange={s.onChange}>
          <SelectTrigger aria-label={s.label} className="w-[150px]">
            <SelectValue placeholder={s.label} />
          </SelectTrigger>
          <SelectContent>
            {s.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {extra}
      {activeCount > 0 && onClear && (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1 h-4 w-4" /> Clear filters ({activeCount})
        </Button>
      )}
    </div>
  );
}
