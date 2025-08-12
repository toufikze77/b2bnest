'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useOAuthConnect } from '@/hooks/useOAuthConnect';

interface Props {
  userId: string;
}

const NotionConnectCard = ({ userId }: Props) => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { toast } = useToast();
  const { initiateOAuth } = useOAuthConnect();

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_integrations')
        .select('is_connected, metadata')
        .eq('user_id', userId)
        .eq('integration_name', 'notion')
        .maybeSingle();

      if (!error && data?.is_connected) {
        setConnected(true);
        if (data.metadata) {
          const metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
          setUserEmail(metadata?.user_email || null);
        }
      } else {
        setConnected(false);
        setUserEmail(null);
      }
    } catch (error) {
      console.error('Error checking Notion connection status:', error);
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
      provider: 'notion',
      redirectPath: 'oauth-notion',
      scope: '',
    });
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
        setUserEmail(null);
        toast({
          title: "Success",
          description: "Notion integration disconnected successfully",
        });
      }
    } catch (error) {
      console.error('Error disconnecting Notion:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
            <span className="text-white font-bold text-xs">N</span>
          </div>
          <CardTitle className="text-lg">Notion</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {connected 
              ? (userEmail ? `Connected as ${userEmail}` : 'Connected') 
              : 'Connect your Notion account to sync data and automate workflows'
            }
          </p>
          <Button
            onClick={connected ? handleDisconnect : handleConnect}
            disabled={loading}
            variant={connected ? "destructive" : "default"}
            size="sm"
          >
            {loading ? 'Processing...' : (connected ? 'Disconnect' : 'Connect')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotionConnectCard;