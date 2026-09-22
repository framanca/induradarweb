create or replace function public.portal_submit_feedback_v1(
  p_report_reference text,
  p_entity_type text,
  p_entity_id uuid,
  p_useful boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth','pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_report_version_id uuid;
  v_account_id uuid;
  v_payload jsonb;
  v_feedback_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_exists boolean := false;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  if p_entity_type not in ('client_opportunity','company') then
    raise exception 'invalid_entity_type' using errcode='22023';
  end if;
  if length(coalesce(v_reason,''))>2000 then
    raise exception 'reason_too_long' using errcode='22023';
  end if;

  select rv.id, r.account_id, rv.report_payload
    into v_report_version_id, v_account_id, v_payload
  from public.report_versions rv
  join public.reports r on r.id=rv.report_id
  where rv.report_reference=upper(btrim(p_report_reference))
    and rv.status in ('ready','delivered')
    and rv.report_payload_status='ready'
    and rv.finalization_status='finalized'
  order by rv.generated_at desc
  limit 1;

  if v_report_version_id is null then
    raise exception 'report_not_found' using errcode='P0002';
  end if;
  if not public.is_account_member(v_account_id) then
    raise exception 'not_authorized' using errcode='42501';
  end if;

  if p_entity_type='client_opportunity' then
    select exists(
      select 1
      from jsonb_array_elements(coalesce(v_payload#>'{portfolio_summary,client_layers,signal_opportunities}','[]'::jsonb)) x
      where x->>'company_id'=p_entity_id::text
    ) into v_exists;
  else
    select exists(
      select 1
      from jsonb_array_elements(coalesce(v_payload#>'{portfolio_summary,client_layers,company_universe}','[]'::jsonb)) x
      where x->>'company_id'=p_entity_id::text
    ) or exists(
      select 1
      from jsonb_array_elements(coalesce(v_payload#>'{portfolio_summary,client_layers,signal_opportunities}','[]'::jsonb)) x
      where x->>'company_id'=p_entity_id::text
    ) into v_exists;
  end if;

  if not v_exists then
    raise exception 'entity_not_in_report' using errcode='22023';
  end if;

  if p_useful is null then
    delete from public.feedback
    where account_id=v_account_id
      and user_id=v_uid
      and entity_type=p_entity_type
      and entity_id=p_entity_id
      and report_version_id=v_report_version_id;

    return jsonb_build_object(
      'pass',true,
      'cleared',true,
      'entity_type',p_entity_type,
      'entity_id',p_entity_id
    );
  end if;

  insert into public.feedback(
    account_id,entity_type,entity_id,useful,reason,action_taken,user_id,
    why_not_useful,structured_payload,review_status,canonical_eligible,
    report_version_id,updated_at
  ) values (
    v_account_id,p_entity_type,p_entity_id,p_useful,v_reason,'portal_feedback',v_uid,
    case when p_useful=false then v_reason else null end,
    jsonb_build_object('source','portal_report','report_reference',upper(btrim(p_report_reference))),
    'pending',false,v_report_version_id,clock_timestamp()
  )
  on conflict (account_id,user_id,entity_type,entity_id,report_version_id)
    where user_id is not null and report_version_id is not null
      and entity_type in ('client_opportunity','company')
  do update set
    useful=excluded.useful,
    reason=excluded.reason,
    action_taken='portal_feedback',
    why_not_useful=excluded.why_not_useful,
    structured_payload=excluded.structured_payload,
    review_status='pending',
    reviewed_by=null,
    reviewed_at=null,
    canonical_eligible=false,
    promotion_note=null,
    updated_at=clock_timestamp()
  returning id into v_feedback_id;

  return jsonb_build_object(
    'pass',true,
    'feedback_id',v_feedback_id,
    'entity_type',p_entity_type,
    'entity_id',p_entity_id,
    'useful',p_useful,
    'reason',v_reason
  );
end
$$;

revoke all on function public.portal_submit_feedback_v1(text,text,uuid,boolean,text) from public, anon;
grant execute on function public.portal_submit_feedback_v1(text,text,uuid,boolean,text) to authenticated, service_role;
