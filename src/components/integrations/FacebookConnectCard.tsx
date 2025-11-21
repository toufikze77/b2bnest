import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOAuthConnect } from '@/hooks/useOAuthConnect';

interface Props {
  userId: string;
}

const FacebookConnectCard = ({ userId }: Props) => {
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
          (int: any) => int.integration_name === 'facebook'
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
      provider: 'facebook',
      redirectPath: '/settings?integration=facebook',
      scope: 'pages_manage_posts,pages_read_engagement',
    });
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_integrations')
        .delete()
        .eq('user_id', userId)
        .eq('integration_name', 'facebook');

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
        <Facebook className="w-8 h-8 text-blue-600" />
        <div>
          <h3 className="text-lg font-semibold">Facebook</h3>
          <p className="text-sm text-muted-foreground">
            {connected && userInfo?.name
              ? `Connected as ${userInfo.name}`
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
          <Facebook className="mr-2 w-4 h-4" /> Connect
        </Button>
      )}
    </div>
  );
};

export default FacebookConnectCard;
