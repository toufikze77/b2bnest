import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import HMRCConnectionPanel from '@/components/hmrc/HMRCConnectionPanel';
import { hmrcService, type HMRCBusinessDetails } from '@/services/hmrcService';

const FIELDS: { key: keyof HMRCBusinessDetails; label: string; hint?: string }[] = [
  { key: 'companyName', label: 'Company name' },
  { key: 'companyNumber', label: 'Company number' },
  { key: 'utr', label: 'Unique Taxpayer Reference (UTR)' },
  { key: 'vatNumber', label: 'VAT registration number' },
  { key: 'payeReference', label: 'Employer PAYE reference' },
];

/**
 * HMRC P0: Settings → HMRC. The company's HMRC connection (status, connect and disconnect for owners and admins) and
 * your business details. There are no HMRC credential fields: B2BNEST uses its own HMRC application, set up by us.
 */
export default function HMRCSettings({ showConnection = true }: { showConnection?: boolean; onDisconnect?: () => void }) {
  const [details, setDetails] = useState<HMRCBusinessDetails>({ companyName: '', companyNumber: '', utr: '', vatNumber: '', payeReference: '' });
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState('');
  useEffect(() => { void hmrcService.getBusinessDetails().then(setDetails); }, []);

  const save = async () => {
    setSaving(true); setSaid('');
    const r = await hmrcService.saveBusinessDetails(details);
    setSaving(false);
    setSaid(r.ok ? 'Business details saved.' : r.needsUpdate ? 'Saving these details needs a database update. Nothing was lost.' : "Couldn't save. Please try again.");
  };

  return (
    <div className="space-y-6">
      {showConnection && <HMRCConnectionPanel />}
      <Card>
        <CardHeader><CardTitle className="text-lg">Business details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Kept for when HMRC features need them. You never need an HMRC developer account or keys.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`hmrc-${f.key}`}>{f.label}</Label>
                <Input id={`hmrc-${f.key}`} value={details[f.key]} maxLength={120} onChange={(e) => setDetails((d) => ({ ...d, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save business details'}</Button>
          <p aria-live="polite" className="text-sm" data-testid="hmrc-details-announce">{said}</p>
        </CardContent>
      </Card>
    </div>
  );
}
