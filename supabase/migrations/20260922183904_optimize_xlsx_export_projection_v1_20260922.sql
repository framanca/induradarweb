
create or replace function public.get_xlsx_export_payload_by_reference_v1(p_report_reference text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'pg_catalog','public','private','auth','pg_temp'
as $$
declare
  r public.report_versions%rowtype;
  a uuid;
  p jsonb;
  c jsonb;
  v_text text;
  v_sanitization jsonb;
begin
  select rv.* into r
  from public.report_versions rv
  where rv.report_reference=p_report_reference
    and rv.status in('ready','delivered')
    and rv.report_payload_status='ready'
    and rv.finalization_status='finalized'
  order by rv.generated_at desc
  limit 1;

  if not found then raise exception 'Report not found'; end if;

  select rp.account_id into a
  from public.reports rp
  where rp.id=r.report_id;

  if a is null then raise exception 'Report account not found'; end if;
  if auth.uid() is not null and not public.is_account_member(a) then
    raise exception 'Not authorized';
  end if;

  c:=public.evaluate_report_artifact_payload_consistency_v1(r.id);
  if not coalesce((c->>'pass')::boolean,false) then
    raise exception 'Client artifact input blocked by payload consistency gate: %',c;
  end if;

  p:=jsonb_build_object(
    'metadata',coalesce(r.report_payload->'metadata','{}'::jsonb),
    'executive_summary',coalesce(r.report_payload->'executive_summary','{}'::jsonb),
    'scope',coalesce(r.report_payload->'scope','{}'::jsonb),
    'portfolio_summary',jsonb_build_object(
      'client_layers',coalesce(r.report_payload#>'{portfolio_summary,client_layers}','{}'::jsonb)
    ),
    'section_narratives',jsonb_build_object(
      'company_profiles_v1',coalesce(r.report_payload#>'{section_narratives,company_profiles_v1}','{}'::jsonb)
    ),
    'ecosystem',coalesce(r.report_payload->'ecosystem','[]'::jsonb),
    'source_index',coalesce(r.report_payload->'source_index','[]'::jsonb)
  );

  p:=public.induradar_client_neutralize_recipient_jsonb_v1(
    r.id,
    public.induradar_client_sanitize_jsonb(
      public.induradar_strip_request_knowledge_internal_v1(p)
    )
  );

  select coalesce(string_agg(x,E'\n|||CLIENT_FIELD|||\n'),'')
    into v_text
  from private.jsonb_scalar_text_v1(p) x;

  v_sanitization:=public.evaluate_client_text_sanitization_v1(r.id,v_text);
  if not coalesce((v_sanitization->>'pass')::boolean,false) then
    raise exception 'XLSX client projection blocked by sanitization gate: %',v_sanitization;
  end if;

  return jsonb_build_object(
    'report_version_id',r.id,
    'report_reference',r.report_reference,
    'as_of',r.as_of,
    'inventory_hash',r.finalized_inventory_hash,
    'source_payload_hash',r.finalized_payload_hash,
    'artifact_filename',public.induradar_artifact_filename(r.report_reference,'xlsx'),
    'render_contract',public.get_xlsx_render_contract_v2(r.id),
    'payload',p
  );
end
$$;
