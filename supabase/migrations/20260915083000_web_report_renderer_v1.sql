-- InduRadar Web Report Renderer v1
-- Additive runtime capability for Workflow 3.14.0 / Report Schema 2.0.0.
-- Keeps the canonical 36 root keys unchanged. Editorial prose remains optional
-- and is embedded once into the immutable Report JSON; web rendering never
-- creates facts or calls an LLM.

create or replace function public.normalize_report_editorial_block_v1(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_key text;
  v_array jsonb;
begin
  if jsonb_typeof(coalesce(p_value, '{}'::jsonb)) <> 'object' then
    return '{}'::jsonb;
  end if;

  foreach v_key in array array[
    'headline',
    'signal_synopsis',
    'why_now',
    'probable_need',
    'fit_and_role',
    'actor_chain',
    'risk_cautions',
    'next_action',
    'confidence_note'
  ] loop
    if jsonb_typeof(p_value->v_key) = 'string'
       and nullif(btrim(p_value->>v_key), '') is not null then
      v_result := v_result || jsonb_build_object(v_key, btrim(p_value->>v_key));
    end if;
  end loop;

  foreach v_key in array array['confirmed_facts', 'validation_gaps'] loop
    if jsonb_typeof(p_value->v_key) = 'array' then
      select coalesce(jsonb_agg(to_jsonb(btrim(e.value #>> '{}')) order by e.ord), '[]'::jsonb)
        into v_array
      from jsonb_array_elements(p_value->v_key) with ordinality e(value, ord)
      where jsonb_typeof(e.value) = 'string'
        and nullif(btrim(e.value #>> '{}'), '') is not null;
      if jsonb_array_length(v_array) > 0 then
        v_result := v_result || jsonb_build_object(v_key, v_array);
      end if;
    end if;
  end loop;

  if v_result <> '{}'::jsonb then
    v_result := jsonb_build_object('schema_version', '1.0.0') || v_result;
  end if;
  return v_result;
end;
$$;

comment on function public.normalize_report_editorial_block_v1(jsonb) is
'Normalizes optional client editorial prose. It accepts only presentation fields; no IDs, URLs or research-control metadata are part of the editorial contract.';

create or replace function public.trg_embed_report_editorial_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_root jsonb;
  v_formal_input jsonb;
  v_signal_input jsonb;
  v_cache_map jsonb;
  v_formal jsonb;
  v_signal jsonb;
  v_formal_count integer := 0;
  v_signal_count integer := 0;
begin
  if coalesce(new.report_schema_generation, 1) <> 2
     or jsonb_typeof(coalesce(new.report_payload, '{}'::jsonb)) <> 'object' then
    return new;
  end if;

  v_root := case
    when jsonb_typeof(new.report_payload->'opportunity_editorial') = 'object'
      then new.report_payload->'opportunity_editorial'
    else '{}'::jsonb
  end;
  v_formal_input := case when jsonb_typeof(v_root->'items') = 'array' then v_root->'items' else '[]'::jsonb end;
  v_signal_input := case when jsonb_typeof(v_root->'signal_items') = 'array' then v_root->'signal_items' else '[]'::jsonb end;

  select coalesce(jsonb_object_agg(ri.entity_id::text, ri.explanation_snapshot->'editorial_cache'), '{}'::jsonb)
    into v_cache_map
  from public.report_items ri
  where ri.report_version_id = new.id
    and ri.entity_type = 'opportunity'
    and jsonb_typeof(ri.explanation_snapshot->'editorial_cache') = 'object';

  if jsonb_typeof(new.report_payload->'opportunities') = 'array' then
    select coalesce(jsonb_agg(
      case when x.editorial <> '{}'::jsonb
        then jsonb_set(x.item, '{editorial}', x.editorial, true)
        else x.item
      end order by x.ord
    ), '[]'::jsonb),
    count(*) filter (where x.editorial <> '{}'::jsonb)
    into v_formal, v_formal_count
    from (
      select o.value as item, o.ord,
        public.normalize_report_editorial_block_v1(
          coalesce(
            (
              select i.value->'editorial'
              from jsonb_array_elements(v_formal_input) i(value)
              where (i.value->>'opportunity_id' is not null and i.value->>'opportunity_id' = o.value->>'opportunity_id')
                 or (i.value->>'canonical_key' is not null and i.value->>'canonical_key' = o.value->>'canonical_key')
              limit 1
            ),
            case when o.value->>'opportunity_id' is not null then v_cache_map->(o.value->>'opportunity_id') end,
            o.value->'editorial'
          )
        ) as editorial
      from jsonb_array_elements(new.report_payload->'opportunities') with ordinality o(value, ord)
    ) x;
    new.report_payload := jsonb_set(new.report_payload, '{opportunities}', v_formal, true);
  end if;

  if jsonb_typeof(new.report_payload#>'{portfolio_summary,client_layers,signal_opportunities}') = 'array' then
    select coalesce(jsonb_agg(
      case when x.editorial <> '{}'::jsonb
        then jsonb_set(x.item, '{editorial}', x.editorial, true)
        else x.item
      end order by x.ord
    ), '[]'::jsonb),
    count(*) filter (where x.editorial <> '{}'::jsonb)
    into v_signal, v_signal_count
    from (
      select o.value as item, o.ord,
        public.normalize_report_editorial_block_v1(
          coalesce(
            (
              select i.value->'editorial'
              from jsonb_array_elements(v_signal_input) i(value)
              where (i.value->>'company_id' is not null and i.value->>'company_id' = o.value->>'company_id')
                 or (
                      i.value->>'company' is not null
                      and lower(btrim(i.value->>'company')) = lower(btrim(o.value->>'company'))
                    )
              limit 1
            ),
            o.value->'editorial'
          )
        ) as editorial
      from jsonb_array_elements(new.report_payload#>'{portfolio_summary,client_layers,signal_opportunities}') with ordinality o(value, ord)
    ) x;
    new.report_payload := jsonb_set(
      new.report_payload,
      '{portfolio_summary,client_layers,signal_opportunities}',
      v_signal,
      true
    );
  end if;

  -- The transport arrays are removed after embedding so the final JSON does not
  -- duplicate prose. The remaining root object contains only policy/coverage
  -- metadata and any portfolio-level editorial supplied by report assembly.
  v_root := (v_root - 'items' - 'signal_items') || jsonb_build_object(
    'schema_version', '1.0.0',
    'policy', 'approved_once_render_many',
    'editorial_required_for_report_ready', false,
    'renderer_fallback', 'structured_fields',
    'embedded_formal_editorial_count', v_formal_count,
    'embedded_signal_editorial_count', v_signal_count
  );
  new.report_payload := jsonb_set(new.report_payload, '{opportunity_editorial}', v_root, true);

  return new;
end;
$$;

comment on function public.trg_embed_report_editorial_v1() is
'Embeds optional one-time editorial prose into opportunity objects before report hashes are frozen. Transport mappings are removed to avoid duplicate literature.';

drop trigger if exists zz19c_report_editorial_embed on public.report_versions;
create trigger zz19c_report_editorial_embed
before insert or update of report_payload on public.report_versions
for each row execute function public.trg_embed_report_editorial_v1();

create or replace function public.induradar_web_renderer_contract_v1()
returns jsonb
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
select jsonb_build_object(
  'web_report_renderer_version', '1.0.0',
  'content_source', 'approved_report_payload_only',
  'deterministic', true,
  'ai_at_view_time', false,
  'renderer_may_add_substantive_content', false,
  'renderer_may_omit_client_visible_opportunities', false,
  'primary_opportunity_collection', 'portfolio_summary.client_layers.signal_opportunities',
  'fallback_opportunity_collection', 'opportunities',
  'company_universe_collection', 'portfolio_summary.client_layers.company_universe',
  'editorial_priority', jsonb_build_array('embedded_editorial', 'structured_fields'),
  'render_modes', jsonb_build_array('screen', 'print')
);
$$;

comment on function public.induradar_web_renderer_contract_v1() is
'Deterministic HTML/Web renderer contract. Viewing a report never invokes AI or creates substantive content.';

create or replace function public.evaluate_web_report_payload_gate_v1(p_report_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  r public.report_versions%rowtype;
  v_account uuid;
  v_schema jsonb;
  v_consistency jsonb;
  v_sanitization jsonb;
  v_visible integer := 0;
  v_editorial integer := 0;
  v_pass boolean := false;
begin
  select rv.*, rp.account_id
    into r, v_account
  from public.report_versions rv
  join public.reports rp on rp.id = rv.report_id
  where rv.id = p_report_version_id;

  if not found then
    raise exception 'Report not found';
  end if;
  if auth.uid() is not null and not public.is_account_member(v_account) then
    raise exception 'Not authorized';
  end if;

  v_schema := public.evaluate_report_payload_schema_v2(r.report_payload, r.report_reference, r.inventory_hash);
  v_consistency := public.evaluate_report_artifact_payload_consistency_v1(r.id);
  v_sanitization := public.evaluate_client_artifact_source_sanitization_gate_v1(r.id);

  if jsonb_typeof(r.report_payload#>'{portfolio_summary,client_layers,signal_opportunities}') = 'array' then
    v_visible := jsonb_array_length(r.report_payload#>'{portfolio_summary,client_layers,signal_opportunities}');
    select count(*) into v_editorial
    from jsonb_array_elements(r.report_payload#>'{portfolio_summary,client_layers,signal_opportunities}') e
    where jsonb_typeof(e->'editorial') = 'object' and e->'editorial' <> '{}'::jsonb;
  elsif jsonb_typeof(r.report_payload->'opportunities') = 'array' then
    v_visible := jsonb_array_length(r.report_payload->'opportunities');
    select count(*) into v_editorial
    from jsonb_array_elements(r.report_payload->'opportunities') e
    where jsonb_typeof(e->'editorial') = 'object' and e->'editorial' <> '{}'::jsonb;
  end if;

  v_pass := r.status in ('ready', 'delivered')
    and r.report_payload_status = 'ready'
    and r.finalization_status = 'finalized'
    and coalesce((v_schema->>'pass')::boolean, false)
    and coalesce((v_consistency->>'pass')::boolean, false)
    and coalesce((v_sanitization->>'pass')::boolean, false);

  return jsonb_build_object(
    'gate', 'WEB-REPORT-V1',
    'pass', v_pass,
    'report_reference', r.report_reference,
    'state_ok', r.status in ('ready', 'delivered') and r.report_payload_status = 'ready' and r.finalization_status = 'finalized',
    'schema_gate', v_schema,
    'payload_consistency_gate', v_consistency,
    'client_sanitization_gate', v_sanitization,
    'visible_opportunity_count', v_visible,
    'embedded_editorial_count', v_editorial,
    'editorial_coverage_ratio', case when v_visible = 0 then 1 else round(v_editorial::numeric / v_visible, 4) end,
    'editorial_required', false,
    'renderer_contract', public.induradar_web_renderer_contract_v1()
  );
end;
$$;

create or replace function public.get_web_report_payload_v1(p_report_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  r public.report_versions%rowtype;
  v_account uuid;
  v_gate jsonb;
  v_payload jsonb;
begin
  select rv.*, rp.account_id
    into r, v_account
  from public.report_versions rv
  join public.reports rp on rp.id = rv.report_id
  where rv.id = p_report_version_id;

  if not found then raise exception 'Report not found'; end if;
  if auth.uid() is not null and not public.is_account_member(v_account) then
    raise exception 'Not authorized';
  end if;

  v_gate := public.evaluate_web_report_payload_gate_v1(r.id);
  if not coalesce((v_gate->>'pass')::boolean, false) then
    raise exception 'Web report blocked by delivery gate: %', v_gate;
  end if;

  v_payload := public.induradar_client_sanitize_jsonb(
    public.induradar_strip_request_knowledge_internal_v1(r.report_payload)
  );
  v_payload := jsonb_set(v_payload, '{render_contract}', public.induradar_web_renderer_contract_v1(), true);

  return jsonb_build_object(
    'report_reference', r.report_reference,
    'as_of', r.as_of,
    'renderer_version', '1.0.0',
    'payload', v_payload
  );
end;
$$;

create or replace function public.get_web_report_payload_by_reference_v1(p_report_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_id uuid;
begin
  select rv.id into v_id
  from public.report_versions rv
  where rv.report_reference = p_report_reference
    and rv.status in ('ready', 'delivered')
  order by rv.generated_at desc
  limit 1;

  if v_id is null then raise exception 'Report not found'; end if;
  return public.get_web_report_payload_v1(v_id);
end;
$$;

comment on function public.get_web_report_payload_v1(uuid) is
'Returns the approved, client-sanitized Report JSON plus a safe deterministic renderer contract. No AI is called at view time.';
comment on function public.get_web_report_payload_by_reference_v1(text) is
'Authenticated web-report lookup by public IR reference. Authorization is enforced by the underlying account-membership check.';

create or replace function public.get_report_editorial_generation_plan_v1(p_report_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  r public.report_versions%rowtype;
  v_formal jsonb := '[]'::jsonb;
  v_signal jsonb := '[]'::jsonb;
begin
  select * into r from public.report_versions where id = p_report_version_id;
  if not found then raise exception 'Report not found'; end if;

  if jsonb_typeof(r.report_payload->'opportunities') = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'opportunity_id', e->>'opportunity_id',
      'canonical_key', e->>'canonical_key',
      'title', e->>'title',
      'summary_neutral', e->'summary_neutral',
      'probable_needs', e->'probable_needs',
      'signals', e->'signals',
      'risks', e->'risks',
      'next_action', e->'next_action',
      'target_role', e->'target_role',
      'editorial_present', jsonb_typeof(e->'editorial') = 'object' and e->'editorial' <> '{}'::jsonb
    )), '[]'::jsonb) into v_formal
    from jsonb_array_elements(r.report_payload->'opportunities') e;
  end if;

  if jsonb_typeof(r.report_payload#>'{portfolio_summary,client_layers,signal_opportunities}') = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'company_id', e->>'company_id',
      'company', e->>'company',
      'title', e->>'title',
      'signal_count', e->'signal_count',
      'signals', e->'signals',
      'next_action', e->'next_action',
      'target_role', e->'target_role',
      'editorial_present', jsonb_typeof(e->'editorial') = 'object' and e->'editorial' <> '{}'::jsonb
    ) order by coalesce((e->>'rank')::integer, 2147483647)), '[]'::jsonb) into v_signal
    from jsonb_array_elements(r.report_payload#>'{portfolio_summary,client_layers,signal_opportunities}') e;
  end if;

  return jsonb_build_object(
    'report_version_id', r.id,
    'report_reference', r.report_reference,
    'editorial_schema_version', '1.0.0',
    'required_for_report_ready', false,
    'allowed_fields', jsonb_build_array(
      'headline','signal_synopsis','confirmed_facts','why_now','probable_need',
      'fit_and_role','actor_chain','validation_gaps','risk_cautions','next_action','confidence_note'
    ),
    'formal_opportunities', v_formal,
    'signal_opportunities', v_signal,
    'instruction', 'Generate only synthesis supported by the approved payload. Do not research, invent facts, contacts, finance or missing fields. Persist once; render many.'
  );
end;
$$;

comment on function public.get_report_editorial_generation_plan_v1(uuid) is
'Non-blocking editorial plan for one-time synthesis from the approved report payload. It creates no research obligation and performs no web search.';

create or replace function public.get_report_payload_storage_metrics_v1()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
select jsonb_build_object(
  'report_version_count', count(*),
  'payload_bytes_total', coalesce(sum(pg_column_size(report_payload)), 0),
  'payload_bytes_avg', coalesce(round(avg(pg_column_size(report_payload))::numeric, 2), 0),
  'payload_bytes_p95', coalesce(percentile_cont(0.95) within group (order by pg_column_size(report_payload)), 0),
  'payload_bytes_max', coalesce(max(pg_column_size(report_payload)), 0),
  'finalized_report_count', count(*) filter (where finalization_status = 'finalized')
) from public.report_versions;
$$;

comment on function public.get_report_payload_storage_metrics_v1() is
'Internal storage telemetry for deciding if/when historical Report JSON should move to object storage. No payload GIN index is required.';

revoke all on function public.get_web_report_payload_v1(uuid) from public, anon;
revoke all on function public.get_web_report_payload_by_reference_v1(text) from public, anon;
revoke all on function public.evaluate_web_report_payload_gate_v1(uuid) from public, anon;
grant execute on function public.get_web_report_payload_v1(uuid) to authenticated, service_role;
grant execute on function public.get_web_report_payload_by_reference_v1(text) to authenticated, service_role;
grant execute on function public.evaluate_web_report_payload_gate_v1(uuid) to authenticated, service_role;

revoke all on function public.get_report_editorial_generation_plan_v1(uuid) from public, anon, authenticated;
revoke all on function public.get_report_payload_storage_metrics_v1() from public, anon, authenticated;
grant execute on function public.get_report_editorial_generation_plan_v1(uuid) to service_role;
grant execute on function public.get_report_payload_storage_metrics_v1() to service_role;
