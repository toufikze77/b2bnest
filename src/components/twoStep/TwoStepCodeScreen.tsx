import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAssurance } from '@/hooks/useAssurance';
import { byCreation, cleanCode, codeErrorMessage, DEFAULT_FACTOR_NAME, shownFactorName, TWO_STEP_LOST_PHONE } from '@/lib/twoStep';

/**
 * The second step after the password (Phase 25). Shown instead of the whole app while the session is at aal1 and the
 * account has an authenticator app. Supabase checks the code (challenge + verify); nothing is checked here.
 * Asks for the main authenticator only (the oldest verified factor, by created_at, never by name). Other verified
 * factors are offered only after "Use a backup authenticator instead" is pressed, one at a time.
 */
export default function TwoStepCodeScreen() {
  const { signOut, user } = useAuth();
  const { verified, refresh } = useAssurance();
  const navigate = useNavigate();
  const ordered = byCreation(verified);
  const [index, setIndex] = useState(0);
  const factor = ordered[index] ?? ordered[0];
  const factorId = factor?.id ?? '';
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);
  const switched = useRef(false);
  useEffect(() => { if (switched.current) codeRef.current?.focus(); }, [index]);

  const switchTo = (i: number) => {
    const f = ordered[i];
    if (!f) return;
    switched.current = true;
    setIndex(i);
    setCode('');
    setError(null);
    setAnnounce(i === 0 ? 'Now using your main authenticator.' : `Now using your backup: ${f.friendly_name?.trim() || DEFAULT_FACTOR_NAME}.`);
  };
  const name = factor ? shownFactorName(factor) : null;

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
            Open your {index > 0 ? 'backup ' : ''}authenticator app{user?.email ? ` for ${user.email}` : ''} and type the code it shows for B2BNEST.
          </CardDescription>
          {(name || index > 0) && (
            <p className="text-sm text-muted-foreground" data-testid="two-step-factor-name">
              {index > 0 ? 'Backup: ' : ''}{name ?? DEFAULT_FACTOR_NAME}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
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
                ref={codeRef}
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
          <p aria-live="polite" className="sr-only" data-testid="two-step-announce">{announce}</p>
          {ordered.length > 1 && (
            <div className="mt-4 flex flex-col items-start gap-1" data-testid="two-step-alternatives">
              {index === 0 ? (
                <Button type="button" variant="link" className="h-auto px-0" onClick={() => switchTo(1)}>Use a backup authenticator instead</Button>
              ) : (
                <>
                  <Button type="button" variant="link" className="h-auto px-0" onClick={() => switchTo(0)}>Use my main authenticator instead</Button>
                  {ordered.length > 2 && (
                    <Button type="button" variant="link" className="h-auto px-0" onClick={() => switchTo(index + 1 < ordered.length ? index + 1 : 1)}>Use another backup authenticator</Button>
                  )}
                </>
              )}
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">{TWO_STEP_LOST_PHONE}</p>
          <Button variant="link" className="mt-2 h-auto px-0" onClick={differentAccount}>Use a different account</Button>
        </CardContent>
      </Card>
    </main>
  );
}
