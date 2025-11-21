import { useEffect, useState } from 'react';
import { Trello } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOAuthConnect } from '@/hooks/useOAuthConnect';
import { toast } from 'sonner';
import { IntegrationCard } from './IntegrationCard';
import { ConnectionModal } from './ConnectionModal';

interface Props {
  userId: string;
}

const TrelloConnectCard = ({ userId }: Props) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const { initiateOAuth } = useOAuthConnect();

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_integrations_safe', { p_user_id: userId });

      if (!error && data) {
        const trelloIntegration = data.find(
          integration => integration.integration_name === 'trello'
        );
        
        if (trelloIntegration?.is_connected) {
          setConnected(true);
          if (trelloIntegration.metadata) {
            const metadata = typeof trelloIntegration.metadata === 'string' 
              ? JSON.parse(trelloIntegration.metadata) 
              : trelloIntegration.metadata;
            setUserInfo({ 
              name: metadata?.full_name || metadata?.username,
              email: metadata?.email 
            });
          }
        } else {
          setConnected(false);
          setUserInfo(null);
        }
      } else {
        setConnected(false);
        setUserInfo(null);
      }
    } catch (error) {
      console.error('Error checking Trello connection status:', error);
      setConnected(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [userId]);

  const handleConnect = async (credentials?: Record<string, string>) => {
    setLoading(true);
    try {
      if (!credentials?.apiKey || !credentials?.apiToken) {
        toast.error('Please provide both API Key and API Token');
        return;
      }

      // Store credentials in user_integrations metadata
      const { error: storeError } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: userId,
          integration_name: 'trello',
          metadata: {
            api_key: credentials.apiKey,
            api_token: credentials.apiToken,
          },
          is_connected: false,
        });

      if (storeError) throw storeError;

      await initiateOAuth({
        provider: 'trello',
        redirectPath: '/business-tools?integration=trello',
        scope: 'read,write',
        clientId: credentials.apiKey,
        clientSecret: credentials.apiToken,
      });
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect Trello');
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
        .eq('integration_name', 'trello');

      if (!error) {
        setConnected(false);
        setUserInfo(null);
        toast.success('Trello disconnected successfully');
      }
    } catch (error) {
      console.error('Error disconnecting Trello:', error);
      toast.error('Failed to disconnect Trello');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <IntegrationCard
        icon={Trello}
        title="Trello"
        description="Connect your Trello account to sync boards and manage tasks"
        connected={connected}
        loading={loading}
        userInfo={userInfo}
        onConnect={() => setShowModal(true)}
        onDisconnect={handleDisconnect}
        docsUrl="https://developer.atlassian.com/cloud/trello/"
      />
      
      <ConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        provider="trello"
        onConnect={handleConnect}
      />
    </>
  );
};

export default TrelloConnectCard;
