import React, { useState } from 'react';
import { WorkflowNode } from '@/pages/WorkflowStudio';
import { X, Save, Code, TestTube, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const WHATSAPP_TEMPLATES: Record<string, string> = {
  custom: '',
  welcome: 'Hi {{name}}, welcome aboard! Reply HELP for assistance.',
  order_confirmation: 'Hi {{name}}, your order #{{order_id}} has been confirmed. Total: {{amount}}.',
  appointment_reminder: 'Reminder: your appointment is scheduled for {{date}} at {{time}}. Reply YES to confirm.',
  shipping_update: 'Good news {{name}}! Your order #{{order_id}} has shipped. Track it here: {{tracking_url}}',
  follow_up: 'Hi {{name}}, just checking in. Let us know if you have any questions!',
};

interface NodeConfiguratorProps {
  node: WorkflowNode;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
  onClose: () => void;
}

const NodeConfigurator: React.FC<NodeConfiguratorProps> = ({ node, onUpdate, onClose }) => {
  const [config, setConfig] = useState(node.config);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const isWhatsApp = node.name === 'Send WhatsApp';

  const handleSave = () => {
    onUpdate({ config });
  };

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleTemplateChange = (templateKey: string) => {
    const body = WHATSAPP_TEMPLATES[templateKey] ?? '';
    setConfig(prev => ({
      ...prev,
      template: templateKey,
      body: templateKey === 'custom' ? prev.body : body,
    }));
  };

  const handleTestWhatsApp = async () => {
    setTestResult(null);
    if (!/^\+[1-9]\d{6,14}$/.test(String(config.to || ''))) {
      setTestResult({ ok: false, message: 'Recipient must be in E.164 format (e.g. +14155552671).' });
      return;
    }
    if (!config.body || String(config.body).trim().length === 0) {
      setTestResult({ ok: false, message: 'Message body is required.' });
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('workflow-execute', {
        body: {
          steps: [{
            type: 'whatsapp.send',
            to: config.to,
            body: config.body,
            mediaUrl: config.mediaUrl || undefined,
          }],
        },
      });
      if (error) throw new Error(error.message);
      const r = data?.results?.[0];
      if (r?.ok) {
        setTestResult({ ok: true, message: `Sent! Message SID: ${r.sid}` });
        toast.success('WhatsApp test message sent');
      } else {
        const msg = r?.message || r?.error || data?.error || 'Send failed';
        setTestResult({ ok: false, message: String(msg) });
        toast.error(`Test failed: ${msg}`);
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || 'Network error' });
      toast.error(e.message || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const renderConfigField = (key: string, value: any) => {
    if (typeof value === 'boolean') {
      return (
        <div key={key} className="flex items-center justify-between">
          <Label htmlFor={key}>{key}</Label>
          <Button
            id={key}
            variant={value ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateConfig(key, !value)}
          >
            {value ? 'Enabled' : 'Disabled'}
          </Button>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={key} className="space-y-2">
          <Label>{key}</Label>
          <Textarea
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                updateConfig(key, JSON.parse(e.target.value));
              } catch (e) {
                // Keep the text value while editing
              }
            }}
            rows={4}
            className="font-mono text-sm"
          />
        </div>
      );
    }

    if (typeof value === 'object' && value !== null) {
      return (
        <div key={key} className="space-y-2">
          <Label>{key}</Label>
          <Textarea
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                updateConfig(key, JSON.parse(e.target.value));
              } catch (e) {
                // Keep the text value while editing
              }
            }}
            rows={6}
            className="font-mono text-sm"
          />
        </div>
      );
    }

    if (key === 'method' && typeof value === 'string') {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>{key}</Label>
          <Select value={value} onValueChange={(v) => updateConfig(key, v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={key}>{key}</Label>
        <Input
          id={key}
          value={value}
          onChange={(e) => updateConfig(key, e.target.value)}
          placeholder={`Enter ${key}...`}
        />
      </div>
    );
  };

  return (
    <div className="w-96 border-l bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{node.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{node.type}</Badge>
            <Badge variant="outline">{node.category}</Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <Tabs defaultValue="config" className="w-full">
          <TabsList className="w-full px-4 pt-4">
            <TabsTrigger value="config" className="flex-1">Configuration</TabsTrigger>
            <TabsTrigger value="advanced" className="flex-1">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Node Name</Label>
              <Input
                value={node.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="Enter node name..."
              />
            </div>

            {isWhatsApp ? (
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium text-sm">WhatsApp Message</h4>
                <p className="text-xs text-muted-foreground">
                  Uses your connected Twilio WhatsApp credentials. Configure them in{' '}
                  <a href="/integrations/whatsapp" className="underline">Integrations → WhatsApp</a>.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="wa-to">Recipient (E.164)</Label>
                  <Input
                    id="wa-to"
                    value={config.to || ''}
                    onChange={(e) => updateConfig('to', e.target.value)}
                    placeholder="+14155552671"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Message Template</Label>
                  <Select value={config.template || 'custom'} onValueChange={handleTemplateChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom message</SelectItem>
                      <SelectItem value="welcome">Welcome</SelectItem>
                      <SelectItem value="order_confirmation">Order Confirmation</SelectItem>
                      <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                      <SelectItem value="shipping_update">Shipping Update</SelectItem>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Variables like {'{{name}}'} can be replaced before sending.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wa-body">Message Body</Label>
                  <Textarea
                    id="wa-body"
                    value={config.body || ''}
                    onChange={(e) => updateConfig('body', e.target.value)}
                    rows={5}
                    maxLength={1600}
                    placeholder="Type your message..."
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {(config.body || '').length}/1600
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wa-media">Media URL (optional, https)</Label>
                  <Input
                    id="wa-media"
                    value={config.mediaUrl || ''}
                    onChange={(e) => updateConfig('mediaUrl', e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="pt-2 border-t space-y-2">
                  <Button
                    onClick={handleTestWhatsApp}
                    disabled={testing}
                    variant="secondary"
                    className="w-full"
                  >
                    {testing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" /> Test WhatsApp</>
                    )}
                  </Button>
                  {testResult && (
                    <div
                      className={`text-xs p-2 rounded-md border ${
                        testResult.ok
                          ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'border-destructive/50 bg-destructive/10 text-destructive'
                      }`}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium text-sm">Configuration</h4>
                {Object.entries(config).map(([key, value]) => {
                  if (key === 'description') return null;
                  return renderConfigField(key, value);
                })}
              </div>
            )}

            {config.description && (
              <div className="space-y-2 pt-4 border-t">
                <Label>Description</Label>
                <Textarea
                  value={config.description}
                  onChange={(e) => updateConfig('description', e.target.value)}
                  rows={3}
                  placeholder="Describe what this node does..."
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Error Handling</Label>
              <Select defaultValue="continue">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continue">Continue on Error</SelectItem>
                  <SelectItem value="stop">Stop on Error</SelectItem>
                  <SelectItem value="retry">Retry on Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Timeout (seconds)</Label>
              <Input type="number" defaultValue="30" />
            </div>

            <div className="space-y-2">
              <Label>Retry Attempts</Label>
              <Input type="number" defaultValue="3" />
            </div>

            <div className="pt-4 border-t">
              <Button variant="outline" className="w-full" size="sm">
                <Code className="h-4 w-4 mr-2" />
                View JSON
              </Button>
            </div>

            <Button variant="outline" className="w-full" size="sm">
              <TestTube className="h-4 w-4 mr-2" />
              Test Node
            </Button>
          </TabsContent>
        </Tabs>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSave} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
};

export default NodeConfigurator;
