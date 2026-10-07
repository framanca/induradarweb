(function(root){'use strict';
const LIVE_TYPES=new Set(['BOOL','SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL','STRING']);
const WRITE_TYPES=new Set(['BOOL','SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL']);
const enc=new TextEncoder();
const id=()=>Math.random().toString(36).slice(2,10);
const copy=x=>JSON.parse(JSON.stringify(x));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function typeInfo(raw){
 const s=String(raw||'').trim().toUpperCase().replace(/\s+/g,'');
 const m=s.match(/^STRING(?:\[(\d+)\]|\((\d+)\))?$/);if(m)return{type:'STRING',length:Number(m[1]||m[2]||255),raw:s};
 const aliases={BOOLEAN:'BOOL',INTEGER:'INT','SIGNEDINT':'INT','DOUBLEINTEGER':'DINT','UNSIGNEDINT':'UINT','DOUBLEUNSIGNEDINTEGER':'UDINT',FLOAT:'REAL','DOUBLEFLOAT':'LREAL'};
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
 let raw=[];if(/^\s*[A-Za-z_][A-Za-z0-9_.]*\s*:\s*[A-Za-z]/m.test(trimmed) && !/^(?:Name|Nombre|Variable)[\t;,]/i.test(trimmed)) raw=parseST(trimmed);const rows=parseDelimited(trimmed);const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_.\-/]/g,'');
 if(!raw.length&&rows.length>=1){const head=rows[0].map(norm),nameI=head.findIndex(x=>['name','nombre','variablename','variable','symbol','simbolo'].includes(x)),typeI=head.findIndex(x=>['datatype','type','tipo','tipodedatos','datatypeofvariable'].includes(x)),commentI=head.findIndex(x=>['comment','comments','comentario','description','descripcion'].includes(x));if(nameI>=0&&typeI>=0){for(const row of rows.slice(1)){if(!row[nameI])continue;const t=typeInfo(row[typeI]);raw.push({name:row[nameI],type:t.type,stringLength:t.length,comment:row[commentI]||'',sourceType:t.raw});}}else if(rows.length&&rows[0].length>=2&&!trimmed.includes(':=')){for(const row of rows){const t=typeInfo(row[1]);raw.push({name:row[0],type:t.type,stringLength:t.length,comment:row[2]||'',sourceType:t.raw});}}}
 if(!raw.length)raw=parseST(trimmed);if(!raw.length)throw new Error('No se reconocen variables. Usa columnas Name/Nombre y Data Type/Tipo, o declaraciones ST simples.');
 const seen=new Set(),errors=[],vars=[];for(const r of raw){if(!nameOK(r.name)){errors.push('Nombre no compatible: '+r.name);continue;}if(seen.has(r.name)){errors.push('Duplicada: '+r.name);continue;}seen.add(r.name);const live=LIVE_TYPES.has(r.type);vars.push({id:vars.length+1,name:r.name,type:r.type,stringLength:r.stringLength||255,comment:r.comment||'',access:'R',expose:live,live,writeSupported:WRITE_TYPES.has(r.type)});}if(errors.length)throw new Error(errors.slice(0,12).join('\n'));return vars;
}
function newProject(){return{name:'WebHMI ST',port:8080,pollMs:500,width:1024,height:600,minDisplayWidth:480,maxDisplayWidth:1920,variables:[],objects:[]};}
function demoProject(){const p=newProject();p.name='Demo NX ST';p.variables=[
{id:1,name:'Machine_Running',type:'BOOL',stringLength:255,comment:'Máquina en marcha',access:'R',expose:true,live:true,writeSupported:true},
{id:2,name:'Process_Setpoint',type:'REAL',stringLength:255,comment:'Consigna',access:'RW',expose:true,live:true,writeSupported:true},
{id:3,name:'Process_Level',type:'REAL',stringLength:255,comment:'Nivel',access:'R',expose:true,live:true,writeSupported:true},
{id:4,name:'Start_Request',type:'BOOL',stringLength:255,comment:'Solicitud marcha',access:'RW',expose:true,live:true,writeSupported:true}
];p.objects=[
{id:id(),kind:'text',x:30,y:24,w:360,h:48,text:'HMI NX · servidor ST embebido',binding:'',writeValue:'1',min:0,max:100},
{id:id(),kind:'lamp',x:40,y:105,w:60,h:60,text:'Marcha',binding:'Machine_Running',writeValue:'1',min:0,max:100},
{id:id(),kind:'value',x:140,y:105,w:180,h:55,text:'Nivel',binding:'Process_Level',writeValue:'1',actionMode:'set',decimals:2,min:0,max:100},
{id:id(),kind:'bar',x:140,y:180,w:330,h:38,text:'Nivel',binding:'Process_Level',writeValue:'1',actionMode:'set',decimals:2,min:0,max:100},
{id:id(),kind:'input',x:140,y:245,w:240,h:55,text:'Consigna',binding:'Process_Setpoint',writeValue:'1',actionMode:'set',decimals:2,min:0,max:100},
{id:id(),kind:'button',x:40,y:335,w:180,h:64,text:'Solicitar marcha',binding:'Start_Request',writeValue:'1',actionMode:'set',decimals:2,min:0,max:100}
];return p;}
function newObject(kind){const base={id:id(),kind,x:40,y:40,w:150,h:50,text:'',binding:'',writeValue:'1',actionMode:'set',decimals:2,min:0,max:100};const m={text:{w:220,h:40,text:'Texto'},lamp:{w:60,h:60,text:'Piloto'},value:{w:160,h:50,text:'Valor'},input:{w:210,h:55,text:'Entrada'},button:{w:170,h:58,text:'Botón'},bar:{w:240,h:36,text:'Barra'}};return Object.assign(base,m[kind]||{});}
function variableMap(p){return new Map(p.variables.map(v=>[v.name,v]));}
function validate(p){const e=[];if(!p||!Array.isArray(p.variables)||!Array.isArray(p.objects))return['Proyecto no válido'];if(!Number.isInteger(+p.port)||p.port<1024||p.port>65535)e.push('Puerto: use 1024..65535 para evitar servicios del sistema.');if(!Number.isInteger(+p.pollMs)||p.pollMs<100||p.pollMs>5000)e.push('Polling: 100..5000 ms.');if(!Number.isInteger(+p.width)||p.width<320||p.width>3840)e.push('Ancho de diseño: 320..3840 px.');if(!Number.isInteger(+p.height)||p.height<240||p.height>2160)e.push('Alto de diseño: 240..2160 px.');const minDisplay=Number(p.minDisplayWidth??480),maxDisplay=Number(p.maxDisplayWidth??1920);if(!Number.isInteger(minDisplay)||minDisplay<320||minDisplay>3840)e.push('Ancho mínimo de navegador: 320..3840 px.');if(!Number.isInteger(maxDisplay)||maxDisplay<320||maxDisplay>7680)e.push('Ancho máximo de navegador: 320..7680 px.');if(Number.isInteger(minDisplay)&&Number.isInteger(maxDisplay)&&minDisplay>maxDisplay)e.push('El ancho mínimo no puede superar al máximo.');const exposed=p.variables.filter(v=>v.expose&&v.live);if(exposed.length>32)e.push('POC V0: máximo 32 variables expuestas simultáneamente.');const worstApi=exposed.reduce((n,v)=>n+String(v.id).length+1+(v.type==='STRING'?Math.min(v.stringLength||255,255):v.type==='BOOL'?5:32)+1,0);if(worstApi>1500)e.push('POC V0: la respuesta /api/read puede superar 1500 bytes; reduce variables o STRING expuestos.');const vm=variableMap(p),ids=new Set();for(const v of p.variables){if(ids.has(v.id))e.push('ID de variable duplicado: '+v.id);ids.add(v.id);if(v.expose&&!v.live)e.push(v.name+': tipo '+v.type+' no soportado por el transporte POC.');if(v.access==='RW'&&!v.writeSupported)e.push(v.name+': escritura no soportada para '+v.type+' en POC.');}for(const o of p.objects){if(o.kind!=='text'){const v=vm.get(o.binding);if(!v)e.push(o.text+': selecciona una variable.');else if(['button','input'].includes(o.kind)&&v.access!=='RW')e.push(o.text+': requiere variable RW.');if(o.kind==='lamp'&&v&&v.type!=='BOOL')e.push(o.text+': el piloto requiere BOOL.');if(o.kind==='button'&&v&&v.type!=='BOOL')e.push(o.text+': el botón SET/RESET/TOGGLE requiere BOOL.');if(o.kind==='button'&&!['set','reset','toggle'].includes(o.actionMode||'set'))e.push(o.text+': modo de botón no válido.');if(o.kind==='input'&&v&&!['SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL'].includes(v.type))e.push(o.text+': la entrada requiere tipo numérico.');if(o.kind==='bar'&&v&&!['SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL'].includes(v.type))e.push(o.text+': barra requiere tipo numérico.');if(['value','input'].includes(o.kind)&&(!Number.isInteger(Number(o.decimals??2))||Number(o.decimals??2)<0||Number(o.decimals??2)>6))e.push(o.text+': decimales debe estar entre 0 y 6.');}}
 return [...new Set(e)];}

root.NXST=Object.assign(root.NXST||{},{LIVE_TYPES,WRITE_TYPES,id,copy,esc,typeInfo,nameOK,parseDelimited,importSysmac,newProject,demoProject,newObject,validate});
})(globalThis);
