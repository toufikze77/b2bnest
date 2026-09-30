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
export type DuplicateReason = 'already_created' | 'in_progress' | 'incomplete';

export class DuplicateTemplateApplicationError extends Error {
  constructor(
    message: string,
    public existing: AppliedWorkspace | null,
    public reason: DuplicateReason = existing ? 'already_created' : 'in_progress',
    public workspaceId: string | null = null,
  ) {
    super(message);
    this.name = 'DuplicateTemplateApplicationError';
  }
}

/** A 'pending' attempt older than this is treated as stalled (tab closed / crashed). */
export const STALLED_ATTEMPT_MS = 10 * 60 * 1000;

const claims = () => (supabase as any).from('template_applications');

/**
 * Durable duplicate protection: records the attempt key in
 * template_applications (UNIQUE organization_id + idempotency_key).
 * - done: returns the existing result so the caller opens it (no new copy)
 * - pending: refused as "in progress", unless stalled and created by this
 *   user — then the stale record is removed and the attempt re-claimed once
 * - incomplete: refused with the workspace id so leftovers can be recovered
 */
const claimAttempt = async (
  organizationId: string, userId: string, key: string, templateSlug: string, retried = false,
): Promise<AppliedWorkspace | null> => {
  const { error } = await claims().insert({ organization_id: organizationId, idempotency_key: key, template_slug: templateSlug, created_by: userId });
  if (!error) return null;
  if (error.code !== '23505') throw new Error(error.message || 'Could not start creating this template.');
  const { data } = await claims()
    .select('status, kind, workspace_id, primary_project_id, created_by, created_at')
    .eq('organization_id', organizationId).eq('idempotency_key', key).maybeSingle();
  if (data?.status === 'done') {
    return { kind: data.kind, workspaceId: data.workspace_id, projects: [], primaryProjectId: data.primary_project_id ?? '', totalTasks: 0 };
  }
  if (data?.status === 'incomplete') {
    throw new DuplicateTemplateApplicationError(
      `An earlier attempt was left incomplete (workspace ${data.workspace_id ?? 'unknown'}). Remove its leftover boards before creating another copy.`,
      null, 'incomplete', data.workspace_id ?? null,
    );
  }
  const stalled = data?.status === 'pending' && data.created_by === userId && data.created_at
    && Date.now() - new Date(data.created_at).getTime() > STALLED_ATTEMPT_MS;
  if (stalled && !retried) {
    const { data: removed, error: delError } = await claims().delete()
      .eq('organization_id', organizationId).eq('idempotency_key', key).eq('status', 'pending').select('id');
    if (!delError && Array.isArray(removed) && removed.length === 1) {
      return claimAttempt(organizationId, userId, key, templateSlug, true);
    }
  }
  throw new DuplicateTemplateApplicationError('This template is already being created — please wait for it to finish.', null, 'in_progress');
};

export const applyWorkspaceTemplate = async (
  template: WorkspaceTemplate,
  options: {
    organizationId: string | null;
    workspaceName?: string;
    boardNames?: Record<string, string>;
    idempotencyKey?: string;
  },
): Promise<AppliedWorkspace> => {
  const { userId, organizationId } = await assertActiveOrganization(options.organizationId);
  const key = options.idempotencyKey;
  if (key) {
    const existing = await claimAttempt(organizationId, userId, key, template.slug);
    if (existing) throw new DuplicateTemplateApplicationError('This template was already created.', existing);
  }
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
        if (key) {
          await claims().update({ status: 'incomplete', workspace_id: workspaceId })
            .eq('organization_id', organizationId).eq('idempotency_key', key);
        }
        throw new WorkspaceCreationIncompleteError(
          error instanceof Error ? error.message : 'Creation failed.',
          { organizationId, workspaceId, workspaceName, templateSlug: template.slug, leftoverProjectIds: cleanup.leftoverProjectIds, cleanupError: cleanup.error },
        );
      }
    }
    // Clean failure: release the key so the user can try again.
    if (key) await claims().delete().eq('organization_id', organizationId).eq('idempotency_key', key);
    throw error;
  }

  const primaryProjectId = projects[0]?.id ?? '';
  if (key) {
    await claims().update({ status: 'done', kind, workspace_id: workspaceId, primary_project_id: primaryProjectId || null })
      .eq('organization_id', organizationId).eq('idempotency_key', key);
  }

  await logTemplateEvent(template.slug, 'created');

  return {
    kind,
    workspaceId,
    projects,
    primaryProjectId,
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
