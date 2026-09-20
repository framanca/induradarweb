alter table private.service_request_notification_outbox
  add column if not exists dispatch_token_hash text,
  add column if not exists dispatch_token_expires_at timestamptz;

create or replace function private.dispatch_service_request_notification_v1(p_notification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','private','public','net','extensions','pg_temp'
as $function$
declare
  o private.service_request_notification_outbox%rowtype;
  v_net_id bigint;
  v_token text;
  v_token_hash text;
begin
  select * into o
  from private.service_request_notification_outbox
  where id=p_notification_id
  for update;

  if not found then
    return jsonb_build_object('pass',false,'reason','notification_not_found','notification_id',p_notification_id);
  end if;

  if o.state='sent' then
    return jsonb_build_object('pass',true,'reason','already_sent','notification_id',o.id);
  end if;

  if o.state<>'pending' or o.next_attempt_at>clock_timestamp() then
    return jsonb_build_object('pass',false,'reason','not_due','notification_id',o.id,'state',o.state);
  end if;

  if o.last_dispatch_at is not null and o.last_dispatch_at>clock_timestamp()-interval '30 seconds' then
    return jsonb_build_object('pass',false,'reason','dispatch_recently_queued','notification_id',o.id);
  end if;

  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  v_token_hash:=encode(extensions.digest(v_token,'sha256'),'hex');

  update private.service_request_notification_outbox
     set dispatch_token_hash=v_token_hash,
         dispatch_token_expires_at=clock_timestamp()+interval '5 minutes',
         updated_at=clock_timestamp()
   where id=o.id;

  select net.http_post(
    url := 'https://gwmwkxvrgctglyjmlqnb.supabase.co/functions/v1/notify-service-request',
    body := jsonb_build_object('notification_id',o.id,'dispatch_token',v_token),
    params := '{}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  ) into v_net_id;

  update private.service_request_notification_outbox
     set last_dispatch_at=clock_timestamp(),
         net_request_id=v_net_id,
         updated_at=clock_timestamp()
   where id=o.id;

  return jsonb_build_object('pass',true,'notification_id',o.id,'net_request_id',v_net_id);
end
$function$;

create or replace function public.claim_service_request_notification_token_v1(
  p_notification_id uuid,
  p_dispatch_token text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','private','public','auth','extensions','pg_temp'
as $function$
declare
  o private.service_request_notification_outbox%rowtype;
  r public.service_requests%rowtype;
  i private.service_request_submitter_identity%rowtype;
  v_account_name text;
  v_hash text;
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

  return jsonb_strip_nulls(jsonb_build_object(
    'pass',true,
    'notification_id',o.id,
    'request_id',r.id,
    'submission_id',r.submission_id,
    'request_key',r.request_key,
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
    'identity_match',i.identity_match
  ));
end
$function$;

create or replace function public.claim_service_request_notification_v1(p_notification_id uuid)
returns jsonb
language sql
security definer
set search_path to 'pg_catalog','private','public','pg_temp'
as $function$
  select jsonb_build_object(
    'pass',false,
    'reason','dispatch_token_required',
    'notification_id',p_notification_id
  );
$function$;

revoke all on function public.claim_service_request_notification_token_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_service_request_notification_token_v1(uuid,text) to service_role;

revoke all on function public.claim_service_request_notification_v1(uuid) from public,anon,authenticated;
grant execute on function public.claim_service_request_notification_v1(uuid) to service_role;

comment on function public.claim_service_request_notification_token_v1(uuid,text)
is 'Claims a durable service-request notification only when presented with the one-time dispatch token generated by PostgreSQL. The raw token is never stored.';

comment on function private.dispatch_service_request_notification_v1(uuid)
is 'Dispatches a notification to the Edge Function with a one-time token whose SHA-256 hash is stored durably; repeated or external unauthenticated calls cannot claim an outbox row without the token.';
