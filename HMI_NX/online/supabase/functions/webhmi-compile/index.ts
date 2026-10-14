import './compiler.js';
import {optimizeEmbeddedHTML} from './optimizer.mjs';
import { createHandler } from '../../../server/handler.mjs';
import { createAuditedHandler } from './audit.mjs';

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
const version = '24';
Deno.serve(createAuditedHandler({
  handler:baseHandler,
  authenticate,
  supabaseUrl:url,
  serviceKey,
  version
}));
