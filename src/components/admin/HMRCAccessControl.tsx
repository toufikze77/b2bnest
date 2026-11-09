import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { fetchHmrcAccessStatus, setHmrcCustomerAccess, type HmrcAccessStatus, type HmrcSwitch } from '@/lib/hmrcAccess';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

/**
 * HMRC hide switch (docs/hmrc-hide/README.md): super admins show or hide HMRC's test-environment features for
 * customers. The database checks again (super admin, two-step sign-in) and writes an admin audit entry. Platform super
 * admins and admins always keep access, so the owner can go on testing.
 */
export default function HMRCAccessControl() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [status, setStatus] = useState<HmrcAccessStatus | 'not_set_up' | 'error' | null>(null);
  const [busy, setBusy] = useState<HmrcSwitch | null>(null);
  const [said, setSaid] = useState('');
  const load = useCallback(async () => setStatus(await fetchHmrcAccessStatus()), []);
  useEffect(() => { if (isSuperAdmin) void load(); }, [isSuperAdmin, load]);
  if (loading || !isSuperAdmin) return null;

  const flip = async (state: HmrcSwitch) => {
    setBusy(state); setSaid('');
    const r = await setHmrcCustomerAccess(state);
    setBusy(null);
    if (r.ok === false) { setSaid(r.message); return; }
    setSaid(state === 'visible' ? 'HMRC test features are now shown to customers.' : 'HMRC test features are now hidden from customers.');
    await load();
  };
  const s = typeof status === 'object' && status ? status : null;

  return (
    <Card className="lg:col-span-2" data-testid="hmrc-access-control">
      <CardHeader>
        <CardTitle className="text-base">HMRC features for customers</CardTitle>
        <CardDescription>
          Every HMRC feature uses HMRC's test environment until HMRC approves production, so nothing is filed for real. Hidden, customers see
          a short note instead and can still prepare and download their VAT figures. Platform super admins and admins always keep access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {status === null ? <p className="text-muted-foreground">Loading…</p>
          : status === 'not_set_up' ? <p data-testid="hmrc-access-not-set-up">The switch arrives with a database update (docs/hmrc-hide). Until then customers don't see the HMRC features.</p>
          : status === 'error' ? <p data-testid="hmrc-access-error">The current setting couldn't be read. Customers don't see the HMRC features while it can't be read.</p>
          : (
            <p data-testid="hmrc-access-state">
              Now: <Badge variant="outline">{s!.state === 'visible' ? 'Shown to customers' : 'Hidden from customers'}</Badge>
              {s!.updated_at && <span className="ml-2 text-muted-foreground">Changed {when(s!.updated_at)}{s!.updated_by_email ? ` by ${s!.updated_by_email}` : ''}</span>}
            </p>
          )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { void flip('visible'); }} disabled={!!busy || status === 'not_set_up' || s?.state === 'visible'} data-testid="hmrc-access-show">
            {busy === 'visible' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Eye className="mr-2 h-4 w-4" aria-hidden />}Show HMRC test features to customers
          </Button>
          <Button variant="outline" onClick={() => { void flip('hidden'); }} disabled={!!busy || status === 'not_set_up' || s?.state === 'hidden'} data-testid="hmrc-access-hide">
            {busy === 'hidden' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <EyeOff className="mr-2 h-4 w-4" aria-hidden />}Hide HMRC test features from customers
          </Button>
        </div>
        {said && <p role="status" data-testid="hmrc-access-said">{said}</p>}
      </CardContent>
    </Card>
  );
}
