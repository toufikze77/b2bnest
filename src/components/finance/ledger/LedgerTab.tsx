// Finance phase 2: the Ledger tab (docs/ledger/README.md). Bookkeeping only: chart of accounts, balanced manual
// journals, reversals and the trial balance. No automatic postings, no reports from the ledger, nothing sent to HMRC.
// The plan rule, who may write, demo accounts and closed companies are all decided by the database (ledger_status and
// the RPCs); this screen only shows what it is told.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDemoMode } from '@/contexts/demoModeState';
import { DEMO_READONLY_MESSAGE } from '@/lib/demoMode';
import { LEDGER_DISCLAIMER, LEDGER_NOT_AVAILABLE, ledgerMessage, type LedgerAccount } from '@/lib/ledger';
import { codeOf, ledgerApi, type JournalEntry, type LedgerApi, type LedgerStatus } from '@/lib/ledgerApi';
import { LedgerSetup } from './LedgerSetup';
import { LedgerChart } from './LedgerChart';
import { LedgerJournals } from './LedgerJournals';
import { LedgerTrialBalance } from './LedgerTrialBalance';

type State =
  | { kind: 'loading' }
  | { kind: 'not_available' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; status: LedgerStatus; accounts: LedgerAccount[]; journals: JournalEntry[] };

const UPGRADE_ACCESS = ['plan_not_included', 'trial_ended'];

export function LedgerTab({ organizationId, api: injected, isDemo: demoProp }: { organizationId: string | null; api?: LedgerApi; isDemo?: boolean }) {
  const demo = useDemoMode();
  const isDemo = demoProp ?? demo.isDemo;
  const api = useMemo(() => injected ?? ledgerApi(), [injected]);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [section, setSection] = useState('journals');

  const load = useCallback(async () => {
    if (!organizationId || isDemo) return;
    setState({ kind: 'loading' });
    const s = await api.status(organizationId);
    if (!s.ok) { const code = codeOf(s); setState(code === 'NOT_AVAILABLE' ? { kind: 'not_available' } : { kind: 'error', message: ledgerMessage(code) }); return; }
    if (s.data.access !== 'ok' || !s.data.set_up) { setState({ kind: 'ready', status: s.data, accounts: [], journals: [] }); return; }
    const [a, j] = await Promise.all([api.accounts(organizationId), api.journals(organizationId)]);
    if (!a.ok || !j.ok) {
      const code = codeOf(!a.ok ? a : j);
      setState(code === 'NOT_AVAILABLE' ? { kind: 'not_available' } : { kind: 'error', message: ledgerMessage(code) });
      return;
    }
    setState({ kind: 'ready', status: s.data, accounts: a.data, journals: j.data });
  }, [api, organizationId, isDemo]);

  useEffect(() => { void load(); }, [load]);

  const body = () => {
    if (isDemo) return <p data-testid="ledger-demo">{DEMO_READONLY_MESSAGE} The ledger isn't shown on the demo account.</p>;
    if (!organizationId) return <p>Choose a company first.</p>;
    if (state.kind === 'loading') return <p role="status">Loading…</p>;
    if (state.kind === 'not_available') return <p data-testid="ledger-not-available">{LEDGER_NOT_AVAILABLE}</p>;
    if (state.kind === 'error') {
      return <div className="space-y-2"><p role="alert" className="text-destructive">{state.message}</p><Button variant="outline" onClick={() => { void load(); }}>Try again</Button></div>;
    }
    const { status, accounts, journals } = state;
    if (status.access !== 'ok') {
      return (
        <div data-testid="ledger-upgrade" className="space-y-2">
          <p>{ledgerMessage(status.access.toUpperCase())}</p>
          {UPGRADE_ACCESS.includes(status.access) && <Link to="/pricing" className="font-medium text-primary underline">See plans on the Pricing page</Link>}
        </div>
      );
    }
    if (!status.set_up) {
      return status.can_post
        ? <LedgerSetup api={api} organizationId={organizationId} onDone={() => { void load(); }} />
        : <p>The ledger isn't set up yet. An owner or admin of this company can set it up.</p>;
    }
    return (
      <Tabs value={section} onValueChange={setSection}>
        <p className="mb-3 text-sm text-muted-foreground">
          Started {status.start_date} ({status.opening_mode === 'import' ? 'with opening balances' : 'fresh'}). Amounts in {status.base_currency}.
          {!status.can_post && ' You can view the ledger. Only an owner or admin can change it.'}
        </p>
        <TabsList aria-label="Ledger sections">
          <TabsTrigger value="journals">Journals</TabsTrigger>
          <TabsTrigger value="accounts">Chart of accounts</TabsTrigger>
          <TabsTrigger value="trial-balance">Trial balance</TabsTrigger>
        </TabsList>
        <TabsContent value="journals" className="mt-4">
          <LedgerJournals api={api} organizationId={organizationId} accounts={accounts} canPost={status.can_post} journals={journals} onChanged={() => { void load(); }} />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <LedgerChart api={api} organizationId={organizationId} accounts={accounts} canPost={status.can_post} onChanged={() => { void load(); }} />
        </TabsContent>
        <TabsContent value="trial-balance" className="mt-4">
          <LedgerTrialBalance api={api} organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <div className="space-y-4" data-testid="ledger-tab">
      <Card><CardContent className="py-3 text-sm text-muted-foreground" data-testid="ledger-disclaimer">{LEDGER_DISCLAIMER}</CardContent></Card>
      {body()}
    </div>
  );
}
