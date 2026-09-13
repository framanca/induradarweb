-- The external worker opens a request and claims work in a separate step, but
-- the chat dispatch contract returns the immediately usable packet.  Reattach
-- it here for chat callers only.
create or replace function private.induradar_attach_open_work_packet_v1(
  p_open jsonb,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'private', 'public', 'auth', 'pg_temp'
as $function$
declare
  rid uuid;
  packet jsonb;
begin
  if not coalesce((p_open ->> 'ok')::boolean, false)
     or not coalesce((p_open #>> '{packet,deferred}')::boolean, false) then
    return p_open;
  end if;

  begin
    rid := (p_open ->> 'run_id')::uuid;
  exception when invalid_text_representation then
    return p_open;
  end;

  if rid is null or nullif(btrim(p_worker_id), '') is null then
    return p_open;
  end if;

  packet := public.get_research_work_packet_v1(rid, p_worker_id, 600);
  return jsonb_set(p_open, '{packet}', packet, true)
    || jsonb_build_object('next_action', 'process_claimed_packet');
end
$function$;

revoke all on function private.induradar_attach_open_work_packet_v1(jsonb, text) from public;

create or replace function public.dispatch_research_kernel_chat_v1(
  p_submission_id text,
  p_intent text default 'execute',
  p_invocation_key text default null,
  p_worker_id text default null,
  p_configuration_version text default null,
  p_source_manifest jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'private', 'public', 'auth', 'pg_temp'
as $function$
declare
  s jsonb;
  j jsonb;
  ext jsonb;
  sub text := lower(btrim(p_submission_id));
  sr public.service_requests%rowtype;
  mapped uuid;
  rid uuid;
  r public.research_runs%rowtype;
begin
  if p_intent is null or p_intent not in ('execute', 'continue', 'status', 'new', 'deepen') then
    return jsonb_build_object('ok', false, 'reason', 'unsupported_chat_intent');
  end if;

  if p_intent = 'status' then
    return public.get_research_kernel_chat_status_v1(sub) || jsonb_build_object('intent', 'status');
  end if;

  select * into sr
  from public.service_requests
  where submission_id::text = sub
     or request_key = 'web:' || sub
     or form_payload ->> 'submission_id' = sub
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'request_not_found', 'run_created', false);
  end if;

  if auth.uid() is not null and not public.is_account_member(sr.account_id) then
    raise exception using errcode = '42501', message = 'request_access_denied';
  end if;

  perform 1 from public.service_requests where id = sr.id for update;
  s := public.get_research_kernel_chat_status_v1(sub);

  -- Preserve the historical read-only finalized behavior: "continue" never
  -- needs an invocation key merely to return the completed reference.
  if p_intent = 'continue' then
    if coalesce((s ->> 'can_deliver_final')::boolean, false) then
      return jsonb_build_object(
        'ok', true,
        'intent', 'continue',
        'mode', 'already_finalized',
        'run_created', false,
        'run_id', s -> 'run_id',
        'report_reference', s -> 'report_reference',
        'next_action', 'deliver_final_report',
        'new_search_budget_granted', false
      );
    end if;

    if not coalesce((s #>> '{resumption,resumable}')::boolean, false) then
      return jsonb_build_object(
        'ok', false,
        'intent', 'continue',
        'reason', coalesce(s #>> '{resumption,reason}', s ->> 'reason', 'not_resumable'),
        'run_id', s -> 'run_id',
        'run_created', false,
        'status', s
      );
    end if;
  end if;

  if nullif(btrim(p_worker_id), '') is null or nullif(btrim(p_invocation_key), '') is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'stable_invocation_and_worker_required',
      'run_created', false
    );
  end if;

  if p_intent = 'deepen' then
    perform private.kernel_assert_runtime_acceptance_v1();
    rid := (s ->> 'run_id')::uuid;

    if rid is null then
      j := public.open_research_request_v2(
        sub, p_invocation_key, p_worker_id, p_configuration_version, p_source_manifest
      );
      j := private.induradar_attach_open_work_packet_v1(j, p_worker_id);
      return j || jsonb_build_object(
        'chat_intent', 'deepen',
        'chat_protocol', 'chat-session-1.2.0',
        'run_created', coalesce(j ->> 'mode' = 'new_canonical_fresh', false),
        'extension_opened', false,
        'reason', 'no_prior_run; canonical_fresh base pass opened'
      );
    end if;

    select * into r from public.research_runs where id = rid;
    if coalesce((s ->> 'can_deliver_final')::boolean, false)
       or r.execution_state in ('succeeded', 'failed', 'cancelled')
       or r.research_closure <> 'incomplete'
       or exists (
         select 1 from public.report_versions
         where research_run_id = rid and finalization_status = 'finalized'
       ) then
      j := public.open_research_request_v2(
        sub, p_invocation_key, p_worker_id, p_configuration_version, p_source_manifest
      );
      j := private.induradar_attach_open_work_packet_v1(j, p_worker_id);
      return j || jsonb_build_object(
        'chat_intent', 'deepen',
        'chat_protocol', 'chat-session-1.2.0',
        'run_created', coalesce(j ->> 'mode' = 'new_canonical_fresh', false),
        'extension_opened', false,
        'reason', 'terminal/finalized prior run is immutable; canonical_fresh started'
      );
    end if;

    if not public.induradar_version_at_least(r.workflow_version, '3.14.0') then
      return jsonb_build_object(
        'ok', false,
        'intent', 'deepen',
        'reason', 'extension_pass_requires_3.14.0_sfp2_run',
        'run_id', rid,
        'run_created', false
      );
    end if;

    if not coalesce((s #>> '{resumption,resumable}')::boolean, false) then
      return jsonb_build_object(
        'ok', false,
        'intent', 'deepen',
        'reason', coalesce(s #>> '{resumption,reason}', 'not_resumable'),
        'run_id', rid,
        'run_created', false,
        'status', s
      );
    end if;

    ext := public.open_signal_first_extension_pass_v1(
      rid,
      'Explicit user requested deeper/amplified research pass for Submission ID ' || sub,
      p_invocation_key,
      100
    );
    return ext || jsonb_build_object(
      'ok', coalesce((ext ->> 'opened')::boolean, false),
      'chat_intent', 'deepen',
      'chat_protocol', 'chat-session-1.2.0',
      'run_created', false,
      'run_id', rid,
      'execution_rule', 'Research only the focused extension pass; never mass-deep-dive the structural universe. Continue afterward closes the same pass and does not grant another budget.'
    );
  end if;

  select research_run_id into mapped
  from private.research_request_dispatches
  where service_request_id = sr.id and invocation_key = p_invocation_key;

  if p_intent = 'continue'
     and mapped is not null
     and mapped::text is distinct from s ->> 'run_id' then
    return jsonb_build_object(
      'ok', false,
      'reason', 'invocation_targets_different_run',
      'run_created', false
    );
  end if;

  perform private.kernel_assert_runtime_acceptance_v1();
  j := public.open_research_request_v2(
    sub, p_invocation_key, p_worker_id, p_configuration_version, p_source_manifest
  );
  j := private.induradar_attach_open_work_packet_v1(j, p_worker_id);

  return j || jsonb_build_object(
    'chat_intent', p_intent,
    'chat_protocol', 'chat-session-1.2.0',
    'incomplete_preserved_on_new', p_intent = 'new' and j ->> 'mode' like 'resume_incomplete%',
    'run_created', coalesce(j ->> 'mode' = 'new_canonical_fresh', false),
    'new_search_budget_granted', case when p_intent = 'continue' then false else null end,
    'execution_rule', 'Process actual work and repeat next-packet until finalized. Recoverable failure is not a terminal reply.'
  );
end
$function$;

revoke all on function public.dispatch_research_kernel_chat_v1(text, text, text, text, text, jsonb) from public;
grant execute on function public.dispatch_research_kernel_chat_v1(text, text, text, text, text, jsonb) to service_role;
