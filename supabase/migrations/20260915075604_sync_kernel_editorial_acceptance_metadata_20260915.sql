-- InduRadar kernel metadata synchronization after Editorial Pipeline 1.0.0 activation.
-- Runtime behavior is already covered by current-code acceptance. This migration only
-- aligns audit metadata/fingerprints with the accepted current kernel state.

do $$
declare
  v_verification jsonb;
  v_fp text;
  v_now timestamptz := clock_timestamp();
begin
  v_verification := public.get_induradar_kernel_verification_v1();
  if not coalesce((v_verification->>'pass')::boolean,false) then
    raise exception 'Cannot sync kernel metadata while current-code verification is not passing';
  end if;

  v_fp := private.kernel_code_fingerprint_v1();

  update private.induradar_kernel_runtime
  set capabilities =
        jsonb_set(
          jsonb_set(
            jsonb_set(
              capabilities,
              '{accepted_code_fingerprint}',
              to_jsonb(v_fp),
              true
            ),
            '{current_code_acceptance}',
            coalesce(capabilities->'current_code_acceptance','{}'::jsonb)
              || jsonb_build_object(
                   'code_fingerprint',v_fp,
                   'accepted_at',v_now,
                   'behavioral_total',coalesce((v_verification->>'behavioral_and_integration_checks')::int,0),
                   'behavioral_passed',coalesce((v_verification->>'behavioral_and_integration_checks')::int,0),
                   'golden_total',coalesce((v_verification#>>'{documentary_checks,total}')::int,0),
                   'golden_passed',coalesce((v_verification#>>'{documentary_checks,passed}')::int,0),
                   'golden_suite_version',v_verification#>>'{documentary_checks,suite}',
                   'suites',v_verification->'checks'
                 ),
            true
          ),
          '{chat_session_protocol}',
          coalesce(capabilities->'chat_session_protocol','{}'::jsonb)
            || jsonb_build_object(
                 'version','chat-session-1.3.0',
                 'accepted_code_fingerprint',v_fp,
                 'methodology_changed',true
               ),
          true
        ),
      updated_at = v_now
  where singleton;
end
$$;
