import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Multi-tenant safe: fetches ONLY the currently-authenticated user's avatar
 * via RLS-protected profiles row (id = auth.uid()). Never exposes other
 * tenants' images.
 */
export function useUserAvatar() {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) { setAvatarUrl(''); setDisplayName(''); return; }
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, display_name, full_name, email')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setAvatarUrl(data?.avatar_url || '');
      setDisplayName(data?.display_name || data?.full_name || data?.email || user.email || '');
    };
    load();

    // Listen for avatar updates from other components in this tab
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { userId?: string; url?: string } | undefined;
      if (detail?.userId && user && detail.userId === user.id) {
        setAvatarUrl(detail.url || '');
      }
    };
    window.addEventListener('profile-avatar-updated', handler);
    return () => { cancelled = true; window.removeEventListener('profile-avatar-updated', handler); };
  }, [user]);

  return { avatarUrl, displayName };
}
