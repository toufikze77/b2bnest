import { useEffect, useState } from 'react';
import { Linkedin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOAuthConnect } from '@/hooks/useOAuthConnect';
import { toast } from 'sonner';
import { IntegrationCard } from './IntegrationCard';
import { ConnectionModal } from './ConnectionModal';

interface Props {
  userId: string;
}

const LinkedInConnectCard = ({ userId }: Props) => {
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
        const integration = data.find(
          (int: any) => int.integration_name === 'linkedin'
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

  const handleConnect = async () => {
    setLoading(true);
    try {
      await initiateOAuth({
        provider: 'linkedin',
        redirectPath: '/business-tools?integration=linkedin',
        scope: 'openid profile email w_member_social',
      });
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect LinkedIn');
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
        .eq('integration_name', 'linkedin');

      if (!error) {
        setConnected(false);
        setUserInfo(null);
        toast.success('LinkedIn disconnected successfully');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect LinkedIn');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <IntegrationCard
        icon={Linkedin}
        title="LinkedIn"
        description="Connect your LinkedIn account to share professional updates and posts"
        connected={connected}
        loading={loading}
        userInfo={userInfo}
        onConnect={() => setShowModal(true)}
        onDisconnect={handleDisconnect}
        docsUrl="https://docs.microsoft.com/en-us/linkedin/"
      />
      
      <ConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        provider="linkedin"
        onConnect={handleConnect}
      />
    </>
  );
};

export default LinkedInConnectCard;
