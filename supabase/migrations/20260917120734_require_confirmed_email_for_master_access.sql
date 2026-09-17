-- The master role is activated only after Auth has confirmed the designated
-- mailbox. This protects the role even while public registration is open.

begin;

delete from public.platform_admin_users a
using auth.users u
where u.id = a.user_id
  and (u.email_confirmed_at is null or lower(u.email) <> 'framanca@outlook.com');

update public.user_profiles p
set is_platform_admin = exists (
  select 1 from public.platform_admin_users a where a.user_id = p.user_id
);

create or replace function public.create_portal_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_account_id uuid;
  v_display_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
begin
  insert into public.user_profiles (user_id, email, display_name, is_platform_admin)
  values (new.id, new.email, v_display_name, false)
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.user_profiles.display_name);

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

create or replace function public.sync_portal_user_email()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_is_confirmed_master boolean := new.email_confirmed_at is not null
    and lower(new.email) = 'framanca@outlook.com';
begin
  update public.user_profiles
  set email = new.email,
      is_platform_admin = v_is_confirmed_master
  where user_id = new.id;

  if v_is_confirmed_master then
    insert into public.platform_admin_users (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  else
    delete from public.platform_admin_users where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated_portal on auth.users;
create trigger on_auth_user_email_updated_portal
after update of email, email_confirmed_at on auth.users
for each row execute function public.sync_portal_user_email();

commit;
