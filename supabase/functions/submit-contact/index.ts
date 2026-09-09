const allowedOrigins = new Set(
  (Deno.env.get('CONTACT_ALLOWED_ORIGINS') ?? 'https://induradar.com,https://www.induradar.com')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  website?: unknown;
};

function headersFor(origin: string | null) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  });
  if (origin && allowedOrigins.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function json(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
}

function value(value: unknown, maximum: number) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  const originAllowed = origin !== null && allowedOrigins.has(origin);

  if (request.method === 'OPTIONS') {
    return originAllowed
      ? new Response(null, { status: 204, headers: headersFor(origin) })
      : json({ success: false, error: 'origin_not_allowed' }, 403, origin);
  }

  if (!originAllowed) return json({ success: false, error: 'origin_not_allowed' }, 403, origin);
  if (request.method !== 'POST') return json({ success: false, error: 'method_not_allowed' }, 405, origin);

  let payload: ContactPayload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, error: 'invalid_json' }, 400, origin);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ success: false, error: 'invalid_request' }, 400, origin);
  }

  const name = value(payload.name, 120);
  const email = value(payload.email, 254);
  const message = value(payload.message, 4000);
  const honeypot = value(payload.website, 256);
  if (!name || !validEmail(email) || !message) return json({ success: false, error: 'invalid_request' }, 400, origin);

  // Reply successfully without sending mail when an automated client fills the hidden field.
  if (honeypot) return json({ success: true }, 200, origin);

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('CONTACT_FROM_EMAIL');
  const to = Deno.env.get('CONTACT_TO_EMAIL') ?? 'info@induradar.com';
  if (!resendApiKey || !from) {
    console.error('Contact email configuration is missing.');
    return json({ success: false, error: 'email_not_configured' }, 500, origin);
  }

  let resendResponse: Response;
  try {
    resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `Consulta web InduRadar - ${name}`,
        text: `Nombre: ${name}\nEmail: ${email}\n\nConsulta:\n${message}`,
        html: `<h1>Consulta web InduRadar</h1><p><strong>Nombre:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Consulta:</strong></p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
      }),
    });
  } catch {
    console.error('Resend could not be reached for a contact submission.');
    return json({ success: false, error: 'email_delivery_failed' }, 502, origin);
  }

  if (!resendResponse.ok) {
    console.error('Resend rejected contact submission.', { status: resendResponse.status });
    return json({ success: false, error: 'email_delivery_failed' }, 502, origin);
  }

  return json({ success: true }, 200, origin);
});
