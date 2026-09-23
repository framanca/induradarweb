#!/usr/bin/env node
/* LOCAL REFERENCE BENCH ONLY. Not an NX driver, gateway, or deployable PLC program.
 * Real HTTP sessions/authorization/persistence exercise the v2 protocol with simulated values.
 * Binds to loopback, requires pre-provisioned users, serves ONLY an exported SD directory.
 */
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
require('../core.js');require('../model.js');require('../service.js');
const C=globalThis.NXCore,{MachineService,Fault}=globalThis.NXService;C.id=()=>crypto.randomUUID();
const MAX_BODY=65536;
function atomicFile(file,value){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.new',fd=fs.openSync(temp,'w',0o600);try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,file);const dir=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){return new Promise((resolve,reject)=>{if(typeof password!=='string'||password.length<12||password.length>256)return reject(new Fault('Contraseña entre 12 y 256 caracteres'));crypto.scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024},(e,key)=>e?reject(e):resolve({salt,hash:key.toString('hex')}));});}
async function passwordMatches(password,record){if(typeof password!=='string'||password.length>256)return false;const salt=record?.salt||'00000000000000000000000000000000';const key=await new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024},(e,k)=>e?reject(e):resolve(k)));const expected=Buffer.from(record?.hash||'00'.repeat(64),'hex');return expected.length===key.length&&crypto.timingSafeEqual(expected,key)&&!!record;}
function createBench({project,privateDir,publicDir,port=8090,clock=()=>Date.now()}){
 privateDir=path.resolve(privateDir);publicDir=path.resolve(publicDir);if(privateDir===publicDir||privateDir.startsWith(publicDir+path.sep))throw new Error('El directorio privado NO puede estar dentro del directorio web');
 const projectErrors=C.validate(project);if(projectErrors.length)throw new Error(projectErrors.join('\n'));
 fs.mkdirSync(privateDir,{recursive:true,mode:0o700});const statePath=path.join(privateDir,'state.json'),usersPath=path.join(privateDir,'users.json');let users=fs.existsSync(usersPath)?JSON.parse(fs.readFileSync(usersPath,'utf8')):[];
 if(!users.length)throw new Error('No hay usuarios provisionados. Ejecute provision.cjs antes de iniciar el banco.');
 for(const u of users)if(!project.security.roles.some(r=>r.id===u.role))throw new Error('Rol de usuario no presente en la política: '+u.role);
 const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):null;
 const engine=new MachineService(project,{mode:'reference-bench',clock,state,persist:s=>atomicFile(statePath,s)});
 const attempts=new Map();let hashing=0,listenPort=port,userRevision=0;
 function cleanUsers(){return users.map(({id,name,role,disabled})=>({id,name,role,disabled:!!disabled}));}
 function json(res,status,data){if(res.headersSent)return;res.writeHead(status,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(data));}
 function getBody(req){return new Promise((resolve,reject)=>{let chunks=[],bytes=0;req.on('data',chunk=>{bytes+=chunk.length;if(bytes>MAX_BODY){reject(new Fault('Petición demasiado grande',413));req.destroy();return;}chunks.push(chunk);});req.on('end',()=>{try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}',(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw new Error('Clave no permitida');return v;});if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Objeto requerido');resolve(value);}catch{reject(new Fault('JSON no válido'));}});req.on('error',reject);});}
 const server=http.createServer(async(req,res)=>{try{
  const allowedHosts=new Set(['127.0.0.1:'+listenPort,'localhost:'+listenPort]);if(!allowedHosts.has(req.headers.host))throw new Fault('Host no permitido',403);
  const origin=req.headers.origin;if(origin&&!['http://127.0.0.1:'+listenPort,'http://localhost:'+listenPort].includes(origin))throw new Fault('Origen no permitido',403);
  const url=new URL(req.url,'http://127.0.0.1'),token=/^Bearer ([A-Za-z0-9-]{40,160})$/.exec(req.headers.authorization||'')?.[1]||'';
  if(url.pathname==='/api/hmi/capabilities'&&req.method==='GET'){json(res,200,engine.capabilities());return;}
  if(url.pathname.startsWith('/api/hmi/')){
   if(req.method!=='POST')throw new Fault('Método no permitido',405);
   if(!(req.headers['content-type']||'').startsWith('application/json'))throw new Fault('Se requiere application/json',415);
   const data=await getBody(req),route=url.pathname.slice('/api/hmi/'.length);let out;
   if(route==='session/login'){
    const key=String(data.username||'').slice(0,80),now=clock();let a=attempts.get(key)||{count:0,until:now+60000};if(now>a.until)a={count:0,until:now+60000};
    if(a.count>=5||hashing>=2)throw new Fault('Demasiados intentos; espere antes de reintentar',429);
    a.count++;attempts.set(key,a);if(attempts.size>1000)attempts.delete(attempts.keys().next().value);hashing++;
    let user=users.find(u=>u.id===key),valid;try{valid=await passwordMatches(data.password,user);}finally{hashing--;}
    if(!valid||user.disabled){engine.transaction(()=>engine.audit({id:key,name:key},'session.login','sesión',null,null,'denied'));throw new Fault('Usuario o contraseña incorrectos',401);}
    attempts.delete(key);out=engine.newSession(user);
   }else if(route==='session/logout')out=engine.logout(token);
   else if(route==='session/touch')out=engine.touch(token);
   else if(route==='read'){if(data.policyDigest!==engine.hash)throw new Fault('Política incompatible',409,'POLICY_MISMATCH');out=engine.read(token,data.names);}
   else if(route==='events')out=engine.events(token,data);
   else if(route==='recipes')out=engine.recipes(token);
   else if(route==='command')out=engine.command(token,data);
   else if(route==='command/result')out=engine.result(token,data.commandId);
   else if(route==='users'){
    const s=engine.session(token,true),admin=project.security.roles.find(r=>r.id===s.role)?.manageUsers;if(!admin)throw new Fault('Administración de usuarios no permitida',403);
    if(data.action==='list')out={users:cleanUsers()};
    else {const usersRevision=userRevision,next=C.copy(users),at=next.findIndex(u=>u.id===data.id),before=at>=0?{id:next[at].id,role:next[at].role,disabled:!!next[at].disabled}:null;
     if(data.action==='create'){
      if(at>=0||typeof data.id!=='string'||!/^[A-Za-z0-9_.-]{1,64}$/.test(data.id)||typeof data.name!=='string'||data.name.length>100||!project.security.roles.some(r=>r.id===data.role))throw new Fault('Usuario no válido o repetido');
      const hash=await hashPassword(data.password);next.push({id:data.id,name:data.name,role:data.role,disabled:false,...hash});
     }else if(data.action==='update'){
      if(at<0||!project.security.roles.some(r=>r.id===data.role)||typeof data.disabled!=='boolean')throw new Fault('Usuario/rol no válido');next[at].role=data.role;next[at].disabled=data.disabled;
     }else if(data.action==='password'){
      if(at<0)throw new Fault('Usuario no encontrado',404);Object.assign(next[at],await hashPassword(data.password));
     }else throw new Fault('Acción de usuario no admitida');
     if(!next.some(u=>!u.disabled&&project.security.roles.find(r=>r.id===u.role)?.manageUsers))throw new Fault('Debe quedar al menos un administrador de usuarios',409);
     // Recheck after asynchronous password hashing, and reject concurrent user edits.
     engine.session(token,true);if(usersRevision!==userRevision)throw new Fault('Los usuarios cambiaron: recargue',409);
     // User store and operational snapshot are independent: audit requested then applied.
     engine.transaction(()=>engine.audit(s,'user.'+data.action,data.id,before,{role:data.role,disabled:data.disabled},'requested'));
     atomicFile(usersPath,next);users=next;userRevision++;engine.invalidateUser(data.id);
     engine.transaction(()=>engine.audit(s,'user.'+data.action,data.id,before,{role:data.role,disabled:data.disabled},'applied'));out={ok:true,users:cleanUsers()};
    }
   }else throw new Fault('Ruta no encontrada',404);
   json(res,200,out);return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD')throw new Fault('Método no permitido',405);
  let name;try{name=decodeURIComponent(url.pathname);}catch{throw new Fault('Ruta inválida');}if(name==='/')name='/index.html';
  const file=path.resolve(publicDir,'.'+name);if(!file.startsWith(publicDir+path.sep))throw new Fault('Ruta no permitida',403);
  const ext=path.extname(file),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
  if(!types[ext]||!fs.existsSync(file)||!fs.statSync(file).isFile())throw new Fault('Archivo no encontrado',404);
  // Resolve symlinks before streaming: private data must not be exposed through a link.
  if(!fs.realpathSync(file).startsWith(fs.realpathSync(publicDir)+path.sep))throw new Fault('Ruta no permitida',403);
  res.writeHead(200,{'Content-Type':types[ext]+(ext.match(/html|js|css|json/)?';charset=utf-8':''),'Cache-Control':name.startsWith('/builds/')?'public,max-age=31536000,immutable':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"frame-ancestors 'none'; object-src 'none'; base-uri 'self'"});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch(e){json(res,e.status||500,{...(e.response||{}),message:e.status?e.message:'Error del banco de pruebas; revise almacenamiento',code:e.code||'INTERNAL'});}});
 let tick;return {engine,server,start:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{listenPort=server.address().port;tick=setInterval(()=>{try{engine.tick();}catch{engine.storageGood=false;}},50);resolve({port:listenPort,url:'http://127.0.0.1:'+listenPort});});}),stop:()=>new Promise(resolve=>{clearInterval(tick);server.close(resolve);server.closeIdleConnections();})};
}
module.exports={createBench,atomicFile,hashPassword,passwordMatches};
if(require.main===module){const argv=process.argv.slice(2),arg=(key,def)=>{const i=argv.indexOf(key);return i>=0?argv[i+1]:def;};try{const projectFile=arg('--project'),privateDir=arg('--private'),publicDir=arg('--public');if(!projectFile||!privateDir||!publicDir)throw new Error('Uso: node reference.cjs --project project.nxhmi --private /ruta/privada --public /ruta/SD [--port 8090]');const project=NXCore.parseProject(fs.readFileSync(projectFile,'utf8')),bench=createBench({project,privateDir,publicDir,port:Number(arg('--port',8090))});bench.start().then(info=>console.log('BANCO DE PRUEBAS — NO PLC. '+info.url));process.on('SIGINT',async()=>{await bench.stop();process.exit(0);});}catch(e){console.error(e.message);process.exit(1);}}
