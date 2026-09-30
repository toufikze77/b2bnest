import React, { useEffect, useRef, useState } from 'react';
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
import { applyWorkspaceTemplate, WorkspaceCreationIncompleteError, IncompleteCreationInfo } from '@/services/workspaceTemplateApply';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { getTemplateKind, TEMPLATE_KIND_LABELS } from '@/lib/templateKind';

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
  const inFlight = useRef(false); // guards ONE in-flight attempt in this dialog only
  const [incomplete, setIncomplete] = useState<IncompleteCreationInfo | null>(null);

  useEffect(() => {
    setName(template?.name ?? '');
    setIncomplete(null);
  }, [template]);

  if (!template) return null;

  const totalTasks = template.boards.reduce(
    (sum, b) => sum + b.groups.reduce((s, g) => s + g.tasks.length, 0),
    0,
  );

  const kind = getTemplateKind(template);

  const handleApply = async () => {
    if (inFlight.current) return; // block repeated clicks
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Sign in to add this template to your workspace.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    inFlight.current = true;
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
      if (result.kind === 'workspace' && result.workspaceId) {
        navigate(`/workspaces/${result.workspaceId}`);
      } else {
        navigate(`/project-management?project=${result.primaryProjectId}`);
      }
    } catch (error) {
      if (error instanceof WorkspaceCreationIncompleteError) setIncomplete(error.info);
      toast({
        title: 'Could not use this template',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Use “{template.name}”
            <Badge variant="outline" className="ml-1 text-[11px] font-normal">{TEMPLATE_KIND_LABELS[kind]}</Badge>
          </DialogTitle>
          <DialogDescription>
            {kind === 'workspace'
              ? 'Creates a workspace with several boards, their groups and tasks. It opens in its own workspace view with the boards listed on the left.'
              : 'Creates one project with its groups and tasks, opened in Projects & tasks.'}{' '}
            Everything stays inside the selected company and is fully editable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Create in</span>
            <span className="truncate font-medium text-foreground">{organization?.name || 'No company selected'}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace-name">{kind === 'workspace' ? 'Workspace name' : 'Project name'}</Label>
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

        {incomplete && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <p className="font-medium">Creation was incomplete.</p>
            <p className="mt-1">
              {incomplete.leftoverProjectIds.length} partly created board(s) could not be removed automatically
              {incomplete.workspaceId ? ' and will appear under Workspaces' : ' and will appear in Projects & tasks'}.
              You can delete them there, or send these references to support:
            </p>
            <p className="mt-1 break-all font-mono">
              workspace {incomplete.workspaceId ?? '—'} · boards {incomplete.leftoverProjectIds.join(', ')}
            </p>
          </div>
        )}
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
