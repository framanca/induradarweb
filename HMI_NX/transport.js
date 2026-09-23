/* One supported transport contract: NX HTTP v2. No multi-driver abstraction is exposed. */
(function(root){
'use strict';const C=root.NXCore;
class SimTransport{
 constructor(p,service=null){this.service=service||new NXService.MachineService(p,{simulationPolicy:p._deployment?.simulationPolicy||null});this.token='';this.mode='simulation';}
 async capabilities(){return this.service.capabilities();}
 async login(role){const result=this.service.newSession({id:'sim_'+role,name:(this.service.p.security.roles.find(r=>r.id===role)?.name||role)+' · SIM',role});this.token=result.token;return result;}
 async logout(){const value=this.service.logout(this.token);this.token='';return value;}
 async touch(){return this.service.touch(this.token);}
 async read(names){return this.service.read(this.token,names);}
 async events(cursor){this.service.tick();return this.service.events(this.token,cursor);}
 async recipes(){return this.service.recipes(this.token);}
 async command(req){const value=this.service.command(this.token,req);this.service.tick();return value;}
 async result(id){return this.service.result(this.token,id);}
 stop(){this.token='';}
}
class HttpTransport{
 constructor(p){this.p=p;this.token='';this.queue=[];this.running=false;this.stopped=false;this.mode='real';}
 origin(){const c=this.p.connection,u=new URL(c.sameOrigin?location.origin:c.baseUrl);if(!['http:','https:'].includes(u.protocol))throw new Error('Abra el runtime desde un servidor HTTP(S).');if(location.protocol==='https:'&&u.protocol==='http:')throw new Error('HTTPS a HTTP bloqueado: sirva el runtime desde el NX o un servicio HTTPS autorizado.');return u;}
 secureSession(){const u=this.origin();if(u.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw new Error('La identificación real requiere HTTPS. No se enviarán credenciales por HTTP al NX.');}
 request(path,body=null,priority=0){if(this.stopped)return Promise.reject(new Error('Transporte cerrado'));return new Promise((resolve,reject)=>{this.queue.push({path,body,priority,resolve,reject,token:this.token});this.queue.sort((a,b)=>b.priority-a.priority);this.drain();});}
 async drain(){if(this.running||this.stopped)return;const item=this.queue.shift();if(!item)return;this.running=true;const abort=new AbortController();this.abort=abort;const timer=setTimeout(()=>abort.abort(),this.p.connection.timeoutMs);
 try{const headers={'Accept':'application/json'};if(item.body!==null)headers['Content-Type']='application/json';if(item.token)headers.Authorization='Bearer '+item.token;
 const r=await fetch(this.origin().origin+'/api/hmi/'+item.path,{method:item.body===null?'GET':'POST',headers,body:item.body===null?undefined:JSON.stringify(item.body),signal:abort.signal,cache:'no-store',credentials:'same-origin',redirect:'error'});
 const text=await r.text();if(text.length>4*1024*1024)throw new Error('Respuesta demasiado grande');let data;try{data=JSON.parse(text);}catch{throw new Error('Respuesta no JSON: compruebe que el servidor implementa NX HTTP v2');}
 if(!r.ok){const error=new Error(data.message||`HTTP ${r.status}`);error.status=r.status;error.code=data.code;error.response=data;throw error;}item.resolve(data);
 }catch(e){if(e.name==='AbortError'){const timeout=new Error('Tiempo de espera agotado; el resultado de una escritura puede ser desconocido');timeout.code='TIMEOUT';item.reject(timeout);}else item.reject(e);}finally{clearTimeout(timer);this.running=false;this.drain();}}
 capabilities(){return this.request('capabilities');}
 async login(username,password){this.secureSession();const s=await this.request('session/login',{username,password},2);if(!s.token||!s.user?.role)throw new Error('Sesión incompleta');this.token=s.token;return s;}
 async logout(){try{return await this.request('session/logout',{},2);}finally{this.token='';}}
 touch(){return this.request('session/touch',{},1);}
 read(names){return this.request('read',{names,policyDigest:this.p._deployment?.policyDigest||C.policyDigest(this.p)});}
 events(cursor){return this.request('events',cursor);}
 recipes(){return this.request('recipes',{});}
 command(req){return this.request('command',req,2);}
 result(id){return this.request('command/result',{commandId:id},2);}
 users(action,data={}){this.secureSession();return this.request('users',{action,...data},2);}
 stop(){this.stopped=true;this.abort?.abort();this.queue.splice(0).forEach(x=>x.reject(new Error('Transporte cerrado')));this.token='';}
}
root.NXTransport={SimTransport,HttpTransport};
})(globalThis);
