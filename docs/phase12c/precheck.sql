-- Phase 12c: READ-ONLY. Counts only (no names, no emails). Run just before proposal.sql.
-- Every account counted in "suspended (will be blocked)" sees "Your account has been suspended" as soon as the
-- proposal is applied. "suspended but protected" must be 0: super admins, admin/owner-role users and master accounts
-- are never blocked (the rule skips them), but if any is flagged, tell the owner before applying.
SELECT 'profiles' AS what, count(*) AS accounts FROM public.profiles
UNION ALL SELECT 'active (is_active true)', count(*) FROM public.profiles WHERE is_active
UNION ALL SELECT 'is_active null (treated as active)', count(*) FROM public.profiles WHERE is_active IS NULL
UNION ALL SELECT 'suspended (is_active false)', count(*) FROM public.profiles WHERE is_active = false
UNION ALL SELECT 'suspended but protected: super admin', count(*) FROM public.profiles p WHERE p.is_active = false
  AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role::text = 'super_admin')
UNION ALL SELECT 'suspended but protected: admin/owner role', count(*) FROM public.profiles p WHERE p.is_active = false
  AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role::text IN ('admin','owner'))
UNION ALL SELECT 'suspended but protected: master account', count(*) FROM public.profiles p WHERE p.is_active = false
  AND EXISTS (SELECT 1 FROM public.master_access m WHERE m.user_id = p.id)
UNION ALL SELECT 'suspended (will be blocked)', count(*) FROM public.profiles p WHERE p.is_active = false
  AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role::text IN ('super_admin','admin','owner'))
  AND NOT EXISTS (SELECT 1 FROM public.master_access m WHERE m.user_id = p.id);
