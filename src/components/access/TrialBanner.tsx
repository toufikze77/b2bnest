import { Link } from 'react-router-dom';
import { useAccess } from '@/hooks/useAccess';
import { trialBannerText } from '@/lib/access';

/** "Free trial: N days left" on the app shell, with a link to the plans. Shown only during a trial. */
export default function TrialBanner() {
  const access = useAccess();
  const text = access.loading ? null : trialBannerText(access);
  if (!text) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border bg-brand-blue/10 px-4 py-2 text-sm text-foreground">
      <span className="font-medium">{text}</span>
      <Link to="/pricing" className="font-semibold text-brand-blue underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
        Choose a plan
      </Link>
    </div>
  );
}
