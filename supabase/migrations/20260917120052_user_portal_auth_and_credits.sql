-- Customer portal: authenticated users, tenant isolation, credit ledger and
-- master operations. The platform administrator is intentionally established
-- from the confirmed identity created with the designated email, never from
-- editable user metadata supplied by the browser.

begin;

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);

create table public.credit_pricing_catalog (
  singleton boolean primary key default true check (singleton),
  catalog jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(catalog) = 'object')
);

insert into public.credit_pricing_catalog (singleton, catalog)
values (
  true,
  '{
    "catalog_version": "1.0.0",
    "credits_model": "report_scope_credits_v1",
    "unit": "credits",
    "base_credits": 50,
    "included": {"provinces": 1, "sectors": 1, "signals": 5},
    "province_bands": [
      {"from": 2, "to": 3, "credits_per_unit": 15},
      {"from": 4, "to": 5, "credits_per_unit": 12},
      {"from": 6, "to": 10, "credits_per_unit": 10},
      {"from": 11, "to": 20, "credits_per_unit": 7},
      {"from": 21, "to": null, "credits_per_unit": 4}
    ],
    "sector_bands": [
      {"from": 2, "to": 5, "credits_per_unit": 5},
      {"from": 6, "to": 10, "credits_per_unit": 3},
      {"from": 11, "to": null, "credits_per_unit": 2}
    ],
    "signal_bands": [
      {"from": 0, "to": 5, "credits_per_unit": 0},
      {"from": 6, "to": 10, "credits_per_unit": 5},
      {"from": 11, "to": null, "credits_per_unit": 10}
    ],
    "country_scopes": {
      "spain_all_provinces": 50,
      "portugal_province_equivalent": 0,
      "portugal_note": "Portugal no suma provincias porque el formulario no permite elegir distritos portugueses."
    }
  }'::jsonb
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  service_request_id uuid references public.service_requests(id) on delete restrict,
  entry_type text not null check (entry_type in ('request_charge', 'manual_adjustment', 'refund')),
  credits_delta integer not null check (credits_delta <> 0),
  catalog_version text,
  description text not null,
  created_at timestamptz not null default now(),
  unique (service_request_id, entry_type)
);

alter table public.service_requests
  add column client_request_id uuid unique,
  add column credits_charged integer;

create index credit_ledger_account_created_idx
  on public.credit_ledger (account_id, created_at desc);
create index service_requests_created_by_idx
  on public.service_requests (created_by, received_at desc);

create or replace function public.set_portal_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_portal_updated_at();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_admin_users a
    where a.user_id = (select auth.uid())
  );
$$;

-- Platform administrators have global operational access; normal account
-- membership continues to define every customer's tenant boundary.
create or replace function public.is_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.memberships m
      where m.account_id = target_account_id and m.user_id = (select auth.uid())
    );
$$;

