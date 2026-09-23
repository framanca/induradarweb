/* HMI NX 0.2 — versioned model, migrations, dependency planner and operation policy.
 * Pure functions, shared by the editor, browser runtime and reference service.
 * No authentication secrets, arbitrary scripts, or device drivers in project files.
 */
(function(root){
'use strict';
const C=root.NXCore,legacy={...C},clone=C.copy;
const VERSION=2;
const KINDS=[...C.KINDS,'switch','selector','slider','level','circle','line','symbol','banner','audit','clock','user','navigation'];
const SYMBOLS=['motor','pump','valve','cylinder','tank','sensor','conveyor'];
const roles=()=>[{id:'observer',name:'Observador'},{id:'operator',name:'Operador'},{id:'maintenance',name:'Mantenimiento'},{id:'admin',name:'Administrador de máquina'}];
const view=(kind='screen',name='Pantalla')=>({id:C.id(),kind,name,width:1024,height:600,background:'#101c2c',masterId:'',slots:[],objects:[]});
function props(o){return {writeBinding:o.binding||'',readRoles:['*'],operateRoles:['operator','maintenance','admin'],deniedMode:'disable',enabledBinding:'',confirm:false,confirmText:'¿Confirmas esta operación?',audit:true,locked:false,groupId:'',orientation:'horizontal',step:1,options:[{value:0,label:'Baja'},{value:1,label:'Media'},{value:2,label:'Alta'}],writeMode:'release',keyboard:true,rules:[],symbol:'motor',popupBindings:{},recipeEditRoles:['maintenance','admin'],recipeVariables:[],...o};}
function migrate(source){
 const p=clone(source);if(![1,2].includes(p?.schemaVersion))throw new Error('Versión de proyecto no soportada');
 const from=p.schemaVersion;p.schemaVersion=VERSION;p.appVersion='0.2.0';p.revision=Number.isInteger(p.revision)?p.revision:1;
 p.masters||=[];p.popups||=[];p.security||={roles:roles(),idleSeconds:300,maxSessionSeconds:28800,defaultRole:'observer',guestRead:true};
 p.security.roles=p.security.roles.map(r=>({manageUsers:r.id==='admin',...r}));
 p.records||={retention:2000};p.exportMode||='single';p.runtimeProfile||='engineering';
 p.connection={...p.connection,profile:p.connection?.profile==='nx-http-v1'?'nx-http-v2':p.connection?.profile||'simulation',eventsMs:p.connection?.eventsMs||500};
 p.variables=(p.variables||[]).map(v=>({rateMs:250,global:false,unit:'',maxLength:255,...v}));
 const upgrade=(s,kind)=>({...s,kind:s.kind||kind,width:s.width||p.width,height:s.height||p.height,masterId:s.masterId||'',slots:s.slots||[],objects:(s.objects||[]).map(props)});
 p.screens=(p.screens||[]).map(s=>upgrade(s,'screen'));p.masters=p.masters.map(s=>upgrade(s,'master'));p.popups=p.popups.map(s=>upgrade(s,'popup'));
 p.recipes=(p.recipes||[]).map(r=>({version:1,applyRoles:['operator','maintenance','admin'],editRoles:['maintenance','admin'],enabledBinding:'',...r}));
 p.alarms=(p.alarms||[]).map((a,i)=>({code:`A${String(i+1).padStart(3,'0')}`,hysteresis:0,onDelayMs:0,offDelayMs:0,ackRoles:['operator','maintenance','admin'],silenceRoles:['operator','maintenance','admin'],resetRoles:['maintenance','admin'],resetBinding:'',silenceBinding:'',...a}));
 if(from===1)p.migration={from:1,to:2,notice:'Roles solo de operación. Haga una copia del .nxhmi original antes de sobrescribirlo.'};
 return p;
}
function newProject(){return migrate(legacy.newProject());}
function newObject(kind,x=40,y=40){
 let o=props(legacy.newObject(kind,x,y));
 const title={switch:'Interruptor',selector:'Selector',slider:'Ajuste',level:'Nivel',circle:'',line:'',symbol:'Motor',banner:'Alarmas activas',audit:'Operaciones',clock:'Reloj',user:'Usuario',navigation:'Navegación'};
 if(title[kind]!=null)o.text=title[kind];
 if(['switch','selector','slider','level','symbol'].includes(kind)){o.w=220;o.h=110;}
 if(['audit','banner'].includes(kind)){o.w=470;o.h=kind==='audit'?260:80;}
 if(kind==='line'){o.w=180;o.h=20;}
 if(kind==='circle'){o.w=80;o.h=80;}
 return o;
}
function allViews(p){return [...p.screens,...p.masters,...p.popups];}
function findView(p,id){return allViews(p).find(s=>s.id===id);}
function bindName(name,bindings={}){return name?.startsWith('$')?(bindings[name.slice(1)]||''):name||'';}
function resolved(o,bindings={},context=''){
 const a=clone(o);for(const key of ['binding','writeBinding','visibleBinding','enabledBinding'])a[key]=bindName(a[key],bindings);
 a.rules=a.rules.map(r=>({...r,variable:bindName(r.variable,bindings)}));
 a.elementId=context?`${context}::${a.id}`:a.id;return a;
}
function objectsFor(p,s,bindings={},context=''){
 const master=p.masters.find(m=>m.id===s.masterId);
 return [...(master?.objects||[]),...(s.objects||[])].map(o=>resolved(o,bindings,context));
}
function policyObjects(p){
 const objects=new Map();
 for(const s of [...p.screens,...p.masters,...p.popups.filter(v=>!v.slots.length)])for(const o of s.objects)objects.set(o.id,resolved(o));
 for(const s of allViews(p))for(const opener of s.objects){
  if(opener.action!=='popup')continue;const popup=p.popups.find(x=>x.id===opener.targetScreen);if(!popup)continue;
  for(const child of popup.objects){const o=resolved(child,opener.popupBindings,opener.id);objects.set(o.elementId,o);}
 }
 return objects;
}
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
// SHA-256 is used for package consistency, not as a replacement for TLS/signatures.
function digest(text){
 const bytes=new TextEncoder().encode(text),n=bytes.length,len=((n+9+63)>>6)<<6,data=new Uint8Array(len);data.set(bytes);data[n]=128;
 const d=new DataView(data.buffer);d.setUint32(len-8,Math.floor(n/536870912));d.setUint32(len-4,(n*8)>>>0);
 const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64),rr=(a,b)=>(a>>>b)|(a<<(32-b));
 for(let i=0;i<len;i+=64){for(let j=0;j<16;j++)w[j]=d.getUint32(i+j*4);for(let j=16;j<64;j++){const a=w[j-15],b=w[j-2];w[j]=(w[j-16]+(rr(a,7)^rr(a,18)^(a>>>3))+w[j-7]+(rr(b,17)^rr(b,19)^(b>>>10)))>>>0;}
 let[a,b,c,e,f,g,q,r]=h;for(let j=0;j<64;j++){const t1=(r+(rr(f,6)^rr(f,11)^rr(f,25))+((f&g)^(~f&q))+K[j]+w[j])>>>0,t2=((rr(a,2)^rr(a,13)^rr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;r=q;q=g;g=f;f=(e+t1)>>>0;e=c;c=b;b=a;a=(t1+t2)>>>0;}[a,b,c,e,f,g,q,r].forEach((v,j)=>h[j]=(h[j]+v)>>>0);}
 return h.map(v=>v.toString(16).padStart(8,'0')).join('');
}
function policy(p){return {version:2,projectId:p.id,security:p.security,variables:p.variables,alarms:p.alarms,recipes:p.recipes.map(r=>({id:r.id,applyRoles:r.applyRoles,editRoles:r.editRoles,enabledBinding:r.enabledBinding})),elements:[...policyObjects(p).values()]};}
const policyDigest=p=>digest(canonical(policy(p)));
function roleAllowed(list,role){return Array.isArray(list)&&(list.includes('*')||!!role&&list.includes(role));}
function dependencies(p,screenId,opened=[],role=undefined){
 const names=new Set(p.variables.filter(v=>v.global).map(v=>v.name));
 const collect=o=>{if(role!==undefined&&!roleAllowed(o.readRoles,role))return;for(const k of ['binding','writeBinding','visibleBinding','enabledBinding'])if(o[k])names.add(o[k]);for(const r of o.rules||[])if(r.variable)names.add(r.variable);
 if(o.kind==='recipes')for(const n of o.recipeVariables||[])names.add(n);
 if(o.kind==='recipes')for(const recipe of p.recipes){if(recipe.enabledBinding)names.add(recipe.enabledBinding);for(const name of Object.keys(recipe.values))names.add(name);}};
 const s=p.screens.find(v=>v.id===screenId);if(s)objectsFor(p,s).forEach(collect);
 for(const entry of opened){const s=p.popups.find(s=>s.id===entry.id);if(s)objectsFor(p,s,entry.bindings,entry.context).forEach(collect);}
 return p.variables.filter(v=>names.has(v.name));
}
function typed(v,raw){const out=legacy.typed(v,raw);if(v.type==='STRING'&&out.length>(v.maxLength??255))throw new Error(`${v.name}: longitud máxima ${v.maxLength}`);return out;}
function validate(p,complete=true){
 const e=[],err=s=>e.push(s);if(!p||p.schemaVersion!==2)return ['Versión de proyecto no soportada'];
 const scan=(obj,depth=0)=>{if(depth>30)throw new Error('Proyecto demasiado anidado');if(obj&&typeof obj==='object')for(const [k,v]of Object.entries(obj)){if(['__proto__','prototype','constructor','password','passwordHash','credentials','service_role'].includes(k))throw new Error('Clave no permitida o credenciales incluidas en el proyecto: '+k);scan(v,depth+1);}};
 try{scan(p);}catch(x){return [x.message];}
 for(const k of ['screens','masters','popups','variables','assets','recipes','alarms'])if(!Array.isArray(p[k]))err('Falta '+k);if(e.length)return e;
 if(!p.screens.length||p.screens.length>50||p.masters.length>20||p.popups.length>50)err('Límite de pantallas, maestras o ventanas');
 if(p.variables.length>100)err('Máximo 100 variables en este perfil');
 if(!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<240||p.height<240||p.width>3840||p.height>3840)err('Resolución no válida');
 if(typeof p.id!=='string'||!p.id||typeof p.name!=='string'||!p.name.trim())err('Nombre/ID de proyecto');
 if(!p.security||!Array.isArray(p.security.roles)||p.security.roles.length<1||p.security.roles.length>32)return ['Configure los roles de operación'];
 const roleIds=new Set();for(const r of p.security.roles){if(!/^[a-z][a-z0-9_-]{0,39}$/.test(r.id)||roleIds.has(r.id)||!r.name)err('Rol no válido o repetido');roleIds.add(r.id);}
 if(!Number.isInteger(p.security.idleSeconds)||p.security.idleSeconds<15||p.security.idleSeconds>86400||!Number.isInteger(p.security.maxSessionSeconds)||p.security.maxSessionSeconds<p.security.idleSeconds||p.security.maxSessionSeconds>86400)err('Caducidad de sesión no válida');
 const checkRoles=(v,label)=>{if(!Array.isArray(v)||v.some(id=>id!=='*'&&!roleIds.has(id)))err('Roles no válidos: '+label);};
 const ids=new Set(),checkId=(id,label)=>{if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id)||ids.has(id))err('ID no válido/duplicado: '+label);ids.add(id);};
 const names=new Set();for(const v of p.variables){if(!C.nameOK(v.name)||names.has(v.name)||!C.TYPES.includes(v.type)||!['R','RW'].includes(v.access))err('Variable no válida: '+v.name);names.add(v.name);try{typed(v,v.initial);}catch(x){err(x.message);}if(![100,250,500,1000,2000,5000].includes(v.rateMs))err('Frecuencia no válida: '+v.name);if(!Number.isInteger(v.maxLength)||v.maxLength<1||v.maxLength>255)err('Longitud de texto no válida: '+v.name);}
 const vmap=new Map(p.variables.map(v=>[v.name,v]));let total=0;
 for(const a of p.assets){checkId(a.id,'recurso');if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.data||'')||a.data.length>6*1024*1024)err('Imagen no válida: '+a.name);total+=(a.data?.length||0);}
 if(total>12*1024*1024)err('Más de 12 MB de imágenes');
 if(JSON.stringify(p).length>20*1024*1024)err('Proyecto mayor de 20 MB');
 for(const s of allViews(p)){
  checkId(s.id,'vista');if(!s.name||!/^#[a-f0-9]{6}$/i.test(s.background)||!Array.isArray(s.objects)||s.objects.length>500){err('Vista no válida');continue;}
  if(!Number.isFinite(s.width)||!Number.isFinite(s.height)||s.width<100||s.height<80||s.width>3840||s.height>3840)err('Dimensiones de vista');
  if(s.masterId&&!p.masters.some(m=>m.id===s.masterId))err('Página maestra no encontrada');
  if(s.kind!=='screen'&&s.masterId)err('Las maestras y ventanas no heredan maestras');
  if(!Array.isArray(s.slots)||new Set(s.slots.map(v=>v.name)).size!==s.slots.length||s.slots.some(v=>!C.nameOK(v.name)||!C.TYPES.includes(v.type)))err('Parámetros del faceplate no válidos');
  const variable=(n)=>n?.startsWith('$')?s.slots.find(v=>v.name===n.slice(1)):vmap.get(n);
  for(const o of s.objects){
   checkId(o.id,'objeto');if(!KINDS.includes(o.kind))err('Objeto desconocido');
   if(![o.x,o.y,o.w,o.h].every(Number.isFinite)||o.w<20||o.h<20||o.x<0||o.y<0||o.x+o.w>s.width+1||o.y+o.h>s.height+1)err('Objeto fuera de vista: '+o.text);
   for(const k of ['color','background','onColor','offColor'])if(!/^#[a-f0-9]{6}$/i.test(o[k]))err('Color inválido');
   checkRoles(o.readRoles,o.text);checkRoles(o.operateRoles,o.text);checkRoles(o.recipeEditRoles,o.text);
   if(!['hide','disable'].includes(o.deniedMode)||!['none','blink','rotate'].includes(o.animation))err('Apariencia no válida');
   if(!Number.isFinite(o.fontSize)||o.fontSize<8||o.fontSize>120)err('Tamaño de fuente no válido');
   if(!Array.isArray(o.rules)||o.rules.length>20)err('Reglas de animación no válidas');
   else for(const r of o.rules){if(!['x','y','rotate','width','height','color','text','visible','flow'].includes(r.property)||!['eq','ne','gt','ge','lt','le','range'].includes(r.operator))err('Regla desconocida');if(complete&&!variable(r.variable))err('Variable de regla: '+r.variable);if(r.operator==='range'&&(![r.from,r.to,r.outMin,r.outMax].every(Number.isFinite)||r.to<=r.from))err('Escala de regla no válida');if(r.property==='color'&&!/^#[a-f0-9]{6}$/i.test(r.output||''))err('Color de regla no válido');}
   if(!complete)continue;
   for(const key of ['binding','writeBinding','visibleBinding','enabledBinding'])if(o[key]&&!variable(o[key]))err('Variable no encontrada: '+o[key]);
   for(const key of ['visibleBinding','enabledBinding'])if(o[key]&&variable(o[key])?.type!=='BOOL')err('Condición requiere BOOL: '+o.text);
   if(['lamp','value','input','bar','level','switch','selector','slider','symbol'].includes(o.kind)&&!o.binding)err('Asigna variable a '+o.text);
   if(['lamp','switch'].includes(o.kind)&&variable(o.binding)?.type!=='BOOL')err('Requiere BOOL: '+o.text);
   if(['bar','level','slider'].includes(o.kind)&&(!['DINT','REAL'].includes(variable(o.binding)?.type)||!Number.isFinite(o.min)||!Number.isFinite(o.max)||o.max<=o.min))err('Escala o variable analógica no válida: '+o.text);
   if(o.kind==='slider'&&(!Number.isFinite(o.step)||o.step<=0||!['release','apply','continuous'].includes(o.writeMode)))err('Slider no válido');
   if(o.kind==='selector'&&(!Array.isArray(o.options)||!o.options.length||o.options.length>20))err('Opciones del selector');
   const writes=['input','switch','selector','slider'].includes(o.kind)||o.kind==='button'&&['write','pulse'].includes(o.action);
   if(writes){const v=variable(o.writeBinding||o.binding);if(!v||(v.access&&v.access!=='RW'))err('Operación requiere RW: '+o.text);else {try{if(o.kind==='button')typed({...v,name:v.name||o.binding},o.action==='pulse'?true:o.writeValue);if(o.kind==='selector')for(const option of o.options)typed({...v,name:v.name||o.binding},option.value);}catch(x){err(x.message);}}if(o.action==='pulse'&&v?.type!=='BOOL')err('Pulso requiere BOOL');}
   if(o.kind==='button'&&o.action==='navigate'&&!p.screens.some(v=>v.id===o.targetScreen))err('Pantalla de destino no encontrada');
   if(o.kind==='button'&&o.action==='popup'){
    if(s.kind==='popup')err('No se permiten pop-ups anidados en esta versión');const pop=p.popups.find(v=>v.id===o.targetScreen);if(!pop)err('Ventana de destino no encontrada');
    else for(const slot of pop.slots){const v=vmap.get(o.popupBindings?.[slot.name]);if(!v||v.type!==slot.type)err(`Enlace de faceplate ${slot.name}: tipo ${slot.type} requerido`);}
   }
   if(o.kind==='button'&&!['write','pulse','navigate','popup','login','logout','closePopup'].includes(o.action))err('Acción no soportada');
   if(o.kind==='image'&&!p.assets.some(a=>a.id===o.assetId))err('Selecciona una imagen');
   if(o.kind==='recipes'&&(!Array.isArray(o.recipeVariables)||o.recipeVariables.some(n=>vmap.get(n)?.access!=='RW')))err('Parámetros de receta no válidos');
   if(o.kind==='symbol'&&!SYMBOLS.includes(o.symbol))err('Símbolo no válido');
  }
 }
 for(const r of p.recipes){checkId(r.id,'receta');checkRoles(r.applyRoles,r.name);checkRoles(r.editRoles,r.name);if(!r.name||!r.values||typeof r.values!=='object'||Array.isArray(r.values)||!Number.isInteger(r.version)||r.version<1){err('Receta no válida');continue;}
 if(r.enabledBinding&&vmap.get(r.enabledBinding)?.type!=='BOOL')err('Habilitación de receta requiere BOOL');
 for(const [name,value]of Object.entries(r.values)){const v=vmap.get(name);if(!v||v.access!=='RW')err('Receta requiere RW: '+name);else try{typed(v,value);}catch(x){err(x.message);}}
 }
 for(const a of p.alarms){checkId(a.id,'alarma');const v=vmap.get(a.binding);if(!v||!['eq','gt','ge','lt','le'].includes(a.operator)||!['info','warning','high'].includes(a.severity))err('Alarma no válida: '+a.name);else try{typed({...v,min:'',max:''},a.value);}catch(x){err(x.message);}
 for(const k of ['ackRoles','silenceRoles','resetRoles'])checkRoles(a[k],a.name);
 if(![a.hysteresis,a.onDelayMs,a.offDelayMs].every(v=>Number.isFinite(v)&&v>=0)||a.onDelayMs>3600000||a.offDelayMs>3600000)err('Retardo/histéresis no válido');
 if(a.silenceBinding&&(vmap.get(a.silenceBinding)?.type!=='BOOL'||vmap.get(a.silenceBinding)?.access!=='RW'))err('Silencio requiere BOOL RW');
 if(a.resetBinding&&(vmap.get(a.resetBinding)?.type!=='BOOL'||vmap.get(a.resetBinding)?.access!=='RW'))err('Reset requiere solicitud BOOL RW');
 }
 for(const o of policyObjects(p).values()){if(!complete)break;const writes=['input','switch','selector','slider'].includes(o.kind)||o.kind==='button'&&['write','pulse'].includes(o.action);if(writes&&!o.binding?.startsWith('$')&&vmap.get(o.writeBinding||o.binding)?.access!=='RW')err('El enlace del faceplate requiere RW: '+o.text);}
 const c=p.connection;
 if(!c||!['simulation','nx-http-v2'].includes(c.profile)||!Number.isInteger(c.pollMs)||c.pollMs<100||c.pollMs>10000||!Number.isInteger(c.timeoutMs)||c.timeoutMs<300||c.timeoutMs>30000)err('Conexión no válida');
 if(c&&(!Number.isInteger(c.eventsMs)||c.eventsMs<100||c.eventsMs>5000))err('Frecuencia de eventos no válida');
 else try{const u=new URL(c.baseUrl);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||u.pathname!=='/')err('Use un origen HTTP(S) sin rutas ni credenciales');}catch{err('URL no válida');}
 if(!['single','split'].includes(p.exportMode))err('Exportación no válida');
 if(!Number.isInteger(p.records?.retention)||p.records.retention<100||p.records.retention>20000)err('Retención entre 100 y 20000 eventos');
 return [...new Set(e)];
}
function parseProject(text,complete=true){if(text.length>20*1024*1024)throw new Error('Proyecto demasiado grande');const raw=JSON.parse(text,(k,v)=>{if(['__proto__','prototype','constructor'].includes(k))throw new Error('Clave no permitida');return v;});const p=migrate(raw),e=validate(p,complete);if(e.length)throw new Error(e.slice(0,16).join('\n'));return p;}
function demoProject(){const p=migrate(legacy.demoProject());p.name='NX102 · Operación y mantenimiento';
 p.variables.push({name:'Machine.Mode',type:'DINT',access:'RW',initial:0,min:0,max:2,rateMs:250,global:false,unit:'',maxLength:255,comment:'Selector de modo'});
 const m=view('master','Cabecera de máquina');m.width=p.width;m.height=p.height;let o=newObject('clock',810,15);o.w=195;o.h=34;o.fontSize=13;m.objects.push(o);p.masters.push(m);p.screens.forEach(s=>s.masterId=m.id);
 const pop=view('popup','Motor · faceplate');pop.width=460;pop.height=330;pop.slots=[{name:'run',type:'BOOL'}];
 o=newObject('symbol',30,25);o.binding='$run';o.writeBinding='';o.w=180;o.h=150;o.animation='rotate';pop.objects.push(o);
 o=newObject('switch',230,40);o.binding='$run';o.writeBinding='$run';o.w=190;o.h=95;pop.objects.push(o);
 o=newObject('button',245,220);o.action='closePopup';o.text='Cerrar';o.w=160;pop.objects.push(o);p.popups.push(pop);
 const main=p.screens[0];o=newObject('button',525,514);o.w=400;o.h=50;o.text='Detalle de motor';o.action='popup';o.targetScreen=pop.id;o.popupBindings={run:'Machine.Running'};main.objects.push(o);
 const service=p.screens[1];service.objects.find(o=>o.kind==='recipes').h=330;
 return p;}
function ruleMatch(r,value){if(value===undefined)return false;const n=typeof value==='boolean'?String(r.value).toLowerCase()==='true':typeof value==='number'?Number(r.value):r.value;return {eq:()=>value===n,ne:()=>value!==n,gt:()=>value>n,ge:()=>value>=n,lt:()=>value<n,le:()=>value<=n,range:()=>Number.isFinite(Number(value))}[r.operator]?.()||false;}
function ruleValue(r,value){if(r.operator==='range')return r.outMin+(Math.max(r.from,Math.min(r.to,Number(value)))-r.from)/(r.to-r.from)*(r.outMax-r.outMin);return r.output;}
const contract={protocol:'nx-http-v2',version:2,notice:'Contrato propio. No es WebServer_NJ_NX v3.5; driver y FB HTTP NX pendientes de integración y ensayo.',capabilities:['groupedReads','operationPolicy','sessions','atomicRecipes','eventCursor','commandResults','assetFiles'],
 endpoints:{capabilities:'GET /api/hmi/capabilities',login:'POST /api/hmi/session/login',logout:'POST /api/hmi/session/logout',touch:'POST /api/hmi/session/touch',read:'POST /api/hmi/read',command:'POST /api/hmi/command',result:'POST /api/hmi/command/result',events:'POST /api/hmi/events',recipes:'POST /api/hmi/recipes',users:'POST /api/hmi/users'},
 command:{commandId:'unique-id',policyDigest:'installed-policy-sha256',elementId:'installed-element-id',action:'write|pulse|recipe.apply|recipe.save|alarm.ack|alarm.silence|alarm.reset',expectedRevision:0,data:{}},
 guarantees:['Servidor valida permisos, rangos, condiciones y política instalada','No confiar en nombre de usuario/rol enviado por cliente','No repetir una orden desconocida','Eventos numerados y huecos declarados','Receta atómica validada/aplicada en PLC','Credenciales y política activa fuera de directorio web']};
function importVariables(text,existing=[]){
 const imported=legacy.importVariables(text,existing).map(v=>({rateMs:250,global:false,unit:'',maxLength:255,...v}));
 const rows=C.parseDelimited(text),normalize=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_]/g,'');
 const header=rows[0]?.map(normalize)||[];let ni=header.findIndex(s=>['name','nombre','variablename'].includes(s)),ti=header.findIndex(s=>['datatype','type','tipo','tipodedatos'].includes(s));
 const data=ni>=0&&ti>=0?rows.slice(1):rows;if(ni<0||ti<0){ni=0;ti=1;}
 for(const row of data){const match=/^STRING\s*\[\s*(\d+)\s*\]$/i.exec(row[ti]||'');if(match){const length=Number(match[1]);if(length<1||length>255)throw new Error('STRING requiere longitud 1–255 en este perfil: '+row[ni]);const variable=imported.find(v=>v.name===row[ni]);if(variable)variable.maxLength=length;}}
 return imported;
}
Object.assign(C,{importVariables,VERSION,KINDS,SYMBOLS,migrate,newProject,newObject,demoProject,parseProject,validate,typed,allViews,findView,newView:view,resolved,objectsFor,policyObjects,policy,policyDigest,canonical,digest,roleAllowed,dependencies,ruleMatch,ruleValue,apiContract:contract});
})(globalThis);
