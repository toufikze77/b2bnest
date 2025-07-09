-- Create missing profile for the user who has posts
INSERT INTO public.profiles (id, email, full_name, is_public)
VALUES ('3eac00c6-b29d-4dff-aef6-d9b1159e5c17', 'admin@example.com', 'Admin User', true)
ON CONFLICT (id) DO NOTHING;

-- Now add the foreign key relationship
ALTER TABLE public.social_posts 
ADD CONSTRAINT social_posts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;