import { supabase } from '@/integrations/supabase/client';

export class TaskDeleteError extends Error {}

/**
 * Permanently deletes one task under the existing todos delete rule (creator, assignee or
 * company admin). Resolves only when the database confirms exactly that row was removed;
 * a zero-row result (no permission, already gone, other company) throws.
 * Linked Marketing planned items keep their record; the database clears their task link.
 */
export async function deleteTaskConfirmed(taskId: string, organizationId: string | null): Promise<void> {
  let q = supabase.from('todos').delete().eq('id', taskId);
  q = organizationId ? q.eq('organization_id', organizationId) : q.is('organization_id', null);
  const { data, error } = await q.select('id');
  if (error) throw new TaskDeleteError(`Could not delete the task: ${error.message}`);
  if (!data || data.length !== 1) {
    throw new TaskDeleteError('The task was not deleted. You may not have permission (only its creator, assignee or a company admin can delete it), or it was already removed. Refresh and try again.');
  }
}