create or replace function public.has_account_role(target_account_id uuid, allowed_roles public.account_role[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.memberships m
      where m.account_id = target_account_id
        and m.user_id = (select auth.uid())
        and m.role = any(allowed_roles)
    );
$$;

create or replace function public.create_portal_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_account_id uuid;
  v_is_master boolean := lower(new.email) = 'framanca@outlook.com';
  v_display_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
begin
  insert into public.user_profiles (user_id, email, display_name, is_platform_admin)
  values (new.id, new.email, v_display_name, v_is_master)
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.user_profiles.display_name),
        is_platform_admin = public.user_profiles.is_platform_admin or excluded.is_platform_admin;

  if v_is_master then
    insert into public.platform_admin_users (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  insert into public.accounts (name, slug)
  values (
    coalesce(v_display_name, split_part(new.email, '@', 1)),
    'portal-' || replace(new.id::text, '-', '')
  )
  returning id into v_account_id;

  insert into public.memberships (account_id, user_id, role)
  values (v_account_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_portal on auth.users;
create trigger on_auth_user_created_portal
after insert on auth.users
for each row execute function public.create_portal_user_profile();

create or replace function public.sync_portal_user_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  update public.user_profiles
  set email = new.email
  where user_id = new.id
    and email is distinct from new.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated_portal on auth.users;
create trigger on_auth_user_email_updated_portal
after update of email on auth.users
for each row execute function public.sync_portal_user_email();

create or replace function public.credit_marginal_band_total(
  p_count integer,
  p_included integer,
  p_bands jsonb
)
returns integer
language plpgsql
immutable
set search_path = pg_catalog, pg_temp
as $$
declare
  v_band jsonb;
  v_from integer;
  v_to integer;
  v_rate integer;
  v_last integer;
  v_total integer := 0;
begin
  if p_count <= p_included then return 0; end if;
  for v_band in select value from jsonb_array_elements(p_bands) loop
    v_from := (v_band ->> 'from')::integer;
    v_to := nullif(v_band ->> 'to', '')::integer;
    v_rate := (v_band ->> 'credits_per_unit')::integer;
    if p_count >= v_from then
      v_last := least(p_count, coalesce(v_to, p_count));
      v_total := v_total + greatest(0, v_last - v_from + 1) * v_rate;
    end if;
  end loop;
  return v_total;
end;
$$;

create or replace function public.calculate_request_credits_v1(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_catalog jsonb;
  v_provinces integer := 0;
  v_sectors integer := 0;
  v_signals integer := 0;
  v_base integer;
  v_province_credits integer;
  v_sector_credits integer;
  v_signal_credits integer;
  v_band jsonb;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'The request payload must be an object' using errcode = '22023';
  end if;

  select catalog into v_catalog from public.credit_pricing_catalog where singleton;
  if v_catalog is null then raise exception 'Credit catalog is unavailable'; end if;

  v_sectors := case when jsonb_typeof(p_payload #> '{request,sectors}') = 'array'
    then jsonb_array_length(p_payload #> '{request,sectors}') else 0 end;
  v_signals := case when jsonb_typeof(p_payload -> 'signal_types') = 'array'
    then jsonb_array_length(p_payload -> 'signal_types') else 0 end;
  if p_payload ->> 'geography_spain_scope' = 'Toda España' then
    v_provinces := coalesce((v_catalog #>> '{country_scopes,spain_all_provinces}')::integer, 0);
  elsif jsonb_typeof(p_payload -> 'geography_provinces') = 'array' then
    v_provinces := jsonb_array_length(p_payload -> 'geography_provinces');
  end if;
  if jsonb_typeof(p_payload -> 'geography_countries') = 'array'
     and p_payload -> 'geography_countries' ? 'Portugal' then
    v_provinces := v_provinces + coalesce((v_catalog #>> '{country_scopes,portugal_province_equivalent}')::integer, 0);
  end if;

  v_base := (v_catalog ->> 'base_credits')::integer;
  v_province_credits := public.credit_marginal_band_total(
    v_provinces, (v_catalog #>> '{included,provinces}')::integer, v_catalog -> 'province_bands'
  );
  v_sector_credits := public.credit_marginal_band_total(
    v_sectors, (v_catalog #>> '{included,sectors}')::integer, v_catalog -> 'sector_bands'
  );
  select coalesce((value ->> 'credits_per_unit')::integer, 0) into v_signal_credits
  from jsonb_array_elements(v_catalog -> 'signal_bands')
  where v_signals >= (value ->> 'from')::integer
    and ((value ->> 'to') is null or v_signals <= (value ->> 'to')::integer)
  limit 1;

  return jsonb_build_object(
    'catalog_version', v_catalog ->> 'catalog_version',
    'credits_model', v_catalog ->> 'credits_model',
    'total_credits', v_base + v_province_credits + v_sector_credits + coalesce(v_signal_credits, 0),
    'breakdown', jsonb_build_object(
      'base_credits', v_base,
      'province_credits', v_province_credits,
      'sector_credits', v_sector_credits,
      'signal_credits', coalesce(v_signal_credits, 0)
    )
  );
end;
$$;

create or replace function public.update_credit_pricing_catalog(p_catalog jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_required_key text;
begin
  if not public.is_platform_admin() then raise exception 'Platform administrator access is required' using errcode = '42501'; end if;
  if jsonb_typeof(p_catalog) <> 'object' then raise exception 'The catalog must be an object' using errcode = '22023'; end if;
  foreach v_required_key in array array[
    'catalog_version', 'credits_model', 'unit', 'base_credits', 'included',
    'province_bands', 'sector_bands', 'signal_bands', 'country_scopes'
  ] loop
    if not (p_catalog ? v_required_key) then
      raise exception 'The catalog is missing %', v_required_key using errcode = '22023';
    end if;
  end loop;
  if p_catalog ->> 'unit' <> 'credits'
     or coalesce((p_catalog ->> 'base_credits')::integer, -1) < 0
     or jsonb_typeof(p_catalog -> 'included') <> 'object'
     or jsonb_typeof(p_catalog -> 'province_bands') <> 'array'
     or jsonb_typeof(p_catalog -> 'sector_bands') <> 'array'
     or jsonb_typeof(p_catalog -> 'signal_bands') <> 'array'
     or jsonb_typeof(p_catalog -> 'country_scopes') <> 'object' then
    raise exception 'The catalog format is invalid' using errcode = '22023';
  end if;
  update public.credit_pricing_catalog
  set catalog = p_catalog,
      updated_by = auth.uid(),
      updated_at = now()
  where singleton
  returning catalog into p_catalog;
  return p_catalog;
end;
$$;

create or replace function public.adjust_user_credit_balance(
  p_user_id uuid,
  p_credits_delta integer,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_account_id uuid;
  v_balance integer;
begin
  if not public.is_platform_admin() then raise exception 'Platform administrator access is required' using errcode = '42501'; end if;
  if p_credits_delta = 0 or nullif(btrim(coalesce(p_description, '')), '') is null then
    raise exception 'A non-zero credit adjustment and a description are required' using errcode = '22023';
  end if;
  select m.account_id into v_account_id
  from public.memberships m
  where m.user_id = p_user_id
  order by m.created_at
  limit 1;
  if v_account_id is null then raise exception 'The target user has no customer account' using errcode = '22023'; end if;
  insert into public.credit_ledger (account_id, user_id, entry_type, credits_delta, description)
  values (v_account_id, p_user_id, 'manual_adjustment', p_credits_delta, btrim(p_description));
  select coalesce(sum(credits_delta), 0)::integer into v_balance
  from public.credit_ledger where account_id = v_account_id;
  return jsonb_build_object('user_id', p_user_id, 'balance', v_balance);
end;
$$;

create or replace function public.submit_authenticated_service_request(
  p_payload jsonb,
  p_client_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_id uuid;
  v_request public.service_requests%rowtype;
  v_quote jsonb;
  v_charge integer;
  v_title text;
begin
  if v_user_id is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  if p_client_request_id is null then raise exception 'A client request id is required' using errcode = '22023'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'The request payload must be an object' using errcode = '22023'; end if;

  select sr.* into v_request
  from public.service_requests sr
  where sr.client_request_id = p_client_request_id
    and sr.created_by = v_user_id;
  if found then
    return jsonb_build_object(
      'request_id', v_request.id,
      'request_key', v_request.request_key,
      'credits_charged', v_request.credits_charged,
      'duplicate', true
    );
  end if;

  select m.account_id into v_account_id
  from public.memberships m
  where m.user_id = v_user_id
  order by m.created_at
  limit 1;
  if v_account_id is null then raise exception 'No customer account exists for this user' using errcode = '42501'; end if;

  v_quote := public.calculate_request_credits_v1(p_payload);
  v_charge := (v_quote ->> 'total_credits')::integer;
  v_title := nullif(btrim(coalesce(p_payload #>> '{request,title}', '')), '');

  insert into public.service_requests (
    account_id, submission_id, request_key, channel, title, status,
    contract_version, form_payload, normalized_scope, cutoff_date,
    neutral_output, internal_output_authorized, created_by,
    client_request_id, credits_charged
  ) values (
    v_account_id, gen_random_uuid(), 'PORTAL-' || replace(p_client_request_id::text, '-', ''),
    'web_form', coalesce(v_title, 'Solicitud de radar comercial'), 'received',
    coalesce(nullif(p_payload ->> 'contract_version', ''), '1.4.1'), p_payload,
    coalesce(p_payload -> 'request', '{}'::jsonb),
    nullif(p_payload #>> '{request,cutoff_date}', '')::date,
    true, false, v_user_id, p_client_request_id, v_charge
  ) returning * into v_request;

  insert into public.credit_ledger (
    account_id, user_id, service_request_id, entry_type, credits_delta,
    catalog_version, description
  ) values (
    v_account_id, v_user_id, v_request.id, 'request_charge', -v_charge,
    v_quote ->> 'catalog_version', 'Solicitud ' || v_request.request_key
  );

  return jsonb_build_object(
    'request_id', v_request.id,
    'request_key', v_request.request_key,
    'credits_charged', v_charge,
    'quote', v_quote,
    'duplicate', false
  );
end;
$$;

-- A job is the owner entity. Reassigning it also reassigns all reports and
-- operational records tied to it, so a report cannot be exposed separately
-- from its request's customer account.
alter table public.service_requests
  add constraint service_requests_id_account_unique unique (id, account_id);
alter table public.reports drop constraint if exists reports_request_same_account_fk;
alter table public.reports
  add constraint reports_request_same_account_fk
  foreign key (request_id, account_id)
  references public.service_requests(id, account_id)
  deferrable initially immediate;

create or replace function public.assign_service_request_to_user(
  p_service_request_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_target_account uuid;
  v_request_key text;
begin
  if not public.is_platform_admin() then raise exception 'Platform administrator access is required' using errcode = '42501'; end if;

  select m.account_id into v_target_account
  from public.memberships m
  where m.user_id = p_user_id
  order by m.created_at
  limit 1;
  if v_target_account is null then raise exception 'The target user has no customer account' using errcode = '22023'; end if;

  perform 1 from public.service_requests where id = p_service_request_id for update;
  if not found then raise exception 'Service request not found' using errcode = 'P0002'; end if;
  set constraints reports_request_same_account_fk deferred;

  update public.service_requests
  set account_id = v_target_account,
      seller_profile_id = null
  where id = p_service_request_id
  returning request_key into v_request_key;
  update public.reports set account_id = v_target_account where request_id = p_service_request_id;
  update public.research_runs set account_id = v_target_account where service_request_id = p_service_request_id;
  update public.intelligence_artifacts set account_id = v_target_account where service_request_id = p_service_request_id;
  update public.artifact_generation_usage agu
  set account_id = v_target_account
  where exists (
    select 1 from public.research_runs rr
    where rr.id = agu.research_run_id and rr.service_request_id = p_service_request_id
  );
  update public.report_edition_catalog rec
  set account_id = v_target_account
  where rec.report_id in (select id from public.reports where request_id = p_service_request_id);

  return jsonb_build_object('request_id', p_service_request_id, 'request_key', v_request_key, 'assigned_user_id', p_user_id);
end;
$$;

alter table public.user_profiles enable row level security;
alter table public.platform_admin_users enable row level security;
alter table public.credit_pricing_catalog enable row level security;
alter table public.credit_ledger enable row level security;

create policy user_profiles_self_or_platform_admin_select on public.user_profiles
for select to authenticated
using (user_id = (select auth.uid()) or public.is_platform_admin());

create policy credit_catalog_authenticated_select on public.credit_pricing_catalog
for select to authenticated using (true);
create policy credit_ledger_account_member_select on public.credit_ledger
for select to authenticated
using (public.is_account_member(account_id));

drop policy if exists service_requests_member_insert on public.service_requests;
create policy service_requests_platform_admin_insert on public.service_requests
for insert to authenticated
with check (public.is_platform_admin());

revoke all on table public.platform_admin_users from anon, authenticated;
revoke all on function public.create_portal_user_profile() from public, anon, authenticated;
revoke all on function public.sync_portal_user_email() from public, anon, authenticated;
revoke all on function public.credit_marginal_band_total(integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.calculate_request_credits_v1(jsonb) from public, anon, authenticated;
revoke all on function public.update_credit_pricing_catalog(jsonb) from public, anon;
revoke all on function public.adjust_user_credit_balance(uuid, integer, text) from public, anon;
revoke all on function public.submit_authenticated_service_request(jsonb, uuid) from public, anon;
revoke all on function public.assign_service_request_to_user(uuid, uuid) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.update_credit_pricing_catalog(jsonb) to authenticated;
grant execute on function public.adjust_user_credit_balance(uuid, integer, text) to authenticated;
grant execute on function public.submit_authenticated_service_request(jsonb, uuid) to authenticated;
grant execute on function public.assign_service_request_to_user(uuid, uuid) to authenticated;

commit;
