-- Reviewed derived-text correction for one immutable, finalized source hash.
-- The canonical Report/Light Report, evidence, terms, roles and exceptions are
-- unchanged. Both the source gate and renderer must inspect the same revision.
CREATE FUNCTION private.reviewed_lemar_web_text_v1(p_report_version_id uuid, p_value jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog, public, private, pg_temp
AS $function$
DECLARE
  source_hash text;
  ready boolean;
  serialized text;
  old_span constant text := 'sin inferir una demanda actual para Omron';
  new_span constant text := 'sin confirmar una necesidad de compra';
  occurrences integer;
BEGIN
  SELECT rv.report_payload_hash,
         rv.finalization_status='finalized' AND rv.report_payload_status='ready'
           AND rv.status IN ('ready','delivered')
    INTO source_hash,ready FROM public.report_versions rv WHERE rv.id=p_report_version_id;
  IF source_hash IS DISTINCT FROM '7f70e3c9a54f40d0379cc58a2a48f5202cf5cc84cc6690e64595d195c3d58bb4' THEN
    RETURN p_value;
  END IF;
  IF NOT coalesce(ready,false) THEN RAISE EXCEPTION 'Reviewed web source is not finalized'; END IF;
  serialized:=p_value::text;
  occurrences:=(length(serialized)-length(replace(serialized,old_span,'')))/length(old_span);
  IF occurrences<>4 THEN RAISE EXCEPTION 'Reviewed web caution count changed: %',occurrences; END IF;
  -- These literals contain no JSON delimiters/escapes. Only four exact reviewed
  -- spans change; factual content and the public PLC brand list are preserved.
  RETURN replace(serialized,old_span,new_span)::jsonb;
END
$function$;
REVOKE ALL ON FUNCTION private.reviewed_lemar_web_text_v1(uuid,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

DO $repair$
DECLARE
  fp_before text := private.kernel_code_fingerprint_v1();
  target regprocedure;
  expected_md5 text;
  old_span text;
  new_span text;
  definition text;
  before_contract jsonb;
BEGIN
  FOR target,expected_md5,old_span,new_span IN SELECT * FROM (VALUES
    ('public.evaluate_client_artifact_source_sanitization_gate_v1(uuid)'::regprocedure,
     '395a4992e5c85669d8b2ea18f5952f3f',
     'select public.induradar_client_neutralize_recipient_jsonb_v1(',
     'select private.reviewed_lemar_web_text_v1(p_report_version_id, public.induradar_client_neutralize_recipient_jsonb_v1('),
    ('public.materialize_web_report_payload_v1(uuid,boolean)'::regprocedure,
     '92d31774c90efe907cfcdca6639f86de',
     'v_payload:=public.induradar_client_sanitize_jsonb(public.induradar_strip_request_knowledge_internal_v1(r.report_payload));',
     'v_payload:=private.reviewed_lemar_web_text_v1(r.id, public.induradar_client_sanitize_jsonb(public.induradar_strip_request_knowledge_internal_v1(r.report_payload)));')
  ) patches(signature,body_md5,old_text,new_text)
  LOOP
    SELECT to_jsonb(p)-'prosrc' INTO before_contract FROM pg_proc p WHERE p.oid=target;
    IF (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid=target)<>expected_md5 THEN
      RAISE EXCEPTION 'Reviewed web function source changed: %',target;
    END IF;
    definition:=pg_get_functiondef(target);
    IF (length(definition)-length(replace(definition,old_span,'')))/length(old_span)<>1 THEN
      RAISE EXCEPTION 'Expected one web projection insertion point: %',target;
    END IF;
    definition:=replace(definition,old_span,new_span);
    IF target='public.evaluate_client_artifact_source_sanitization_gate_v1(uuid)'::regprocedure THEN
      IF position(') into v_payload' IN definition)=0 THEN RAISE EXCEPTION 'Artifact projection terminator missing'; END IF;
      definition:=replace(definition,') into v_payload',')) into v_payload');
    END IF;
    EXECUTE definition;
    IF before_contract IS DISTINCT FROM (SELECT to_jsonb(p)-'prosrc' FROM pg_proc p WHERE p.oid=target) THEN
      RAISE EXCEPTION 'Web function ACL, owner or execution contract changed: %',target;
    END IF;
  END LOOP;
  IF fp_before IS DISTINCT FROM private.kernel_code_fingerprint_v1() THEN
    RAISE EXCEPTION 'Web projection repair changed the accepted executable kernel';
  END IF;
END
$repair$;
