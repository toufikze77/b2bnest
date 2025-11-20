import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, Users, TrendingUp, Megaphone, DollarSign, Settings as SettingsIcon, Headphones, Code, Sparkles } from 'lucide-react';
import { workflowTemplates, workflowCategories, WorkflowTemplate } from '@/data/workflowTemplates';

const iconMap: Record<string, any> = {
  FileText, Users, TrendingUp, Megaphone, DollarSign, 
  Settings: SettingsIcon, Headphones, Code, Sparkles
};

interface WorkflowTemplateSelectorProps {
  open: boolean;
  onSelect: (template: WorkflowTemplate) => void;
  onClose: () => void;
}

const WorkflowTemplateSelector = ({ open, onSelect, onClose }: WorkflowTemplateSelectorProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = workflowTemplates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>Choose a Workflow Template</DialogTitle>
          <DialogDescription>
            Start with a pre-built template or create a custom workflow from scratch
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 h-full">
          {/* Categories Sidebar */}
          <div className="w-48 border-r pr-4 space-y-2">
            <Button
              variant={selectedCategory === 'all' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setSelectedCategory('all')}
            >
              All Templates
            </Button>
            {workflowCategories.map(category => {
              const Icon = iconMap[category.icon];
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {Icon && <Icon className="h-4 w-4 mr-2" />}
                  {category.name}
                </Button>
              );
            })}
          </div>

          {/* Templates Grid */}
          <div className="flex-1 flex flex-col">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-4 pr-4">
                {filteredTemplates.map(template => {
                  const Icon = iconMap[template.icon];
                  const category = workflowCategories.find(c => c.id === template.category);
                  
                  return (
                    <button
                      key={template.id}
                      onClick={() => {
                        onSelect(template);
                        onClose();
                      }}
                      className="text-left p-4 border rounded-lg hover:border-primary hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {Icon && (
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold mb-1">{template.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {template.description}
                          </p>
                          {category && (
                            <Badge variant="secondary" className="text-xs">
                              {category.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowTemplateSelector;
