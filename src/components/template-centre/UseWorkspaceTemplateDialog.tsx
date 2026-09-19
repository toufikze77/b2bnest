import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LayoutGrid, CheckCircle2 } from 'lucide-react';
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
import { WorkspaceTemplate } from '@/types/workspaceTemplate';
import { applyWorkspaceTemplate } from '@/services/workspaceTemplateApply';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrganization } from '@/contexts/OrganizationContext';

interface Props {
  template: WorkspaceTemplate | null;
  isOpen: boolean;
  onClose: () => void;
}

const UseWorkspaceTemplateDialog = ({ template, isOpen, onClose }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizationId, organization } = useActiveOrganization();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(template?.name ?? '');
  }, [template]);

  if (!template) return null;

  const totalTasks = template.boards.reduce(
    (sum, b) => sum + b.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );

  const handleApply = async () => {
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
      const result = await applyWorkspaceTemplate(template, {
        organizationId,
        workspaceName: name,
      });
      toast({
        title: 'Template added to your workspace',
        description: `${result.projects.length} ${
          result.projects.length === 1 ? 'board' : 'boards'
        } created with ${result.totalTasks} tasks.`,
      });
      onClose();
      navigate(`/project-management?project=${result.primaryProjectId}`);
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
            Use “{template.name}” in your workspace
          </DialogTitle>
          <DialogDescription>
            B2BNest creates a real working copy inside your own account — boards, groups, tasks,
            owners and due dates. Everything stays private to your organisation and is fully
            editable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Create in</span>
            <span className="truncate font-medium text-foreground">{organization?.name || 'No company selected'}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={template.name}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              What gets created{' '}
              <span className="text-muted-foreground">
                ({template.boards.length} {template.boards.length === 1 ? 'board' : 'boards'} ·{' '}
                {totalTasks} tasks)
              </span>
            </p>
            <ScrollArea className="h-64 rounded-md border border-border p-3">
              <div className="space-y-4">
                {template.boards.map((board) => (
                  <div key={board.name}>
                    <p className="text-sm font-semibold">{board.name}</p>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {board.columns.join(' · ')}
                    </p>
                    {board.groups.map((group) => (
                      <div key={group.name} className="mb-2">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          <p className="text-xs font-medium">{group.name}</p>
                          <Badge variant="secondary" className="text-[10px]">
                            {group.tasks.length}
                          </Badge>
                        </div>
                        <ul className="space-y-1 pl-4">
                          {group.tasks.map((task) => (
                            <li
                              key={task.title}
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{task.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={saving || !organizationId || !organization}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              `Create in ${organization?.name || 'selected company'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UseWorkspaceTemplateDialog;
