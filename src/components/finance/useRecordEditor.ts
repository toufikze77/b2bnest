import { useState } from 'react';
import { toast } from 'sonner';
import { buildPayload, changedFields, DbError, FieldSpec, formFromRow, FormValues } from '@/lib/moneyOut';
import type { MoneyOutApi } from '@/lib/moneyOutApi';
import type { DeleteOutcome } from './ConfirmDeleteDialog';

/**
 * Add / Edit / Delete flow shared by the money-out tabs. Edit sends only changed fields; a failed
 * save or delete leaves the record as it was and returns the message to show in the dialog.
 */
export function useRecordEditor<T extends { id: string }>({ spec, api, noun, nameOf, blank, onChanged, deleteProblem, toForm, prepare, validate, stateWords = ['active again', 'now inactive'] }: {
  spec: FieldSpec;
  api: MoneyOutApi;
  noun: string;
  nameOf: (r: T) => string;
  blank: () => FormValues;
  onChanged: () => void;
  /** Turns a failed delete into the message shown (suppliers use this for the "in use" case). */
  deleteProblem?: (r: T, error: DbError) => NonNullable<DeleteOutcome>;
  /** Extra form-only values when editing (e.g. product vs service). */
  toForm?: (r: T, base: FormValues) => FormValues;
  /** Adjust values before the payload is built (e.g. a service has no stock). */
  prepare?: (values: FormValues) => FormValues;
  /** Words for the toast after the Active toggle: [turned on, turned off]. */
  stateWords?: [string, string];
  /** Extra checks on the raw form values; return the message to show, or null. */
  validate?: (values: FormValues) => string | null;
}) {
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [initial, setInitial] = useState<FormValues>(blank);
  const [deleting, setDeleting] = useState<T | null>(null);

  const openAdd = () => { setEditing(null); setInitial(blank()); setFormOpen(true); };
  const openEdit = (r: T) => {
    const base = formFromRow(spec, r as unknown as Record<string, unknown>);
    setEditing(r); setInitial(toForm ? toForm(r, base) : base); setFormOpen(true);
  };

  const submit = async (values: FormValues): Promise<string | null> => {
    const problem = validate?.(values);
    if (problem) return problem;
    const { payload, errors } = buildPayload(spec, prepare ? prepare(values) : values);
    if (errors.length) return errors.join(' ');
    if (editing) {
      const changes = changedFields(editing as unknown as Record<string, unknown>, payload);
      if (!Object.keys(changes).length) { setFormOpen(false); toast.info('No changes to save.'); return null; }
      const { error } = await api.update(editing.id, changes);
      if (error) { toast.error(`${Noun} not saved`); return `Your changes weren’t saved. The ${noun} is unchanged. Please try again.`; }
      toast.success(`${Noun} “${nameOf({ ...editing, ...changes } as T)}” saved`);
    } else {
      const { error } = await api.create(payload);
      if (error) { toast.error(`${Noun} not added`); return `The ${noun} wasn’t added. Please try again.`; }
      toast.success(`${Noun} added`);
    }
    setFormOpen(false);
    onChanged();
    return null;
  };

  const confirmDelete = async (): Promise<DeleteOutcome> => {
    if (!deleting) return null;
    const { error } = await api.remove(deleting.id);
    if (error) {
      toast.error(`${Noun} not deleted`);
      return deleteProblem ? deleteProblem(deleting, error) : { message: `“${nameOf(deleting)}” couldn’t be deleted. Nothing was changed. Please try again.` };
    }
    toast.success(`${Noun} “${nameOf(deleting)}” deleted`);
    setDeleting(null);
    onChanged();
    return null;
  };

  /** Used by "Make inactive" and the Active/Paused toggle: a single-field update. */
  const setActive = async (r: T, active: boolean): Promise<string | null> => {
    const { error } = await api.update(r.id, { is_active: active });
    if (error) { toast.error(`${Noun} not updated`); return `“${nameOf(r)}” wasn’t updated. Please try again.`; }
    toast.success(`${Noun} “${nameOf(r)}” is ${active ? stateWords[0] : stateWords[1]}`);
    setDeleting(null);
    onChanged();
    return null;
  };

  return { formOpen, setFormOpen, editing, initial, openAdd, openEdit, submit, deleting, setDeleting, confirmDelete, setActive, Noun };
}
