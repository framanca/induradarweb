-- The rollback-only full-path kernel fixture must satisfy the same new closing
-- rule as production. This changes only synthetic QA literature; it does not
-- relax the editorial gate or alter market research behavior.

DO $outer$
declare
  d text;
  old_fragment text := $$'executive_summary',jsonb_build_object('summary','Synthetic rollback-only empty-market fixture, not a client report.')$$;
  new_fragment text := $$'executive_summary',jsonb_build_object('conclusion','Synthetic rollback-only empty-market fixture, not a client report.','summary','Synthetic rollback-only empty-market fixture, not a client report.')$$;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='test_full_command_path_inner_v1';
  if d is null then raise exception 'test_full_command_path_inner_v1 not found'; end if;
  if position(old_fragment in d)=0 then raise exception 'expected editorial fixture fragment not found'; end if;
  execute replace(d,old_fragment,new_fragment);
end
$outer$;

update private.induradar_stack_profiles
set required_migrations = case when coalesce(required_migrations,'[]'::jsonb) @> jsonb_build_array('align_kernel_full_path_fixture_with_editorial_pipeline_20260915')
  then required_migrations else coalesce(required_migrations,'[]'::jsonb)||jsonb_build_array('align_kernel_full_path_fixture_with_editorial_pipeline_20260915') end,
  updated_at=clock_timestamp()
where active;
