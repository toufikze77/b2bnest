import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { callHmrcFunction, HMRC_PAGE, rememberedCompany } from '@/lib/hmrcConnection';

/**
 * HMRC P0: HMRC sends the person back here after they sign in. The code and state are read once, removed from the
 * address bar straight away, and passed to hmrc-connect-complete; they are never shown or stored.
 */
export default function HMRCCallback() {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const hmrcError = params.get('error');
    try { window.history.replaceState({}, '', window.location.pathname); } catch { /* keep going */ }
    if (hmrcError || !code || !state) {
      setResult({ ok: false, message: hmrcError === 'access_denied' ? 'You cancelled the HMRC sign-in. Nothing was connected.' : "HMRC didn't complete the sign-in. Please try connecting again." });
      return;
    }
    const company = rememberedCompany();
    void callHmrcFunction('hmrc-connect-complete', { code, state, ...(company ? { company_id: company } : {}) }).then((r) => {
      setResult(r.ok ? { ok: true, message: 'Connected to HMRC (test environment).' } : { ok: false, message: r.message ?? "HMRC didn't accept the sign-in. Please try connecting again." });
    });
  }, []);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-12">
      <Card className="w-full">
        <CardContent className="space-y-4 p-6 text-center" aria-live="polite" data-testid="hmrc-callback">
          {!result ? (
            <p className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" aria-hidden />Finishing the HMRC connection…</p>
          ) : (
            <>
              <p className="flex items-center justify-center gap-2 font-medium">
                {result.ok ? <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> : <XCircle className="h-5 w-5 text-destructive" aria-hidden />}
                {result.message}
              </p>
              <Button asChild><Link to={HMRC_PAGE}>Back to HMRC Integration</Link></Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
