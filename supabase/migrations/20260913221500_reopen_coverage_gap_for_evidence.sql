-- A documented gap may need a second, visibly bounded source pass.  The
-- follow-up queries are derived from the kernel's existing scope; callers do
-- not supply a domain or broaden the geography/sector themselves.
CREATE OR REPLACE FUNCTION public.kernel_reopen_research_coverage_for_evidence_v1(
  p_run_id uuid,
  p_work_item_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'private', 'public', 'pg_temp'
AS $function$
DECLARE
  w private.research_work_items%rowtype;
  v_queries jsonb;
BEGIN
  SELECT * INTO w
  FROM private.research_work_items
  WHERE id = p_work_item_id
    AND research_run_id = p_run_id
  FOR UPDATE;

  IF NOT FOUND
     OR w.status <> 'succeeded'
     OR w.work_key NOT LIKE 'coverage:%' THEN
    RAISE EXCEPTION USING errcode = 'IR422', message = 'succeeded_coverage_work_required';
  END IF;
  IF w.payload ? 'evidence_recovery_queries' THEN
    RAISE EXCEPTION USING errcode = 'IR409', message = 'coverage_evidence_recovery_already_requested';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      left(btrim(value), 430) ||
      ' fuentes primarias comunicado oficial evidencia verificable'
    ),
    '[]'::jsonb
  )
  INTO v_queries
  FROM jsonb_array_elements_text(coalesce(w.payload -> 'queries', '[]'::jsonb));

  IF jsonb_array_length(v_queries) = 0 THEN
    RAISE EXCEPTION USING errcode = 'IR422', message = 'kernel_coverage_query_bundle_required';
  END IF;

  PERFORM public.kernel_reopen_research_coverage_for_review_v1(
    p_run_id,
    p_work_item_id,
    p_reason
  );

  UPDATE private.research_work_items
  SET payload = payload || jsonb_build_object(
        'evidence_recovery_queries', v_queries,
        'evidence_recovery_reason', p_reason,
        'evidence_recovery_requested_at', clock_timestamp()
      ),
      updated_at = clock_timestamp()
  WHERE id = p_work_item_id;

  INSERT INTO private.research_work_events(
    research_run_id,
    work_item_id,
    event_type,
    detail
  ) VALUES (
    p_run_id,
    p_work_item_id,
    'coverage_evidence_recovery_reopened',
    jsonb_build_object(
      'reason', p_reason,
      'derived_query_count', jsonb_array_length(v_queries),
      'scope', 'existing_kernel_coverage_bundle_only'
    )
  );

  RETURN jsonb_build_object(
    'pass', true,
    'state', 'queued',
    'derived_query_count', jsonb_array_length(v_queries),
    'prior_captures_preserved', true,
    'prior_completion_preserved_in_events', true
  );
END
$function$;

REVOKE ALL ON FUNCTION public.kernel_reopen_research_coverage_for_evidence_v1(uuid, uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.kernel_reopen_research_coverage_for_evidence_v1(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.kernel_reopen_research_coverage_for_evidence_v1(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.kernel_reopen_research_coverage_for_evidence_v1(uuid, uuid, text) TO service_role;
