import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LayoutGrid, Download, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/use-toast';
import { Template } from '@/types/template';
import { buildBlueprint } from '@/lib/templateBlueprints';
import { applyTemplateToWorkspace } from '@/services/templateApplyService';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  template: Template | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (template: Template) => void;
}

const UseTemplateDialog: React.FC<Props> = ({ template, isOpen, onClose, onDownload }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const blueprint = useMemo(() => (template ? buildBlueprint(template) : null), [template]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const boardName = name || blueprint?.boardName || '';

  const handleApply = async () => {
    if (!template || !blueprint) return;
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Sign in to add this template to your workspace.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    setSaving(true);
    try {
      const result = await applyTemplateToWorkspace(template, { boardName, blueprint });
      toast({
        title: 'Template added to your workspace',
        description: `${result.projectName} was created with ${result.taskCount} tasks.`,
      });
      onClose();
      navigate(`/project-management?project=${result.projectId}`);
    } catch (error) {
      toast({
        title: 'Could not use this template',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Use “{template?.title}” in your account
          </DialogTitle>
          <DialogDescription>
            This copies the template into your own workspace as a working board with pre-filled
            groups and tasks. Everything stays private to your account and you can edit it freely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="board-name">Board name</Label>
            <Input
              id="board-name"
              value={boardName}
              onChange={(e) => setName(e.target.value)}
              placeholder={blueprint?.boardName}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              What you get{' '}
              <span className="text-muted-foreground">
                ({blueprint?.groups.length ?? 0} groups · {blueprint?.totalTasks ?? 0} tasks)
              </span>
            </p>
            <ScrollArea className="h-64 rounded-md border border-border p-3">
              <div className="space-y-4">
                {blueprint?.groups.map((group) => (
                  <div key={group.name}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <p className="text-sm font-semibold">{group.name}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {group.tasks.length}
                      </Badge>
                    </div>
                    <ul className="space-y-1 pl-4">
                      {group.tasks.map((task) => (
                        <li
                          key={task.title}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{task.title}</span>
                          <Badge variant="outline" className="ml-auto shrink-0 text-[10px] capitalize">
                            {task.priority}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {onDownload && template && (
            <Button variant="outline" onClick={() => onDownload(template)} disabled={saving}>
              <Download className="mr-2 h-4 w-4" /> Download file instead
            </Button>
          )}
          <Button onClick={handleApply} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding…
              </>
            ) : (
              'Add to my workspace'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UseTemplateDialog;
