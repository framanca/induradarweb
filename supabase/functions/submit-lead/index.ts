import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CONTRACT_VERSION = "1.4.2";
const WORKFLOW_VERSION = "3.14.0";
const RUNTIME_CONFIGURATION_VERSION = "permanent-v3.14.0";
const EXECUTION_CONTRACT_VERSION = "1.13.2";
const HEURISTICS_VERSION = "1.12.2";
const TOOL_REGISTRY_VERSION = "1.11.2";
const GOLDEN_TEST_VERSION = "1.13.2";
const SOURCE_CATALOG_VERSION = "2.6.6";
const DATA_DICTIONARY_VERSION = "1.11.2";
const EXAMPLE_REQUEST_VERSION = "1.4.2";
const REPORT_TEMPLATE_VERSION = "1.11.2";
const EXCEL_TEMPLATE_VERSION = "1.0.6";
const DOCUMENT_MANIFEST_VERSION = "1.12.2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const raw = await req.json();
    const now = new Date().toISOString();
    const submissionId = isUuid(raw?.submission_id) ? raw.submission_id : crypto.randomUUID();
    const requestedObjective = normalizeResearchObjective(
      raw?.request?.research_objective ??
        raw?.request_extensions?.research_objective ??
        raw?.research_objective,
    );

    const payload = {
      ...raw,
      submission_id: submissionId,
      submitted_at: validIso(raw?.submitted_at) ? raw.submitted_at : now,
      channel: raw?.channel ?? "web_form",
      form_version: WORKFLOW_VERSION,
      contract_version: CONTRACT_VERSION,
      execution_contract_version: EXECUTION_CONTRACT_VERSION,
      research_objective: requestedObjective,
      request: {
        ...(raw?.request ?? {}),
        research_objective: requestedObjective,
      },
      request_extensions: {
        ...(raw?.request_extensions ?? {}),
        research_objective: requestedObjective,
        research_objective_version: raw?.request_extensions?.research_objective_version ?? "1.0.0",
      },
      intake_metadata: {
        ...(raw?.intake_metadata ?? {}),
        baseline_mode: "canonical_fresh",
        canonical_output: "report_json_lossless",
        client_default_output: "light_report",
        normalization_target: CONTRACT_VERSION,
        research_objective: requestedObjective,
        notification_email_inline: false,
      },
      stack_configuration: {
        config_name: "InduRadar Q0-STACK and runtime defaults",
        config_version: WORKFLOW_VERSION,
        runtime_configuration_version: RUNTIME_CONFIGURATION_VERSION,
        effective_date: "2026-09-21",
        expected_versions: {
          contract_version: CONTRACT_VERSION,
          workflow_version: WORKFLOW_VERSION,
          execution_contract_version: EXECUTION_CONTRACT_VERSION,
          heuristics_version: HEURISTICS_VERSION,
          tool_registry_version: TOOL_REGISTRY_VERSION,
          golden_test_version: GOLDEN_TEST_VERSION,
          source_catalog_version: SOURCE_CATALOG_VERSION,
          data_dictionary_version: DATA_DICTIONARY_VERSION,
          example_request_version: EXAMPLE_REQUEST_VERSION,
          report_template_version: REPORT_TEMPLATE_VERSION,
          excel_template_version: EXCEL_TEMPLATE_VERSION,
          document_manifest_version: DOCUMENT_MANIFEST_VERSION,
        },
      },
      privacy: {
        ...(raw?.privacy ?? {}),
        accepted_at: validIso(raw?.privacy?.accepted_at) ? raw.privacy.accepted_at : now,
      },
    };

    const email = payload?.contact?.email ?? payload?.email ?? null;
    const companyName = payload?.contact?.company_name ?? payload?.company_name ?? null;
    const firstName = payload?.contact?.first_name ?? payload?.first_name ?? null;
    const requestTitle = payload?.request?.title ?? `Solicitud web - ${companyName ?? "sin empresa"}`;
    const offer = payload?.seller_profile?.offer ?? payload?.offer ?? null;
    const description = payload?.request?.description ?? payload?.description ?? null;

    if (!email || !companyName) return json({ success: false, error: "Faltan email o empresa" }, 400);
    if (payload?.privacy?.privacy_notice_accepted !== true) return json({ success: false, error: "Debe aceptarse el aviso de privacidad" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const leadsAccountId = Deno.env.get("LEADS_ACCOUNT_ID");
    if (!supabaseUrl || !serviceRoleKey || !leadsAccountId) return json({ success: false, error: "Configuración incompleta del servidor" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const r = payload?.request ?? {};
    const s = payload?.seller_profile ?? {};
    const normalizedScope = {
      offer: s.offer ?? null,
      generic_supplier_label: s.generic_supplier_label ?? null,
      sectors: arr(r.sectors),
      subsectors: arr(r.subsectors),
      target_company_types: arr(r.target_company_types),
      opportunity_areas: arr(r.opportunity_areas),
      signal_types: arr(r.signal_types),
      technologies: arr(r.technologies),
      capabilities: arr(r.capabilities),
      geographies: arr(r.geographies),
      exclusions: arr(s.exclusions),
      must_have: arr(s.must_have),
      minimum_ticket_eur: s.minimum_ticket_eur ?? null,
      description: r.description ?? null,
      delivery_format: arr(r.delivery_format),
      frequency: r.frequency ?? "one_off",
      neutral_output: r.neutral_output !== false,
      research_objective: requestedObjective,
      normalization_version: CONTRACT_VERSION,
    };

    const { error: insertError } = await supabase.from("service_requests").insert({
      account_id: leadsAccountId,
      submission_id: submissionId,
      request_key: `web:${submissionId}`,
      channel: payload.channel,
      title: requestTitle,
      status: "received",
      contract_version: CONTRACT_VERSION,
      form_payload: payload,
      normalized_scope: normalizedScope,
      cutoff_date: r.cutoff_date ?? null,
      neutral_output: r.neutral_output !== false,
      internal_output_authorized: r.internal_output_authorized === true,
      received_at: payload.submitted_at,
    });

    if (insertError) return json({ success: false, error: insertError.message }, 500);

    return json({
      success: true,
      submission_id: submissionId,
      submitted_at: payload.submitted_at,
      contract_version: CONTRACT_VERSION,
      workflow_version: WORKFLOW_VERSION,
      research_objective: requestedObjective,
      email_sent: false,
      email_pending: true,
      email_error: null,
    }, 200);
  } catch {
    return json({ success: false, error: "Invalid request" }, 400);
  }
});

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function arr(v: unknown) { return Array.isArray(v) ? v : []; }
function validIso(v: unknown) { return typeof v === "string" && !Number.isNaN(Date.parse(v)); }
function isUuid(v: unknown) { return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }
function escapeHtml(value: unknown) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function normalizeResearchObjective(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["universe_discovery", "company_discovery", "companies", "new_companies", "map_companies", "universe_mapping"].includes(normalized)) return "universe_discovery";
  if (["balanced", "both", "companies_and_opportunities", "universe_and_signals"].includes(normalized)) return "balanced";
  return "signal_discovery";
}
