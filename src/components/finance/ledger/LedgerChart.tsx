import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { accountActions, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, checkNewAccount, groupAccounts, ledgerMessage, type AccountType, type LedgerAccount } from '@/lib/ledger';
import type { LedgerApi } from '@/lib/ledgerApi';

/** The chart of accounts, grouped by type. Add, rename (not system accounts) and make inactive / active again. */
export function LedgerChart({ api, organizationId, accounts, canPost, onChanged }: {
  api: LedgerApi; organizationId: string; accounts: LedgerAccount[]; canPost: boolean; onChanged: () => void;
}) {
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'expense' as AccountType });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<{ ok: boolean; code?: string }>, after?: () => void) => {
    setBusy(true); setErrors([]);
    const r = await fn();
    setBusy(false);
    if (r.ok) { after?.(); onChanged(); } else setErrors([ledgerMessage((r as { code: string }).code)]);
  };

  const add = () => {
    const errs = checkNewAccount(form, new Set(accounts.map((a) => a.code)));
    if (errs.length) { setErrors(errs); return; }
    void run(() => api.addAccount(organizationId, form), () => { setAdding(false); setForm({ code: '', name: '', type: 'expense' }); });
  };

  return (
    <div className="space-y-4">
      {canPost && !adding && <Button onClick={() => { setAdding(true); setErrors([]); }}>Add account</Button>}
      {adding && (
        <Card>
          <CardHeader><CardTitle className="text-base">New account</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="acc-code">Code</Label><Input id="acc-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="acc-name">Name</Label><Input id="acc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1">
              <Label htmlFor="acc-type">Type</Label>
              <select id="acc-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="flex gap-2 sm:col-span-3">
              <Button onClick={add} disabled={busy}>Save account</Button>
              <Button variant="outline" onClick={() => { setAdding(false); setErrors([]); }} disabled={busy}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
      {errors.length > 0 && <ul role="alert" className="list-disc pl-5 text-sm text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}

      {groupAccounts(accounts).map((g) => (
        <Card key={g.type}>
          <CardHeader className="pb-2"><CardTitle className="text-base">{g.label}</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y" aria-label={g.label}>
              {g.accounts.map((a) => {
                const can = accountActions(a, canPost);
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm" data-testid={`account-${a.code}`}>
                    <span className="w-16 font-mono">{a.code}</span>
                    {renaming?.id === a.id ? (
                      <>
                        <Input aria-label={`New name for ${a.code}`} value={renaming.name} onChange={(e) => setRenaming({ id: a.id, name: e.target.value })} className="h-9 max-w-xs" />
                        <Button size="sm" disabled={busy || !renaming.name.trim() || renaming.name.trim().length > 80}
                          onClick={() => { void run(() => api.updateAccount(a.id, { name: renaming.name }), () => setRenaming(null)); }}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
                      </>
                    ) : <span className="flex-1">{a.name}</span>}
                    {a.is_system && <Badge variant="secondary">System</Badge>}
                    {!a.is_active && <Badge variant="outline">Inactive</Badge>}
                    {can.rename && renaming?.id !== a.id && <Button size="sm" variant="ghost" onClick={() => setRenaming({ id: a.id, name: a.name })}>Rename<span className="sr-only"> {a.code}</span></Button>}
                    {can.deactivate && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { void run(() => api.updateAccount(a.id, { is_active: false })); }}>Make inactive<span className="sr-only"> {a.code}</span></Button>}
                    {can.reactivate && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { void run(() => api.updateAccount(a.id, { is_active: true })); }}>Make active<span className="sr-only"> {a.code}</span></Button>}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
