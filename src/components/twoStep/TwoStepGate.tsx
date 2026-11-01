import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import RouteFallback from '@/components/shell/RouteFallback';
import { useAuth } from '@/hooks/useAuth';
import { useAssurance } from '@/hooks/useAssurance';
import TwoStepCodeScreen from './TwoStepCodeScreen';

/**
 * Locks the WHOLE app (every route, public or private) while a signed-in session still needs its two-step code
 * (Phase 25). Signed-out visitors and people without an authenticator app pass straight through.
 * The route underneath is kept, so /auth?next=… still sends the person on after the code is accepted.
 */
export default function TwoStepGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const assurance = useAssurance();
  const navigate = useNavigate();
  if (!user) return <>{children}</>;
  if (assurance.loading) {
    return <div className="min-h-screen bg-background" data-testid="two-step-checking"><RouteFallback /></div>;
  }
  if (assurance.error) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-4 py-24 text-center" role="alert" data-testid="two-step-check-failed">
        <p className="font-medium">We couldn't check your sign-in.</p>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => void assurance.refresh()}>Try again</Button>
          <Button variant="outline" onClick={async () => { await signOut(); navigate('/auth', { replace: true }); }}>Sign out</Button>
        </div>
      </main>
    );
  }
  if (assurance.needsCode) return <TwoStepCodeScreen />;
  return <>{children}</>;
}
