const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const vm=require('node:vm'),ctx={TextEncoder,URL,console};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(base,'supabase/functions/webhmi-compile/compiler.js'),'utf8'),ctx);
let factory;
async function handler(user){factory ||= (await import('../server/handler.mjs')).createHandler;return factory({authenticate:async()=>user,compiler:ctx.NXST,origins:['https://induradar.com']});}
const request=(body,token='valid',origin='https://induradar.com')=>new Request('https://example.com/compile',{method:'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('frontend ships no compiler sources or calls',()=>{
 const html=fs.readFileSync(path.join(base,'public/index.html'),'utf8'),app=fs.readFileSync(path.join(base,'public/app.js'),'utf8');
 for(const file of ['st.js','zip.js','runtime.js','compiler.js']){assert.ok(!html.includes(file));assert.ok(!fs.existsSync(path.join(base,'public',file)));}
 assert.ok(html.includes('id="previewFrame" sandbox="allow-scripts"'));
 assert.ok(!app.includes('exportPackage'));assert.ok(!app.includes('buildRuntimeHTML'));
});
test('missing identity is denied, guests are allowed, and unapproved permanent accounts are denied',async()=>{
 assert.equal((await (await handler(null))(request({action:'access'},''))).status,401);
 const guestResult=await (await handler({id:'guest-a',is_anonymous:true,app_metadata:{}}))(request({action:'access'}));
 assert.equal(guestResult.status,200);assert.equal((await guestResult.json()).guest,true);
 assert.equal((await (await handler({id:'a',user_metadata:{webhmi_compile:true}}))(request({action:'access'}))).status,403);
});
test('revocation is checked on each operation, not stale JWT claims',async()=>{
 const user={id:'a',app_metadata:{webhmi_compile:true}},h=await handler(user);
 assert.equal((await h(request({action:'access'}))).status,200);
 user.app_metadata.webhmi_compile=false;
 assert.equal((await h(request({action:'compile',project:{}}))).status,403);
});
test('origin denial and preflight; origin is not the authorization mechanism',async()=>{
 const h=await handler({id:'a',app_metadata:{webhmi_compile:true}});
 assert.equal((await h(request({action:'access'},'valid','https://evil.example'))).status,403);
 assert.equal((await h(new Request('https://example.com',{method:'OPTIONS',headers:{Origin:'https://induradar.com'}}))).status,204);
 assert.equal((await h(new Request('https://example.com',{method:'POST',body:'{}'}))).status,401);
});
test('authorized compilation is byte-identical to the current editor',async()=>{
 const project=ctx.NXST.demoProject(),h=await handler({id:'a',app_metadata:{webhmi_compile:true}});
 const result=await h(request({action:'compile',project}));assert.equal(result.status,200);
 assert.equal(result.headers.get('content-type'),'application/zip');
 assert.deepEqual(Buffer.from(await result.arrayBuffer()),Buffer.from(ctx.NXST.exportPackage(ctx.NXST.normalize(project)).zip));
});
test('preview is generated remotely with simulated values',async()=>{
 const h=await handler({id:'a',app_metadata:{webhmi_compile:true}}),result=await h(request({action:'preview',project:ctx.NXST.demoProject()}));
 assert.equal(result.status,200);const data=await result.json();assert.ok(data.html.includes('PREVIEW online'));assert.ok(data.htmlBytes>0);assert.ok(!data.html.includes('startComm();'));
});
test('invalid input, unknown action, oversized stream and quota are rejected',async()=>{
 const h=await handler({id:'a',app_metadata:{webhmi_compile:true}});
 assert.equal((await h(request({action:'eval',project:{}}))).status,400);
 assert.equal((await h(request({action:'compile',project:{}}))).status,400);
 assert.equal((await h(request({action:'compile',project:{screens:[],variables:[]},padding:'x'.repeat(2*1024*1024)}))).status,413);
 let result;for(let i=0;i<21;i++)result=await h(request({action:'access'}));assert.equal(result.status,429);
 const guest=await handler({id:'guest-q',is_anonymous:true,app_metadata:{}});
 for(let i=0;i<11;i++)result=await guest(request({action:'access'}));
 assert.equal(result.status,429);
});

test('server refuses an image that injects HTML attributes',async()=>{
 const project=ctx.NXST.demoProject();
 project.assets=[{id:'unsafe',name:'unsafe.png',data:'data:image/png;base64,AAAA" onerror="alert(1)'}];
 const h=await handler({id:'a',app_metadata:{webhmi_compile:true}});
 assert.equal((await h(request({action:'compile',project}))).status,422);
});


test('frontend offers anonymous guest access without shipping compiler code',()=>{
 const client=fs.readFileSync(path.join(base,'client/online.js'),'utf8');
 assert.ok(client.includes('Entrar como invitado'));
 assert.ok(client.includes("/auth/v1/signup"));
 assert.ok(!client.includes('compiler.js'));
});


test('size metadata is authorized and matches the exact optimized output without exporting HTML or ST',async()=>{
 const project=ctx.NXST.demoProject(),original=ctx.NXST.optimizeHTML;
 const raw=ctx.NXST.buildRuntimeHTML(ctx.NXST.normalize(project),{modular:true});
 const expected=raw.replace('<title>','<title data-optimized="1">');
 ctx.NXST.optimizeHTML=async text=>text.replace('<title>','<title data-optimized="1">');
 try{
  const user={id:'size-user',app_metadata:{webhmi_compile:true}},h=await handler(user);
  const res=await h(request({action:'size',project}));
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.htmlBytes,new TextEncoder().encode(expected).length);
  assert.equal(data.originalHtmlBytes,new TextEncoder().encode(raw).length);
  assert.equal(data.limitBytes,ctx.NXST.HTML_MAX_BYTES);
  assert.equal(data.optimized,true);
  assert.equal(data.overLimit,false);
  assert.deepEqual(Object.keys(data).sort(),['htmlBytes','limitBytes','optimized','originalHtmlBytes','overLimit'].sort());
  assert.equal((await (await handler(null))(request({action:'size',project}))).status,401);
  assert.equal((await (await handler({id:'unapproved',app_metadata:{}}))(request({action:'size',project}))).status,403);
  const guest=await handler({id:'guest-size',is_anonymous:true,app_metadata:{}});
  assert.equal((await guest(request({action:'size',project}))).status,200);
  ctx.NXST.optimizeHTML=async()=> 'x'.repeat(ctx.NXST.HTML_MAX_BYTES+1);
  const limit=await (await handler({id:'size-over',app_metadata:{webhmi_compile:true}}))(request({action:'size',project}));
  assert.equal(limit.status,200);
  const over=await limit.json();
  assert.equal(over.htmlBytes,ctx.NXST.HTML_MAX_BYTES+1);
  assert.equal(over.overLimit,true);
 }finally{ctx.NXST.optimizeHTML=original}
});
test('online size action never counts as an audited compilation',()=>{
  const source=fs.readFileSync(path.join(base,'supabase/functions/webhmi-compile/audit.mjs'),'utf8');
  assert.match(source,/const exporting = action === 'compile' \|\| action === 'compile-lite'/);
  assert.match(source,/if \(!access && !exporting\) return handler\(request\)/);
  assert.doesNotMatch(source,/const exporting =[^;]*\bsize\b/);
});
