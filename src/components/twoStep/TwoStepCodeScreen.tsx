import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAssurance } from '@/hooks/useAssurance';
import { cleanCode, codeErrorMessage, TWO_STEP_LOST_PHONE } from '@/lib/twoStep';

/**
 * The second step after the password (Phase 25). Shown instead of the whole app while the session is at aal1 and the
 * account has an authenticator app. Supabase checks the code (challenge + verify); nothing is checked here.
 */
export default function TwoStepCodeScreen() {
  const { signOut, user } = useAuth();
  const { verified, refresh } = useAssurance();
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState(verified[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || !factorId) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (err) {
      setCode('');
      setError(codeErrorMessage(err as { message?: string; status?: number; code?: string }));
      return;
    }
    await refresh();
  };

  const differentAccount = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <main className="flex min-h-screen items-start justify-center bg-background px-4 py-16 sm:items-center" data-testid="two-step-code-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <CardTitle>Enter your 6-digit code</CardTitle>
          <CardDescription>
            Open your authenticator app{user?.email ? ` for ${user.email}` : ''} and type the code it shows for B2BNEST.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            {verified.length > 1 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Which app?</legend>
                {verified.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="factor" value={f.id} checked={factorId === f.id} onChange={() => setFactorId(f.id)} />
                    {f.friendly_name || 'Authenticator app'}
                  </label>
                ))}
              </fieldset>
            )}
            <div className="space-y-2">
              <Label htmlFor="two-step-code">Code</Label>
              <Input
                id="two-step-code"
                value={code}
                onChange={(e) => { setCode(cleanCode(e.target.value)); setError(null); }}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={11}
                autoFocus
               
                aria-invalid={!!error}
                aria-describedby={error ? 'two-step-error' : undefined}
                className="text-center font-mono text-2xl tracking-[0.4em]"
              />
              {error && <p id="two-step-error" role="alert" className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">{TWO_STEP_LOST_PHONE}</p>
          <Button variant="link" className="mt-2 h-auto px-0" onClick={differentAccount}>Use a different account</Button>
        </CardContent>
      </Card>
    </main>
  );
}
