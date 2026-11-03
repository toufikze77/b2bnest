import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { CONSENT_TEXT, readConsent, recordSignupConsent, setConsent } from '@/lib/marketingConsent';
import { shortDate } from '@/lib/freeToolItems';

/** Phase 39: after each sign-in, records the sign-up form's marketing choice once (the server keeps the first). */
export function ConsentRecorder() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    const key = `b2bnest.consentRecorded.${userId}`;
    try { if (sessionStorage.getItem(key) === '1') return; sessionStorage.setItem(key, '1'); } catch { /* still record once per page load */ }
    void recordSignupConsent();
  }, [userId]);
  return null;
}

/** Settings → Notifications: the marketing email switch, saved to the same server record; the result is announced. */
export function MarketingConsentSwitch() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(true);
  const [missing, setMissing] = useState(false);
  const [said, setSaid] = useState('');
  useEffect(() => {
    if (!userId) return;
    let live = true;
    readConsent(userId).then((r) => {
      if (!live) return;
      setBusy(false);
      if (r.ok) setOn(!!r.value?.consented);
      else { setMissing(!!r.missing); setSaid(r.error ?? ''); }
    });
    return () => { live = false; };
  }, [userId]);
  const change = async (next: boolean) => {
    setBusy(true); setSaid('');
    const r = await setConsent(next);
    setBusy(false);
    if (!r.ok) { setSaid(r.error ?? ''); if (r.missing) setMissing(true); return; }
    setOn(!!r.value?.consented);
    setSaid(r.value?.consented
      ? `Saved: you'll get tips and offers by email${r.value.updatedAt ? ` (from ${shortDate(r.value.updatedAt)})` : ''}. Turn this off at any time.`
      : 'Saved: no tips or offers by email. Emails about your account are not affected.');
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tips and offers by email</CardTitle>
        <CardDescription>Emails about your account and tasks don't depend on this.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <label htmlFor="marketing-consent-switch" className="text-sm">{CONSENT_TEXT}</label>
          <Switch id="marketing-consent-switch" checked={on} disabled={busy || missing} onCheckedChange={(v) => void change(v)} />
        </div>
        <p aria-live="polite" className="text-sm text-muted-foreground" data-testid="consent-announce">{said}</p>
      </CardContent>
    </Card>
  );
}
