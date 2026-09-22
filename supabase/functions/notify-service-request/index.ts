import { createClient } from "npm:@supabase/supabase-js@2";

type Claim = {
  pass?: boolean;
  reason?: string;
  notification_id?: string;
  notification_kind?: string;
  request_id?: string;
  submission_id?: string;
  request_key?: string;
  channel?: string;
  title?: string;
  status?: string;
  credits_charged?: number | null;
  created_at?: string;
  authenticated?: boolean;
  source?: string;
  auth_user_id?: string | null;
  account_id?: string | null;
  account_name?: string | null;
  authenticated_email?: string | null;
  authenticated_display_name?: string | null;
  membership_role?: string | null;
  form_contact_email?: string | null;
  form_contact_name?: string | null;
  form_company_name?: string | null;
  identity_match?: boolean | null;
  follow_up_kind?: string | null;
  source_report_reference?: string | null;
  follow_up_note?: string | null;
  requested_company_id?: string | null;
  requested_company_name?: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uuid(value: unknown) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sourceLabelFor(claim: Claim) {
  if (claim.notification_kind === "internal_automation") return "Automatización interna";
  if (claim.notification_kind === "internal_request") return "Solicitud interna";
  if (claim.authenticated) return "Portal autenticado";
  const channel = (claim.channel ?? claim.source ?? "").toLowerCase();
  if (channel === "web_form") return "Formulario web";
  if (channel === "api") return "API no autenticada";
  if (channel === "email") return "Email";
  if (channel === "manual") return "Registro manual";
  return channel ? `Canal no autenticado: ${channel}` : "Canal no autenticado";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  let body: { notification_id?: unknown; dispatch_token?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }
  if (!uuid(body?.notification_id)) return json({ success: false, error: "invalid_notification_id" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("REQUEST_NOTIFICATION_TO_EMAIL") ?? "framanca@outlook.com";
  const from = Deno.env.get("REQUEST_NOTIFICATION_FROM_EMAIL") ?? "InduRadar <onboarding@resend.dev>";
  if (!supabaseUrl || !serviceRoleKey) return json({ success: false, error: "server_configuration_missing" }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const notificationId = body.notification_id as string;

  const dispatchToken = typeof body.dispatch_token === "string" ? body.dispatch_token : null;
  const claimCall = dispatchToken
    ? supabase.rpc("claim_service_request_notification_token_v1", {
        p_notification_id: notificationId,
        p_dispatch_token: dispatchToken,
      })
    : supabase.rpc("claim_service_request_notification_v1", {
        p_notification_id: notificationId,
      });
  const { data, error } = await claimCall;
  if (error) return json({ success: false, error: "claim_failed" }, 500);

  const claim = (data ?? {}) as Claim;
  if (claim.pass !== true) {
    return json({ success: true, no_op: true, reason: claim.reason ?? "not_claimed" }, 200);
  }

  if (!resendApiKey) {
    await supabase.rpc("complete_service_request_notification_v1", {
      p_notification_id: notificationId,
      p_success: false,
      p_provider_message_id: null,
      p_error: "RESEND_API_KEY no configurada",
    });
    return json({ success: false, error: "email_not_configured" }, 500);
  }

  const kind = claim.notification_kind ?? "admin_new_request";
  const isAutomation = kind === "internal_automation";
  const isInternalRequest = kind === "internal_request";
  const isInternal = isAutomation || isInternalRequest;
  const followUpKind = claim.follow_up_kind ?? null;
  const isReportUpdate = followUpKind === "report_update";
  const isCompanyDeepDive = followUpKind === "company_deep_dive";
  const sourceLabel = sourceLabelFor(claim);
  const identityName = claim.authenticated_display_name || claim.form_contact_name || "—";
  const identityEmail = claim.authenticated_email || claim.form_contact_email || "—";
  const company = claim.form_company_name || claim.account_name || "—";
  const identityMatch = claim.authenticated && claim.form_contact_email && claim.authenticated_email
    ? (claim.identity_match ? "Sí" : "No")
    : "No aplica";

  const heading = isReportUpdate
    ? "Solicitud de actualización de informe"
    : isCompanyDeepDive
      ? "Profundización de empresa solicitada"
      : isAutomation
        ? "Tarea interna programada InduRadar"
        : isInternalRequest
          ? "Solicitud interna InduRadar"
          : "Nueva solicitud InduRadar";
  const subject = isReportUpdate
    ? `Actualización InduRadar ${claim.source_report_reference ?? ""} - ${company}`
    : isCompanyDeepDive
      ? `Profundización InduRadar ${claim.requested_company_name ?? company} - ${claim.source_report_reference ?? ""}`
      : isAutomation
        ? `Tarea interna programada InduRadar - ${claim.title ?? claim.request_key ?? "sin título"}`
        : isInternalRequest
          ? `Solicitud interna InduRadar - ${claim.title ?? company}`
          : `Nueva solicitud InduRadar - ${company}`;

  const textLines = isReportUpdate
    ? [
        heading,
        "",
        `Informe origen: ${claim.source_report_reference ?? "—"}`,
        `Cliente / cuenta: ${company}`,
        `Usuario: ${identityName}`,
        `Email: ${identityEmail}`,
        "",
        "Qué quiere actualizar:",
        claim.follow_up_note ?? "—",
        "",
        `Submission ID: ${claim.submission_id ?? "—"}`,
        `Request ID: ${claim.request_id ?? "—"}`,
        `Request key: ${claim.request_key ?? "—"}`,
      ]
    : isCompanyDeepDive
      ? [
          heading,
          "",
          `Informe origen: ${claim.source_report_reference ?? "—"}`,
          `Empresa a profundizar: ${claim.requested_company_name ?? "—"}`,
          `Company ID: ${claim.requested_company_id ?? "—"}`,
          `Cliente / cuenta: ${company}`,
          `Usuario: ${identityName}`,
          `Nota del cliente: ${claim.follow_up_note ?? "—"}`,
          "",
          `Submission ID: ${claim.submission_id ?? "—"}`,
          `Request ID: ${claim.request_id ?? "—"}`,
          `Request key: ${claim.request_key ?? "—"}`,
        ]
      : isInternal
    ? [
        heading,
        "",
        "Esta notificación corresponde a trabajo interno de InduRadar; no es una solicitud enviada por un cliente.",
        "",
        `Origen: ${sourceLabel}`,
        `Cuenta: ${claim.account_name ?? company}`,
        `Título: ${claim.title ?? "—"}`,
        `Estado: ${claim.status ?? "—"}`,
        `Créditos cargados: ${claim.credits_charged ?? "—"}`,
        "",
        `Submission ID: ${claim.submission_id ?? "—"}`,
        `Request ID: ${claim.request_id ?? "—"}`,
        `Request key: ${claim.request_key ?? "—"}`,
        `Account ID: ${claim.account_id ?? "—"}`,
      ]
    : [
        heading,
        "",
        `Origen: ${sourceLabel}`,
        `Empresa / cuenta: ${company}`,
        `Usuario identificado: ${identityName}`,
        `Email identificado: ${identityEmail}`,
        `Email del formulario: ${claim.form_contact_email ?? "—"}`,
        `Identidad coincide con formulario: ${identityMatch}`,
        `Rol de cuenta: ${claim.membership_role ?? "—"}`,
        "",
        `Título: ${claim.title ?? "—"}`,
        `Estado: ${claim.status ?? "—"}`,
        `Créditos cargados: ${claim.credits_charged ?? "—"}`,
        "",
        `Submission ID: ${claim.submission_id ?? "—"}`,
        `Request ID: ${claim.request_id ?? "—"}`,
        `Request key: ${claim.request_key ?? "—"}`,
        `Auth User ID: ${claim.auth_user_id ?? "—"}`,
        `Account ID: ${claim.account_id ?? "—"}`,
      ];
  const textBody = textLines.join("\n");

  const html = isReportUpdate
    ? `
      <h2>${escapeHtml(heading)}</h2>
      <p><strong>Informe origen:</strong> ${escapeHtml(claim.source_report_reference ?? "—")}</p>
      <p><strong>Cliente / cuenta:</strong> ${escapeHtml(company)}</p>
      <p><strong>Usuario:</strong> ${escapeHtml(identityName)} · ${escapeHtml(identityEmail)}</p>
      <hr>
      <p><strong>Qué quiere actualizar:</strong></p>
      <p>${escapeHtml(claim.follow_up_note ?? "—")}</p>
      <hr>
      <p><strong>Submission ID:</strong><br>${escapeHtml(claim.submission_id ?? "—")}</p>
      <p><strong>Request ID:</strong><br>${escapeHtml(claim.request_id ?? "—")}</p>
      <p><strong>Request key:</strong><br>${escapeHtml(claim.request_key ?? "—")}</p>
    `
    : isCompanyDeepDive
      ? `
        <h2>${escapeHtml(heading)}</h2>
        <p><strong>Informe origen:</strong> ${escapeHtml(claim.source_report_reference ?? "—")}</p>
        <p><strong>Empresa a profundizar:</strong> ${escapeHtml(claim.requested_company_name ?? "—")}</p>
        <p><strong>Company ID:</strong> ${escapeHtml(claim.requested_company_id ?? "—")}</p>
        <p><strong>Cliente / cuenta:</strong> ${escapeHtml(company)}</p>
        <p><strong>Usuario:</strong> ${escapeHtml(identityName)} · ${escapeHtml(identityEmail)}</p>
        <p><strong>Nota del cliente:</strong> ${escapeHtml(claim.follow_up_note ?? "—")}</p>
        <hr>
        <p><strong>Submission ID:</strong><br>${escapeHtml(claim.submission_id ?? "—")}</p>
        <p><strong>Request ID:</strong><br>${escapeHtml(claim.request_id ?? "—")}</p>
        <p><strong>Request key:</strong><br>${escapeHtml(claim.request_key ?? "—")}</p>
      `
      : isInternal
    ? `
      <h2>${escapeHtml(heading)}</h2>
      <p><strong>Trabajo interno:</strong> Esta notificación no corresponde a una solicitud enviada por un cliente.</p>
      <p><strong>Origen:</strong> ${escapeHtml(sourceLabel)}</p>
      <p><strong>Cuenta:</strong> ${escapeHtml(claim.account_name ?? company)}</p>
      <hr>
      <p><strong>Título:</strong> ${escapeHtml(claim.title ?? "—")}</p>
      <p><strong>Estado:</strong> ${escapeHtml(claim.status ?? "—")}</p>
      <p><strong>Créditos cargados:</strong> ${escapeHtml(claim.credits_charged ?? "—")}</p>
      <hr>
      <p><strong>Submission ID:</strong><br>${escapeHtml(claim.submission_id ?? "—")}</p>
      <p><strong>Request ID:</strong><br>${escapeHtml(claim.request_id ?? "—")}</p>
      <p><strong>Request key:</strong><br>${escapeHtml(claim.request_key ?? "—")}</p>
      <p><strong>Account ID:</strong><br>${escapeHtml(claim.account_id ?? "—")}</p>
    `
    : `
      <h2>${escapeHtml(heading)}</h2>
      <p><strong>Origen:</strong> ${escapeHtml(sourceLabel)}</p>
      <p><strong>Empresa / cuenta:</strong> ${escapeHtml(company)}</p>
      <p><strong>Usuario identificado:</strong> ${escapeHtml(identityName)}</p>
      <p><strong>Email identificado:</strong> ${escapeHtml(identityEmail)}</p>
      <p><strong>Email del formulario:</strong> ${escapeHtml(claim.form_contact_email ?? "—")}</p>
      <p><strong>Identidad coincide con formulario:</strong> ${escapeHtml(identityMatch)}</p>
      <p><strong>Rol de cuenta:</strong> ${escapeHtml(claim.membership_role ?? "—")}</p>
      <hr>
      <p><strong>Título:</strong> ${escapeHtml(claim.title ?? "—")}</p>
      <p><strong>Estado:</strong> ${escapeHtml(claim.status ?? "—")}</p>
      <p><strong>Créditos cargados:</strong> ${escapeHtml(claim.credits_charged ?? "—")}</p>
      <hr>
      <p><strong>Submission ID:</strong><br>${escapeHtml(claim.submission_id ?? "—")}</p>
      <p><strong>Request ID:</strong><br>${escapeHtml(claim.request_id ?? "—")}</p>
      <p><strong>Request key:</strong><br>${escapeHtml(claim.request_key ?? "—")}</p>
      <p><strong>Auth User ID:</strong><br>${escapeHtml(claim.auth_user_id ?? "—")}</p>
      <p><strong>Account ID:</strong><br>${escapeHtml(claim.account_id ?? "—")}</p>
    `;

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text: textBody, html }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.rpc("complete_service_request_notification_v1", {
      p_notification_id: notificationId,
      p_success: false,
      p_provider_message_id: null,
      p_error: message,
    });
    return json({ success: false, error: "email_delivery_failed" }, 502);
  }

  let providerMessageId: string | null = null;
  let providerError: string | null = null;
  try {
    const responseBody = await response.json();
    providerMessageId = typeof responseBody?.id === "string" ? responseBody.id : null;
    if (!response.ok) providerError = JSON.stringify(responseBody).slice(0, 1800);
  } catch {
    if (!response.ok) providerError = `Resend HTTP ${response.status}`;
  }

  const { error: completionError } = await supabase.rpc("complete_service_request_notification_v1", {
    p_notification_id: notificationId,
    p_success: response.ok,
    p_provider_message_id: providerMessageId,
    p_error: response.ok ? null : providerError ?? `Resend HTTP ${response.status}`,
  });

  if (completionError) return json({ success: false, error: "notification_receipt_persist_failed" }, 500);
  if (!response.ok) return json({ success: false, error: "email_delivery_failed" }, 502);

  return json({ success: true, notification_id: notificationId, provider_message_id: providerMessageId }, 200);
});
