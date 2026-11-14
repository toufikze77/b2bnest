// Finance phase 2: the Ledger tab (docs/ledger/README.md). Bookkeeping only: chart of accounts, balanced manual
// journals, reversals and the trial balance. No automatic postings, no reports from the ledger, nothing sent to HMRC.
// The plan rule, who may write, demo accounts and closed companies are all decided by the database (ledger_status and
// the RPCs); this screen only shows what it is told.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import { LedgerAuto } from './LedgerAuto';
import { journalSources } from '@/lib/ledgerAuto';
import { runWaitingPostings } from '@/lib/ledgerAutoRun';
import { ledgerSectionFromSearch, searchWithLedgerSection, type LedgerSection } from '@/lib/financeTabs';

type State =
  | { kind: 'loading' }
  | { kind: 'not_available' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; status: LedgerStatus; accounts: LedgerAccount[]; journals: JournalEntry[]; sources: Map<string, string> };

const UPGRADE_ACCESS = ['plan_not_included', 'trial_ended'];
/** Opening these sections first posts any invoices waiting in the queue (owners and admins, switch on). */
const RUN_SECTIONS: LedgerSection[] = ['journals', 'trial-balance', 'automatic'];

export function LedgerTab({ organizationId, api: injected, isDemo: demoProp }: { organizationId: string | null; api?: LedgerApi; isDemo?: boolean }) {
  const demo = useDemoMode();
  const isDemo = demoProp ?? demo.isDemo;
  const api = useMemo(() => injected ?? ledgerApi(), [injected]);
  const [state, setState] = useState<State>({ kind: 'loading' });
  // The section is in the URL (?ledger=), so a refresh, Back and Forward keep it.
  const location = useLocation();
  const navigate = useNavigate();
  const section = ledgerSectionFromSearch(location.search);
  // Only a real change makes a history entry (the tab strip can report the same choice twice: press, then focus).
  const lastSection = useRef(section);
  lastSection.current = section;
  const setSection = (v: string) => {
    if (v === lastSection.current) return;
    lastSection.current = v as LedgerSection;
    navigate({ search: `?${searchWithLedgerSection(location.search, v as LedgerSection)}` });
  };
  // Bumped after every reload, so the trial balance and the automatic-postings screen fetch again too.
  const [refreshKey, setRefreshKey] = useState(0);

  /** quiet: keep what is on screen while reloading (no "Loading…" swap, so nothing on screen loses its state). */
  const load = useCallback(async (quiet = false) => {
    if (!organizationId || isDemo) return;
    if (!quiet) setState({ kind: 'loading' });
    const s = await api.status(organizationId);
    if (!s.ok) { const code = codeOf(s); setState(code === 'NOT_AVAILABLE' ? { kind: 'not_available' } : { kind: 'error', message: ledgerMessage(code) }); return; }
    if (s.data.access !== 'ok' || !s.data.set_up) { setState({ kind: 'ready', status: s.data, accounts: [], journals: [], sources: new Map() }); return; }
    // Post anything waiting first (only an owner or admin, with the switch on and something queued; never throws),
    // so the journals and the trial balance below already include it. The 5-minute job remains the safety net.
    await runWaitingPostings(api, organizationId);
    const [a, j] = await Promise.all([api.accounts(organizationId), api.journals(organizationId)]);
    if (!a.ok || !j.ok) {
      const code = codeOf(!a.ok ? a : j);
      setState(code === 'NOT_AVAILABLE' ? { kind: 'not_available' } : { kind: 'error', message: ledgerMessage(code) });
      return;
    }
    // Finance phase 3a: which journals were posted from invoices. Before that SQL is applied this read fails: no labels.
    const links = await api.postings(organizationId);
    setState({ kind: 'ready', status: s.data, accounts: a.data, journals: j.data, sources: journalSources(links.ok ? links.data : []) });
    setRefreshKey((k) => k + 1);
  }, [api, organizationId, isDemo]);

  useEffect(() => { void load(); }, [load]);
  // Opening (or coming Back to) Journals, Trial balance or Automatic postings: post what is waiting and reload quietly.
  const firstSection = useRef(true);
  useEffect(() => {
    if (firstSection.current) { firstSection.current = false; return; }
    if (RUN_SECTIONS.includes(section)) void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);
  const reloadQuietly = () => { void load(true); };

  const body = () => {
    if (isDemo) return <p data-testid="ledger-demo">{DEMO_READONLY_MESSAGE} The ledger isn't shown on the demo account.</p>;
    if (!organizationId) return <p>Choose a company first.</p>;
    if (state.kind === 'loading') return <p role="status">Loading…</p>;
    if (state.kind === 'not_available') return <p data-testid="ledger-not-available">{LEDGER_NOT_AVAILABLE}</p>;
    if (state.kind === 'error') {
      return <div className="space-y-2"><p role="alert" className="text-destructive">{state.message}</p><Button variant="outline" onClick={() => { void load(); }}>Try again</Button></div>;
    }
    const { status, accounts, journals, sources } = state;
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
          <TabsTrigger value="automatic">Automatic postings</TabsTrigger>
        </TabsList>
        <TabsContent value="journals" className="mt-4">
          <LedgerJournals api={api} organizationId={organizationId} accounts={accounts} canPost={status.can_post} journals={journals} sources={sources} onChanged={reloadQuietly} />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <LedgerChart api={api} organizationId={organizationId} accounts={accounts} canPost={status.can_post} onChanged={reloadQuietly} />
        </TabsContent>
        <TabsContent value="trial-balance" className="mt-4">
          <LedgerTrialBalance api={api} organizationId={organizationId} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="automatic" className="mt-4">
          {section === 'automatic' && <LedgerAuto api={api} organizationId={organizationId} refreshKey={refreshKey} onPosted={reloadQuietly} />}
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
