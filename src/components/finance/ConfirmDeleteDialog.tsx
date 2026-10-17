import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FocusReturn, restoreFocus, returnFocusTarget } from './returnFocus';

export type DeleteOutcome = null | { message: string; inUse?: boolean };

/**
 * Delete confirmation that names the item and says it can't be undone. It stays open while
 * deleting and shows any failure inside (the row stays as it was). When the database says the
 * item is still in use and `onMakeInactive` is given, it offers "Make inactive" instead.
 */
export function ConfirmDeleteDialog({ open, onOpenChange, noun, name, onConfirm, onMakeInactive, title, description, confirmLabel, confirmVariant = 'destructive', busyLabel = 'Deleting…' }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noun: string;
  name: string;
  onConfirm: () => Promise<DeleteOutcome>;
  onMakeInactive?: () => Promise<string | null>;
  /** Override the default wording (e.g. the stronger warning for sent or paid invoices). */
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** "default" for a non-destructive confirmation such as Move to archive. */
  confirmVariant?: 'destructive' | 'default';
  busyLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<DeleteOutcome>(null);
  const opener = useRef<FocusReturn | null>(null);
  useEffect(() => { if (open) { setProblem(null); opener.current = returnFocusTarget(); } }, [open]);

  const del = async () => {
    setBusy(true);
    const r = await onConfirm();
    setBusy(false);
    setProblem(r);
  };
  const inactive = async () => {
    if (!onMakeInactive) return;
    setBusy(true);
    const err = await onMakeInactive();
    setBusy(false);
    if (err) setProblem({ message: err });
  };
  const offerInactive = !!problem?.inUse && !!onMakeInactive;

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <AlertDialogContent onCloseAutoFocus={(e) => restoreFocus(opener.current, e)}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? `Delete ${noun} “${name}”?`}</AlertDialogTitle>
          <AlertDialogDescription>{description ?? `This permanently deletes the ${noun}. It can’t be undone.`}</AlertDialogDescription>
        </AlertDialogHeader>
        {problem && (
          <div role="alert" className="flex items-start gap-2 rounded-control border border-destructive/40 bg-destructive/5 p-3 text-body">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <p>{problem.message}</p>
          </div>
        )}
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="min-h-touch md:min-h-0" disabled={busy}>{offerInactive ? 'Close' : 'Cancel'}</AlertDialogCancel>
          {offerInactive ? (
            <Button className="min-h-touch md:min-h-0" disabled={busy} onClick={inactive}>{busy ? 'Saving…' : 'Make inactive'}</Button>
          ) : (
            <Button variant={confirmVariant} className="min-h-touch md:min-h-0" disabled={busy} onClick={del}>{busy ? busyLabel : confirmLabel ?? `Delete ${noun}`}</Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
