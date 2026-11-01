import { createContext, useContext } from 'react';
import type { Factor } from '@supabase/supabase-js';

/**
 * Two-step sign-in state for the signed-in session (Phase 25), shared by the app lock (TwoStepGate), ProtectedRoute,
 * the Admin layout, Settings → Security and the banner.
 *
 * It is re-checked for every new session token (sign-in, page reload, token refresh, after a code is verified), and
 * `loading` is true from the very render in which a new token appears, so no protected screen can show for a moment
 * before the check finishes.
 */
export interface AssuranceState {
  loading: boolean;
  /** Could not read the assurance level: the app stays locked with Retry / Sign out. */
  error: string | null;
  currentLevel: string | null;
  nextLevel: string | null;
  /** Password only, but the account has an authenticator app: the code is needed before anything else. */
  needsCode: boolean;
  /** All authenticator-app factors, including half-finished (unverified) set-ups. */
  factors: Factor[];
  /** Verified authenticator apps only. Two-step sign-in is "On" only when this is not empty. */
  verified: Factor[];
  refresh: () => Promise<void>;
}

export const signedOutAssurance: Omit<AssuranceState, 'refresh'> = {
  loading: false, error: null, currentLevel: null, nextLevel: null, needsCode: false, factors: [], verified: [],
};

export const AssuranceContext = createContext<AssuranceState | null>(null);

export function useAssurance(): AssuranceState {
  const ctx = useContext(AssuranceContext);
  if (!ctx) throw new Error('useAssurance must be used within an AssuranceProvider');
  return ctx;
}
