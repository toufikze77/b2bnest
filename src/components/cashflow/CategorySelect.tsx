import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ADD_CUSTOM, addCustomCategory, CUSTOM_MAX, groupsFor, standardCategories, type CustomCategories, type FlowType } from '@/lib/cashFlowCategories';

interface Props {
  id: string;
  type: FlowType;
  value: string;
  onChange: (category: string) => void;
  custom: CustomCategories;
  onCustomChange: (next: CustomCategories) => void;
}

/**
 * Phase 29: grouped category list (optgroups keep it usable on a phone), your own categories, and "+ Add my own
 * category…" at the end. A value that is in no list (an older entry) is kept and shown under "Saved on this entry".
 */
export default function CategorySelect({ id, type, value, onChange, custom, onCustomChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const known = [...standardCategories(type), ...custom[type]];
  const orphan = value && !known.includes(value) ? value : null;

  const save = () => {
    const r = addCustomCategory(type, name, custom);
    if (!r.ok) { setError((r as Extract<typeof r, { ok: false }>).error); return; }
    const added = r as Extract<typeof r, { ok: true }>;
    onCustomChange(added.custom);
    onChange(added.name);
    setAdding(false); setName(''); setError(null);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="sr-only">Category</Label>
      <select
        id={id}
        className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        value={adding ? ADD_CUSTOM : value}
        onChange={(e) => {
          if (e.target.value === ADD_CUSTOM) { setAdding(true); setError(null); return; }
          setAdding(false);
          onChange(e.target.value);
        }}
      >
        <option value="">Select category</option>
        {orphan && <optgroup label="Saved on this entry"><option value={orphan}>{orphan}</option></optgroup>}
        {groupsFor(type).map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map((c) => <option key={c} value={c}>{c}</option>)}
          </optgroup>
        ))}
        {custom[type].length > 0 && (
          <optgroup label="Your categories">
            {custom[type].map((c) => <option key={c} value={c}>{c}</option>)}
          </optgroup>
        )}
        <option value={ADD_CUSTOM}>+ Add my own category…</option>
      </select>
      {adding && (
        <div className="space-y-2 rounded-md border border-border p-2" data-testid="custom-category-form">
          <Label htmlFor={`${id}-new`}>New {type === 'income' ? 'income' : 'expense'} category</Label>
          <div className="flex gap-2">
            <Input id={`${id}-new`} value={name} maxLength={CUSTOM_MAX} autoFocus onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} className="text-sm" />
            <Button type="button" size="sm" onClick={save}>Add</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setAdding(false); setName(''); setError(null); }}>Cancel</Button>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">Saved in this browser.</p>
        </div>
      )}
    </div>
  );
}
