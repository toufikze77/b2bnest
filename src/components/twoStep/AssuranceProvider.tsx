import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AssuranceContext, signedOutAssurance, type AssuranceState } from '@/hooks/useAssurance';
import { needsCode, verifiedTotp } from '@/lib/twoStep';

/** Provides useAssurance() (src/hooks/useAssurance.ts): the two-step sign-in state of the current session (Phase 25). */
type Result = Omit<AssuranceState, 'refresh' | 'loading'> & { key: string };

export function AssuranceProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const key = user ? `${user.id}:${session?.access_token ?? ''}` : '';
  const [result, setResult] = useState<Result | null>(null);
  const latest = useRef(key);
  latest.current = key;

  const check = useCallback(async (forKey: string) => {
    try {
      const [aal, list] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      if (aal.error) throw aal.error;
      const currentLevel = aal.data?.currentLevel ?? null;
      const nextLevel = aal.data?.nextLevel ?? null;
      // The level comes from the session itself; the factor list is a network call. Without the list the code screen
      // can't work, so that failure only blocks when a code is needed.
      if (list.error && needsCode(currentLevel, nextLevel)) throw list.error;
      const factors = (list.data?.all ?? []).filter((f) => f.factor_type === 'totp');
      if (latest.current !== forKey) return;
      setResult({
        key: forKey, error: null, currentLevel, nextLevel, factors, verified: verifiedTotp(factors),
        needsCode: needsCode(currentLevel, nextLevel),
      });
    } catch (e) {
      if (latest.current !== forKey) return;
      setResult({ ...signedOutAssurance, key: forKey, error: e instanceof Error ? e.message : 'Could not check two-step sign-in' });
    }
  }, []);

  useEffect(() => {
    if (key) void check(key);
  }, [key, check]);

  const refresh = useCallback(() => check(latest.current), [check]);

  const value = useMemo<AssuranceState>(() => {
    if (!key) return { ...signedOutAssurance, refresh };
    if (!result || result.key !== key) return { ...signedOutAssurance, loading: true, refresh };
    return {
      loading: false, error: result.error, currentLevel: result.currentLevel, nextLevel: result.nextLevel,
      needsCode: result.needsCode, factors: result.factors, verified: result.verified, refresh,
    };
  }, [key, result, refresh]);

  return <AssuranceContext.Provider value={value}>{children}</AssuranceContext.Provider>;
}
