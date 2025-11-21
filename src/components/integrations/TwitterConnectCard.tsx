import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Twitter, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOAuthConnect } from '@/hooks/useOAuthConnect';

interface Props {
  userId: string;
}

const TwitterConnectCard = ({ userId }: Props) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<any>(null);
  const { initiateOAuth } = useOAuthConnect();

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_integrations_safe', { p_user_id: userId });

      if (!error && data) {
        const integration = data.find(
          (int: any) => int.integration_name === 'twitter'
        );
        
        if (integration?.is_connected) {
          setConnected(true);
          setUserInfo(integration.metadata);
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
  }, [userId]);

  const handleConnect = async () => {
    await initiateOAuth({
      provider: 'twitter',
      redirectPath: '/settings?integration=twitter',
    });
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('user_id', userId)
        .eq('integration_name', 'twitter');

      if (!error) {
        setConnected(false);
        setUserInfo(null);
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-xl flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        <Twitter className="w-8 h-8 text-blue-400" />
        <div>
          <h3 className="text-lg font-semibold">Twitter</h3>
          <p className="text-sm text-muted-foreground">
            {connected && userInfo?.screen_name
              ? `Connected as @${userInfo.screen_name}`
              : 'Not Connected'}
          </p>
        </div>
      </div>
      {connected ? (
        <Button variant="destructive" onClick={handleDisconnect} disabled={loading}>
          <XCircle className="mr-2 w-4 h-4" /> Disconnect
        </Button>
      ) : (
        <Button onClick={handleConnect} disabled={loading}>
          <Twitter className="mr-2 w-4 h-4" /> Connect
        </Button>
      )}
    </div>
  );
};

export default TwitterConnectCard;
