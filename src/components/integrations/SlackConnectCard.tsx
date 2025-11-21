import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOAuthConnect } from '@/hooks/useOAuthConnect';
import { toast } from 'sonner';
import { IntegrationCard } from './IntegrationCard';
import { ConnectionModal } from './ConnectionModal';

interface Props {
  userId: string;
}

const SlackConnectCard = ({ userId }: Props) => {
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
        const slackIntegration = data.find(
          integration => integration.integration_name === 'slack'
        );
        
        if (slackIntegration?.is_connected) {
          setConnected(true);
          if (slackIntegration.metadata) {
            const metadata = typeof slackIntegration.metadata === 'string' 
              ? JSON.parse(slackIntegration.metadata) 
              : slackIntegration.metadata;
            setUserInfo({ name: metadata?.team_name, email: metadata?.team_id });
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
      console.error('Error checking Slack connection status:', error);
      setConnected(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [userId]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      await initiateOAuth({
        provider: 'slack',
        redirectPath: '/business-tools?integration=slack',
        scope: 'channels:read,chat:write,users:read',
      });
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect Slack');
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
        .eq('integration_name', 'slack');

      if (!error) {
        setConnected(false);
        setUserInfo(null);
        toast.success('Slack disconnected successfully');
      }
    } catch (error) {
      console.error('Error disconnecting Slack:', error);
      toast.error('Failed to disconnect Slack');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <IntegrationCard
        icon={MessageSquare}
        title="Slack"
        description="Connect your Slack workspace to send messages and manage channels"
        connected={connected}
        loading={loading}
        userInfo={userInfo}
        onConnect={() => setShowModal(true)}
        onDisconnect={handleDisconnect}
        docsUrl="https://api.slack.com/docs"
      />
      
      <ConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        provider="slack"
        onConnect={handleConnect}
      />
    </>
  );
};

export default SlackConnectCard;
