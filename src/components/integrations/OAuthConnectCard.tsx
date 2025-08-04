'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, PlugZap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  provider: 'google' | 'notion' | 'trello';
  userId: string;
}

const PROVIDER_LABELS = {
  google: 'Google Calendar',
  notion: 'Notion',
  trello: 'Trello',
};

const OAuthConnectCard = ({ provider, userId }: Props) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnectionStatus();
  }, [provider, userId]);

  const checkConnectionStatus = async () => {
    try {
      const integrationName = provider === 'google' ? 'google_calendar' : provider;
      const { data, error } = await supabase
        .from('user_integrations')
        .select('access_token, is_connected')
        .eq('user_id', userId)
        .eq('integration_name', integrationName)
        .maybeSingle();

      if (!error && data?.access_token) {
        setConnected(true);
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const baseUrl = 'https://gvftvswyrevummbvyhxa.supabase.co/functions/v1';
    const functionName = provider === 'google' ? 'oauth-google-calendar' : `oauth-${provider}`;
    window.location.href = `${baseUrl}/${functionName}?state=${user.id}`;
  };

  return (
    <div className="p-4 border rounded-xl flex items-center justify-between shadow-md">
      <div>
        <h3 className="text-lg font-semibold">{PROVIDER_LABELS[provider]}</h3>
        <p className="text-sm text-muted-foreground">
          {connected ? 'Connected' : 'Not Connected'}
        </p>
      </div>
      <Button
        variant={connected ? 'secondary' : 'default'}
        disabled={loading || connected}
        onClick={handleConnect}
      >
        {connected ? <CheckCircle2 className="mr-2 w-4 h-4" /> : <PlugZap className="mr-2 w-4 h-4 animate-pulse" />} 
        {connected ? 'Connected' : 'Connect'}
      </Button>
    </div>
  );
};

export default OAuthConnectCard;