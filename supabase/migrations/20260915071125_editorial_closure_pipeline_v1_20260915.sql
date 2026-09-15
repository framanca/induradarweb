-- InduRadar: mandatory zero-search editorial synthesis in report closure.
-- Workflow 3.14.0 / Report Schema 2.0.0.
-- Existing report versions remain legacy-optional; new report versions must complete
-- editorial synthesis from already-approved canonical content before ready delivery.

alter table public.report_versions
  add column if not exists editorial_pipeline_version text not null default 'legacy',
  add column if not exists editorial_pipeline_status text not null default 'legacy_optional',
  add column if not exists editorial_completed_at timestamptz,
  add column if not exists editorial_payload_hash text;

alter table public.report_versions alter column editorial_pipeline_version set default '1.0.0';
alter table public.report_versions alter column editorial_pipeline_status set default 'pending';

DO $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='report_versions_editorial_pipeline_status_chk'
      and conrelid='public.report_versions'::regclass
  ) then
    alter table public.report_versions
      add constraint report_versions_editorial_pipeline_status_chk
      check (editorial_pipeline_status in ('legacy_optional','pending','complete'));
  end if;
end $$;

create or replace function public.evaluate_report_editorial_payload_v1(p_payload jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_items jsonb;
  v_collection text;
  v_expected integer := 0;
  v_complete integer := 0;
  v_missing jsonb := '[]'::jsonb;
  v_item jsonb;
  v_editorial jsonb;
  v_fields jsonb;
  v_summary_ok boolean := false;
  v_key text;
begin
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) <> 'object' then
    return jsonb_build_object('gate','REPORT-EDITORIAL-V1','pass',false,'error','payload_not_object');
  end if;

  if jsonb_typeof(p_payload#>'{portfolio_summary,client_layers,signal_opportunities}')='array' then
    v_items := p_payload#>'{portfolio_summary,client_layers,signal_opportunities}';
    v_collection := 'portfolio_summary.client_layers.signal_opportunities';
  else
    v_items := case when jsonb_typeof(p_payload->'opportunities')='array' then p_payload->'opportunities' else '[]'::jsonb end;
    v_collection := 'opportunities';
  end if;

  v_expected := jsonb_array_length(v_items);
  v_summary_ok := jsonb_typeof(p_payload#>'{executive_summary,conclusion}')='string'
    and nullif(btrim(p_payload#>>'{executive_summary,conclusion}'),'') is not null;

  for v_item in select value from jsonb_array_elements(v_items) loop
    v_editorial := case when jsonb_typeof(v_item->'editorial')='object' then v_item->'editorial' else '{}'::jsonb end;
    v_fields := '[]'::jsonb;

    foreach v_key in array array['signal_synopsis','why_now','probable_need','risk_cautions','next_action'] loop
      if jsonb_typeof(v_editorial->v_key) is distinct from 'string'
         or nullif(btrim(v_editorial->>v_key),'') is null then
        v_fields := v_fields || jsonb_build_array(v_key);
      end if;
    end loop;

    if jsonb_typeof(v_editorial->'confirmed_facts') is distinct from 'array'
       or coalesce(jsonb_array_length(v_editorial->'confirmed_facts'),0)=0 then
      v_fields := v_fields || jsonb_build_array('confirmed_facts');
    end if;

    if jsonb_array_length(v_fields)=0 then
      v_complete := v_complete + 1;
    else
      v_missing := v_missing || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'company',coalesce(v_item->>'company',v_item#>>'{companies,0,name}'),
        'title',v_item->>'title',
        'missing_fields',v_fields
      )));
    end if;
  end loop;

  return jsonb_build_object(
    'gate','REPORT-EDITORIAL-V1',
    'pass',v_summary_ok and v_complete=v_expected,
    'collection',v_collection,
    'executive_summary_conclusion_present',v_summary_ok,
    'expected_opportunity_editorials',v_expected,
    'complete_opportunity_editorials',v_complete,
    'missing_opportunity_editorials',v_missing,
    'required_fields',jsonb_build_array('signal_synopsis','confirmed_facts','why_now','probable_need','risk_cautions','next_action'),
    'search_budget_impact',0,
    'web_research_allowed',false,
    'content_source','approved_report_payload_only'
  );
end;
$$;

create or replace function public.evaluate_report_editorial_pipeline_gate_v1(p_report_version_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare r public.report_versions%rowtype; g jsonb; required boolean;
begin
  select * into r from public.report_versions where id=p_report_version_id;
  if not found then raise exception 'Report not found'; end if;
  required := r.editorial_pipeline_status <> 'legacy_optional' and r.editorial_pipeline_version='1.0.0';
  g := public.evaluate_report_editorial_payload_v1(r.report_payload);
  return g || jsonb_build_object(
    'report_version_id',r.id,'report_reference',r.report_reference,
    'pipeline_version',r.editorial_pipeline_version,'pipeline_status',r.editorial_pipeline_status,
    'required',required,'pass',case when required then coalesce((g->>'pass')::boolean,false) else true end
  );
end;
$$;

create or replace function public.trg_enforce_report_editorial_pipeline_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
declare g jsonb;
begin
  if new.editorial_pipeline_status='legacy_optional' then return new; end if;
  if new.editorial_pipeline_version is distinct from '1.0.0' then
    raise exception using errcode='IR422',message='unknown_report_editorial_pipeline_version',detail=coalesce(new.editorial_pipeline_version,'null');
  end if;
  if new.report_payload_status='ready' and old.report_payload_status is distinct from 'ready' then
    g := public.evaluate_report_editorial_payload_v1(new.report_payload);
    if not coalesce((g->>'pass')::boolean,false) then
      raise exception using errcode='IR422',message='report_editorial_synthesis_required_before_ready',detail=g::text,
        hint='After prepare_report, read get_report_editorial_generation_plan_v1(report_version_id), write synthesis only from that approved/canonical plan with zero web searches, and pass it in finalize_report.content.';
    end if;
    new.editorial_pipeline_status := 'complete';
    new.editorial_completed_at := coalesce(new.editorial_completed_at,clock_timestamp());
    new.editorial_payload_hash := public.compute_report_payload_hash(new.report_payload);
  end if;
  return new;
end;
$$;

revoke all on function public.trg_enforce_report_editorial_pipeline_v1() from public, anon, authenticated;
grant execute on function public.trg_enforce_report_editorial_pipeline_v1() to service_role;

drop trigger if exists zz29_report_editorial_pipeline on public.report_versions;
create trigger zz29_report_editorial_pipeline
before update of report_payload_status on public.report_versions
for each row execute function public.trg_enforce_report_editorial_pipeline_v1();

create or replace function public.get_report_editorial_generation_plan_v1(p_report_version_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  r public.report_versions%rowtype;
  v_base jsonb;
  v_formal jsonb := '[]'::jsonb;
  v_signal jsonb := '[]'::jsonb;
  v_required boolean;
  v_company_count integer := 0;
  v_signal_count integer := 0;
  v_source_count integer := 0;
begin
  select * into r from public.report_versions where id=p_report_version_id;
  if not found then raise exception 'Report not found'; end if;
  v_required := r.editorial_pipeline_status<>'legacy_optional' and r.editorial_pipeline_version='1.0.0';
  v_base := public.build_lossless_report_payload(r.id);
  v_signal := public.build_report_signal_ranked_client_opportunities_v1(r.id);
  v_formal := case when jsonb_typeof(v_base->'opportunities')='array' then v_base->'opportunities' else '[]'::jsonb end;
  select count(*) filter(where entity_type='company'),count(*) filter(where entity_type='signal'),count(*) filter(where entity_type='source')
    into v_company_count,v_signal_count,v_source_count from public.report_items where report_version_id=r.id;
  return jsonb_build_object(
    'report_version_id',r.id,'report_reference',r.report_reference,'editorial_schema_version','1.0.0',
    'pipeline_version',r.editorial_pipeline_version,'pipeline_status',r.editorial_pipeline_status,
    'required_for_report_ready',v_required,'timing','after_prepare_report_before_finalize_report',
    'search_budget_impact',0,'web_research_allowed',false,'research_reopening_allowed',false,
    'content_source','approved_canonical_report_inventory_only',
    'executive_summary_required_fields',jsonb_build_array('conclusion'),
    'opportunity_required_fields',jsonb_build_array('signal_synopsis','confirmed_facts','why_now','probable_need','risk_cautions','next_action'),
    'optional_fields',jsonb_build_array('headline','fit_and_role','actor_chain','validation_gaps','confidence_note'),
    'executive_context',jsonb_build_object('scope',v_base->'scope','portfolio_summary',v_base->'portfolio_summary',
      'client_opportunity_count',jsonb_array_length(v_signal),'report_company_items',v_company_count,
      'report_signal_items',v_signal_count,'report_source_items',v_source_count,'limitations',v_base->'limitations'),
    'formal_opportunities',v_formal,'signal_opportunities',v_signal,
    'finalize_report_content_shape',jsonb_build_object(
      'executive_summary',jsonb_build_object('conclusion','<synthesis>'),
      'opportunity_editorial',jsonb_build_object('pipeline_version','1.0.0','signal_items',jsonb_build_array(jsonb_build_object(
        'company','<exact company from plan>','company_id','<company_id from plan when available>',
        'editorial',jsonb_build_object('signal_synopsis','<synthesis>','confirmed_facts',jsonb_build_array('<fact>'),
          'why_now','<synthesis>','probable_need','<explicit reasoned inference>','risk_cautions','<cautions>','next_action','<action>'))))),
    'instruction','Generate client prose once from this plan only. Do not browse, search, research, invent facts, contacts, finance or missing fields. Distinguish facts from inference. Include every client-visible signal opportunity; batch generation is allowed but omission is not. Pass the completed content to finalize_report.'
  );
end;
$$;

revoke all on function public.evaluate_report_editorial_payload_v1(jsonb) from public, anon, authenticated;
revoke all on function public.evaluate_report_editorial_pipeline_gate_v1(uuid) from public, anon, authenticated;
revoke all on function public.get_report_editorial_generation_plan_v1(uuid) from public, anon, authenticated;
grant execute on function public.evaluate_report_editorial_payload_v1(jsonb) to service_role;
grant execute on function public.evaluate_report_editorial_pipeline_gate_v1(uuid) to service_role;
grant execute on function public.get_report_editorial_generation_plan_v1(uuid) to service_role;

create or replace function public.get_research_execution_api_v1()
returns jsonb
language sql stable security definer
set search_path = pg_catalog, private, public, pg_temp
as $$
select private.sfp2_prepartial_get_research_execution_api_v1() || jsonb_build_object(
 'workflow_compatible','>=3.13.3',
 'source_activation',jsonb_build_object('profile_version','SAP1','lane_plan','public.get_research_lane_source_plan_v1',
   'company_bound_rule','Only the bound company Entity Query Bundle may activate company_bound sources.',
   'project_bound_rule','Only the bound Project Fresh Sweep may activate project_bound sources.',
   'open_market_excludes',jsonb_build_array('company_bound','project_bound'),'structural_priority','structural_universe first'),
 'autonomous_refresh',jsonb_build_object('policy_version','AutonomousSourceRefreshV1','status','public.get_autonomous_source_refresh_status_v1',
   'mode','fetch_diff_pre_enrichment','request_search_budget_affected',false,'canonical_signal_creation',false,'review_hints_are_prework',true,'worker','source-refresh-worker'),
 'sfp2',jsonb_build_object('policy','SFP2','bounded_policy','BRP2','partial_gate','public.evaluate_verified_partial_delivery_gate_v1',
   'partial_read','public.get_verified_partial_delivery_v1','open_extension_pass','public.open_signal_first_extension_pass_v1',
   'legacy_resolution_extension','deprecated_no_state_change','base_pass_search_budget',400,'default_extension_search_budget',100,
   'cumulative_search_count_is_telemetry_only',true,'continue_grants_new_budget',false,'deepen_grants_new_budget',true,
   'explicit_deepen_required',true,'verified_partial_schema','1.0.0','partial_reference_prefix','IRP','partial_artifacts_enabled',false),
 'report_editorial_pipeline',jsonb_build_object('version','1.0.0','required_for_new_report_versions',true,
   'timing','after_prepare_report_before_finalize_report','plan','public.get_report_editorial_generation_plan_v1',
   'gate','public.evaluate_report_editorial_pipeline_gate_v1','persist_via','finalize_report.content','search_budget_impact',0,
   'web_research_allowed',false,'reopen_research_for_prose',false,'policy','generate_once_persist_in_report_json_render_many'),
 'actions',(private.sfp2_prepartial_get_research_execution_api_v1()->'actions')||jsonb_build_object(
   'prepare_verified_partial','explicit_requested?,reason?; SFP2 only; persists a non-final IRP envelope and leaves research incomplete',
   'open_extension_pass','run-level operation outside leased work; explicit user deepen/amplify only; stable invocation key required; default +100 new searches',
   'finalize_report','report_version_id,expected_inventory_hash,content{}; for new reports content MUST include zero-search editorial synthesis from get_report_editorial_generation_plan_v1 after prepare_report'),
 'protocol',(private.sfp2_prepartial_get_research_execution_api_v1()->'protocol')||jsonb_build_array(
   'SFP2/BRP2 search budgets are per research pass. Historical searches are telemetry only.',
   'continue never grants a new search budget; only an explicit deepen/amplify request opens an extension pass.',
   'Replanning, hash changes and newly persisted facts never mint another search pass.',
   'When the active pass budget is exhausted, new search capture is rejected; non-search verification, reconciliation, Q13 and report closure remain allowed.',
   'SAP1 lane activation prevents company_bound/project_bound sources from leaking into generic Open Market Discovery.',
   'Autonomous refresh is deterministic fetch/diff pre-enrichment and never creates canonical signals or consumes request BRP2 search budget.',
   'After prepare_report and before finalize_report, new report versions require editorial synthesis generated only from the canonical editorial plan. This step consumes zero web searches and may not reopen research.')
);
$$;

create or replace function public.get_induradar_kernel_chat_protocol_v1()
returns jsonb
language sql stable security definer
set search_path = pg_catalog, private, public, pg_temp
as $$
select private.sfp2_prepartial_get_induradar_kernel_chat_protocol_v1()||jsonb_build_object(
 'version','chat-session-1.3.0','methodology_changed',true,
 'intents',(private.sfp2_prepartial_get_induradar_kernel_chat_protocol_v1()->'intents')||jsonb_build_object(
   'continue','Resume and finish the latest compatible incomplete run. Never grants fresh search budget.',
   'deepen','Explicit deepen/amplify on an incomplete SFP2 run opens exactly one idempotent bounded extension pass, default +100 new searches. If the prior run is finalized, deepen creates a deepening report edition with explicit prior-report baseline and continuity conservation; it does not silently restart as an unrelated initial report.'),
 'report_revision_rule','A user-requested update/deepening of an existing finalized report is an edition, not a fresh initial report. The predecessor inventory is conserved or every removal requires an evidenced disposition before publication.',
 'report_editorial_pipeline',jsonb_build_object('version','1.0.0','required_for_new_report_versions',true,
   'sequence',jsonb_build_array('prepare_report','read_editorial_plan','generate_editorial_without_web','finalize_report_with_editorial_content'),
   'plan','public.get_report_editorial_generation_plan_v1','search_budget_impact',0,'web_research_allowed',false,
   'research_reopening_allowed',false,'completion_rule','Every client-visible signal opportunity receives the required editorial fields and executive_summary.conclusion is present before report_payload_status=ready.'),
 'execution_loop',jsonb_build_array('verify_runtime_and_actual_documentary_manifest','dispatch_intent','claim_one_unit',
   'recover_saved_capture_and_unknown_receipts','research_actual_sources','persist_capture_then_findings_and_reviewed_entities',
   'resolve_unit_through_existing_commands','prepare_report_and_read_editorial_plan','generate_zero_search_editorial_from_approved_canonical_content',
   'finalize_report_with_persisted_editorial_content','claim_next_until_research_and_report_finalized','read_status_before_terminal_delivery'),
 'sfp2',jsonb_build_object('verified_partial','A durable IRP response is allowed when its gate passes. It is not final, does not set ready/delivered/succeeded and preserves pending work.',
   'bounded_unverified','At a finite pass boundary with zero independently verified cases, report the incomplete state and preserved pending work; never fabricate a partial.',
   'base_pass','Up to 400 new searches; may close earlier by material-yield/saturation rules.',
   'extension_pass','Explicit deepen/amplify only; default up to 100 new searches independent of historical consumption.',
   'continue','No new budget. Finish current durable obligations only.','replanning','Never grants budget or reopens generic discovery.',
   'terminal_user_response_states',jsonb_build_array('full_report_ready','verified_partial_persisted','bounded_incomplete_no_verified_case','confirmed_global_blocker')),
 'before_ending_execution_turn',(private.sfp2_prepartial_get_induradar_kernel_chat_protocol_v1()->'before_ending_execution_turn')||jsonb_build_object(
   'sfp2_completed_or_bounded_requires','full report OR durable verified partial OR finite no-verified-case status OR confirmed global blocker',
   'full_report_requires_editorial_pipeline','For new report versions, editorial_pipeline_status=complete before final delivery.')
);
$$;

update private.induradar_stack_profiles
set required_migrations = case when coalesce(required_migrations,'[]'::jsonb) @> jsonb_build_array('editorial_closure_pipeline_v1_20260915')
  then required_migrations else coalesce(required_migrations,'[]'::jsonb)||jsonb_build_array('editorial_closure_pipeline_v1_20260915') end,
  updated_at=clock_timestamp()
where active;

update private.induradar_kernel_runtime
set capabilities=jsonb_set(jsonb_set(coalesce(capabilities,'{}'::jsonb),'{report_editorial_pipeline}',jsonb_build_object(
  'version','1.0.0','status','active','required_for_new_report_versions',true,'timing','after_prepare_report_before_finalize_report',
  'content_source','approved_canonical_report_inventory_only','search_budget_impact',0,'web_research_allowed',false,'persist_once_render_many',true),true),
  '{chat_session_protocol,version}',to_jsonb('chat-session-1.3.0'::text),true),updated_at=clock_timestamp()
where singleton=true;
