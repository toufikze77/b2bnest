import { RefObject, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { defaultSections, SECTIONS, SectionPrefs } from '@/lib/businessOverview';

/**
 * Right-hand drawer for choosing which Business overview sections show (like the Dashboard's).
 * Changes stay in a draft until Save; Cancel discards them; Reset turns every section back on.
 */
export function CustomiseSections({ open, onOpenChange, prefs, onSave, returnFocusRef }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: SectionPrefs;
  onSave: (prefs: SectionPrefs) => void;
  returnFocusRef?: RefObject<HTMLElement>;
}) {
  const [draft, setDraft] = useState(prefs);
  useEffect(() => { if (open) setDraft(prefs); }, [open, prefs]);
  const shown = SECTIONS.filter((s) => draft[s.id]).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md" aria-describedby="overview-customise-desc"
        onCloseAutoFocus={(e) => { if (returnFocusRef?.current) { e.preventDefault(); returnFocusRef.current.focus(); } }}>
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <SheetTitle className="text-card-title">Customise overview</SheetTitle>
          <SheetDescription id="overview-customise-desc" className="text-small">Choose the sections to show. Saved for you in this company, on this device.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <ul className="divide-y divide-border rounded-control border border-border">
            {SECTIONS.map((s) => {
              const id = `overview-section-${s.id}`;
              return (
                <li key={s.id} className="flex min-h-touch items-center justify-between gap-3 px-3 py-2">
                  <Label htmlFor={id} className="text-body font-medium">{s.label}</Label>
                  <Switch id={id} checked={draft[s.id]} onCheckedChange={(on) => setDraft((d) => ({ ...d, [s.id]: on }))} />
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-small text-muted-foreground" aria-live="polite">{shown} of {SECTIONS.length} sections shown.</p>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" className="min-h-touch" onClick={() => setDraft(defaultSections())}>Reset</Button>
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-touch" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="min-h-touch" onClick={() => onSave(draft)}>Save</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
