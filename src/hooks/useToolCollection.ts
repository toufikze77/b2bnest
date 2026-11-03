import { useCallback, useEffect, useRef, useState } from 'react';
import { useFreeToolAccount } from '@/hooks/useFreeToolAccount';
import type { SavableTool } from '@/lib/freeToolItems';

/**
 * Phase 39: a free tool whose work is one collection (goals, surveys, checklist ticks).
 *   signed out, suspended, or before the database update: the browser copy (Phase 38), exactly as before;
 *   signed in: one item in the account (name `itemName`), saved after every change, in order.
 * The browser copy is never changed while the account is used; the one-time move copies it across on request.
 */
export function useToolCollection<T>(tool: SavableTool, opts: {
  itemName: string; empty: T; isValid: (v: unknown) => v is T; isEmpty: (v: T) => boolean;
  loadBrowser: () => T; saveBrowser: (v: T) => boolean; merge: (account: T, browser: T) => T;
}) {
  const acct = useFreeToolAccount<T>(tool);
  const { itemName, empty, isValid, isEmpty, loadBrowser, saveBrowser, merge } = opts;
  const [browser, setBrowser] = useState<T>(loadBrowser);
  const [storageOk, setStorageOk] = useState(true);
  const [local, setLocal] = useState<T | null>(null);
  const [edited, setEdited] = useState(false);
  const idRef = useRef<string | undefined>(undefined);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const item = acct.items.find((i) => isValid(i.data));
  const inAccount = acct.mode === 'account';
  useEffect(() => { if (item) idRef.current = item.id; }, [item]);
  useEffect(() => { if (!inAccount) setLocal(null); }, [inAccount]);

  const value: T = inAccount ? (local ?? (item ? (item.data as T) : empty)) : browser;

  const toAccount = useCallback((v: T) => {
    chain.current = chain.current.then(async () => {
      const saved = await acct.save(itemName, v, idRef.current);
      if (saved) idRef.current = saved.id;
      return saved;
    });
    return chain.current as Promise<unknown>;
  }, [acct, itemName]);

  const set = useCallback((v: T) => {
    setEdited(true);
    if (inAccount) { setLocal(v); void toAccount(v); return; }
    setBrowser(v);
    setStorageOk(saveBrowser(v));
  }, [inAccount, toAccount, saveBrowser]);

  const moveToAccount = useCallback(async () => {
    const merged = merge(value, browser);
    setLocal(merged);
    return !!(await toAccount(merged));
  }, [merge, value, browser, toAccount]);

  const removeBrowserCopy = useCallback(() => { saveBrowser(empty); setBrowser(empty); }, [saveBrowser, empty]);

  return {
    acct, value, set, storageOk, edited, inAccount,
    browserHasData: !isEmpty(browser), moveToAccount, removeBrowserCopy,
  };
}
