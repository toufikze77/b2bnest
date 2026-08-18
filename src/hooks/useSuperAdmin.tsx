import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Checks super admin status against the database (RLS + security definer enforced).
 * The frontend check is only for UX — every admin query is authorised server-side.
 */
export function useSuperAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) {
        if (!cancelled) {
          setIsSuperAdmin(false);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await (supabase as any).rpc('is_super_admin', { _user_id: user.id });
      if (!cancelled) {
        setIsSuperAdmin(!error && data === true);
        setLoading(false);
      }
    };
    if (!authLoading) check();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isSuperAdmin, loading: loading || authLoading };
}
