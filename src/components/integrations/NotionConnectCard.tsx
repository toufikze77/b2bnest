import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOAuthConnect } from '@/hooks/useOAuthConnect';
import { toast } from 'sonner';
import { IntegrationCard } from './IntegrationCard';
import { ConnectionModal } from './ConnectionModal';

interface Props {
  userId: string;
}

const NotionConnectCard = ({ userId }: Props) => {
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
        const notionIntegration = data.find(
          integration => integration.integration_name === 'notion'
        );
        
        if (notionIntegration?.is_connected) {
          setConnected(true);
          if (notionIntegration.metadata) {
            const metadata = typeof notionIntegration.metadata === 'string' 
              ? JSON.parse(notionIntegration.metadata) 
              : notionIntegration.metadata;
            setUserInfo({ email: metadata?.user_email, name: metadata?.workspace_name });
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
      console.error('Error checking Notion connection status:', error);
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
        provider: 'notion',
        redirectPath: '/business-tools?integration=notion',
      });
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect Notion');
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
        .eq('integration_name', 'notion');

      if (!error) {
        setConnected(false);
        setUserInfo(null);
        toast.success('Notion disconnected successfully');
      }
    } catch (error) {
      console.error('Error disconnecting Notion:', error);
      toast.error('Failed to disconnect Notion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <IntegrationCard
        icon={FileText}
        title="Notion"
        description="Connect your Notion workspace to sync data and automate workflows"
        connected={connected}
        loading={loading}
        userInfo={userInfo}
        onConnect={() => setShowModal(true)}
        onDisconnect={handleDisconnect}
        docsUrl="https://developers.notion.com/"
      />
      
      <ConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        provider="notion"
        onConnect={handleConnect}
      />
    </>
  );
};

export default NotionConnectCard;
