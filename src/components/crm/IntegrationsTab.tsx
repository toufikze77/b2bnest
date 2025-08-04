import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Zap,
  Calendar,
  BarChart3,
  Plus,
  Workflow,
  Webhook,
  Building,
  Target,
  ExternalLink
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  integration_name: string;
  is_connected: boolean;
  oauth_url?: string;
  requires_manual_setup?: boolean;
  icon: React.ReactNode;
  category: string;
}

const IntegrationsTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([
    { 
      id: 'zapier', 
      name: 'Zapier', 
      integration_name: 'zapier', 
      is_connected: false, 
      requires_manual_setup: true,
      icon: <Zap className="w-4 h-4 text-orange-500" />,
      category: 'automation'
    },
    { 
      id: 'make', 
      name: 'Make (Integromat)', 
      integration_name: 'make', 
      is_connected: false, 
      requires_manual_setup: true,
      icon: <Workflow className="w-4 h-4 text-blue-500" />,
      category: 'automation'
    },
    { 
      id: 'webhooks', 
      name: 'Webhooks', 
      integration_name: 'webhooks', 
      is_connected: false, 
      requires_manual_setup: true,
      icon: <Webhook className="w-4 h-4 text-purple-500" />,
      category: 'automation'
    },
    { 
      id: 'slack', 
      name: 'Slack', 
      integration_name: 'slack', 
      is_connected: false, 
      oauth_url: `https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/oauth-slack?state=${user?.id}`,
      icon: <ExternalLink className="w-4 h-4 text-purple-500" />,
      category: 'communication'
    },
    { 
      id: 'notion', 
      name: 'Notion', 
      integration_name: 'notion', 
      is_connected: false, 
      oauth_url: `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${import.meta.env.VITE_NOTION_CLIENT_ID || 'demo'}&redirect_uri=https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/oauth-notion&response_type=code&state=${user?.id}`,
      icon: <ExternalLink className="w-4 h-4 text-gray-800" />,
      category: 'productivity'
    },
    { 
      id: 'google-calendar', 
      name: 'Google Calendar', 
      integration_name: 'google_calendar', 
      is_connected: false, 
      oauth_url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${import.meta.env.VITE_GOOGLE_CLIENT_ID || 'demo'}&redirect_uri=https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/oauth-google-calendar&response_type=code&scope=https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email&access_type=offline&state=${user?.id}&prompt=consent`,
      icon: <Calendar className="w-4 h-4 text-blue-500" />,
      category: 'productivity'
    },
    { 
      id: 'trello', 
      name: 'Trello', 
      integration_name: 'trello', 
      is_connected: false, 
      oauth_url: `https://trello.com/1/authorize?response_type=code&client_id=${import.meta.env.VITE_TRELLO_CLIENT_ID || 'demo'}&redirect_uri=https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/oauth-trello&scope=read,write&expiration=never&name=BusinessForms&state=${user?.id}`,
       icon: <Target className="w-4 h-4 text-blue-600" />,
       category: 'productivity'
     }
   ]);

  useEffect(() => {
    fetchUserIntegrations();
  }, [user?.id]);

  const fetchUserIntegrations = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id);

    if (!error && data) {
      setIntegrations(prev => 
        prev.map(integration => {
          const userIntegration = data.find(ui => ui.integration_name === integration.integration_name);
          return {
            ...integration,
            is_connected: userIntegration?.is_connected || false,
          };
        })
      );
    }
  };

  const handleConnect = async (integrationId: string) => {
    const integration = integrations.find(i => i.id === integrationId);
    if (!integration || !user?.id) return;

    if (integration.oauth_url && !integration.requires_manual_setup) {
      // OAuth flow - redirect to OAuth URL
      window.location.href = integration.oauth_url;
      return;
    }

    // Manual setup or toggle for services without OAuth
    const newConnectedState = !integration.is_connected;
    
    try {
      if (newConnectedState) {
        // Connect the integration
        const { error } = await supabase
          .from('user_integrations')
          .upsert({
            user_id: user.id,
            integration_name: integration.integration_name,
            is_connected: true,
          });

        if (error) throw error;
      } else {
        // Disconnect the integration
        const { error } = await supabase
          .from('user_integrations')
          .delete()
          .eq('user_id', user.id)
          .eq('integration_name', integration.integration_name);

        if (error) throw error;
      }

      // Update local state
      setIntegrations(prev => 
        prev.map(int => 
          int.id === integrationId 
            ? { ...int, is_connected: newConnectedState }
            : int
        )
      );

      toast({
        title: newConnectedState ? "Connected" : "Disconnected",
        description: `${integration.name} has been ${newConnectedState ? "connected" : "disconnected"} successfully.`,
      });
    } catch (error) {
      console.error('Integration error:', error);
      toast({
        title: "Error",
        description: "Failed to update integration status.",
        variant: "destructive",
      });
    }
  };

  const handleAction = (action: string) => {
    toast({
      title: "Feature Available",
      description: `${action} functionality is available. Connect your preferred services to get started.`,
    });
  };

  const getIntegrationsByCategory = (category: string) => {
    return integrations.filter(int => int.category === category);
  };

  const renderIntegrationCard = (integration: Integration) => (
    <div key={integration.id} className="p-3 border rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-2">
        {integration.icon}
        <span>{integration.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge className={integration.is_connected ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
          {integration.is_connected ? "Connected" : "Available"}
        </Badge>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleConnect(integration.id)}
        >
          {integration.is_connected ? "Disconnect" : "Connect"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Workflow Automation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {getIntegrationsByCategory('automation').map(renderIntegrationCard)}
          </div>
          <Button className="w-full" onClick={() => handleAction("Automation")}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Automation
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Calendar & Productivity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {getIntegrationsByCategory('productivity').map(renderIntegrationCard)}
            {getIntegrationsByCategory('communication').map(renderIntegrationCard)}
          </div>
          <Button className="w-full" onClick={() => handleAction("Calendar sync")}>
            <Calendar className="w-4 h-4 mr-2" />
            Sync Calendar Events
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Analytics & Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {getIntegrationsByCategory('analytics').map(renderIntegrationCard)}
          </div>
          <Button className="w-full" onClick={() => handleAction("Analytics")}>
            <BarChart3 className="w-4 h-4 mr-2" />
            View Event Analytics
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsTab;