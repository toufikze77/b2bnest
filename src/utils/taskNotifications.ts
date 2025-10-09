import { supabase } from "@/integrations/supabase/client";

export interface TaskNotificationPayload {
  taskId: string;
  taskTitle: string;
  taskDescription?: string | null;
  priority: string;
  dueDate?: string | null;
  assignedToId: string;
  assignedByName: string;
  projectName?: string | null;
}

export async function sendTaskNotification(payload: TaskNotificationPayload) {
  try {
    const { data, error } = await supabase.functions.invoke('send-task-notification', {
      body: payload,
    });

    if (error) {
      console.error('sendTaskNotification error:', error);
      return { ok: false, error };
    }

    return { ok: true, data };
  } catch (err) {
    console.error('sendTaskNotification exception:', err);
    return { ok: false, error: err };
  }
}
