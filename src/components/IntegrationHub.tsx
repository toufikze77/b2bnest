
import React, { useState } from 'react';
import { ExternalLink, Settings, CheckCircle, AlertCircle } from 'lucide-react';
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
    // Productivity & Office
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
      id: 'microsoft-365',
      name: 'Microsoft Office 365',
      description: 'Integrate with Word, Excel, PowerPoint, and OneDrive',
      icon: '🏢',
      category: 'Productivity',
      connected: false,
      features: ['Document editing', 'OneDrive sync', 'Teams integration', 'SharePoint access', 'Outlook email'],
      setupComplexity: 'medium',
      pricing: 'Starting at $6/month'
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      description: 'Store and sync documents with Dropbox',
      icon: '📦',
      category: 'Productivity',
      connected: false,
      features: ['Cloud storage', 'File synchronization', 'Version history', 'Team folders'],
      setupComplexity: 'easy',
      pricing: 'Starting at $10/month'
    },

    // Communication & Collaboration
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
      id: 'microsoft-teams',
      name: 'Microsoft Teams',
      description: 'Video conferencing and team collaboration',
      icon: '👥',
      category: 'Communication',
      connected: false,
      features: ['Video meetings', 'Chat integration', 'File sharing', 'Screen sharing'],
      setupComplexity: 'easy',
      pricing: 'Free tier available'
    },
    {
      id: 'zoom',
      name: 'Zoom',
      description: 'Video conferencing and webinar integration',
      icon: '🎥',
      category: 'Communication',
      connected: false,
      features: ['Video meetings', 'Webinars', 'Recording', 'Screen sharing'],
      setupComplexity: 'easy',
      pricing: 'Starting at $14.99/month'
    },

    // Automation & Workflows
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Automate workflows between our AI Platform and 3000+ other apps',
      icon: '⚡',
      category: 'Automation',
      connected: false,
      features: ['Workflow automation', 'Trigger-based actions', 'Multi-app integration', 'Custom workflows'],
      setupComplexity: 'medium',
      pricing: 'Starting at $20/month'
    },
    {
      id: 'make',
      name: 'Make (Integromat)',
      description: 'Visual workflow automation platform',
      icon: '🔧',
      category: 'Automation',
      connected: false,
      features: ['Visual workflow builder', 'Advanced data processing', 'Real-time execution', 'Error handling'],
      setupComplexity: 'medium',
      pricing: 'Starting at $9/month'
    },
    {
      id: 'docusign',
      name: 'DocuSign',
      description: 'Send documents for electronic signature',
      icon: '✍️',
      category: 'Automation',
      connected: false,
      features: ['E-signature workflow', 'Template automation', 'Signing status tracking', 'Document storage'],
      setupComplexity: 'medium',
      pricing: 'Starting at $10/month'
    },

    // CRM & Sales
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
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'Enterprise CRM integration for lead and opportunity management',
      icon: '☁️',
      category: 'CRM',
      connected: false,
      features: ['Lead management', 'Opportunity tracking', 'Custom fields', 'Reports & dashboards'],
      setupComplexity: 'complex',
      pricing: 'Starting at $25/month'
    },
    {
      id: 'pipedrive',
      name: 'Pipedrive',
      description: 'Sales pipeline management and deal tracking',
      icon: '📊',
      category: 'CRM',
      connected: false,
      features: ['Pipeline management', 'Deal tracking', 'Activity reminders', 'Sales reporting'],
      setupComplexity: 'medium',
      pricing: 'Starting at $14.90/month'
    },

    // Accounting & Finance
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      description: 'Sync invoices, expenses, and financial data',
      icon: '💰',
      category: 'Accounting',
      connected: false,
      features: ['Invoice sync', 'Expense tracking', 'Financial reporting', 'Tax preparation'],
      setupComplexity: 'medium',
      pricing: 'Starting at $15/month'
    },
    {
      id: 'xero',
      name: 'Xero',
      description: 'Cloud accounting software integration',
      icon: '📈',
      category: 'Accounting',
      connected: false,
      features: ['Bank reconciliation', 'Invoice management', 'Financial reports', 'Multi-currency'],
      setupComplexity: 'medium',
      pricing: 'Starting at $13/month'
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Payment processing and subscription management',
      icon: '💳',
      category: 'Accounting',
      connected: false,
      features: ['Payment processing', 'Subscription billing', 'Invoice automation', 'Financial reporting'],
      setupComplexity: 'medium',
      pricing: '2.9% + 30¢ per transaction'
    },
    {
      id: 'paypal',
      name: 'PayPal',
      description: 'Payment processing and invoice management',
      icon: '🏦',
      category: 'Accounting',
      connected: false,
      features: ['Payment processing', 'Invoice creation', 'Recurring payments', 'Dispute management'],
      setupComplexity: 'easy',
      pricing: '2.9% + fixed fee per transaction'
    },

    // Project Management
    {
      id: 'trello',
      name: 'Trello',
      description: 'Kanban-style project management boards',
      icon: '📋',
      category: 'Project Management',
      connected: false,
      features: ['Kanban boards', 'Card management', 'Team collaboration', 'Power-ups'],
      setupComplexity: 'easy',
      pricing: 'Free tier available'
    },
    {
      id: 'asana',
      name: 'Asana',
      description: 'Task and project management platform',
      icon: '✅',
      category: 'Project Management',
      connected: false,
      features: ['Task management', 'Project timelines', 'Team collaboration', 'Custom fields'],
      setupComplexity: 'medium',
      pricing: 'Free for teams up to 15'
    },
    {
      id: 'monday',
      name: 'Monday.com',
      description: 'Work management platform with customizable workflows',
      icon: '📅',
      category: 'Project Management',
      connected: false,
      features: ['Custom workflows', 'Time tracking', 'Gantt charts', 'Team collaboration'],
      setupComplexity: 'medium',
      pricing: 'Starting at $8/month per user'
    },
    {
      id: 'jira',
      name: 'Jira',
      description: 'Issue tracking and agile project management',
      icon: '🔧',
      category: 'Project Management',
      connected: false,
      features: ['Issue tracking', 'Agile boards', 'Sprint planning', 'Advanced reporting'],
      setupComplexity: 'complex',
      pricing: 'Starting at $7/month for 10 users'
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'All-in-one workspace for notes, docs, and project management',
      icon: '📝',
      category: 'Project Management',
      connected: false,
      features: ['Documentation', 'Database management', 'Task tracking', 'Team wikis'],
      setupComplexity: 'medium',
      pricing: 'Free for personal use'
    },

    // Email Marketing
    {
      id: 'mailchimp',
      name: 'Mailchimp',
      description: 'Email marketing and automation platform',
      icon: '📧',
      category: 'Marketing',
      connected: false,
      features: ['Email campaigns', 'Automation workflows', 'Audience segmentation', 'Analytics'],
      setupComplexity: 'medium',
      pricing: 'Free for up to 2,000 contacts'
    },
    {
      id: 'convertkit',
      name: 'ConvertKit',
      description: 'Email marketing for creators and businesses',
      icon: '📬',
      category: 'Marketing',
      connected: false,
      features: ['Email sequences', 'Landing pages', 'Subscriber tagging', 'A/B testing'],
      setupComplexity: 'medium',
      pricing: 'Starting at $29/month'
    },
    {
      id: 'sendgrid',
      name: 'SendGrid',
      description: 'Email delivery and marketing platform',
      icon: '✉️',
      category: 'Marketing',
      connected: false,
      features: ['Transactional emails', 'Marketing campaigns', 'Email validation', 'Analytics'],
      setupComplexity: 'medium',
      pricing: 'Free for 100 emails/day'
    },
    {
      id: 'constant-contact',
      name: 'Constant Contact',
      description: 'Email marketing and online marketing tools',
      icon: '📮',
      category: 'Marketing',
      connected: false,
      features: ['Email templates', 'Contact management', 'Social media tools', 'Event marketing'],
      setupComplexity: 'easy',
      pricing: 'Starting at $20/month'
    },

    // E-commerce
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'E-commerce platform integration for online stores',
      icon: '🛒',
      category: 'E-commerce',
      connected: false,
      features: ['Product sync', 'Order management', 'Inventory tracking', 'Customer data'],
      setupComplexity: 'medium',
      pricing: 'Starting at $29/month'
    },
    {
      id: 'woocommerce',
      name: 'WooCommerce',
      description: 'WordPress e-commerce plugin integration',
      icon: '🏪',
      category: 'E-commerce',
      connected: false,
      features: ['Product management', 'Order processing', 'Payment gateways', 'Shipping options'],
      setupComplexity: 'medium',
      pricing: 'Free (WordPress plugin)'
    },
    {
      id: 'square',
      name: 'Square',
      description: 'Point-of-sale and payment processing system',
      icon: '📱',
      category: 'E-commerce',
      connected: false,
      features: ['POS integration', 'Payment processing', 'Inventory management', 'Customer profiles'],
      setupComplexity: 'easy',
      pricing: '2.6% + 10¢ per transaction'
    },
    {
      id: 'bigcommerce',
      name: 'BigCommerce',
      description: 'Enterprise e-commerce platform',
      icon: '🏬',
      category: 'E-commerce',
      connected: false,
      features: ['Multi-channel selling', 'API-first architecture', 'Built-in features', 'No transaction fees'],
      setupComplexity: 'medium',
      pricing: 'Starting at $29/month'
    },

    // Social Media
    {
      id: 'facebook',
      name: 'Facebook Business',
      description: 'Social media marketing and advertising',
      icon: '📘',
      category: 'Social Media',
      connected: false,
      features: ['Page management', 'Ad campaigns', 'Audience insights', 'Messenger integration'],
      setupComplexity: 'medium',
      pricing: 'Free (ad spend varies)'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn Business',
      description: 'Professional networking and B2B marketing',
      icon: '💼',
      category: 'Social Media',
      connected: false,
      features: ['Company page management', 'Lead generation', 'Content publishing', 'Analytics'],
      setupComplexity: 'medium',
      pricing: 'Free (premium features vary)'
    },
    {
      id: 'twitter',
      name: 'Twitter/X Business',
      description: 'Social media engagement and advertising',
      icon: '🐦',
      category: 'Social Media',
      connected: false,
      features: ['Tweet scheduling', 'Audience analytics', 'Ad campaigns', 'Customer support'],
      setupComplexity: 'easy',
      pricing: 'Free (ad spend varies)'
    },
    {
      id: 'instagram',
      name: 'Instagram Business',
      description: 'Visual social media marketing platform',
      icon: '📸',
      category: 'Social Media',
      connected: false,
      features: ['Content publishing', 'Story management', 'Shopping integration', 'Insights'],
      setupComplexity: 'medium',
      pricing: 'Free (ad spend varies)'
    },

    // Analytics & Tracking
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      description: 'Web analytics and user behavior tracking',
      icon: '📊',
      category: 'Analytics',
      connected: false,
      features: ['Website analytics', 'User behavior', 'Conversion tracking', 'Custom reports'],
      setupComplexity: 'medium',
      pricing: 'Free'
    },
    {
      id: 'mixpanel',
      name: 'Mixpanel',
      description: 'Product analytics and user engagement tracking',
      icon: '📈',
      category: 'Analytics',
      connected: false,
      features: ['Event tracking', 'Funnel analysis', 'Cohort analysis', 'A/B testing'],
      setupComplexity: 'medium',
      pricing: 'Free for 100K tracked users'
    },
    {
      id: 'segment',
      name: 'Segment',
      description: 'Customer data platform and analytics',
      icon: '🎯',
      category: 'Analytics',
      connected: false,
      features: ['Data collection', 'Customer profiles', 'Real-time streaming', 'Privacy controls'],
      setupComplexity: 'complex',
      pricing: 'Free for 1,000 MTUs'
    },

    // Cloud Infrastructure
    {
      id: 'azure',
      name: 'Microsoft Azure',
      description: 'Deploy and scale applications with Azure cloud services',
      icon: '☁️',
      category: 'Cloud Platform',
      connected: false,
      features: ['App deployment', 'Database hosting', 'API management', 'Identity services', 'Storage solutions'],
      setupComplexity: 'complex',
      pricing: 'Pay-as-you-go'
    },
    {
      id: 'aws',
      name: 'Amazon Web Services',
      description: 'Comprehensive cloud computing platform',
      icon: '🔶',
      category: 'Cloud Platform',
      connected: false,
      features: ['Compute services', 'Storage solutions', 'Database services', 'Machine learning', 'Networking'],
      setupComplexity: 'complex',
      pricing: 'Pay-as-you-use'
    },
    {
      id: 'gcp',
      name: 'Google Cloud Platform',
      description: 'Google\'s cloud computing services',
      icon: '🌥️',
      category: 'Cloud Platform',
      connected: false,
      features: ['Compute engine', 'Cloud storage', 'BigQuery analytics', 'AI/ML services', 'Kubernetes'],
      setupComplexity: 'complex',
      pricing: 'Pay-as-you-go'
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
          message: "Test webhook from AI Platform Integration Hub"
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
          <Settings className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Integration Hub</h2>
        </div>
        <p className="text-gray-600">
          Connect our AI Platform with your favorite tools to streamline your workflow and automate business processes.
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
