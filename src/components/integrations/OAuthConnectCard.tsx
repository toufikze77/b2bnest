'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, PlugZap, XCircle } from 'lucide-react';
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

  const fetchStatus = async () => {
    try {
      const integrationName = provider === 'google' ? 'google_calendar' : provider;
      const { data, error } = await supabase
        .rpc('get_user_integrations_safe', { p_user_id: userId });

      if (!error && data) {
        const integration = data.find(
          int => int.integration_name === integrationName
        );
        
        if (integration?.is_connected) {
          setConnected(true);
        } else {
          setConnected(false);
        }
      } else {
        setConnected(false);
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [provider, userId]);

  const handleConnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const baseUrl = 'https://gvftvswyrevummbvyhxa.supabase.co/functions/v1';
    const functionName = provider === 'google' ? 'oauth-google-calendar' : `oauth-${provider}`;
    window.location.href = `${baseUrl}/${functionName}?state=${user.id}`;
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const integrationName = provider === 'google' ? 'google_calendar' : provider;
      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('user_id', userId)
        .eq('integration_name', integrationName);

      if (!error) {
        setConnected(false);
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-xl flex items-center justify-between shadow-md">
      <div>
        <h3 className="text-lg font-semibold">{PROVIDER_LABELS[provider]}</h3>
        <p className="text-sm text-muted-foreground">
          {connected ? 'Connected' : 'Not Connected'}
        </p>
      </div>
      {connected ? (
        <Button variant="destructive" onClick={handleDisconnect} disabled={loading}>
          <XCircle className="mr-2 w-4 h-4" /> Disconnect
        </Button>
      ) : (
        <Button onClick={handleConnect} disabled={loading}>
          <PlugZap className="mr-2 w-4 h-4 animate-pulse" /> Connect
        </Button>
      )}
    </div>
  );
};

export default OAuthConnectCard;