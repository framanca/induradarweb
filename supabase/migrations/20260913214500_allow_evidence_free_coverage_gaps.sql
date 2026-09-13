-- A gap means the complete seeded search bundle was executed without enough
-- reviewable source material.  It must retain the query threshold, but it
-- cannot require documents that do not exist after an all-no-result search.
CREATE OR REPLACE FUNCTION private.kernel_coverage_requirements_v1(
  p_type text,
  p_key text,
  p_status text,
  p_queries jsonb,
  p_docs integer,
  p_searched_at timestamp with time zone,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  n integer := 0;
  minq integer := 1;
  mind integer := 0;
  valid boolean := false;
BEGIN
  IF jsonb_typeof(p_queries) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('pass', false, 'reason', 'coverage_queries_must_be_array');
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_queries) x
    WHERE jsonb_typeof(x) IS DISTINCT FROM 'string'
  ) THEN
    RETURN jsonb_build_object('pass', false, 'reason', 'coverage_queries_must_be_strings');
  END IF;

  SELECT count(DISTINCT lower(btrim(value))) FILTER (WHERE nullif(btrim(value), '') IS NOT NULL)
  INTO n
  FROM jsonb_array_elements_text(p_queries);

  IF p_key LIKE 'cold_start_cell:%' THEN
    minq := 3;
  ELSIF p_key LIKE 'structural_cell:%' OR p_key LIKE 'open_market_cell:%' THEN
    minq := 4;
    mind := 4;
  ELSIF p_key = 'structural_company_discovery' THEN
    minq := 5;
    mind := 5;
  ELSIF p_key LIKE 'open_market_sector:%' THEN
    minq := 3;
    mind := 3;
  ELSIF p_key = 'open_market_discovery' THEN
    minq := 1;
    mind := 1;
  END IF;

  -- A documented gap still requires every seeded query and a reason.  Requiring
  -- source documents here made a valid all-no-result bundle impossible to close.
  IF p_status = 'gap' THEN
    mind := 0;
  ELSIF p_status = 'not_applicable' THEN
    IF p_type IN ('company', 'project')
       OR p_key LIKE 'open_market_sector:%'
       OR p_key IN ('structural_company_discovery', 'open_market_discovery') THEN
      minq := 0;
      mind := 0;
    ELSIF p_key LIKE 'structural_cell:%' OR p_key LIKE 'open_market_cell:%' THEN
      minq := 2;
      mind := 0;
    END IF;
  END IF;

  valid := coalesce(
    p_status IN ('covered', 'gap', 'not_applicable')
    AND p_searched_at IS NOT NULL
    AND (p_status = 'covered' OR nullif(btrim(p_reason), '') IS NOT NULL)
    AND n >= minq
    AND p_docs >= mind,
    false
  );

  RETURN jsonb_build_object(
    'pass', valid,
    'reason', CASE WHEN valid THEN 'coverage_evidence_resolved' ELSE 'coverage_requirements_not_met' END,
    'status', p_status,
    'distinct_queries', n,
    'required_queries', minq,
    'documents_reviewed', p_docs,
    'required_documents', mind
  );
END
$function$;
