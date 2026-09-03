REVOKE ALL ON FUNCTION public.check_trial_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_trial_status(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.preview_user_emissions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_user_emissions(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_team_with_owner(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_team_with_owner(text) TO authenticated, service_role;