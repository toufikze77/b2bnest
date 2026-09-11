import { supabase } from '@/integrations/supabase/client';
import { Template } from '@/types/template';
import { buildBlueprint, TemplateBlueprint } from '@/lib/templateBlueprints';
import { assertActiveOrganization } from '@/lib/activeOrganization';

export interface AppliedTemplate {
  projectId: string;
  projectName: string;
  taskCount: number;
}

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

/**
 * Copies a marketplace template into the company currently selected in the
 * top-bar switcher as a working board (project + tasks). The tenant comes from
 * the caller's active organisation and is re-validated here — never from "the
 * first membership found".
 */
export const applyTemplateToWorkspace = async (
  template: Template,
  options: { organizationId: string | null; boardName?: string; blueprint?: TemplateBlueprint },
): Promise<AppliedTemplate> => {
  const { userId, organizationId } = await assertActiveOrganization(options.organizationId);
  const user = { id: userId };

  const blueprint = options?.blueprint ?? buildBlueprint(template);
  const name = options?.boardName?.trim() || blueprint.boardName;

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name,
      description: blueprint.description,
      color: blueprint.color,
      status: 'active',
      progress: 0,
      user_id: user.id,
      organization_id: organizationId,
      custom_fields: {
        source_template_id: template.id,
        source_template_title: template.title,
        applied_at: new Date().toISOString(),
      },
      // Board columns stay on the standard status pipeline so the generated
      // tasks (whose status values are backlog/todo/in-progress/review/done)
      // are visible immediately. Blueprint groups are kept as task labels.

    })
    .select('id, name')
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message || 'Could not create the board for this template.');
  }

  const tasks = blueprint.groups.flatMap((group) =>
    group.tasks.map((task) => ({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      due_date: addDays(task.dayOffset),
      labels: [...(task.labels ?? []), group.name],
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

  return { projectId: project.id, projectName: project.name, taskCount: tasks.length };
};
