-- Phase 11b: READ-ONLY. Run after proposal.sql (and data-step.sql), BEFORE enable-caps.sql, in the SQL editor.
-- One row per billing pool: what each limit would be and whether the pool is already over it the moment caps turn on.
-- Shows counts only (no names or emails). Over-limit pools keep everyone; they just can't add more until under the limit.
WITH pools AS (
  SELECT DISTINCT ON (b.billing_user_id) b.billing_user_id, b.organization_id AS any_org
    FROM public.organization_billing b ORDER BY b.billing_user_id, b.organization_id
)
SELECT row_number() OVER (ORDER BY p.billing_user_id) AS pool,
       s.pooled_companies, s.basis,
       s.used AS staff, s.pending AS pending_invites, s.seat_limit AS user_limit,
       a.admin_used AS admins, a.admin_pending AS pending_admin_invites, a.admin_limit,
       (s.seat_limit IS NOT NULL AND s.used + s.pending > s.seat_limit) AS over_user_limit,
       (a.admin_limit IS NOT NULL AND a.admin_used + a.admin_pending > a.admin_limit) AS over_admin_limit,
       (s.seat_limit IS NOT NULL AND s.used + s.pending >= s.seat_limit) AS full_users,
       (a.admin_limit IS NOT NULL AND a.admin_used + a.admin_pending >= a.admin_limit) AS full_admins
  FROM pools p
 CROSS JOIN LATERAL public._seat_pool(p.any_org) s
 CROSS JOIN LATERAL public._seat_pool_admins(p.any_org) a
 ORDER BY pool;
-- Companies with no billing owner can't add members today regardless of caps (unchanged):
SELECT count(*) AS companies_without_billing_owner
  FROM public.organizations o WHERE NOT EXISTS (SELECT 1 FROM public.organization_billing b WHERE b.organization_id=o.id);
