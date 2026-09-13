-- The ASR1 status RPC aggregates operational tables in the private schema.
-- It is an internal worker endpoint, so execute it with its owner privileges
-- and make it unavailable to browser roles.
create or replace function public.get_autonomous_source_refresh_status_v1()
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private', 'pg_temp'
as $function$
select jsonb_build_object(
 'policy','AutonomousSourceRefreshV1','mode','fetch_diff_pre_enrichment','canonical_signal_creation',false,'request_brp2_budget_affected',false,
 'limits',(select jsonb_build_object('enabled',enabled,'daily_fetch_budget',daily_fetch_budget,'max_claim_per_invocation',max_claim_per_invocation,'max_seed_per_cycle',max_seed_per_cycle,'concurrency_hint',concurrency_hint,'claimed_today',coalesce((select claimed_fetches from private.source_refresh_daily_usage where usage_date=current_date),0),'remaining_today',greatest(0,daily_fetch_budget-coalesce((select claimed_fetches from private.source_refresh_daily_usage where usage_date=current_date),0))) from private.source_refresh_runtime_policy where singleton),
 'states',(select count(*) from public.source_refresh_state),
 'queue',jsonb_build_object('queued',(select count(*) from public.source_refresh_queue where status='queued'),'leased',(select count(*) from public.source_refresh_queue where status='leased'),'retry_wait',(select count(*) from public.source_refresh_queue where status='retry_wait'),'succeeded',(select count(*) from public.source_refresh_queue where status='succeeded'),'failed',(select count(*) from public.source_refresh_queue where status='failed')),
 'observations',(select count(*) from public.source_refresh_observations),'pending_review',(select count(*) from public.source_refresh_review_queue where status='pending'),'due_now',(select count(*) from public.source_refresh_state where next_refresh_at<=now())
);
$function$;

revoke all on function public.get_autonomous_source_refresh_status_v1() from public;
revoke all on function public.get_autonomous_source_refresh_status_v1() from anon;
revoke all on function public.get_autonomous_source_refresh_status_v1() from authenticated;
grant execute on function public.get_autonomous_source_refresh_status_v1() to service_role;
