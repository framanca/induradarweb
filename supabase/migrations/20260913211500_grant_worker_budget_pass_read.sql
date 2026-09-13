-- The service-only worker calls the invoker-security budget RPC before a web
-- search. It needs read access to the pass ledger used by that RPC.
grant select on table private.induradar_research_budget_passes to service_role;
