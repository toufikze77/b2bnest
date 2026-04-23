import React, { useState } from 'react';
import { 
  Plus, Settings, CheckCircle, AlertCircle, ExternalLink, 
  Slack, Github, Figma, MessageSquare, Calendar, Mail,
  Zap, Link, Database, Cloud, Smartphone, Monitor
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'communication' | 'productivity' | 'development' | 'design' | 'ai' | 'storage';
  connected: boolean;
  features: string[];
  setupComplexity: 'easy' | 'medium' | 'complex';
  pricing: string;
  syncEnabled: boolean;
  autoCreateTasks: boolean;
  notifications: boolean;
  lastSync?: string;
  tasksCreated?: number;
}

export const TodoIntegrations: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'slack',
      name: 'Slack',
      description: 'Sync messages, create tasks from mentions, and get notifications',
      icon: <Slack className="h-6 w-6 text-purple-600" />,
      category: 'communication',
      connected: true,
      features: ['Message to task conversion', 'Channel notifications', 'Slash commands', 'Status updates'],
      setupComplexity: 'easy',
      pricing: 'Free',
      syncEnabled: true,
      autoCreateTasks: true,
      notifications: true,
      lastSync: '2024-01-12T10:30:00Z',
      tasksCreated: 23
    },
    {
      id: 'onedrive',
      name: 'Microsoft OneDrive',
      description: 'Sync documents, create tasks from file changes, and collaborate',
      icon: <div className="h-6 w-6 bg-blue-600 rounded text-white text-sm flex items-center justify-center font-bold">O</div>,
      category: 'storage',
      connected: true,
      features: ['File sync', 'Document tasks', 'Version tracking', 'Shared folder monitoring'],
      setupComplexity: 'medium',
      pricing: 'Starting at $6/month',
      syncEnabled: true,
      autoCreateTasks: false,
      notifications: true,
      lastSync: '2024-01-12T09:15:00Z',
      tasksCreated: 12
    },
    {
      id: 'figma',
      name: 'Figma',
      description: 'Create tasks from design comments, track design reviews',
      icon: <Figma className="h-6 w-6 text-purple-500" />,
      category: 'design',
      connected: true,
      features: ['Comment tracking', 'Design review tasks', 'File notifications', 'Team collaboration'],
      setupComplexity: 'easy',
      pricing: 'Free tier available',
      syncEnabled: true,
      autoCreateTasks: true,
      notifications: true,
      lastSync: '2024-01-12T11:00:00Z',
      tasksCreated: 8
    },
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      description: 'AI-powered task suggestions, smart scheduling, and automation',
      icon: <MessageSquare className="h-6 w-6 text-green-600" />,
      category: 'ai',
      connected: false,
      features: ['Smart task creation', 'Priority suggestions', 'Time estimates', 'Task breakdown'],
      setupComplexity: 'easy',
      pricing: 'Starting at $20/month',
      syncEnabled: false,
      autoCreateTasks: false,
      notifications: false
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Track issues, pull requests, and code reviews as tasks',
      icon: <Github className="h-6 w-6 text-gray-800" />,
      category: 'development',
      connected: false,
      features: ['Issue tracking', 'PR reviews', 'Code comments', 'Release planning'],
      setupComplexity: 'medium',
      pricing: 'Free for public repos',
      syncEnabled: false,
      autoCreateTasks: false,
      notifications: false
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Sync tasks with calendar events, time blocking, and scheduling',
      icon: <Calendar className="h-6 w-6 text-blue-500" />,
      category: 'productivity',
      connected: false,
      features: ['Event sync', 'Time blocking', 'Meeting tasks', 'Deadline reminders'],
      setupComplexity: 'easy',
      pricing: 'Free',
      syncEnabled: false,
      autoCreateTasks: false,
      notifications: false
    },
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Create tasks from emails, track responses, and manage follow-ups',
      icon: <Mail className="h-6 w-6 text-red-500" />,
      category: 'communication',
      connected: false,
      features: ['Email to task', 'Follow-up tracking', 'Priority detection', 'Auto-categorization'],
      setupComplexity: 'medium',
      pricing: 'Free',
      syncEnabled: false,
      autoCreateTasks: false,
      notifications: false
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Connect to 5000+ apps with automated workflows',
      icon: <Zap className="h-6 w-6 text-orange-500" />,
      category: 'productivity',
      connected: false,
      features: ['Workflow automation', 'Multi-app triggers', 'Custom integrations', 'Bulk operations'],
      setupComplexity: 'complex',
      pricing: 'Starting at $19.99/month',
      syncEnabled: false,
      autoCreateTasks: false,
      notifications: false
    }
  ]);

  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const { toast } = useToast();

  const toggleConnection = (integrationId: string) => {
    setIntegrations(integrations.map(integration => {
      if (integration.id === integrationId) {
        const newConnected = !integration.connected;
        toast({
          title: newConnected ? "Integration connected!" : "Integration disconnected",
          description: `${integration.name} is now ${newConnected ? 'connected' : 'disconnected'}`,
        });
        return { 
          ...integration, 
          connected: newConnected,
          syncEnabled: newConnected ? integration.syncEnabled : false,
          autoCreateTasks: newConnected ? integration.autoCreateTasks : false,
          notifications: newConnected ? integration.notifications : false
        };
      }
      return integration;
    }));
  };

  const toggleSetting = (integrationId: string, setting: 'syncEnabled' | 'autoCreateTasks' | 'notifications') => {
    setIntegrations(integrations.map(integration => {
      if (integration.id === integrationId) {
        return { ...integration, [setting]: !integration[setting] };
      }
      return integration;
    }));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'communication': return <MessageSquare className="h-5 w-5 text-blue-600" />;
      case 'productivity': return <Calendar className="h-5 w-5 text-green-600" />;
      case 'development': return <Github className="h-5 w-5 text-gray-800" />;
      case 'design': return <Figma className="h-5 w-5 text-purple-500" />;
      case 'ai': return <MessageSquare className="h-5 w-5 text-green-600" />;
      case 'storage': return <Cloud className="h-5 w-5 text-blue-500" />;
      default: return <Link className="h-5 w-5 text-gray-600" />;
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

  const connectedIntegrations = integrations.filter(i => i.connected);
  const availableIntegrations = integrations.filter(i => !i.connected);
  const categories = [...new Set(integrations.map(i => i.category))];

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Connected Apps</p>
                <p className="text-2xl font-bold text-gray-900">{connectedIntegrations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Auto Tasks Created</p>
                <p className="text-2xl font-bold text-gray-900">
                  {connectedIntegrations.reduce((sum, i) => sum + (i.tasksCreated || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Database className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Syncs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {connectedIntegrations.filter(i => i.syncEnabled).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Monitor className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Available Apps</p>
                <p className="text-2xl font-bold text-gray-900">{availableIntegrations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="connected" className="space-y-6">
        <TabsList>
          <TabsTrigger value="connected">Connected ({connectedIntegrations.length})</TabsTrigger>
          <TabsTrigger value="available">Available ({availableIntegrations.length})</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
        </TabsList>

        {/* Connected Integrations */}
        <TabsContent value="connected" className="space-y-4">
          {connectedIntegrations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="text-4xl mb-4">🔗</div>
                <p className="text-gray-500 text-lg mb-2">No integrations connected yet</p>
                <p className="text-gray-400 mb-4">Connect your favorite apps to streamline your workflow</p>
                <Button onClick={() => setShowSetupDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Integration
                </Button>
              </CardContent>
            </Card>
          ) : (
            connectedIntegrations.map((integration) => (
              <Card key={integration.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="p-2 bg-gray-50 rounded-lg">
                        {integration.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                          <Badge variant="secondary" className={getComplexityColor(integration.setupComplexity)}>
                            {integration.setupComplexity}
                          </Badge>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{integration.description}</p>
                        
                        {/* Integration Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="text-sm">
                            <span className="text-gray-500">Last Sync:</span>
                            <p className="font-medium">{formatLastSync(integration.lastSync)}</p>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-500">Tasks Created:</span>
                            <p className="font-medium">{integration.tasksCreated || 0}</p>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-500">Category:</span>
                            <p className="font-medium capitalize">{integration.category}</p>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-500">Pricing:</span>
                            <p className="font-medium">{integration.pricing}</p>
                          </div>
                        </div>

                        {/* Settings */}
                        <div className="flex flex-wrap gap-4 mb-4">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={integration.syncEnabled}
                              onCheckedChange={() => toggleSetting(integration.id, 'syncEnabled')}
                            />
                            <Label className="text-sm">Sync Enabled</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={integration.autoCreateTasks}
                              onCheckedChange={() => toggleSetting(integration.id, 'autoCreateTasks')}
                            />
                            <Label className="text-sm">Auto-create Tasks</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={integration.notifications}
                              onCheckedChange={() => toggleSetting(integration.id, 'notifications')}
                            />
                            <Label className="text-sm">Notifications</Label>
                          </div>
                        </div>

                        {/* Features */}
                        <div className="flex flex-wrap gap-2">
                          {integration.features.map(feature => (
                            <Badge key={feature} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleConnection(integration.id)}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Available Integrations */}
        <TabsContent value="available" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {availableIntegrations.map((integration) => (
              <Card key={integration.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      {integration.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                        <Badge variant="secondary" className={getComplexityColor(integration.setupComplexity)}>
                          {integration.setupComplexity}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{integration.description}</p>
                      
                      <div className="text-sm text-gray-500 mb-3">
                        <span className="font-medium">Pricing:</span> {integration.pricing}
                      </div>

                      {/* Features */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {integration.features.slice(0, 3).map(feature => (
                          <Badge key={feature} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {integration.features.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{integration.features.length - 3} more
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button 
                          size="sm" 
                          onClick={() => toggleConnection(integration.id)}
                          className="flex-1"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Connect
                        </Button>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Marketplace */}
        <TabsContent value="marketplace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Marketplace</CardTitle>
              <p className="text-gray-600">Discover new ways to connect your workflow</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categories.map(category => (
                  <Card key={category} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 text-center">
                      <div className="flex justify-center mb-2">
                        {getCategoryIcon(category)}
                      </div>
                      <h4 className="font-medium capitalize">{category}</h4>
                      <p className="text-sm text-gray-500">
                        {integrations.filter(i => i.category === category).length} apps
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect New Integration</DialogTitle>
            <DialogDescription>
              Choose an app to connect to your Todo Hub
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select an app" />
              </SelectTrigger>
              <SelectContent>
                {availableIntegrations.map(integration => (
                  <SelectItem key={integration.id} value={integration.id}>
                    <div className="flex items-center space-x-2">
                      {integration.icon}
                      <span>{integration.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex space-x-2">
              <Button className="flex-1">Connect</Button>
              <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};