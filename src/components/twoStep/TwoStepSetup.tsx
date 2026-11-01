import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Factor } from '@supabase/supabase-js';
import { Copy, Loader2, ShieldCheck, ShieldOff, Smartphone, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAssurance } from '@/hooks/useAssurance';
import {
  cleanCode, codeErrorMessage, TWO_STEP_APPS, TWO_STEP_BACKUP_TIP, TWO_STEP_EXPLAINER, TWO_STEP_LOST_PHONE, TWO_STEP_OFF, TWO_STEP_ON,
} from '@/lib/twoStep';

type Pending = { id: string; qr: string; secret: string; name: string };
type AuthErr = { message?: string; status?: number; code?: string };

const uniqueName = (base: string, factors: readonly Factor[]) => {
  const used = new Set(factors.map((f) => f.friendly_name));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base} ${i}`)) return `${base} ${i}`;
};
const added = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Settings → Security: set up an authenticator app (Phase 25). Supabase makes the secret and checks every code; this
 * screen only shows the QR code Supabase returns and passes the typed code back. "On" only with a verified factor.
 */
export default function TwoStepSetup({ onEnabled }: { onEnabled?: () => void }) {
  const { verified, factors, refresh, loading } = useAssurance();
  const { toast } = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Factor | null>(null);
  const [removeCode, setRemoveCode] = useState('');
  const [removeError, setRemoveError] = useState<string | null>(null);
  const cleaned = useRef(false);
  const on = verified.length > 0;

  // Half-finished set-ups (scanned but never confirmed) are removed so they never linger or count as "on".
  useEffect(() => {
    if (loading || cleaned.current || pending) return;
    const stale = factors.filter((f) => f.status !== 'verified');
    if (stale.length === 0) return;
    cleaned.current = true;
    void Promise.all(stale.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id }))).then(() => refresh());
  }, [loading, factors, pending, refresh]);

  const start = async () => {
    setBusy(true);
    setError(null);
    const friendlyName = uniqueName(name.trim() || (on ? 'Backup phone' : 'Authenticator app'), factors);
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName });
    setBusy(false);
    if (err || !data) {
      setError(err?.message || "We couldn't start the set-up. Please try again.");
      return;
    }
    setPending({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret, name: friendlyName });
    setCode('');
  };

  const cancel = async () => {
    if (pending) await supabase.auth.mfa.unenroll({ factorId: pending.id });
    setPending(null);
    setCode('');
    setError(null);
    await refresh();
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!pending || code.length !== 6) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: pending.id, code });
    setBusy(false);
    if (err) {
      setCode('');
      setError(codeErrorMessage(err as AuthErr));
      return;
    }
    setPending(null);
    setName('');
    await refresh();
    toast({ title: 'Two-step sign-in is on', description: 'From now on you will be asked for a code from your app when you sign in.' });
    onEnabled?.();
  };

  // Removing an app always needs a fresh code first (the session is then at aal2, which Supabase requires).
  const confirmRemove = async (e: FormEvent) => {
    e.preventDefault();
    if (!removing || removeCode.length !== 6) return;
    setBusy(true);
    setRemoveError(null);
    const proof = verified.find((f) => f.id === removing.id) ?? verified[0];
    const check = await supabase.auth.mfa.challengeAndVerify({ factorId: proof.id, code: removeCode });
    if (check.error) {
      setBusy(false);
      setRemoveCode('');
      setRemoveError(codeErrorMessage(check.error as AuthErr));
      return;
    }
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: removing.id });
    setBusy(false);
    if (err) {
      setRemoveError(err.message || "We couldn't remove it. Please try again.");
      return;
    }
    setRemoving(null);
    setRemoveCode('');
    await refresh();
    toast({ title: 'Removed', description: verified.length > 1 ? 'Your other app still works.' : 'Two-step sign-in is now off.' });
  };

  return (
    <Card data-testid="two-step-card">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Two-step sign-in</CardTitle>
          {!loading && (
            <Badge variant={on ? 'default' : 'outline'} className="gap-1" data-testid="two-step-status">
              {on ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
              {on ? TWO_STEP_ON : TWO_STEP_OFF}
            </Badge>
          )}
        </div>
        <CardDescription>{TWO_STEP_EXPLAINER}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking…</p>}

        {!loading && verified.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border" aria-label="Your authenticator apps">
            {verified.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{f.friendly_name || 'Authenticator app'}</span>
                  <span className="shrink-0 text-muted-foreground">· added {added(f.created_at)}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => { setRemoving(f); setRemoveCode(''); setRemoveError(null); }} aria-label={`Remove ${f.friendly_name || 'authenticator app'}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {!loading && verified.length === 1 && !pending && (
          <p className="text-sm text-muted-foreground" data-testid="two-step-backup-tip">{TWO_STEP_BACKUP_TIP}</p>
        )}

        {!loading && !pending && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="two-step-name" className="text-xs text-muted-foreground">Name (so you can tell your phones apart)</Label>
              <Input id="two-step-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={on ? 'Backup phone' : 'My phone'} className="w-56 max-w-full" />
            </div>
            <Button onClick={start} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {on ? 'Add a backup phone' : 'Set up an authenticator app'}
            </Button>
          </div>
        )}

        {pending && (
          <form onSubmit={confirm} className="space-y-4 rounded-md border border-border p-4" data-testid="two-step-enrol">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Install a free authenticator app on your phone: {TWO_STEP_APPS}.</li>
              <li>In the app, add an account and scan this QR code.</li>
              <li>Type the 6-digit code the app shows.</li>
            </ol>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <img src={pending.qr} alt="QR code to scan with your authenticator app" width={176} height={176} className="h-44 w-44 rounded-md border border-border bg-white p-2" />
              <div className="min-w-0 space-y-2 text-sm">
                <p className="text-muted-foreground">Can't scan? Type this key into the app instead:</p>
                <div className="flex items-center gap-2">
                  <code className="break-all rounded bg-muted px-2 py-1 font-mono text-xs" data-testid="two-step-secret">{pending.secret}</code>
                  <Button type="button" size="icon" variant="ghost" aria-label="Copy the key"
                    onClick={() => { void navigator.clipboard?.writeText(pending.secret).catch(() => {}); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Keep this key private. It is shown only now.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="two-step-enrol-code">6-digit code from the app</Label>
              <Input id="two-step-enrol-code" value={code} onChange={(e) => { setCode(cleanCode(e.target.value)); setError(null); }}
                inputMode="numeric" autoComplete="one-time-code" maxLength={11}
                className="w-40 text-center font-mono text-lg tracking-[0.3em]" aria-invalid={!!error} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || code.length !== 6}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Turn on</Button>
              <Button type="button" variant="outline" onClick={cancel} disabled={busy}>Cancel</Button>
            </div>
          </form>
        )}

        {!pending && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">{TWO_STEP_LOST_PHONE}</p>
      </CardContent>

      <Dialog open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        <DialogContent>
          <form onSubmit={confirmRemove}>
            <DialogHeader>
              <DialogTitle>Remove {removing?.friendly_name || 'this app'}?</DialogTitle>
              <DialogDescription>
                {verified.length > 1
                  ? 'Your other app keeps working. To confirm it is you, enter a current code from this app.'
                  : 'Two-step sign-in will be off: signing in will need only your password. To confirm it is you, enter a current code from this app.'}
              </DialogDescription>
            </DialogHeader>
            <div className="my-4 space-y-2">
              <Label htmlFor="two-step-remove-code">6-digit code</Label>
              <Input id="two-step-remove-code" value={removeCode} onChange={(e) => { setRemoveCode(cleanCode(e.target.value)); setRemoveError(null); }}
                inputMode="numeric" autoComplete="one-time-code" maxLength={11} className="w-40 text-center font-mono tracking-[0.3em]" />
              {removeError && <p role="alert" className="text-sm text-destructive">{removeError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRemoving(null)}>Keep it</Button>
              <Button type="submit" variant="destructive" disabled={busy || removeCode.length !== 6}>Remove</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
