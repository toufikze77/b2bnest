
-- 1) Fix profile email exposure: drop overly broad org-member SELECT policy.
-- Org members should use the public_profiles view (no email) or get_user_display_info().
DROP POLICY IF EXISTS "Organization members can view team profiles" ON public.profiles;

-- 2) Fix user_roles privilege escalation
-- Drop existing owner-only policies and replace with stricter versions that
-- prevent owners from creating additional owners and from modifying their own role row.
DROP POLICY IF EXISTS "Owners can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can delete roles" ON public.user_roles;

-- Owners can grant roles, but NOT the 'owner' role, and NOT to themselves
CREATE POLICY "Owners can insert non-owner roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'owner'::public.app_role)
  AND role <> 'owner'::public.app_role
  AND user_id <> auth.uid()
);

-- Owners can update other users' role rows, but cannot set role to 'owner'
-- and cannot modify their own role row (prevents self-tampering)
CREATE POLICY "Owners can update non-owner roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner'::public.app_role)
  AND user_id <> auth.uid()
  AND role <> 'owner'::public.app_role
)
WITH CHECK (
  public.has_role(auth.uid(), 'owner'::public.app_role)
  AND user_id <> auth.uid()
  AND role <> 'owner'::public.app_role
);

-- Owners can delete role rows, but not 'owner' rows and not their own
CREATE POLICY "Owners can delete non-owner roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner'::public.app_role)
  AND user_id <> auth.uid()
  AND role <> 'owner'::public.app_role
);

-- 3) Fix todo_history INSERT abuse: require the inserter to be the owner
-- or assignee of the referenced todo. Service role bypasses RLS automatically.
DROP POLICY IF EXISTS "System can insert history records" ON public.todo_history;

CREATE POLICY "Users can insert history for their todos"
ON public.todo_history
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.todos t
    WHERE t.id = todo_history.todo_id
      AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid())
  )
);
