create or replace function public.submit_authenticated_service_request(
  p_payload jsonb,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth','pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_account_id uuid;
  v_request public.service_requests%rowtype;
  v_quote jsonb;
  v_charge integer;
  v_title text;
  v_identity private.service_request_submitter_identity%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode='42501';
  end if;
  if p_client_request_id is null then
    raise exception 'A client request id is required' using errcode='22023';
  end if;
  if jsonb_typeof(p_payload)<>'object' then
    raise exception 'The request payload must be an object' using errcode='22023';
  end if;

  select sr.* into v_request
  from public.service_requests sr
  where sr.client_request_id=p_client_request_id
    and sr.created_by=v_user_id;

  if found then
    perform private.capture_service_request_submitter_identity_v1(v_request.id);
    select * into v_identity
    from private.service_request_submitter_identity
    where service_request_id=v_request.id;

    return jsonb_build_object(
      'request_id',v_request.id,
      'submission_id',v_request.submission_id,
      'request_key',v_request.request_key,
      'account_id',v_request.account_id,
      'auth_user_id',v_request.created_by,
      'credits_charged',v_request.credits_charged,
      'identity_linked',v_identity.service_request_id is not null and v_identity.auth_user_id=v_user_id,
      'identity_match',v_identity.identity_match,
      'duplicate',true
    );
  end if;

  select m.account_id into v_account_id
  from public.memberships m
  where m.user_id=v_user_id
  order by m.created_at
  limit 1;
  if v_account_id is null then
    raise exception 'No customer account exists for this user' using errcode='42501';
  end if;

  v_quote:=public.calculate_request_credits_v1(p_payload);
  v_charge:=(v_quote->>'total_credits')::integer;
  v_title:=nullif(btrim(coalesce(p_payload#>>'{request,title}','')),'');

  insert into public.service_requests(
    account_id,submission_id,request_key,channel,title,status,
    contract_version,form_payload,normalized_scope,cutoff_date,
    neutral_output,internal_output_authorized,created_by,
    client_request_id,credits_charged
  ) values (
    v_account_id,gen_random_uuid(),'PORTAL-'||replace(p_client_request_id::text,'-',''),
    'web_form',coalesce(v_title,'Solicitud de radar comercial'),'received',
    coalesce(nullif(p_payload->>'contract_version',''),'1.4.1'),p_payload,
    coalesce(p_payload->'request','{}'::jsonb),
    nullif(p_payload#>>'{request,cutoff_date}','')::date,
    true,false,v_user_id,p_client_request_id,v_charge
  ) returning * into v_request;

  insert into public.credit_ledger(
    account_id,user_id,service_request_id,entry_type,credits_delta,
    catalog_version,description
  ) values (
    v_account_id,v_user_id,v_request.id,'request_charge',-v_charge,
    v_quote->>'catalog_version','Solicitud '||v_request.request_key
  );

  perform private.capture_service_request_submitter_identity_v1(v_request.id);
  select * into v_identity
  from private.service_request_submitter_identity
  where service_request_id=v_request.id;

  return jsonb_build_object(
    'request_id',v_request.id,
    'submission_id',v_request.submission_id,
    'request_key',v_request.request_key,
    'account_id',v_request.account_id,
    'auth_user_id',v_request.created_by,
    'credits_charged',v_charge,
    'quote',v_quote,
    'identity_linked',v_identity.service_request_id is not null and v_identity.auth_user_id=v_user_id,
    'identity_match',v_identity.identity_match,
    'duplicate',false
  );
end
$function$;

comment on function public.submit_authenticated_service_request(jsonb,uuid)
is 'Authenticated request intake. Persists the exact auth user/account relationship, charges credits idempotently by client_request_id, and returns the durable request/submission/account/user identifiers plus identity linkage receipt.';
