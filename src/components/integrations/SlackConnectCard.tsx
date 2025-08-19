'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, PlugZap, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOAuthConnect } from '@/hooks/useOAuthConnect';

interface Props {
  userId: string;
}

const SlackConnectCard = ({ userId }: Props) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState<string | null>(null);
  const { initiateOAuth } = useOAuthConnect();

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_integrations_safe', { p_user_id: userId });

      if (!error && data) {
        const slackIntegration = data.find(
          integration => integration.integration_name === 'slack'
        );
        
        if (slackIntegration?.is_connected) {
          setConnected(true);
          if (slackIntegration.metadata) {
            const metadata = typeof slackIntegration.metadata === 'string' 
              ? JSON.parse(slackIntegration.metadata) 
              : slackIntegration.metadata;
            setTeamName(metadata?.team_name || null);
          }
        } else {
          setConnected(false);
          setTeamName(null);
        }
      } else {
        setConnected(false);
        setTeamName(null);
      }
    } catch (error) {
      console.error('Error checking Slack connection status:', error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [userId]);

  const handleConnect = () => {
    initiateOAuth({
      provider: 'slack',
      redirectPath: 'oauth-slack',
      scope: 'channels:read,chat:write,users:read',
    });
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('user_id', userId)
        .eq('integration_name', 'slack');

      if (!error) {
        setConnected(false);
        setTeamName(null);
      }
    } catch (error) {
      console.error('Error disconnecting Slack:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-xl flex items-center justify-between shadow-md">
      <div>
        <h3 className="text-lg font-semibold">Slack</h3>
        <p className="text-sm text-muted-foreground">
          {connected ? (teamName ? `Connected to ${teamName}` : 'Connected') : 'Not Connected'}
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

export default SlackConnectCard;