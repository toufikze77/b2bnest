import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { authUrlWithNext } from '@/lib/onboarding';
import { setActiveOrganizationId } from '@/lib/activeOrganization';
import * as svc from '@/services/onboardingService';

type Preview = Awaited<ReturnType<typeof svc.previewInvitation>>;

/** Staff invitation landing: sign in (or sign up and verify), then accept with the matching verified email. */
export default function JoinCompany() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [p, setP] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !token) return;
    svc.previewInvitation(token).then(setP).catch((e) => setErr((e as Error).message));
  }, [user, token]);

  if (!loading && !user) return <Navigate to={authUrlWithNext(`/join?token=${encodeURIComponent(token)}`)} replace />;

  const accept = async () => {
    setBusy(true); setErr(null);
    try { const org = await svc.acceptInvitation(token); setActiveOrganizationId?.(org); navigate('/settings?tab=members', { replace: true }); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const msg: Record<string, string> = {
    invalid: 'This invitation link is not valid.', revoked: 'This invitation was cancelled by the company.', expired: 'This invitation has expired. Ask the company to extend it.',
    accepted: 'This invitation has already been used.', email_unverified: 'Please verify your email address first (use the link we emailed you), then open this page again.',
  };
  return (
    <div className="mx-auto max-w-lg p-6">
      <Card className="space-y-3 p-6">
        <h1 className="text-xl font-semibold">Join a company</h1>
        {!token && <p className="text-sm">This link is missing its invitation code.</p>}
        {token && !p && !err && <p className="text-sm text-muted-foreground">Checking invitation…</p>}
        {p && p.state !== 'pending' && <p className="text-sm">{msg[p.state] ?? 'This invitation cannot be used.'}</p>}
        {p && p.state === 'pending' && !p.email_matches && (
          <p className="text-sm">This invitation was sent to {p.masked_email}. You're signed in as {user?.email}. Sign out and sign in with the invited address.</p>)}
        {p && p.state === 'pending' && p.email_matches && (
          <>
            <p className="text-sm"><strong>{p.company}</strong> invited you to join as <strong className="capitalize">{p.role}</strong>.</p>
            <Button onClick={accept} disabled={busy}>Accept invitation</Button>
          </>)}
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      </Card>
    </div>
  );
}
