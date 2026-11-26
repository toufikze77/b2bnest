'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { googleCalendarConnected, syncNow } from '@/lib/calendarSync';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarCheck, BookText, TrelloIcon, PlugZap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Google Calendar "Sync now" (docs/google-calendar-sync/README.md): every task of the signed-in person, then
 * "Synced 3, updated 1, removed 0" or the error. onlyWhenConnected: shown only when Google Calendar is connected.
 */
export function SyncToCalendarButton({ onlyWhenConnected = false, onReconnectNeeded }: { userId?: string; onlyWhenConnected?: boolean; onReconnectNeeded?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [visible, setVisible] = useState(!onlyWhenConnected);

  useEffect(() => {
    if (!onlyWhenConnected) return undefined;
    let live = true;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const id = session?.user?.id;
      const on = id ? await googleCalendarConnected(id) : false;
      if (live) setVisible(on);
    })().catch(() => { if (live) setVisible(false); });
    return () => { live = false; };
  }, [onlyWhenConnected]);

  if (!visible) return null;
  const handleSync = async () => {
    setLoading(true);
    setMessage(null);
    const r = await syncNow();
    setLoading(false);
    setMessage({ ok: r.ok, text: r.text });
    if (r.ok) toast.success(r.text); else toast.error(r.text);
    // The connection was marked not connected by the function: the card shows Connect again.
    if (!r.ok && 'reconnect' in r && r.reconnect) onReconnectNeeded?.();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => { void handleSync(); }} disabled={loading} className="flex items-center gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
        {loading ? 'Syncing…' : 'Sync now'}
      </Button>
      {message && <span role="status" className={message.ok ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>{message.text}</span>}
    </div>
  );
}

export function SyncToNotionButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('notion-sync', {
        body: { user_id: userId, action: 'sync_tasks' }
      });

      if (data?.success && !error) setSynced(true);
    } catch (error) {
      console.error('Sync failed:', error);
    }
    setLoading(false);
  };

  return (
    <Button onClick={handleSync} disabled={loading || synced} className="flex items-center gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookText className="w-4 h-4" />}
      {synced ? 'Synced to Notion' : 'Sync to Notion'}
    </Button>
  );
}

export function SyncToTrelloButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trello-import', {
        body: { user_id: userId, action: 'sync_tasks' }
      });

      if (data?.success && !error) setSynced(true);
    } catch (error) {
      console.error('Sync failed:', error);
    }
    setLoading(false);
  };

  return (
    <Button onClick={handleSync} disabled={loading || synced} className="flex items-center gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrelloIcon className="w-4 h-4" />}
      {synced ? 'Synced to Trello' : 'Sync to Trello'}
    </Button>
  );
}

export function ConnectIntegrationButton({ provider }: { provider: 'google' | 'notion' | 'trello' }) {
  const handleConnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const baseUrl = 'https://gvftvswyrevummbvyhxa.supabase.co/functions/v1';
    const functionName = provider === 'google' ? 'oauth-google-calendar' : `oauth-${provider}`;
    window.location.href = `${baseUrl}/${functionName}?state=${user.id}`;
  };

  const icon = {
    google: <CalendarCheck className="w-4 h-4" />,
    notion: <BookText className="w-4 h-4" />,
    trello: <TrelloIcon className="w-4 h-4" />,
  }[provider];

  return (
    <Button onClick={handleConnect} className="flex items-center gap-2">
      <PlugZap className="w-4 h-4" /> Connect {provider.charAt(0).toUpperCase() + provider.slice(1)}
    </Button>
  );
}