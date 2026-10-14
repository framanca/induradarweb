const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
if (!globalThis.crypto) globalThis.crypto=webcrypto;
async function harness({guest=true, auditOk=true, status=200}={}) {
  const {createAuditedHandler}=await import('../supabase/functions/webhmi-compile/audit.mjs');
  const captured=[];
  const user={id:'00000000-0000-4000-8000-000000000001',is_anonymous:guest};
  const handler=async()=>new Response('OK',{status,headers:{'Access-Control-Allow-Origin':'https://induradar.com'}});
  const authenticated=async()=>user;
  const audited=createAuditedHandler({
    handler, authenticate:authenticated, supabaseUrl:'https://example.supabase.co',
    serviceKey:'TEST-SERVER-KEY',version:'23',
    transport:async(url,request)=>{captured.push({url,request,entry:JSON.parse(request.body)});return {ok:auditOk,status:auditOk?201:500};}
  });
  const send=(action,project)=>audited(new Request('https://example.com/audit',{
    method:'POST',headers:{Authorization:'Bearer valid','Content-Type':'application/json',
      Origin:'https://induradar.com','x-forwarded-for':'192.0.2.10'},
    body:JSON.stringify({action,project})
  }));
  return {send,captured};
}
test('guest sign-in is audited even without an export',async()=>{
  const {send,captured}=await harness();
  assert.equal((await send('access')).status,200);
  assert.equal(captured.length,1);
  assert.ok(captured[0].url.endsWith('/webhmi_access_audit'));
  assert.equal(captured[0].entry.user_type,'guest');
  assert.equal(captured[0].entry.ip,'192.0.2.10');
  assert.equal(captured[0].entry.user_id,'00000000-0000-4000-8000-000000000001');
});
test('registered accounts are distinguished from anonymous guest accounts',async()=>{
  const {send,captured}=await harness({guest:false});
  assert.equal((await send('access')).status,200);
  assert.equal(captured[0].entry.user_type,'registered');
});
test('Sysmac export captures project details but never project data or ZIP',async()=>{
  const {send,captured}=await harness();
  const project={name:'Transportador 01',screens:[{id:'s1'}],variables:[{name:'RUN'}],secret:'not-an-audit-field'};
  assert.equal((await send('compile',project)).status,200);
  assert.equal(captured.length,1);
  const {entry,url}=captured[0];
  assert.ok(url.endsWith('/webhmi_compilation_audit'));
  assert.equal(entry.project_name,'Transportador 01');
  assert.equal(entry.project_screen_count,1);
  assert.equal(entry.project_variable_count,1);
  assert.equal(entry.export_variant,'standard');
  assert.match(entry.project_sha256,/^[0-9a-f]{64}$/);
  assert.ok(entry.project_bytes>0);
  assert.ok(!JSON.stringify(entry).includes('not-an-audit-field'));
  await send('compile-lite',project);
  assert.equal(captured[1].entry.export_variant,'extra-light');
});
test('previews never register an export',async()=>{
  const {send,captured}=await harness();
  assert.equal((await send('preview',{})).status,200);
  assert.equal(captured.length,0);
});
test('accepted access and export fail closed when the audit service is unavailable',async()=>{
  const {send,captured}=await harness({auditOk:false});
  const response=await send('access');
  assert.equal(response.status,503);
  assert.equal(response.headers.get('access-control-allow-origin'),'https://induradar.com');
  assert.equal((await send('compile',{name:'P',screens:[],variables:[]})).status,503);
  assert.equal(captured.length,2);
});
test('failed exports retain the original status even when audit fails',async()=>{
  const {send,captured}=await harness({auditOk:false,status:422});
  assert.equal((await send('compile',{name:'P',screens:[],variables:[]})).status,422);
  assert.equal(captured[0].entry.result,'error');
});
