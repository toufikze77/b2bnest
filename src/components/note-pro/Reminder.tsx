import { AlarmClock, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatReminder, fromLocalInputValue, reminderState, toLocalInputValue } from '@/lib/reminderTime';

export const REMINDER_HELP = "You'll get a notification in B2BNEST when this time passes. Checked every 15 minutes.";

/** Edits a reminder stored as a UTC instant, in the viewer's local time. `null` clears it. */
export function ReminderField({ value, onChange, timeZone }: { value: string | null | undefined; onChange: (iso: string | null) => void; timeZone?: string }) {
  const local = toLocalInputValue(value, timeZone);
  return (
    <div>
      <label htmlFor="note-reminder" className="block font-semibold mb-2">Reminder</label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="note-reminder"
          type="datetime-local"
          className="h-11 w-auto min-w-[14rem] flex-1 sm:flex-none"
          value={local}
          aria-describedby="note-reminder-help"
          onChange={(e) => onChange(fromLocalInputValue(e.target.value, timeZone))}
        />
        {value && (
          <Button type="button" variant="outline" className="h-11" onClick={() => onChange(null)}>Remove reminder</Button>
        )}
      </div>
      <p id="note-reminder-help" className="mt-2 text-sm text-muted-foreground">
        {value ? <>Set for {formatReminder(value, timeZone)}. </> : null}
        {REMINDER_HELP}
      </p>
    </div>
  );
}

/** On a note card: a due reminder (time passed) stands out; a future one is quiet. */
export function ReminderBadge({ value, now, timeZone }: { value: string | null | undefined; now?: Date; timeZone?: string }) {
  const state = reminderState(value, now);
  if (state === 'none' || !value) return null;
  const when = formatReminder(value, timeZone);
  if (state === 'due') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-xs font-semibold text-foreground')}>
        <BellRing aria-hidden className="h-3.5 w-3.5 text-warning" />
        Reminder due · {when}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
      <AlarmClock aria-hidden className="h-3.5 w-3.5" />
      Reminder · {when}
    </span>
  );
}
