-- 1) companies: restrict SELECT to creators and super admins
DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;

CREATE POLICY "Company creators can view their companies"
ON public.companies
FOR SELECT
TO authenticated
USING (auth.uid() = created_by OR public.is_super_admin(auth.uid()));

-- 2) post_likes: remove stale/duplicate policies
DROP POLICY IF EXISTS "Forum post owners can view likes on their posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can remove their own likes" ON public.post_likes;