import React, { useState, useMemo, useDeferredValue } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Search, FileText, Users, TrendingUp, Megaphone, DollarSign,
  Settings as SettingsIcon, Headphones, Code, Sparkles, Zap,
  Flame, Star, Clock, ArrowRight, Wand2
} from 'lucide-react';
import { workflowTemplates, workflowCategories, WorkflowTemplate } from '@/data/workflowTemplates';
import { cn } from '@/lib/utils';

const iconMap: Record<string, any> = {
  FileText, Users, TrendingUp, Megaphone, DollarSign,
  Settings: SettingsIcon, Headphones, Code, Sparkles
};

// Vibey gradient palette per category (uses semantic primary + accents from theme)
const categoryStyles: Record<string, { gradient: string; ring: string; emoji: string }> = {
  hr:        { gradient: 'from-pink-500/20 via-rose-500/10 to-transparent',     ring: 'group-hover:ring-pink-500/40',     emoji: '👥' },
  sales:     { gradient: 'from-emerald-500/20 via-green-500/10 to-transparent', ring: 'group-hover:ring-emerald-500/40',  emoji: '📈' },
  marketing: { gradient: 'from-fuchsia-500/20 via-purple-500/10 to-transparent',ring: 'group-hover:ring-fuchsia-500/40',  emoji: '📣' },
  finance:   { gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',  ring: 'group-hover:ring-amber-500/40',    emoji: '💰' },
  operations:{ gradient: 'from-sky-500/20 via-blue-500/10 to-transparent',      ring: 'group-hover:ring-sky-500/40',      emoji: '⚙️' },
  customer:  { gradient: 'from-orange-500/20 via-red-500/10 to-transparent',    ring: 'group-hover:ring-orange-500/40',   emoji: '🎧' },
  it:        { gradient: 'from-indigo-500/20 via-violet-500/10 to-transparent', ring: 'group-hover:ring-indigo-500/40',   emoji: '💻' },
  custom:    { gradient: 'from-primary/20 via-primary/5 to-transparent',        ring: 'group-hover:ring-primary/40',      emoji: '✨' },
};

// Curated "popular" + "new" tags so the gallery feels alive
const popular = new Set(['hr-onboarding', 'sales-lead', 'marketing-email', 'finance-invoice', 'customer-ticket']);
const fresh   = new Set(['marketing-social', 'it-deploy', 'sales-follow']);

interface WorkflowTemplateSelectorProps {
  open: boolean;
  onSelect: (template: WorkflowTemplate) => void;
  onClose: () => void;
}

const WorkflowTemplateSelector = ({ open, onSelect, onClose }: WorkflowTemplateSelectorProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  const blank = useMemo(() => workflowTemplates.find(t => t.id === 'blank')!, []);

  const filteredTemplates = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return workflowTemplates.filter(template => {
      if (template.id === 'blank') return false;
      if (selectedCategory !== 'all' && template.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        template.name.toLowerCase().includes(q) ||
        template.description.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, deferredQuery]);

  const handlePick = (template: WorkflowTemplate) => {
    onSelect(template);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] p-0 overflow-hidden border-border/50">
        {/* Ambient gradient header */}
        <div className="relative overflow-hidden border-b border-border/50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-fuchsia-500/10 to-sky-500/10" />
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl animate-pulse" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-fuchsia-500/15 blur-3xl" />

          <DialogHeader className="relative px-8 py-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-primary/15 ring-1 ring-primary/30">
                <Wand2 className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Workflow Gallery
              </DialogTitle>
              <Badge variant="secondary" className="ml-2 gap-1">
                <Sparkles className="h-3 w-3" /> {workflowTemplates.length - 1} templates
              </Badge>
            </div>
            <DialogDescription className="text-base">
              Launch in seconds. Pick a battle-tested template or start from a blank canvas.
            </DialogDescription>

            {/* Search */}
            <div className="relative mt-4 max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows — try 'email', 'invoice', 'onboarding'…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-11 bg-background/60 backdrop-blur border-border/60 focus-visible:ring-primary/40"
              />
            </div>
          </DialogHeader>
        </div>

        <div className="flex h-[calc(85vh-200px)]">
          {/* Categories */}
          <aside className="w-56 border-r border-border/50 p-3 space-y-1 overflow-y-auto bg-muted/20">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'hover:bg-accent text-foreground/80'
              )}
            >
              <Sparkles className="h-4 w-4" /> All Templates
              <span className="ml-auto text-xs opacity-70">{workflowTemplates.length - 1}</span>
            </button>
            {workflowCategories.map(category => {
              const Icon = iconMap[category.icon];
              const count = workflowTemplates.filter(t => t.category === category.id && t.id !== 'blank').length;
              const active = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-accent text-foreground/80'
                  )}
                >
                  <span className="text-base leading-none">{categoryStyles[category.id]?.emoji}</span>
                  <span className="truncate">{category.name}</span>
                  {count > 0 && (
                    <span className={cn('ml-auto text-xs', active ? 'opacity-80' : 'opacity-60')}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* Grid */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              {/* Hero: blank canvas card */}
              {selectedCategory === 'all' && !deferredQuery && (
                <button
                  onClick={() => handlePick(blank)}
                  className="group relative w-full mb-6 overflow-hidden rounded-2xl border border-dashed border-primary/40 bg-gradient-to-r from-primary/10 via-fuchsia-500/10 to-sky-500/10 p-6 text-left transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10 animate-fade-in"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-background/80 ring-1 ring-primary/30 group-hover:scale-110 transition-transform">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        Start from Blank Canvas
                        <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-0">Pro tip</Badge>
                      </h3>
                      <p className="text-sm text-muted-foreground">Build your own automation, node by node.</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              )}

              {filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="p-4 rounded-full bg-muted mb-3">
                    <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium">No templates match your search</p>
                  <p className="text-sm text-muted-foreground">Try different keywords or browse a category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredTemplates.map((template, idx) => {
                    const Icon = iconMap[template.icon] || FileText;
                    const category = workflowCategories.find(c => c.id === template.category);
                    const styles = categoryStyles[template.category] || categoryStyles.custom;
                    const isPopular = popular.has(template.id);
                    const isNew = fresh.has(template.id);

                    return (
                      <button
                        key={template.id}
                        onClick={() => handlePick(template)}
                        style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                        className={cn(
                          'group relative text-left overflow-hidden rounded-2xl border border-border/60 bg-card p-5',
                          'transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5',
                          'ring-1 ring-transparent', styles.ring, 'animate-fade-in'
                        )}
                      >
                        {/* gradient wash */}
                        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60 group-hover:opacity-100 transition-opacity', styles.gradient)} />

                        <div className="relative">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 rounded-xl bg-background/80 ring-1 ring-border/60 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex gap-1">
                              {isPopular && (
                                <Badge className="gap-1 bg-orange-500/15 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 border-0">
                                  <Flame className="h-3 w-3" /> Popular
                                </Badge>
                              )}
                              {isNew && (
                                <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-0">
                                  <Star className="h-3 w-3" /> New
                                </Badge>
                              )}
                            </div>
                          </div>

                          <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">
                            {template.name}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                            {template.description}
                          </p>

                          <div className="flex items-center justify-between">
                            {category && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <span>{styles.emoji}</span> {category.name}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" /> 2 min setup
                            </div>
                          </div>

                          <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            Use template <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowTemplateSelector;
