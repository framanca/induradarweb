const allowedOrigins = new Set(
  (Deno.env.get('REPORT_ALLOWED_ORIGINS') ?? 'https://induradar.com,https://www.induradar.com')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function headersFor(origin: string | null, contentType = 'application/json; charset=utf-8') {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Type': contentType,
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
  });
  if (origin && allowedOrigins.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function json(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headersFor(origin) });
}

function isReference(value: string) {
  return /^IR-[0-9]{8}-[0-9A-HJKMNP-TV-Z]{6}$/.test(value);
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
  if (request.method !== 'GET') return json({ success: false, error: 'method_not_allowed' }, 405, origin);

  const authorization = request.headers.get('authorization')?.trim() ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return json({ success: false, error: 'authentication_required' }, 401, origin);
  }

  const url = new URL(request.url);
  const reference = (url.searchParams.get('ref') ?? '').trim().toUpperCase();
  const format = (url.searchParams.get('format') ?? 'json').trim().toLowerCase();
  if (!isReference(reference)) return json({ success: false, error: 'invalid_reference' }, 400, origin);
  if (!['json', 'html'].includes(format)) return json({ success: false, error: 'invalid_format' }, 400, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    console.error('Supabase runtime configuration is missing for get-report.');
    return json({ success: false, error: 'service_unavailable' }, 503, origin);
  }

  const rpc = format === 'html'
    ? 'get_web_report_html_delivery_by_reference_v1'
    : 'get_web_report_payload_by_reference_v1';

  let upstream: Response;
  try {
    upstream = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpc}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_report_reference: reference }),
    });
  } catch {
    console.error('Report RPC could not be reached.');
    return json({ success: false, error: 'service_unavailable' }, 503, origin);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return json({ success: false, error: 'authentication_required' }, 403, origin);
  }
  if (!upstream.ok) {
    console.error('Report RPC rejected request.', { status: upstream.status, reference, format });
    return json({ success: false, error: 'report_not_available' }, 404, origin);
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    console.error('Report RPC returned invalid JSON.', { reference, format });
    return json({ success: false, error: 'service_unavailable' }, 503, origin);
  }

  if (format === 'html') {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return json({ success: false, error: 'invalid_html_delivery_payload' }, 503, origin);
    }
    const delivery = payload as { mode?: unknown; html?: unknown; reason?: unknown };
    if (delivery.mode === 'legacy') {
      return json({ success: false, error: 'legacy_report' }, 409, origin);
    }
    if (delivery.mode === 'blocked') {
      console.error('Post-cutover report is missing canonical HTML.', { reference, reason: delivery.reason });
      return json({ success: false, error: 'canonical_html_required' }, 503, origin);
    }
    if (delivery.mode !== 'canonical' || typeof delivery.html !== 'string' || !delivery.html.trim()) {
      return json({ success: false, error: 'invalid_canonical_html' }, 503, origin);
    }
    return new Response(delivery.html, {
      status: 200,
      headers: headersFor(origin, 'text/html; charset=utf-8'),
    });
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ success: false, error: 'invalid_report_payload' }, 503, origin);
  }
  return new Response(JSON.stringify(payload), { status: 200, headers: headersFor(origin) });
});
