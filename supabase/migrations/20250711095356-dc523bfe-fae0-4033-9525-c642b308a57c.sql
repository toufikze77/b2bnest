-- Grant admin access to specific users
-- First, we need to find their user IDs from auth.users and then assign admin roles

-- This will assign admin role to the specified users when they exist
-- Note: This assumes the users have already signed up

DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Loop through the specified emails
    FOR user_record IN 
        SELECT id FROM auth.users 
        WHERE email IN ('toufik.zemri@outlook.com', 'toufikze@gmail.com')
    LOOP
        -- Insert admin role if it doesn't already exist
        INSERT INTO public.user_roles (user_id, role)
        VALUES (user_record.id, 'admin'::app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
        
        -- Log the action
        RAISE NOTICE 'Admin role granted to user ID: %', user_record.id;
    END LOOP;
END $$;