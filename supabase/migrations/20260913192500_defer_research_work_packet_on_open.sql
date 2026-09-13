-- Opening a request is a short, idempotent dispatch operation.  Claiming a
-- work unit and deriving its SAP1 lane plan can be substantially more costly,
-- so the worker performs that step through get_research_work_packet_v1.
create or replace function public.open_research_request_v2(
  p_submission_id text,
  p_invocation_key text,
  p_worker_id text,
  p_configuration_version text default null,
  p_source_manifest jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'private', 'public', 'auth', 'pg_temp'
as $function$
declare
  sr public.service_requests%rowtype;
  r public.research_runs%rowtype;
  rid uuid;
  no integer;
  j jsonb;
  mode text;
  profile private.induradar_stack_profiles%rowtype;
  compatible boolean;
begin
  if nullif(btrim(p_invocation_key), '') is null or length(p_invocation_key) > 200 then
    raise exception using errcode = '22023', message = 'stable_invocation_key_required';
  end if;

  select * into sr
  from public.service_requests
  where submission_id::text = p_submission_id
     or request_key = 'web:' || p_submission_id
     or form_payload ->> 'submission_id' = p_submission_id
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'request_not_found');
  end if;

  if auth.uid() is not null and not public.is_account_member(sr.account_id) then
    raise exception using errcode = '42501', message = 'request_access_denied';
  end if;

  if (select count(*) from private.induradar_stack_profiles where active) <> 1 then
    return jsonb_build_object('ok', false, 'reason', 'exactly_one_active_stack_required');
  end if;

  select * into profile from private.induradar_stack_profiles where active;

  if p_configuration_version is not null
     and p_configuration_version is distinct from profile.configuration_version then
    return jsonb_build_object(
      'ok', false,
      'reason', 'caller_configuration_mismatch',
      'recovery', 'load_active_configuration'
    );
  end if;

  if p_source_manifest is not null
     and not private.kernel_manifest_matches_v1(p_source_manifest, profile.expected_sources) then
    return jsonb_build_object(
      'ok', false,
      'reason', 'caller_source_manifest_mismatch',
      'recovery', 'verify_actual_runtime_sources'
    );
  end if;

  update public.service_requests
  set normalized_scope = public.induradar_restrict_geographies_v1(normalized_scope)
  where id = sr.id
    and normalized_scope is distinct from public.induradar_restrict_geographies_v1(normalized_scope)
  returning * into sr;

  if not found then
    select * into sr
    from public.service_requests
    where submission_id::text = p_submission_id
       or request_key = 'web:' || p_submission_id
       or form_payload ->> 'submission_id' = p_submission_id
    order by created_at desc
    limit 1;
  end if;

  if jsonb_array_length(coalesce(sr.normalized_scope -> 'geographies', '[]')) = 0 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'no_supported_geography',
      'allowed_countries', jsonb_build_array('España', 'Portugal'),
      'research_started', false
    );
  end if;

  select research_run_id into rid
  from private.research_request_dispatches
  where service_request_id = sr.id
    and invocation_key = p_invocation_key;

  if rid is not null then
    select * into r from public.research_runs where id = rid;
    mode := 'same_invocation';
  else
    select * into r
    from public.research_runs
    where service_request_id = sr.id
    order by run_no desc, created_at desc
    limit 1;

    if r.id is not null
       and r.execution_state in ('queued', 'running', 'paused')
       and r.research_closure = 'incomplete'
       and not exists (
         select 1
         from public.report_versions
         where research_run_id = r.id
           and finalization_status = 'finalized'
           and status in ('ready', 'delivered')
       ) then
      select exists (
        select 1
        from private.induradar_stack_profiles hp
        where hp.workflow_version = r.workflow_version
          and not exists (
            select 1
            from jsonb_each_text(hp.expected_versions) kv
            where kv.key in (
              'workflow_version', 'contract_version',
              'execution_contract_version', 'heuristics_version',
              'tool_registry_version', 'golden_test_version',
              'source_catalog_version', 'report_template_version',
              'scoring_version', 'taxonomy_version'
            )
              and to_jsonb(r) ->> kv.key is distinct from kv.value
          )
      ) and public.induradar_version_at_least(r.workflow_version, '3.13.3')
      into compatible;

      if not compatible then
        return jsonb_build_object(
          'ok', false,
          'reason', 'incomplete_run_requires_compatible_migration',
          'run_id', r.id,
          'run_workflow_version', r.workflow_version
        );
      end if;

      rid := r.id;
      mode := case
        when r.workflow_version = profile.workflow_version then 'resume_incomplete'
        else 'resume_incomplete_compatible_prior_release'
      end;
    elsif r.id is not null and r.execution_state = 'failed' then
      return jsonb_build_object(
        'ok', false,
        'reason', 'failed_run_requires_explicit_recovery',
        'run_id', r.id
      );
    else
      select coalesce(max(run_no), 0) + 1 into no
      from public.research_runs
      where service_request_id = sr.id;

      insert into public.research_runs(
        account_id, service_request_id, run_key, run_no, status, cutoff_date,
        baseline_mode, artifact_generation_policy, notes
      ) values (
        sr.account_id,
        sr.id,
        'request:' || sr.id::text || ':execution:' || no::text,
        no,
        'planned',
        coalesce(sr.form_payload #>> '{request,cutoff_date}', current_date::text)::date,
        'canonical_fresh',
        'on_demand',
        'Opened through stable idempotent dispatcher. Canonical database plus fresh research; no previous report is used as a substitute.'
      ) returning * into r;

      rid := r.id;
      mode := 'new_canonical_fresh';
    end if;

    insert into private.research_request_dispatches(
      service_request_id, invocation_key, research_run_id
    ) values (sr.id, p_invocation_key, rid);
  end if;

  if r.execution_state = 'succeeded'
     or exists (
       select 1
       from public.report_versions
       where research_run_id = rid
         and finalization_status = 'finalized'
         and status in ('ready', 'delivered')
     ) then
    return jsonb_build_object(
      'ok', true,
      'mode', mode,
      'run_id', rid,
      'already_finalized', true,
      'new_user_request_requires_new_invocation_key', true,
      'report_reference', (
        select report_reference
        from public.report_versions
        where research_run_id = rid
          and finalization_status = 'finalized'
          and status in ('ready', 'delivered')
        order by version desc
        limit 1
      )
    );
  end if;

  if r.stack_integrity_status <> 'passed' then
    if r.workflow_version is distinct from profile.workflow_version then
      return jsonb_build_object(
        'ok', false,
        'reason', 'prior_release_run_missing_confirmed_q0',
        'run_id', rid,
        'run_workflow_version', r.workflow_version
      );
    end if;

    if p_configuration_version is null or p_source_manifest is null then
      return jsonb_build_object(
        'ok', true,
        'mode', mode,
        'run_id', rid,
        'next_action', 'verify_actual_runtime_sources_and_submit_q0',
        'state', 'awaiting_q0',
        'source_manifest_must_come_from_observed_files', true
      );
    end if;

    j := public.evaluate_stack_integrity_gate(rid, p_configuration_version, p_source_manifest);
    if not coalesce((j ->> 'pass')::boolean, false) then
      return jsonb_build_object('ok', false, 'run_id', rid, 'reason', 'q0_failed', 'q0', j);
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'mode', mode,
    'run_id', rid,
    'run_workflow_version', r.workflow_version,
    'active_workflow_version', profile.workflow_version,
    'packet', jsonb_build_object(
      'claimed', false,
      'deferred', true,
      'reason', 'deferred_until_worker_claim'
    ),
    'next_action', 'call_get_research_work_packet_v1',
    'kernel_api', 'public.get_research_execution_api_v1'
  );
end
$function$;

revoke all on function public.open_research_request_v2(text, text, text, text, jsonb) from public;
grant execute on function public.open_research_request_v2(text, text, text, text, jsonb) to service_role;
