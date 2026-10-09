(function(root){'use strict';
const LIVE_TYPES=new Set(['BOOL','SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL','STRING']);
const WRITE_TYPES=new Set(['BOOL','SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL','STRING']);
const NUMERIC_TYPES=new Set(['SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL']);
const INTEGER_TYPES=new Set(['SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT']);
const MAX_SCREEN_NUMBER=65535;
const BOOL_WIDGETS=new Set(['status']);
const STATUS_SYMBOLS=new Set(['lamp','motor','pump','valve','conveyor','sensor']);
const LEGACY_STATUS_KINDS=new Set(['lamp','motor','pump','valve','conveyor','sensor']);
const STATUS_LABELS={lamp:'Lámpara',motor:'Motor',pump:'Bomba',valve:'Válvula',conveyor:'Cinta',sensor:'Sensor'};
const IMAGE_MAX_BYTES=64*1024,IMAGE_TOTAL_MAX_BYTES=256*1024,HTML_MAX_BYTES=512*1024,IMAGE_OPTIMIZE_MAX_DIM=1024;
const enc=new TextEncoder();
function dataUrlBytes(data){const s=String(data||''),i=s.indexOf(',');if(i<0)return enc.encode(s).length;const meta=s.slice(0,i),body=s.slice(i+1);if(/;base64$/i.test(meta)){const clean=body.replace(/\s/g,'');const pad=clean.endsWith('==')?2:clean.endsWith('=')?1:0;return Math.max(0,Math.floor(clean.length*3/4)-pad);}try{return enc.encode(decodeURIComponent(body)).length}catch{return enc.encode(body).length;}}
const id=()=>Math.random().toString(36).slice(2,10);
const copy=x=>JSON.parse(JSON.stringify(x));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function statusSvg(type,on=false){type=STATUS_SYMBOLS.has(type)?type:'lamp';const fill=on?'#86efac':'#e2e8f0',stroke=on?'#15803d':'#475569',accent=on?'#22c55e':'#94a3b8',common='viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';if(type==='lamp')return '<svg '+common+'><circle cx="50" cy="38" r="23" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/>'+(on?'<path d="M50 5v9M50 62v10M17 38H7M93 38H83M27 15l6 7M73 15l-6 7" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/>':'')+'</svg>';if(type==='motor')return '<svg '+common+'><circle cx="42" cy="39" r="25" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><text x="42" y="48" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" font-weight="700" fill="'+stroke+'">M</text><path d="M67 39h20" stroke="'+stroke+'" stroke-width="6" stroke-linecap="round"/>'+(on?'<path d="M24 13c8-7 27-8 37 1" fill="none" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/><path d="M58 8l7 7-10 2" fill="'+accent+'"/>':'')+'</svg>';if(type==='pump')return '<svg '+common+'><circle cx="38" cy="40" r="25" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><path d="M38 23l17 17-17 17z" fill="'+accent+'" stroke="'+stroke+'" stroke-width="3"/><path d="M63 40h26v-17" fill="none" stroke="'+stroke+'" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'+(on?'<path d="M72 14h17" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/><path d="M89 14l-8-5v10z" fill="'+accent+'"/>':'')+'</svg>';if(type==='valve')return '<svg '+common+'><path d="M8 40h18M74 40h18" stroke="'+stroke+'" stroke-width="6" stroke-linecap="round"/><path d="M25 20l25 20-25 20zM75 20L50 40l25 20z" fill="'+fill+'" stroke="'+stroke+'" stroke-width="4" stroke-linejoin="round"/><path d="M50 40V12M38 12h24" stroke="'+stroke+'" stroke-width="5" stroke-linecap="round"/>'+(on?'<circle cx="50" cy="40" r="8" fill="'+accent+'"/><path d="M35 68h30" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/>':'<path d="M43 33l14 14M57 33L43 47" stroke="#64748b" stroke-width="4" stroke-linecap="round"/>')+'</svg>';if(type==='conveyor')return '<svg '+common+'><rect x="8" y="25" width="84" height="30" rx="14" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><circle cx="24" cy="40" r="7" fill="white" stroke="'+stroke+'" stroke-width="3"/><circle cx="50" cy="40" r="7" fill="white" stroke="'+stroke+'" stroke-width="3"/><circle cx="76" cy="40" r="7" fill="white" stroke="'+stroke+'" stroke-width="3"/>'+(on?'<path d="M30 15h38" stroke="'+accent+'" stroke-width="5" stroke-linecap="round"/><path d="M68 15l-10-7v14z" fill="'+accent+'"/>':'<path d="M45 11v9M55 11v9" stroke="#64748b" stroke-width="5" stroke-linecap="round"/>')+'</svg>';return '<svg '+common+'><rect x="10" y="20" width="40" height="38" rx="6" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><circle cx="43" cy="39" r="6" fill="'+accent+'" stroke="'+stroke+'" stroke-width="3"/><path d="M10 30H3M10 48H3" stroke="'+stroke+'" stroke-width="4" stroke-linecap="round"/>'+(on?'<path d="M56 29l34-10M56 39h36M56 49l34 10" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/>':'<path d="M57 39h18" stroke="#94a3b8" stroke-width="3" stroke-dasharray="5 5"/>')+'</svg>';}
function optionalNumber(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function typeInfo(raw){const s=String(raw||'').trim().toUpperCase().replace(/\s+/g,'');const m=s.match(/^STRING(?:\[(\d+)\]|\((\d+)\))?$/);if(m)return{type:'STRING',length:Number(m[1]||m[2]||255),raw:s};const a={BOOLEAN:'BOOL',INTEGER:'INT',SIGNEDINT:'INT',DOUBLEINTEGER:'DINT',UNSIGNEDINT:'UINT',DOUBLEUNSIGNEDINTEGER:'UDINT',FLOAT:'REAL',DOUBLEFLOAT:'LREAL'};return{type:a[s]||s,length:null,raw:s};}
function nameOK(n){return /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(String(n||''));}
function parseDelimited(text){text=String(text||'').replace(/^\uFEFF/,'').trim();if(!text)return[];const first=text.split(/\r?\n/)[0],sep=first.includes('\t')?'\t':first.includes(';')?';':',';let rows=[],row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===sep&&!quoted){row.push(field.trim());field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}row.push(field.trim());if(row.some(Boolean))rows.push(row);return rows;}
function parseST(text){const out=[];for(const line of String(text||'').split(/\r?\n/)){const clean=line.replace(/\(\*.*?\*\)/g,'').replace(/\/\/.*$/,'').trim();const m=clean.match(/^([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*:\s*([A-Za-z][A-Za-z0-9_]*(?:\s*[\[(]\s*\d+\s*[\])])?)/);if(m){const t=typeInfo(m[2]);out.push({name:m[1],type:t.type,stringLength:t.length,comment:'',sourceType:t.raw});}}return out;}
function importSysmac(text){const trimmed=String(text||'').trim();if(!trimmed)throw new Error('No hay contenido para importar.');let raw=[];if(/^\s*[A-Za-z_][A-Za-z0-9_.]*\s*:\s*[A-Za-z]/m.test(trimmed)&&!/^(?:Name|Nombre|Variable)[\t;,]/i.test(trimmed))raw=parseST(trimmed);const rows=parseDelimited(trimmed),norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_.\-/]/g,'');if(!raw.length&&rows.length){const h=rows[0].map(norm),ni=h.findIndex(x=>['name','nombre','variablename','variable','symbol','simbolo'].includes(x)),ti=h.findIndex(x=>['datatype','type','tipo','tipodedatos','datatypeofvariable'].includes(x)),ci=h.findIndex(x=>['comment','comments','comentario','description','descripcion'].includes(x));if(ni>=0&&ti>=0){for(const row of rows.slice(1)){if(!row[ni])continue;const t=typeInfo(row[ti]);raw.push({name:row[ni],type:t.type,stringLength:t.length,comment:row[ci]||''});}}else if(rows[0].length>=2&&!trimmed.includes(':=')){for(const row of rows){const t=typeInfo(row[1]);raw.push({name:row[0],type:t.type,stringLength:t.length,comment:row[2]||''});}}}if(!raw.length)raw=parseST(trimmed);if(!raw.length)throw new Error('No se reconocen variables. Usa Name/Nombre + Data Type/Tipo, o declaraciones ST simples.');const seen=new Set(),errors=[],vars=[];for(const r of raw){if(!nameOK(r.name)){errors.push('Nombre no compatible: '+r.name);continue;}if(seen.has(r.name)){errors.push('Duplicada: '+r.name);continue;}seen.add(r.name);const live=LIVE_TYPES.has(r.type),stringLength=r.stringLength||255;vars.push({id:vars.length+1,name:r.name,type:r.type,stringLength,comment:r.comment||'',access:'R',expose:live,live,writeSupported:WRITE_TYPES.has(r.type)&&(r.type!=='STRING'||stringLength<=512)});}if(errors.length)throw new Error(errors.slice(0,12).join('\n'));return vars;}
function newScreen(name='Principal',number=null){return{id:id(),name,number,background:'#ffffff',useBase:false,objects:[]};}
function newBaseScreen(){return newScreen('Pantalla base',null);}
function screenObjects(project,screen){return project.baseScreen&&screen!==project.baseScreen&&screen.useBase?[...project.baseScreen.objects,...screen.objects]:screen.objects;}
function nextScreenNumber(screens){const used=new Set(screens.map(s=>Number(s.number)));for(let n=1;n<=MAX_SCREEN_NUMBER;n++)if(!used.has(n))return n;throw new Error('No quedan números de pantalla disponibles.');}
function duplicateScreen(original,name,number=null){const clone=copy(original);clone.id=id();clone.name=name;clone.number=number;clone.objects=(clone.objects||[]).map(o=>({...o,id:id(),targetScreenId:o.actionType==='navigate'&&o.targetScreenId===original.id?clone.id:o.targetScreenId}));return clone;}
function newProject(){return{name:'WebHMI ST',port:8080,pollMs:500,width:1024,height:600,minDisplayWidth:480,maxDisplayWidth:1920,screenBinding:'',variables:[],screens:[newScreen('Principal',1)],baseScreen:null,assets:[],alarms:[],recipes:[]};}
function normalize(input){const p=copy(input||newProject());p.minDisplayWidth=Number(p.minDisplayWidth??480);p.maxDisplayWidth=Number(p.maxDisplayWidth??1920);p.screenBinding=typeof p.screenBinding==='string'?p.screenBinding:'';p.baseScreen=p.baseScreen&&typeof p.baseScreen==='object'&&!Array.isArray(p.baseScreen)?p.baseScreen:null;p.variables=Array.isArray(p.variables)?p.variables:[];for(const v of p.variables){const t=typeInfo(v.type);v.type=t.type;v.stringLength=Number(v.stringLength||t.length||255);v.live=LIVE_TYPES.has(v.type);v.writeSupported=WRITE_TYPES.has(v.type)&&(v.type!=='STRING'||v.stringLength<=512);if(v.access!=='R'&&v.access!=='RW')v.access='R';if(typeof v.expose!=='boolean')v.expose=v.live;}p.assets=Array.isArray(p.assets)?p.assets:[];p.alarms=Array.isArray(p.alarms)?p.alarms:[];p.recipes=Array.isArray(p.recipes)?p.recipes:[];if(!Array.isArray(p.screens)||!p.screens.length){p.screens=[{id:id(),name:'Principal',objects:Array.isArray(p.objects)?p.objects:[]}];delete p.objects;}const occupied=new Set(p.screens.filter(s=>s.number!==null&&s.number!==undefined&&Number.isInteger(Number(s.number))&&Number(s.number)>=1&&Number(s.number)<=MAX_SCREEN_NUMBER).map(s=>Number(s.number)));let nextNumber=1;for(const s of [...p.screens,...(p.baseScreen?[p.baseScreen]:[])]){const isBase=s===p.baseScreen;s.id=s.id||id();s.name=s.name||(isBase?'Pantalla base':'Pantalla');s.useBase=!isBase&&s.useBase===true;if(isBase)s.number=null;else if(s.number===null||s.number===undefined){while(occupied.has(nextNumber))nextNumber++;s.number=nextNumber;occupied.add(nextNumber);}else s.number=Number(s.number);s.background=/^#[0-9a-f]{6}$/i.test(s.background||'')?s.background:'#ffffff';s.objects=Array.isArray(s.objects)?s.objects:[];for(const o of s.objects){if(LEGACY_STATUS_KINDS.has(o.kind)){o.symbolType=o.kind;o.kind='status';}o.symbolType=STATUS_SYMBOLS.has(o.symbolType)?o.symbolType:'lamp';o.stateOnWhen=o.stateOnWhen==='false'?'false':'true';o.assetOnId=o.assetOnId||'';o.actionType=o.actionType||'write';o.targetScreenId=o.targetScreenId||'';o.actionMode=o.actionMode||'set';o.feedbackBinding=o.feedbackBinding||'';o.feedbackColorOff=/^#[0-9a-f]{6}$/i.test(o.feedbackColorOff||'')?o.feedbackColorOff:'#2563eb';o.feedbackColorOn=/^#[0-9a-f]{6}$/i.test(o.feedbackColorOn||'')?o.feedbackColorOn:'#16a34a';o.decimals=Number.isInteger(Number(o.decimals))?Number(o.decimals):2;o.inputMin=optionalNumber(o.inputMin);o.inputMax=optionalNumber(o.inputMax);o.min=Number.isFinite(Number(o.min))?Number(o.min):0;o.max=Number.isFinite(Number(o.max))?Number(o.max):100;o.step=Number.isFinite(Number(o.step))&&Number(o.step)>0?Number(o.step):1;o.optionsText=typeof o.optionsText==='string'?o.optionsText:'0=Paro\n1=Manual\n2=Automático';o.unit=typeof o.unit==='string'?o.unit:'';o.target=Number.isFinite(Number(o.target))?Number(o.target):100;}}return p;}
function newObject(kind){const base={id:id(),kind,x:40,y:40,w:150,h:50,text:'',binding:'',assetId:'',assetOnId:'',symbolType:'lamp',stateOnWhen:'true',actionType:'write',targetScreenId:'',actionMode:'set',feedbackBinding:'',feedbackColorOff:'#2563eb',feedbackColorOn:'#16a34a',decimals:2,inputMin:null,inputMax:null,min:0,max:100,step:1,optionsText:'0=Paro\n1=Manual\n2=Automático',unit:'',target:100};const m={text:{w:220,h:40,text:'Texto'},status:{w:110,h:100,text:'Estado'},value:{w:160,h:50,text:'Valor'},input:{w:210,h:55,text:'Entrada'},button:{w:170,h:58,text:'Botón'},bar:{w:240,h:36,text:'Barra'},image:{w:240,h:160,text:'Imagen'},tank:{w:140,h:190,text:'Depósito'},slider:{w:300,h:90,text:'Consigna'},switch:{w:160,h:65,text:'Activar'},selector:{w:240,h:65,text:'Modo'},multistate:{w:200,h:70,text:'Estado'},gauge:{w:170,h:170,text:'Indicador'},stepper:{w:230,h:75,text:'Ajuste'},counter:{w:220,h:95,text:'Producción'},dropdown:{w:220,h:70,text:'Selección'}};return Object.assign(base,m[kind]||{});}
function demoProject(){const p=newProject();p.name='Demo NX ST';p.variables=[{id:1,name:'Machine_Running',type:'BOOL',stringLength:255,comment:'Máquina en marcha',access:'RW',expose:true,live:true,writeSupported:true},{id:2,name:'Process_Setpoint',type:'REAL',stringLength:255,comment:'Consigna',access:'RW',expose:true,live:true,writeSupported:true},{id:3,name:'Process_Level',type:'REAL',stringLength:255,comment:'Nivel',access:'R',expose:true,live:true,writeSupported:true},{id:4,name:'Start_Request',type:'BOOL',stringLength:255,comment:'Solicitud marcha',access:'RW',expose:true,live:true,writeSupported:true}];const s=p.screens[0];s.objects=[Object.assign(newObject('text'),{x:30,y:24,text:'HMI NX · servidor ST embebido'}),Object.assign(newObject('status'),{x:40,y:100,binding:'Machine_Running',symbolType:'motor',text:'Motor'}),Object.assign(newObject('value'),{x:200,y:105,text:'Nivel',binding:'Process_Level'}),Object.assign(newObject('tank'),{x:430,y:90,binding:'Process_Level'}),Object.assign(newObject('input'),{x:200,y:190,text:'Consigna',binding:'Process_Setpoint'}),Object.assign(newObject('button'),{x:40,y:270,text:'Marcha SET',binding:'Start_Request',actionMode:'set'})];p.alarms=[{id:id(),name:'Nivel alto',binding:'Process_Level',operator:'gt',value:90,severity:'high'}];p.recipes=[{id:id(),name:'Producción 50',values:{Process_Setpoint:50}}];return p;}
function variableMap(p){return new Map(p.variables.map(v=>[v.name,v]));}
function typedFor(v,value){if(v.type==='BOOL'){if(value===true||value===false)return value;if(String(value).toLowerCase()==='true'||String(value)==='1')return true;if(String(value).toLowerCase()==='false'||String(value)==='0')return false;throw new Error('BOOL inválido');}if(NUMERIC_TYPES.has(v.type)){const n=Number(value);if(!Number.isFinite(n))throw new Error('Número inválido');return n;}return String(value);}
function validate(input){const p=normalize(input),e=[];if(!Number.isInteger(+p.port)||p.port<1024||p.port>65535)e.push('Puerto: use 1024..65535.');if(!Number.isInteger(+p.pollMs)||p.pollMs<100||p.pollMs>5000)e.push('Polling: 100..5000 ms.');if(!Number.isInteger(+p.width)||p.width<320||p.width>3840)e.push('Ancho de diseño: 320..3840 px.');if(!Number.isInteger(+p.height)||p.height<240||p.height>2160)e.push('Alto de diseño: 240..2160 px.');if(p.minDisplayWidth>p.maxDisplayWidth)e.push('El ancho mínimo no puede superar al máximo.');if(p.screens.length>20)e.push('Máximo 20 pantallas en esta versión.');const exposed=p.variables.filter(v=>v.expose&&v.live);if(exposed.length>32)e.push('máximo 32 variables expuestas en esta versión.');const vm=variableMap(p),assetIds=new Set(p.assets.map(a=>a.id)),screenIds=new Set(p.screens.map(s=>s.id));if(p.screenBinding){const screenTag=vm.get(p.screenBinding);if(!screenTag)e.push('Control de pantalla PLC: variable no encontrada.');else if(!INTEGER_TYPES.has(screenTag.type)||!screenTag.live||!screenTag.expose)e.push('Control de pantalla PLC: selecciona una variable entera expuesta (SINT/USINT/INT/UINT/DINT/UDINT/LINT/ULINT).');}const screenNumbers=new Set();let assetTotal=0;for(const a of p.assets){const bytes=dataUrlBytes(a.data);assetTotal+=bytes;if(!/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+\/\s]*={0,2}$/i.test(String(a.data||'')))e.push('Imagen '+(a.name||a.id)+': formato embebido no válido.');if(bytes>IMAGE_MAX_BYTES)e.push('Imagen '+(a.name||a.id)+': supera el límite estricto de 64 KB.');}if(assetTotal>IMAGE_TOTAL_MAX_BYTES)e.push('Imágenes del proyecto: superan el límite total estricto de 256 KB.');for(const v of p.variables){if(v.access==='RW'&&!v.writeSupported)e.push(v.name+': escritura no soportada para '+v.type+(v.type==='STRING'?' (máximo 512 bytes en esta versión)':'')+'.');}
 for(const s of [...p.screens,...(p.baseScreen?[p.baseScreen]:[])]){if(!s.name)e.push('Pantalla sin nombre.');if(s!==p.baseScreen){if(s.useBase&&!p.baseScreen)e.push(s.name+': pantalla base no disponible.');if(!Number.isInteger(s.number)||s.number<1||s.number>MAX_SCREEN_NUMBER)e.push('Número de pantalla no válido (1..'+MAX_SCREEN_NUMBER+'): '+s.name);else if(screenNumbers.has(s.number))e.push('Número de pantalla duplicado: '+s.number);else screenNumbers.add(s.number);}if(!/^#[0-9a-f]{6}$/i.test(s.background))e.push('Color de fondo no válido: '+s.name);for(const o of s.objects){if(o.kind==='text')continue;if(['slider','gauge','stepper','counter'].includes(o.kind)){if(!(Number.isFinite(o.min)&&Number.isFinite(o.max)&&o.max>o.min))e.push(o.text+': rango mínimo/máximo inválido.');if(['slider','stepper'].includes(o.kind)&&(!Number.isFinite(o.step)||o.step<=0))e.push(o.text+': paso inválido.');}if(['selector','multistate','dropdown'].includes(o.kind)){const pairs=o.optionsText.split(/\r?\n/).filter(x=>x.trim());if(!pairs.length||pairs.some(x=>!/^\s*-?\d+\s*=.+$/.test(x)))e.push(o.text+': opciones deben tener formato número=etiqueta.');}if(o.kind==='image'){if(!assetIds.has(o.assetId))e.push(s.name+': selecciona imagen FALSE/OFF para '+o.text);if(o.binding){const iv=vm.get(o.binding);if(!iv)e.push(o.text+': variable BOOL de imagen no válida.');else{if(iv.type!=='BOOL')e.push(o.text+': el cambio de imagen requiere BOOL.');if(!iv.expose)e.push(o.text+': la variable de cambio de imagen debe estar expuesta.');}if(!assetIds.has(o.assetOnId))e.push(s.name+': selecciona imagen TRUE/ON para '+o.text);}continue;}if(o.kind==='button'&&o.actionType==='navigate'){if(!screenIds.has(o.targetScreenId))e.push(o.text+': selecciona pantalla destino.');if(o.feedbackBinding){const fb=vm.get(o.feedbackBinding);if(!fb)e.push(o.text+': variable de feedback no válida.');else{if(fb.type!=='BOOL')e.push(o.text+': feedback requiere BOOL.');if(!fb.expose)e.push(o.text+': variable de feedback debe estar expuesta.');}if(!/^#[0-9a-f]{6}$/i.test(o.feedbackColorOff||'')||!/^#[0-9a-f]{6}$/i.test(o.feedbackColorOn||''))e.push(o.text+': colores de feedback no válidos.');}continue;}const v=vm.get(o.binding);if(!v)e.push(s.name+' / '+o.text+': selecciona variable.');else{if(['button','input','slider','switch','selector','stepper','dropdown'].includes(o.kind)&&v.access!=='RW')e.push(o.text+': requiere variable RW.');if((BOOL_WIDGETS.has(o.kind)||['button','switch'].includes(o.kind))&&v.type!=='BOOL')if(!e.includes(o.text+': requiere BOOL.'))e.push(o.text+': requiere BOOL.');if(['bar','tank','slider','gauge','stepper','counter'].includes(o.kind)&&!NUMERIC_TYPES.has(v.type))e.push(o.text+': requiere tipo numérico.');if(['selector','multistate','dropdown'].includes(o.kind)&&!['INT','UINT','DINT','UDINT','SINT','USINT','LINT','ULINT'].includes(v.type))e.push(o.text+': requiere variable entera.');if(o.kind==='input'&&!(NUMERIC_TYPES.has(v.type)||v.type==='STRING'))e.push(o.text+': requiere tipo numérico o STRING.');}if(o.kind==='status'){if(!STATUS_SYMBOLS.has(o.symbolType))e.push(o.text+': símbolo de estado no válido.');if(!['true','false'].includes(o.stateOnWhen))e.push(o.text+': mapeo ON/OFF no válido.');}if(o.kind==='input'&&v&&NUMERIC_TYPES.has(v.type)){if(o.inputMin!==null&&!Number.isFinite(Number(o.inputMin)))e.push(o.text+': límite inferior no válido.');if(o.inputMax!==null&&!Number.isFinite(Number(o.inputMax)))e.push(o.text+': límite superior no válido.');if(o.inputMin!==null&&o.inputMax!==null&&Number(o.inputMin)>Number(o.inputMax))e.push(o.text+': el límite inferior no puede superar al superior.');}if(o.kind==='button'){if(!['set','reset','toggle'].includes(o.actionMode))e.push(o.text+': modo SET/RESET/TOGGLE no válido.');if(o.feedbackBinding){const fb=vm.get(o.feedbackBinding);if(!fb)e.push(o.text+': variable de feedback no válida.');else{if(fb.type!=='BOOL')e.push(o.text+': feedback requiere BOOL.');if(!fb.expose)e.push(o.text+': variable de feedback debe estar expuesta.');}if(!/^#[0-9a-f]{6}$/i.test(o.feedbackColorOff||'')||!/^#[0-9a-f]{6}$/i.test(o.feedbackColorOn||''))e.push(o.text+': colores de feedback no válidos.');}}if(['value','input','slider','stepper','gauge','counter'].includes(o.kind)&&(o.decimals<0||o.decimals>6))e.push(o.text+': decimales 0..6.');}}
 const alarmIds=new Set();for(const a of p.alarms){if(alarmIds.has(a.id))e.push('ID de alarma duplicado.');alarmIds.add(a.id);const v=vm.get(a.binding);if(!v)e.push('Alarma '+a.name+': variable no válida.');if(!['eq','ne','gt','ge','lt','le'].includes(a.operator))e.push('Alarma '+a.name+': operador no válido.');if(v&&v.type==='STRING'&&!['eq','ne'].includes(a.operator))e.push('Alarma '+a.name+': STRING sólo admite = o ≠.');if(v)try{typedFor(v,a.value)}catch{e.push('Alarma '+a.name+': umbral no válido.');}}
 for(const r of p.recipes){if(!r.name)e.push('Receta sin nombre.');for(const [name,val] of Object.entries(r.values||{})){const v=vm.get(name);if(!v||v.access!=='RW'||!v.writeSupported)e.push('Receta '+r.name+': '+name+' debe ser RW compatible.');else try{typedFor(v,val)}catch{e.push('Receta '+r.name+': valor inválido en '+name);}}}
 return [...new Set(e)];}
root.NXST=Object.assign(root.NXST||{},{LIVE_TYPES,WRITE_TYPES,NUMERIC_TYPES,INTEGER_TYPES,MAX_SCREEN_NUMBER,BOOL_WIDGETS,STATUS_SYMBOLS,STATUS_LABELS,LEGACY_STATUS_KINDS,statusSvg,optionalNumber,IMAGE_MAX_BYTES,IMAGE_TOTAL_MAX_BYTES,HTML_MAX_BYTES,IMAGE_OPTIMIZE_MAX_DIM,dataUrlBytes,id,copy,esc,typeInfo,nameOK,parseDelimited,importSysmac,newProject,newScreen,newBaseScreen,screenObjects,nextScreenNumber,duplicateScreen,newObject,demoProject,normalize,typedFor,validate});
})(globalThis);


(function(root){'use strict';const C=root.NXST;
function htmlEscapeText(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\$/g,'&#36;').replace(/[^\x00-\x7F]/g,c=>'&#'+c.codePointAt(0)+';');}
function asciiJSON(x){return JSON.stringify(x).replace(/</g,'\\u003c').replace(/'/g,'\\u0027').replace(/\$/g,'\\u0024').replace(/[^\x00-\x7F]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));}
function buildRuntimeHTML(input){
 const p=C.normalize(input),vars=p.variables.filter(v=>v.expose&&v.live).map(v=>({id:v.id,name:v.name,type:v.type,access:v.access,stringLength:v.stringLength||255}));
 const screens=p.screens.map(s=>({id:s.id,name:s.name,number:s.number,background:s.background,objects:C.screenObjects(p,s).map(o=>({kind:o.kind,x:o.x,y:o.y,w:o.w,h:o.h,text:o.text,binding:o.binding,assetId:o.assetId||'',assetOnId:o.assetOnId||'',symbolType:o.symbolType||'lamp',stateOnWhen:o.stateOnWhen||'true',actionType:o.actionType||'write',targetScreenId:o.targetScreenId||'',actionMode:o.actionMode||'set',feedbackBinding:o.feedbackBinding||'',feedbackColorOff:o.feedbackColorOff||'#2563eb',feedbackColorOn:o.feedbackColorOn||'#16a34a',decimals:Number.isInteger(Number(o.decimals))?Number(o.decimals):2,inputMin:o.inputMin??null,inputMax:o.inputMax??null,min:o.min,max:o.max,step:o.step,optionsText:o.optionsText,unit:o.unit,target:o.target}))}));
 const assets=p.assets.map(a=>({id:a.id,name:a.name,data:a.data}));
 const alarms=p.alarms.map((a,i)=>({wireId:i+1,id:a.id,name:a.name,binding:a.binding,operator:a.operator,value:a.value,severity:a.severity||'warning'}));
 const recipes=p.recipes.map((r,i)=>({wireId:i+1,id:r.id,name:r.name}));
 const payload=asciiJSON({name:p.name,pollMs:+p.pollMs,screenBinding:p.screenBinding,width:+p.width,height:+p.height,minDisplayWidth:Number(p.minDisplayWidth??480),maxDisplayWidth:Number(p.maxDisplayWidth??1920),vars,screens,assets,alarms,recipes});
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+htmlEscapeText(p.name)+'</title><style>'+runtimeCSS()+'</style></head><body><header><strong>'+htmlEscapeText(p.name)+'</strong><div class="head-actions"><span id="status">Conectando</span></div></header><nav id="nav" aria-label="Navegaci&#243;n HMI"><label for="screenSelect">Pantalla</label><select id="screenSelect" aria-label="Seleccionar pantalla"></select><button type="button" id="alarmOpen" aria-haspopup="dialog" aria-controls="alarmWindow">Alarmas <span id="alarmCount">0</span></button><div id="alarmbar" role="button" tabindex="0" aria-label="Alarmas activas"></div></nav><div id="recipes"></div><main id="viewport"><div id="fit"><div id="stage"></div></div></main><div id="alarmWindow" class="alarm-window" hidden><div class="alarm-card"><div class="alarm-title"><strong>Alarmas</strong><button id="alarmClose">X</button></div><div id="alarmList"></div></div></div><script>const P='+payload+';'+runtimeJS()+'</script></body></html>';
}
function runtimeCSS(){return '*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#111827;font-family:Arial,sans-serif;color:#111}body{overflow-x:hidden}header{height:46px;background:#101828;color:white;display:flex;align-items:center;justify-content:space-between;padding:0 14px}header span{font-size:12px}.head-actions{display:flex;align-items:center;gap:10px}#nav,#recipes{display:flex;gap:8px;align-items:center;padding:8px 12px;background:#1f2937;overflow-x:auto}#nav{overflow-x:visible;flex-wrap:nowrap}#nav label{font-size:13px;color:#e5e7eb;white-space:nowrap}#screenSelect{min-width:180px;max-width:min(55vw,360px);height:38px;border:1px solid #64748b;border-radius:6px;padding:5px 10px;background:#374151;color:#fff;font-size:14px;cursor:pointer}#nav button,#recipes button{border:0;border-radius:6px;padding:7px 11px;min-height:38px;background:#374151;color:white;white-space:nowrap;cursor:pointer}#nav button.active{background:#b91c1c}#nav button:disabled,#stage .button .in:disabled{opacity:.55;cursor:not-allowed}@media(max-width:520px){#nav{gap:6px;padding:8px}#screenSelect{min-width:0;max-width:none;flex:0 1 150px;width:120px}#nav button{flex-shrink:0}#alarmbar{padding:0 8px;font-size:11px}}#recipes{background:#0f172a}#recipes:empty{display:none}#alarmbar{height:38px;min-width:0;flex:1 1 auto;display:flex;align-items:center;padding:0 12px;border-radius:6px;background:#7f1d1d;color:white;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;visibility:hidden}#alarmbar.show{visibility:visible;cursor:pointer}.alarm-window{position:fixed;inset:0;background:#0008;z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:64px 14px 14px}.alarm-window[hidden]{display:none}.alarm-card{width:min(760px,96vw);max-height:75vh;overflow:auto;background:white;border-radius:10px;box-shadow:0 20px 50px #0006}.alarm-title{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#111827;color:white;z-index:1}.alarm-title button{border:0;border-radius:5px;background:#374151;color:white;padding:5px 9px}.alarm-row{display:grid;grid-template-columns:82px 1fr minmax(180px,1fr);gap:8px;padding:10px 12px;border-bottom:1px solid #e5e7eb;align-items:center}.alarm-row.active{background:#fef2f2}.alarm-state{font-weight:bold}.alarm-state.on{color:#b91c1c}.alarm-cond{font-size:12px;color:#64748b}#viewport{width:100%;overflow-x:auto;overflow-y:hidden}#fit{position:relative;margin:0 auto}#stage{position:absolute;left:0;top:0;background:#f8fafc;transform-origin:top left}.o{position:absolute;overflow:hidden}.in{width:100%;height:100%;display:flex;align-items:center;justify-content:center}.text .in{justify-content:flex-start;text-align:left}.lamp .in{border-radius:50%;background:#94a3b8;border:3px solid #334155}.lamp.on .in{background:#22c55e}.value .in,.input .in{background:white;border:1px solid #94a3b8;border-radius:5px}.input .in{gap:5px;padding:5px}.input input{min-width:0;width:100%;height:100%;border:0;font-size:18px}.input input[type="number"]{-moz-appearance:textfield;appearance:textfield}.input input[type="number"]::-webkit-outer-spin-button,.input input[type="number"]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}@keyframes input-dirty-blink{0%,100%{background:#fff7cc}50%{background:#facc15}}.input button,.button .in{background:#2563eb;color:white;border:0;border-radius:6px}.button .in{font-weight:bold}.bar .track{width:100%;height:100%;background:#e5e7eb}.bar .fill{height:100%;background:#16a34a;width:0}.label{font-size:11px;color:#64748b;position:absolute;top:1px;left:4px}.image img{width:100%;height:100%;object-fit:contain}.status .status-visual{height:78%;width:100%;display:flex;align-items:center;justify-content:center}.status .status-visual svg{width:90%;height:90%;display:block}.status .caption{position:absolute;left:0;right:0;bottom:1px;text-align:center;font-size:11px}.industrial .symbol{width:70%;height:70%;position:relative;border:4px solid #475569;background:#cbd5e1}.tank .symbol{height:85%;width:70%;border-radius:0 0 18px 18px;overflow:hidden;background:#e2e8f0}.tank .level{position:absolute;left:0;right:0;bottom:0;height:0;background:#38bdf8}.industrial .caption{position:absolute;left:0;right:0;bottom:1px;text-align:center;font-size:11px}.comm-stale .status,.comm-stale .value,.comm-stale .bar,.comm-stale .tank,.comm-stale .image{opacity:.58}.write-pending .in{outline:2px solid #f59e0b;outline-offset:-2px}.write-error .in{outline:2px solid #dc2626;outline-offset:-2px}.input.input-dirty input{animation:input-dirty-blink .85s ease-in-out infinite}.input.write-pending input{animation:none;background:#fffbeb}.input.write-error input{animation:none;background:#fef2f2}.input.input-limit-error .in{outline:2px solid #dc2626;outline-offset:-2px}#stage .control-panel{display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:5px;width:100%;height:100%;padding:7px;background:#fff;border:1px solid #94a3b8;border-radius:6px;font-size:14px}#stage .control-panel input[type=range]{width:100%;accent-color:#2563eb}#stage .control-panel .controls{display:flex;align-items:center;justify-content:center;gap:8px}#stage .control-panel .controls button{flex:0 0 36px;height:34px;border:0;border-radius:5px;background:#2563eb;color:#fff}#stage .control-panel select{width:100%;height:35px;border:1px solid #94a3b8;background:#fff}#stage .control-panel .reading{font-size:20px;font-weight:700;text-align:center}#stage .control-panel .limits{display:flex;justify-content:space-between;font-size:11px;color:#64748b}#stage .control-panel .switch-button{height:37px;border:0;border-radius:18px;background:#64748b;color:white;font-weight:700}#stage .control-panel .switch-button.on{background:#16a34a}#stage .control-panel .gauge-track{height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden}#stage .control-panel .gauge-ring{width:min(100%,115px);aspect-ratio:1;border-radius:50%;background:conic-gradient(#16a34a var(--pct,0%),#e2e8f0 0);margin:0 auto;display:flex;align-items:center;justify-content:center}#stage .control-panel .gauge-ring .reading{width:75%;height:75%;display:flex;align-items:center;justify-content:center;background:white;border-radius:50%;font-size:18px}#stage .control-panel .gauge-fill{height:100%;background:#16a34a;width:0}#stage .control-panel .caption{font-size:11px;text-align:center;color:#475569}#stage .control-panel button:disabled,#stage .control-panel select:disabled,#stage .control-panel input:disabled{opacity:.55;cursor:not-allowed}.input.input-limit-error input{animation:none;background:#fef2f2}#status.comm-online{color:#86efac}#status.comm-degraded,#status.comm-reconnecting{color:#fde68a}#status.comm-offline{color:#fca5a5}';}
function runtimeJS(){return `
const vals={},alarmVals={},pendingWrites=new Map();
const byName=Object.fromEntries(P.vars.map(v=>[v.name,v])),assets=Object.fromEntries(P.assets.map(a=>[a.id,a.data]));
const viewport=document.getElementById("viewport"),fit=document.getElementById("fit"),stage=document.getElementById("stage"),screenSelect=document.getElementById("screenSelect"),alarmbar=document.getElementById("alarmbar"),recipes=document.getElementById("recipes"),alarmOpen=document.getElementById("alarmOpen"),alarmCount=document.getElementById("alarmCount"),alarmWindow=document.getElementById("alarmWindow"),alarmClose=document.getElementById("alarmClose"),alarmList=document.getElementById("alarmList"),statusEl=document.getElementById("status");
let nodes=[],screenIndex=0,pendingRecipe=null;
const comm={busy:false,failures:0,lastGoodAt:0,state:"RECONNECTING",timer:null,forceRead:false,lastSeq:null};
const READ_TIMEOUT=Math.max(1200,Math.min(5000,(Number(P.pollMs)||500)*3)),WRITE_TTL=5000,MAX_WRITE_ATTEMPTS=3;
const SNAP_KEY="hminx:runtime:v2:"+String(P.name||"HMI");
// When assigned, PLC navigation is authoritative; stale snapshots never change the screen.
screenSelect.disabled=Boolean(P.screenBinding);
if(P.screenBinding)screenSelect.title="Pantalla controlada por PLC: "+P.screenBinding;
stage.style.width=P.width+"px";stage.style.height=P.height+"px";

function E(t,c){const e=document.createElement(t);if(c)e.className=c;return e}
function boolValue(v){return v===true||v===1||v==="1"||v==="TRUE"}
function statusSvg(type,on){const fill=on?"#86efac":"#e2e8f0",stroke=on?"#15803d":"#475569",accent=on?"#22c55e":"#94a3b8",common='viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';if(type==="lamp")return '<svg '+common+'><circle cx="50" cy="38" r="23" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/>'+(on?'<path d="M50 5v9M50 62v10M17 38H7M93 38H83M27 15l6 7M73 15l-6 7" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/>':'')+'</svg>';if(type==="motor")return '<svg '+common+'><circle cx="42" cy="39" r="25" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><text x="42" y="48" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" font-weight="700" fill="'+stroke+'">M</text><path d="M67 39h20" stroke="'+stroke+'" stroke-width="6" stroke-linecap="round"/>'+(on?'<path d="M24 13c8-7 27-8 37 1" fill="none" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/><path d="M58 8l7 7-10 2" fill="'+accent+'"/>':'')+'</svg>';if(type==="pump")return '<svg '+common+'><circle cx="38" cy="40" r="25" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><path d="M38 23l17 17-17 17z" fill="'+accent+'" stroke="'+stroke+'" stroke-width="3"/><path d="M63 40h26v-17" fill="none" stroke="'+stroke+'" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'+(on?'<path d="M72 14h17" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/><path d="M89 14l-8-5v10z" fill="'+accent+'"/>':'')+'</svg>';if(type==="valve")return '<svg '+common+'><path d="M8 40h18M74 40h18" stroke="'+stroke+'" stroke-width="6" stroke-linecap="round"/><path d="M25 20l25 20-25 20zM75 20L50 40l25 20z" fill="'+fill+'" stroke="'+stroke+'" stroke-width="4" stroke-linejoin="round"/><path d="M50 40V12M38 12h24" stroke="'+stroke+'" stroke-width="5" stroke-linecap="round"/>'+(on?'<circle cx="50" cy="40" r="8" fill="'+accent+'"/><path d="M35 68h30" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/>':'<path d="M43 33l14 14M57 33L43 47" stroke="#64748b" stroke-width="4" stroke-linecap="round"/>')+'</svg>';if(type==="conveyor")return '<svg '+common+'><rect x="8" y="25" width="84" height="30" rx="14" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><circle cx="24" cy="40" r="7" fill="white" stroke="'+stroke+'" stroke-width="3"/><circle cx="50" cy="40" r="7" fill="white" stroke="'+stroke+'" stroke-width="3"/><circle cx="76" cy="40" r="7" fill="white" stroke="'+stroke+'" stroke-width="3"/>'+(on?'<path d="M30 15h38" stroke="'+accent+'" stroke-width="5" stroke-linecap="round"/><path d="M68 15l-10-7v14z" fill="'+accent+'"/>':'<path d="M45 11v9M55 11v9" stroke="#64748b" stroke-width="5" stroke-linecap="round"/>')+'</svg>';return '<svg '+common+'><rect x="10" y="20" width="40" height="38" rx="6" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><circle cx="43" cy="39" r="6" fill="'+accent+'" stroke="'+stroke+'" stroke-width="3"/><path d="M10 30H3M10 48H3" stroke="'+stroke+'" stroke-width="4" stroke-linecap="round"/>'+(on?'<path d="M56 29l34-10M56 39h36M56 49l34 10" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/>':'<path d="M57 39h18" stroke="#94a3b8" stroke-width="3" stroke-dasharray="5 5"/>')+'</svg>'}
function fmt(o,v,empty=""){if(v===undefined||v===null||v==="")return empty;const tag=byName[o.binding];if(tag&&(tag.type==="REAL"||tag.type==="LREAL")){const n=Number(v),d=Math.max(0,Math.min(6,Number.isFinite(Number(o.decimals))?Number(o.decimals):2));return Number.isFinite(n)?n.toFixed(d):String(v)}return String(v)}
function fitStage(){const available=Math.max(1,viewport.clientWidth||window.innerWidth||P.width),minW=Math.max(320,Number(P.minDisplayWidth)||480),maxW=Math.max(minW,Number(P.maxDisplayWidth)||1920),target=Math.max(minW,Math.min(maxW,available)),scale=target/P.width;fit.style.width=target+"px";fit.style.height=(P.height*scale)+"px";stage.style.transform="scale("+scale+")"}
if(typeof ResizeObserver!=="undefined")new ResizeObserver(fitStage).observe(viewport);else window.addEventListener("resize",fitStage);
window.addEventListener("orientationchange",fitStage);

function makeStatus(o){const type=o.symbolType||"lamp",n=E("div","o status "+type),s=E("div","status-visual"),cap=E("div","caption");s.innerHTML=statusSvg(type,false);cap.textContent=o.text||"Estado";n.append(s,cap);n.statusVisual=s;n.visualOn=false;return n}
function makeTank(o){const n=E("div","o industrial tank"),s=E("div","symbol"),cap=E("div","caption"),l=E("div","level");cap.textContent=o.text||"Deposito";s.append(l);n.append(s,cap);n.level=l;return n}
function optionsFor(o){return String(o.optionsText||'').split(/\\r?\\n/).map(x=>{const i=x.indexOf('=');return i<0?null:{value:x.slice(0,i).trim(),label:x.slice(i+1).split("|")[0].trim(),color:/^#[0-9a-fA-F]{6}$/.test(x.split("|")[1]||"")?x.split("|")[1]:""}}).filter(x=>x&&/^-?\\d+$/.test(x.value)&&x.label)}
function controlRange(o,v){const a=Number(o.min),b=Number(o.max);return Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a))}
function makeNode(o){let n;if(o.kind==="status")n=makeStatus(o);else if(o.kind==="tank")n=makeTank(o);else{n=E("div","o "+o.kind);if(o.kind==="text"){const x=E("div","in");x.textContent=o.text;n.append(x)}else if(o.kind==="bar"){const t=E("div","track"),f=E("div","fill");t.append(f);n.append(t);n.fill=f}else if(o.kind==="image"){const img=E("img"),key=o.assetId||"";img.src=assets[key]||"";img.alt=o.text||"";n.append(img);n.image=img;n.imageKey=key}else if(["slider","switch","selector","multistate","gauge","stepper","counter","dropdown"].includes(o.kind)){const panel=E("div","control-panel"),title=E("div","caption");title.textContent=o.text||o.kind;panel.append(title);n.control={};const c=n.control;if(o.kind==="slider"){const reading=E("div","reading"),input=E("input"),limits=E("div","limits");input.type="range";input.min=o.min;input.max=o.max;input.step=o.step;limits.innerHTML="<span>"+o.min+"</span><span>"+o.max+"</span>";input.oninput=()=>{reading.textContent=input.value+(o.unit?" "+o.unit:"")};input.onchange=()=>{write(o.binding,input.value,{min:o.min,max:o.max,node:n})};panel.append(reading,input,limits);Object.assign(c,{reading,input})}else if(o.kind==="switch"){const button=E("button","switch-button");button.onclick=()=>write(o.binding,boolValue(vals[o.binding])?"0":"1",{node:n});panel.append(button);c.button=button}else if(["selector","dropdown"].includes(o.kind)){const input=E("select");for(const option of optionsFor(o)){const el=E("option");el.value=option.value;el.textContent=option.label;input.append(el)}input.onchange=()=>write(o.binding,input.value,{node:n});panel.append(input);c.input=input}else if(o.kind==="multistate"){const reading=E("div","reading");panel.append(reading);c.reading=reading}else if(o.kind==="stepper"){const ctr=E("div","controls"),minus=E("button"),reading=E("div","reading"),plus=E("button");minus.textContent="-";plus.textContent="+";const move=delta=>write(o.binding,String(Math.max(Number(o.min),Math.min(Number(o.max),Number(vals[o.binding]??o.min)+delta*Number(o.step)))),{min:o.min,max:o.max,node:n});minus.onclick=()=>move(-1);plus.onclick=()=>move(1);ctr.append(minus,reading,plus);panel.append(ctr);Object.assign(c,{minus,plus,reading})}else if(o.kind==="gauge"){const reading=E("div","reading"),ring=E("div","gauge-ring"),limits=E("div","limits");ring.append(reading);limits.innerHTML="<span>"+o.min+"</span><span>"+o.max+"</span>";panel.append(ring,limits);Object.assign(c,{reading,ring})}else if(o.kind==="counter"){const reading=E("div","reading"),target=E("div","caption"),progress=E("div","gauge-fill"),track=E("div","gauge-track");track.append(progress);target.textContent="Objetivo: "+o.target;panel.append(reading,target,track);Object.assign(c,{reading,target,progress})}n.append(panel)}else if(o.kind==="input"){const x=E("div","in"),i=E("input"),b=E("button"),tag=byName[o.binding];if(tag&&tag.type==="STRING"){i.type="text";i.maxLength=Math.min(512,Number(tag.stringLength)||255)}else{i.type="number";i.inputMode="decimal";i.step=tag&&(tag.type==="REAL"||tag.type==="LREAL")?"any":"1";if(o.inputMin!==null)i.min=String(o.inputMin);if(o.inputMax!==null)i.max=String(o.inputMax)}b.textContent="Aplicar";n.inputDirty=false;const send=()=>{if(write(o.binding,i.value,{min:o.inputMin,max:o.inputMax,node:n})){n.inputDirty=false;paint()}};b.onclick=send;i.addEventListener("input",()=>{n.inputDirty=true;n.inputError="";paint()});i.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();send()}});x.append(i,b);n.append(x);n.entry=i}else if(o.kind==="button"){const b=E("button","in");b.textContent=o.text;b.style.backgroundColor=o.feedbackBinding?(o.feedbackColorOff||"#2563eb"):"#2563eb";if((o.actionType||"write")==="navigate"&&P.screenBinding){b.disabled=true;b.title="Navegacion controlada por PLC: "+P.screenBinding;}b.onclick=()=>{if((o.actionType||"write")==="navigate"){showScreenById(o.targetScreenId);return}const mode=o.actionMode||"set",next=mode==="reset"?false:mode==="toggle"?!boolValue(vals[o.binding]):true;write(o.binding,next?"1":"0")};n.append(b);n.button=b}else n.append(E("div","in"));if(o.kind!=="text"&&o.kind!=="button"&&o.kind!=="image"){const l=E("span","label");l.textContent=o.text;n.append(l)}}Object.assign(n.style,{left:o.x+"px",top:o.y+"px",width:o.w+"px",height:o.h+"px"});return n}

function showScreen(i){screenIndex=Math.max(0,Math.min(P.screens.length-1,i));stage.style.backgroundColor=P.screens[screenIndex].background||'#ffffff';stage.replaceChildren();nodes=[];for(const o of P.screens[screenIndex].objects){const n=makeNode(o);stage.append(n);nodes.push([n,o])}screenSelect.value=String(screenIndex);paint();fitStage()}
function showScreenById(id){if(P.screenBinding)return;const i=P.screens.findIndex(s=>s.id===id);if(i>=0)showScreen(i)}
for(const [i,s] of P.screens.entries()){const option=E("option");option.value=String(i);option.textContent=s.name;screenSelect.append(option)}
screenSelect.onchange=()=>showScreen(P.screenBinding?screenIndex:Number(screenSelect.value));
for(const r of P.recipes){const b=E("button");b.textContent="Receta: "+r.name;b.onclick=()=>applyRecipe(r.wireId);recipes.append(b)}
alarmOpen.onclick=()=>{alarmWindow.hidden=false;paintAlarms()};alarmClose.onclick=()=>alarmWindow.hidden=true;alarmWindow.onclick=e=>{if(e.target===alarmWindow)alarmWindow.hidden=true};alarmbar.onclick=()=>{alarmWindow.hidden=false;paintAlarms()};alarmbar.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();alarmWindow.hidden=false;paintAlarms()}};

function dataAge(){return comm.lastGoodAt?Math.max(0,Math.floor((Date.now()-comm.lastGoodAt)/1000)):null}
function updateCommStatus(){const stale=comm.state!=="ONLINE",age=dataAge();stage.classList.toggle("comm-stale",stale);statusEl.className="comm-"+comm.state.toLowerCase();let txt=comm.state;if(age!==null&&stale)txt+=" | datos "+age+"s";statusEl.textContent=txt}
function setComm(state){comm.state=state;updateCommStatus()}
function schedule(delay){if(comm.timer)clearTimeout(comm.timer);comm.timer=setTimeout(commCycle,Math.max(0,delay));updateCommStatus()}
function backoff(){const a=[300,500,1000,2000,5000];return a[Math.min(a.length-1,Math.max(0,comm.failures-1))]}
async function fetchTimed(url,opt,timeout){const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),timeout||READ_TIMEOUT);try{return await fetch(url,Object.assign({},opt||{},{signal:ac.signal,cache:"no-store"}))}finally{clearTimeout(timer)}}
function failComm(){comm.failures+=1;setComm(comm.failures>=3?"OFFLINE":"DEGRADED")}

function parseSnapshot(text){let seq=null,end=null;const nextVals={},nextAlarms={};for(const line of String(text||"").split(/\\r?\\n/)){if(!line)continue;const k=line.indexOf("=");if(k<1)continue;const key=line.slice(0,k),raw=line.slice(k+1);if(key==="SEQ"){seq=raw;continue}if(key==="END"){end=raw;continue}if(key[0]==="A"){const id=Number(key.slice(1));if(Number.isInteger(id))nextAlarms[id]=raw==="1";continue}const id=Number(key),tag=P.vars.find(v=>v.id===id);if(!tag)continue;let value=raw;if(tag.type==="BOOL")value=raw==="1"||raw==="TRUE";else if(tag.type!=="STRING"){value=Number(raw);if(!Number.isFinite(value))throw Error("snapshot numerico invalido")}nextVals[tag.name]=value}if(seq===null||end===null||seq!==end)throw Error("snapshot incompleto");for(const tag of P.vars)if(!Object.prototype.hasOwnProperty.call(nextVals,tag.name))throw Error("tag ausente "+tag.id);for(const a of P.alarms)if(!Object.prototype.hasOwnProperty.call(nextAlarms,a.wireId))throw Error("alarma ausente "+a.wireId);return{seq,vals:nextVals,alarms:nextAlarms}}

function saveGoodSnapshot(){try{localStorage.setItem(SNAP_KEY,JSON.stringify({at:comm.lastGoodAt,seq:comm.lastSeq,vals,alarms:alarmVals}))}catch{}}
function loadCachedSnapshot(){try{const s=JSON.parse(localStorage.getItem(SNAP_KEY)||"null");if(!s||!s.vals)return;for(const tag of P.vars)if(Object.prototype.hasOwnProperty.call(s.vals,tag.name))vals[tag.name]=s.vals[tag.name];for(const a of P.alarms)if(s.alarms&&Object.prototype.hasOwnProperty.call(s.alarms,a.wireId))alarmVals[a.wireId]=Boolean(s.alarms[a.wireId]);comm.lastGoodAt=Number(s.at)||0;comm.lastSeq=s.seq||null;setComm("RECONNECTING")}catch{}}

function sameValue(tag,actual,raw){if(tag.type==="BOOL")return boolValue(actual)===boolValue(raw);if(tag.type==="STRING")return String(actual??"")===String(raw);const a=Number(actual),b=Number(raw);if(!Number.isFinite(a)||!Number.isFinite(b))return false;if(tag.type==="REAL"||tag.type==="LREAL")return Math.abs(a-b)<=Math.max(1e-6,Math.abs(b)*1e-6);return a===b}
function expireWrites(){const now=Date.now();for(const item of pendingWrites.values())if(item.state!=="error"&&now>item.expires){item.state="error";item.error="No confirmado antes de caducar"}}
function confirmWrites(){for(const [name,item] of [...pendingWrites]){const tag=byName[name];if(tag&&sameValue(tag,vals[name],item.raw))pendingWrites.delete(name)}expireWrites()}
function dueWrite(){const now=Date.now();for(const item of pendingWrites.values())if((item.state==="queued"||item.state==="retry")&&item.due<=now&&now<=item.expires)return item;return null}
function nextWriteDue(){let due=Infinity;for(const item of pendingWrites.values())if((item.state==="queued"||item.state==="retry")&&item.due<due)due=item.due;return due}

function paintAlarms(){const active=P.alarms.filter(a=>alarmVals[a.wireId]);alarmCount.textContent=String(active.length);alarmOpen.classList.toggle("active",active.length>0);if(!active.length){alarmbar.classList.remove("show");alarmbar.textContent=""}else{alarmbar.classList.add("show");alarmbar.textContent=active.map(a=>"["+String(a.severity).toUpperCase()+"] "+a.name).join(" | ")+(comm.state!=="ONLINE"?" | DATOS STALE":"")}const order={high:3,warning:2,info:1};const list=[...P.alarms].sort((a,b)=>{const d=Number(Boolean(alarmVals[b.wireId]))-Number(Boolean(alarmVals[a.wireId]));return d||((order[b.severity]||0)-(order[a.severity]||0))});alarmList.replaceChildren();for(const a of list){const row=E("div","alarm-row"+(alarmVals[a.wireId]?" active":"")),state=E("span","alarm-state"+(alarmVals[a.wireId]?" on":"")),name=E("strong"),cond=E("span","alarm-cond");state.textContent=alarmVals[a.wireId]?"ACTIVA":"Normal";name.textContent="["+String(a.severity).toUpperCase()+"] "+a.name;const ops={eq:"=",ne:"!=",gt:">",ge:">=",lt:"<",le:"<="};cond.textContent=a.binding+" "+(ops[a.operator]||a.operator)+" "+String(a.value);row.append(state,name,cond);alarmList.append(row)}}

function paint(){expireWrites();for(const [n,o] of nodes){const v=vals[o.binding],pending=o.binding?pendingWrites.get(o.binding):null;n.classList.toggle("write-pending",Boolean(pending&&pending.state!=="error"));n.classList.toggle("write-error",Boolean(pending&&pending.state==="error"));n.classList.toggle("input-limit-error",Boolean(n.inputError));n.classList.toggle("input-dirty",Boolean(n.inputDirty));if(n.inputError)n.title=n.inputError;else if(pending)n.title=pending.state==="error"?(pending.error||"Escritura no confirmada"):"Escritura pendiente de confirmar";else n.removeAttribute("title");if(o.kind==="status"){const visualOn=boolValue(v)===(o.stateOnWhen!=="false");if(n.statusVisual&&visualOn!==n.visualOn){n.statusVisual.innerHTML=statusSvg(o.symbolType||"lamp",visualOn);n.visualOn=visualOn}}else if(o.kind==="value")n.querySelector(".in").textContent=fmt(o,v,"--");else if(o.kind==="bar"){const q=Math.max(0,Math.min(100,100*(Number(v)-o.min)/(o.max-o.min||1)));n.fill.style.width=q+"%"}else if(o.kind==="tank"){const q=Math.max(0,Math.min(100,100*(Number(v)-o.min)/(o.max-o.min||1)));n.level.style.height=q+"%"}else if(n.control){const c=n.control,num=Number(v),valid=Number.isFinite(num),display=fmt(o,v,"--")+(o.unit?" "+o.unit:"");if(c.reading)c.reading.textContent=display;if(o.kind==="slider"){if(!c.input.matches(":active"))c.input.value=controlRange(o,v);c.input.disabled=comm.state!=="ONLINE"||Boolean(pending)}if(o.kind==="switch"){c.button.classList.toggle("on",boolValue(v));c.button.textContent=boolValue(v)?"ON":"OFF";c.button.disabled=comm.state!=="ONLINE"||Boolean(pending)}if(["selector","dropdown"].includes(o.kind)){if(!c.input.matches(":focus"))c.input.value=String(v??"");c.input.disabled=comm.state!=="ONLINE"||Boolean(pending)}if(o.kind==="multistate"){const opt=optionsFor(o).find(x=>x.value===String(v));c.reading.textContent=opt?opt.label:"Estado: "+String(v??"--");c.reading.style.color=opt&&opt.color||"#182230"}if(o.kind==="counter"){c.progress.style.width=(valid&&o.target>0?Math.max(0,Math.min(100,100*num/o.target)):0)+"%";c.target.textContent="Objetivo: "+o.target+" ("+(valid&&o.target>0?Math.round(100*num/o.target):0)+"%)"}if(o.kind==="gauge")c.ring.style.setProperty("--pct",(valid?100*(controlRange(o,num)-o.min)/(o.max-o.min||1):0)+"%");if(o.kind==="stepper"){c.minus.disabled=c.plus.disabled=comm.state!=="ONLINE"||Boolean(pending);c.minus.disabled||=(num<=o.min);c.plus.disabled||=(num>=o.max)}}else if(o.kind==="input"){if(pending)n.entry.value=pending.raw;else if(!n.inputDirty&&document.activeElement!==n.entry)n.entry.value=fmt(o,v,"")}else if(o.kind==="image"&&n.image&&o.binding){const key=boolValue(v)?(o.assetOnId||o.assetId):o.assetId;if(key!==n.imageKey){n.image.src=assets[key]||"";n.imageKey=key}}else if(o.kind==="button"&&n.button&&o.feedbackBinding){n.button.style.backgroundColor=boolValue(vals[o.feedbackBinding])?(o.feedbackColorOn||"#16a34a"):(o.feedbackColorOff||"#2563eb")}}paintAlarms();updateCommStatus()}

async function readSnapshot(){const r=await fetchTimed("/api/read",{},READ_TIMEOUT);if(!r.ok)throw Error("HTTP "+r.status);const snap=parseSnapshot(await r.text());for(const k of Object.keys(vals))delete vals[k];Object.assign(vals,snap.vals);for(const k of Object.keys(alarmVals))delete alarmVals[k];Object.assign(alarmVals,snap.alarms);comm.lastSeq=snap.seq;comm.lastGoodAt=Date.now();comm.failures=0;setComm("ONLINE");confirmWrites();saveGoodSnapshot();if(P.screenBinding){const requested=Number(vals[P.screenBinding]),match=Number.isSafeInteger(requested)?P.screens.findIndex(s=>s.number===requested):-1,next=match<0?0:match;if(next!==screenIndex){showScreen(next);return;}}paint()}
async function sendWrite(item){const tag=byName[item.name];if(!tag){item.state="error";item.error="Variable no disponible";return}if(Date.now()>item.expires){item.state="error";item.error="Escritura caducada";return}item.attempts+=1;item.state="sending";paint();try{const r=await fetchTimed("/api/write?id="+tag.id,{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:item.raw},READ_TIMEOUT);if(!r.ok){item.state="error";item.error="HTTP "+r.status;return}item.state="sent";comm.forceRead=true}catch(e){if(item.attempts<MAX_WRITE_ATTEMPTS&&Date.now()<item.expires){item.state="retry";item.due=Date.now()+[300,700][Math.min(1,item.attempts-1)];item.error="Reintentando"}else{item.state="error";item.error="Escritura no confirmada"}comm.forceRead=true;failComm()}paint()}
async function sendRecipe(item){try{const r=await fetchTimed("/api/recipe?id="+item.id,{method:"POST"},READ_TIMEOUT);if(!r.ok)throw Error("HTTP "+r.status);pendingRecipe=null;comm.forceRead=true;statusEl.textContent="RECETA ENVIADA | confirmando"}catch(e){pendingRecipe=null;failComm();statusEl.textContent="ERROR RECETA | no reintentada"}}

async function commCycle(){if(comm.busy)return;comm.busy=true;let delay=Number(P.pollMs)||500;try{expireWrites();const w=dueWrite();if(w){await sendWrite(w);delay=comm.forceRead?50:Math.max(50,nextWriteDue()-Date.now())}else if(pendingRecipe){await sendRecipe(pendingRecipe);delay=50}else{if(comm.failures>=3)setComm("RECONNECTING");await readSnapshot();delay=Number(P.pollMs)||500}}catch(e){failComm();paint();delay=backoff()}finally{comm.busy=false;if(comm.forceRead){comm.forceRead=false;delay=50}else{const d=nextWriteDue();if(Number.isFinite(d))delay=Math.min(delay,Math.max(50,d-Date.now()))}schedule(delay)}}

function write(name,value,opt){const tag=byName[name];if(!tag||tag.access!=="RW")return false;const node=opt&&opt.node;try{const raw=String(value);if(tag.type!=="BOOL"&&tag.type!=="STRING"&&!/^-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?$/.test(raw))throw Error("Valor numerico no valido");if(tag.type==="STRING"&&new TextEncoder().encode(raw).length>Math.min(512,Number(tag.stringLength)||255))throw Error("STRING supera longitud permitida");if(tag.type!=="BOOL"&&tag.type!=="STRING"){const num=Number(raw),min=opt&&opt.min!==null&&opt.min!==undefined?Number(opt.min):null,max=opt&&opt.max!==null&&opt.max!==undefined?Number(opt.max):null;if(min!==null&&num<min)throw Error("Valor menor que limite inferior ("+min+")");if(max!==null&&num>max)throw Error("Valor mayor que limite superior ("+max+")")}if(node)node.inputError="";pendingWrites.set(name,{name,raw,attempts:0,state:"queued",due:Date.now(),expires:Date.now()+WRITE_TTL,error:""});paint();schedule(0);return true}catch(e){if(node)node.inputError=e.message;paint();statusEl.textContent="ESCRITURA RECHAZADA | "+e.message;return false}}
function applyRecipe(id){if(pendingRecipe){statusEl.textContent="RECETA PENDIENTE";return}pendingRecipe={id,at:Date.now()};schedule(0)}

function startComm(){loadCachedSnapshot();showScreen(0);fitStage();paint();schedule(0)}
startComm();
`;}
C.buildRuntimeHTML=buildRuntimeHTML;
})(globalThis);

(function(root){'use strict';const C=root.NXST,enc=new TextEncoder();
function stLiteral(s){return String(s).replace(/\$/g,()=> '$$').replace(/'/g,()=> "$'").replace(/\r/g,()=> '$r').replace(/\n/g,()=> '$n');}
function chunks(text,max=1400){const out=[];for(let i=0;i<text.length;i+=max)out.push(text.slice(i,i+max));return out;}
function toStringExpr(v){if(v.type==='BOOL')return null;if(v.type==='STRING')return v.name;return v.type+'_TO_STRING('+v.name+')';}
function fromStringExpr(v){if(v.type==='BOOL')return null;if(v.type==='STRING')return 'Web_ValueText';return 'STRING_TO_'+v.type+'(Web_ValueText)';}
function stTyped(v,value){if(v.type==='BOOL')return (value===true||String(value)==='1'||String(value).toLowerCase()==='true')?'TRUE':'FALSE';if(v.type==='STRING')return "'"+stLiteral(String(value))+"'";if(v.type==='REAL'||v.type==='LREAL'){const n=Number(value);return v.type+'#'+(Number.isInteger(n)?n.toFixed(1):String(n));}if(C.NUMERIC_TYPES.has(v.type))return v.type+'#'+String(Math.trunc(Number(value)));throw new Error('Tipo no escribible: '+v.type);}
function alarmExpr(v,a){const op={eq:'=',ne:'<>',gt:'>',ge:'>=',lt:'<',le:'<='}[a.operator]||'=';return '('+v.name+' '+op+' '+stTyped(v,a.value)+')';}
function buildST(input){
 const p=C.normalize(input),html=C.buildRuntimeHTML(p),parts=chunks(html),exposed=p.variables.filter(v=>v.expose&&v.live),rw=exposed.filter(v=>v.access==='RW'&&v.writeSupported),vm=new Map(p.variables.map(v=>[v.name,v]));
 const read=[];for(const v of exposed){if(v.type==='BOOL'){read.push(`IF ${v.name} THEN\n    Web_ApiBody := CONCAT(Web_ApiBody, '${v.id}=1$n');\nELSE\n    Web_ApiBody := CONCAT(Web_ApiBody, '${v.id}=0$n');\nEND_IF;`);}else{read.push(`Web_ApiBody := CONCAT(Web_ApiBody, '${v.id}=', ${toStringExpr(v)}, '$n');`);}}
 for(const [i,a] of p.alarms.entries()){const v=vm.get(a.binding);if(!v)continue;read.push(`IF ${alarmExpr(v,a)} THEN\n    Web_ApiBody := CONCAT(Web_ApiBody, 'A${i+1}=1$n');\nELSE\n    Web_ApiBody := CONCAT(Web_ApiBody, 'A${i+1}=0$n');\nEND_IF;`);}
 const writes=rw.map(v=>{if(v.type==='BOOL')return `${v.id}:\n                ${v.name} := (Web_ValueText = '1') OR (Web_ValueText = 'TRUE') OR (Web_ValueText = 'true');\n                Web_Found := TRUE;`;return `${v.id}:\n                ${v.name} := ${fromStringExpr(v)};\n                Web_Found := TRUE;`;}).join('\n            ');
 const recipeCases=p.recipes.map((r,i)=>{const assigns=[];for(const [name,value] of Object.entries(r.values||{})){const v=vm.get(name);if(v&&v.access==='RW'&&v.writeSupported)assigns.push(`${v.name} := ${stTyped(v,value)};`);}return `${i+1}:\n                ${assigns.join('\n                ')||';'}\n                Web_Found := TRUE;`;}).join('\n            ');
 const chunkCases=parts.map((c,i)=>`${i}: Web_TxText := '${stLiteral(c)}';`).join('\n            ');
 return `(* HMI NX ST · servidor WebHMI generado
   Proyecto: ${p.name}
   Puerto: ${p.port}
   HTML embebido: ${enc.encode(html).length} bytes / ${parts.length} fragmentos
   Funciones: RW, pantallas, imágenes, widgets industriales, alarmas actuales y recetas.
   Seguridad funcional e interlocks permanecen en el programa de máquina.
*)

IF Web_State = Web_PrevState THEN
    IF (Web_State <> UINT#10) AND (Web_StateTicks < UDINT#4294967294) THEN
        Web_StateTicks := Web_StateTicks + UDINT#1;
    END_IF;
ELSE
    Web_PrevState := Web_State;
    Web_StateTicks := UDINT#0;
END_IF;

IF (Web_State <> UINT#10) AND (Web_StateTicks > Web_WatchdogLimit) THEN
    Web_Accept(Execute:=FALSE, SrcTcpPort:=UINT#${p.port}, TimeOut:=UINT#0);
    Web_Rcv(Execute:=FALSE, Socket:=Web_Socket, TimeOut:=UINT#0, Size:=UINT#0, RcvDat:=Web_Rx[0]);
    Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
    Web_State := UINT#90;
    Web_StateTicks := UDINT#0;
END_IF;

CASE Web_State OF
0:
    Web_Accept(Execute:=FALSE, SrcTcpPort:=UINT#${p.port}, TimeOut:=UINT#0);
    Web_Rcv(Execute:=FALSE, Socket:=Web_Socket, TimeOut:=UINT#0, Size:=UINT#0, RcvDat:=Web_Rx[0]);
    Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
    Web_Close(Execute:=FALSE, Socket:=Web_Socket);
    Web_State := UINT#10;

10:
    Web_Accept(Execute:=TRUE, SrcTcpPort:=UINT#${p.port}, TimeOut:=UINT#0);
    IF Web_Accept.Done THEN
        Web_Socket := Web_Accept.Socket;
        Web_Accept(Execute:=FALSE, SrcTcpPort:=UINT#${p.port}, TimeOut:=UINT#0);
        Web_State := UINT#20;
    ELSIF Web_Accept.Error THEN
        Web_Accept(Execute:=FALSE, SrcTcpPort:=UINT#${p.port}, TimeOut:=UINT#0);
    END_IF;

20:
    Web_Rcv(Execute:=TRUE, Socket:=Web_Socket, TimeOut:=UINT#50, Size:=UINT#1900, RcvDat:=Web_Rx[0]);
    IF Web_Rcv.Done THEN
        Web_RxText := AryToString(Web_Rx[0], Web_Rcv.RcvSize);
        Web_Rcv(Execute:=FALSE, Socket:=Web_Socket, TimeOut:=UINT#0, Size:=UINT#0, RcvDat:=Web_Rx[0]);
        Web_Request := UINT#0;
        IF (FIND(Web_RxText, 'GET / ') = 1) OR (FIND(Web_RxText, 'GET /index.html ') = 1) THEN
            Web_Request := UINT#1;
        ELSIF FIND(Web_RxText, 'GET /api/read ') = 1 THEN
            Web_Request := UINT#2;
        ELSIF FIND(Web_RxText, 'POST /api/write?') = 1 THEN
            Web_Request := UINT#3;
        ELSIF FIND(Web_RxText, 'POST /api/recipe?') = 1 THEN
            Web_Request := UINT#4;
        ELSE
            Web_Request := UINT#9;
        END_IF;
        Web_State := UINT#30;
    ELSIF Web_Rcv.Error THEN
        Web_Rcv(Execute:=FALSE, Socket:=Web_Socket, TimeOut:=UINT#0, Size:=UINT#0, RcvDat:=Web_Rx[0]);
        Web_State := UINT#90;
    END_IF;

30:
    CASE Web_Request OF
    1:
        Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: text/html; charset=utf-8$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';
        Web_Chunk := UINT#0;

    2:
        Web_Seq := Web_Seq + UDINT#1;
        IF Web_Seq = UDINT#0 THEN Web_Seq := UDINT#1; END_IF;
        Web_ApiBody := CONCAT('SEQ=', UDINT_TO_STRING(Web_Seq), '$n');
        ${read.join('\n        ')}
        Web_ApiBody := CONCAT(Web_ApiBody, 'END=', UDINT_TO_STRING(Web_Seq), '$n');
        Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: text/plain; charset=utf-8$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';

    3:
        Web_PosId := FIND(Web_RxText, '?id=');
        Web_PosEnd := FIND(Web_RxText, ' HTTP/');
        Web_PosBody := FIND(Web_RxText, '$r$n$r$n');
        Web_Found := FALSE;
        IF (Web_PosId > 0) AND (Web_PosEnd > Web_PosId) AND (Web_PosBody > 0) THEN
            Web_IdText := MID(In:=Web_RxText, L:=Web_PosEnd-(Web_PosId+UINT#4), P:=Web_PosId+UINT#4);
            Web_ValueText := MID(In:=Web_RxText, L:=LEN(Web_RxText)-(Web_PosBody+UINT#3), P:=Web_PosBody+UINT#4);
            Web_WriteId := STRING_TO_UINT(Web_IdText);
            CASE Web_WriteId OF
            ${writes||'0: ;'}
            ELSE
                ;
            END_CASE;
        END_IF;
        IF Web_Found THEN
            Web_ApiBody := 'OK';
            Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: text/plain$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';
        ELSE
            Web_ApiBody := 'BAD WRITE';
            Web_TxText := 'HTTP/1.0 400 Bad Request$r$nContent-Type: text/plain$r$nConnection: close$r$n$r$n';
        END_IF;

    4:
        Web_PosId := FIND(Web_RxText, '?id=');
        Web_PosEnd := FIND(Web_RxText, ' HTTP/');
        Web_Found := FALSE;
        IF (Web_PosId > 0) AND (Web_PosEnd > Web_PosId) THEN
            Web_IdText := MID(In:=Web_RxText, L:=Web_PosEnd-(Web_PosId+UINT#4), P:=Web_PosId+UINT#4);
            Web_WriteId := STRING_TO_UINT(Web_IdText);
            CASE Web_WriteId OF
            ${recipeCases||'0: ;'}
            ELSE
                ;
            END_CASE;
        END_IF;
        IF Web_Found THEN
            Web_ApiBody := 'OK';
            Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: text/plain$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';
        ELSE
            Web_ApiBody := 'BAD RECIPE';
            Web_TxText := 'HTTP/1.0 400 Bad Request$r$nContent-Type: text/plain$r$nConnection: close$r$n$r$n';
        END_IF;

    ELSE
        Web_ApiBody := 'NOT FOUND';
        Web_TxText := 'HTTP/1.0 404 Not Found$r$nContent-Type: text/plain$r$nConnection: close$r$n$r$n';
    END_CASE;
    Web_State := UINT#40;

40:
    Web_TxSize := StringToAry(Web_TxText, Web_Tx[0]);
    Web_Send(Execute:=TRUE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=Web_TxSize);
    IF Web_Send.Done THEN
        Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
        IF Web_Request = UINT#1 THEN Web_State := UINT#50; ELSE Web_State := UINT#60; END_IF;
    ELSIF Web_Send.Error THEN
        Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
        Web_State := UINT#90;
    END_IF;

50:
    CASE Web_Chunk OF
            ${chunkCases}
    ELSE
        Web_TxText := '';
    END_CASE;
    Web_TxSize := StringToAry(Web_TxText, Web_Tx[0]);
    Web_Send(Execute:=TRUE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=Web_TxSize);
    IF Web_Send.Done THEN
        Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
        IF Web_Chunk >= UINT#${parts.length-1} THEN Web_State := UINT#90; ELSE Web_Chunk := Web_Chunk + UINT#1; END_IF;
    ELSIF Web_Send.Error THEN
        Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
        Web_State := UINT#90;
    END_IF;

60:
    Web_TxText := Web_ApiBody;
    Web_TxSize := StringToAry(Web_TxText, Web_Tx[0]);
    Web_Send(Execute:=TRUE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=Web_TxSize);
    IF Web_Send.Done OR Web_Send.Error THEN
        Web_Send(Execute:=FALSE, Socket:=Web_Socket, SendDat:=Web_Tx[0], Size:=UINT#0);
        Web_State := UINT#90;
    END_IF;

90:
    Web_Close(Execute:=TRUE, Socket:=Web_Socket);
    IF Web_Close.Done OR Web_Close.Error THEN
        Web_Close(Execute:=FALSE, Socket:=Web_Socket);
        Web_State := UINT#10;
    END_IF;
END_CASE;
`;
}
function referencedVariables(p){const n=C.normalize(p),set=new Set(n.variables.filter(v=>v.expose&&v.live).map(v=>v.name));if(n.screenBinding)set.add(n.screenBinding);for(const s of n.screens)for(const o of C.screenObjects(n,s)){if(o.binding)set.add(o.binding);if(o.feedbackBinding)set.add(o.feedbackBinding);}for(const a of n.alarms)if(a.binding)set.add(a.binding);for(const r of n.recipes)for(const k of Object.keys(r.values||{}))set.add(k);return n.variables.filter(v=>set.has(v.name));}
function externalVariablesTSV(p){return referencedVariables(p).map(v=>[v.name,v.type].join('\t')).join('\r\n');}
function localVariablesTSV(){const rows=[
['Web_State','UINT','0','','','','Estado servidor HTTP'],
['Web_PrevState','UINT','0','','','','Estado anterior watchdog'],
['Web_StateTicks','UDINT','0','','','','Ciclos en estado actual'],
['Web_WatchdogLimit','UDINT','5000','','','','Límite ciclos watchdog'],
['Web_Seq','UDINT','0','','','','Secuencia snapshot API'],
['Web_Request','UINT','0','','','','Ruta solicitada'],
['Web_Chunk','UINT','0','','','','Fragmento HTML'],
['Web_WriteId','UINT','0','','','','ID escritura/receta'],
['Web_PosId','UINT','0','','','','Posición id'],
['Web_PosVal','UINT','0','','','','Posición valor'],
['Web_PosEnd','UINT','0','','','','Fin request line'],
['Web_PosBody','UINT','0','','','','Inicio cuerpo HTTP'],
['Web_TxSize','UINT','0','','','','Bytes a enviar'],
['Web_Found','BOOL','FALSE','','','','Ruta/ID válido'],
['Web_Rx','ARRAY[0..1999] OF BYTE','','','','','Buffer RX'],
['Web_Tx','ARRAY[0..1999] OF BYTE','','','','','Buffer TX'],
['Web_RxText','STRING[1985]','','','','','Petición HTTP'],
['Web_TxText','STRING[1985]','','','','','Respuesta/fragmento'],
['Web_ApiBody','STRING[1985]','','','','','Datos API'],
['Web_IdText','STRING[12]','','','','','ID parseado'],
['Web_ValueText','STRING[512]','','','','','Valor de escritura'],
['Web_Socket','_sSOCKET','','','','','Socket aceptado'],
['Web_Accept','SktTCPAccept','','','','','Accept TCP'],
['Web_Rcv','SktTCPRcv','','','','','Receive TCP'],
['Web_Send','SktTCPSend','','','','','Send TCP'],
['Web_Close','SktClose','','','','','Close TCP']
];return rows.map(r=>r.join('\t')).join('\r\n');}
function readme(input,html,st){const p=C.normalize(input);return `HMI NX ST · paquete generado

Proyecto: ${p.name}
Puerto: ${p.port}
Pantallas: ${p.screens.length}
Imágenes: ${p.assets.length}
Alarmas actuales: ${p.alarms.length}
Recetas: ${p.recipes.length}
HTML embebido: ${enc.encode(html).length} bytes
ST generado: ${enc.encode(st).length} bytes

INSTALACIÓN
- Pegar WebHMI_Server.st en un Program ST.
- Pegar WebHMI_LocalVariables.tsv en Internals.
- Pegar WebHMI_ExternalVariables.tsv en Externals.
- Las variables referenciadas deben existir como Global Variables con el mismo nombre/tipo.
- Asignar el Program a una tarea y transferir al NX.
- Abrir http://IP_DEL_NX:${p.port}/

FUNCIONES
- Comunicación robusta: snapshots SEQ/END, actualización atómica y watchdog de estados.
- Escritura directa BOOL, numérica y STRING RW; entradas numéricas con límites mínimo/máximo validados en navegador.
- Botones SET/RESET/TOGGLE.
- Varias pantallas con número único, color de fondo y selección opcional por variable entera leída del PLC.
- Si se configura control PLC, el valor de esa variable gobierna siempre la pantalla; si no coincide con ningún número (o es inválido), se muestra la principal. Sin comunicación válida, se mantiene la última pantalla y se indica pérdida de comunicación.
- Imágenes embebidas como data URL, estáticas o con cambio OFF/ON gobernado por BOOL.
- Estado BOOL con símbolos SVG integrados OFF/ON: lámpara, motor, bomba, válvula, cinta y sensor; mapeo TRUE/FALSE invertible.
- Alarmas actuales evaluadas en ST, enviadas en /api/read y mostradas en ventana de alarmas.
- Recetas compiladas en ST y aplicadas en una sola ejecución del CASE de receta.

LÍMITES ACTUALES
- 1 cliente simultáneo.
- HTTP/1.0 con Connection: close.
- Petición <=1900 bytes en una recepción.
- Web_WatchdogLimit es un límite en ciclos de tarea (5000 por defecto), no tiempo absoluto.
- Alarmas: estado actual, sin histórico/ACK persistente todavía.
- Recetas: valores compilados con la exportación; editar una receta exige regenerar/transferir ST.
- Sin HTTPS ni gestión de usuarios todavía.
- No usar la HMI para funciones de seguridad.
`;}
Object.assign(C,{buildST,localVariablesTSV,externalVariablesTSV,readme});
})(globalThis);

(function(root){'use strict';const C=root.NXST,enc=new TextEncoder();
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function zip(files){const parts=[],central=[];let offset=0;const u16=(v,p,n)=>v.setUint16(p,n,true),u32=(v,p,n)=>v.setUint32(p,n>>>0,true);for(const [name,val] of Object.entries(files)){const nb=enc.encode(name),b=val instanceof Uint8Array?val:enc.encode(val),crc=crc32(b),h=new Uint8Array(30+nb.length),dv=new DataView(h.buffer);u32(dv,0,0x04034b50);u16(dv,4,20);u16(dv,6,0x800);u32(dv,14,crc);u32(dv,18,b.length);u32(dv,22,b.length);u16(dv,26,nb.length);h.set(nb,30);parts.push(h,b);const ch=new Uint8Array(46+nb.length),cv=new DataView(ch.buffer);u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x800);u32(cv,16,crc);u32(cv,20,b.length);u32(cv,24,b.length);u16(cv,28,nb.length);u32(cv,42,offset);ch.set(nb,46);central.push(ch);offset+=h.length+b.length;}const end=new Uint8Array(22),ev=new DataView(end.buffer),cs=central.reduce((a,b)=>a+b.length,0);u32(ev,0,0x06054b50);u16(ev,8,central.length);u16(ev,10,central.length);u32(ev,12,cs);u32(ev,16,offset);const all=[...parts,...central,end],out=new Uint8Array(all.reduce((a,b)=>a+b.length,0));let at=0;for(const b of all){out.set(b,at);at+=b.length;}return out;}
function exportPackage(p){const errors=C.validate(p);if(errors.length)throw new Error(errors.join('\n'));const html=C.buildRuntimeHTML(p);if(enc.encode(html).length>C.HTML_MAX_BYTES)throw new Error('HTML embebido supera el límite estricto de 512 KB. Reduzca imágenes, pantallas u objetos.');const st=C.buildST(p),files={'WebHMI_Server.st':st,'WebHMI_LocalVariables.tsv':C.localVariablesTSV(),'WebHMI_ExternalVariables.tsv':C.externalVariablesTSV(p),'HMI_Embedded.html':html,'project.nxst':JSON.stringify(p,null,2)};files['README.txt']=C.readme(p,html,st);return{files,zip:zip(files),html,st};}

Object.assign(C,{zip,exportPackage});
})(globalThis);
