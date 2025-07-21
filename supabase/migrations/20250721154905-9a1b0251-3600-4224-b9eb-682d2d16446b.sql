
-- Fix the search_path security issue for update_post_reply_stats function
ALTER FUNCTION public.update_post_reply_stats() SET search_path = '';
