-- Grant full access (admin role) to toufikze@gmail.com
-- First, we need to find the user ID for this email and create a role entry

-- Insert admin role for the specific email
-- This assumes the user has already signed up. If not, they'll get the role when they sign up via the trigger
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users 
WHERE email = 'toufikze@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Also ensure they have a notification about their new permissions
INSERT INTO public.notifications (user_id, title, message, type)
SELECT id, 'Admin Access Granted', 'You have been granted full administrative access including Premium Marketplace privileges.', 'info'
FROM auth.users 
WHERE email = 'toufikze@gmail.com';