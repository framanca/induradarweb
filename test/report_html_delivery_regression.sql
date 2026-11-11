-- Authenticated native regression against the existing approved Albacete report.
-- All derived-cache writes, including the cold-cache setup, are rolled back.
-- Run with a trusted database operator; this never changes memberships or roles.
BEGIN;
SET LOCAL statement_timeout='55s';
DO $test$
DECLARE
  v_report_id constant uuid := 'e7788299-bc82-43bd-a351-48340c7f32ca';
  report_ref constant text := 'IR-20261110-9D3D01';
  master_id uuid;
  other_id uuid;
  v_account_id uuid;
  denied_account_id uuid;
  denied_report_ref text;
  before_hashes jsonb;
  before_fp text := private.kernel_code_fingerprint_v1();
  cold jsonb;
  warm jsonb;
  materialized_at_before timestamptz;
  listed bigint;
  expected bigint;
  denied boolean := false;
BEGIN
  IF NOT (SELECT bool_and(provolatile='v') FROM pg_proc WHERE oid IN (
    'public.get_web_report_html_v1(uuid)'::regprocedure,
    'public.get_web_report_html_by_reference_v1(text)'::regprocedure,
    'public.get_web_report_html_delivery_by_reference_v1(text)'::regprocedure)) THEN
    RAISE EXCEPTION 'PostgREST HTML RPCs must allow derived-cache materialization';
  END IF;
  IF has_function_privilege('anon','public.get_web_report_html_delivery_by_reference_v1(text)','execute')
     OR has_function_privilege('anon','public.get_web_report_html_v1(uuid)','execute')
     OR has_function_privilege('authenticated','public.materialize_web_report_payload_v1(uuid,boolean)','execute') THEN
    RAISE EXCEPTION 'Anonymous or direct materializer privileges unexpectedly widened';
  END IF;
  SELECT u.id INTO STRICT master_id FROM auth.users u
  JOIN public.platform_admin_users a ON a.user_id=u.id
  WHERE lower(u.email)='framanca@outlook.com' AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL;
  SELECT r.account_id, jsonb_build_array(rv.report_payload_hash,rv.light_report_hash,rv.inventory_hash,
    rv.finalized_payload_hash,rv.finalization_status,rv.report_payload_status)
    INTO STRICT v_account_id,before_hashes FROM public.report_versions rv
    JOIN public.reports r ON r.id=rv.report_id WHERE rv.id=v_report_id AND rv.report_reference=report_ref;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',master_id,'role','authenticated')::text,true);
  IF NOT public.is_platform_admin() OR EXISTS(SELECT 1 FROM public.accounts a WHERE NOT public.is_account_member(a.id)) THEN
    RAISE EXCEPTION 'Designated administrator lacks global account visibility';
  END IF;
  SELECT count(*) INTO listed FROM public.portal_list_available_reports();
  SELECT count(*) INTO expected FROM (
    SELECT rv.id FROM public.report_versions rv JOIN public.reports r ON r.id=rv.report_id
    WHERE rv.status IN ('ready','delivered') AND rv.report_payload_status='ready' AND rv.finalization_status='finalized'
    UNION ALL
    SELECT c.id FROM private.curated_reports_v1 c JOIN public.report_versions src ON src.id=c.source_report_version_id
    JOIN public.reports r ON r.id=src.report_id WHERE c.status='ready' AND c.account_id=r.account_id
  ) eligible;
  IF listed<>expected THEN RAISE EXCEPTION 'Administrator cannot list every eligible report'; END IF;

  DELETE FROM private.report_web_payload_cache WHERE report_version_id=v_report_id;
  cold:=public.get_web_report_html_delivery_by_reference_v1(report_ref);
  IF cold->>'mode'<>'canonical' OR length(cold->>'html')<1000 OR (cold->>'html') !~* '^\s*<!doctype html>' THEN
    RAISE EXCEPTION 'First cold-cache request did not return canonical HTML';
  END IF;
  SELECT c.materialized_at INTO STRICT materialized_at_before FROM private.report_web_payload_cache c WHERE c.report_version_id=v_report_id;
  warm:=public.get_web_report_html_delivery_by_reference_v1(report_ref);
  IF warm IS DISTINCT FROM cold OR materialized_at_before IS DISTINCT FROM
    (SELECT c.materialized_at FROM private.report_web_payload_cache c WHERE c.report_version_id=v_report_id) THEN
    RAISE EXCEPTION 'Warm request did not reuse the identical approved HTML';
  END IF;

  SELECT u.id,r.account_id,rv.report_reference INTO other_id,denied_account_id,denied_report_ref
    FROM auth.users u CROSS JOIN public.report_versions rv JOIN public.reports r ON r.id=rv.report_id
    WHERE u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM public.platform_admin_users a WHERE a.user_id=u.id)
    AND NOT EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id=u.id AND m.account_id=r.account_id)
    AND rv.status IN ('ready','delivered') AND rv.finalization_status='finalized' AND rv.report_payload_status='ready'
    ORDER BY rv.generated_at DESC,u.id LIMIT 1;
  IF other_id IS NULL THEN RAISE EXCEPTION 'An existing unrelated user is required for the negative access case'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated',
    'user_metadata',jsonb_build_object('is_platform_admin',true,'role','admin'))::text,true);
  IF public.is_platform_admin() OR public.is_account_member(denied_account_id) THEN
    RAISE EXCEPTION 'Editable metadata granted cross-account access';
  END IF;
  BEGIN
    PERFORM public.get_web_report_html_delivery_by_reference_v1(denied_report_ref);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'Not authorized' THEN RAISE; END IF;
    denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Other tenant read the administrator report'; END IF;
  IF EXISTS(SELECT 1 FROM public.portal_list_available_reports() p
    LEFT JOIN public.reports r ON r.id=p.report_id
    LEFT JOIN private.curated_reports_v1 c ON c.id=p.report_id
    WHERE NOT public.is_account_member(coalesce(r.account_id,c.account_id))) THEN
    RAISE EXCEPTION 'Regular-user report listing leaked another account';
  END IF;
  IF before_hashes IS DISTINCT FROM (SELECT jsonb_build_array(rv.report_payload_hash,rv.light_report_hash,rv.inventory_hash,
      rv.finalized_payload_hash,rv.finalization_status,rv.report_payload_status) FROM public.report_versions rv WHERE rv.id=v_report_id)
     OR before_fp IS DISTINCT FROM private.kernel_code_fingerprint_v1() THEN
    RAISE EXCEPTION 'Rendering changed immutable research content or accepted kernel';
  END IF;
  PERFORM set_config('app.portal_html_regression',jsonb_build_object('pass',true,'master_report_count',listed,
    'cold_cache_pass',true,'warm_cache_reused',true,'other_tenant_denied',true,'user_metadata_cannot_elevate',true,
    'regular_user_listing_isolated',true,'immutable_hashes_preserved',true,'fingerprint_preserved',true)::text,true);
END
$test$;
SELECT current_setting('app.portal_html_regression')::jsonb proof;
ROLLBACK;
