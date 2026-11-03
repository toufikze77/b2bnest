-- =====================================================================================================================
-- Phase 39 rollback (one transaction). Removes public.free_tool_items, public.marketing_consents, their functions,
-- trigger and Phase 25 guard log rows. Nothing that existed before Phase 39 is changed.
--
-- !!! DATA: this DROPS what people saved to their account from the free tools, and the record of who agreed to marketing
-- !!! emails (and when). It REFUSES while either table has rows, unless you first export both
-- !!!   (select * from public.free_tool_items;  select * from public.marketing_consents;)
-- !!! and then run it with   SET LOCAL app.phase39_force = 'on';   (inside the same transaction, after BEGIN).
-- !!! Keep the consent export: under UK GDPR you must be able to show when and how each person agreed.
-- !!! Publish the previous frontend first (or leave it: it falls back to browser-only saving).
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.free_tool_items') IS NULL OR to_regclass('public.marketing_consents') IS NULL THEN
    RAISE EXCEPTION 'Phase 39 is not applied';
  END IF;
  IF (EXISTS (SELECT 1 FROM public.free_tool_items) OR EXISTS (SELECT 1 FROM public.marketing_consents))
     AND COALESCE(current_setting('app.phase39_force', true), '') <> 'on' THEN
    RAISE EXCEPTION 'People have saved free-tool items (%) or marketing choices (%). Export both tables first; then SET LOCAL app.phase39_force = ''on''.',
      (SELECT count(*) FROM public.free_tool_items), (SELECT count(*) FROM public.marketing_consents);
  END IF;
END $$;

DROP TABLE public.free_tool_items;            -- its policies and trigger go with it
DROP TABLE public.marketing_consents;
DROP FUNCTION public._free_tool_item_guard();
DROP FUNCTION public.free_tools_write_ok();
DROP FUNCTION public.marketing_consent_set(boolean, text);
DROP FUNCTION public.marketing_consent_record_signup();
DELETE FROM public.phase25_mfa_guard_log
 WHERE fn IN ('public.free_tools_write_ok()', 'public.marketing_consent_set(boolean,text)', 'public.marketing_consent_record_signup()');
COMMIT;
