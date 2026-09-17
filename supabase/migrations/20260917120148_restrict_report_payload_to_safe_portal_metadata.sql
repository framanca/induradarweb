-- The portal lists only metadata. The immutable report payload remains
-- available exclusively through the gated get-report RPC/Edge Function.

begin;

drop policy if exists report_versions_member_select on public.report_versions;
drop policy if exists report_items_member_select on public.report_items;
drop policy if exists report_exports_member_select on public.report_exports;

create or replace function public.portal_list_available_reports()
returns table (
  report_id uuid,
  request_id uuid,
  title text,
  report_version_id uuid,
  report_reference text,
  status text,
  generated_at timestamptz,
  delivered_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select
    r.id,
    r.request_id,
    r.title,
    rv.id,
    rv.report_reference,
    rv.status,
    rv.generated_at,
    rv.delivered_at
  from public.reports r
  join public.report_versions rv on rv.report_id = r.id
  where public.is_account_member(r.account_id)
    and rv.status in ('ready', 'delivered')
    and rv.report_payload_status = 'ready'
    and rv.finalization_status = 'finalized'
  order by coalesce(rv.delivered_at, rv.generated_at) desc, rv.version desc;
$$;

revoke all on function public.portal_list_available_reports() from public, anon;
grant execute on function public.portal_list_available_reports() to authenticated;

commit;
