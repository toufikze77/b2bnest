import { Trash2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AiTemplate } from '@/lib/aiTemplateSchema';

interface Props {
  value: AiTemplate;
  onChange: (next: AiTemplate) => void;
  errors: string[];
}

/** Editable preview. Every change is re-validated by the parent before "Create" is enabled. */
const AiTemplateEditor = ({ value, onChange, errors }: Props) => {
  const set = (fn: (d: AiTemplate) => void) => {
    const next = structuredClone(value);
    fn(next);
    onChange(next);
  };
  const totalTasks = value.boards.reduce((n, b) => n + b.groups.reduce((m, g) => m + g.tasks.length, 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{value.kind === 'workspace' ? 'Workspace' : 'Project'}</Badge>
        <span className="text-muted-foreground">
          {value.boards.length} {value.boards.length === 1 ? 'board' : 'boards'} · {totalTasks} tasks
        </span>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ai-tpl-name">Template name</Label>
        <Input id="ai-tpl-name" value={value.name} onChange={(e) => set((d) => { d.name = e.target.value; })} />
      </div>
      {value.boards.map((b, bi) => (
        <section key={bi} className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center gap-2">
            <Input aria-label={`Board ${bi + 1} name`} value={b.name} onChange={(e) => set((d) => { d.boards[bi].name = e.target.value; })} className="font-medium" />
            {value.boards.length > 1 && (
              <Button variant="ghost" size="icon" aria-label={`Remove board ${b.name}`} onClick={() => set((d) => { d.boards.splice(bi, 1); })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mb-2 text-xs text-muted-foreground">Views: {b.views.join(', ')}</p>
          {b.groups.map((g, gi) => (
            <div key={gi} className="mb-3">
              <Input aria-label={`Group name`} value={g.name} onChange={(e) => set((d) => { d.boards[bi].groups[gi].name = e.target.value; })} className="mb-1 h-8 text-sm font-medium" />
              <ul className="space-y-1 pl-2">
                {g.tasks.map((t, ti) => (
                  <li key={ti} className="flex items-center gap-2">
                    <Input aria-label="Task title" value={t.title} onChange={(e) => set((d) => { d.boards[bi].groups[gi].tasks[ti].title = e.target.value; })} className="h-8 text-sm" />
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{t.status} · {t.priority}</span>
                    <Button variant="ghost" size="icon" aria-label={`Remove task ${t.title}`} onClick={() => set((d) => { d.boards[bi].groups[gi].tasks.splice(ti, 1); })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button variant="ghost" size="sm" className="mt-1" onClick={() => set((d) => { d.boards[bi].groups[gi].tasks.push({ title: 'New task', status: 'todo', priority: 'medium', dayOffset: 0 }); })}>
                <Plus className="mr-1 h-3 w-3" /> Add task
              </Button>
            </div>
          ))}
        </section>
      ))}
      {errors.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Fix these before creating: {errors.join('; ')}
        </div>
      )}
    </div>
  );
};

export default AiTemplateEditor;
