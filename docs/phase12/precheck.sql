-- Phase 12: READ-ONLY. Counts only (no names, no emails). Runs before or after proposal.sql: it applies the same rules as
-- _access_state_for() inline. Answers: how many accounts would see the paywall the moment the new app ships?
-- A decision aid for the owner. Nothing here extends anyone's trial.
WITH roles AS (SELECT DISTINCT r.user_id FROM public.user_roles r WHERE r.role::text IN ('super_admin','admin','owner')),
ent AS (SELECT DISTINCT s.user_id FROM public.subscribers s
         WHERE CASE WHEN s.subscription_status IS NULL THEN coalesce(s.subscribed, false)
                    ELSE s.subscription_status IN ('active','trialing','past_due','unpaid') END),
co AS (SELECT m.user_id, b.billing_user_id AS bo FROM public.organization_members m
         JOIN public.organization_billing b ON b.organization_id = m.organization_id
        WHERE m.is_active AND b.billing_user_id <> m.user_id),
st AS (
  SELECT p.id,
    CASE WHEN p.id IN (SELECT user_id FROM roles) THEN '1 owner account (full access, never sees the paywall)'
         WHEN p.id IN (SELECT user_id FROM ent) THEN '2 subscribed (own subscription)'
         WHEN EXISTS (SELECT 1 FROM co JOIN ent ON ent.user_id = co.bo WHERE co.user_id = p.id) THEN '3 subscribed (follows the company''s paying owner)'
         WHEN p.trial_ends_at > now()
           OR EXISTS (SELECT 1 FROM co JOIN public.profiles bp ON bp.id = co.bo WHERE co.user_id = p.id AND bp.trial_ends_at > now())
           THEN '4 trial still running'
         WHEN EXISTS (SELECT 1 FROM co WHERE co.user_id = p.id) THEN '6 PAYWALL: company''s trial ended (member view, ask the owner)'
         ELSE '5 PAYWALL: own trial ended (chooses a plan)' END AS category
  FROM public.profiles p)
SELECT category, count(*) AS accounts FROM st GROUP BY category ORDER BY category;
