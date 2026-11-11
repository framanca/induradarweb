-- PostgREST executes STABLE RPCs in a read-only transaction even for POST.
-- Both public HTML entrypoints can create the approved derived cache, so the
-- outer RPCs must also be VOLATILE. Authorization and publication gates stay.
DO $repair$
DECLARE
  fp_before text := private.kernel_code_fingerprint_v1();
  before_functions jsonb;
  after_functions jsonb;
BEGIN
  SELECT jsonb_object_agg(p.oid::text,to_jsonb(p)-'provolatile') INTO before_functions
  FROM pg_proc p WHERE p.oid IN (
    'public.get_web_report_html_delivery_by_reference_v1(text)'::regprocedure,
    'public.get_web_report_html_by_reference_v1(text)'::regprocedure);

  ALTER FUNCTION public.get_web_report_html_delivery_by_reference_v1(text) VOLATILE;
  ALTER FUNCTION public.get_web_report_html_by_reference_v1(text) VOLATILE;

  SELECT jsonb_object_agg(p.oid::text,to_jsonb(p)-'provolatile') INTO after_functions
  FROM pg_proc p WHERE p.oid IN (
    'public.get_web_report_html_delivery_by_reference_v1(text)'::regprocedure,
    'public.get_web_report_html_by_reference_v1(text)'::regprocedure);
  IF before_functions IS DISTINCT FROM after_functions THEN
    RAISE EXCEPTION 'HTML RPC bodies, ACLs or authorization contract changed';
  END IF;
  IF fp_before IS DISTINCT FROM private.kernel_code_fingerprint_v1() THEN
    RAISE EXCEPTION 'HTML RPC repair must preserve accepted executable fingerprint';
  END IF;
END
$repair$;

NOTIFY pgrst, 'reload schema';
