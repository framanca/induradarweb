import './compiler.js';
import {optimizeEmbeddedHTML} from './optimizer.mjs';
import { createHandler } from '../../../server/handler.mjs';

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_ANON_KEY')!;
const origins = ['https://induradar.com', 'https://www.induradar.com'];
// getUser via the Auth API verifies against the current user, so authorization
// revocation and deleted users do not depend on stale access-token metadata.
const authenticate = async (token: string) => {
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {apikey:key, Authorization:`Bearer ${token}`},
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error('Auth unavailable');
  return await response.json();
};
const runtimeCompiler=(globalThis as any).NXST;
runtimeCompiler.optimizeHTML=optimizeEmbeddedHTML;
const baseHandler = createHandler({authenticate, compiler:runtimeCompiler, origins});
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const version = '22';
Deno.serve(async (req: Request) => {
  let isCompile = false;
  if (req.method === 'POST') {
    try {
      const body = await req.clone().json();
      isCompile = body?.action === 'compile' || body?.action === 'compile-lite';
    } catch { /* Invalid requests are handled by the existing handler. */ }
  }
  let auditUser: any = null;
  if (isCompile) {
    const token = /^Bearer (\S+)$/i.exec(req.headers.get('authorization') || '')?.[1];
    if (token) try { auditUser = await authenticate(token); } catch { /* Audit may continue without identity. */ }
  }
  let response: Response;
  try { response = await baseHandler(req); }
  catch (error) {
    response = Response.json({error:'Compilación fallida'}, {status:500});
  }
  if (isCompile && serviceKey) {
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const validIp = ip && (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[0-9a-f:]+$/i.test(ip)) ? ip : null;
    try {
      const saved = await fetch(`${url}/rest/v1/webhmi_compilation_audit`, {
        method:'POST',
        headers:{apikey:serviceKey, Authorization:`Bearer ${serviceKey}`, 'Content-Type':'application/json', Prefer:'return=minimal'},
        body:JSON.stringify({user_id:auditUser?.id||null, ip:validIp, result:response.ok?'success':'error', version, http_status:response.status})
      });
      if (!saved.ok) console.error('WebHMI audit insert failed', saved.status);
    } catch (error) { console.error('WebHMI audit unavailable', String(error)); }
  }
  return response;
});
