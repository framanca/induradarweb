
create table if not exists private.account_company_preferences (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  preference text not null check (preference in ('preferred','excluded')),
  reason text,
  source_report_version_id uuid references public.report_versions(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id,company_id)
);

alter table private.account_company_preferences enable row level security;
revoke all on private.account_company_preferences from public, anon, authenticated;

insert into private.account_company_preferences(
  id,account_id,company_id,preference,reason,source_report_version_id,created_by,created_at,updated_at
)
select id,account_id,company_id,preference,reason,source_report_version_id,created_by,created_at,updated_at
from public.account_company_preferences
on conflict(account_id,company_id) do update set
  preference=excluded.preference,
  reason=excluded.reason,
  source_report_version_id=excluded.source_report_version_id,
  created_by=excluded.created_by,
  updated_at=excluded.updated_at;

create index if not exists private_account_company_preferences_account_idx
  on private.account_company_preferences(account_id,preference,company_id);

create or replace function public.portal_get_report_interactions_v1(p_report_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private','auth','pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_report_version_id uuid;
  v_account_id uuid;
  v_payload jsonb;
  v_title text;
  v_generated_at timestamptz;
  v_opportunities jsonb;
  v_companies jsonb;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;

  select rv.id, r.account_id, rv.report_payload, r.title, rv.generated_at
    into v_report_version_id, v_account_id, v_payload, v_title, v_generated_at
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

  with items as (
    select
      x as item,
      case when coalesce(x->>'company_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (x->>'company_id')::uuid end as company_id,
      ord
    from jsonb_array_elements(coalesce(v_payload#>'{portfolio_summary,client_layers,signal_opportunities}','[]'::jsonb))
      with ordinality as t(x,ord)
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'company_id', i.company_id,
    'company', coalesce(i.item->>'company',i.item->>'title','Empresa'),
    'title', coalesce(i.item->>'title',i.item->>'company','Oportunidad'),
    'rank', i.item->'rank',
    'opportunity_rank_score', coalesce(i.item->'opportunity_rank_score',i.item->'signal_score'),
    'temperature', i.item->>'temperature',
    'useful', f.useful,
    'reason', f.reason
  )) order by i.ord),'[]'::jsonb)
  into v_opportunities
  from items i
  left join public.feedback f
    on f.account_id=v_account_id
   and f.user_id=v_uid
   and f.entity_type='client_opportunity'
   and f.entity_id=i.company_id
   and f.report_version_id=v_report_version_id
  where i.company_id is not null;

  with items as (
    select
      x as item,
      case when coalesce(x->>'company_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (x->>'company_id')::uuid end as company_id,
      ord
    from jsonb_array_elements(coalesce(v_payload#>'{portfolio_summary,client_layers,company_universe}','[]'::jsonb))
      with ordinality as t(x,ord)
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'company_id', i.company_id,
    'company', coalesce(i.item->>'company',i.item->>'name',i.item->>'legal_name','Empresa'),
    'province', i.item->>'province',
    'municipality', i.item->>'municipality',
    'country', i.item->>'country',
    'preference', p.preference,
    'reason', p.reason,
    'preference_updated_at', p.updated_at
  )) order by i.ord),'[]'::jsonb)
  into v_companies
  from items i
  left join private.account_company_preferences p
    on p.account_id=v_account_id and p.company_id=i.company_id
  where i.company_id is not null;

  return jsonb_build_object(
    'report_reference',upper(btrim(p_report_reference)),
    'report_version_id',v_report_version_id,
    'report_generated_at',v_generated_at,
    'title',v_title,
    'opportunities',v_opportunities,
    'companies',v_companies
  );
end
$$;

create or replace function public.portal_set_company_preference_v1(
  p_report_reference text,
  p_company_id uuid,
  p_preference text,
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
  v_source_request_id uuid;
  v_source_request public.service_requests%rowtype;
  v_payload jsonb;
  v_company_name text;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_exists boolean := false;
  v_request_id uuid;
  v_submission_id uuid;
  v_request_key text;
  v_request_payload jsonb;
  v_request_obj jsonb;
  v_intake jsonb;
  v_extensions jsonb;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  if p_preference not in ('preferred','excluded','neutral') then
    raise exception 'invalid_preference' using errcode='22023';
  end if;
  if length(coalesce(v_reason,''))>2000 then
    raise exception 'reason_too_long' using errcode='22023';
  end if;

  select rv.id, r.account_id, rv.report_payload, r.request_id
    into v_report_version_id, v_account_id, v_payload, v_source_request_id
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

  select * into v_source_request
  from public.service_requests
  where id=v_source_request_id;

  select exists(
    select 1
    from jsonb_array_elements(coalesce(v_payload#>'{portfolio_summary,client_layers,company_universe}','[]'::jsonb)) x
    where x->>'company_id'=p_company_id::text
  ) or exists(
    select 1
    from jsonb_array_elements(coalesce(v_payload#>'{portfolio_summary,client_layers,signal_opportunities}','[]'::jsonb)) x
    where x->>'company_id'=p_company_id::text
  ) into v_exists;

  if not v_exists then
    raise exception 'company_not_in_report' using errcode='22023';
  end if;

  select coalesce(
    (select x->>'company'
       from jsonb_array_elements(coalesce(v_payload#>'{portfolio_summary,client_layers,signal_opportunities}','[]'::jsonb)) x
      where x->>'company_id'=p_company_id::text limit 1),
    (select coalesce(x->>'company',x->>'name',x->>'legal_name')
       from jsonb_array_elements(coalesce(v_payload#>'{portfolio_summary,client_layers,company_universe}','[]'::jsonb)) x
      where x->>'company_id'=p_company_id::text limit 1),
    (select c.name from public.companies c where c.id=p_company_id),
    'Empresa'
  ) into v_company_name;

  if p_preference='neutral' then
    delete from private.account_company_preferences
    where account_id=v_account_id and company_id=p_company_id;

    update public.feedback
       set structured_payload=coalesce(structured_payload,'{}'::jsonb)
             ||jsonb_build_object('company_preference','neutral'),
           updated_at=clock_timestamp()
     where account_id=v_account_id
       and user_id=v_uid
       and entity_type='company'
       and entity_id=p_company_id
       and report_version_id=v_report_version_id;

    return jsonb_build_object('pass',true,'preference','neutral','company_id',p_company_id);
  end if;

  insert into private.account_company_preferences(
    account_id,company_id,preference,reason,source_report_version_id,created_by,updated_at
  ) values (
    v_account_id,p_company_id,p_preference,v_reason,v_report_version_id,v_uid,clock_timestamp()
  )
  on conflict(account_id,company_id) do update set
    preference=excluded.preference,
    reason=excluded.reason,
    source_report_version_id=excluded.source_report_version_id,
    created_by=excluded.created_by,
    updated_at=clock_timestamp();

  perform public.portal_submit_feedback_v1(
    upper(btrim(p_report_reference)),
    'company',
    p_company_id,
    p_preference='preferred',
    v_reason
  );

  if p_preference='preferred' then
    v_request_key:='portal:company-deep:'||upper(btrim(p_report_reference))||':'||p_company_id::text;

    select id,submission_id into v_request_id,v_submission_id
    from public.service_requests
    where request_key=v_request_key
    limit 1;

    if v_request_id is null then
      v_submission_id:=gen_random_uuid();
      v_request_payload:=coalesce(v_source_request.form_payload,'{}'::jsonb);
      v_request_obj:=coalesce(v_request_payload->'request','{}'::jsonb);
      v_request_obj:=v_request_obj||jsonb_build_object(
        'title','Profundización de '||v_company_name,
        'cutoff_date',current_date::text,
        'research_options',coalesce(v_request_obj->'research_options','{}'::jsonb)
          ||jsonb_build_object('deep_research_company_ids',jsonb_build_array(p_company_id))
      );
      v_intake:=coalesce(v_request_payload->'intake_metadata','{}'::jsonb)||jsonb_build_object(
        'baseline_mode','explicit_report_update',
        'follow_up_kind','company_deep_dive',
        'source_report_reference',upper(btrim(p_report_reference)),
        'requested_company_id',p_company_id,
        'requested_company_name',v_company_name,
        'portal_note',v_reason,
        'notification_email_inline',false
      );
      v_extensions:=coalesce(v_request_payload->'request_extensions','{}'::jsonb)||jsonb_build_object(
        'source_report_reference',upper(btrim(p_report_reference)),
        'follow_up_kind','company_deep_dive',
        'requested_company_id',p_company_id,
        'requested_company_name',v_company_name,
        'portal_note',v_reason
      );
      v_request_payload:=v_request_payload
        ||jsonb_build_object(
          'submission_id',v_submission_id,
          'submitted_at',clock_timestamp(),
          'channel','web_form',
          'request',v_request_obj,
          'intake_metadata',v_intake,
          'request_extensions',v_extensions
        );

      insert into public.service_requests(
        account_id,seller_profile_id,submission_id,request_key,channel,title,status,
        contract_version,form_payload,normalized_scope,cutoff_date,neutral_output,
        internal_output_authorized,received_at,created_by,client_request_id,credits_charged
      ) values (
        v_account_id,v_source_request.seller_profile_id,v_submission_id,v_request_key,'web_form',
        'Profundización · '||v_company_name||' · '||upper(btrim(p_report_reference)),
        'received',coalesce(v_source_request.contract_version,'1.4.2'),v_request_payload,
        v_source_request.normalized_scope,current_date,v_source_request.neutral_output,
        false,clock_timestamp(),v_uid,gen_random_uuid(),null
      )
      returning id into v_request_id;
    end if;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'pass',true,
    'preference',p_preference,
    'company_id',p_company_id,
    'company',v_company_name,
    'follow_up_request_id',v_request_id,
    'submission_id',v_submission_id
  ));
end
$$;

drop table public.account_company_preferences;
