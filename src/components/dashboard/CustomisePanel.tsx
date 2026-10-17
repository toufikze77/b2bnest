import { RefObject, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DashboardLayout, defaultLayout, PRESETS, presetLayout, toggleWidget, WIDGET_GROUPS, WIDGETS,
} from '@/lib/dashboardLayout';
import { cn } from '@/lib/utils';

/**
 * Right-hand drawer for choosing a starting layout and switching widgets on or off.
 * Changes stay in a draft until Save; Cancel discards them; Reset returns the draft to Balanced.
 */
export function CustomisePanel({ open, onOpenChange, layout, onSave, returnFocusRef }: {
  open: boolean; onOpenChange: (open: boolean) => void; layout: DashboardLayout; onSave: (layout: DashboardLayout) => void;
  /** The button that opened the drawer; focus goes back to it on close. */
  returnFocusRef?: RefObject<HTMLElement>;
}) {
  const [draft, setDraft] = useState(layout);
  useEffect(() => { if (open) setDraft(layout); }, [open, layout]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md" aria-describedby="customise-desc"
        onCloseAutoFocus={(e) => { if (returnFocusRef?.current) { e.preventDefault(); returnFocusRef.current.focus(); } }}>
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <SheetTitle className="text-card-title">Customise dashboard</SheetTitle>
          <SheetDescription id="customise-desc" className="text-small">Saved for you in this company, on this device.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <fieldset>
            <legend className="mb-2 text-small font-bold uppercase tracking-wide text-muted-foreground">Starting layout</legend>
            <div className="grid gap-2">
              {PRESETS.map((p) => {
                const checked = draft.preset === p.id;
                return (
                  <label key={p.id} className={cn('flex min-h-touch cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5 focus-within:ring-[3px] focus-within:ring-ring', checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted')}>
                    <input type="radio" name="dashboard-preset" value={p.id} checked={checked} onChange={() => setDraft(presetLayout(p.id))} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))] focus-visible:outline-none" />
                    <span>
                      <span className="block font-semibold text-foreground">{p.label}</span>
                      <span className="block text-small text-muted-foreground">{p.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {draft.preset === 'custom' && <p className="mt-2 text-small text-muted-foreground">You have changed the widgets, so this is now your own layout.</p>}
          </fieldset>

          {WIDGET_GROUPS.map((group) => {
            const items = WIDGETS.filter((w) => w.group === group);
            const gid = `wg-${group.replace(/\W+/g, '-').toLowerCase()}`;
            return (
              <section key={group} aria-labelledby={gid}>
                <h3 id={gid} className="mb-1 text-small font-bold uppercase tracking-wide text-muted-foreground">{group}</h3>
                <ul className="divide-y divide-border rounded-control border border-border">
                  {items.map((w) => {
                    const id = `widget-${w.id}`;
                    const on = draft.widgets.includes(w.id);
                    return (
                      <li key={w.id} className="flex min-h-touch items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <Label htmlFor={id} className="cursor-pointer text-body font-semibold text-foreground">{w.title}</Label>
                          <p id={`${id}-desc`} className="text-small text-muted-foreground">{w.description}</p>
                        </div>
                        <Switch id={id} checked={on} aria-describedby={`${id}-desc`} onCheckedChange={(v) => setDraft((d) => toggleWidget(d, w.id, v))} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" className="min-h-touch" onClick={() => setDraft(defaultLayout())}>Reset</Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" className="min-h-touch" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="min-h-touch" onClick={() => onSave(draft)}>Save</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
