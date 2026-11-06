import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { setDemoNow } from '@/lib/demoMode';
import { DemoModeContext, type DemoMode } from '@/contexts/demoModeState';

/**
 * Demo read-only: is the signed-in person view only? Read once per signed-in person from is_demo_readonly()
 * (docs/demo-readonly). If the call fails (for example before the SQL is applied) the answer is "not demo": the
 * database guard and the Edge Functions still refuse every change, so the app only loses the banner.
 */

type Rpc = (fn: string) => Promise<{ data: unknown; error: unknown }>;

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<DemoMode & { for: string | null }>({ isDemo: false, loading: false, for: null });

  useEffect(() => {
    let live = true;
    if (!userId) { setDemoNow(false); setState({ isDemo: false, loading: false, for: null }); return; }
    setState((s) => (s.for === userId ? s : { isDemo: false, loading: true, for: userId }));
    (async () => {
      let isDemo = false;
      try {
        const { data, error } = await (supabase.rpc as unknown as Rpc)('is_demo_readonly');
        isDemo = !error && data === true;
      } catch { isDemo = false; }
      if (!live) return;
      setDemoNow(isDemo);
      setState({ isDemo, loading: false, for: userId });
    })();
    return () => { live = false; };
  }, [userId]);

  return <DemoModeContext.Provider value={{ isDemo: state.isDemo, loading: state.loading }}>{children}</DemoModeContext.Provider>;
}

