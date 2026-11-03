// Phase 38: the Business Tools that are free for everyone: signed-out visitors, accounts with no plan, trial-ended and
// suspended accounts, and paying accounts. One list, used by Business Tools (badges, Free filter, no sign-in or upgrade
// prompt) and by the access gate (these tools stay open after a trial ends or when an account is suspended).
// They keep their data in the browser only.
export const FREE_TOOL_IDS = [
  'notepro', 'coupon-generator', 'qr-code-generator', 'currency-converter', 'business-resources',
  'roi-calculator', 'goal-tracker', 'customer-survey-builder', 'cost-calculator', 'setup-checklist', 'compliance', 'best-practices',
] as const;
export type FreeToolId = typeof FREE_TOOL_IDS[number];
export const isFreeTool = (id: string | null | undefined): id is FreeToolId => !!id && (FREE_TOOL_IDS as readonly string[]).includes(id);

/** Free tools that open inside /business-tools?tool=… with no account (NotePro saves to the account, so it is not one). */
export const OPEN_FREE_TOOL_IDS = FREE_TOOL_IDS.filter((t) => t !== 'notepro');
/** /business-tools?tool=<an open free tool>. */
export function isOpenFreeToolLocation(pathname: string, search: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path !== '/business-tools') return false;
  const tool = new URLSearchParams(search).get('tool');
  return !!tool && (OPEN_FREE_TOOL_IDS as readonly string[]).includes(tool);
}

export const BROWSER_ONLY_NOTE = 'Saved in this browser only. Clearing your browser data removes it, and it does not appear on your other devices.';

/**
 * Phase 39: /business-tools itself (the list of tools, no tool chosen). Trial-ended accounts and accounts with no plan
 * may open it to reach the free tools; paid tools still open the trial-ended screen. Suspended accounts don't get it.
 */
export function isFreeToolsOverview(pathname: string, search: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path !== '/business-tools') return false;
  const tool = new URLSearchParams(search).get('tool');
  return !tool || tool === 'overview';
}
