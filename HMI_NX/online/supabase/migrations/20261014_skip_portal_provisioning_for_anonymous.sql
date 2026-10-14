-- This migration was applied to the shared InduRadar Supabase project on 2026-10-14.
-- Anonymous WebHMI sessions are Auth users WITHOUT an email address.
-- Do not create portal accounts, profiles, or memberships for them.
-- Preserve the original profile provisioning for email-based accounts.
CREATE OR REPLACE FUNCTION public.create_portal_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  v_account_id uuid;
  v_display_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
begin
  IF new.is_anonymous IS TRUE OR new.email IS NULL THEN
    RETURN new;
  END IF;

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
$function$;
