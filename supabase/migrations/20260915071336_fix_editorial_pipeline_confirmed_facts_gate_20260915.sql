-- Preserve the exact production migration history. The base migration in this
-- repository already includes the corrected predicate; this patch is intentionally
-- idempotent and documents the runtime hotfix that was applied to production.

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
      if jsonb_typeof(v_editorial->v_key) is distinct from 'string' or nullif(btrim(v_editorial->>v_key),'') is null then
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
        'company',coalesce(v_item->>'company',v_item#>>'{companies,0,name}'),'title',v_item->>'title','missing_fields',v_fields)));
    end if;
  end loop;
  return jsonb_build_object('gate','REPORT-EDITORIAL-V1','pass',v_summary_ok and v_complete=v_expected,
    'collection',v_collection,'executive_summary_conclusion_present',v_summary_ok,
    'expected_opportunity_editorials',v_expected,'complete_opportunity_editorials',v_complete,
    'missing_opportunity_editorials',v_missing,
    'required_fields',jsonb_build_array('signal_synopsis','confirmed_facts','why_now','probable_need','risk_cautions','next_action'),
    'search_budget_impact',0,'web_research_allowed',false,'content_source','approved_report_payload_only');
end;
$$;

update private.induradar_stack_profiles
set required_migrations = case when coalesce(required_migrations,'[]'::jsonb) @> jsonb_build_array('fix_editorial_pipeline_confirmed_facts_gate_20260915')
  then required_migrations else coalesce(required_migrations,'[]'::jsonb)||jsonb_build_array('fix_editorial_pipeline_confirmed_facts_gate_20260915') end,
  updated_at=clock_timestamp()
where active;
