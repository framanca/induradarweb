-- A coverage unit may be reopened only to add reviewed excerpts recovered from
-- an already-persisted web response.  Original captures and completion events
-- remain immutable audit records; the new completion supersedes the old gap.
CREATE OR REPLACE FUNCTION public.kernel_reopen_research_coverage_for_review_v1(
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
  r public.research_runs%rowtype;
  w private.research_work_items%rowtype;
BEGIN
  r := private.kernel_lock_run_v1(p_run_id);
  IF r.execution_state IN ('succeeded', 'cancelled') THEN
    RAISE EXCEPTION USING errcode = 'IR409', message = 'terminal_run_cannot_reopen_coverage';
  END IF;

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
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION USING errcode = 'IR422', message = 'review_reopen_reason_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.research_run_coverage c
    WHERE c.research_run_id = p_run_id
      AND c.dimension_type = w.payload ->> 'dimension_type'
      AND c.dimension_key = w.payload ->> 'dimension_key'
      AND c.status = 'gap'
  ) THEN
    RAISE EXCEPTION USING errcode = 'IR422', message = 'coverage_gap_required_for_review_reopen';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM private.research_captures c
    WHERE c.research_run_id = p_run_id
      AND c.work_item_id = p_work_item_id
      AND c.body ->> 'note' LIKE '%"response_id"%'
  ) THEN
    RAISE EXCEPTION USING errcode = 'IR422', message = 'persisted_web_response_required_for_review_reopen';
  END IF;

  UPDATE private.research_work_items
  SET status = 'queued',
      completed_at = NULL,
      lease_owner = NULL,
      lease_token = NULL,
      leased_at = NULL,
      lease_expires_at = NULL,
      heartbeat_at = NULL,
      resume_after = NULL,
      error_class = NULL,
      last_error = NULL,
      payload = (payload - 'result' - 'kernel_completion') || jsonb_build_object(
        'review_reopen_reason', p_reason,
        'review_reopened_at', clock_timestamp()
      ),
      updated_at = clock_timestamp()
  WHERE id = w.id;

  UPDATE public.research_runs
  SET execution_state = 'paused',
      research_closure = 'incomplete',
      state_reason = 'coverage_review_reopened',
      last_progress_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE id = p_run_id;

  INSERT INTO private.research_work_events(
    research_run_id,
    work_item_id,
    event_type,
    detail
  ) VALUES (
    p_run_id,
    w.id,
    'coverage_review_reopened',
    jsonb_build_object('reason', p_reason, 'prior_status', 'succeeded')
  );

  RETURN jsonb_build_object(
    'pass', true,
    'state', 'queued',
    'prior_captures_preserved', true,
    'prior_completion_preserved_in_events', true
  );
END
$function$;

REVOKE ALL ON FUNCTION public.kernel_reopen_research_coverage_for_review_v1(uuid, uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.kernel_reopen_research_coverage_for_review_v1(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.kernel_reopen_research_coverage_for_review_v1(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.kernel_reopen_research_coverage_for_review_v1(uuid, uuid, text) TO service_role;
