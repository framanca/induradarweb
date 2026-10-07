(function(root){
'use strict';
const VERSION=3;
const LIVE_TYPES=new Set(['BOOL','SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL','STRING']);
const NUMERIC_TYPES=new Set(['SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL']);
const WRITE_TYPES=new Set(['BOOL',...NUMERIC_TYPES]);
const id=()=>Math.random().toString(36).slice(2,10);
const copy=x=>JSON.parse(JSON.stringify(x));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function typeInfo(raw){
 const s=String(raw||'').trim().toUpperCase().replace(/\s+/g,'');
 const m=s.match(/^STRING(?:\[(\d+)\]|\((\d+)\))?$/);if(m)return{type:'STRING',length:Number(m[1]||m[2]||255),raw:s};
 const aliases={BOOLEAN:'BOOL',INTEGER:'INT',SIGNEDINT:'INT',DOUBLEINTEGER:'DINT',UNSIGNEDINT:'UINT',DOUBLEUNSIGNEDINTEGER:'UDINT',FLOAT:'REAL',DOUBLEFLOAT:'LREAL'};
 return{type:aliases[s]||s,length:null,raw:s};
}
function nameOK(n){return /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(String(n||''));}
function parseDelimited(text){
 text=String(text||'').replace(/^\uFEFF/,'').trim();if(!text)return[];
 const first=text.split(/\r?\n/)[0],sep=first.includes('\t')?'\t':first.includes(';')?';':',';let rows=[],row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===sep&&!quoted){row.push(field.trim());field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}
 row.push(field.trim());if(row.some(Boolean))rows.push(row);return rows;
}
function parseST(text){
 const out=[];for(const line of String(text||'').split(/\r?\n/)){const clean=line.replace(/\(\*.*?\*\)/g,'').replace(/\/\/.*$/,'').trim();const m=clean.match(/^([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*:\s*([A-Za-z][A-Za-z0-9_]*(?:\s*[\[(]\s*\d+\s*[\])])?)/);if(m){const t=typeInfo(m[2]);out.push({name:m[1],type:t.type,stringLength:t.length,comment:'',sourceType:t.raw});}}
 return out;
}
function importSysmac(text){
 const trimmed=String(text||'').trim();if(!trimmed)throw new Error('No hay contenido para importar.');
 let raw=[];if(/^\s*[A-Za-z_][A-Za-z0-9_.]*\s*:\s*[A-Za-z]/m.test(trimmed)&&!/^(?:Name|Nombre|Variable)[\t;,]/i.test(trimmed))raw=parseST(trimmed);
 const rows=parseDelimited(trimmed),norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_.\-/]/g,'');
 if(!raw.length&&rows.length){const head=rows[0].map(norm),ni=head.findIndex(x=>['name','nombre','variablename','variable','symbol','simbolo'].includes(x)),ti=head.findIndex(x=>['datatype','type','tipo','tipodedatos','datatypeofvariable'].includes(x)),ci=head.findIndex(x=>['comment','comments','comentario','description','descripcion'].includes(x));if(ni>=0&&ti>=0){for(const row of rows.slice(1)){if(!row[ni])continue;const t=typeInfo(row[ti]);raw.push({name:row[ni],type:t.type,stringLength:t.length,comment:row[ci]||'',sourceType:t.raw});}}else if(rows[0].length>=2&&!trimmed.includes(':=')){for(const row of rows){const t=typeInfo(row[1]);raw.push({name:row[0],type:t.type,stringLength:t.length,comment:row[2]||'',sourceType:t.raw});}}}
 if(!raw.length)raw=parseST(trimmed);if(!raw.length)throw new Error('No se reconocen variables. Usa Name/Nombre y Data Type/Tipo, o declaraciones ST simples.');
 const seen=new Set(),errors=[],vars=[];for(const r of raw){if(!nameOK(r.name)){errors.push('Nombre no compatible: '+r.name);continue;}if(seen.has(r.name)){errors.push('Duplicada: '+r.name);continue;}seen.add(r.name);const live=LIVE_TYPES.has(r.type);vars.push({id:vars.length+1,name:r.name,type:r.type,stringLength:r.stringLength||255,comment:r.comment||'',access:'R',expose:live,live,writeSupported:WRITE_TYPES.has(r.type)});}if(errors.length)throw new Error(errors.slice(0,12).join('\n'));return vars;
}
function newScreen(name='Principal'){return{id:id(),name,objects:[]};}
function baseObject(kind){return{id:id(),kind,x:40,y:40,w:150,h:50,text:'',binding:'',actionMode:'set',decimals:2,min:0,max:100,assetId:'',targetScreen:'',showLabel:true};}
function newObject(kind){const b=baseObject(kind),m={
 text:{w:240,h:40,text:'Texto'},lamp:{w:60,h:60,text:'Piloto'},value:{w:180,h:55,text:'Valor'},input:{w:240,h:58,text:'Entrada'},button:{w:180,h:60,text:'Boton'},bar:{w:260,h:38,text:'Barra'},image:{w:240,h:160,text:'Imagen'},motor:{w:120,h:100,text:'Motor'},pump:{w:120,h:100,text:'Bomba'},valve:{w:120,h:90,text:'Valvula'},tank:{w:150,h:220,text:'Deposito'},sensor:{w:120,h:90,text:'Sensor'},conveyor:{w:260,h:100,text:'Cinta'},nav:{w:180,h:54,text:'Ir a pantalla'},alarms:{w:520,h:250,text:'Alarmas'},recipes:{w:360,h:180,text:'Recetas'}
 };return Object.assign(b,m[kind]||{});}
function newProject(){const s=newScreen();return{version:VERSION,name:'WebHMI ST',port:8080,pollMs:500,width:1024,height:600,minDisplayWidth:480,maxDisplayWidth:1920,variables:[],screens:[s],assets:[],alarms:[],recipes:[]};}
function demoProject(){const p=newProject();p.name='Demo NX ST';p.variables=[
{id:1,name:'Machine_Running',type:'BOOL',stringLength:255,comment:'Maquina en marcha',access:'R',expose:true,live:true,writeSupported:true},
{id:2,name:'Process_Setpoint',type:'REAL',stringLength:255,comment:'Consigna',access:'RW',expose:true,live:true,writeSupported:true},
{id:3,name:'Process_Level',type:'REAL',stringLength:255,comment:'Nivel',access:'R',expose:true,live:true,writeSupported:true},
{id:4,name:'Start_Request',type:'BOOL',stringLength:255,comment:'Solicitud marcha',access:'RW',expose:true,live:true,writeSupported:true},
{id:5,name:'Alarm_High',type:'BOOL',stringLength:255,comment:'Alarma alta',access:'R',expose:true,live:true,writeSupported:true}
];
const main=p.screens[0];main.objects=[
Object.assign(newObject('text'),{x:30,y:20,w:390,text:'HMI NX ST 0.3'}),
Object.assign(newObject('motor'),{x:40,y:95,binding:'Machine_Running'}),
Object.assign(newObject('value'),{x:200,y:95,binding:'Process_Level',text:'Nivel',decimals:2}),
Object.assign(newObject('tank'),{x:430,y:80,binding:'Process_Level',min:0,max:100}),
Object.assign(newObject('input'),{x:200,y:180,binding:'Process_Setpoint',text:'Consigna',decimals:2}),
Object.assign(newObject('button'),{x:40,y:230,binding:'Start_Request',text:'Marcha SET',actionMode:'set'}),
Object.assign(newObject('alarms'),{x:40,y:330,w:500,h:210})
];
const s2=newScreen('Produccion');s2.objects=[Object.assign(newObject('conveyor'),{x:80,y:130,binding:'Machine_Running'}),Object.assign(newObject('recipes'),{x:430,y:100})];p.screens.push(s2);
p.alarms=[{id:id(),name:'Nivel alto',binding:'Alarm_High',operator:'eq',value:true,severity:'high',message:'Nivel alto activo'}];
p.recipes=[{id:id(),name:'Formato A',values:{Process_Setpoint:35.5}},{id:id(),name:'Formato B',values:{Process_Setpoint:72.0}}];
return p;}
function migrate(input){const p=copy(input||{});p.version=VERSION;p.minDisplayWidth=Number(p.minDisplayWidth??480);p.maxDisplayWidth=Number(p.maxDisplayWidth??1920);p.assets=Array.isArray(p.assets)?p.assets:[];p.alarms=Array.isArray(p.alarms)?p.alarms:[];p.recipes=Array.isArray(p.recipes)?p.recipes:[];if(!Array.isArray(p.screens)||!p.screens.length){const s=newScreen('Principal');s.objects=Array.isArray(p.objects)?p.objects:[];p.screens=[s];delete p.objects;}for(const s of p.screens){s.id=s.id||id();s.name=s.name||'Pantalla';s.objects=Array.isArray(s.objects)?s.objects:[];for(const o of s.objects){Object.assign(o,{actionMode:o.actionMode||'set',decimals:Number.isInteger(Number(o.decimals))?Number(o.decimals):2,min:Number(o.min??0),max:Number(o.max??100),assetId:o.assetId||'',targetScreen:o.targetScreen||'',showLabel:o.showLabel!==false});}}
return p;}
function variableMap(p){return new Map(p.variables.map(v=>[v.name,v]));}
function parseTyped(v,value){if(v.type==='BOOL'){if(value===true||value==='TRUE'||value==='true'||value===1||value==='1')return true;if(value===false||value==='FALSE'||value==='false'||value===0||value==='0')return false;throw new Error(v.name+': BOOL invalido');}if(NUMERIC_TYPES.has(v.type)){const n=Number(value);if(!Number.isFinite(n))throw new Error(v.name+': numero invalido');if(!['REAL','LREAL'].includes(v.type)&&!Number.isInteger(n))throw new Error(v.name+': entero requerido');return n;}if(v.type==='STRING')return String(value);throw new Error(v.name+': tipo no soportado');}
function alarmCondition(a,value,v){if(value===undefined)return false;let t;try{t=parseTyped(v,a.value);}catch{return false;}switch(a.operator){case'eq':return value===t;case'ne':return value!==t;case'gt':return Number(value)>Number(t);case'ge':return Number(value)>=Number(t);case'lt':return Number(value)<Number(t);case'le':return Number(value)<=Number(t);default:return false;}}
function validate(input){const p=migrate(input),e=[];if(!p||!Array.isArray(p.variables))return['Proyecto no valido'];if(!Number.isInteger(+p.port)||p.port<1024||p.port>65535)e.push('Puerto: use 1024..65535.');if(!Number.isInteger(+p.pollMs)||p.pollMs<100||p.pollMs>5000)e.push('Polling: 100..5000 ms.');if(!Number.isInteger(+p.width)||p.width<320||p.width>3840)e.push('Ancho de diseno: 320..3840 px.');if(!Number.isInteger(+p.height)||p.height<240||p.height>2160)e.push('Alto de diseno: 240..2160 px.');if(!Number.isInteger(+p.minDisplayWidth)||p.minDisplayWidth<320||p.minDisplayWidth>3840)e.push('Ancho minimo: 320..3840 px.');if(!Number.isInteger(+p.maxDisplayWidth)||p.maxDisplayWidth<320||p.maxDisplayWidth>7680)e.push('Ancho maximo: 320..7680 px.');if(p.minDisplayWidth>p.maxDisplayWidth)e.push('El ancho minimo no puede superar al maximo.');if(p.screens.length>20)e.push('Maximo 20 pantallas.');const screenIds=new Set(),screenNames=new Set();for(const s of p.screens){if(screenIds.has(s.id))e.push('ID de pantalla duplicado.');screenIds.add(s.id);if(screenNames.has(s.name))e.push('Nombre de pantalla duplicado: '+s.name);screenNames.add(s.name);}
const exposed=p.variables.filter(v=>v.expose&&v.live);if(exposed.length>64)e.push('Maximo 64 variables expuestas en esta version.');const worstApi=exposed.reduce((n,v)=>n+String(v.id).length+1+(v.type==='STRING'?Math.min(v.stringLength||255,255):v.type==='BOOL'?5:32)+1,0);if(worstApi>1500)e.push('La respuesta /api/read puede superar 1500 bytes; reduce variables o STRING expuestos.');const vm=variableMap(p),ids=new Set();for(const v of p.variables){if(ids.has(v.id))e.push('ID de variable duplicado: '+v.id);ids.add(v.id);if(v.expose&&!v.live)e.push(v.name+': tipo '+v.type+' no soportado.');if(v.access==='RW'&&!v.writeSupported)e.push(v.name+': escritura no soportada para '+v.type+'.');}
const assets=new Set(p.assets.map(a=>a.id));let assetBytes=0;for(const a of p.assets){assetBytes+=String(a.data||'').length;if(!/^data:image\/(png|jpeg|webp|svg\+xml);/i.test(a.data||''))e.push('Activo de imagen no valido: '+(a.name||a.id));}if(assetBytes>2_000_000)e.push('Imagenes embebidas >2 MB: reduzca tamano antes de exportar.');
const boolKinds=new Set(['lamp','button','motor','pump','valve','sensor','conveyor']),numKinds=new Set(['bar','tank']);for(const s of p.screens){for(const o of s.objects){const v=o.binding?vm.get(o.binding):null;if(['text','image','nav','alarms','recipes'].includes(o.kind)){if(o.kind==='image'&&!assets.has(o.assetId))e.push((o.text||'Imagen')+': selecciona una imagen.');if(o.kind==='nav'&&!screenIds.has(o.targetScreen))e.push((o.text||'Navegacion')+': selecciona pantalla destino.');continue;}if(!v)e.push((o.text||o.kind)+': selecciona una variable.');if(boolKinds.has(o.kind)&&v&&v.type!=='BOOL')e.push((o.text||o.kind)+': requiere BOOL.');if(numKinds.has(o.kind)&&v&&!NUMERIC_TYPES.has(v.type))e.push((o.text||o.kind)+': requiere tipo numerico.');if(o.kind==='input'&&v&&!NUMERIC_TYPES.has(v.type))e.push((o.text||o.kind)+': entrada requiere tipo numerico.');if(['button','input'].includes(o.kind)&&v&&v.access!=='RW')e.push((o.text||o.kind)+': requiere variable RW.');if(o.kind==='button'&&!['set','reset','toggle'].includes(o.actionMode||'set'))e.push((o.text||o.kind)+': accion de boton no valida.');if(['value','input'].includes(o.kind)&&(!Number.isInteger(Number(o.decimals))||o.decimals<0||o.decimals>6))e.push((o.text||o.kind)+': decimales 0..6.');}}
for(const a of p.alarms){const v=vm.get(a.binding);if(!v)e.push('Alarma '+a.name+': variable no valida.');if(!['eq','ne','gt','ge','lt','le'].includes(a.operator))e.push('Alarma '+a.name+': operador no valido.');if(!['info','warning','high'].includes(a.severity))e.push('Alarma '+a.name+': severidad no valida.');if(v)try{parseTyped(v,a.value);}catch(err){e.push('Alarma '+a.name+': '+err.message);}}
for(const r of p.recipes){if(!r.name)e.push('Receta sin nombre.');for(const [name,val] of Object.entries(r.values||{})){const v=vm.get(name);if(!v||v.access!=='RW'||!v.writeSupported)e.push('Receta '+r.name+': '+name+' debe ser RW y escribible.');else try{parseTyped(v,val);}catch(err){e.push('Receta '+r.name+': '+err.message);}}}
return[...new Set(e)];}
function symbolSVG(kind){const common='viewBox="0 0 100 80" aria-hidden="true"';switch(kind){case'motor':return `<svg ${common}><circle cx="50" cy="40" r="28"/><text x="50" y="49">M</text><line x1="78" y1="40" x2="96" y2="40"/></svg>`;case'pump':return `<svg ${common}><circle cx="42" cy="40" r="27"/><path d="M33 25 L64 40 L33 55 Z"/><line x1="69" y1="40" x2="96" y2="40"/></svg>`;case'valve':return `<svg ${common}><path d="M12 18 L50 40 L12 62 Z"/><path d="M88 18 L50 40 L88 62 Z"/><line x1="50" y1="10" x2="50" y2="70"/></svg>`;case'sensor':return `<svg ${common}><rect x="12" y="22" width="38" height="36" rx="5"/><path d="M58 28 Q78 40 58 52"/><path d="M68 20 Q96 40 68 60"/></svg>`;case'conveyor':return `<svg ${common}><rect x="7" y="25" width="86" height="20" rx="4"/><circle cx="20" cy="57" r="8"/><circle cx="50" cy="57" r="8"/><circle cx="80" cy="57" r="8"/></svg>`;default:return'';}}
root.NXST=Object.assign(root.NXST||{},{VERSION,LIVE_TYPES,NUMERIC_TYPES,WRITE_TYPES,id,copy,esc,typeInfo,nameOK,parseDelimited,importSysmac,newProject,newScreen,newObject,demoProject,migrate,validate,parseTyped,alarmCondition,symbolSVG});
})(globalThis);
