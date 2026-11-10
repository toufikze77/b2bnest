import { useEffect, useState } from 'react';
import { Info, Loader2, Unplug } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { callHmrcFunction, fetchHmrcStatus, messageFor, type HmrcStatus } from '@/lib/hmrcConnection';
import { HMRC_COMING_SOON } from '@/lib/hmrcAccess';

/**
 * HMRC hide switch: what a customer sees where the HMRC test features were. One calm line. A company that was already
 * connected to HMRC's test environment keeps its stored connection, and an owner or admin can still remove it here
 * (hmrc-disconnect stays open while hidden).
 */
export default function HMRCHiddenNotice({ testId = 'hmrc-coming-soon' }: { testId?: string }) {
  const { organizationId, organization } = useActiveOrganization();
  const [status, setStatus] = useState<HmrcStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  useEffect(() => {
    let live = true;
    setStatus(null);
    if (organizationId) void fetchHmrcStatus(organizationId).then((s) => { if (live) setStatus(s); });
    return () => { live = false; };
  }, [organizationId]);
  const connected = status?.kind === 'ok' && status.canManage && !!status.connection && status.connection.status !== 'disconnected';

  const disconnect = async () => {
    if (!organizationId || !window.confirm(`Disconnect ${organization?.name ?? 'this company'} from HMRC? Its HMRC sign-in will be deleted from B2BNEST.`)) return;
    setBusy(true); setSaid('');
    const r = await callHmrcFunction('hmrc-disconnect', { company_id: organizationId });
    setBusy(false);
    setSaid(r.ok ? 'Disconnected from HMRC.' : r.message ?? messageFor(r.code));
    if (r.ok) setStatus(await fetchHmrcStatus(organizationId));
  };

  return (
    <Alert role="note" data-testid={testId}>
      <Info className="h-4 w-4" aria-hidden />
      <AlertDescription className="space-y-2">
        <p>{HMRC_COMING_SOON}</p>
        {connected && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span>This company is still connected to HMRC's test environment.</span>
            <Button size="sm" variant="outline" onClick={() => { void disconnect(); }} disabled={busy} data-testid="hmrc-hidden-disconnect">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Unplug className="mr-2 h-4 w-4" aria-hidden />}Disconnect
            </Button>
          </p>
        )}
        {said && <p className="text-sm" role="status">{said}</p>}
      </AlertDescription>
    </Alert>
  );
}
