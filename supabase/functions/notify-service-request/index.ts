import { createClient } from "npm:@supabase/supabase-js@2";

type Claim = {
  pass?: boolean;
  reason?: string;
  notification_id?: string;
  request_id?: string;
  submission_id?: string;
  request_key?: string;
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

  const sourceLabel = claim.authenticated ? "Portal autenticado" : "Formulario / canal no autenticado";
  const identityName = claim.authenticated_display_name || claim.form_contact_name || "—";
  const identityEmail = claim.authenticated_email || claim.form_contact_email || "—";
  const company = claim.form_company_name || claim.account_name || "—";
  const identityMatch = claim.authenticated && claim.form_contact_email && claim.authenticated_email
    ? (claim.identity_match ? "Sí" : "No")
    : "No aplica";

  const subject = `Nueva solicitud InduRadar - ${company}`;
  const textBody = [
    "Nueva solicitud InduRadar",
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
  ].join("\n");

  const html = `
    <h2>Nueva solicitud InduRadar</h2>
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
