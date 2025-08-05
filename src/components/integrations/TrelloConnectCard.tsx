'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trello, PlugZap, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  userId: string;
}

const TrelloConnectCard = ({ userId }: Props) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<{ username?: string; fullName?: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_integrations')
        .select('access_token, is_connected, metadata')
        .eq('user_id', userId)
        .eq('integration_name', 'trello')
        .maybeSingle();

      if (!error && data?.access_token) {
        setConnected(true);
        if (data.metadata) {
          const metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
          setUserInfo({
            username: metadata?.username,
            fullName: metadata?.full_name
          });
        }
      } else {
        setConnected(false);
        setUserInfo(null);
      }
    } catch (error) {
      console.error('Error checking Trello connection status:', error);
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
    if (!user) return;

    const baseUrl = 'https://gvftvswyrevummbvyhxa.supabase.co/functions/v1';
    window.location.href = `${baseUrl}/oauth-trello?state=${user.id}`;
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('user_id', userId)
        .eq('integration_name', 'trello');

      if (!error) {
        setConnected(false);
        setUserInfo(null);
      }
    } catch (error) {
      console.error('Error disconnecting Trello:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayName = userInfo?.fullName || userInfo?.username;

  return (
    <div className="p-4 border rounded-xl flex items-center justify-between shadow-md">
      <div className="flex items-center space-x-3">
        <Trello className="w-8 h-8 text-blue-500" />
        <div>
          <h3 className="text-lg font-semibold">Trello</h3>
          <p className="text-sm text-muted-foreground">
            {connected ? (displayName ? `Connected as ${displayName}` : 'Connected') : 'Not Connected'}
          </p>
        </div>
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

export default TrelloConnectCard;