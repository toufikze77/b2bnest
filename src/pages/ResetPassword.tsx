import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  cleanRecoveryUrl, clearRecoveryMark, hasRecoveryMark, initialRecoveryLink, markRecovery, mergeLinks, passwordUpdateMessage, readRecoveryLink, tokenHashFromUrl,
} from '@/lib/passwordRecovery';

type View = 'confirm' | 'checking' | 'form' | 'expired' | 'invalid' | 'home';
/** How long to wait for Supabase to finish reading a link before saying it is invalid. */
export const LINK_CHECK_MS = 6000;

// A ?code= can be exchanged only once: the exchange is shared, so a re-run of the effect (React StrictMode) waits for it.
const exchanges = new Map<string, ReturnType<typeof supabase.auth.exchangeCodeForSession>>();
const exchangeOnce = (code: string) => {
  if (!exchanges.has(code)) exchanges.set(code, supabase.auth.exchangeCodeForSession(code));
  return exchanges.get(code)!;
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <Card className="w-full max-w-md">{children}</Card>
  </div>
);

/**
 * The page a password reset email links to. Supabase signs the person in from the link (a recovery session): the
 * form shows once that has happened (the PASSWORD_RECOVERY event, or a session opened from a recovery link). A ?code=
 * (PKCE) is exchanged once. Errors from Supabase (expired or used link) get a plain message. Tokens are never shown or
 * logged, and are taken out of the address bar. Someone with two-step sign-in enters their code first (TwoStepGate).
 */
const ResetPassword = () => {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  // A scanner-proof link (?token_hash=…&type=recovery) waits for the person to press Continue: nothing is verified on
  // load, so an email scanner that only opens the page leaves the one-time token unused.
  const [view, setView] = useState<View>(() => {
    const link = readRecoveryLink(window.location.href);
    return link.hasTokenHash && !link.error ? 'confirm' : 'checking';
  });
  const [verifying, setVerifying] = useState(false);
  const verifyStarted = useRef(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (view === 'confirm') return;
    let done = false;
    const finish = (v: View) => {
      if (done) return;
      done = true;
      if (v === 'form') markRecovery();
      if (v !== 'home') cleanRecoveryUrl();
      setView(v);
    };
    const link = mergeLinks(initialRecoveryLink, readRecoveryLink(window.location.href));
    if (link.error) { finish('expired'); return; }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session && link.isRecovery)) finish('form');
    });

    (async () => {
      try {
        const code = new URLSearchParams(window.location.search).get('code');
        if (code) {
          const { data, error } = await exchangeOnce(code);
          finish(!error && data?.session ? 'form' : 'expired');
          return;
        }
        const { data } = await supabase.auth.getSession();
        const session = data?.session ?? null;
        if (session && (hasRecoveryMark() || (link.isRecovery && link.hasTokens))) { finish('form'); return; }
        // No link at all: nothing to reset here.
        if (!link.hasTokens && !link.hasCode && !link.isRecovery) finish(session ? 'home' : 'invalid');
        // Otherwise the link is still being read: wait for PASSWORD_RECOVERY (below, at most LINK_CHECK_MS).
      } catch {
        finish('invalid');
      }
    })();

    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        finish(data?.session && (hasRecoveryMark() || link.isRecovery) ? 'form' : 'invalid');
      } catch { finish('invalid'); }
    }, LINK_CHECK_MS);
    return () => { done = true; subscription.unsubscribe(); clearTimeout(timer); };
    // Runs once on load (a confirm page never starts the automatic checks).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueReset = async () => {
    if (verifyStarted.current) return; // one verification only, however many clicks
    verifyStarted.current = true;
    setVerifying(true);
    const tokenHash = tokenHashFromUrl(window.location.href);
    cleanRecoveryUrl(); // the hash leaves the address bar as soon as it has been read
    if (!tokenHash) { setView('invalid'); return; }
    try {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
      if (!error && data?.session) { markRecovery(); setView('form'); return; }
    } catch { /* shown as an expired or used link */ }
    setView('expired');
  };

  if (view === 'home') return <Navigate to="/" replace />;

  if (view === 'confirm') {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Click the button to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => { void continueReset(); }} disabled={verifying}>
            {verifying ? 'Checking your link…' : 'Continue'}
          </Button>
        </CardContent>
      </Shell>
    );
  }

  if (view === 'checking') {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Checking your link…</CardTitle>
          <CardDescription role="status">This takes a few seconds.</CardDescription>
        </CardHeader>
      </Shell>
    );
  }

  if (view === 'expired' || view === 'invalid') {
    const expired = view === 'expired';
    return (
      <Shell>
        <CardHeader>
          <CardTitle>{expired ? 'This link has expired' : 'Invalid Reset Link'}</CardTitle>
          <CardDescription data-testid="reset-link-problem">
            {expired
              ? 'This link has expired or was already used. Request a new one.'
              : 'This password reset link is invalid or has expired. Please request a new one.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {expired && (
            <p className="text-sm text-muted-foreground">Some email security scanners open links before you do, which uses them up. If that keeps happening, copy the link into your browser straight away.</p>
          )}
          <Button asChild className="w-full"><Link to="/forgot-password">Request a new link</Link></Button>
        </CardContent>
      </Shell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: 'Please make sure both passwords are the same.', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Password must be at least 6 characters long.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    if (error) {
      const m = passwordUpdateMessage(error);
      setIsSubmitting(false);
      if (m.kind === 'expired') { clearRecoveryMark(); setView('expired'); return; }
      setProblem(m.text);
      return;
    }
    // End the recovery session on this device and sign in again with the new password.
    clearRecoveryMark();
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* the session ends anyway when it expires */ }
    setIsSubmitting(false);
    navigate('/auth?reset=done', { replace: true });
  };

  return (
    <Shell>
      <CardHeader>
        <CardTitle>Reset Your Password</CardTitle>
        <CardDescription>Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={6} placeholder="Enter your new password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              required minLength={6} placeholder="Confirm your new password" />
          </div>
          {problem && (
            <p role="alert" className="text-sm text-destructive" data-testid="reset-problem">
              {problem}{' '}
              {/two-step/.test(problem) && <Link to="/help" className="font-medium underline">Help</Link>}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Updating Password...' : 'Update Password'}
          </Button>
        </form>
      </CardContent>
    </Shell>
  );
};

export default ResetPassword;
