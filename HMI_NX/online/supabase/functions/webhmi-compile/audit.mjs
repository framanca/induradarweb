// Server-only event logging for successful WebHMI sign-ins and Sysmac exports.
// Never stores project source, generated ZIPs, credentials or session tokens.
const ipv4 = value => {
  const parts = value.split('.');
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
};
export function sourceIp(request) {
  for (const name of ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for']) {
    const candidate = (request.headers.get(name) || '').split(',')[0].trim();
    if (!candidate) continue;
    if (ipv4(candidate)) return candidate;
    if (candidate.includes(':') && candidate.length <= 45) {
      try { if (new URL('http://[' + candidate + ']/').hostname) return candidate; } catch {}
    }
  }
  return null;
}
const limitedName = value => String(value || 'Sin nombre').slice(0, 160);
async function projectMetadata(project) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) return {};
  const json = JSON.stringify(project);
  const data = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return {
    project_name: limitedName(project.name),
    project_sha256: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join(''),
    project_bytes: data.byteLength,
    project_screen_count: Array.isArray(project.screens) ? project.screens.length : null,
    project_variable_count: Array.isArray(project.variables) ? project.variables.length : null
  };
}
function auditUnavailable(response) {
  const headers = {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  const origin = response.headers.get('Access-Control-Allow-Origin');
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return Response.json({error:'No se ha podido registrar esta operación. Reintenta la operación.'}, {status:503, headers});
}
export function createAuditedHandler({handler, authenticate, supabaseUrl, serviceKey, version, transport = fetch}) {
  return async request => {
    let body = null;
    if (request.method === 'POST') {
      try {
        // This same request is validated and size-limited by the underlying compiler.
        const length = Number(request.headers.get('content-length') || 0);
        if (length <= 2 * 1024 * 1024 + 256) body = await request.clone().json();
      } catch { /* Invalid JSON is rejected by the normal handler. */ }
    }
    const action = body?.action;
    const access = action === 'access';
    const exporting = action === 'compile' || action === 'compile-lite';
    if (!access && !exporting) return handler(request);
    let response;
    try { response = await handler(request); }
    catch { response = Response.json({error:'Compilación fallida'}, {status:500}); }
    // Only accepted sign-ins are access events. Failed export attempts are useful too.
    if (access && !response.ok) return response;
    const token = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') || '')?.[1];
    let user = null;
    if (token) {
      try { user = await authenticate(token); } catch { /* An unsuccessful audit cannot authorize an export. */ }
    }
    const userType = user ? (user.is_anonymous === true ? 'guest' : 'registered') : 'unknown';
    let entry = {
      user_id:user?.id || null,
      user_type:userType,
      ip:sourceIp(request),
      result:response.ok ? 'success' : 'error',
      http_status:response.status,
      version
    };
    if (exporting) {
      entry.export_variant = action === 'compile-lite' ? 'extra-light' : 'standard';
      try { entry = {...entry, ...await projectMetadata(body?.project)}; }
      catch { /* The normal export validation remains authoritative. */ }
    }
    const table = access ? 'webhmi_access_audit' : 'webhmi_compilation_audit';
    let recorded = false;
    if (serviceKey) {
      try {
        const saved = await transport(supabaseUrl + '/rest/v1/' + table, {
          method:'POST',
          headers:{
            apikey:serviceKey,
            Authorization:'Bearer ' + serviceKey,
            'Content-Type':'application/json',
            Prefer:'return=minimal'
          },
          body:JSON.stringify(entry)
        });
        recorded = saved.ok;
        if (!saved.ok) console.error('WebHMI audit insert failed', table, saved.status);
      } catch (error) { console.error('WebHMI audit unavailable', table, String(error)); }
    }
    // Do not deliver a successful login/export without a persisted event.
    // An export rejected upstream keeps its original error status.
    return !recorded && response.ok ? auditUnavailable(response) : response;
  };
}
