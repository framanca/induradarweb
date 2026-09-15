-- Tighten Web Report Renderer v1 API surface after security-advisor review.
-- The Edge Function only needs the by-reference RPC. Internal helpers remain service-only.

revoke all on function public.trg_embed_report_editorial_v1() from public, anon, authenticated;
grant execute on function public.trg_embed_report_editorial_v1() to service_role;

revoke all on function public.evaluate_web_report_payload_gate_v1(uuid) from public, anon, authenticated;
revoke all on function public.get_web_report_payload_v1(uuid) from public, anon, authenticated;
grant execute on function public.evaluate_web_report_payload_gate_v1(uuid) to service_role;
grant execute on function public.get_web_report_payload_v1(uuid) to service_role;

-- Authenticated access stays intentionally limited to the one tenant-checked lookup used by get-report.
revoke all on function public.get_web_report_payload_by_reference_v1(text) from public, anon;
grant execute on function public.get_web_report_payload_by_reference_v1(text) to authenticated, service_role;
