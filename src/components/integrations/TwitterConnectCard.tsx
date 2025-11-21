import { useEffect, useState } from 'react';
import { Twitter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { IntegrationCard } from './IntegrationCard';
import { ConnectionModal } from './ConnectionModal';

interface Props {
  userId: string;
}

const TwitterConnectCard = ({ userId }: Props) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

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
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [userId]);

  const handleConnect = async (credentials?: Record<string, string>) => {
    if (!credentials) {
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      // Store Twitter API credentials securely
      const { error } = await supabase.functions.invoke('store-twitter-credentials', {
        body: { 
          userId,
          credentials: {
            consumer_key: credentials.consumer_key,
            consumer_secret: credentials.consumer_secret,
            access_token: credentials.access_token,
            access_token_secret: credentials.access_token_secret,
          }
        }
      });

      if (error) throw error;

      toast.success('Twitter connected successfully!');
      await fetchStatus();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect Twitter');
      throw error;
    } finally {
      setLoading(false);
    }
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
        toast.success('Twitter disconnected successfully');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect Twitter');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <IntegrationCard
        icon={Twitter}
        title="Twitter"
        description="Connect your Twitter account to post tweets and manage your presence"
        connected={connected}
        loading={loading}
        userInfo={userInfo}
        onConnect={() => setShowModal(true)}
        onDisconnect={handleDisconnect}
        docsUrl="https://developer.twitter.com/en/docs"
      />
      
      <ConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        provider="twitter"
        onConnect={handleConnect}
      />
    </>
  );
};

export default TwitterConnectCard;
