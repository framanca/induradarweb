/* Reference machine service: executable specification for bench tests and simulation.
 * This JavaScript is NOT an Omron PLC FB. The browser simulation is not a security boundary.
 * In real mode only the independently provisioned service may authorize commands.
 */
(function(root){
'use strict';const C=root.NXCore;
class Fault extends Error{constructor(message,status=400,code='INVALID'){super(message);this.status=status;this.code=code;}}
class MachineService{
 constructor(project,{clock=()=>Date.now(),persist=()=>{},state=null,mode='simulation',simulationPolicy=null}={}){
  const inputProject=project;
  if(simulationPolicy){if(mode!=='simulation')throw new Error('Policy-only initialization is simulation-only');project=C.copy(project);project.screens=[{...C.newView('screen','Service'),width:project.width,height:project.height}];project.masters=[];project.popups=[];project.assets=[];}
  const errors=C.validate(project);if(errors.length)throw new Fault(errors.join('\n'));
  this.p=C.copy(project);this.clock=clock;this.persist=persist;this.mode=mode;this.hash=C.policyDigest(this.p);this.elements=simulationPolicy?new Map(simulationPolicy.elements.map(o=>[o.elementId||o.id,C.copy(o)])):C.policyObjects(this.p);if(simulationPolicy)this.hash=simulationPolicy.digest;this.sessions=new Map();this.pendingAlarms=new Map();this.pulses=new Map();this.sourceGood=true;this.storageGood=true;
  const initial={projectId:this.p.id,epoch:C.id(),seq:0,revision:0,values:Object.fromEntries(this.p.variables.map(v=>[v.name,C.typed(v,v.initial)])),recipes:C.copy(this.p.recipes),alarmRows:[],audit:[],production:[],events:[],results:{},activeRecipe:null,dropped:0};
  this.state=state?.projectId===project.id?{...initial,...C.copy(state),epoch:C.id(),events:[],seq:0}:initial;
  // Restored operational recipes are independent of a new UI package; revalidate them.
  for(const recipe of this.state.recipes)for(const [name,value] of Object.entries(recipe.values)){const v=this.variable(name);C.typed(v,value);}
  for(const v of this.p.variables)if(!Object.hasOwn(this.state.values,v.name))this.state.values[v.name]=C.typed(v,v.initial);
 }
 variable(name){const v=this.p.variables.find(v=>v.name===name);if(!v)throw new Fault('Variable no instalada: '+name,404);return v;}
 transaction(fn){const before=C.copy(this.state),pulses=new Map(this.pulses),pending=new Map(this.pendingAlarms);try{const result=fn();this.trim();this.persist(this.state);this.storageGood=true;return result;}catch(e){this.state=before;this.pulses=pulses;this.pendingAlarms=pending;if(!(e instanceof Fault))this.storageGood=false;throw e;}}
 trim(){const n=this.p.records.retention;for(const key of ['audit','production','events'])if(this.state[key].length>n){this.state.dropped+=this.state[key].length-n;this.state[key]=this.state[key].slice(-n);}
 const active=this.state.alarmRows.filter(r=>r.active),closed=this.state.alarmRows.filter(r=>!r.active);if(closed.length>n){this.state.dropped+=closed.length-n;this.state.alarmRows=[...closed.slice(-n),...active];}
 const keys=Object.keys(this.state.results);for(const k of keys.slice(0,Math.max(0,keys.length-2000)))delete this.state.results[k];
 }
 event(kind,data){const e={seq:++this.state.seq,time:this.clock(),kind,data:C.copy(data)};this.state.events.push(e);return e;}
 audit(user,action,target,before,requested,result,applied=null,commandId=''){const r={id:C.id(),time:this.clock(),user:user?.name||user?.id||'sistema',userId:user?.id||'',action,target,before,requested,applied,result,commandId};this.state.audit.push(r);this.event('operation',r);return r;}
 capabilities(){return {protocol:'nx-http-v2',version:2,projectId:this.p.id,policyDigest:this.hash,deviceMode:this.mode,bootId:this.state.epoch,features:C.apiContract.capabilities,hardwareValidated:false};}
 newSession(user){
  if(!user?.id||!this.p.security.roles.some(r=>r.id===user.role)||user.disabled)throw new Fault('Usuario no autorizado',403);
  const now=this.clock(),s={token:C.id()+C.id(),id:user.id,name:user.name||user.id,role:user.role,created:now,lastActivity:now,expiresAt:now+this.p.security.maxSessionSeconds*1000};
  this.transaction(()=>this.audit(s,'session.login','sesión',null,null,'accepted'));this.sessions.set(s.token,s);return this.sessionInfo(s);
 }
 sessionInfo(s){return {serverTime:this.clock(),token:s.token,user:{id:s.id,name:s.name,role:s.role},expiresAt:s.expiresAt,idleExpiresAt:s.lastActivity+this.p.security.idleSeconds*1000};}
 session(token,required=false){const s=this.sessions.get(token);if(s&&(this.clock()>=s.expiresAt||this.clock()-s.lastActivity>=this.p.security.idleSeconds*1000)){this.sessions.delete(token);try{this.transaction(()=>this.audit(s,'session.expired','sesión',null,null,'expired'));}catch{}throw new Fault('Sesión caducada',401,'SESSION_EXPIRED');}
  if(!s&&required)throw new Fault('Identifíquese para operar',401,'LOGIN_REQUIRED');return s||null;
 }
 touch(token){const s=this.session(token,true);s.lastActivity=this.clock();return this.sessionInfo(s);}
 logout(token){const s=this.sessions.get(token);this.sessions.delete(token);if(s)this.transaction(()=>this.audit(s,'session.logout','sesión',null,null,'accepted'));return {ok:true};}
 invalidateUser(id){for(const [token,s]of this.sessions)if(s.id===id)this.sessions.delete(token);}
 authorize(roles,session){if(!C.roleAllowed(roles,session?.role))throw new Fault('Permiso de operación denegado',403,'FORBIDDEN');}
 condition(name){if(name&&this.state.values[name]!==true)throw new Fault('La condición de habilitación no se cumple',409,'INTERLOCK');}
 read(token,names){const s=this.session(token);if(!s&&!this.p.security.guestRead)throw new Fault('Identificación requerida',401);if(!Array.isArray(names)||names.length>100)throw new Fault('Lote no válido');
  const allowed=new Set(this.p.variables.filter(v=>v.global).map(v=>v.name));for(const o of this.elements.values())if(C.roleAllowed(o.readRoles,s?.role)){for(const k of ['binding','writeBinding','visibleBinding','enabledBinding'])if(o[k])allowed.add(o[k]);for(const r of o.rules)allowed.add(r.variable);if(o.kind==='recipes')for(const name of o.recipeVariables||[])allowed.add(name);if(o.kind==='recipes')for(const r of this.state.recipes)Object.keys(r.values).forEach(n=>allowed.add(n));}
  for(const name of names){this.variable(name);if(!allowed.has(name))throw new Fault('Lectura no autorizada: '+name,403);}
  const now=this.clock();return {projectId:this.p.id,policyDigest:this.hash,revision:this.state.revision,sourceTime:now,sourceGood:this.sourceGood&&this.storageGood,values:Object.fromEntries(names.map(n=>[n,this.state.values[n]])),quality:Object.fromEntries(names.map(n=>[n,this.sourceGood?'good':'bad']))};
 }
 setSource(values,good=true){if(!good){this.sourceGood=false;this.pendingAlarms.clear();return;}const next={...this.state.values};for(const [name,value]of Object.entries(values))next[name]=C.typed({...this.variable(name),min:'',max:''},value);this.sourceGood=true;this.state.values=next;this.tick();}
 tick(){
  if(!this.sourceGood){this.pendingAlarms.clear();return;}const now=this.clock();let changes=[];
  for(const [name,due]of this.pulses)if(now>=due){this.state.values[name]=false;this.pulses.delete(name);}
  for(const a of this.p.alarms){
   const current=this.state.alarmRows.findLast(r=>r.alarmId===a.id&&r.active),value=this.state.values[a.binding],base=Number(a.value),h=a.hysteresis;let condition;
   if(value===undefined)continue;
   if(current&&['gt','ge'].includes(a.operator))condition=Number(value)>base-h;
   else if(current&&['lt','le'].includes(a.operator))condition=Number(value)<base+h;
   else condition=C.alarmOn(a,this.state.values,this.p.variables);
   if(condition===null)continue;const desired=!!condition,active=!!current;
   if(desired===active){this.pendingAlarms.delete(a.id);continue;}
   let pending=this.pendingAlarms.get(a.id);if(!pending||pending.desired!==desired){pending={desired,since:now};this.pendingAlarms.set(a.id,pending);}
   if(now-pending.since>=(desired?a.onDelayMs:a.offDelayMs))changes.push({a,current,desired});
  }
  if(!changes.length)return;
  this.transaction(()=>{for(const {a,current,desired}of changes){if(desired){const row={id:C.id(),alarmId:a.id,code:a.code,name:a.name,severity:a.severity,active:true,ack:false,silenced:false,time:now,cleared:null,ackAt:null,ackBy:null};this.state.alarmRows.push(row);this.event('alarm',row);}else{current.active=false;current.cleared=now;this.event('alarm',current);}this.pendingAlarms.delete(a.id);}});
 }
 events(token,{epoch='',after=0,limit=200}={}){const s=this.session(token);if(!s&&!this.p.security.guestRead)throw new Fault('Identificación requerida',401);
  const first=this.state.events[0]?.seq||0,reset=epoch!==this.state.epoch,gap=!reset&&after<first-1,events=this.state.events.filter(e=>e.seq>after).slice(0,Math.max(1,Math.min(1000,limit))),last=events.at(-1)?.seq||after;
  return {epoch:this.state.epoch,reset,gap,dropped:this.state.dropped,events:reset||gap?[]:events,next:reset||gap?this.state.seq:last,more:!reset&&!gap&&last<this.state.seq,snapshot:reset||gap?this.snapshot():null,sourceGood:this.sourceGood,storageGood:this.storageGood};
 }
 snapshot(){return {alarms:C.copy(this.state.alarmRows),audit:C.copy(this.state.audit),production:C.copy(this.state.production),recipes:C.copy(this.state.recipes),activeRecipe:C.copy(this.state.activeRecipe),revision:this.state.revision,retention:this.p.records.retention,dropped:this.state.dropped};}
 recipes(token){const s=this.session(token);if(!s&&!this.p.security.guestRead)throw new Fault('Identificación requerida',401);return {recipes:C.copy(this.state.recipes),activeRecipe:C.copy(this.state.activeRecipe),revision:this.state.revision};}
 result(token,id){const s=this.session(token,true),r=this.state.results[id];if(!r||r.userId!==s.id)throw new Fault('Resultado desconocido o no accesible; compruebe el equipo',404,'UNKNOWN');return C.copy(r.response);}
 command(token,req){
  let s;try{s=this.session(token,true);}catch(e){throw e;}
  if(!req||typeof req.commandId!=='string'||!/^[A-Za-z0-9:_-]{8,160}$/.test(req.commandId))throw new Fault('ID de comando inválido');
  if(req.policyDigest!==this.hash)throw new Fault('Política del equipo diferente al proyecto',409,'POLICY_MISMATCH');
  const fingerprint=C.digest(C.canonical(req)),existing=this.state.results[req.commandId];
  if(existing){if(existing.userId!==s.id||existing.fingerprint!==fingerprint)throw new Fault('ID de comando reutilizado con otro contenido',409,'ID_CONFLICT');return C.copy(existing.response);}
  try{return this.transaction(()=>{
   if(!this.sourceGood||!this.storageGood)throw new Fault('Equipo o registro no disponible',503,'UNAVAILABLE');
   const o=this.elements.get(req.elementId);if(!o)throw new Fault('Elemento no instalado',403);
   this.authorize(o.readRoles,s);this.authorize(o.operateRoles,s);this.condition(o.enabledBinding);
   if(req.expectedRevision!==this.state.revision)throw new Fault('Los datos cambiaron; recargue antes de operar',409,'REVISION_CONFLICT');
   const data=req.data||{},action=req.action;let before=null,applied=null,target=o.text||o.id;
   if(action==='write'||action==='pulse'){
    const permitted=['input','slider','switch','selector'].includes(o.kind)||o.kind==='button'&&['write','pulse'].includes(o.action);
    if(!permitted||action==='pulse'&&o.action!=='pulse'||o.action==='pulse'&&action!=='pulse')throw new Fault('Acción no instalada para este elemento',403);
    const name=o.writeBinding||o.binding,v=this.variable(name);if(v.access!=='RW')throw new Fault('Variable de solo lectura',403);
    const value=C.typed(v,action==='pulse'?true:data.value);
    if(o.kind==='button'&&action==='write'&&value!==C.typed(v,o.writeValue))throw new Fault('Valor distinto al configurado para el botón',403);
    if(o.kind==='selector'&&!o.options.some(a=>C.typed(v,a.value)===value))throw new Fault('Posición de selector no permitida');
    if(o.kind==='slider'&&(value<o.min||value>o.max))throw new Fault('Valor fuera de escala de slider');
    before=this.state.values[name];this.state.values[name]=value;applied=value;target=name;
    // Reference model only: the PLC implementation must generate/consume the pulse in its task.
    if(action==='pulse')this.pulses.set(name,this.clock()+100);
   }else if(action.startsWith('recipe.')){
    if(o.kind!=='recipes')throw new Fault('Elemento no autorizado para recetas',403);
    const allowedRecipeNames=new Set(o.recipeVariables?.length?o.recipeVariables:this.p.recipes.flatMap(r=>Object.keys(r.values)));
    const checkRecipeName=name=>{if(!allowedRecipeNames.has(name))throw new Fault('Parámetro no autorizado para este gestor de recetas: '+name,403);};
    const stored=this.state.recipes.find(r=>r.id===data.id);const template=this.p.recipes.find(r=>r.id===data.id);
    if(action==='recipe.apply'){
     if(!stored)throw new Fault('Receta no encontrada',404);this.authorize(template?.applyRoles||stored.applyRoles,s);this.condition(template?.enabledBinding||stored.enabledBinding);
     if(stored.version!==data.version)throw new Fault('La receta cambió: recárguela',409,'RECIPE_CONFLICT');
     const next={};for(const [name,value]of Object.entries(stored.values)){checkRecipeName(name);const v=this.variable(name);if(v.access!=='RW')throw new Fault('Receta contiene solo lectura');next[name]=C.typed(v,value);}
     if(!Object.keys(next).length)throw new Fault('Receta sin parámetros');before=Object.fromEntries(Object.keys(next).map(n=>[n,this.state.values[n]]));Object.assign(this.state.values,next);applied=next;
     this.state.activeRecipe={id:stored.id,name:stored.name,version:stored.version,appliedAt:this.clock(),user:s.name};target=stored.name;this.event('recipe.active',this.state.activeRecipe);
    }else{
     this.authorize(o.recipeEditRoles,s);if(stored)this.authorize(template?.editRoles||stored.editRoles,s);
     if(stored&&data.version!==stored.version)throw new Fault('Versión de receta antigua',409,'RECIPE_CONFLICT');
     if(action==='recipe.delete'){if(!stored)throw new Fault('Receta no encontrada',404);if(this.state.activeRecipe?.id===stored.id)throw new Fault('No se elimina la receta activa',409);before=C.copy(stored);this.state.recipes=this.state.recipes.filter(r=>r.id!==stored.id);applied='eliminada';}
     else if(action==='recipe.save'){
      if(!data.name||typeof data.name!=='string'||data.name.length>100||!data.values||typeof data.values!=='object'||Array.isArray(data.values))throw new Fault('Receta no válida');
      const values={};for(const[name,raw]of Object.entries(data.values)){checkRecipeName(name);const v=this.variable(name);if(v.access!=='RW')throw new Fault('Parámetro no escribible');values[name]=C.typed(v,raw);}
      if(!Object.keys(values).length)throw new Fault('Seleccione parámetros');
      const recipe={id:stored?.id||C.id(),name:data.name,version:(stored?.version||0)+1,values,applyRoles:stored?.applyRoles||o.operateRoles,editRoles:stored?.editRoles||o.recipeEditRoles,enabledBinding:stored?.enabledBinding||''};before=stored?C.copy(stored):null;this.state.recipes=this.state.recipes.filter(r=>r.id!==recipe.id);this.state.recipes.push(recipe);applied=recipe;
     }else throw new Fault('Acción de receta no admitida');
     this.event('recipes',this.state.recipes);
    }
   }else if(action.startsWith('alarm.')){
    if(!['alarms','banner'].includes(o.kind))throw new Fault('Elemento no autorizado para alarmas',403);
    const row=this.state.alarmRows.find(r=>r.id===data.eventId),definition=this.p.alarms.find(a=>a.id===row?.alarmId);if(!row||!definition)throw new Fault('Aparición de alarma no encontrada',404);
    before=C.copy(row);target=row.code;
    if(action==='alarm.ack'){this.authorize(definition.ackRoles,s);row.ack=true;row.ackAt=this.clock();row.ackBy=s.name;}
    else if(action==='alarm.silence'){this.authorize(definition.silenceRoles,s);row.silenced=true;if(definition.silenceBinding){this.state.values[definition.silenceBinding]=true;this.pulses.set(definition.silenceBinding,this.clock()+100);}}
    else if(action==='alarm.reset'){
     this.authorize(definition.resetRoles,s);if(!definition.resetBinding)throw new Fault('No hay solicitud de reset mapeada');if(row.active)throw new Fault('La condición sigue activa; reset rechazado',409);if(!row.ack)throw new Fault('Reconozca primero la alarma',409);
     this.state.values[definition.resetBinding]=true;this.pulses.set(definition.resetBinding,this.clock()+100);row.resetAt=this.clock();
    }else throw new Fault('Acción de alarma no admitida');applied=C.copy(row);this.event('alarm',row);
   }else throw new Fault('Acción no admitida');
   this.state.revision++;this.audit(s,action,target,before,data,'applied',applied,req.commandId);
   const response={commandId:req.commandId,status:'applied',accepted:true,applied:true,revision:this.state.revision,result:applied};this.state.results[req.commandId]={userId:s.id,fingerprint,response};s.lastActivity=this.clock();return C.copy(response);
  });}catch(e){
   const response={commandId:req.commandId,status:'rejected',accepted:false,applied:false,code:e.code||'STORAGE_ERROR',message:e.message};
   try{this.transaction(()=>{this.audit(s,req.action,req.elementId,null,req.data,'rejected',null,req.commandId);this.state.results[req.commandId]={userId:s.id,fingerprint,response};});}catch{}
   throw Object.assign(e,{response});
  }
 }
}
root.NXService={MachineService,Fault};
})(globalThis);
