-- The HTML reader can materialize its derived cache. STABLE pins its reads to
-- the calling snapshot, hiding the HTML just generated on the first request.
-- Keep the full authorization, finalization and content gates unchanged.
DO $repair$
DECLARE
  fp_before text := private.kernel_code_fingerprint_v1();
  reader_before jsonb;
  delivery_before jsonb;
  roles_before jsonb;
BEGIN
  SELECT to_jsonb(p)-'provolatile' INTO STRICT reader_before
  FROM pg_proc p WHERE p.oid='public.get_web_report_html_v1(uuid)'::regprocedure;
  SELECT to_jsonb(p)-'proconfig' INTO STRICT delivery_before
  FROM pg_proc p WHERE p.oid='public.get_web_report_html_delivery_by_reference_v1(text)'::regprocedure;
  SELECT jsonb_object_agg(rolname,rolconfig) INTO roles_before FROM pg_roles
  WHERE rolname IN ('anon','authenticated','service_role','authenticator');

  ALTER FUNCTION public.get_web_report_html_v1(uuid) VOLATILE;
  -- A cold canonical render can legitimately exceed the inherited 8s limit.
  ALTER FUNCTION public.get_web_report_html_delivery_by_reference_v1(text)
    SET statement_timeout TO '45s';

  IF reader_before IS DISTINCT FROM (SELECT to_jsonb(p)-'provolatile' FROM pg_proc p
      WHERE p.oid='public.get_web_report_html_v1(uuid)'::regprocedure)
     OR delivery_before IS DISTINCT FROM (SELECT to_jsonb(p)-'proconfig' FROM pg_proc p
      WHERE p.oid='public.get_web_report_html_delivery_by_reference_v1(text)'::regprocedure) THEN
    RAISE EXCEPTION 'HTML reader body, ACL or authorization contract changed';
  END IF;
  IF fp_before IS DISTINCT FROM private.kernel_code_fingerprint_v1() THEN
    RAISE EXCEPTION 'HTML cache repair must preserve accepted executable fingerprint';
  END IF;
  IF roles_before IS DISTINCT FROM (SELECT jsonb_object_agg(rolname,rolconfig) FROM pg_roles
      WHERE rolname IN ('anon','authenticated','service_role','authenticator')) THEN
    RAISE EXCEPTION 'HTML cache repair must preserve role timeouts';
  END IF;
END
$repair$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
