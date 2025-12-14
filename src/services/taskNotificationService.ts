import { supabase } from "@/integrations/supabase/client";

export type NotificationType = 
  | 'task_assigned'
  | 'task_completed'
  | 'task_status_changed'
  | 'task_due_reminder'
  | 'task_overdue'
  | 'task_comment'
  | 'project_update';

export interface TaskNotificationPayload {
  notificationType: NotificationType;
  taskId: string;
  taskTitle: string;
  taskDescription?: string | null;
  priority?: string;
  dueDate?: string | null;
  recipientUserId: string;
  triggeredByName: string;
  projectName?: string | null;
  oldStatus?: string;
  newStatus?: string;
  commentContent?: string;
  commentAuthor?: string;
}

export interface NotificationResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  emailId?: string;
  error?: any;
}

/**
 * Send a task notification email
 */
export async function sendTaskNotification(payload: TaskNotificationPayload): Promise<NotificationResult> {
  try {
    console.log('📧 Sending task notification:', payload.notificationType, payload.taskId);
    
    const { data, error } = await supabase.functions.invoke('send-task-notification', {
      body: payload,
    });

    if (error) {
      console.error('sendTaskNotification error:', error);
      return { ok: false, error };
    }

    if (data?.skipped) {
      console.log('📧 Notification skipped:', data.reason);
      return { ok: true, skipped: true, reason: data.reason };
    }

    console.log('📧 Notification sent successfully:', data?.emailId);
    return { ok: true, emailId: data?.emailId };
  } catch (err) {
    console.error('sendTaskNotification exception:', err);
    return { ok: false, error: err };
  }
}

/**
 * Get current user's display name for notifications
 */
export async function getCurrentUserDisplayName(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, full_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return 'Someone';
    }

    return data.display_name || data.full_name || data.email?.split('@')[0] || 'Someone';
  } catch {
    return 'Someone';
  }
}

/**
 * Get project name by ID
 */
export async function getProjectName(projectId: string | null): Promise<string | null> {
  if (!projectId) return null;
  
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.name;
  } catch {
    return null;
  }
}

/**
 * Helper to send task assigned notification
 */
export async function notifyTaskAssigned(
  taskId: string,
  taskTitle: string,
  assignedToId: string,
  assignedByUserId: string,
  options?: {
    taskDescription?: string | null;
    priority?: string;
    dueDate?: string | null;
    projectId?: string | null;
  }
): Promise<NotificationResult> {
  // Don't notify if assigning to self
  if (assignedToId === assignedByUserId) {
    return { ok: true, skipped: true, reason: 'self_assignment' };
  }

  const [triggeredByName, projectName] = await Promise.all([
    getCurrentUserDisplayName(assignedByUserId),
    getProjectName(options?.projectId || null)
  ]);

  return sendTaskNotification({
    notificationType: 'task_assigned',
    taskId,
    taskTitle,
    taskDescription: options?.taskDescription,
    priority: options?.priority,
    dueDate: options?.dueDate,
    recipientUserId: assignedToId,
    triggeredByName,
    projectName
  });
}

/**
 * Helper to send task completed notification
 */
export async function notifyTaskCompleted(
  taskId: string,
  taskTitle: string,
  completedByUserId: string,
  notifyUserIds: string[],
  projectId?: string | null
): Promise<NotificationResult[]> {
  const [triggeredByName, projectName] = await Promise.all([
    getCurrentUserDisplayName(completedByUserId),
    getProjectName(projectId || null)
  ]);

  const results = await Promise.all(
    notifyUserIds
      .filter(id => id !== completedByUserId)
      .map(recipientUserId => 
        sendTaskNotification({
          notificationType: 'task_completed',
          taskId,
          taskTitle,
          recipientUserId,
          triggeredByName,
          projectName
        })
      )
  );

  return results;
}

/**
 * Helper to send task status changed notification
 */
export async function notifyTaskStatusChanged(
  taskId: string,
  taskTitle: string,
  changedByUserId: string,
  recipientUserId: string,
  oldStatus: string,
  newStatus: string,
  projectId?: string | null
): Promise<NotificationResult> {
  // Don't notify if user changed their own task
  if (changedByUserId === recipientUserId) {
    return { ok: true, skipped: true, reason: 'self_change' };
  }

  const [triggeredByName, projectName] = await Promise.all([
    getCurrentUserDisplayName(changedByUserId),
    getProjectName(projectId || null)
  ]);

  return sendTaskNotification({
    notificationType: 'task_status_changed',
    taskId,
    taskTitle,
    recipientUserId,
    triggeredByName,
    projectName,
    oldStatus,
    newStatus
  });
}

/**
 * Helper to send task comment notification
 */
export async function notifyTaskComment(
  taskId: string,
  taskTitle: string,
  commentAuthorId: string,
  recipientUserId: string,
  commentContent: string,
  projectId?: string | null
): Promise<NotificationResult> {
  // Don't notify if user commented on their own task
  if (commentAuthorId === recipientUserId) {
    return { ok: true, skipped: true, reason: 'self_comment' };
  }

  const [commentAuthor, projectName] = await Promise.all([
    getCurrentUserDisplayName(commentAuthorId),
    getProjectName(projectId || null)
  ]);

  return sendTaskNotification({
    notificationType: 'task_comment',
    taskId,
    taskTitle,
    recipientUserId,
    triggeredByName: commentAuthor,
    commentContent,
    commentAuthor,
    projectName
  });
}

/**
 * Get user notification preferences
 */
export async function getUserNotificationPreferences(userId: string) {
  try {
    const { data, error } = await supabase.rpc('get_notification_preferences', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error fetching notification preferences:', error);
      // Return defaults
      return {
        email_task_assigned: true,
        email_task_completed: true,
        email_task_status_changed: true,
        email_task_due_reminder: true,
        email_task_overdue: true,
        email_task_comment: true,
        email_project_update: true,
        email_weekly_digest: true,
        due_reminder_hours: 24
      };
    }

    return data?.[0] || null;
  } catch (err) {
    console.error('Error in getUserNotificationPreferences:', err);
    return null;
  }
}

/**
 * Update user notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<{
    email_task_assigned: boolean;
    email_task_completed: boolean;
    email_task_status_changed: boolean;
    email_task_due_reminder: boolean;
    email_task_overdue: boolean;
    email_task_comment: boolean;
    email_project_update: boolean;
    email_weekly_digest: boolean;
    due_reminder_hours: number;
  }>
): Promise<{ ok: boolean; error?: any }> {
  try {
    const { error } = await supabase
      .from('user_notification_preferences')
      .upsert({
        user_id: userId,
        ...preferences
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error updating notification preferences:', error);
      return { ok: false, error };
    }

    return { ok: true };
  } catch (err) {
    console.error('Error in updateNotificationPreferences:', err);
    return { ok: false, error: err };
  }
}
