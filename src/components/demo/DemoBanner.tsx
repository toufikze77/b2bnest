import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDemoMode } from '@/contexts/demoModeState';
import { supabase } from '@/integrations/supabase/client';
import { DEMO_BANNER_TEXT, DEMO_READONLY_MESSAGE } from '@/lib/demoMode';

/** The calm "view only" banner, shown on every page while a demo person is signed in. Nothing for anyone else. */
export function DemoBanner() {
  const { isDemo } = useDemoMode();
  const navigate = useNavigate();
  if (!isDemo) return null;
  const signUp = async () => {
    // Sign out of the shared demo login on this device only, then open the free sign-up.
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* still go to sign-up */ }
    navigate('/auth?mode=signup');
  };
  return (
    <div
      role="status"
      data-testid="demo-banner"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50"
    >
      <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="font-medium">{DEMO_BANNER_TEXT}</span>
      <button
        type="button"
        onClick={signUp}
        className="font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        Sign up
      </button>
    </div>
  );
}

/** A short note in place of a control that changes something, for demo people only. */
export function DemoReadonlyNote({ what }: { what?: string }) {
  return (
    <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground" data-testid="demo-readonly-note">
      {what ? `${what}: ` : ''}{DEMO_READONLY_MESSAGE}
    </p>
  );
}

export default DemoBanner;
