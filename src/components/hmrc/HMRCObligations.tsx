import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, FlaskConical, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { useDemoMode } from '@/contexts/demoModeState';
import { fetchHmrcStatus, HMRC_NOT_SET_UP, messageFor, ukDate, type HmrcStatus } from '@/lib/hmrcConnection';
import {
  getVatObligations, labelFor, lastYear, PRODUCTION_NOT_AVAILABLE, rangeDays, TEST_ENV_NOTE, ukDay, VAT_TEST_SCENARIOS, type VatObligation,
} from '@/lib/hmrcVat';
import { HMRC_FILING_UNAVAILABLE } from '@/components/hmrc/filingStatus';


const linkCls = 'font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelCls: Record<ReturnType<typeof labelFor>, string> = {
  Fulfilled: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100',
  Open: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100',
  'Open, due date passed': 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50',
};

/**
 * HMRC P3: the company's VAT obligations, read live from HMRC's test environment by owners and admins (trial, Business
 * or Scale). Members see the connection status only; Solo sees the plan message; demo accounts get no button.
 * Read only: nothing is filed and nothing is stored. PAYE, Corporation Tax and Self Assessment aren't connected.
 */
export default function HMRCObligations() {
  const { organizationId, organization, memberships, loading: orgLoading } = useActiveOrganization();
  const { isDemo } = useDemoMode();
  const [status, setStatus] = useState<HmrcStatus | null>(null);
  const [filter, setFilter] = useState<'O' | 'F'>('O');
  const [range, setRange] = useState(lastYear());
  const [scenario, setScenario] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [result, setResult] = useState<{ obligations: VatObligation[]; fetchedAt: string; status: 'O' | 'F' } | null>(null);
  const isAdmin = organization?.role === 'owner' || organization?.role === 'admin';

  const load = useCallback(async () => {
    setStatus(null); setResult(null); setSaid('');
    if (!organizationId) return;
    setStatus(await fetchHmrcStatus(organizationId));
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  const days = filter === 'F' ? rangeDays(range.from, range.to) : null;
  const rangeError = filter === 'F' && (days === null || days < 1 ? 'Choose a start date before the end date.' : days > 366 ? 'HMRC allows at most 366 days at a time.' : '');

  const get = async () => {
    if (!organizationId || rangeError) return;
    setBusy(true); setSaid(''); setResult(null);
    const r = await getVatObligations(organizationId, { status: filter, ...(filter === 'F' ? range : {}), ...(scenario ? { scenario } : {}) });
    setBusy(false);
    if (!r.ok) {
      setSaid(r.code === 'hmrc_refused' ? `HMRC didn't accept the request${r.hmrc_code ? ` (${r.hmrc_code})` : ''}. Please try again later.`
        // The VAT number belongs to a company: say which one (docs/hmrc-p3, "Fixed after release").
        : r.code === 'vrn_missing' ? `Add your VAT number in Settings → HMRC for ${organization?.name ?? 'this company'} first.`
        : r.message ?? messageFor(r.code));
      return;
    }
    const list = r.obligations ?? [];
    setResult({ obligations: list, fetchedAt: r.fetched_at ?? new Date().toISOString(), status: filter });
    setSaid(list.length ? `HMRC returned ${list.length} VAT obligation${list.length === 1 ? '' : 's'}.` : 'HMRC returned no VAT obligations for this search.');
  };

  const body = () => {
    if (orgLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
    if (!organizationId || memberships.length === 0) return <p className="text-sm text-muted-foreground" data-testid="vat-no-company">Create or join a company to see its VAT obligations.</p>;
    if (!status) return <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="vat-loading"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Checking the HMRC connection…</p>;
    switch (status.kind) {
      case 'not_set_up': return <p className="text-sm" data-testid="vat-not-set-up">{HMRC_NOT_SET_UP}</p>;
      case 'no_access': return <p className="text-sm" data-testid="vat-no-access">{messageFor('not_member')}</p>;
      case 'two_step': return <p className="text-sm" data-testid="vat-two-step">{messageFor('two_step_required')}</p>;
      case 'error': return <p className="text-sm" data-testid="vat-error">{messageFor('server_error')}</p>;
      case 'ended':
        return (
          <p className="text-sm" data-testid="vat-ended">
            {messageFor(status.reason)}
            {status.reason !== 'suspended' && <> {!isAdmin && <>Ask an owner or admin of {organization?.name ?? 'your company'} about the plan. </>}<Link to="/pricing" className={linkCls}>See plans</Link></>}
          </p>
        );
      case 'ok': {
        if (status.production) return <p className="text-sm" data-testid="vat-production">{PRODUCTION_NOT_AVAILABLE}</p>;
        const c = status.connection;
        if (!c || c.status === 'disconnected') return <p className="text-sm" data-testid="vat-not-connected">Connect this company to HMRC first in <Link to="/settings?tab=hmrc" className={linkCls}>Settings → HMRC</Link>.</p>;
        if (c.status === 'needs_reconnect') return <p className="text-sm" data-testid="vat-needs-reconnect">{messageFor('needs_reconnect')}</p>;
        if (!status.canManage) {
          return <p className="text-sm" data-testid="vat-member">Connected to HMRC (test environment). Only an owner or admin of {organization?.name ?? 'your company'} can get VAT obligations.</p>;
        }
        if (isDemo) return <p className="text-sm" data-testid="vat-demo">Connected to HMRC (test environment). This is a demo account, so VAT obligations can't be read from HMRC here.</p>;
        if (!c.scopes.includes('read:vat')) {
          return <p className="text-sm" data-testid="vat-scope-missing">{messageFor('scope_missing')} <Link to="/settings?tab=hmrc" className={linkCls}>Settings → HMRC</Link></p>;
        }
        return (
          <div className="space-y-4" data-testid="vat-form">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="vat-status">Show</Label>
                <select id="vat-status" value={filter} onChange={(e) => setFilter(e.target.value as 'O' | 'F')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="O">Open</option>
                  <option value="F">Fulfilled</option>
                </select>
              </div>
              {filter === 'F' && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="vat-from">From</Label>
                    <Input id="vat-from" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="vat-to">To</Label>
                    <Input id="vat-to" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
                  </div>
                </>
              )}
              <div className="space-y-1">
                <Label htmlFor="vat-scenario" className="flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5" aria-hidden />Test scenario (sandbox)</Label>
                <select id="vat-scenario" value={scenario} onChange={(e) => setScenario(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">HMRC's default test data</option>
                  {VAT_TEST_SCENARIOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
            {rangeError && <p className="text-sm text-destructive" data-testid="vat-range-error">{rangeError}</p>}
            <Button type="button" onClick={get} disabled={busy || !!rangeError} data-testid="vat-get">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <CalendarClock className="mr-2 h-4 w-4" aria-hidden />}
              Get VAT obligations
            </Button>
            {result && result.obligations.length > 0 && <ObligationsTable obligations={result.obligations} />}
            {result && <p className="text-xs text-muted-foreground" data-testid="vat-fetched">Read from HMRC's test environment on {ukDate(result.fetchedAt)}. Nothing is stored or sent.</p>}
          </div>
        );
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">HMRC obligations</h2>
        <p className="text-muted-foreground">VAT obligations read from HMRC. PAYE, Corporation Tax and Self Assessment deadlines aren't connected yet.</p>
      </div>
      <Alert role="note" className="border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-50">
        <FlaskConical className="h-4 w-4" />
        <AlertTitle>{HMRC_FILING_UNAVAILABLE}</AlertTitle>
        <AlertDescription data-testid="vat-test-env">{TEST_ENV_NOTE}</AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">VAT obligations</CardTitle>
            <Badge variant="outline">HMRC test environment</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {body()}
          <p aria-live="polite" role="status" className="text-sm" data-testid="vat-announce">{said}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ObligationsTable({ obligations }: { obligations: VatObligation[] }) {
  const rows = [...obligations].sort((a, b) => (a.status === b.status ? a.due.localeCompare(b.due) : a.status === 'O' ? -1 : 1));
  return (
    <div className="overflow-x-auto rounded-md border" data-testid="vat-table">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">VAT obligations from HMRC's test environment</caption>
        <thead className="bg-muted/50 text-left">
          <tr><th scope="col" className="px-3 py-2 font-medium">Period</th><th scope="col" className="px-3 py-2 font-medium">Due</th>
            <th scope="col" className="px-3 py-2 font-medium">Status</th><th scope="col" className="px-3 py-2 font-medium">Received by HMRC</th></tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const label = labelFor(o);
            return (
              <tr key={`${o.periodKey}-${o.start}`} className="border-t">
                <td className="px-3 py-2">{ukDay(o.start)} to {ukDay(o.end)}<span className="ml-2 font-mono text-xs text-muted-foreground">{o.periodKey}</span></td>
                <td className="px-3 py-2">{ukDay(o.due)}</td>
                <td className="px-3 py-2"><Badge variant="outline" className={labelCls[label]}>{label}</Badge></td>
                <td className="px-3 py-2">{o.received ? ukDay(o.received) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
