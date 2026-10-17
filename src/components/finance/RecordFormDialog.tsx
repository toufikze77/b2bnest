import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { FormValues } from '@/lib/moneyOut';
import { FocusReturn, restoreFocus, returnFocusTarget } from './returnFocus';
import { cn } from '@/lib/utils';

export interface FieldUi {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select' | 'switch';
  required?: boolean;
  /** `group` sorts options under headings in the list. */
  options?: { value: string; label: string; group?: string }[];
  placeholder?: string;
  maxLength?: number;
  hint?: string;
  /** Hide the field for some values (e.g. stock for services). */
  show?: (form: FormValues) => boolean;
  wide?: boolean;
}

const NONE = '__none__';

/** Options in their groups, in first-seen order; ungrouped options sit in a group with no heading. */
function groupOptions(options: NonNullable<FieldUi['options']>) {
  const groups = new Map<string, NonNullable<FieldUi['options']>>();
  for (const o of options) { const g = o.group ?? ''; groups.set(g, [...(groups.get(g) ?? []), o]); }
  return [...groups.entries()];
}

/**
 * One dialog for Add and Edit: the same fields, prefilled when editing. `onSubmit` returns an
 * error message to show inside the dialog (it then stays open and nothing is lost), or null.
 */
export function RecordFormDialog({ open, onOpenChange, title, description, fields, initial, submitLabel, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldUi[];
  initial: FormValues;
  submitLabel: string;
  onSubmit: (values: FormValues) => Promise<string | null>;
}) {
  const id = useId();
  const [values, setValues] = useState<FormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Reset to `initial` each time the dialog opens (not on every parent render while it is open).
  const wasOpen = useRef(false);
  const opener = useRef<FocusReturn | null>(null);
  useEffect(() => {
    if (open && !wasOpen.current) { setValues(initial); setError(null); opener.current = returnFocusTarget(); }
    wasOpen.current = open;
  }, [open, initial]);

  const set = (k: string, v: string | boolean) => setValues((f) => ({ ...f, [k]: v }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const message = await onSubmit(values);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" onCloseAutoFocus={(e) => restoreFocus(opener.current, e)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {fields.filter((f) => !f.show || f.show(values)).map((f) => {
              const fid = `${id}-${f.key}`;
              const hint = f.hint ? `${fid}-hint` : undefined;
              const label = <Label htmlFor={fid}>{f.label}{f.required && <span aria-hidden="true"> *</span>}</Label>;
              const v = values[f.key];
              return (
                <div key={f.key} className={cn('space-y-2', (f.wide || f.type === 'textarea') && 'md:col-span-2')}>
                  {f.type === 'switch' ? (
                    <div className="flex min-h-touch items-center gap-3">
                      <Switch id={fid} checked={v !== false} onCheckedChange={(c) => set(f.key, c)} aria-describedby={hint} />
                      {label}
                    </div>
                  ) : f.type === 'select' ? (
                    <>
                      {label}
                      <Select value={(v as string) || NONE} onValueChange={(x) => set(f.key, x === NONE ? '' : x)}>
                        <SelectTrigger id={fid} className="h-11 md:h-10" aria-describedby={hint} aria-required={f.required}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {!f.required && <SelectItem value={NONE}>None</SelectItem>}
                          {f.required && !v && <SelectItem value={NONE} disabled>Choose…</SelectItem>}
                          {groupOptions(f.options ?? []).map(([group, opts], gi) => group ? (
                            <SelectGroup key={group}>
                              {gi > 0 && <SelectSeparator />}
                              <SelectLabel>{group}</SelectLabel>
                              {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectGroup>
                          ) : opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : f.type === 'textarea' ? (
                    <>
                      {label}
                      <Textarea id={fid} rows={3} value={(v as string) ?? ''} placeholder={f.placeholder} aria-describedby={hint} onChange={(e) => set(f.key, e.target.value)} />
                    </>
                  ) : (
                    <>
                      {label}
                      <Input id={fid} type={f.type} inputMode={f.type === 'number' ? 'decimal' : undefined} step={f.type === 'number' ? '0.01' : undefined} min={f.type === 'number' ? 0 : undefined}
                        className="h-11 md:h-10" value={(v as string) ?? ''} placeholder={f.placeholder} maxLength={f.maxLength} aria-required={f.required} aria-describedby={hint} onChange={(e) => set(f.key, e.target.value)} />
                    </>
                  )}
                  {f.hint && <p id={hint} className="text-small text-muted-foreground">{f.hint}</p>}
                </div>
              );
            })}
          </div>
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-control border border-destructive/40 bg-destructive/5 p-3 text-body">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-touch md:min-h-0" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="min-h-touch md:min-h-0" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
