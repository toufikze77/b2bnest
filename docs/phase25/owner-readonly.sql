-- Phase 25: read-only queries for the owner (SQL editor). Nothing here changes anything.
-- Run A before applying proposal.sql (it must say 66 / 0 / 0 / 0 / 0 / 0 / 0). Run B after step 1 of the rollout.
-- Run C right after applying proposal.sql, and D whenever you want to see who has two-step sign-in.

-- A. Dry run of proposal.sql step 4: every guarded function is present, unchanged since 1 Nov 2026, has one BEGIN
--    (plpgsql) and its body appears exactly once in its definition. Expected: 66 | 0 | 0 | 0 | 0 | 0 | ... | 0
with e(fn, md5, lang) as (values
('public.add_project_member(uuid,uuid,text)','d3265b4de0446bf1c8fdf442cd8d8152','plpgsql'),
('public.add_team_member(uuid,uuid,text)','b355f1b6074ab1495482855bf0c8912d','plpgsql'),
('public.admin_ai_stats(integer)','5a17153d6ec7b5ba4ce88951c9718d32','plpgsql'),
('public.admin_analytics_series(integer)','ef73c76ec5bc55f7d2de258f32f560d3','plpgsql'),
('public.admin_company_detail(uuid)','d713cd52fd12e99b2c2e20ddd5149a97','plpgsql'),
('public.admin_documents_summary(integer,integer)','743ec51088be8f7fcb36b3cd5bffde41','plpgsql'),
('public.admin_list_companies(text,integer,integer,text,text)','eb023cf0285d8ffd343666854c908735','plpgsql'),
('public.admin_list_projects(text,text,integer,integer)','89f93b80aecdee9b1b971dca57ddca73','plpgsql'),
('public.admin_list_subscriptions(text,text,integer,integer)','9aa1e534f719b2e77fb59d18dea15902','plpgsql'),
('public.admin_list_users(text,text,integer,integer,text)','06e9ec0e08c798ab24930351d186784b','plpgsql'),
('public.admin_log_action(text,text,text,jsonb,text)','3f16954629693957cd672738dc4da231','plpgsql'),
('public.admin_moderate_post(uuid,boolean)','bc5c6d11a5bc913de783a5cd6f141469','plpgsql'),
('public.admin_overview_stats()','7cf74323ae1aee59627a6a7ab8f66671','plpgsql'),
('public.admin_set_company_status(uuid,text,text)','52b9ce7c126fae23f725a440e2ba0b16','plpgsql'),
('public.admin_set_user_role(uuid,app_role)','bf3c810383b11ee36d105c883d2579ec','plpgsql'),
('public.admin_set_user_status(uuid,boolean)','4ac8b3ff4231a511ee75d23d6c8c4864','plpgsql'),
('public.admin_social_stats(integer)','4bf7ab3b3244384efd5d26701a77b4e3','plpgsql'),
('public.admin_support_overview(text,integer,integer)','10b33e02a55e31a6c29e2b4d079d6e5a','plpgsql'),
('public.admin_system_health()','d178a8b191930a97a28615beecd7f2ae','plpgsql'),
('public.admin_tools_overview()','b74127cbbe7a33b650adb77995cc9d20','plpgsql'),
('public.admin_update_company(uuid,text,text)','6c0b2de0174f6edabce413bee465dfcb','plpgsql'),
('public.audit_profile_access(uuid,text)','3330b078d629e818909ab2109084c3fe','plpgsql'),
('public.check_and_deduct_ai_credit(uuid,integer)','53eb000e38a6e12091f01db15d67fe33','plpgsql'),
('public.check_trial_status(uuid)','5dea0dad6ae4b80cbe954f198d5a2afc','plpgsql'),
('public.create_team_with_owner(text)','b7e718fd766e288a8f2b34c9be994aee','plpgsql'),
('public.ensure_user_has_org(uuid)','a349679bfc307cc77bd076a5aa4d620a','plpgsql'),
('public.get_advertisement_contact_info(uuid)','79c4122a307fa16e43a0738973525c26','plpgsql'),
('public.get_ai_credits_info(uuid)','a7798e0139e35a8b906cda0e646dd01f','plpgsql'),
('public.get_bank_account_details(uuid,uuid)','804a4cccf135cf913ecd5fba341245e9','plpgsql'),
('public.get_bank_accounts_safe(uuid)','9b8d49130828c497e78cc5200dcf4dd5','plpgsql'),
('public.get_hmrc_client_secret(uuid)','403c818389211da9a1ea33bc128e1385','plpgsql'),
('public.get_hmrc_tokens(uuid)','4867b5d3a4916a132a0a856da02d3dd1','plpgsql'),
('public.get_integration_tokens(text,uuid)','dbc39c173e758867585111ececa26a60','plpgsql'),
('public.get_notification_preferences(uuid)','8c4c2f2de88f023fac5234447fc36293','plpgsql'),
('public.get_team_members_with_profiles(uuid)','3ff7303e3409b492dc6702ebd43bd315','plpgsql'),
('public.get_user_display_info(uuid)','831c6b61eb0f283b778197e9e5eb9cc7','plpgsql'),
('public.get_user_integrations_safe(uuid)','fc466221a995548f812a38f6244c9a48','plpgsql'),
('public.get_user_payments(uuid)','65600a5a945d36487a28a40a1c410cbd','plpgsql'),
('public.get_user_projects(uuid)','8f043e3e89920108a782be482e0d6619','plpgsql'),
('public.get_user_staking_tier(uuid)','b680c38f0cd6fb6ee394430df9e7f60a','sql'),
('public.get_user_teams(uuid)','1d68f11e1acc534368de02889a525ba7','plpgsql'),
('public.list_master_access()','a2225ae0331a85edf936f913736cec7c','plpgsql'),
('public.log_user_action(uuid,text,text,text,jsonb,inet,text)','9f237eafe55bcfb032c56f8fc3da1e66','plpgsql'),
('public.my_access_state()','d6811283c32999b3fc5dca5a4f897779','plpgsql'),
('public.onboarding_email_status(uuid)','e493cbc9de1a0f93fd319707f4955ffe','plpgsql'),
('public.org_accept_invitation(text)','5c7efc62f52e44bb57d4c78b852d1058','plpgsql'),
('public.org_invitation_preview(text)','35b299a33e857d78eb0a9210712ae8ff','plpgsql'),
('public.org_invitation_token(uuid)','35a3244734e314dd206043b75074b349','plpgsql'),
('public.org_invite_member(uuid,text,text)','d87a3b5634c06ded54cfed58913ef875','plpgsql'),
('public.org_manage_invitation(uuid,text)','aeb1ed453ebb3e0fe5c68885436b9d9a','plpgsql'),
('public.org_seat_summary(uuid)','88546128c926225d171ac07d0c8d204c','plpgsql'),
('public.platform_set_billing_owner(uuid,uuid,text)','1bf159cb71b31ee8df3d5afa7a7cd898','plpgsql'),
('public.preview_user_emissions(uuid)','93b789b1d0acbd3506a9bc315b9cb30f','plpgsql'),
('public.resolve_active_organization(uuid)','94fcd71d079a93f3dbc4f16a931b230e','plpgsql'),
('public.rota_can_add_employee(uuid)','5aa99db1e31d8a6da820fe1bee63438c','plpgsql'),
('public.set_master_access(uuid,boolean,text)','760422e973882bbbd36ea69d6fb50f03','plpgsql'),
('public.store_bank_account(text,text,text,text,text,text,text,numeric,numeric,uuid)','a4077086440c8f5b71d7705b9e950c8f','plpgsql'),
('public.store_integration_tokens(text,text,text,timestamp with time zone,jsonb,uuid)','e2cf64c4dc5977ff6b5fd222dba066bd','plpgsql'),
('public.support_add_attachment(uuid,uuid,text,text,integer,text,boolean)','98a658505d5e94136b197e5d3e9877f4','plpgsql'),
('public.support_add_message(uuid,text,boolean,uuid)','68720c7820da075e2abf03ad8ccc7ec8','plpgsql'),
('public.support_claim_invitations()','e6201a72e8659ed6b320f7b67dbb421e','plpgsql'),
('public.support_create_ticket(uuid,text,text,uuid,text,uuid)','963e2e95d62678d9c0c5e8d676fab034','plpgsql'),
('public.support_submit_feedback(uuid,integer,text)','cc4843e6a3229691f06b41d573f254d3','plpgsql'),
('public.support_update_ticket(uuid,text,text,uuid,uuid,boolean)','8b2885431678c744e975a645975579d4','plpgsql'),
('public.wave1_list_reconcilable_projects()','9e15cf8dab9c1b456a23690d1b78dcb5','sql'),
('public.wave1_reconcile_project(uuid,uuid)','dbfcd3a8b4d347763278733d813d75e0','plpgsql'))
select
  count(*) as functions,
  count(*) filter (where to_regprocedure(e.fn) is null) as missing,
  count(*) filter (where md5(p.prosrc) <> e.md5) as changed,
  count(*) filter (where e.lang = 'plpgsql' and (regexp_match(p.prosrc, '^(.*?\mbegin\M)', 'is')) is null) as no_begin,
  count(*) filter (where (length(pg_get_functiondef(p.oid)) - length(replace(pg_get_functiondef(p.oid), '$function$' || p.prosrc || '$function$', ''))) <> length('$function$' || p.prosrc || '$function$')) as body_not_unique,
  count(*) filter (where e.lang = 'plpgsql' and regexp_replace((regexp_match(p.prosrc, '^(.*?\mbegin\M)', 'is'))[1], '^.*\n', '') !~* '^\s*begin$') as begin_not_on_its_own_line,
  max(length((regexp_match(p.prosrc, '^(.*?\mbegin\M)', 'is'))[1])) as longest_prefix,
  count(*) filter (where position('phase25 mfa guard' in p.prosrc) > 0) as already_guarded
