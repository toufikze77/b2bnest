import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAssurance } from '@/hooks/useAssurance';
import { legacyPromptDone, markLegacyPromptDone } from '@/lib/twoStep';

/**
 * Phase 25: two accounts switched on the OLD email-code setting (user_2fa_settings.is_enabled), which was never checked
 * at sign-in. They are not locked out: once, on their next sign-in, they are offered the real set-up, or "Later".
 */
export default function LegacyTwoStepPrompt() {
  const { user } = useAuth();
  const { loading, verified } = useAssurance();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user || loading || verified.length > 0 || legacyPromptDone(user.id)) return;
    (async () => {
      const { data } = await supabase.from('user_2fa_settings').select('is_enabled').eq('user_id', user.id).maybeSingle();
      if (!cancelled && data?.is_enabled) setOpen(true);
    })();
    return () => { cancelled = true; };
  }, [user, loading, verified.length]);

  if (!user) return null;
  const close = (setUp: boolean) => {
    markLegacyPromptDone(user.id);
    setOpen(false);
    if (setUp) navigate('/settings?tab=security');
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(false); }}>
      <DialogContent data-testid="legacy-two-step-prompt">
        <DialogHeader>
          <DialogTitle>Set up two-step sign-in</DialogTitle>
          <DialogDescription>
            You switched on the old two-step setting earlier, but it was never checked when you signed in. Two-step sign-in
            now works with a free authenticator app on your phone. It takes about two minutes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Later</Button>
          <Button onClick={() => close(true)}>Set up two-step sign-in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
