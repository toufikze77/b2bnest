import { supabase } from '@/integrations/supabase/client';
import { WorkspaceTemplate } from '@/types/workspaceTemplate';
import { logTemplateEvent } from '@/services/workspaceTemplateService';

export interface AppliedWorkspace {
  projects: Array<{ id: string; name: string; taskCount: number }>;
  primaryProjectId: string;
  totalTasks: number;
}

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

/** Resolves the caller's active organization, creating one when needed. */
const resolveOrganizationId = async (userId: string): Promise<string | null> => {
  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (member?.organization_id) return member.organization_id;

  const { data: created } = await supabase.rpc('ensure_user_has_org', { p_user_id: userId });
  return (created as string) ?? null;
};

/**
 * Creates a real working copy of a template inside the signed-in user's own
 * workspace: one project (board) per template board, with groups as labels and
 * every template task created as a real task.
 */
export const applyWorkspaceTemplate = async (
  template: WorkspaceTemplate,
  options?: { workspaceName?: string; boardNames?: Record<string, string> },
): Promise<AppliedWorkspace> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) throw new Error('Please sign in to use this template.');

  const organizationId = await resolveOrganizationId(user.id);
  const prefix = options?.workspaceName?.trim();
  const projects: AppliedWorkspace['projects'] = [];

  for (const board of template.boards) {
    const boardName =
      options?.boardNames?.[board.name]?.trim() ||
      (template.boards.length > 1 && prefix ? `${prefix} — ${board.name}` : prefix || board.name);

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: boardName,
        description: board.description,
        color: board.color,
        status: 'active',
        progress: 0,
        user_id: user.id,
        organization_id: organizationId,
        custom_fields: {
          source_template_slug: template.slug,
          source_template_name: template.name,
          template_type: template.templateType,
          board_columns: board.columns,
          board_views: board.views,
          board_statuses: board.statuses,
          automations: template.automations,
          ai_features: template.aiFeatures,
          applied_at: new Date().toISOString(),
        },
      })
      .select('id, name')
      .single();

    if (projectError || !project) {
      throw new Error(projectError?.message || 'Could not create the workspace for this template.');
    }

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
        user_id: user.id,
        organization_id: organizationId,
      })),
    );

    if (tasks.length > 0) {
      const { error: tasksError } = await supabase.from('todos').insert(tasks);
      if (tasksError) throw new Error(tasksError.message);
    }

    projects.push({ id: project.id, name: project.name, taskCount: tasks.length });
  }

  await logTemplateEvent(template.slug, 'created');

  return {
    projects,
    primaryProjectId: projects[0]?.id ?? '',
    totalTasks: projects.reduce((sum, p) => sum + p.taskCount, 0),
  };
};
