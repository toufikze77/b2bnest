-- Durable workspace-template duplicate protection (template_applications).
-- Isolated local staging only. Applies the same DDL as migration
-- supabase/migrations/20260930013054_*.sql, then checks grants, RLS and the
-- UNIQUE duplicate-detection key. Requires 20_security_harness.sql.
set client_min_messages = warning;

\ir ../../supabase/migrations/20260930013054_403c6633-cfd2-4e79-a4e5-1f85ae854a26.sql

-- Seed one attempt per company (as superuser).
insert into public.template_applications(id, organization_id, idempotency_key, template_slug, status, created_by) values
  ('0a000000-0000-4000-8000-0000000000a1','0a000000-0000-4000-8000-000000000001','seed-a','crm','done','aaaaaaaa-0000-4000-8000-000000000003'),
  ('0b000000-0000-4000-8000-0000000000a1','0b000000-0000-4000-8000-000000000001','seed-b','crm','done','bbbbbbbb-0000-4000-8000-000000000003');

do $$
declare
  ORG_A constant text := '0a000000-0000-4000-8000-000000000001';
  ORG_B constant text := '0b000000-0000-4000-8000-000000000001';
  REC_A constant text := '0a000000-0000-4000-8000-0000000000a1';
  REC_B constant text := '0b000000-0000-4000-8000-0000000000a1';
begin
-- Grants
perform sec.t('TA-01','TEMPLATE_APPS','template_applications','ANON','SELECT','anon read','DENY_ERROR',
  'select 1 from public.template_applications');
perform sec.t('TA-02','TEMPLATE_APPS','template_applications','ANON','INSERT','anon insert','DENY_ERROR',
  format('insert into public.template_applications(organization_id, idempotency_key, created_by) values (%L,''k-anon'',sec.actor_uid(''A_MEMBER''))', ORG_A));
-- Same company: read allowed
perform sec.t('TA-03','TEMPLATE_APPS','template_applications','A_MEMBER','SELECT','own company record','ALLOW',
  format('select 1 from public.template_applications where id=%L', REC_A));
perform sec.t('TA-04','TEMPLATE_APPS','template_applications','A_OWNER','SELECT','colleague record in same company','ALLOW',
  format('select 1 from public.template_applications where id=%L', REC_A));
-- Cross-company
perform sec.t('TA-05','TEMPLATE_APPS','template_applications','A_MEMBER','SELECT','other company record','ZERO_ROWS',
  format('select 1 from public.template_applications where id=%L', REC_B));
perform sec.t('TA-06','TEMPLATE_APPS','template_applications','A_MEMBER','INSERT','claim key in other company','DENY_ERROR',
  format('insert into public.template_applications(organization_id, idempotency_key, created_by) values (%L,''k-x'',sec.actor_uid(''A_MEMBER''))', ORG_B));
perform sec.t('TA-07','TEMPLATE_APPS','template_applications','A_MEMBER','UPDATE','update other company record','ZERO_ROWS',
  format('update public.template_applications set status=''done'' where id=%L', REC_B));
perform sec.t('TA-08','TEMPLATE_APPS','template_applications','A_MEMBER','DELETE','delete other company record','ZERO_ROWS',
  format('delete from public.template_applications where id=%L', REC_B));
perform sec.t('TA-09','TEMPLATE_APPS','template_applications','B_OWNER','SELECT','company B owner cannot see A','ZERO_ROWS',
  format('select 1 from public.template_applications where id=%L', REC_A));
-- Cross-user within the same company
perform sec.t('TA-10','TEMPLATE_APPS','template_applications','A_ADMIN','INSERT','claim on behalf of another user','DENY_ERROR',
  format('insert into public.template_applications(organization_id, idempotency_key, created_by) values (%L,''k-y'',sec.actor_uid(''A_MEMBER''))', ORG_A));
perform sec.t('TA-11','TEMPLATE_APPS','template_applications','A_ADMIN','UPDATE','update colleague''s record','ZERO_ROWS',
  format('update public.template_applications set status=''pending'' where id=%L', REC_A));
perform sec.t('TA-12','TEMPLATE_APPS','template_applications','A_ADMIN','DELETE','delete colleague''s record','ZERO_ROWS',
  format('delete from public.template_applications where id=%L', REC_A));
perform sec.t('TA-13','TEMPLATE_APPS','template_applications','A_MEMBER','UPDATE','move own record to other company','DENY_ERROR',
  format('update public.template_applications set organization_id=%L where id=%L', ORG_B, REC_A));
-- Own records
perform sec.t('TA-14','TEMPLATE_APPS','template_applications','A_MEMBER','INSERT','claim new key in own company','ALLOW',
  format('insert into public.template_applications(organization_id, idempotency_key) values (%L,''k-new'')', ORG_A));
perform sec.t('TA-15','TEMPLATE_APPS','template_applications','A_MEMBER','UPDATE','mark own record done','ALLOW',
  format('update public.template_applications set status=''done'' where id=%L', REC_A));
perform sec.t('TA-16','TEMPLATE_APPS','template_applications','A_MEMBER','DELETE','release own record (stalled recovery)','ALLOW',
  format('delete from public.template_applications where id=%L', REC_A));
-- Duplicate-detection key
perform sec.t('TA-17','TEMPLATE_APPS','template_applications','A_OWNER','INSERT','same key again in same company','DENY_ERROR',
  format('insert into public.template_applications(organization_id, idempotency_key) values (%L,''seed-a'')', ORG_A));
perform sec.t('TA-18','TEMPLATE_APPS','template_applications','MULTI_ORG','INSERT','same key in a different company is independent','ALLOW',
  format('insert into public.template_applications(organization_id, idempotency_key) values (%L,''seed-a'')', ORG_B));
perform sec.t('TA-19','TEMPLATE_APPS','template_applications','UNASSIGNED','INSERT','user with no company','DENY_ERROR',
  format('insert into public.template_applications(organization_id, idempotency_key) values (%L,''k-z'')', ORG_A));
end $$;
