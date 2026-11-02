import { Link } from 'react-router-dom';
import { useAccess } from '@/hooks/useAccess';
import { CHOOSE_PLAN_FIRST, TOPUP_BILLING_PATH, topupOffer } from '@/lib/aiTopups';

const LINK = 'font-medium text-primary underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring';

/**
 * Phase 37: what to offer someone without enough AI credits. A subscriber on their own plan (or an owner / master
 * account) can top up; a trial user is told to choose a plan first; a company member compares plans as before.
 * While access is unknown, the old "Compare plans" link is shown (the server decides who may buy in any case).
 */
export default function OutOfCreditsAction({ className }: { className?: string }) {
  const access = useAccess();
  if (access.loading || access.state === 'unknown') return <Link to="/pricing" className={`${LINK} ${className ?? ''}`}>Compare plans</Link>;
  const offer = topupOffer(access, false);
  if (offer === 'buy') {
    return (
      <span className={className}>
        <Link to={TOPUP_BILLING_PATH} className={LINK}>Top up AI credits</Link>{' or '}
        <Link to="/pricing" className={LINK}>Compare plans</Link>
      </span>
    );
  }
  if (offer === 'plan_first') {
    return <span className={className} data-testid="choose-plan-first">{CHOOSE_PLAN_FIRST} <Link to="/pricing" className={LINK}>View plans</Link></span>;
  }
  return <Link to="/pricing" className={`${LINK} ${className ?? ''}`}>Compare plans</Link>;
}
