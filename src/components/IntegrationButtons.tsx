'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarCheck, BookText, TrelloIcon, PlugZap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function SyncToCalendarButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
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
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
      {synced ? 'Synced to Calendar' : 'Sync to Google Calendar'}
    </Button>
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