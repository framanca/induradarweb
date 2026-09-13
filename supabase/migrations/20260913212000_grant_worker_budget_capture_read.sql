-- The invoker-security budget RPC derives persisted-search telemetry from
-- captures in addition to the pass ledger.
grant select on table private.research_captures to service_role;
