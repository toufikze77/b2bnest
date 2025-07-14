-- Delete user Adam/hamza and related data
-- First, get the user ID from profiles
DO $$
DECLARE
    user_id_to_delete UUID;
BEGIN
    -- Find user by email (toufikze@gmail.com is Adam from the logs)
    SELECT id INTO user_id_to_delete 
    FROM profiles 
    WHERE email = 'toufikze@gmail.com' 
    LIMIT 1;
    
    IF user_id_to_delete IS NOT NULL THEN
        -- Delete from all related tables first (due to foreign key constraints)
        DELETE FROM public.user_roles WHERE user_id = user_id_to_delete;
        DELETE FROM public.user_2fa_settings WHERE user_id = user_id_to_delete;
        DELETE FROM public.user_2fa_codes WHERE user_id = user_id_to_delete;
        DELETE FROM public.notifications WHERE user_id = user_id_to_delete;
        DELETE FROM public.user_favorites WHERE user_id = user_id_to_delete;
        DELETE FROM public.user_documents WHERE user_id = user_id_to_delete;
        DELETE FROM public.user_ai_preferences WHERE user_id = user_id_to_delete;
        DELETE FROM public.profiles WHERE id = user_id_to_delete;
        
        -- Delete from auth.users (this will cascade to other auth-related tables)
        DELETE FROM auth.users WHERE id = user_id_to_delete;
        
        RAISE NOTICE 'User with email toufikze@gmail.com has been deleted';
    ELSE
        RAISE NOTICE 'User with email toufikze@gmail.com not found';
    END IF;
END $$;