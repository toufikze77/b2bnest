
import React, { useState } from 'react';
import { Zap, ExternalLink, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  connected: boolean;
  features: string[];
  setupComplexity: 'easy' | 'medium' | 'complex';
  pricing: string;
}

const IntegrationHub = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'google-workspace',
      name: 'Google Workspace',
      description: 'Sync documents with Google Drive, Docs, and Sheets',
      icon: '📧',
      category: 'Productivity',
      connected: false,
      features: ['Document sync', 'Email templates', 'Calendar integration', 'Shared drives'],
      setupComplexity: 'easy',
      pricing: 'Free with Google account'
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get notifications and share documents in Slack channels',
      icon: '💬',
      category: 'Communication',
      connected: false,
      features: ['Document notifications', 'Template sharing', 'Team collaboration', 'Workflow alerts'],
      setupComplexity: 'easy',
      pricing: 'Free'
    },
    {
      id: 'docusign',
      name: 'DocuSign',
      description: 'Send documents for electronic signature',
      icon: '✍️',
      category: 'Document Management',
      connected: false,
      features: ['E-signature workflow', 'Template automation', 'Signing status tracking', 'Document storage'],
      setupComplexity: 'medium',
      pricing: 'Starting at $10/month'
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Automate workflows between B2BNest and 3000+ other apps',
      icon: '⚡',
      category: 'Automation',
      connected: false,
      features: ['Workflow automation', 'Trigger-based actions', 'Multi-app integration', 'Custom workflows'],
      setupComplexity: 'medium',
      pricing: 'Starting at $20/month'
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      description: 'Store and sync documents with Dropbox',
      icon: '📦',
      category: 'Storage',
      connected: false,
      features: ['Cloud storage', 'File synchronization', 'Version history', 'Team folders'],
      setupComplexity: 'easy',
      pricing: 'Starting at $10/month'
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Sync customer data and automate document workflows',
      icon: '🎯',
      category: 'CRM',
      connected: false,
      features: ['Contact sync', 'Deal automation', 'Document tracking', 'Sales pipeline'],
      setupComplexity: 'complex',
      pricing: 'Free tier available'
    }
  ]);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const { toast } = useToast();

  const handleConnect = async (integrationId: string) => {
    setSelectedIntegration(integrationId);
    
    // Simulate connection process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIntegrations(prev => 
      prev.map(integration => 
        integration.id === integrationId 
          ? { ...integration, connected: true }
          : integration
      )
    );
    
    setSelectedIntegration(null);
    
    toast({
      title: "Integration Connected",
      description: `Successfully connected to ${integrations.find(i => i.id === integrationId)?.name}`,
    });
  };

  const handleDisconnect = (integrationId: string) => {
    setIntegrations(prev => 
      prev.map(integration => 
        integration.id === integrationId 
          ? { ...integration, connected: false }
          : integration
      )
    );
    
    toast({
      title: "Integration Disconnected",
      description: `Disconnected from ${integrations.find(i => i.id === integrationId)?.name}`,
    });
  };

  const handleWebhookTest = async () => {
    if (!webhookUrl) {
      toast({
        title: "Error",
        description: "Please enter a webhook URL",
        variant: "destructive",
      });
      return;
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify({
          event: "test",
          timestamp: new Date().toISOString(),
          message: "Test webhook from B2BNest Integration Hub"
        }),
      });

      toast({
        title: "Webhook Sent",
        description: "Test webhook has been sent successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send webhook",
        variant: "destructive",
      });
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'complex': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const categories = [...new Set(integrations.map(i => i.category))];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Integration Hub</h2>
        </div>
        <p className="text-gray-600">
          Connect B2BNest with your favorite tools to streamline your workflow and automate document processes.
        </p>
      </div>

      {/* Webhook Configuration */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Custom Webhook Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://hooks.zapier.com/hooks/catch/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter your Zapier webhook URL or any other webhook endpoint
              </p>
            </div>
            <Button onClick={handleWebhookTest} className="w-full sm:w-auto">
              Test Webhook
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integration Categories */}
      {categories.map(category => (
        <div key={category} className="mb-8">
          <h3 className="text-xl font-semibold mb-4">{category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.filter(i => i.category === category).map((integration) => (
              <Card key={integration.id} className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{integration.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getComplexityColor(integration.setupComplexity)}>
                            {integration.setupComplexity} setup
                          </Badge>
                          {integration.connected ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{integration.description}</p>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Features:</p>
                    <div className="flex flex-wrap gap-1">
                      {integration.features.map((feature, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      <strong>Pricing:</strong> {integration.pricing}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {integration.connected ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(integration.id)}
                          className="flex-1"
                        >
                          Disconnect
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleConnect(integration.id)}
                        disabled={selectedIntegration === integration.id}
                        className="flex-1"
                      >
                        {selectedIntegration === integration.id ? (
                          "Connecting..."
                        ) : (
                          <>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default IntegrationHub;
