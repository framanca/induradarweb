create table if not exists private.service_request_submitter_identity (
  service_request_id uuid primary key references public.service_requests(id) on delete cascade,
  account_id uuid not null,
  auth_user_id uuid,
  authenticated boolean not null default false,
  source text not null,
  authenticated_email text,
  authenticated_display_name text,
  membership_role text,
  form_contact_email text,
  form_contact_name text,
  form_company_name text,
  identity_match boolean,
  client_request_id uuid,
  captured_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists service_request_submitter_identity_auth_user_idx
  on private.service_request_submitter_identity(auth_user_id)
  where auth_user_id is not null;

create index if not exists service_request_submitter_identity_account_idx
  on private.service_request_submitter_identity(account_id);

create table if not exists private.service_request_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  notification_kind text not null default 'admin_new_request',
  state text not null default 'pending'
    check (state in ('pending','sending','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default clock_timestamp(),
  last_dispatch_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  provider text not null default 'resend',
  provider_message_id text,
  last_error text,
  net_request_id bigint,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(service_request_id,notification_kind)
);

create index if not exists service_request_notification_outbox_due_idx
  on private.service_request_notification_outbox(next_attempt_at,created_at)
  where state='pending';

create or replace function private.capture_service_request_submitter_identity_v1(p_service_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','private','public','auth','pg_temp'
as $function$
declare
  r public.service_requests%rowtype;
  v_auth_email text;
  v_display_name text;
  v_membership_role text;
  v_form_email text;
  v_form_name text;
  v_form_company text;
  v_authenticated boolean;
  v_source text;
  v_match boolean;
begin
  select * into r
  from public.service_requests
  where id=p_service_request_id;
  if not found then
    return jsonb_build_object('pass',false,'reason','service_request_not_found','service_request_id',p_service_request_id);
  end if;

  v_authenticated:=r.created_by is not null;

  if v_authenticated then
    select up.email,up.display_name
      into v_auth_email,v_display_name
    from public.user_profiles up
    where up.user_id=r.created_by;

    select m.role
      into v_membership_role
    from public.memberships m
    where m.user_id=r.created_by
      and m.account_id=r.account_id
    order by m.created_at
    limit 1;
  end if;

  v_form_email:=nullif(btrim(coalesce(
    r.form_payload#>>'{contact,email}',
    r.form_payload->>'email'
  )),'');
  v_form_name:=nullif(btrim(concat_ws(' ',
    nullif(r.form_payload#>>'{contact,first_name}',''),
    nullif(r.form_payload#>>'{contact,last_name}','')
  )),'');
  if v_form_name is null then
    v_form_name:=nullif(btrim(coalesce(r.form_payload->>'full_name','')),'');
  end if;
  v_form_company:=nullif(btrim(coalesce(
    r.form_payload#>>'{contact,company_name}',
    r.form_payload->>'company_name'
  )),'');
  v_source:=case
    when v_authenticated then 'authenticated_portal'
    when r.channel='web_form' then 'public_web_form'
    else coalesce(nullif(r.channel,''),'unknown')
  end;
  v_match:=case
    when v_authenticated and v_auth_email is not null and v_form_email is not null
      then lower(v_auth_email)=lower(v_form_email)
    else null
  end;

  insert into private.service_request_submitter_identity(
    service_request_id,account_id,auth_user_id,authenticated,source,
    authenticated_email,authenticated_display_name,membership_role,
    form_contact_email,form_contact_name,form_company_name,identity_match,
    client_request_id,captured_at,updated_at
  ) values (
    r.id,r.account_id,r.created_by,v_authenticated,v_source,
    v_auth_email,v_display_name,v_membership_role,
    v_form_email,v_form_name,v_form_company,v_match,
    r.client_request_id,clock_timestamp(),clock_timestamp()
  )
  on conflict(service_request_id) do update set
    account_id=excluded.account_id,
    auth_user_id=excluded.auth_user_id,
    authenticated=excluded.authenticated,
    source=excluded.source,
    authenticated_email=excluded.authenticated_email,
    authenticated_display_name=excluded.authenticated_display_name,
    membership_role=excluded.membership_role,
    form_contact_email=excluded.form_contact_email,
    form_contact_name=excluded.form_contact_name,
    form_company_name=excluded.form_company_name,
    identity_match=excluded.identity_match,
    client_request_id=excluded.client_request_id,
    updated_at=clock_timestamp();

  return jsonb_build_object(
    'pass',true,
    'service_request_id',r.id,
    'authenticated',v_authenticated,
    'source',v_source,
    'auth_user_id',r.created_by,
    'account_id',r.account_id,
    'identity_match',v_match
  );
end
$function$;

create or replace function private.enqueue_service_request_notification_v1(p_service_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','private','public','pg_temp'
as $function$
declare
  v_id uuid;
begin
  perform private.capture_service_request_submitter_identity_v1(p_service_request_id);

  insert into private.service_request_notification_outbox(
    service_request_id,notification_kind,state,next_attempt_at
  ) values (
    p_service_request_id,'admin_new_request','pending',clock_timestamp()
  )
  on conflict(service_request_id,notification_kind) do nothing;

  select id into v_id
  from private.service_request_notification_outbox
  where service_request_id=p_service_request_id
    and notification_kind='admin_new_request';

  return v_id;
end
$function$;

create or replace function private.dispatch_service_request_notification_v1(p_notification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','private','public','net','pg_temp'
as $function$
declare
  o private.service_request_notification_outbox%rowtype;
  v_net_id bigint;
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

  select net.http_post(
    url := 'https://gwmwkxvrgctglyjmlqnb.supabase.co/functions/v1/notify-service-request',
    body := jsonb_build_object('notification_id',o.id),
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

create or replace function private.dispatch_due_service_request_notifications_v1(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','private','public','pg_temp'
as $function$
declare
  x record;
  v_dispatched integer:=0;
  v_recovered integer:=0;
begin
  update private.service_request_notification_outbox
     set state='pending',
         next_attempt_at=clock_timestamp(),
         last_error=coalesce(last_error,'')||case when coalesce(last_error,'')='' then '' else E'\n' end||'Recovered stale sending lease.',
         updated_at=clock_timestamp()
   where state='sending'
     and last_attempt_at<clock_timestamp()-interval '10 minutes';
  get diagnostics v_recovered=row_count;

  for x in
    select id
    from private.service_request_notification_outbox
    where state='pending'
      and next_attempt_at<=clock_timestamp()
      and (last_dispatch_at is null or last_dispatch_at<=clock_timestamp()-interval '30 seconds')
    order by created_at,id
    limit greatest(1,least(coalesce(p_limit,20),100))
  loop
    begin
      perform private.dispatch_service_request_notification_v1(x.id);
      v_dispatched:=v_dispatched+1;
    exception when others then
      update private.service_request_notification_outbox
         set last_error=left('dispatch_enqueue_failed: '||sqlerrm,4000),
             updated_at=clock_timestamp()
       where id=x.id;
    end;
  end loop;

  return jsonb_build_object(
    'pass',true,
    'recovered_stale',v_recovered,
    'dispatches_queued',v_dispatched
  );
end
$function$;

create or replace function public.claim_service_request_notification_v1(p_notification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','private','public','auth','pg_temp'
as $function$
declare
  o private.service_request_notification_outbox%rowtype;
  r public.service_requests%rowtype;
  i private.service_request_submitter_identity%rowtype;
  v_account_name text;
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

create or replace function public.complete_service_request_notification_v1(
  p_notification_id uuid,
  p_success boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','private','public','pg_temp'
as $function$
declare
  o private.service_request_notification_outbox%rowtype;
  v_next timestamptz;
  v_state text;
begin
  select * into o
  from private.service_request_notification_outbox
  where id=p_notification_id
  for update;

  if not found then
    return jsonb_build_object('pass',false,'reason','notification_not_found');
  end if;

  if o.state='sent' then
    return jsonb_build_object('pass',true,'reason','already_sent','notification_id',o.id);
  end if;

  if coalesce(p_success,false) then
    update private.service_request_notification_outbox
       set state='sent',
           sent_at=clock_timestamp(),
           provider_message_id=nullif(p_provider_message_id,''),
           last_error=null,
           updated_at=clock_timestamp()
     where id=o.id;
    return jsonb_build_object('pass',true,'state','sent','notification_id',o.id);
  end if;

  if o.attempts<3 then
    v_state:='pending';
    v_next:=clock_timestamp()+case o.attempts
      when 0 then interval '1 minute'
      when 1 then interval '1 minute'
      when 2 then interval '5 minutes'
      else interval '15 minutes'
    end;
  else
    v_state:='failed';
    v_next:=clock_timestamp();
  end if;

  update private.service_request_notification_outbox
     set state=v_state,
         next_attempt_at=v_next,
         last_error=left(coalesce(p_error,'email_delivery_failed'),4000),
         updated_at=clock_timestamp()
   where id=o.id;

  return jsonb_build_object(
    'pass',true,
    'state',v_state,
    'notification_id',o.id,
    'attempts',o.attempts,
    'next_attempt_at',case when v_state='pending' then v_next else null end
  );
end
$function$;

revoke all on function public.claim_service_request_notification_v1(uuid) from public,anon,authenticated;
grant execute on function public.claim_service_request_notification_v1(uuid) to service_role;

revoke all on function public.complete_service_request_notification_v1(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.complete_service_request_notification_v1(uuid,boolean,text,text) to service_role;

create or replace function private.trg_service_request_identity_notification_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','private','public','pg_temp'
as $function$
declare
  v_notification_id uuid;
  v_inline_email boolean:=false;
begin
  perform private.capture_service_request_submitter_identity_v1(new.id);

  v_inline_email:=lower(coalesce(new.form_payload#>>'{intake_metadata,notification_email_inline}','false'))
    in ('true','1','yes');

  if v_inline_email then
    return new;
  end if;

  v_notification_id:=private.enqueue_service_request_notification_v1(new.id);

  begin
    perform private.dispatch_service_request_notification_v1(v_notification_id);
  exception when others then
    update private.service_request_notification_outbox
       set last_error=left('initial_dispatch_enqueue_failed: '||sqlerrm,4000),
           updated_at=clock_timestamp()
     where id=v_notification_id;
  end;

  return new;
end
$function$;

drop trigger if exists zz_service_request_identity_notification_v1 on public.service_requests;
create trigger zz_service_request_identity_notification_v1
after insert on public.service_requests
for each row execute function private.trg_service_request_identity_notification_v1();

insert into private.service_request_submitter_identity(
  service_request_id,account_id,auth_user_id,authenticated,source,
  authenticated_email,authenticated_display_name,membership_role,
  form_contact_email,form_contact_name,form_company_name,identity_match,
  client_request_id,captured_at,updated_at
)
select
  sr.id,
  sr.account_id,
  sr.created_by,
  sr.created_by is not null,
  case when sr.created_by is not null then 'authenticated_portal'
       when sr.channel='web_form' then 'public_web_form'
       else coalesce(nullif(sr.channel,''),'unknown') end,
  up.email,
  up.display_name,
  m.role,
  nullif(btrim(coalesce(sr.form_payload#>>'{contact,email}',sr.form_payload->>'email')),''),
  nullif(btrim(coalesce(
    nullif(concat_ws(' ',nullif(sr.form_payload#>>'{contact,first_name}',''),nullif(sr.form_payload#>>'{contact,last_name}','')),''),
    sr.form_payload->>'full_name'
  )),''),
  nullif(btrim(coalesce(sr.form_payload#>>'{contact,company_name}',sr.form_payload->>'company_name')),''),
  case when sr.created_by is not null and up.email is not null
            and nullif(btrim(coalesce(sr.form_payload#>>'{contact,email}',sr.form_payload->>'email')),'') is not null
       then lower(up.email)=lower(nullif(btrim(coalesce(sr.form_payload#>>'{contact,email}',sr.form_payload->>'email')),''))
       else null end,
  sr.client_request_id,
  clock_timestamp(),
  clock_timestamp()
from public.service_requests sr
left join public.user_profiles up on up.user_id=sr.created_by
left join public.memberships m on m.user_id=sr.created_by and m.account_id=sr.account_id
on conflict(service_request_id) do update set
  account_id=excluded.account_id,
  auth_user_id=excluded.auth_user_id,
  authenticated=excluded.authenticated,
  source=excluded.source,
  authenticated_email=excluded.authenticated_email,
  authenticated_display_name=excluded.authenticated_display_name,
  membership_role=excluded.membership_role,
  form_contact_email=excluded.form_contact_email,
  form_contact_name=excluded.form_contact_name,
  form_company_name=excluded.form_company_name,
  identity_match=excluded.identity_match,
  client_request_id=excluded.client_request_id,
  updated_at=clock_timestamp();

do $cron$
begin
  if exists(select 1 from cron.job where jobname='induradar-service-request-notifications-v1') then
    perform cron.unschedule('induradar-service-request-notifications-v1');
  end if;
  perform cron.schedule(
    'induradar-service-request-notifications-v1',
    '* * * * *',
    'select private.dispatch_due_service_request_notifications_v1(20);'
  );
end
$cron$;

comment on table private.service_request_submitter_identity is
'Durable identity link for each service request. Authenticated portal submissions retain exact auth user/account linkage plus the submitted contact snapshot; unauthenticated submissions retain contact-only identity.';

comment on table private.service_request_notification_outbox is
'Durable admin notification outbox for new service requests. Request persistence is never rolled back by email delivery failure; notifications retry independently.';

comment on function private.trg_service_request_identity_notification_v1() is
'General intake rule: every new service request captures submitter identity and queues the common admin email notification unless an explicitly marked legacy inline-email path already handled that request.';