from e left join pg_proc p on p.oid = to_regprocedure(e.fn);

-- B. Before applying: how many accounts have an authenticator app (counts only). If not 0, those people must be
--    able to see the code screen (frontend live) before proposal.sql is applied.
select count(distinct user_id) filter (where status::text = 'verified') as people_with_an_app,
       count(*) filter (where status::text = 'unverified') as half_finished_setups
from auth.mfa_factors;

-- C. After applying: expected 98 | 66 | 22 | true.
select (select count(*) from pg_policies where schemaname = 'public' and policyname = 'require_aal2_if_enrolled') as tables_with_policy,
       (select count(*) from public.phase25_mfa_guard_log) as guarded_functions,
       (select count(*) from public.phase25_mfa_guard_log where kind = 'admin') as admin_functions,
       (select admin_requires_aal2 from public.security_settings) as admin_requires_aal2;

-- D. Who has two-step sign-in (no secrets): one row per person with a verified app.
select f.user_id, u.email, count(*) as apps, min(f.created_at) as since
from auth.mfa_factors f join auth.users u on u.id = f.user_id
where f.status::text = 'verified' group by f.user_id, u.email order by since;

-- E. Owner-assisted resets (Admin → Users → Reset two-step sign-in), newest first.
select created_at, user_id as whose_account, details ->> 'admin_id' as reset_by, details ->> 'reason' as reason, details ->> 'factors' as apps_removed
from public.audit_logs where action = 'two_step_reset_by_admin' order by created_at desc limit 50;
