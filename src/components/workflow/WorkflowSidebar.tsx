import React, { useState } from 'react';
import { WorkflowNode } from '@/pages/WorkflowStudio';
import { Search, Zap, Settings, GitBranch, Repeat, Plug } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

interface WorkflowSidebarProps {
  onAddNode: (node: Omit<WorkflowNode, 'id' | 'position' | 'connections'>) => void;
}

const WorkflowSidebar: React.FC<WorkflowSidebarProps> = ({ onAddNode }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const nodeCategories = [
    {
      type: 'trigger' as const,
      icon: Zap,
      title: 'Triggers',
      description: 'Start your workflow',
      nodes: [
        { name: 'Webhook', category: 'HTTP', description: 'Trigger via HTTP webhook', config: { url: '', method: 'POST' } },
        { name: 'Schedule', category: 'Time', description: 'Run on a schedule', config: { cron: '0 9 * * *' } },
        { name: 'Database Change', category: 'Database', description: 'When database record changes', config: { table: '', event: 'insert' } },
        { name: 'Email Received', category: 'Email', description: 'When email is received', config: { mailbox: '' } },
        { name: 'Form Submit', category: 'Forms', description: 'When form is submitted', config: { formId: '' } },
        { name: 'File Upload', category: 'Storage', description: 'When file is uploaded', config: { bucket: '' } }
      ]
    },
    {
      type: 'action' as const,
      icon: Settings,
      title: 'Actions',
      description: 'Perform operations',
      nodes: [
        { name: 'Send Email', category: 'Email', description: 'Send an email message', config: { to: '', subject: '', body: '' } },
        { name: 'HTTP Request', category: 'HTTP', description: 'Make API call', config: { url: '', method: 'GET' } },
        { name: 'Database Insert', category: 'Database', description: 'Insert database record', config: { table: '', data: {} } },
        { name: 'Create File', category: 'Storage', description: 'Create/upload file', config: { path: '', content: '' } },
        { name: 'Send Notification', category: 'Notifications', description: 'Push notification', config: { title: '', message: '' } },
        { name: 'Generate Document', category: 'Documents', description: 'Create document', config: { template: '', format: 'pdf' } }
      ]
    },
    {
      type: 'condition' as const,
      icon: GitBranch,
      title: 'Conditions',
      description: 'Control flow logic',
      nodes: [
        { name: 'If/Else', category: 'Logic', description: 'Conditional branching', config: { condition: '', operator: 'equals' } },
        { name: 'Switch', category: 'Logic', description: 'Multiple conditions', config: { cases: [] } },
        { name: 'Filter', category: 'Logic', description: 'Filter items', config: { field: '', operator: 'contains' } },
        { name: 'Loop', category: 'Logic', description: 'Iterate over items', config: { items: [] } }
      ]
    },
    {
      type: 'transform' as const,
      icon: Repeat,
      title: 'Transform',
      description: 'Modify data',
      nodes: [
        { name: 'Map Data', category: 'Data', description: 'Transform data structure', config: { mapping: {} } },
        { name: 'Parse JSON', category: 'Data', description: 'Parse JSON string', config: { path: '' } },
        { name: 'Format Date', category: 'Data', description: 'Format date/time', config: { format: 'YYYY-MM-DD' } },
        { name: 'Calculate', category: 'Math', description: 'Perform calculation', config: { expression: '' } },
        { name: 'Merge Objects', category: 'Data', description: 'Combine objects', config: { sources: [] } },
        { name: 'Extract Text', category: 'Text', description: 'Extract from text', config: { pattern: '' } }
      ]
    },
    {
      type: 'integration' as const,
      icon: Plug,
      title: 'Integrations',
      description: 'Connect with services',
      nodes: [
        { name: 'Stripe Payment', category: 'Payments', description: 'Process payment', config: { amount: 0, currency: 'usd' } },
        { name: 'Slack Message', category: 'Communication', description: 'Send Slack message', config: { channel: '', text: '' } },
        { name: 'Google Sheets', category: 'Spreadsheets', description: 'Update spreadsheet', config: { sheetId: '', range: '' } },
        { name: 'Notion Page', category: 'Productivity', description: 'Create/update page', config: { databaseId: '' } },
        { name: 'Twilio SMS', category: 'Communication', description: 'Send SMS', config: { to: '', body: '' } },
        { name: 'SendGrid Email', category: 'Email', description: 'Send via SendGrid', config: { to: '', template: '' } }
      ]
    }
  ];

  const filteredCategories = nodeCategories.map(category => ({
    ...category,
    nodes: category.nodes.filter(node =>
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.nodes.length > 0);

  return (
    <div className="w-80 border-r bg-card flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-3">Node Library</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Accordion type="multiple" defaultValue={['trigger', 'action']} className="px-4 py-2">
          {filteredCategories.map((category) => {
            const Icon = category.icon;
            return (
              <AccordionItem key={category.type} value={category.type}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <div className="text-left">
                      <p className="font-medium">{category.title}</p>
                      <p className="text-xs text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    {category.nodes.map((node, index) => (
                      <div
                        key={index}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => onAddNode({
                          type: category.type,
                          category: node.category,
                          name: node.name,
                          config: { ...node.config, description: node.description }
                        })}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-sm">{node.name}</p>
                          <Badge variant="secondary" className="text-xs">
                            {node.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {node.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>

      <div className="p-4 border-t bg-muted/50">
        <p className="text-xs text-muted-foreground text-center">
          Click a node to add it to the canvas
        </p>
      </div>
    </div>
  );
};

export default WorkflowSidebar;
