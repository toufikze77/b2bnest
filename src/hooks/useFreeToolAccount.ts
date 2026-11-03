import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAccess } from '@/hooks/useAccess';
import {
  deleteItem, listItems, NEEDS_DB_UPDATE, saveItem, SUSPENDED_SAVE_MESSAGE, type FreeToolItem, type SavableTool,
} from '@/lib/freeToolItems';

/**
 * Phase 39: where a free tool keeps its work.
 *   'signed-out' — the browser only (Phase 38); prompts offer a free account at the moment of value.
 *   'account'    — signed in (any plan, trial ended or none): saved to the account, on every device.
 *   'browser'    — signed in but the account can't save: suspended (read-only, Phase 38 behaviour) or the database
 *                  update isn't applied yet. The tool keeps working in the browser and says why.
 *   'loading'    — reading the account.
 */
export type FreeToolMode = 'signed-out' | 'loading' | 'account' | 'browser';

export function useFreeToolAccount<T>(tool: SavableTool) {
  const { user } = useAuth();
  const access = useAccess();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<FreeToolItem<T>[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const suspended = !!userId && !access.loading && access.suspended;

  useEffect(() => {
    if (!userId || access.loading || suspended) { setItems([]); setState('idle'); return; }
    let live = true;
    setState('loading');
    listItems<T>(tool).then((r) => {
      if (!live) return;
      if (r.ok) { setItems(r.value ?? []); setState('ready'); return; }
      setState(r.missing ? 'missing' : 'error');
      setMessage(r.error ?? '');
    });
    return () => { live = false; };
  }, [userId, tool, access.loading, suspended]);

  const mode: FreeToolMode = !userId ? 'signed-out'
    : access.loading || state === 'loading' || state === 'idle' && !suspended ? 'loading'
    : state === 'ready' ? 'account' : 'browser';

  const save = useCallback(async (name: string, data: T, id?: string) => {
    if (!userId) return null;
    const r = await saveItem<T>(userId, tool, name, data, id);
    if (!r.ok || !r.value) { setMessage(r.error ?? ''); if (r.missing) setState('missing'); return null; }
    const saved = r.value;
    setItems((list) => [saved, ...list.filter((x) => x.id !== saved.id)]);
    setMessage(`Saved "${saved.name}" to your account.`);
    return saved;
  }, [userId, tool]);

  const remove = useCallback(async (id: string) => {
    const r = await deleteItem(id);
    if (!r.ok) { setMessage(r.error ?? ''); return false; }
    setItems((list) => list.filter((x) => x.id !== id));
    return true;
  }, []);

  const browserReason = suspended ? SUSPENDED_SAVE_MESSAGE : state === 'missing' ? NEEDS_DB_UPDATE : state === 'error' ? message : '';
  return {
    mode, userId, items, save, remove, message, setMessage, browserReason,
    suspended, trialEnded: !!userId && !access.loading && access.trialEnded && !access.suspended,
  };
}
