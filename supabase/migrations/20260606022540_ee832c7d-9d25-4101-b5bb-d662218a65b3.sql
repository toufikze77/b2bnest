CREATE OR REPLACE FUNCTION public.create_team_with_owner(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_slug text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Team name is required';
  END IF;

  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);

  INSERT INTO public.organizations (name, slug, created_by, is_active)
  VALUES (trim(p_name), v_slug, v_uid, true)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
  VALUES (v_org_id, v_uid, 'owner', true)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = 'owner', is_active = true;

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team_with_owner(text) TO authenticated;