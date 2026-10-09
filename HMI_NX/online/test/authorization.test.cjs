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
test('missing identity, anonymous and unapproved accounts are denied',async()=>{
 assert.equal((await (await handler(null))(request({action:'access'},''))).status,401);
 assert.equal((await (await handler({id:'a',is_anonymous:true,app_metadata:{webhmi_compile:true}}))(request({action:'access'}))).status,401);
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
});

test('server refuses an image that injects HTML attributes',async()=>{
 const project=ctx.NXST.demoProject();
 project.assets=[{id:'unsafe',name:'unsafe.png',data:'data:image/png;base64,AAAA" onerror="alert(1)'}];
 const h=await handler({id:'a',app_metadata:{webhmi_compile:true}});
 assert.equal((await h(request({action:'compile',project}))).status,422);
});
