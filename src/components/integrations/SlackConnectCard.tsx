'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, PlugZap, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  userId: string;
}

const SlackConnectCard = ({ userId }: Props) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_integrations')
        .select('access_token, is_connected, metadata')
        .eq('user_id', userId)
        .eq('integration_name', 'slack')
        .maybeSingle();

      if (!error && data?.access_token) {
        setConnected(true);
        if (data.metadata) {
          const metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
          setTeamName(metadata?.team_name || null);
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

  const handleConnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    if (!user || !session) return;

    const baseUrl = 'https://gvftvswyrevummbvyhxa.supabase.co/functions/v1';
    window.location.href = `${baseUrl}/oauth-slack?state=${user.id}&access_token=${session.access_token}`;
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