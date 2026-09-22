
create or replace function public.induradar_client_sanitize_jsonb(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog','public','pg_temp'
as $$
declare
  v_type text;
  v_result jsonb;
  v_text text;
begin
  if p_value is null then return null; end if;
  v_type := jsonb_typeof(p_value);
  if v_type='object' then
    select coalesce(jsonb_object_agg(
      e.key,
      public.induradar_client_sanitize_jsonb(
        case when e.key='metadata' and jsonb_typeof(e.value)='object'
             then e.value-'edition'
             else e.value end
      )
    ),'{}'::jsonb)
      into v_result
    from jsonb_each(p_value) e
    where e.key not in (
      'canonical_key','research_rule','research_scope_units','neutral_output','audience_mode','delivery_format',
      'research_run_id','report_version_id','report_id','service_request_id','request_fingerprint','request_fingerprint_version',
      'workflow_version','contract_version','execution_contract_version','report_template_version','inventory_hash',
      'report_item_snapshot','render_contract','origin_refs','prior_snapshot','current_snapshot','capability_manifest',
      'baseline_snapshot','source_plan_snapshot','cumulative_baseline_summary','knowledge_gate_snapshot','external_key','fingerprint','from_key','to_key'
    )
      and e.key !~ '(^|_)id$';
    return v_result;
  elsif v_type='array' then
    select coalesce(jsonb_agg(public.induradar_client_sanitize_jsonb(a.value) order by a.ord),'[]'::jsonb)
      into v_result
    from jsonb_array_elements(p_value) with ordinality a(value,ord);
    return v_result;
  elsif v_type='string' then
    v_text := p_value #>> '{}';
    v_text := regexp_replace(v_text,'requiere resolver la empresa can[oó]nica y verificar','conviene verificar','gi');
    v_text := regexp_replace(v_text,'empresa can[oó]nica','empresa identificada','gi');
    v_text := regexp_replace(v_text,'proyecto can[oó]nico','proyecto relacionado','gi');
    v_text := regexp_replace(v_text,'se[nñ]al can[oó]nica','señal registrada','gi');
    return to_jsonb(v_text);
  else
    return p_value;
  end if;
end;
$$;

create or replace function public.evaluate_report_artifact_payload_consistency_v1(p_report_version_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog','public','private','auth','pg_temp'
as $$
declare
  r public.report_versions%rowtype;
  a uuid;
  p jsonb;
  exec_counts jsonb;
  ps_counts jsonb;
  client_layers jsonb;
  signal_opps jsonb;
  universe jsonb;
  expected_signal_opps jsonb;
  errors jsonb:='[]'::jsonb;
  visible_n integer;
  expected_visible_n integer;
  universe_n integer;
  formal_n integer;
  ecosystem_n integer;
  watchlist_n integer;
  emerging_n integer;
  review_n integer;
  near_n integer;
  duplicate_signal_company_n integer;
  duplicate_universe_company_n integer;
  missing_signal_company_in_universe_n integer;
  continuity jsonb := null;
  correction_kernel_exception boolean := false;
begin
  select * into r from public.report_versions where id=p_report_version_id;
  if not found then return jsonb_build_object('gate','REPORT-ARTIFACT-PAYLOAD-CONSISTENCY','pass',false,'reason','report_not_found'); end if;
  select rp.account_id into a from public.reports rp where rp.id=r.report_id;
  if auth.uid() is not null and not public.is_account_member(a) then raise exception 'Not authorized'; end if;
  if r.status not in ('ready','delivered') or r.report_payload_status<>'ready' or r.finalization_status<>'finalized' then
    return jsonb_build_object('gate','REPORT-ARTIFACT-PAYLOAD-CONSISTENCY','pass',false,'reason','report_not_finalized');
  end if;

  p:=r.report_payload;
  exec_counts:=coalesce(p#>'{executive_summary,counts}','{}'::jsonb);
  ps_counts:=p#>'{portfolio_summary,counts}';
  client_layers:=coalesce(p#>'{portfolio_summary,client_layers}','{}'::jsonb);
  signal_opps:=case when jsonb_typeof(client_layers->'signal_opportunities')='array' then client_layers->'signal_opportunities' else '[]'::jsonb end;
  universe:=case when jsonb_typeof(client_layers->'company_universe')='array' then client_layers->'company_universe' else '[]'::jsonb end;
  expected_signal_opps:=public.build_report_signal_ranked_client_opportunities_v1(r.id);

  visible_n:=jsonb_array_length(signal_opps);
  expected_visible_n:=jsonb_array_length(expected_signal_opps);
  universe_n:=jsonb_array_length(universe);
  formal_n:=case when jsonb_typeof(p->'opportunities')='array' then jsonb_array_length(p->'opportunities') else 0 end;
  ecosystem_n:=case when jsonb_typeof(p->'ecosystem')='array' then jsonb_array_length(p->'ecosystem') else 0 end;
  watchlist_n:=case when jsonb_typeof(p->'watchlist')='array' then jsonb_array_length(p->'watchlist') else 0 end;
  emerging_n:=case when jsonb_typeof(p->'emerging_opportunities')='array' then jsonb_array_length(p->'emerging_opportunities') else 0 end;
  review_n:=case when jsonb_typeof(p->'opportunities_to_review')='array' then jsonb_array_length(p->'opportunities_to_review') else 0 end;
  near_n:=case when jsonb_typeof(p->'near_promotion')='array' then jsonb_array_length(p->'near_promotion') else 0 end;

  if r.revision_kind='correction' and r.previous_report_version_id is not null then
    continuity:=public.evaluate_report_edition_continuity_gate(r.id);
    correction_kernel_exception :=
      coalesce((r.revision_scope->>'no_new_market_research')::boolean,false)
      and not coalesce((r.revision_scope->>'facts_modified')::boolean,true)
      and coalesce((r.revision_scope->>'preserve_signal_opportunities')::integer,-1)=visible_n
      and coalesce((r.revision_scope->>'preserve_company_universe')::integer,-1)=universe_n
      and coalesce((continuity->>'pass')::boolean,false);
  end if;

  if jsonb_typeof(client_layers)<>'object' then errors:=errors||jsonb_build_array('client_layers_object_required'); end if;
  if not (client_layers ? 'signal_opportunities') then errors:=errors||jsonb_build_array('client_layers_signal_opportunities_required'); end if;
  if not (client_layers ? 'company_universe') then errors:=errors||jsonb_build_array('client_layers_company_universe_required'); end if;

  if visible_n<>expected_visible_n and not correction_kernel_exception then
    errors:=errors||jsonb_build_array('signal_opportunity_count_vs_kernel_mismatch');
  end if;

  if coalesce((exec_counts->>'visible_opportunity_total')::integer,-1)<>visible_n
     and (
       coalesce((exec_counts->>'signal_opportunities')::integer,-1)<>visible_n
       or coalesce((exec_counts->>'signal_bearing_company_count')::integer,-1)<>visible_n
     )
  then
    errors:=errors||jsonb_build_array('executive_visible_opportunity_count_mismatch');
  end if;
  if coalesce((exec_counts->>'signal_opportunities')::integer,-1)<>visible_n then errors:=errors||jsonb_build_array('executive_signal_opportunity_count_mismatch'); end if;
  if coalesce((exec_counts->>'signal_bearing_company_count')::integer,-1)<>visible_n then errors:=errors||jsonb_build_array('executive_signal_bearing_company_count_mismatch'); end if;
  if jsonb_typeof(ps_counts)='object' and ps_counts ? 'visible_opportunity_total' and coalesce((ps_counts->>'visible_opportunity_total')::integer,-1)<>visible_n then errors:=errors||jsonb_build_array('portfolio_visible_opportunity_count_mismatch'); end if;
  if coalesce((exec_counts->>'retained_company_universe')::integer,-1)<>universe_n then errors:=errors||jsonb_build_array('executive_company_universe_count_mismatch'); end if;
  if formal_n<>coalesce((exec_counts->>'formal_opportunities_internal')::integer,-1) then errors:=errors||jsonb_build_array('executive_formal_opportunity_count_mismatch'); end if;
  if jsonb_typeof(ps_counts)='object' and ps_counts ? 'formal_opportunities_internal' and formal_n<>coalesce((ps_counts->>'formal_opportunities_internal')::integer,-1) then errors:=errors||jsonb_build_array('portfolio_formal_opportunity_count_mismatch'); end if;
  if ecosystem_n<>coalesce((exec_counts->>'ecosystem')::integer,-1) then errors:=errors||jsonb_build_array('executive_ecosystem_count_mismatch'); end if;
  if watchlist_n<>coalesce((exec_counts->>'watchlist')::integer,-1) then errors:=errors||jsonb_build_array('executive_watchlist_count_mismatch'); end if;
  if emerging_n<>coalesce((exec_counts->>'emerging_opportunities')::integer,-1) then errors:=errors||jsonb_build_array('executive_emerging_count_mismatch'); end if;
  if review_n<>coalesce((exec_counts->>'opportunities_to_review')::integer,-1) then errors:=errors||jsonb_build_array('executive_review_count_mismatch'); end if;
  if near_n<>coalesce((exec_counts->>'near_promotion')::integer,-1) then errors:=errors||jsonb_build_array('executive_near_promotion_count_mismatch'); end if;

  select count(*) into duplicate_signal_company_n
  from (
    select coalesce(x->>'company_id',x->>'company') k,count(*) n
    from jsonb_array_elements(signal_opps) x
    group by 1 having count(*)>1
  ) q;
  if duplicate_signal_company_n>0 then errors:=errors||jsonb_build_array('duplicate_signal_opportunity_company'); end if;

  select count(*) into duplicate_universe_company_n
  from (
    select coalesce(x->>'company_id',x->>'company',x->>'name') k,count(*) n
    from jsonb_array_elements(universe) x
    group by 1 having count(*)>1
  ) q;
  if duplicate_universe_company_n>0 then errors:=errors||jsonb_build_array('duplicate_company_universe_member'); end if;

  select count(*) into missing_signal_company_in_universe_n
  from jsonb_array_elements(signal_opps) s
  where not exists (
    select 1 from jsonb_array_elements(universe) u
    where coalesce(u->>'company_id',u->>'company',u->>'name')=coalesce(s->>'company_id',s->>'company',s->>'name')
  );
  if missing_signal_company_in_universe_n>0 then errors:=errors||jsonb_build_array('signal_opportunity_missing_from_company_universe'); end if;

  return jsonb_build_object(
    'gate','REPORT-ARTIFACT-PAYLOAD-CONSISTENCY',
    'version','1.2.0',
    'pass',jsonb_array_length(errors)=0,
    'report_reference',r.report_reference,
    'errors',errors,
    'counts',jsonb_build_object(
      'signal_opportunities',visible_n,
      'kernel_signal_opportunities',expected_visible_n,
      'company_universe',universe_n,
      'lossless_company_inventory',case when jsonb_typeof(p->'companies')='array' then jsonb_array_length(p->'companies') else 0 end,
      'formal_opportunities',formal_n,
      'ecosystem',ecosystem_n,
      'watchlist',watchlist_n,
      'emerging',emerging_n,
      'to_review',review_n,
      'near_promotion',near_n
    ),
    'kernel_mismatch_accepted_by_correction_scope',correction_kernel_exception and visible_n<>expected_visible_n,
    'correction_continuity',continuity,
    'duplicate_signal_company_count',duplicate_signal_company_n,
    'duplicate_universe_company_count',duplicate_universe_company_n,
    'signal_company_missing_from_universe_count',missing_signal_company_in_universe_n,
    'scope_note','A finalized correction may preserve an approved predecessor client layer without new market research when its revision scope explicitly preserves the client portfolio and universe and the edition continuity gate passes.'
  );
end;
$$;
