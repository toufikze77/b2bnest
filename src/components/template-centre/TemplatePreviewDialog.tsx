import React from 'react';
import { Sparkles, CheckCircle2, LayoutGrid, Workflow, Users, Target } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import TemplateThumbnail from '@/components/template-center/TemplateThumbnail';
import { WorkspaceTemplate, TEMPLATE_TYPE_LABELS } from '@/types/workspaceTemplate';
import { categoryName, planLabel } from './TemplateCard';

interface Props {
  template: WorkspaceTemplate | null;
  isOpen: boolean;
  hasPremiumAccess: boolean;
  onClose: () => void;
  onUse: (t: WorkspaceTemplate) => void;
}

const Section = ({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
}) =>
  items.length ? (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </p>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

const TemplatePreviewDialog = ({ template, isOpen, hasPremiumAccess, onClose, onUse }: Props) => {
  if (!template) return null;
  const totalTasks = template.boards.reduce(
    (sum, b) => sum + b.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-6 pb-4">
          <DialogTitle className="text-xl">{template.name}</DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline">{categoryName(template.category)}</Badge>
            <Badge variant="outline">{template.subcategory}</Badge>
            <Badge variant="outline">{TEMPLATE_TYPE_LABELS[template.templateType]}</Badge>
            {template.isAiPowered && (
              <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/15">
                <Sparkles className="h-3 w-3" /> AI-Powered
              </Badge>
            )}
            <Badge variant="secondary">{planLabel(template, hasPremiumAccess)}</Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-6 p-6 md:grid-cols-2">
            <div className="space-y-6">
              <div className="h-44 rounded-lg border border-border bg-muted/30 p-3">
                <TemplateThumbnail seed={template.slug} title={template.name} />
              </div>
              <p className="text-sm text-muted-foreground">{template.longDescription}</p>
              <Section icon={Users} title="Who is it for?" items={template.whoItsFor} />
              <Section icon={Target} title="What it helps you manage" items={template.helpsYouManage} />
              <Section icon={Sparkles} title="AI capabilities" items={template.aiFeatures} />
            </div>

            <div className="space-y-6">
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <LayoutGrid className="h-4 w-4 text-primary" /> Template structure
                  <span className="font-normal text-muted-foreground">
                    ({template.boards.length} {template.boards.length === 1 ? 'board' : 'boards'} ·{' '}
                    {totalTasks} tasks)
                  </span>
                </p>
                <div className="space-y-3">
                  {template.boards.map((board) => (
                    <div key={board.name} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-semibold">{board.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Columns: {board.columns.join(' · ')}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Views: {board.views.join(' · ')}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {board.groups.map((g) => (
                          <li key={g.name} className="flex items-center gap-2 text-xs">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            <span className="font-medium">{g.name}</span>
                            <Badge variant="outline" className="ml-auto text-[10px]">
                              {g.tasks.length} tasks
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <Section icon={CheckCircle2} title="Included features" items={template.features} />
              <Section icon={Workflow} title="Included automations" items={template.automations} />
              <Section icon={Workflow} title="Example workflow" items={template.exampleWorkflow} />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t border-border p-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => onUse(template)}>
            <LayoutGrid className="mr-2 h-4 w-4" /> Use template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplatePreviewDialog;
