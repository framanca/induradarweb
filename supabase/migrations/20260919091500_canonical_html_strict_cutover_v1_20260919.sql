-- Strict cutover: only pre-cutover finalized reports may use the legacy browser renderer.
-- Any report finalized from this cutover onward must have the one persisted canonical HTML.

create or replace function public.get_web_report_html_delivery_by_reference_v1(p_report_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, private, public, auth, pg_temp
as $$
declare
  r public.report_versions%rowtype;
  v_account uuid;
  v_html text;
  v_cutover constant timestamptz := '2026-09-19 09:00:12+00'::timestamptz;
begin
  select rv.* into r
  from public.report_versions rv
  where rv.report_reference=p_report_reference
    and rv.status in ('ready','delivered')
    and rv.report_payload_status='ready'
    and rv.finalization_status='finalized'
  order by rv.generated_at desc
  limit 1;

  if not found then raise exception 'Report not found'; end if;

  select rp.account_id into v_account
  from public.reports rp
  where rp.id=r.report_id;
  if v_account is null then raise exception 'Report account not found'; end if;
  if auth.uid() is not null and not public.is_account_member(v_account) then
    raise exception 'Not authorized';
  end if;

  v_html:=public.get_web_report_html_v1(r.id);
  if v_html is not null then
    return jsonb_build_object(
      'mode','canonical',
      'report_reference',r.report_reference,
      'html',v_html
    );
  end if;

  if r.finalized_at is not null and r.finalized_at < v_cutover then
    return jsonb_build_object(
      'mode','legacy',
      'report_reference',r.report_reference,
      'reason','pre_cutover_report_not_backfilled'
    );
  end if;

  return jsonb_build_object(
    'mode','blocked',
    'report_reference',r.report_reference,
    'reason','canonical_html_missing_post_cutover'
  );
end;
$$;

revoke all on function public.get_web_report_html_delivery_by_reference_v1(text) from public, anon;
grant execute on function public.get_web_report_html_delivery_by_reference_v1(text) to authenticated, service_role;

comment on function public.get_web_report_html_delivery_by_reference_v1(text) is
'Fail-closed HTML delivery selector. Pre-cutover finalized reports may use the legacy JSON/browser view; reports finalized on/after 2026-09-19 09:00:12Z must have persisted canonical HTML and never silently fall back to a second renderer.';
