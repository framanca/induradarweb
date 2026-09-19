-- Stable, auditable, idempotent cancellation for an InduRadar submission.
-- Cancellation is terminal: it preserves every row, fences active leases, and
-- cannot be confused with the recoverable paused/resume state.

create or replace function public.cancel_research_submission_v1(
  p_submission_id text,
  p_reason text,
  p_operation_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private, public, auth, pg_temp
as $function$
declare
  v_request public.service_requests%rowtype;
  v_run public.research_runs%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_operation_key text := coalesce(
    nullif(btrim(p_operation_key), ''),
    'cancel:' || coalesce(nullif(btrim(p_submission_id), ''), 'missing')
  );
  v_input_hash text;
  v_receipt private.research_command_receipts%rowtype;
  v_result jsonb;
  v_cancelled_work_count integer := 0;
  v_preserved_work_count integer := 0;
  v_prior_status text;
  v_prior_execution_state text;
begin
  if nullif(btrim(p_submission_id), '') is null then
    return jsonb_build_object('pass', false, 'reason', 'submission_id_required');
  end if;
  if v_reason is null then
    return jsonb_build_object('pass', false, 'reason', 'cancellation_reason_required');
  end if;
  if length(v_reason) > 1000 then
    return jsonb_build_object('pass', false, 'reason', 'cancellation_reason_too_long');
  end if;
  if length(v_operation_key) > 200 then
    return jsonb_build_object('pass', false, 'reason', 'operation_key_too_long');
  end if;

  select sr.*
  into v_request
  from public.service_requests sr
  where sr.submission_id::text = p_submission_id
     or sr.request_key = 'web:' || p_submission_id
     or sr.form_payload ->> 'submission_id' = p_submission_id
  order by sr.created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('pass', false, 'reason', 'request_not_found');
  end if;

  if auth.uid() is not null
     and not public.has_account_role(
       v_request.account_id,
       array['owner','admin','analyst']::public.account_role[]
     ) then
    raise exception using errcode = '42501', message = 'request_cancel_access_denied';
  end if;

  select rr.*
  into v_run
  from public.research_runs rr
  where rr.service_request_id = v_request.id
  order by rr.run_no desc, rr.created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object(
      'pass', false,
      'reason', 'run_not_found',
      'submission_id', p_submission_id,
      'service_request_id', v_request.id
    );
  end if;

  v_input_hash := md5(
    jsonb_build_object(
      'submission_id', p_submission_id,
      'reason', v_reason,
      'operation_key', v_operation_key
    )::text
  );

  select r.*
  into v_receipt
  from private.research_command_receipts r
  where r.research_run_id = v_run.id
    and r.operation_key = v_operation_key;

  if found then
    if v_receipt.action <> 'cancel_submission'
       or v_receipt.input_hash <> v_input_hash then
      return jsonb_build_object(
        'pass', false,
        'reason', 'operation_key_reused_with_different_input',
        'run_id', v_run.id,
        'operation_key', v_operation_key
      );
    end if;
    return v_receipt.result || jsonb_build_object('replayed', true);
  end if;

  if v_run.execution_state = 'cancelled' or v_run.status = 'cancelled' then
    select r.result
    into v_result
    from private.research_command_receipts r
    where r.research_run_id = v_run.id
      and r.action = 'cancel_submission'
    order by r.committed_at desc
    limit 1;

    if found then
      return v_result || jsonb_build_object(
        'replayed', true,
        'already_cancelled', true,
        'requested_operation_key', v_operation_key
      );
    end if;

    select count(*)::integer
    into v_preserved_work_count
    from private.research_work_items wi
    where wi.research_run_id = v_run.id;

    return jsonb_build_object(
      'pass', true,
      'operation', 'cancel',
      'submission_id', p_submission_id,
      'service_request_id', v_request.id,
      'run_id', v_run.id,
      'run_status', 'cancelled',
      'execution_state', 'cancelled',
      'resumable', false,
      'terminal', true,
      'already_cancelled', true,
      'preserved_work_item_count', v_preserved_work_count,
      'rows_deleted', 0,
      'operation_key', v_operation_key,
      'replayed', true
    );
  end if;

  if v_run.execution_state = 'succeeded'
     or v_run.status = 'completed'
     or exists (
       select 1
       from public.report_versions rv
       where rv.research_run_id = v_run.id
         and rv.finalization_status = 'finalized'
         and rv.status in ('ready', 'delivered')
     ) then
    return jsonb_build_object(
      'pass', false,
      'reason', 'latest_run_already_finalized',
      'submission_id', p_submission_id,
      'run_id', v_run.id,
      'execution_state', v_run.execution_state
    );
  end if;

  if v_run.execution_state = 'failed' or v_run.status = 'failed' then
    return jsonb_build_object(
      'pass', false,
      'reason', 'latest_run_already_failed',
      'submission_id', p_submission_id,
      'run_id', v_run.id,
      'execution_state', v_run.execution_state
    );
  end if;

  v_prior_status := v_run.status;
  v_prior_execution_state := v_run.execution_state;

  select count(*)::integer
  into v_preserved_work_count
  from private.research_work_items wi
  where wi.research_run_id = v_run.id;

  with cancelled as (
    update private.research_work_items wi
    set status = 'cancelled',
        lease_owner = null,
        lease_token = null,
        leased_at = null,
        lease_expires_at = null,
        heartbeat_at = null,
        resume_after = null,
        completed_at = coalesce(wi.completed_at, clock_timestamp()),
        last_error = 'Submission cancelled: ' || v_reason,
        error_class = 'operator_cancelled',
        updated_at = clock_timestamp()
    where wi.research_run_id = v_run.id
      and wi.status in ('queued', 'leased', 'retry_wait', 'blocked')
    returning wi.id
  ), logged as (
    insert into private.research_work_events(
      research_run_id,
      work_item_id,
      event_type,
      worker_id,
      detail
    )
    select
      v_run.id,
      c.id,
      'cancelled',
      'kernel:cancel_research_submission_v1',
      jsonb_build_object(
        'reason', v_reason,
        'operation_key', v_operation_key,
        'submission_id', p_submission_id,
        'terminal', true,
        'rows_deleted', 0
      )
    from cancelled c
    returning 1
  )
  select count(*)::integer into v_cancelled_work_count from logged;

  update public.research_runs
  set status = 'cancelled',
      completion_status = 'cancelled',
      stop_reason = 'operator_cancelled',
      completed_at = coalesce(completed_at, clock_timestamp()),
      execution_state = 'cancelled',
      lease_owner = null,
      lease_expires_at = null,
      state_reason = 'operator_cancelled: ' || v_reason,
      state_changed_at = clock_timestamp(),
      last_heartbeat_at = null
  where id = v_run.id;

  v_result := jsonb_build_object(
    'pass', true,
    'operation', 'cancel',
    'submission_id', p_submission_id,
    'service_request_id', v_request.id,
    'run_id', v_run.id,
    'prior_run_status', v_prior_status,
    'prior_execution_state', v_prior_execution_state,
    'run_status', 'cancelled',
    'execution_state', 'cancelled',
    'resumable', false,
    'terminal', true,
    'cancelled_work_item_count', v_cancelled_work_count,
    'preserved_work_item_count', v_preserved_work_count,
    'rows_deleted', 0,
    'reason', v_reason,
    'operation_key', v_operation_key,
    'replayed', false,
    'cancelled_at', clock_timestamp()
  );

  insert into private.research_command_receipts(
    research_run_id,
    operation_key,
    work_item_id,
    action,
    input_hash,
    result
  ) values (
    v_run.id,
    v_operation_key,
    null,
    'cancel_submission',
    v_input_hash,
    v_result
  );

  insert into public.audit_log(
    account_id,
    actor_user_id,
    action,
    object_type,
    object_id,
    metadata
  ) values (
    v_request.account_id,
    auth.uid(),
    'research_submission.cancelled',
    'service_request',
    v_request.id,
    jsonb_build_object(
      'submission_id', p_submission_id,
      'run_id', v_run.id,
      'reason', v_reason,
      'operation_key', v_operation_key,
      'prior_run_status', v_prior_status,
      'prior_execution_state', v_prior_execution_state,
      'cancelled_work_item_count', v_cancelled_work_count,
      'preserved_work_item_count', v_preserved_work_count,
      'rows_deleted', 0,
      'terminal', true,
      'resumable', false
    )
  );

  return v_result;
end;
$function$;

revoke all on function public.cancel_research_submission_v1(text, text, text) from public;
revoke all on function public.cancel_research_submission_v1(text, text, text) from anon;
revoke all on function public.cancel_research_submission_v1(text, text, text) from authenticated;
grant execute on function public.cancel_research_submission_v1(text, text, text) to service_role;

comment on function public.cancel_research_submission_v1(text, text, text) is
  'Terminal, idempotent and auditable cancellation by submission ID. Preserves all rows, fences leases, cancels only unfinished work and cannot be resumed.';
