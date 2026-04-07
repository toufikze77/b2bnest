-- Grant necessary permissions on profiles table to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Also ensure the notification preferences table has proper grants
GRANT SELECT, INSERT, UPDATE ON public.user_notification_preferences TO authenticated;