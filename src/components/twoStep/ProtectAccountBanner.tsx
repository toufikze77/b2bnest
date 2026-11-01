import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTwoStepRequirement } from '@/hooks/useTwoStepRequirement';
import { bannerSnoozed, snoozeBanner } from '@/lib/twoStep';

/**
 * Phase 25: company owners and admins without an authenticator app are asked to protect their account. Not required
 * (owner decision); "Remind me later" hides it for 7 days in this browser. Never shown to signed-out visitors.
 */
export default function ProtectAccountBanner() {
  const { user } = useAuth();
  const { loading, showBanner } = useTwoStepRequirement();
  const [hidden, setHidden] = useState(() => bannerSnoozed());
  if (!user || loading || !showBanner || hidden) return null;
  return (
    <div role="status" data-testid="protect-account-banner"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border bg-warning/15 px-4 py-2 text-sm text-foreground">
      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="font-medium">Protect your account: turn on two-step sign-in with an authenticator app.</span>
      <Link to="/settings?tab=security" className="font-semibold text-brand-blue underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
        Set it up
      </Link>
      <button type="button" onClick={() => { snoozeBanner(); setHidden(true); }}
        className="inline-flex items-center gap-1 rounded-control px-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
        <X className="h-3.5 w-3.5" aria-hidden="true" />Remind me in 7 days
      </button>
    </div>
  );
}
