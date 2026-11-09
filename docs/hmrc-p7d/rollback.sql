-- =====================================================================================================================
-- HMRC P7d rollback (one transaction): gives anon EXECUTE back on the five helpers, exactly as production had it on
-- 9 Nov 2026 (an explicit anon grant; PUBLIC had none). Nothing else changes.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.is_project_member(uuid,uuid)', 'EXECUTE')
     AND has_function_privilege('anon', 'public.get_invitation_by_token(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'HMRC P7d is not applied';
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.owns_team(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_project(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon;
COMMIT;
