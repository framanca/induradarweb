// Shared by the deployed Edge Function and the authorization regression tests.
export function createHandler({authenticate, compiler, origins, now = Date.now}) {
  const usage = new Map();
  const allowed = new Set(origins);
  return async function handle(req) {
    const origin = req.headers.get('origin');
    const headers = {'Cache-Control':'no-store', 'Vary':'Origin',
      'Access-Control-Allow-Headers':'authorization, apikey, content-type',
      'Access-Control-Allow-Methods':'POST, OPTIONS'};
    if (origin && allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const json = (status, body) => Response.json(body, {status, headers});
    if (origin && !allowed.has(origin)) return json(403, {error:'Origen no autorizado'});
    if (req.method === 'OPTIONS') return new Response(null, {status:204, headers});
    if (req.method !== 'POST') return json(405, {error:'Usa POST'});
    const token = /^Bearer (\S+)$/i.exec(req.headers.get('authorization') || '')?.[1];
    if (!token) return json(401, {error:'Debes iniciar sesión'});
    let user;
    try { user = await authenticate(token); } catch { return json(503, {error:'No se pudo verificar la sesión'}); }
    if (!user || user.is_anonymous) return json(401, {error:'Sesión no válida'});
    // Fresh server-owned metadata, never user_metadata or claims from an unverified JWT.
    if (user.app_metadata?.webhmi_compile !== true) return json(403, {error:'Esta cuenta no tiene tu autorización para compilar'});
    const time = now();
    let quota = usage.get(user.id);
    if (!quota || time - quota.start >= 60000) quota = {start:time, count:0};
    if (++quota.count > 20) return json(429, {error:'Espera un minuto antes de volver a compilar'});
    usage.set(user.id, quota);
    if (usage.size > 10000) for (const [key, value] of usage) if (time-value.start >= 60000) usage.delete(key);
    try {
      // Stream limit also covers requests without Content-Length.
      const reader = req.body?.getReader();
      if (!reader) return json(400, {error:'Falta el proyecto'});
      let size = 0; const chunks = [];
      while (true) { const {done,value} = await reader.read(); if (done) break;
        size += value.byteLength; if (size > 2*1024*1024) { await reader.cancel(); return json(413, {error:'El proyecto supera 2 MB'}); } chunks.push(value); }
      const bytes = new Uint8Array(size); let offset=0;
      for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.length;}
      const {action,project} = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      if (!['access','preview','compile'].includes(action)) return json(400, {error:'Operación no válida'});
      if (action === 'access') return json(200, {authorized:true});
      if (!project || typeof project !== 'object' || Array.isArray(project) ||
          !Array.isArray(project.screens) || !Array.isArray(project.variables) ||
          project.screens.length > 100 || project.variables.length > 3000 ||
          project.screens.some(s=>!s || !Array.isArray(s.objects) || s.objects.length>1000))
        return json(400, {error:'Estructura o tamaño de proyecto no admitidos'});
      const normalized = compiler.normalize(project), errors = compiler.validate(normalized);
      if (errors.length) return json(422, {error:'Corrige los bloqueos del proyecto', errors});
      let html = compiler.buildRuntimeHTML(normalized);
      const htmlBytes = new TextEncoder().encode(html).length;
      if (htmlBytes > compiler.HTML_MAX_BYTES) return json(422, {error:'HTML supera 512 KB'});
      if (action === 'preview') {
        html=html.replace('startComm();','for(const v of P.vars)vals[v.name]=v.type==="BOOL"?false:v.type==="STRING"?"DEMO":55;document.getElementById("status").textContent="PREVIEW online";comm.state="ONLINE";comm.lastGoodAt=Date.now();showScreen(0);fitStage();paint();');
        return json(200, {html,htmlBytes});
      }
      const out = compiler.exportPackage(normalized);
      const name=(normalized.name||'WebHMI_ST').replace(/[^A-Za-z0-9_-]+/g,'_')+'_Sysmac.zip';
      return new Response(out.zip, {status:200,headers:{...headers,'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${name}"`}});
    } catch { return json(400, {error:'Proyecto no válido o compilación fallida'}); }
  };
}
