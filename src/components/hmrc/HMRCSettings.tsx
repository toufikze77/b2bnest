import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import HMRCConnectionPanel from '@/components/hmrc/HMRCConnectionPanel';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { hmrcService, type HMRCBusinessDetails } from '@/services/hmrcService';

const FIELDS: { key: keyof HMRCBusinessDetails; label: string; hint?: string }[] = [
  { key: 'companyName', label: 'Company name' },
  { key: 'companyNumber', label: 'Company number' },
  { key: 'utr', label: 'Unique Taxpayer Reference (UTR)' },
  { key: 'vatNumber', label: 'VAT registration number', hint: 'Used to read VAT obligations from HMRC: 9 digits (GB and spaces are fine). In the test environment, use your HMRC test user\'s VAT number.' },
  { key: 'payeReference', label: 'Employer PAYE reference' },
];

const EMPTY: HMRCBusinessDetails = { companyName: '', companyNumber: '', utr: '', vatNumber: '', payeReference: '' };

/**
 * HMRC P0: Settings → HMRC. The company's HMRC connection (status, connect and disconnect for owners and admins) and
 * the business details. There are no HMRC credential fields: B2BNEST uses its own HMRC application, set up by us.
 * HMRC P3 fix: the business details (and so the VAT number HMRC calls use) belong to the company selected here, the
 * same company as the connection panel. Owners and admins save them; members see them read-only.
 */
export default function HMRCSettings({ showConnection = true }: { showConnection?: boolean; onDisconnect?: () => void }) {
  const { organizationId, organization } = useActiveOrganization();
  const [details, setDetails] = useState<HMRCBusinessDetails>(EMPTY);
  const [source, setSource] = useState<'company' | 'unassigned' | 'none' | null>(null);
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState('');
  const latest = useRef(0);
  const isAdmin = organization?.role === 'owner' || organization?.role === 'admin';
  const companyName = organization?.name ?? 'this company';

  useEffect(() => {
    // Never show one company's details under another: clear first, and ignore an answer for a company no longer shown.
    const token = ++latest.current;
    setDetails(EMPTY); setSource(null); setSaid('');
    if (!organizationId) return;
    void hmrcService.getBusinessDetails(organizationId).then((r) => {
      if (token !== latest.current) return;
      setDetails(r.details); setSource(r.source);
    });
  }, [organizationId]);

  const save = async () => {
    if (!organizationId || !isAdmin) return;
    const forCompany = organizationId;
    setSaving(true); setSaid('');
    const r = await hmrcService.saveBusinessDetails(forCompany, details);
    setSaving(false);
    if (forCompany !== organizationId) return;
    if (r.ok) setSource('company');
    setSaid(r.ok ? `Business details saved for ${companyName}.` : r.needsUpdate ? 'Saving these details needs a database update. Nothing was lost.' : "Couldn't save. Please try again.");
  };

  return (
    <div className="space-y-6">
      {showConnection && <HMRCConnectionPanel />}
      <Card data-testid="hmrc-business-details">
        <CardHeader><CardTitle className="text-lg">Business details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!organizationId ? (
            <p className="text-sm text-muted-foreground">Create or join a company to save its business details.</p>
          ) : (
            <>
              <p className="text-sm font-medium" data-testid="hmrc-details-company">{isAdmin ? 'Saving for' : 'Company'}: {companyName}</p>
              <p className="text-sm text-muted-foreground">Kept for when HMRC features need them. You never need an HMRC developer account or keys.</p>
              {source === 'unassigned' && isAdmin && (
                <p className="text-sm" data-testid="hmrc-details-unassigned">These details were saved before they belonged to a company. Save them to keep them for {companyName}.</p>
              )}
              {!isAdmin && <p className="text-sm text-muted-foreground" data-testid="hmrc-details-member">Only an owner or admin of {companyName} can change these details.</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label htmlFor={`hmrc-${f.key}`}>{f.label}</Label>
                    <Input id={`hmrc-${f.key}`} value={details[f.key]} maxLength={120} readOnly={!isAdmin} disabled={source === null}
                      aria-describedby={f.hint ? `hmrc-${f.key}-hint` : undefined}
                      onChange={(e) => setDetails((d) => ({ ...d, [f.key]: e.target.value }))} />
                    {f.hint && <p id={`hmrc-${f.key}-hint`} className="text-xs text-muted-foreground">{f.hint}</p>}
                  </div>
                ))}
              </div>
              {isAdmin && <Button type="button" onClick={save} disabled={saving || source === null}>{saving ? 'Saving…' : 'Save business details'}</Button>}
            </>
          )}
          <p aria-live="polite" className="text-sm" data-testid="hmrc-details-announce">{said}</p>
        </CardContent>
      </Card>
    </div>
  );
}
