
create or replace function private.trg_service_request_apply_company_preferences_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','private','public','pg_temp'
as $$
declare
  v_existing jsonb;
  v_combined jsonb;
  v_ids jsonb;
  v_seller jsonb;
  v_extensions jsonb;
begin
  if new.account_id is null then
    return new;
  end if;

  select coalesce(jsonb_agg(to_jsonb(x.company_id::text) order by x.company_id::text),'[]'::jsonb)
    into v_ids
  from (
    select distinct p.company_id
    from private.account_company_preferences p
    where p.account_id=new.account_id
      and p.preference='excluded'
  ) x;

  if jsonb_array_length(v_ids)=0 then
    return new;
  end if;

  v_existing:=case
    when jsonb_typeof(coalesce(new.normalized_scope,'{}'::jsonb)->'exclusions')='array'
      then coalesce(new.normalized_scope,'{}'::jsonb)->'exclusions'
    else '[]'::jsonb
  end;

  select coalesce(jsonb_agg(to_jsonb(v.name) order by v.name),'[]'::jsonb)
    into v_combined
  from (
    select distinct name
    from (
      select btrim(value) as name
      from jsonb_array_elements_text(v_existing)
      union all
      select btrim(c.name) as name
      from private.account_company_preferences p
      join public.companies c on c.id=p.company_id
      where p.account_id=new.account_id
        and p.preference='excluded'
    ) u
    where nullif(name,'') is not null
  ) v;

  new.normalized_scope:=jsonb_set(
    coalesce(new.normalized_scope,'{}'::jsonb),
    '{exclusions}',
    v_combined,
    true
  );

  v_seller:=coalesce(coalesce(new.form_payload,'{}'::jsonb)->'seller_profile','{}'::jsonb);
  v_seller:=jsonb_set(v_seller,'{exclusions}',v_combined,true);

  v_extensions:=coalesce(coalesce(new.form_payload,'{}'::jsonb)->'request_extensions','{}'::jsonb)
    ||jsonb_build_object(
      'account_excluded_company_ids',v_ids,
      'account_company_preferences_version','1.0.0'
    );

  new.form_payload:=coalesce(new.form_payload,'{}'::jsonb)
    ||jsonb_build_object(
      'seller_profile',v_seller,
      'request_extensions',v_extensions
    );

  return new;
end
$$;

drop trigger if exists r_service_requests_account_company_preferences_v1 on public.service_requests;
create trigger r_service_requests_account_company_preferences_v1
before insert or update of account_id, normalized_scope, form_payload
on public.service_requests
for each row
execute function private.trg_service_request_apply_company_preferences_v1();

create or replace function public.claim_service_request_notification_token_v1(
  p_notification_id uuid,
  p_dispatch_token text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','private','public','auth','extensions','pg_temp'
as $$
declare
  o private.service_request_notification_outbox%rowtype;
  r public.service_requests%rowtype;
  i private.service_request_submitter_identity%rowtype;
  v_account_name text;
  v_hash text;
  v_follow_up_kind text;
  v_source_report_reference text;
  v_follow_up_note text;
  v_requested_company_id text;
  v_requested_company_name text;
begin
  select * into o
  from private.service_request_notification_outbox
  where id=p_notification_id
  for update;

  if not found then
    return jsonb_build_object('pass',false,'reason','notification_not_found');
  end if;

  if o.state='sent' then
    return jsonb_build_object('pass',false,'reason','already_sent','notification_id',o.id);
  end if;

  if nullif(p_dispatch_token,'') is null
     or o.dispatch_token_hash is null
     or o.dispatch_token_expires_at is null
     or o.dispatch_token_expires_at<=clock_timestamp() then
    return jsonb_build_object('pass',false,'reason','dispatch_token_missing_or_expired','notification_id',o.id);
  end if;

  v_hash:=encode(extensions.digest(p_dispatch_token,'sha256'),'hex');
  if v_hash is distinct from o.dispatch_token_hash then
    return jsonb_build_object('pass',false,'reason','dispatch_token_invalid','notification_id',o.id);
  end if;

  if o.state='sending'
     and o.last_attempt_at is not null
     and o.last_attempt_at>clock_timestamp()-interval '10 minutes' then
    return jsonb_build_object('pass',false,'reason','already_claimed','notification_id',o.id);
  end if;

  if o.attempts>=3 and o.state='failed' then
    return jsonb_build_object('pass',false,'reason','retry_exhausted','notification_id',o.id);
  end if;

  if o.next_attempt_at>clock_timestamp() then
    return jsonb_build_object('pass',false,'reason','retry_not_due','notification_id',o.id);
  end if;

  update private.service_request_notification_outbox
     set state='sending',
         attempts=attempts+1,
         last_attempt_at=clock_timestamp(),
         dispatch_token_hash=null,
         dispatch_token_expires_at=null,
         updated_at=clock_timestamp()
   where id=o.id
   returning * into o;

  select * into r
  from public.service_requests
  where id=o.service_request_id;

  perform private.capture_service_request_submitter_identity_v1(r.id);
  select * into i
  from private.service_request_submitter_identity
  where service_request_id=r.id;

  select a.name into v_account_name
  from public.accounts a
  where a.id=r.account_id;

  v_follow_up_kind:=nullif(btrim(coalesce(
    r.form_payload#>>'{intake_metadata,follow_up_kind}',
    r.form_payload#>>'{request_extensions,follow_up_kind}'
  )),'');
  v_source_report_reference:=nullif(btrim(coalesce(
    r.form_payload#>>'{intake_metadata,source_report_reference}',
    r.form_payload#>>'{request_extensions,source_report_reference}'
  )),'');
  v_follow_up_note:=nullif(btrim(coalesce(
    r.form_payload#>>'{intake_metadata,portal_update_note}',
    r.form_payload#>>'{intake_metadata,portal_note}',
    r.form_payload#>>'{request_extensions,portal_update_note}',
    r.form_payload#>>'{request_extensions,portal_note}'
  )),'');
  v_requested_company_id:=nullif(btrim(coalesce(
    r.form_payload#>>'{intake_metadata,requested_company_id}',
    r.form_payload#>>'{request_extensions,requested_company_id}'
  )),'');
  v_requested_company_name:=nullif(btrim(coalesce(
    r.form_payload#>>'{intake_metadata,requested_company_name}',
    r.form_payload#>>'{request_extensions,requested_company_name}'
  )),'');

  return jsonb_strip_nulls(jsonb_build_object(
    'pass',true,
    'notification_id',o.id,
    'notification_kind',o.notification_kind,
    'request_id',r.id,
    'submission_id',r.submission_id,
    'request_key',r.request_key,
    'channel',r.channel,
    'title',r.title,
    'status',r.status,
    'credits_charged',r.credits_charged,
    'created_at',r.created_at,
    'authenticated',i.authenticated,
    'source',i.source,
    'auth_user_id',i.auth_user_id,
    'account_id',r.account_id,
    'account_name',v_account_name,
    'authenticated_email',i.authenticated_email,
    'authenticated_display_name',i.authenticated_display_name,
    'membership_role',i.membership_role,
    'form_contact_email',i.form_contact_email,
    'form_contact_name',i.form_contact_name,
    'form_company_name',i.form_company_name,
    'identity_match',i.identity_match,
    'follow_up_kind',v_follow_up_kind,
    'source_report_reference',v_source_report_reference,
    'follow_up_note',v_follow_up_note,
    'requested_company_id',v_requested_company_id,
    'requested_company_name',v_requested_company_name
  ));
end
$$;
