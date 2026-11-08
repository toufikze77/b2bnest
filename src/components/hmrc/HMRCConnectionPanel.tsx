import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Loader2, ShieldCheck, Unlink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import OrganizationSwitcher from '@/components/OrganizationSwitcher';
import HMRCTestTools from '@/components/hmrc/HMRCTestTools';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import {
  callHmrcFunction, fetchHmrcStatus, HMRC_NOT_SET_UP, messageFor, rememberCompany, SANDBOX_LABEL, ukDate, type HmrcStatus,
} from '@/lib/hmrcConnection';

/**
 * HMRC P0: the company's HMRC connection. Owners and admins connect and disconnect; other members see the status only.
 * Nothing here ever holds a token, an HMRC client id or secret: the server does the HMRC sign-in.
 */
export default function HMRCConnectionPanel() {
  const { organizationId, organization, memberships, loading: orgLoading } = useActiveOrganization();
  const [status, setStatus] = useState<HmrcStatus | null>(null);
  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null);
  const [said, setSaid] = useState('');
  const isAdmin = organization?.role === 'owner' || organization?.role === 'admin';

  const load = useCallback(async () => {
    if (!organizationId) { setStatus(null); return; }
    setStatus(null);
    setStatus(await fetchHmrcStatus(organizationId));
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  const connect = async () => {
    if (!organizationId) return;
    setBusy('connect'); setSaid('');
    const r = await callHmrcFunction('hmrc-connect-start', { company_id: organizationId });
    if (r.ok && r.url) {
      rememberCompany(organizationId);
      setSaid('Opening HMRC sign-in…');
      window.location.assign(r.url);
      return;
    }
    setBusy(null);
    setSaid(r.message ?? messageFor(r.code));
  };
  const disconnect = async () => {
    if (!organizationId || !window.confirm(`Disconnect ${organization?.name ?? 'this company'} from HMRC? Its HMRC sign-in will be deleted from B2BNEST.`)) return;
    setBusy('disconnect'); setSaid('');
    const r = await callHmrcFunction('hmrc-disconnect', { company_id: organizationId });
    setBusy(null);
    setSaid(r.ok ? 'Disconnected from HMRC.' : r.message ?? messageFor(r.code));
    if (r.ok) await load();
  };

  const body = () => {
    if (orgLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
    if (!organizationId || memberships.length === 0) {
      return <p className="text-sm text-muted-foreground" data-testid="hmrc-no-company">Create or join a company to connect it to HMRC.</p>;
    }
    if (!status) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Checking the connection…</p>;
    switch (status.kind) {
      case 'not_set_up':
        return <p className="text-sm" data-testid="hmrc-not-set-up">{HMRC_NOT_SET_UP}</p>;
      case 'no_access':
        return <p className="text-sm" data-testid="hmrc-no-access">{messageFor('not_member')}</p>;
      case 'two_step':
        return <p className="text-sm" data-testid="hmrc-two-step">{messageFor('two_step_required')}</p>;
      case 'ended':
        return (
          <p className="text-sm" data-testid="hmrc-ended">
            {messageFor(status.reason)}
            {status.reason !== 'suspended' && (isAdmin
              ? <> <Link to="/pricing" className="font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">See plans</Link></>
              : <> Ask an owner or admin of {organization?.name ?? 'your company'} about the plan. <Link to="/pricing" className="font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">See plans</Link></>)}
          </p>
        );
      case 'error':
        return <p className="text-sm" data-testid="hmrc-error">{messageFor('server_error')}</p>;
      case 'ok': {
        const c = status.connection;
        const state = !c || c.status === 'disconnected' ? 'disconnected' : c.status;
        return (
          <div className="space-y-3" data-testid="hmrc-status">
            <p className="font-medium" data-testid="hmrc-state">
              {state === 'connected' ? 'Connected to HMRC' : state === 'needs_reconnect' ? 'The HMRC connection needs reconnecting' : 'Not connected to HMRC'}
            </p>
            {c && state !== 'disconnected' && (
              <p className="text-sm text-muted-foreground">
                Connected{c.connected_by_name ? ` by ${c.connected_by_name}` : ''}{c.connected_at ? ` on ${ukDate(c.connected_at)}` : ''}.
              </p>
            )}
            {state === 'needs_reconnect' && <p className="text-sm" data-testid="hmrc-needs-reconnect">{messageFor('needs_reconnect')}</p>}
            {status.canManage ? (
              <div className="flex flex-wrap gap-2">
                {state !== 'connected' && (
                  <Button type="button" onClick={connect} disabled={!!busy}>
                    {busy === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="mr-2 h-4 w-4" aria-hidden />}
                    {state === 'needs_reconnect' ? 'Reconnect to HMRC' : 'Connect to HMRC'}
                  </Button>
                )}
                {state !== 'disconnected' && (
                  <Button type="button" variant="outline" onClick={disconnect} disabled={!!busy}>
                    {busy === 'disconnect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Unlink className="mr-2 h-4 w-4" aria-hidden />}
                    Disconnect
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="hmrc-member-note">Ask an owner or admin of {organization?.name ?? 'your company'} to connect or disconnect HMRC.</p>
            )}
            {status.canManage && state === 'connected' && organizationId && <HMRCTestTools companyId={organizationId} />}
            <p className="text-xs text-muted-foreground">Connecting lets B2BNEST read VAT obligations and send test VAT returns for this company in HMRC's test environment. Filing is not available yet.</p>
          </div>
        );
      }
    }
  };

  return (
    <Card data-testid="hmrc-connection-panel">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5" aria-hidden />HMRC connection</CardTitle>
          <Badge variant="outline" data-testid="hmrc-environment">{SANDBOX_LABEL}</Badge>
        </div>
        {memberships.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Company:</span>
            <OrganizationSwitcher />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {body()}
        <p aria-live="polite" className="text-sm" data-testid="hmrc-announce">{said}</p>
      </CardContent>
    </Card>
  );
}
