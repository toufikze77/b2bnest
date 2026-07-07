
DROP POLICY IF EXISTS "Anyone can view documents" ON public.documents;
CREATE POLICY "Users can view purchased or owned documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid())
    OR COALESCE(price, 0) = 0
    OR EXISTS (
      SELECT 1 FROM public.user_documents ud
      WHERE ud.document_id = documents.id AND ud.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.post_comments;
CREATE POLICY "Users can view comments on accessible posts"
  ON public.post_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.social_posts sp
      WHERE sp.id = post_comments.post_id
        AND (sp.is_public = true OR sp.user_id = auth.uid())
    )
  );
