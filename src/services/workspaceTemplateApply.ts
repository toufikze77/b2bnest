import { supabase } from '@/integrations/supabase/client';
import { WorkspaceTemplate } from '@/types/workspaceTemplate';
import { logTemplateEvent } from '@/services/workspaceTemplateService';
import { assertActiveOrganization } from '@/lib/activeOrganization';
import { getTemplateKind, TemplateKind } from '@/lib/templateKind';

export interface AppliedWorkspace {
  kind: TemplateKind;
  workspaceId: string | null;
  projects: Array<{ id: string; name: string; taskCount: number }>;
  primaryProjectId: string;
  totalTasks: number;
}

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

/**
 * Creates a real working copy of a template inside the company currently
 * selected in the top-bar switcher. The tenant is never inferred: the caller
 * passes the active organisation and it is re-validated against the caller's
 * active memberships before anything is created. No company is ever created
 * or switched here.
 *
 * Workspace templates (several boards) are grouped by a shared
 * custom_fields.workspace.id so they open together in /workspaces/:id.
 * If any step fails, rows created by this call are removed again.
 */
export const applyWorkspaceTemplate = async (
  template: WorkspaceTemplate,
  options: {
    organizationId: string | null;
    workspaceName?: string;
    boardNames?: Record<string, string>;
  },
): Promise<AppliedWorkspace> => {
  const { userId, organizationId } = await assertActiveOrganization(options.organizationId);
  const kind = getTemplateKind(template);
  const prefix = options?.workspaceName?.trim();
  const workspaceId = kind === 'workspace' ? crypto.randomUUID() : null;
  const workspaceName = prefix || template.name;
  const projects: AppliedWorkspace['projects'] = [];
  const createdIds: string[] = [];

  try {
    for (const [index, board] of template.boards.entries()) {
      const boardName =
        options?.boardNames?.[board.name]?.trim() ||
        (kind === 'workspace' ? board.name : prefix || board.name);

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: boardName,
          description: board.description,
          color: board.color,
          status: 'active',
          progress: 0,
          user_id: userId,
          organization_id: organizationId,
          custom_fields: {
            source_template_slug: template.slug,
            source_template_name: template.name,
            template_type: template.templateType,
            template_kind: kind,
            workspace: workspaceId
              ? { id: workspaceId, name: workspaceName, board_index: index, board_count: template.boards.length }
              : null,
            board_columns: board.columns,
            board_views: board.views,
            board_statuses: board.statuses,
            board_groups: board.groups.map((g) => g.name),
            automations: template.automations,
            ai_features: template.aiFeatures,
            applied_at: new Date().toISOString(),
          },
        })
        .select('id, name')
        .single();

      if (projectError || !project) {
        throw new Error(projectError?.message || 'Could not create a board for this template.');
      }
      createdIds.push(project.id);

      const tasks = board.groups.flatMap((group) =>
        group.tasks.map((task) => ({
          title: task.title,
          description: task.description ?? '',
          status: task.status,
          priority: task.priority,
          due_date: addDays(task.dayOffset),
          labels: [group.name],
          estimated_hours: task.estimatedHours ?? null,
          project_id: project.id,
          user_id: userId,
          organization_id: organizationId,
        })),
      );

      if (tasks.length > 0) {
        const { error: tasksError } = await supabase.from('todos').insert(tasks);
        if (tasksError) throw new Error(tasksError.message);
      }

      projects.push({ id: project.id, name: project.name, taskCount: tasks.length });
    }
  } catch (error) {
    // Best-effort cleanup (creation is NOT transactional): remove only rows
    // created by this attempt, then verify the deletes actually happened.
    if (createdIds.length) {
      const cleanup = await cleanupCreated(createdIds, organizationId);
      if (!cleanup.ok) {
        throw new WorkspaceCreationIncompleteError(
          error instanceof Error ? error.message : 'Creation failed.',
          { organizationId, workspaceId, workspaceName, templateSlug: template.slug, leftoverProjectIds: cleanup.leftoverProjectIds, cleanupError: cleanup.error },
        );
      }
    }
    throw error;
  }

  await logTemplateEvent(template.slug, 'created');

  return {
    kind,
    workspaceId,
    projects,
    primaryProjectId: projects[0]?.id ?? '',
    totalTasks: projects.reduce((sum, p) => sum + p.taskCount, 0),
  };
};

export interface IncompleteCreationInfo {
  organizationId: string;
  workspaceId: string | null;
  workspaceName: string;
  templateSlug: string;
  leftoverProjectIds: string[];
  cleanupError: string | null;
}

/** Thrown when creation failed AND automatic cleanup could not remove everything. */
export class WorkspaceCreationIncompleteError extends Error {
  info: IncompleteCreationInfo;
  constructor(cause: string, info: IncompleteCreationInfo) {
    super(
      `Creation failed (${cause}) and ${info.leftoverProjectIds.length} partly created board(s) could not be removed automatically.`,
    );
    this.name = 'WorkspaceCreationIncompleteError';
    this.info = info;
    // Keep a recoverable record in the browser console for support.
    console.error('[workspace-template] incomplete creation', info);
  }
}

export const cleanupCreated = async (projectIds: string[], organizationId: string) => {
  const { error: tErr } = await supabase
    .from('todos').delete().in('project_id', projectIds).eq('organization_id', organizationId);
  const { data, error: pErr } = await supabase
    .from('projects').delete().in('id', projectIds).eq('organization_id', organizationId).select('id');
  const deleted = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
  const leftoverProjectIds = projectIds.filter((id) => !deleted.has(id));
  const error = tErr?.message ?? pErr?.message ?? null;
  return { ok: !error && leftoverProjectIds.length === 0, leftoverProjectIds, error };
};
