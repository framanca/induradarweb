-- Operator-reviewed data operation, separate from schema migrations. This uses
-- the existing report-scoped exception API, never a global alias exemption.
BEGIN;
SET LOCAL statement_timeout='180s';
DO $review$
DECLARE
  rv public.report_versions%rowtype;
  master_id uuid;
  projected jsonb;
  texts text[];
  brand_span constant text := 'La nueva oferta cubre diagnóstico, modificación, pruebas y soporte sobre Siemens, Omron, Allen-Bradley/Rockwell, Schneider y PLC industriales genéricos.';
  terms_before text;
  others_before text;
  content_before jsonb;
  exception_receipt jsonb;
BEGIN
  SELECT * INTO STRICT rv FROM public.report_versions
    WHERE report_reference='IR-20261106-E4D4SQ' AND finalization_status='finalized';
  IF rv.report_payload_hash<>'7f70e3c9a54f40d0379cc58a2a48f5202cf5cc84cc6690e64595d195c3d58bb4'
     OR rv.light_report_hash<>'0363e8d72953740b6b60ef151efa196cab173fe4e00f628f07c5b97231785ea7' THEN
    RAISE EXCEPTION 'Reviewed immutable report hashes changed'; END IF;
  content_before:=jsonb_build_array(rv.report_payload_hash,rv.light_report_hash,rv.inventory_hash,rv.finalized_payload_hash);
  SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY term_key)::text,'')) INTO terms_before
    FROM private.client_output_sanitization_terms t;
  SELECT md5(coalesce(jsonb_agg(to_jsonb(e) ORDER BY report_version_id,normalized_term)::text,'')) INTO others_before
    FROM private.client_output_sanitization_exceptions e WHERE report_version_id<>rv.id;
  SELECT u.id INTO STRICT master_id FROM auth.users u
    JOIN public.platform_admin_users a ON a.user_id=u.id
    WHERE lower(u.email)='framanca@outlook.com' AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',master_id,'role','authenticated')::text,true);

  -- Independently reviewed primary page on 2026-11-12:
  -- https://rivasrobotics.com/programacion-plc-hmi/ lists this PLC brand.
  -- Require the existing approved evidence/source/signal linkage as well.
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(rv.report_payload->'signals') s
    JOIN LATERAL jsonb_array_elements(s->'evidence_refs') er ON true
    JOIN LATERAL jsonb_array_elements(rv.report_payload->'evidence_claims') ec
      ON ec->>'evidence_claim_id'=er->>'evidence_claim_id'
    JOIN LATERAL jsonb_array_elements(rv.report_payload->'source_items') si
      ON si->>'source_item_id'=ec->>'source_item_id'
    WHERE s->>'canonical_key'='signal:new:rivas-plc-service-2026' AND s->>'summary'=brand_span
      AND ec->>'review_status'='approved' AND ec->>'classification'='confirmed_fact'
      AND si->>'canonical_url'='https://rivasrobotics.com/programacion-plc-hmi'
  ) THEN RAISE EXCEPTION 'Reviewed public brand lacks the approved source linkage'; END IF;
  projected:=private.reviewed_lemar_web_text_v1(rv.id,
    public.induradar_client_neutralize_recipient_jsonb_v1(rv.id,
      public.induradar_client_sanitize_jsonb(public.induradar_strip_request_knowledge_internal_v1(rv.report_payload))));
  SELECT array_agg(x) INTO texts FROM private.jsonb_scalar_text_v1(projected) x;
  IF (SELECT count(*) FROM unnest(texts) x WHERE x=brand_span)<>3
     OR EXISTS(SELECT 1 FROM unnest(texts) x WHERE x ILIKE '%omron%' AND x<>brand_span)
     OR (SELECT count(*) FROM unnest(texts) x WHERE x LIKE '%sin confirmar una necesidad de compra%')<>4 THEN
    RAISE EXCEPTION 'Unreviewed alias mention or missing neutralized caution'; END IF;

  exception_receipt:=public.authorize_current_request_sanitization_exception_v1(rv.id,'Omron',
    'Reviewed 2026-11-12: public PLC brand in Rivas Robotics https://rivasrobotics.com/programacion-plc-hmi/, approved signal:new:rivas-plc-service-2026. Derived projection neutralizes all four prior-client cautions; remaining three spans are the identical verified public technology list. Scope: only immutable finalized payload 7f70e3c9a54f40d0379cc58a2a48f5202cf5cc84cc6690e64595d195c3d58bb4. No client relationship inferred; canonical Report and Light Report unchanged.');
  IF NOT coalesce((exception_receipt->>'ok')::boolean,false) THEN
    RAISE EXCEPTION 'Report-scoped review was not authorized'; END IF;
  IF terms_before IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY term_key)::text,'')) FROM private.client_output_sanitization_terms t)
     OR others_before IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(e) ORDER BY report_version_id,normalized_term)::text,'')) FROM private.client_output_sanitization_exceptions e WHERE report_version_id<>rv.id)
     OR content_before IS DISTINCT FROM (SELECT jsonb_build_array(report_payload_hash,light_report_hash,inventory_hash,finalized_payload_hash) FROM public.report_versions WHERE id=rv.id) THEN
    RAISE EXCEPTION 'Global terms, other-report exceptions or immutable report changed'; END IF;
  PERFORM set_config('app.lemar_web_review',jsonb_build_object('pass',true,'report_reference',rv.report_reference,
    'neutralized_cautions',4,'verified_public_brand_spans',3,'global_terms_unchanged',true,
    'other_report_exceptions_unchanged',true,'immutable_report_hashes_unchanged',true,
    'publication_requires_separate_web_gate',true,'exception_receipt',exception_receipt)::text,true);
END
$review$;
SELECT current_setting('app.lemar_web_review')::jsonb proof;
COMMIT;
