-- Create user notification preferences table with all options enabled by default
CREATE TABLE public.user_notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Email notification settings (all enabled by default)
  email_task_assigned BOOLEAN NOT NULL DEFAULT true,
  email_task_completed BOOLEAN NOT NULL DEFAULT true,
  email_task_status_changed BOOLEAN NOT NULL DEFAULT true,
  email_task_due_reminder BOOLEAN NOT NULL DEFAULT true,
  email_task_overdue BOOLEAN NOT NULL DEFAULT true,
  email_task_comment BOOLEAN NOT NULL DEFAULT true,
  email_project_update BOOLEAN NOT NULL DEFAULT true,
  email_weekly_digest BOOLEAN NOT NULL DEFAULT true,
  -- Reminder timing (hours before due date)
  due_reminder_hours INTEGER NOT NULL DEFAULT 24,
  -- Created/updated timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Ensure one preferences record per user
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own preferences
CREATE POLICY "Users can view own notification preferences"
ON public.user_notification_preferences
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
ON public.user_notification_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
ON public.user_notification_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Function to auto-create notification preferences for new users
CREATE OR REPLACE FUNCTION public.ensure_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to create preferences when a new user is created
CREATE TRIGGER on_auth_user_created_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_notification_preferences();

-- Function to get user notification preferences (creates if not exists)
CREATE OR REPLACE FUNCTION public.get_notification_preferences(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  email_task_assigned BOOLEAN,
  email_task_completed BOOLEAN,
  email_task_status_changed BOOLEAN,
  email_task_due_reminder BOOLEAN,
  email_task_overdue BOOLEAN,
  email_task_comment BOOLEAN,
  email_project_update BOOLEAN,
  email_weekly_digest BOOLEAN,
  due_reminder_hours INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insert default preferences if they don't exist
  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Return the preferences
  RETURN QUERY
  SELECT 
    np.email_task_assigned,
    np.email_task_completed,
    np.email_task_status_changed,
    np.email_task_due_reminder,
    np.email_task_overdue,
    np.email_task_comment,
    np.email_project_update,
    np.email_weekly_digest,
    np.due_reminder_hours
  FROM public.user_notification_preferences np
  WHERE np.user_id = p_user_id;
END;
$$;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_notification_preferences_timestamp
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();

-- Create notification log table for tracking sent notifications
CREATE TABLE public.notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  task_id UUID,
  project_id UUID,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_id TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Only allow viewing own notification logs
CREATE POLICY "Users can view own notification logs"
ON public.notification_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_notification_logs_user_id ON public.notification_logs(user_id);
CREATE INDEX idx_notification_logs_task_id ON public.notification_logs(task_id);
CREATE INDEX idx_notification_logs_created_at ON public.notification_logs(created_at DESC);