(function(root){
'use strict';
// Safe expression evaluator: no eval, Function, property traversal or arbitrary calls.
// Grammar: literals, variables, arithmetic, comparison, boolean and ternary.
function evaluate(source, variables){
  const input=String(source||'').trim();
  if(!input)return undefined;
  if(input.length>500)throw Error('Expresion demasiado larga (max. 500 caracteres)');
  const tokens=[],rx=/\s*(?:([0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?|("(?:\\.|[^"\\])*")|([A-Za-z_][A-Za-z_0-9.]*)|(>=|<=|===|!==|==|!=|&&|\|\||[?:()+*\/!%<>-]))/gy;
  let i=0;
  while(i<input.length){
    if(/^\s+$/.test(input.slice(i)))break;
    rx.lastIndex=i;
    const match=rx.exec(input);
    if(!match||rx.lastIndex===i)throw Error('Simbolo no permitido cerca de: '+input.slice(i,i+18));
    tokens.push(match[1]!==undefined?{t:'number',v:Number(match[0].trim())}:match[2]?{t:'string',v:JSON.parse(match[2])}:match[3]?{t:'name',v:match[3]}:{t:'operator',v:match[4]});
    if(tokens.length>160)throw Error('Expresion demasiado compleja');
    i=rx.lastIndex;
  }
  const priority={'||':1,'&&':2,'==':3,'!=':3,'===':3,'!==':3,'>':4,'<':4,'>=':4,'<=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
  let pos=0;
  const peek=()=>tokens[pos]&&tokens[pos].v;
  const consume=x=>{if(peek()!==x)throw Error('Se esperaba '+x);pos++};
  function prefix(){
    const t=tokens[pos++];if(!t)throw Error('Expresion incompleta');
    if(t.t==='number'||t.t==='string')return()=>t.v;
    if(t.t==='name'){
      if(t.v==='true'||t.v==='TRUE')return()=>true;
      if(t.v==='false'||t.v==='FALSE')return()=>false;
      if(t.v==='null')return()=>null;
      if(['__proto__','constructor','prototype'].some(x=>t.v.split('.').includes(x)))throw Error('Identificador no permitido');
      return()=>{const v=variables||{},key=t.v.startsWith('PLC.')?t.v.slice(4):t.v;return Object.prototype.hasOwnProperty.call(v,key)?v[key]:undefined};
    }
    if(t.v==='('){const f=expression(0);consume(')');return f}
    if(t.v==='!'||t.v==='-'||t.v==='+'){const f=prefix();return()=>t.v==='!'?!f():t.v==='-'?-Number(f()):Number(f())}
    throw Error('Elemento inesperado: '+t.v);
  }
  function expression(min){
    let left=prefix();
    while(pos<tokens.length){
      const op=peek(),prec=priority[op];
      if(op==='?'&&min<=0){pos++;const yes=expression(0);consume(':');const no=expression(0),old=left;left=()=>old()?yes():no();continue}
      if(prec===undefined||prec<min)break;
      pos++;const right=expression(prec+1),old=left;
      left=()=>{
        const a=old();
        if(op==='&&')return Boolean(a)&&Boolean(right());
        if(op==='||')return Boolean(a)||Boolean(right());
        const b=right();
        switch(op){
          case '==':case '===':return a===b;
          case '!=':case '!==':return a!==b;
          case '>':return a>b;case '<':return a<b;
          case '>=':return a>=b;case '<=':return a<=b;
          case '+':return a+b;case '-':return Number(a)-Number(b);
          case '*':return Number(a)*Number(b);case '/':return Number(a)/Number(b);
          case '%':return Number(a)%Number(b);
        }
      };
    }
    return left;
  }
  const result=expression(0);
  if(pos!==tokens.length)throw Error('Expresion incorrecta cerca de '+peek());
  return result();
}
function validate(source){try{evaluate(source,{});return ''}catch(e){return e.message}}
root.NXExpressions={evaluate,validate};
})(globalThis);

(function(root){'use strict';
const LIVE_TYPES=new Set(['BOOL','SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL','STRING','BYTE','WORD','DWORD','LWORD','TIME','DATE','TIME_OF_DAY','DATE_AND_TIME']);
const WRITE_TYPES=new Set(['BOOL','SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL','STRING','BYTE','WORD','DWORD','LWORD','TIME','DATE','TIME_OF_DAY','DATE_AND_TIME']);
const NUMERIC_TYPES=new Set(['SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL']);
const INTEGER_TYPES=new Set(['SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT']);
const MAX_SCREEN_NUMBER=65535;
const BOOL_WIDGETS=new Set(['status']);
const STATUS_SYMBOLS=new Set(['lamp','motor','pump','valve','conveyor','sensor']);

const SHAPE_TYPES=new Set(['rect','ellipse','line','arrow','triangle']);
const SHAPE_LABELS={rect:'Rectángulo / cuadrado',ellipse:'Elipse / círculo',line:'Línea',arrow:'Flecha',triangle:'Triángulo libre'};
function defaultShapePoints(type){return type==='triangle'?'50,5 95,95 5,95':type==='line'?'5,50 95,50':type==='arrow'?'5,50 88,50':''}
function shapeCoordinates(type,points){
 const count=type==='triangle'?3:type==='line'||type==='arrow'?2:0;
 if(!count)return [];
 const str=String(points??''),parts=str.trim().split(/\s+/);
 if(parts.length!==count)return null;
 const coords=[];
 for(const part of parts){
  const match=part.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if(!match)return null;
  const x=Number(match[1]),y=Number(match[2]);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>100||y<0||y>100)return null;
  coords.push([x,y]);
 }
 if(coords.length===2&&Math.hypot(coords[1][0]-coords[0][0],coords[1][1]-coords[0][1])<1)return null;
 if(coords.length===3&&Math.abs((coords[1][0]-coords[0][0])*(coords[2][1]-coords[0][1])-(coords[2][0]-coords[0][0])*(coords[1][1]-coords[0][1]))<.5)return null;
 return coords;
}
function shapeSvg(type,fill,stroke,width,points){
 // These attributes are generated only from validated colors and numbers.
 // No external image, fonts, JavaScript or SVG <foreignObject> are needed.
 if(!['rect','ellipse','line','arrow','triangle'].includes(type))type='rect';
 const color=c=>/^#[0-9a-f]{6}$/i.test(String(c||''))?c:'#2563eb';
 fill=color(fill||'#bfdbfe');stroke=color(stroke||'#1e40af');
 width=Number(width);width=Number.isFinite(width)?Math.max(0,Math.min(20,width)):3;
 const coords=shapeCoordinates(type,points)||shapeCoordinates(type,defaultShapePoints(type));
 const f=n=>Number(n.toFixed(3));
 const a='viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';
 const attrs=' stroke="'+stroke+'" stroke-width="'+width+'" stroke-linejoin="round" stroke-linecap="round"';
 let path='';
 if(type==='rect'){const m=width/2;path='<rect x="'+f(m)+'" y="'+f(m)+'" width="'+f(100-width)+'" height="'+f(100-width)+'" fill="'+fill+'"'+attrs+'/>';}
 else if(type==='ellipse'){path='<ellipse cx="50" cy="50" rx="'+f(50-width/2)+'" ry="'+f(50-width/2)+'" fill="'+fill+'"'+attrs+'/>';}
 else if(type==='triangle'){path='<polygon points="'+coords.map(p=>p.map(f).join(',')).join(' ')+'" fill="'+fill+'"'+attrs+'/>';}
 else if(type==='line'){path='<line x1="'+coords[0][0]+'" y1="'+coords[0][1]+'" x2="'+coords[1][0]+'" y2="'+coords[1][1]+'"'+attrs+'/>';}
 else {
  const [[x1,y1],[x2,y2]]=coords,dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
  const head=Math.min(24,Math.max(9,Math.min(17,len*.4))),side=Math.max(5,head*.45);
  const bx=x2-ux*head,by=y2-uy*head;
  path='<line x1="'+x1+'" y1="'+y1+'" x2="'+f(bx)+'" y2="'+f(by)+'"'+attrs+'/>'+
   '<polygon points="'+[[x2,y2],[bx-uy*side,by+ux*side],[bx+uy*side,by-ux*side]].map(p=>p.map(f).join(',')).join(' ')+'" fill="'+stroke+'"/>';
 }
 return '<svg '+a+'>'+path+'</svg>';
}

const LEGACY_STATUS_KINDS=new Set(['lamp','motor','pump','valve','conveyor','sensor']);
const STATUS_LABELS={lamp:'Lámpara',motor:'Motor',pump:'Bomba',valve:'Válvula',conveyor:'Cinta',sensor:'Sensor'};
const WIDGET_FILL_DEFAULTS={tank:'#38bdf8',bar:'#16a34a',gauge:'#16a34a',counter:'#16a34a'};
const IMAGE_MAX_BYTES=64*1024,IMAGE_TOTAL_MAX_BYTES=256*1024,HTML_MAX_BYTES=512*1024,IMAGE_OPTIMIZE_MAX_DIM=1024;
const enc=new TextEncoder();
function dataUrlBytes(data){const s=String(data||''),i=s.indexOf(',');if(i<0)return enc.encode(s).length;const meta=s.slice(0,i),body=s.slice(i+1);if(/;base64$/i.test(meta)){const clean=body.replace(/\s/g,'');const pad=clean.endsWith('==')?2:clean.endsWith('=')?1:0;return Math.max(0,Math.floor(clean.length*3/4)-pad);}try{return enc.encode(decodeURIComponent(body)).length}catch{return enc.encode(body).length;}}
const id=()=>Math.random().toString(36).slice(2,10);
const copy=x=>JSON.parse(JSON.stringify(x));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function statusSvg(type,on=false,lampOnColor='#86efac'){type=STATUS_SYMBOLS.has(type)?type:'lamp';const fill=on?'#86efac':'#e2e8f0',stroke=on?'#15803d':'#475569',accent=on?'#22c55e':'#94a3b8',common='viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';if(type==='lamp'){const lampFill=/^#[0-9a-f]{6}$/i.test(lampOnColor)?lampOnColor:'#86efac';return '<svg '+common+'><circle cx="50" cy="38" r="23" fill="'+(on?lampFill:'#e2e8f0')+'" stroke="#475569" stroke-width="5"/></svg>';} if(type==='motor')return '<svg '+common+'><circle cx="42" cy="39" r="25" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><text x="42" y="48" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" font-weight="700" fill="'+stroke+'">M</text><path d="M67 39h20" stroke="'+stroke+'" stroke-width="6" stroke-linecap="round"/>'+(on?'<path d="M24 13c8-7 27-8 37 1" fill="none" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/><path d="M58 8l7 7-10 2" fill="'+accent+'"/>':'')+'</svg>';if(type==='pump')return '<svg '+common+'><circle cx="38" cy="40" r="25" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><path d="M38 23l17 17-17 17z" fill="'+accent+'" stroke="'+stroke+'" stroke-width="3"/><path d="M63 40h26v-17" fill="none" stroke="'+stroke+'" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'+(on?'<path d="M72 14h17" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/><path d="M89 14l-8-5v10z" fill="'+accent+'"/>':'')+'</svg>';if(type==='valve')return '<svg '+common+'><path d="M8 40h18M74 40h18" stroke="'+stroke+'" stroke-width="6" stroke-linecap="round"/><path d="M25 20l25 20-25 20zM75 20L50 40l25 20z" fill="'+fill+'" stroke="'+stroke+'" stroke-width="4" stroke-linejoin="round"/><path d="M50 40V12M38 12h24" stroke="'+stroke+'" stroke-width="5" stroke-linecap="round"/>'+(on?'<circle cx="50" cy="40" r="8" fill="'+accent+'"/><path d="M35 68h30" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/>':'<path d="M43 33l14 14M57 33L43 47" stroke="#64748b" stroke-width="4" stroke-linecap="round"/>')+'</svg>';if(type==='conveyor')return '<svg '+common+'><rect x="8" y="25" width="84" height="30" rx="14" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><circle cx="24" cy="40" r="7" fill="white" stroke="'+stroke+'" stroke-width="3"/><circle cx="50" cy="40" r="7" fill="white" stroke="'+stroke+'" stroke-width="3"/><circle cx="76" cy="40" r="7" fill="white" stroke="'+stroke+'" stroke-width="3"/>'+(on?'<path d="M30 15h38" stroke="'+accent+'" stroke-width="5" stroke-linecap="round"/><path d="M68 15l-10-7v14z" fill="'+accent+'"/>':'<path d="M45 11v9M55 11v9" stroke="#64748b" stroke-width="5" stroke-linecap="round"/>')+'</svg>';return '<svg '+common+'><rect x="10" y="20" width="40" height="38" rx="6" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><circle cx="43" cy="39" r="6" fill="'+accent+'" stroke="'+stroke+'" stroke-width="3"/><path d="M10 30H3M10 48H3" stroke="'+stroke+'" stroke-width="4" stroke-linecap="round"/>'+(on?'<path d="M56 29l34-10M56 39h36M56 49l34 10" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/>':'<path d="M57 39h18" stroke="#94a3b8" stroke-width="3" stroke-dasharray="5 5"/>')+'</svg>';}
function optionalNumber(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function typeInfo(raw){const s=String(raw||'').trim().toUpperCase().replace(/\s+/g,'');const m=s.match(/^STRING(?:\[(\d+)\]|\((\d+)\))?$/);if(m)return{type:'STRING',length:Number(m[1]||m[2]||255),raw:s};const a={BOOLEAN:'BOOL',INTEGER:'INT',SIGNEDINT:'INT',DOUBLEINTEGER:'DINT',UNSIGNEDINT:'UINT',DOUBLEUNSIGNEDINTEGER:'UDINT',FLOAT:'REAL',DOUBLEFLOAT:'LREAL',TOD:'TIME_OF_DAY',DT:'DATE_AND_TIME'};return{type:a[s]||s,length:null,raw:s};}
function nameOK(n){return /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(String(n||''));}
function parseDelimited(text){text=String(text||'').replace(/^\uFEFF/,'').trim();if(!text)return[];const first=text.split(/\r?\n/)[0],sep=first.includes('\t')?'\t':first.includes(';')?';':',';let rows=[],row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===sep&&!quoted){row.push(field.trim());field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}row.push(field.trim());if(row.some(Boolean))rows.push(row);return rows;}
function parseST(text){const out=[];for(const line of String(text||'').split(/\r?\n/)){const clean=line.replace(/\(\*.*?\*\)/g,'').replace(/\/\/.*$/,'').trim();const m=clean.match(/^([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*:\s*([A-Za-z][A-Za-z0-9_]*(?:\s*[\[(]\s*\d+\s*[\])])?)/);if(m){const t=typeInfo(m[2]);out.push({name:m[1],type:t.type,stringLength:t.length,comment:'',sourceType:t.raw});}}return out;}
function importSysmac(text){const trimmed=String(text||'').trim();if(!trimmed)throw new Error('No hay contenido para importar.');let raw=[];if(/^\s*[A-Za-z_][A-Za-z0-9_.]*\s*:\s*[A-Za-z]/m.test(trimmed)&&!/^(?:Name|Nombre|Variable)[\t;,]/i.test(trimmed))raw=parseST(trimmed);const rows=parseDelimited(trimmed),norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_.\-/]/g,'');if(!raw.length&&rows.length){const h=rows[0].map(norm),ni=h.findIndex(x=>['name','nombre','variablename','variable','symbol','simbolo'].includes(x)),ti=h.findIndex(x=>['datatype','type','tipo','tipodedatos','datatypeofvariable'].includes(x)),ci=h.findIndex(x=>['comment','comments','comentario','description','descripcion'].includes(x));if(ni>=0&&ti>=0){for(const row of rows.slice(1)){if(!row[ni])continue;const t=typeInfo(row[ti]);raw.push({name:row[ni],type:t.type,stringLength:t.length,comment:row[ci]||''});}}else if(rows[0].length>=2&&!trimmed.includes(':=')){for(const row of rows){const t=typeInfo(row[1]);raw.push({name:row[0],type:t.type,stringLength:t.length,comment:row[2]||''});}}}if(!raw.length)raw=parseST(trimmed);if(!raw.length)throw new Error('No se reconocen variables. Usa Name/Nombre + Data Type/Tipo, o declaraciones ST simples.');const seen=new Set(),errors=[],vars=[];for(const r of raw){if(!nameOK(r.name)){errors.push('Nombre no compatible: '+r.name);continue;}if(seen.has(r.name)){errors.push('Duplicada: '+r.name);continue;}seen.add(r.name);const live=LIVE_TYPES.has(r.type),stringLength=r.stringLength||255;vars.push({id:vars.length+1,name:r.name,type:r.type,stringLength,comment:r.comment||'',access:'R',expose:live,live,writeSupported:WRITE_TYPES.has(r.type)&&(r.type!=='STRING'||stringLength<=512)});}if(errors.length)throw new Error(errors.slice(0,12).join('\n'));return vars;}
function newScreen(name='Principal',number=null){return{id:id(),name,number,background:'#ffffff',useBase:false,objects:[]};}
function newBaseScreen(){return newScreen('Pantalla base',null);}
function screenObjects(project,screen){return project.baseScreen&&screen!==project.baseScreen&&screen.useBase?[...project.baseScreen.objects,...screen.objects]:screen.objects;}
function moveWidgetLayer(objects,id,where){if(!Array.isArray(objects)||!['front','back'].includes(where))return false;const index=objects.findIndex(o=>o.id===id);if(index<0||where==='front'&&index===objects.length-1||where==='back'&&index===0)return false;const [item]=objects.splice(index,1);if(where==='front')objects.push(item);else objects.unshift(item);return true;}
function setScreenMode(project,screenId,mode){
 if(!['normal','base','useBase'].includes(mode))throw new Error('Tipo de pantalla desconocido.');
 const base=project.baseScreen&&project.baseScreen.id===screenId;
 const screen=base?project.baseScreen:project.screens.find(s=>s.id===screenId);
 if(!screen)throw new Error('Pantalla no encontrada.');
 if(mode==='base'){
  if(base)return screen;
  if(project.baseScreen)throw new Error('Ya hay una pantalla base. Desmarca primero su propiedad.');
  const originalIndex=project.screens.indexOf(screen);
  project.screens.splice(originalIndex,1);
  if(!project.screens.length){
   const name=screen.name.toLowerCase()==='principal'?'Pantalla principal':'Principal';
   project.screens.push(newScreen(name,nextScreenNumber([screen])));
  }
  screen.previousNumber=screen.number;
  screen.previousIndex=originalIndex;
  screen.number=null;
  screen.useBase=false;
  project.baseScreen=screen;
  const fallback=project.screens[0];
  for(const s of [...project.screens,screen])for(const object of s.objects||[]){
   if(object.kind==='button'&&object.actionType==='navigate'&&object.targetScreenId===screenId)object.targetScreenId=fallback.id;
  }
  return screen;
 }
 if(base){
  if(mode==='useBase')throw new Error('Una pantalla base no puede heredarse a sí misma.');
  project.baseScreen=null;
  const desired=Number(screen.previousNumber);
  screen.number=Number.isInteger(desired)&&desired>=1&&desired<=MAX_SCREEN_NUMBER&&!project.screens.some(s=>s.number===desired)
   ?desired:nextScreenNumber(project.screens);
  const index=Number.isInteger(screen.previousIndex)?Math.max(0,Math.min(screen.previousIndex,project.screens.length)):project.screens.length;
  delete screen.previousNumber;
  delete screen.previousIndex;
  screen.useBase=false;
  project.screens.splice(index,0,screen);
  for(const s of project.screens)s.useBase=false;
  return screen;
 }
 if(mode==='useBase'&&!project.baseScreen)throw new Error('Primero convierte una pantalla en pantalla base.');
 screen.useBase=mode==='useBase';
 return screen;
}
function nextScreenNumber(screens){const used=new Set(screens.map(s=>Number(s.number)));for(let n=1;n<=MAX_SCREEN_NUMBER;n++)if(!used.has(n))return n;throw new Error('No quedan números de pantalla disponibles.');}
function duplicateScreen(original,name,number=null){const clone=copy(original);clone.id=id();clone.name=name;clone.number=number;clone.objects=(clone.objects||[]).map(o=>({...o,id:id(),targetScreenId:o.actionType==='navigate'&&o.targetScreenId===original.id?clone.id:o.targetScreenId}));return clone;}
function newProject(){return{name:'WebHMI ST',port:8080,pollMs:500,keyboardMode:'auto',width:1024,height:600,minDisplayWidth:480,maxDisplayWidth:1920,screenBinding:'',variables:[],internalVariables:[],screens:[newScreen('Principal',1)],baseScreen:null,assets:[],alarms:[],recipes:[],recipeEnabled:false,recipeSlots:12,recipeBytes:500,recipeVariables:[],recipeKey:id()};}
function normalize(input){const p=copy(input||newProject());p.minDisplayWidth=Number(p.minDisplayWidth??480);p.maxDisplayWidth=Number(p.maxDisplayWidth??1920);p.screenBinding=typeof p.screenBinding==='string'?p.screenBinding:'';p.keyboardMode=['auto','webhmi','off'].includes(p.keyboardMode)?p.keyboardMode:'auto';p.baseScreen=p.baseScreen&&typeof p.baseScreen==='object'&&!Array.isArray(p.baseScreen)?p.baseScreen:null;p.variables=Array.isArray(p.variables)?p.variables:[];for(const v of p.variables){const t=typeInfo(v.type);v.type=t.type;v.stringLength=Number(v.stringLength||t.length||255);v.live=LIVE_TYPES.has(v.type);v.writeSupported=WRITE_TYPES.has(v.type)&&(v.type!=='STRING'||v.stringLength<=512);if(v.access!=='R'&&v.access!=='RW')v.access='R';if(typeof v.expose!=='boolean')v.expose=v.live;}p.internalVariables=Array.isArray(p.internalVariables)?p.internalVariables:[];for(const v of p.internalVariables){v.name=String(v.name||'').trim();v.type=['BOOL','INT','REAL','STRING'].includes(v.type)?v.type:'BOOL';v.value=v.value??(v.type==='BOOL'?false:v.type==='STRING'?'':0);}p.assets=Array.isArray(p.assets)?p.assets:[];p.alarms=Array.isArray(p.alarms)?p.alarms:[];p.recipes=Array.isArray(p.recipes)?p.recipes:[];
p.recipeEnabled=typeof p.recipeEnabled==='boolean'?p.recipeEnabled:p.recipes.length>0;
p.recipeSlots=p.recipeSlots===undefined?12:Number(p.recipeSlots);
p.recipeBytes=p.recipeBytes===undefined?500:Number(p.recipeBytes);
p.recipeKey=typeof p.recipeKey==='string'&&/^[a-zA-Z0-9_-]{4,100}$/.test(p.recipeKey)?p.recipeKey:id();
// Backwards compatibility: a former global whitelist may still have enabled PLC
// variables that the runtime used for creating recipes. Preserve that exposure,
 // but derive recipe selections from each recipe instead of retaining a hidden whitelist.
const oldRecipeNames=Array.isArray(p.recipeVariables)?p.recipeVariables:[];
p.recipeVariables=[...new Set(p.recipes.flatMap(r=>Object.keys(r.values&&typeof r.values==='object'&&!Array.isArray(r.values)?r.values:{})))];
for(const name of new Set([...oldRecipeNames,...p.recipeVariables])){
 const v=p.variables.find(v=>v.name===name);
 if(v&&v.live&&v.access==='RW'&&v.writeSupported)v.expose=true;
}
for(const r of p.recipes){r.id=typeof r.id==='string'&&r.id?r.id:id();r.name=String(r.name||'');r.values=r.values&&typeof r.values==='object'&&!Array.isArray(r.values)?r.values:{};r.scope='shared';}
if(!Array.isArray(p.screens)||!p.screens.length){p.screens=[{id:id(),name:'Principal',objects:Array.isArray(p.objects)?p.objects:[]}];delete p.objects;}const occupied=new Set(p.screens.filter(s=>s.number!==null&&s.number!==undefined&&Number.isInteger(Number(s.number))&&Number(s.number)>=1&&Number(s.number)<=MAX_SCREEN_NUMBER).map(s=>Number(s.number)));let nextNumber=1;for(const s of [...p.screens,...(p.baseScreen?[p.baseScreen]:[])]){const isBase=s===p.baseScreen;s.id=s.id||id();s.name=s.name||(isBase?'Pantalla base':'Pantalla');s.useBase=!isBase&&s.useBase===true;if(isBase)s.number=null;else if(s.number===null||s.number===undefined){while(occupied.has(nextNumber))nextNumber++;s.number=nextNumber;occupied.add(nextNumber);}else s.number=Number(s.number);s.background=/^#[0-9a-f]{6}$/i.test(s.background||'')?s.background:'#ffffff';s.objects=Array.isArray(s.objects)?s.objects:[];for(const o of s.objects){if(LEGACY_STATUS_KINDS.has(o.kind)){o.symbolType=o.kind;o.kind='status';}
if(o.kind==='dynamicText')o.kind='text';
if(o.kind==='text'&&!o.binding&&o.optionsText==='0=Paro\n1=Manual\n2=Automático')o.optionsText='';
o.autoWidth=o.kind==='text'&&o.autoWidth===true; // Legacy text objects retain their saved manual widths.
if(WIDGET_FILL_DEFAULTS[o.kind])o.fillColor=/^#[0-9a-f]{6}$/i.test(o.fillColor||'')?o.fillColor:WIDGET_FILL_DEFAULTS[o.kind];o.symbolType=STATUS_SYMBOLS.has(o.symbolType)?o.symbolType:'lamp';o.stateOnWhen=o.stateOnWhen==='false'?'false':'true';if(o.kind==='status')o.lampOnColor=/^#[0-9a-f]{6}$/i.test(o.lampOnColor||'')?o.lampOnColor:'#86efac';o.assetOnId=o.assetOnId||'';o.actionType=o.actionType||'write';o.targetScreenId=o.targetScreenId||'';o.confirmationText=typeof o.confirmationText==='string'?o.confirmationText:'';for(const key of ['expressionText','expressionColor','expressionBackground','expressionVisible'])o[key]=typeof o[key]==='string'?o[key]:'';o.actionMode=o.actionMode||'set';o.feedbackBinding=o.feedbackBinding||'';o.feedbackColorOff=/^#[0-9a-f]{6}$/i.test(o.feedbackColorOff||'')?o.feedbackColorOff:'#2563eb';o.feedbackColorOn=/^#[0-9a-f]{6}$/i.test(o.feedbackColorOn||'')?o.feedbackColorOn:'#16a34a';if(o.kind==='button'){o.feedbackTextOff=typeof o.feedbackTextOff==='string'?o.feedbackTextOff:'';o.feedbackTextOn=typeof o.feedbackTextOn==='string'?o.feedbackTextOn:'';}if(o.kind==='shape'){o.shapeType=SHAPE_TYPES.has(o.shapeType)?o.shapeType:'rect';o.shapeFill=typeof o.shapeFill==='string'?o.shapeFill:'#bfdbfe';o.shapeStroke=typeof o.shapeStroke==='string'?o.shapeStroke:'#1e40af';o.shapeStrokeWidth=o.shapeStrokeWidth===undefined?3:Number(o.shapeStrokeWidth);o.shapePoints=typeof o.shapePoints==='string'?o.shapePoints:defaultShapePoints(o.shapeType);}o.fontSize=o.fontSize===null||o.fontSize===undefined||o.fontSize===''?null:Number(o.fontSize);o.decimals=Number.isInteger(Number(o.decimals))?Number(o.decimals):2;o.inputMin=optionalNumber(o.inputMin);o.inputMax=optionalNumber(o.inputMax);o.min=Number.isFinite(Number(o.min))?Number(o.min):0;o.max=Number.isFinite(Number(o.max))?Number(o.max):100;o.step=Number.isFinite(Number(o.step))&&Number(o.step)>0?Number(o.step):1;o.optionsText=typeof o.optionsText==='string'?o.optionsText:'0=Paro\n1=Manual\n2=Automático';o.unit=typeof o.unit==='string'?o.unit:'';o.target=Number.isFinite(Number(o.target))?Number(o.target):100;}}return p;}
function newObject(kind){if(kind==='dynamicText')kind='text';const base={id:id(),kind,x:40,y:40,w:150,h:50,text:'',binding:'',assetId:'',assetOnId:'',symbolType:'lamp',stateOnWhen:'true',actionType:'write',targetScreenId:'',confirmationText:'',expressionText:'',expressionColor:'',expressionBackground:'',expressionVisible:'',actionMode:'set',feedbackBinding:'',feedbackColorOff:'#2563eb',feedbackColorOn:'#16a34a',fontSize:null,decimals:2,inputMin:null,inputMax:null,min:0,max:100,step:1,optionsText:'0=Paro\n1=Manual\n2=Automático',unit:'',target:100};const m={text:{w:220,h:40,text:'Texto',optionsText:'',autoWidth:true},status:{w:110,h:100,text:'Estado',lampOnColor:'#86efac'},value:{w:160,h:50,text:'Valor'},input:{w:210,h:55,text:'Entrada'},button:{w:170,h:58,text:'Botón',feedbackTextOff:'',feedbackTextOn:''},bar:{w:240,h:36,text:'Barra'},image:{w:240,h:160,text:'Imagen'},shape:{w:170,h:110,text:'Figura',shapeType:'rect',shapeFill:'#bfdbfe',shapeStroke:'#1e40af',shapeStrokeWidth:3,shapePoints:''},tank:{w:140,h:190,text:'Depósito'},slider:{w:300,h:90,text:'Consigna'},switch:{w:160,h:65,text:'Activar'},selector:{w:320,h:95,text:'Modo'},multistate:{w:200,h:70,text:'Estado'},gauge:{w:170,h:170,text:'Indicador'},stepper:{w:230,h:75,text:'Ajuste'},counter:{w:220,h:95,text:'Producción'},dropdown:{w:220,h:70,text:'Selección'}};return Object.assign(base,m[kind]||{},WIDGET_FILL_DEFAULTS[kind]?{fillColor:WIDGET_FILL_DEFAULTS[kind]}:{});}
function demoProject(){const p=newProject();p.name='Demo NX ST';p.variables=[{id:1,name:'Machine_Running',type:'BOOL',stringLength:255,comment:'Máquina en marcha',access:'RW',expose:true,live:true,writeSupported:true},{id:2,name:'Process_Setpoint',type:'REAL',stringLength:255,comment:'Consigna',access:'RW',expose:true,live:true,writeSupported:true},{id:3,name:'Process_Level',type:'REAL',stringLength:255,comment:'Nivel',access:'R',expose:true,live:true,writeSupported:true},{id:4,name:'Start_Request',type:'BOOL',stringLength:255,comment:'Solicitud marcha',access:'RW',expose:true,live:true,writeSupported:true}];const s=p.screens[0];s.objects=[Object.assign(newObject('text'),{x:30,y:24,text:'HMI NX · servidor ST embebido'}),Object.assign(newObject('status'),{x:40,y:100,binding:'Machine_Running',symbolType:'motor',text:'Motor'}),Object.assign(newObject('value'),{x:200,y:105,text:'Nivel',binding:'Process_Level'}),Object.assign(newObject('tank'),{x:430,y:90,binding:'Process_Level'}),Object.assign(newObject('input'),{x:200,y:190,text:'Consigna',binding:'Process_Setpoint'}),Object.assign(newObject('button'),{x:40,y:270,text:'Marcha SET',binding:'Start_Request',actionMode:'set'})];p.alarms=[{id:id(),name:'Nivel alto',binding:'Process_Level',operator:'gt',value:90,severity:'high'}];p.recipes=[{id:id(),name:'Producción 50',scope:'shared',values:{Process_Setpoint:50}}];p.recipeEnabled=true;return p;}
function variableMap(p){return new Map(p.variables.map(v=>[v.name,v]));}
function typedFor(v,value){if(v.type==='BOOL'){if(value===true||value===false)return value;if(String(value).toLowerCase()==='true'||String(value)==='1')return true;if(String(value).toLowerCase()==='false'||String(value)==='0')return false;throw new Error('BOOL inválido');}if(NUMERIC_TYPES.has(v.type)){const n=Number(value);if(!Number.isFinite(n))throw new Error('Número inválido');return n;}return String(value);}
const RECIPE_SHARED_MAX=12,RECIPE_LOCAL_MAX=24,RECIPE_BYTES_MAX=500;
function recipeWireJSON(r){return JSON.stringify({id:r.id,name:r.name,values:r.values||{}}).replace(/[^\x00-\x7F]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));}
function recipeDefaultValue(v){return v.type==='BOOL'?false:v.type==='STRING'?'':0;}
function nextRecipeCopyName(source,recipes){
 const used=new Set(recipes.filter(r=>r.scope===source.scope).map(r=>r.name.trim().toLocaleLowerCase()));
 for(let n=1;n<=999;n++){
  const suffix=n===1?' (copia)':' (copia '+n+')';
  const candidate=String(source.name||'Receta').slice(0,48-suffix.length).trimEnd()+suffix;
  if(!used.has(candidate.trim().toLocaleLowerCase()))return candidate;
 }
 throw new Error('No queda un nombre disponible para duplicar esta receta');
}
function duplicateRecipe(source,recipes){
 const clone=copy(source);
 clone.id=id();
 clone.name=nextRecipeCopyName(source,recipes);
 clone.values=copy(source.values||{});
 return clone;
}

function validate(input){const p=normalize(input),e=[];if(!Number.isInteger(+p.port)||p.port<1024||p.port>65535)e.push('Puerto: use 1024..65535.');if(!Number.isInteger(+p.pollMs)||p.pollMs<100||p.pollMs>5000)e.push('Polling: 100..5000 ms.');if(!Number.isInteger(+p.width)||p.width<320||p.width>3840)e.push('Ancho de diseño: 320..3840 px.');if(!Number.isInteger(+p.height)||p.height<240||p.height>2160)e.push('Alto de diseño: 240..2160 px.');if(p.minDisplayWidth>p.maxDisplayWidth)e.push('El ancho mínimo no puede superar al máximo.');if(p.screens.length>20)e.push('Máximo 20 pantallas en esta versión.');const exposed=p.variables.filter(v=>v.expose&&v.live);if(exposed.length>32)e.push('máximo 32 variables expuestas en esta versión.');const vm=variableMap(p),internalNames=new Set();for(const v of p.internalVariables){if(!nameOK(v.name)||v.name.startsWith('PLC.')||v.name.startsWith('HMI.'))e.push('Variable interna: nombre no válido '+v.name);if(vm.has(v.name)||internalNames.has(v.name))e.push('Variable interna duplicada: '+v.name);internalNames.add(v.name);if(v.type==='BOOL'&&!['true','false','1','0'].includes(String(v.value).toLowerCase()))e.push(v.name+': valor BOOL interno no válido');if(['INT','REAL'].includes(v.type)&&!Number.isFinite(Number(v.value)))e.push(v.name+': valor numérico interno no válido');}const assetIds=new Set(p.assets.map(a=>a.id)),screenIds=new Set(p.screens.map(s=>s.id));if(p.screenBinding){const screenTag=vm.get(p.screenBinding);if(!screenTag)e.push('Control de pantalla PLC: variable no encontrada.');else if(!INTEGER_TYPES.has(screenTag.type)||!screenTag.live||!screenTag.expose)e.push('Control de pantalla PLC: selecciona una variable entera expuesta (SINT/USINT/INT/UINT/DINT/UDINT/LINT/ULINT).');}const screenNumbers=new Set();let assetTotal=0;for(const a of p.assets){const bytes=dataUrlBytes(a.data);assetTotal+=bytes;if(!/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+\/\s]*={0,2}$/i.test(String(a.data||'')))e.push('Imagen '+(a.name||a.id)+': formato embebido no válido.');if(bytes>IMAGE_MAX_BYTES)e.push('Imagen '+(a.name||a.id)+': supera el límite estricto de 64 KB.');}if(assetTotal>IMAGE_TOTAL_MAX_BYTES)e.push('Imágenes del proyecto: superan el límite total estricto de 256 KB.');for(const v of p.variables){if(v.access==='RW'&&!v.writeSupported)e.push(v.name+': escritura no soportada para '+v.type+(v.type==='STRING'?' (máximo 512 bytes en esta versión)':'')+'.');}
 for(const s of [...p.screens,...(p.baseScreen?[p.baseScreen]:[])]){if(!s.name)e.push('Pantalla sin nombre.');if(s!==p.baseScreen){if(s.useBase&&!p.baseScreen)e.push(s.name+': pantalla base no disponible.');if(!Number.isInteger(s.number)||s.number<1||s.number>MAX_SCREEN_NUMBER)e.push('Número de pantalla no válido (1..'+MAX_SCREEN_NUMBER+'): '+s.name);else if(screenNumbers.has(s.number))e.push('Número de pantalla duplicado: '+s.number);else screenNumbers.add(s.number);}if(!/^#[0-9a-f]{6}$/i.test(s.background))e.push('Color de fondo no válido: '+s.name);for(const o of s.objects){if(o.fontSize!==null&&(!Number.isInteger(o.fontSize)||o.fontSize<8||o.fontSize>120))e.push(s.name+' / '+(o.text||o.kind)+': tamaño de letra entre 8 y 120 px.');for(const key of ['expressionText','expressionColor','expressionBackground','expressionVisible'])if(o[key]){const error=globalThis.NXExpressions?.validate(o[key]);if(error)e.push(s.name+' / '+(o.text||o.kind)+' / '+key+': '+error);}if(o.kind==='shape'){if(!SHAPE_TYPES.has(o.shapeType))e.push(s.name+' / '+o.text+': figura no válida.');if(!/^#[0-9a-f]{6}$/i.test(o.shapeFill)||!/^#[0-9a-f]{6}$/i.test(o.shapeStroke))e.push(s.name+' / '+o.text+': colores de figura no válidos.');if(!Number.isFinite(o.shapeStrokeWidth)||o.shapeStrokeWidth<0||o.shapeStrokeWidth>20)e.push(s.name+' / '+o.text+': grosor de trazo 0..20.');if(shapeCoordinates(o.shapeType,o.shapePoints)===null)e.push(s.name+' / '+o.text+': define vértices o extremos válidos de 0 a 100 sin repetir ni alinear los tres vértices.');continue;}if(o.kind==='text'){
 if(o.optionsText.trim()){
  if(!o.binding)e.push(s.name+' / '+(o.text||'Texto')+': asocia una variable para los mensajes dinámicos.');
  const lines=o.optionsText.split(/\r?\n/).filter(line=>line.trim());
  if(lines.some(line=>!/^\s*[^=\s][^=]*\s*=\s*\S.*$/.test(line)))e.push((o.text||'Texto')+': los mensajes requieren formato valor=texto.');
  const tag=vm.get(o.binding)||p.internalVariables.find(v=>v.name===o.binding);
  if(o.binding&&!tag)e.push(s.name+' / '+(o.text||'Texto')+': variable dinámica no encontrada.');
  else if(o.binding&&tag&&p.variables.some(v=>v.name===o.binding)&&!tag.expose)e.push(s.name+' / '+(o.text||'Texto')+': variable dinámica no expuesta.');
 }
 continue;
}if(['slider','gauge','stepper','counter'].includes(o.kind)){if(!(Number.isFinite(o.min)&&Number.isFinite(o.max)&&o.max>o.min))e.push(o.text+': rango mínimo/máximo inválido.');if(['slider','stepper'].includes(o.kind)&&(!Number.isFinite(o.step)||o.step<=0))e.push(o.text+': paso inválido.');}if(['selector','multistate','dropdown'].includes(o.kind)){const pairs=o.optionsText.split(/\r?\n/).filter(x=>x.trim());if(!pairs.length||pairs.some(x=>!/^\s*-?\d+\s*=.+$/.test(x)))e.push(o.text+': opciones deben tener formato número=etiqueta.');}if(o.kind==='image'){if(!assetIds.has(o.assetId))e.push(s.name+': selecciona imagen FALSE/OFF para '+o.text);if(o.binding){const iv=vm.get(o.binding)||p.internalVariables.find(v=>v.name===o.binding);if(!iv)e.push(o.text+': variable BOOL de imagen no válida.');else{if(iv.type!=='BOOL')e.push(o.text+': el cambio de imagen requiere BOOL.');if(vm.has(o.binding)&&!iv.expose)e.push(o.text+': la variable de cambio de imagen debe estar expuesta.');}if(!assetIds.has(o.assetOnId))e.push(s.name+': selecciona imagen TRUE/ON para '+o.text);}continue;}if(o.kind==='button'&&['navigate','popup'].includes(o.actionType)){if(!screenIds.has(o.targetScreenId))e.push(o.text+': selecciona pantalla destino.');if(o.feedbackBinding){const fb=vm.get(o.feedbackBinding)||p.internalVariables.find(v=>v.name===o.feedbackBinding);if(!fb)e.push(o.text+': variable de feedback no válida.');else{if(fb.type!=='BOOL')e.push(o.text+': feedback requiere BOOL.');if(vm.has(o.feedbackBinding)&&!fb.expose)e.push(o.text+': la variable de feedback debe estar expuesta.');}if(!/^#[0-9a-f]{6}$/i.test(o.feedbackColorOff||'')||!/^#[0-9a-f]{6}$/i.test(o.feedbackColorOn||''))e.push(o.text+': colores de feedback no válidos.');}continue;}if(o.kind==='button'&&o.actionType==='closePopup')continue;const v=vm.get(o.binding)||p.internalVariables.find(v=>v.name===o.binding);if(!v)e.push(s.name+' / '+o.text+': selecciona variable.');else{if(['button','input','slider','switch','selector','stepper','dropdown'].includes(o.kind)&&vm.has(o.binding)&&v.access!=='RW')e.push(o.text+': requiere variable RW.');if((BOOL_WIDGETS.has(o.kind)||['button','switch'].includes(o.kind))&&v.type!=='BOOL')if(!e.includes(o.text+': requiere BOOL.'))e.push(o.text+': requiere BOOL.');if(['bar','tank','slider','gauge','stepper','counter'].includes(o.kind)&&!NUMERIC_TYPES.has(v.type))e.push(o.text+': requiere tipo numérico.');if(['selector','multistate','dropdown'].includes(o.kind)&&!['INT','UINT','DINT','UDINT','SINT','USINT','LINT','ULINT'].includes(v.type))e.push(o.text+': requiere variable entera.');if(o.kind==='input'&&!(NUMERIC_TYPES.has(v.type)||v.type==='STRING'||['BYTE','WORD','DWORD','LWORD','TIME','DATE','TIME_OF_DAY','DATE_AND_TIME'].includes(v.type)))e.push(o.text+': requiere tipo numérico, bitstring, temporal o STRING.');}if(o.kind==='status'){if(!STATUS_SYMBOLS.has(o.symbolType))e.push(o.text+': símbolo de estado no válido.');if(!['true','false'].includes(o.stateOnWhen))e.push(o.text+': mapeo ON/OFF no válido.');}if(o.kind==='input'&&v&&NUMERIC_TYPES.has(v.type)){if(o.inputMin!==null&&!Number.isFinite(Number(o.inputMin)))e.push(o.text+': límite inferior no válido.');if(o.inputMax!==null&&!Number.isFinite(Number(o.inputMax)))e.push(o.text+': límite superior no válido.');if(o.inputMin!==null&&o.inputMax!==null&&Number(o.inputMin)>Number(o.inputMax))e.push(o.text+': el límite inferior no puede superar al superior.');}if(o.kind==='button'){if(!['set','reset','toggle'].includes(o.actionMode))e.push(o.text+': modo SET/RESET/TOGGLE no válido.');if(o.feedbackBinding){const fb=vm.get(o.feedbackBinding)||p.internalVariables.find(v=>v.name===o.feedbackBinding);if(!fb)e.push(o.text+': variable de feedback no válida.');else{if(fb.type!=='BOOL')e.push(o.text+': feedback requiere BOOL.');if(vm.has(o.feedbackBinding)&&!fb.expose)e.push(o.text+': la variable de feedback debe estar expuesta.');}if(!/^#[0-9a-f]{6}$/i.test(o.feedbackColorOff||'')||!/^#[0-9a-f]{6}$/i.test(o.feedbackColorOn||''))e.push(o.text+': colores de feedback no válidos.');}}if(o.kind==='dynamicText'&&!o.optionsText.trim()&&!o.expressionText.trim())e.push(o.text+': configura mensajes valor=texto o una expresión de texto.');if(['value','input','slider','stepper','gauge','counter'].includes(o.kind)&&(o.decimals<0||o.decimals>6))e.push(o.text+': decimales 0..6.');}}
 const alarmIds=new Set();for(const a of p.alarms){if(alarmIds.has(a.id))e.push('ID de alarma duplicado.');alarmIds.add(a.id);const v=vm.get(a.binding)||p.internalVariables.find(v=>v.name===a.binding);if(!v)e.push('Alarma '+a.name+': variable no válida.');if(!['eq','ne','gt','ge','lt','le'].includes(a.operator))e.push('Alarma '+a.name+': operador no válido.');if(v&&v.type==='STRING'&&!['eq','ne'].includes(a.operator))e.push('Alarma '+a.name+': STRING sólo admite = o ≠.');if(v&&v.type==='BOOL'&&!['eq','ne'].includes(a.operator))e.push('Alarma '+a.name+': BOOL sólo admite = o ≠.');if(v)try{typedFor(v,a.value)}catch{e.push('Alarma '+a.name+': umbral no válido.');}}
 if(p.recipeEnabled){
 const eligible=new Map([...p.variables.filter(v=>v.access==='RW'&&v.writeSupported&&v.live),...p.internalVariables].map(v=>[v.name,v]));
 if(!Number.isInteger(p.recipeSlots)||p.recipeSlots<1||p.recipeSlots>32)e.push('Banco NX: número de recetas entre 1 y 32.');
 if(!Number.isInteger(p.recipeBytes)||p.recipeBytes<64||p.recipeBytes>500)e.push('Banco NX: bytes por receta entre 64 y 500.');
 if(p.recipeEnabled&&p.recipes.length>p.recipeSlots)e.push('Banco NX: máximo '+p.recipeSlots+' recetas con la capacidad configurada.');
 const recipeNames=new Set(),recipeIds=new Set();
 for(const r of p.recipes){
  if(!r.name.trim()||r.name.length>48)e.push('Receta: nombre obligatorio (máximo 48 caracteres).');
  if(recipeIds.has(r.id))e.push('ID de receta duplicado: '+r.name);recipeIds.add(r.id);
  if(r.scope!=='shared')e.push('Receta '+r.name+': almacenamiento obligatorio NX Retain.');
  const key=r.scope+':'+r.name.trim().toLocaleLowerCase();if(recipeNames.has(key))e.push('Nombre de receta repetido: '+r.name);recipeNames.add(key);
  if(Object.keys(r.values||{}).length>20)e.push('Receta '+r.name+': máximo 20 valores.');
  for(const [name,val] of Object.entries(r.values||{})){const v=eligible.get(name);if(!v)e.push('Receta '+r.name+': '+name+' requiere variable PLC RW compatible o HMI interna.');else{try{typedFor(v,val)}catch{e.push('Receta '+r.name+': valor inválido en '+name);}}}
  if(p.recipeEnabled&&new TextEncoder().encode(recipeWireJSON(r)).length>p.recipeBytes)e.push('Receta '+r.name+': supera '+p.recipeBytes+' bytes en memoria NX.');
 }
 }
 return [...new Set(e)];}

// Extra Light is an export profile, never an editor downgrade. Unused PLC variables
// do not consume its 16-tag budget, but every visible supported widget is retained.
const LITE_KINDS=new Set(['text','value','status','button','input','bar']);
const LITE_TYPES=new Set(['BOOL','INT','REAL']);
const LITE_MAX_VARS=16;
function liteWidgetIssue(o,variables){
 if(!LITE_KINDS.has(o.kind))return 'tipo '+o.kind+' no disponible';
 if(['expressionText','expressionColor','expressionBackground','expressionVisible'].some(k=>String(o[k]||'').trim()))return 'expresiones dinámicas no disponibles';
 if(o.kind==='text')return o.binding||String(o.optionsText||'').trim()?'texto dinámico no disponible':'';
 if(o.kind==='status'&&o.symbolType!=='lamp')return 'símbolo '+o.symbolType+' no disponible (usar lámpara)';
 if(o.kind==='button'){
  if(o.actionType!=='write'||!['set','reset'].includes(o.actionMode))return 'pulsador: solamente SET/RESET de BOOL';
  if(o.feedbackBinding||o.feedbackTextOn||o.feedbackTextOff)return 'feedback avanzado no disponible';
 }
 const v=variables.get(o.binding);
 if(!v)return 'variable PLC '+(o.binding||'(sin asociar)')+' no disponible';
 if(!v.expose||!v.live)return 'variable '+v.name+' no expuesta';
 if(!LITE_TYPES.has(v.type))return 'tipo de variable '+v.type+' no disponible';
 if(['status','button'].includes(o.kind)&&v.type!=='BOOL')return 'requiere variable BOOL';
 if(['value','input','bar'].includes(o.kind)&&!['INT','REAL'].includes(v.type))return 'requiere INT o REAL';
 if(['button','input'].includes(o.kind)&&(v.access!=='RW'||!v.writeSupported))return 'variable '+v.name+' sin permiso de escritura';
 if(o.kind==='bar'&&!(o.max>o.min))return 'rango de barra incorrecto';
 if(o.kind==='input'&&o.inputMin!==null&&o.inputMax!==null&&o.inputMin>o.inputMax)return 'límites de entrada invertidos';
 return '';
}
function liteAnalysis(input,screenId){
 const p=normalize(input),s=p.screens.find(s=>s.id===screenId)||p.screens[0];
 const variables=new Map(p.variables.map(v=>[v.name,v]));
 const issues=[],omitted=[],used=new Set(),supported=[];
 if(p.screens.length!==1)issues.push('Extra Light permite una pantalla; el proyecto tiene '+p.screens.length+'.');
 if(p.recipeEnabled||p.recipes.length)issues.push('Las recetas no se incluyen en Extra Light.');
 if(p.alarms.length)issues.push('Las '+p.alarms.length+' alarmas no se incluyen en Extra Light.');
 if(p.assets.length)issues.push('Las imágenes embebidas no están disponibles en Extra Light.');
 if(p.screenBinding)issues.push('La navegación gobernada por PLC no está disponible.');
 const objects=screenObjects(p,s);
 for(const o of objects){
  const why=liteWidgetIssue(o,variables);
  if(why){const message=s.name+' / '+(o.text||o.kind)+': '+why;omitted.push(message);issues.push(message);}
  else{supported.push(o);if(o.kind!=='text')used.add(o.binding);}
 }
 if(used.size>LITE_MAX_VARS)issues.push('Se usan '+used.size+' variables PLC; Extra Light admite hasta '+LITE_MAX_VARS+'.');
 // Do not bypass existing project validation when exporting the untouched design.
 for(const err of validate(p))if(!issues.includes(err))issues.push('Proyecto: '+err);
 return {screenId:s.id,screenName:s.name,issues,omitted,usedVariables:[...used],supportedCount:supported.length,totalCount:objects.length};
}
function liteCopy(input,screenId){
 const p=normalize(input),screen=p.screens.find(s=>s.id===screenId);
 if(!screen)throw Error('Selecciona una pantalla válida para la copia Extra Light.');
 const variables=new Map(p.variables.map(v=>[v.name,v])),kept=[],omitted=[],used=new Set();
 for(const o of screenObjects(p,screen)){
  const problem=liteWidgetIssue(o,variables);
  if(problem){omitted.push((o.text||o.kind)+': '+problem);continue}
  kept.push(copy(o));if(o.kind!=='text')used.add(o.binding);
 }
 if(used.size>LITE_MAX_VARS)throw Error('La pantalla seleccionada usa '+used.size+' variables compatibles; reduce a '+LITE_MAX_VARS+' antes de generar una copia.');
 const q=copy(p);q.name=(p.name+' Extra Light').slice(0,100);
 q.screens=[{...copy(screen),objects:kept,useBase:false}];q.baseScreen=null;
 q.variables=p.variables.filter(v=>used.has(v.name)).map(copy);q.internalVariables=[];
 q.screenBinding='';q.alarms=[];q.assets=[];q.recipes=[];q.recipeVariables=[];
 q.recipeEnabled=false;
 const normalized=normalize(q),errors=validate(normalized);
 if(errors.length)throw Error('La copia requiere corregir: '+errors.join('; '));
 const changes=[];
 if(p.screens.length>1)changes.push((p.screens.length-1)+' pantallas excluidas');
 if(p.alarms.length)changes.push(p.alarms.length+' alarmas excluidas');
 if(p.recipeEnabled||p.recipes.length)changes.push('banco de recetas excluido');
 if(p.assets.length)changes.push(p.assets.length+' imágenes excluidas');
 if(p.screenBinding)changes.push('navegación PLC excluida');
 if(p.baseScreen&&screen.useBase)changes.push('capa base incorporada como elementos independientes');
 return {project:normalized,omitted,changes,retained:kept.length};
}
root.NXST=Object.assign(root.NXST||{},{LIVE_TYPES,WRITE_TYPES,NUMERIC_TYPES,INTEGER_TYPES,MAX_SCREEN_NUMBER,BOOL_WIDGETS,STATUS_SYMBOLS,STATUS_LABELS,SHAPE_TYPES,SHAPE_LABELS,defaultShapePoints,shapeCoordinates,shapeSvg,LEGACY_STATUS_KINDS,statusSvg,optionalNumber,IMAGE_MAX_BYTES,IMAGE_TOTAL_MAX_BYTES,HTML_MAX_BYTES,IMAGE_OPTIMIZE_MAX_DIM,dataUrlBytes,id,copy,esc,typeInfo,nameOK,parseDelimited,importSysmac,RECIPE_SHARED_MAX,RECIPE_LOCAL_MAX,RECIPE_BYTES_MAX,recipeWireJSON,recipeDefaultValue,nextRecipeCopyName,duplicateRecipe,newProject,newScreen,newBaseScreen,screenObjects,moveWidgetLayer,setScreenMode,nextScreenNumber,duplicateScreen,newObject,demoProject,normalize,typedFor,validate,LITE_KINDS,LITE_MAX_VARS,liteWidgetIssue,liteAnalysis,liteCopy});
})(globalThis);


(function(root){
'use strict';
const C=root.NXST;
const previousImport=C.importSysmac,previousValidate=C.validate;
const BASIC=new Set(['BOOL','SINT','USINT','INT','UINT','DINT','UDINT','LINT','ULINT','REAL','LREAL','STRING','BYTE','WORD','DWORD','LWORD','TIME','DATE','TIME_OF_DAY','DATE_AND_TIME']);
const BIT_TYPES=new Set(['BYTE','WORD','DWORD','LWORD']);
const TIME_TYPES=new Set(['TIME','DATE','TIME_OF_DAY','DATE_AND_TIME']);
const LONG_TYPES=new Set(['LINT','ULINT','LWORD']);
const DATE_TYPES=new Set(['DATE','TIME_OF_DAY','DATE_AND_TIME']);
const alias={TOD:'TIME_OF_DAY',DT:'DATE_AND_TIME'};
const identifier=/^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_IMPORTED_LEAVES=1024;
const range={SINT:[-128n,127n],USINT:[0n,255n],INT:[-32768n,32767n],UINT:[0n,65535n],DINT:[-2147483648n,2147483647n],UDINT:[0n,4294967295n],LINT:[-9223372036854775808n,9223372036854775807n],ULINT:[0n,18446744073709551615n],BYTE:[0n,255n],WORD:[0n,65535n],DWORD:[0n,4294967295n],LWORD:[0n,18446744073709551615n],TIME:[-9223372036854775808n,9223372036854775807n]};
function canonical(raw){const s=String(raw||'').trim().toUpperCase();return alias[s]||s}
function shortType(raw){return /^\s*STRING\s*[\[(]/i.test(raw)?'STRING':canonical(raw)}
function typeDefs(text){
 const out=new Map(),remove=[];
 const source=String(text||'');
 const structure=/(?:\bTYPE\s+)?([A-Za-z_]\w*)\s*:\s*(STRUCT|UNION)\b([\s\S]*?)\bEND_(STRUCT|UNION)\b\s*;?/gi;
 for(const match of source.matchAll(structure)){
  if(match[2].toUpperCase()!==match[4].toUpperCase())throw Error('END_ incorrecto en '+match[1]);
  const body=match[3].replace(/\(\*[\s\S]*?\*\)/g,'').replace(/\/\/[^\r\n]*/g,'');
  const members=[];
  for(const section of body.split(';')){
   const m=section.trim().match(/^([A-Za-z_]\w*)\s*:\s*([\s\S]+)$/);
   if(!m)continue;
   if(!identifier.test(m[1]))throw Error('Miembro invalido '+m[1]);
   members.push({name:m[1],type:m[2].trim().replace(/\s*:=\s*[\s\S]*$/,'')});
  }
  if(!members.length)throw Error('Tipo '+match[1]+' sin miembros');
  out.set(match[1].toUpperCase(),{name:match[1],kind:match[2].toUpperCase(),members});
  remove.push([match.index,match.index+match[0].length]);
 }
 // Sysmac enumerations are named integer constants. Accept IEC (A:=0,B:=1) declarations.
 const enumerated=/(?:\bTYPE\s+)?([A-Za-z_]\w*)\s*:\s*\(\s*([A-Za-z_]\w*\s*(?::=\s*-?\d+)?(?:\s*,\s*[A-Za-z_]\w*\s*(?::=\s*-?\d+)?)*\s*)\)\s*;/gi;
 for(const match of source.matchAll(enumerated)){
  if(remove.some(([start,end])=>match.index>=start&&match.index<end))continue;
  let next=0;const values={};
  for(const item of match[2].split(',')){
   const m=item.trim().match(/^([A-Za-z_]\w*)(?:\s*:=\s*(-?\d+))?$/);
   if(!m)throw Error('Enumeracion invalida: '+match[1]);
   if(m[2]!==undefined)next=Number(m[2]);
   if(!Number.isSafeInteger(next)||next< -2147483648||next>2147483647)throw Error('Enumeracion fuera de DINT: '+match[1]);
   values[m[1]]=next++;
  }
  out.set(match[1].toUpperCase(),{name:match[1],kind:'ENUM',values});
  remove.push([match.index,match.index+match[0].length]);
 }
 let cleaned=source;
 for(const [start,end] of remove.sort((a,b)=>b[0]-a[0]))cleaned=cleaned.slice(0,start)+cleaned.slice(end);
 cleaned=cleaned.replace(/\bEND_TYPE\b\s*;?/gi,'');
 return {defs:out,cleaned};
}
function variableDeclarations(text){
 const src=String(text||'').replace(/\(\*[\s\S]*?\*\)/g,'').replace(/\/\/[^\r\n]*/g,'');
 const result=[];
 for(let row of src.split(';')){
  row=row.replace(/\b(?:VAR_GLOBAL|VAR_EXTERNAL|VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|VAR|END_VAR|TYPE|END_TYPE|RETAIN|PERSISTENT)\b/gi,'').trim();
  const m=row.match(/^([A-Za-z_]\w*)\s*:\s*([\s\S]+)$/);
  if(!m)continue;
  result.push({name:m[1],type:m[2].trim().replace(/\s*:=\s*[\s\S]*$/,'')});
 }
 return result;
}
function csvDeclarations(text){
 const rows=C.parseDelimited(text);
 const names=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_.\-/]/g,'');
 const h=(rows[0]||[]).map(names);
 let ni=h.findIndex(x=>['name','nombre','variablename','variable','symbol','simbolo'].includes(x));
 let ti=h.findIndex(x=>['datatype','type','tipo','tipodedatos','datatypeofvariable'].includes(x));
 let from=1;
 if(ni<0||ti<0){ni=0;ti=1;from=0}
 return rows.slice(from).filter(r=>r[ni]&&r[ti]).map(r=>({name:r[ni].trim(),type:r[ti].trim(),comment:r[2]||''}));
}
function expand(rootName,rootType,defs){
 const results=[];
 function walk(name,type,depth,stack){
  if(depth>8)throw Error('Anidamiento mayor de 8 en '+rootName);
  const raw=String(type||'').trim(),array=raw.match(/^ARRAY\s*\[([^\]]+)\]\s*OF\s*(.+)$/i);
  if(array){
   const dims=array[1].split(',').map(x=>{const m=x.trim().match(/^(-?\d+)\s*\.\.\s*(-?\d+)$/);if(!m)throw Error('Rango ARRAY invalido: '+x);const a=Number(m[1]),b=Number(m[2]);if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||b<a)throw Error('Rango ARRAY invalido: '+x);return [a,b]});
   if(dims.length>3)throw Error('Sysmac admite hasta 3 dimensiones: '+name);
   const count=dims.reduce((v,[a,b])=>v*(b-a+1),1);
   if(count>MAX_IMPORTED_LEAVES||results.length+count>MAX_IMPORTED_LEAVES)throw Error('ARRAY muy grande: limita la seleccion a '+MAX_IMPORTED_LEAVES+' miembros por importacion');
   function indices(depth2,selection){if(depth2===dims.length){walk(name+'['+selection.join(',')+']',array[2],depth+1,stack);return}const [start,end]=dims[depth2];for(let i=start;i<=end;i++)indices(depth2+1,[...selection,i])}
   indices(0,[]);return;
  }
  const info=C.typeInfo(raw),t=shortType(raw),custom=defs.get(t);
  if(custom){
   if(stack.includes(t))throw Error('Tipo recursivo: '+[...stack,t].join(' -> '));
   if(custom.kind==='ENUM'){results.push({name,type:'DINT',sourceType:raw,enumType:custom.name,enumValues:custom.values})}
   else for(const member of custom.members)walk(name+'.'+member.name,member.type,depth+1,[...stack,t]);
  }else if(BASIC.has(t)){
   results.push({name,type:t,sourceType:raw,stringLength:info.length||255});
  }else throw Error('Tipo Sysmac no definido: '+raw+' ('+name+'). Importa tambien su definicion STRUCT/UNION/ENUM.');
  if(results.length>MAX_IMPORTED_LEAVES)throw Error('Limite de '+MAX_IMPORTED_LEAVES+' elementos por importacion');
 }
 walk(rootName,rootType,0,[]);
 return results.map(r=>({...r,plcRoot:rootName,plcRootType:rootType,plcExpression:r.name}));
}
function importSysmac(text){
 const raw=String(text||'').trim();if(!raw)throw Error('No hay variables para importar');
 const parsed=typeDefs(raw),body=parsed.cleaned;
 let roots=/\b(?:VAR_GLOBAL|VAR_EXTERNAL|VAR|END_VAR)\b/i.test(body)||/^\s*[A-Za-z_]\w*\s*:/m.test(body)?variableDeclarations(body):csvDeclarations(body);
 if(!roots.length){try{return previousImport(raw)}catch{throw Error('No se reconocen declaraciones de variables Sysmac')}}
 let result=[],seen=new Set(),active=0;
 for(const d of roots){
  if(!identifier.test(d.name))throw Error('Nombre no valido: '+d.name);
  if(seen.has(d.name))throw Error('Variable duplicada: '+d.name);
  seen.add(d.name);
  for(const leaf of expand(d.name,d.type,parsed.defs)){
   if(result.some(v=>v.name===leaf.name))throw Error('Miembro duplicado: '+leaf.name);
   const originalType=leaf.type,writeSupported=originalType!=='STRING'||leaf.stringLength<=512;
   result.push({id:result.length+1,...leaf,comment:d.comment||'',access:'R',expose:active++<32,live:true,writeSupported});
  }
 }
 return result;
}
function validate(input){
 const errors=previousValidate(input),p=C.normalize(input);
 const found=new Set(),roots=new Map();
 for(const r of p.recipes||[])for(const [name,value] of Object.entries(r.values||{})){
  const variable=p.variables.find(v=>v.name===name);
  if(!variable)continue;
  if(variable.enumValues&&!Object.values(variable.enumValues).includes(Number(value)))errors.push('Receta '+r.name+': valor de enumeracion no definido en '+name);
  if([...BIT_TYPES,...LONG_TYPES,'TIME','SINT','USINT','INT','UINT','DINT','UDINT',...DATE_TYPES].includes(variable.type))try{canonicalWrite(variable.type,value)}catch(e){errors.push('Receta '+r.name+' / '+name+': '+e.message)}
 }
 for(const alarm of p.alarms||[]){
  const variable=p.variables.find(v=>v.name===alarm.binding);
  if(!variable)continue;
  if(variable.enumValues&&!Object.values(variable.enumValues).includes(Number(alarm.value)))errors.push('Alarma '+alarm.name+': valor de enumeracion no definido');
  if([...BIT_TYPES,...LONG_TYPES,'TIME','SINT','USINT','INT','UINT','DINT','UDINT',...DATE_TYPES].includes(variable.type))try{canonicalWrite(variable.type,alarm.value)}catch(e){errors.push('Alarma '+alarm.name+': '+e.message)}
 }
 for(const v of p.variables){
  if(!/^[A-Za-z_]\w*(?:\[-?\d+(?:,-?\d+){0,2}\])?(?:\.[A-Za-z_]\w*(?:\[-?\d+(?:,-?\d+){0,2}\])?)*$/.test(v.name))errors.push('Nombre Sysmac de variable no valido: '+v.name);
  if(found.has(v.name))errors.push('Variable duplicada: '+v.name);
  found.add(v.name);
  if(v.plcRoot){
   const old=roots.get(v.plcRoot),now=v.plcRootType;
   if(old&&old!==now)errors.push('Declaracion global incompatible para '+v.plcRoot);
   roots.set(v.plcRoot,now);
   if(!/^[A-Za-z_]\w*$/.test(v.plcRoot)||!now||!/^(?:ARRAY\s*\[[^\]]+\]\s*OF\s*)*[A-Za-z_]\w*(?:\[\d+\])?$/i.test(now))errors.push('Tipo global invalido de '+v.name);
  }
  if(v.enumType&&!/^[A-Za-z_]\w*$/.test(v.enumType))errors.push('Enumeracion no valida: '+v.name);
 }
 return errors;
}
function normalize(input){
 const p=previousNormalize(input);
 for(const v of p.variables){
  const t=shortType(v.type);
  if(BASIC.has(t)){v.type=t;v.live=true;v.writeSupported=t!=='STRING'||v.stringLength<=512}
  if(v.enumType){v.type='DINT';v.live=true;v.writeSupported=true}
 }
 return p;
}
const previousNormalize=C.normalize;
function canonicalWrite(type,value){
 const t=shortType(type);
 if(BIT_TYPES.has(t)){
  const width={BYTE:2,WORD:4,DWORD:8,LWORD:16}[t],s=String(value).trim().replace(/^(?:16#|0x)/i,'');
  if(!/^[0-9a-f]+$/i.test(s)||s.length>width)throw Error(t+': escribe de 1 a '+width+' digitos hexadecimales');
  return s.toUpperCase().padStart(width,'0');
 }
 if([...LONG_TYPES,'TIME'].includes(t)||/^(?:SINT|USINT|INT|UINT|DINT|UDINT)$/.test(t)){
  const raw=String(value).trim();
  if(!/^[+-]?\d+$/.test(raw))throw Error(t+': se requiere numero entero exacto');
  const n=BigInt(raw),limit=range[t];
  if(limit&&(n<limit[0]||n>limit[1]))throw Error(t+': fuera de rango');
  return n.toString();
 }
 if(DATE_TYPES.has(t)){
  const text=String(value).trim();
  const datePattern=/^\d{4}-\d{2}-\d{2}$/;
  const timePattern=/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
  if(t==='TIME_OF_DAY'){const match=text.match(timePattern);if(!match)throw Error('TOD: formato HH:mm:ss, resolucion 1 s');return String(Number(match[1])*3600+Number(match[2])*60+Number(match[3]))}
  const date=t==='DATE'?text:text.slice(0,10),clock=t==='DATE'?'00:00:00':text.slice(11);
  if(!datePattern.test(date)||(t==='DATE_AND_TIME'&&(!/^\d{4}-\d{2}-\d{2}-(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(text)||!timePattern.test(clock))))throw Error('DATE/DT: usa YYYY-MM-DD o YYYY-MM-DD-HH:mm:ss sin fracciones');
  const [year,month,day]=date.split('-').map(Number),[hh,mm,ss]=clock.split(':').map(Number);
  if(year<1970||year>9999)throw Error('Fecha fuera del rango 1970..9999');
  const ms=Date.UTC(year,month-1,day,hh,mm,ss);
  const actual=new Date(ms);
  if(!Number.isFinite(ms)||actual.getUTCFullYear()!==year||actual.getUTCMonth()!==month-1||actual.getUTCDate()!==day)throw Error('Fecha no valida');
  return String(Math.floor(ms/1000));
 }
 return String(value);
}
C.importSysmac=importSysmac;C.normalize=normalize;C.validate=validate;
C.sysmacTypes={BASIC,BIT_TYPES,TIME_TYPES,LONG_TYPES,DATE_TYPES,parseDefinitions:typeDefs,expand,canonical,canonicalWrite};
})(globalThis);

(function(root){'use strict';const C=root.NXST;
function htmlEscapeText(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\$/g,'&#36;').replace(/[^\x00-\x7F]/g,c=>'&#'+c.codePointAt(0)+';');}
function asciiJSON(x){return JSON.stringify(x).replace(/</g,'\\u003c').replace(/'/g,'\\u0027').replace(/\$/g,'\\u0024').replace(/[^\x00-\x7F]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));}
// Only PLC tags used on the selected screen are polled. The shared base screen,
// alarm status and PLC screen selector remain available on every read.
function screenReadNames(p,screen){
 const exposed=new Set(p.variables.filter(v=>v.expose&&v.live).map(v=>v.name));
 const used=new Set();
 function add(name){const key=String(name||'').replace(/^PLC\./,'');if(exposed.has(key))used.add(key);}
 add(p.screenBinding);
 for(const o of C.screenObjects(p,screen)){
  add(o.binding);add(o.feedbackBinding);
  for(const expression of [o.expressionText,o.expressionColor,o.expressionBackground,o.expressionVisible]){
   const source=String(expression||'').replace(/"(?:\\.|[^"\\])*"/g,'');
   for(const token of source.match(/[A-Za-z_][A-Za-z0-9_.]*/g)||[])add(token);
  }
 }
 return p.variables.filter(v=>used.has(v.name)&&v.expose&&v.live).map(v=>v.name);
}
C.screenReadNames=screenReadNames;
function buildRuntimeHTML(input){
 const p=C.normalize(input),vars=p.variables.filter(v=>v.expose&&v.live).map(v=>({id:v.id,name:v.name,type:v.type,access:v.access,stringLength:v.stringLength||255,enumType:v.enumType||'',enumValues:v.enumValues||null}));
 const screens=p.screens.map(s=>({id:s.id,name:s.name,number:s.number,background:s.background,objects:C.screenObjects(p,s).map(o=>({kind:o.kind,x:o.x,y:o.y,w:o.w,h:o.h,text:o.text,fontSize:o.fontSize??null,binding:o.binding,assetId:o.assetId||'',assetOnId:o.assetOnId||'',symbolType:o.symbolType||'lamp',...(o.kind==='status'?{lampOnColor:o.lampOnColor||'#86efac'}:{}),stateOnWhen:o.stateOnWhen||'true',actionType:o.actionType||'write',targetScreenId:o.targetScreenId||'',actionMode:o.actionMode||'set',confirmationText:o.confirmationText||'',expressionText:o.expressionText||'',expressionColor:o.expressionColor||'',expressionBackground:o.expressionBackground||'',expressionVisible:o.expressionVisible||'',feedbackBinding:o.feedbackBinding||'',feedbackColorOff:o.feedbackColorOff||'#2563eb',feedbackColorOn:o.feedbackColorOn||'#16a34a',...(o.kind==='button'?{feedbackTextOff:o.feedbackTextOff||'',feedbackTextOn:o.feedbackTextOn||''}:{}),...(o.kind==='shape'?{shapeType:o.shapeType||'rect',shapeFill:o.shapeFill||'#bfdbfe',shapeStroke:o.shapeStroke||'#1e40af',shapeStrokeWidth:o.shapeStrokeWidth??3,shapePoints:o.shapePoints||''}:{}),decimals:Number.isInteger(Number(o.decimals))?Number(o.decimals):2,...(['tank','bar','gauge','counter'].includes(o.kind)?{fillColor:o.fillColor}:{}),inputMin:o.inputMin??null,inputMax:o.inputMax??null,min:o.min,max:o.max,step:o.step,optionsText:o.optionsText,unit:o.unit,target:o.target}))}));
 const assets=p.assets.map(a=>({id:a.id,name:a.name,data:a.data}));
 const internalAlarmNames=new Set(p.internalVariables.map(v=>v.name));
 const alarms=p.alarms.map((a,i)=>({wireId:i+1,id:a.id,name:a.name,binding:a.binding,operator:a.operator,value:a.value,severity:a.severity||'warning',local:internalAlarmNames.has(a.binding)}));
 const recipes=p.recipeEnabled?p.recipes.map(r=>({id:r.id,name:r.name,scope:'shared',values:r.values})):[];
 // All exposed writable PLC tags and HMI internals are selectable in runtime,
 // even if no initial recipe references them.
 const recipeFields=p.recipeEnabled?[
  ...p.variables.filter(v=>v.expose&&v.live&&v.access==='RW'&&v.writeSupported).map(v=>({name:v.name,type:v.type,source:'PLC',stringLength:v.stringLength||255})),
  ...p.internalVariables.filter(v=>v.name).map(v=>({name:v.name,type:v.type,source:'HMI',stringLength:v.stringLength||255}))
 ]:[];
 const screenVars=p.screens.map(screen=>screenReadNames(p,screen).map(name=>vars.find(v=>v.name===name).id));
 const payload=asciiJSON({screenVars,name:p.name,pollMs:+p.pollMs,keyboardMode:p.keyboardMode,screenBinding:p.screenBinding,width:+p.width,height:+p.height,minDisplayWidth:Number(p.minDisplayWidth??480),maxDisplayWidth:Number(p.maxDisplayWidth??1920),vars,internals:p.internalVariables.map(v=>({name:v.name,type:v.type,value:v.value})),screens,assets,alarms,recipes,recipeFields,recipeKey:p.recipeKey,recipeEnabled:p.recipeEnabled,recipeSlots:p.recipeSlots,recipeBytes:p.recipeBytes});
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+htmlEscapeText(p.name)+'</title><style>'+runtimeCSS(p.recipeEnabled)+(p.keyboardMode==='webhmi'?virtualKeyboardCSS():'')+'</style></head><body><header><strong>'+htmlEscapeText(p.name)+'</strong><div class="head-actions"><span id="status">Conectando</span></div></header><nav id="nav" aria-label="Navegaci&#243;n HMI"><label for="screenSelect">Pantalla</label><select id="screenSelect" aria-label="Seleccionar pantalla"></select>'+(p.recipeEnabled?'<button type="button" id="recipeOpen" aria-haspopup="dialog" aria-controls="recipeWindow">Recetas</button>':'')+'<button type="button" id="alarmOpen" aria-haspopup="dialog" aria-controls="alarmWindow">Alarmas <span id="alarmCount">0</span></button><div id="alarmbar" role="button" tabindex="0" aria-label="Alarmas activas"></div></nav><div id="recipes"></div><main id="viewport"><div id="fit"><div id="stage"></div></div></main><div id="alarmWindow" class="alarm-window" hidden><div class="alarm-card"><div class="alarm-title"><strong>Alarmas</strong><button id="alarmClose">X</button></div><div class="alarm-actions"><button type="button" id="ackAll">Reconocer todas las activas</button></div><div id="alarmList"></div></div></div>'+(p.recipeEnabled?'<div id="recipeWindow" class="recipe-window" role="dialog" aria-modal="true" aria-label="Gestor de recetas" hidden><div class="recipe-card"><div class="recipe-head"><strong>Gestor de recetas</strong><button id="recipeClose" aria-label="Cerrar recetas">X</button></div><div class="recipe-body"><div class="recipe-toolbar"><label>Receta<select id="recipeSelect" aria-label="Seleccionar receta"></select></label><button id="recipeRefresh" type="button">Actualizar NX</button></div><div class="recipe-grid"><label>Nombre<input id="recipeName" maxlength="48" placeholder="Nombre de receta"></label><p class="recipe-storage">Almacenamiento: <strong>Retain NX (PLC)</strong></p></div><p class="recipe-help">Marca las variables incluidas. Los valores de la derecha son los actuales; guardar no modifica la m&#225;quina. Las variables HMI son locales al navegador.</p><div id="recipeFieldList" class="recipe-fields" role="group" aria-label="Par&#225;metros de receta"></div><p id="recipeMessage" class="recipe-message" role="status" aria-live="polite"></p><div class="recipe-actions"><button id="recipeApply" type="button">Aplicar</button><button id="recipeSave" type="button">Guardar</button><button id="recipeNew" type="button">Nueva</button><button id="recipeCapture" type="button">Capturar valores actuales</button><button id="recipeDuplicate" type="button">Duplicar</button><button id="recipeDelete" type="button">Eliminar</button><button id="recipeExport" type="button">Exportar JSON</button><button id="recipeImport" type="button">Importar JSON</button><input id="recipeImportFile" type="file" accept=".json,application/json" hidden></div><p class="recipe-help">Guardar modifica el banco Retain del NX. Aplicar escribe consignas secuencialmente; no garantiza cambio simult&#225;neo. Requiere el mismo control de acceso de red que las escrituras PLC.</p></div></div></div>':'')+'<div id="popupWindow" class="popup-window" role="dialog" aria-modal="true" aria-label="Ventana HMI" hidden><div class="popup-card"><div class="popup-header"><strong id="popupTitle">Detalles</strong><button id="popupClose" aria-label="Cerrar ventana">X</button></div><div id="popupFit"><div id="popupStage"></div></div></div></div>'+(p.keyboardMode==='webhmi'?virtualKeyboardMarkup():'')+'<script>const P='+payload+';'+runtimeJS(p.recipeEnabled)+(p.keyboardMode==='webhmi'?virtualKeyboardJS().replace(/[^\x00-\x7F]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')):'')+'</script></body></html>';
}
function runtimeCSS(recipeEnabled){let css='*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#111827;font-family:Arial,sans-serif;color:#111}body{height:100dvh;min-height:0;overflow:hidden;display:flex;flex-direction:column}body>header,#nav,#recipes{flex-shrink:0}header{height:46px;background:#101828;color:white;display:flex;align-items:center;justify-content:space-between;padding:0 14px}header span{font-size:12px}.head-actions{display:flex;align-items:center;gap:10px}#nav,#recipes{display:flex;gap:8px;align-items:center;padding:8px 12px;background:#1f2937;overflow-x:auto}#nav{overflow-x:visible;flex-wrap:nowrap}#nav label{font-size:13px;color:#e5e7eb;white-space:nowrap}#screenSelect{min-width:180px;max-width:min(55vw,360px);height:38px;border:1px solid #64748b;border-radius:6px;padding:5px 10px;background:#374151;color:#fff;font-size:14px;cursor:pointer}#nav button,#recipes button{border:0;border-radius:6px;padding:7px 11px;min-height:38px;background:#374151;color:white;white-space:nowrap;cursor:pointer}#nav button.active{background:#b91c1c}#nav button:disabled,#stage .button .in:disabled{opacity:.55;cursor:not-allowed}@media(max-width:520px){#nav{gap:6px;padding:8px}#screenSelect{min-width:0;max-width:none;flex:0 1 150px;width:120px}#nav button{flex-shrink:0}#alarmbar{padding:0 8px;font-size:11px}}#recipes{background:#0f172a}#recipes:empty{display:none}.recipe-window{position:fixed;inset:0;background:#0009;z-index:1100;display:flex;align-items:center;justify-content:center;padding:12px}.recipe-window[hidden]{display:none}.recipe-card{display:flex;flex-direction:column;background:#fff;border-radius:10px;width:min(900px,98vw);max-height:94dvh;overflow:hidden;box-shadow:0 20px 48px #0007}.recipe-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#111827;color:#fff}.recipe-head button{background:#374151;color:#fff;border:0;border-radius:5px;padding:6px 10px}.recipe-body{overflow:auto;min-height:0;padding:13px 16px}.recipe-body button{padding:8px 10px;border-radius:5px;border:1px solid #cbd5e1;cursor:pointer;background:#e2e8f0;color:#111827}.recipe-body button:disabled{opacity:.45;cursor:not-allowed}.recipe-body input,.recipe-body select{box-sizing:border-box;min-height:37px;padding:7px;border:1px solid #94a3b8;border-radius:5px;background:white;color:#111827;max-width:100%}.recipe-body label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;min-width:0}.recipe-toolbar,.recipe-grid{display:flex;gap:9px;margin:9px 0;align-items:end;flex-wrap:wrap}.recipe-toolbar label,.recipe-grid label{flex:1 1 190px}.recipe-help{font-size:12px;color:#475569;margin:7px 0}.recipe-fields{border:1px solid #cbd5e1;border-radius:6px;overflow:auto;max-height:min(46vh,420px)}.recipe-field{display:grid;grid-template-columns:minmax(150px,1.6fr) minmax(115px,1fr) minmax(105px,1fr);align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #e2e8f0}.recipe-field:last-child{border-bottom:0}.recipe-field .recipe-check{display:flex;flex-direction:row;align-items:center;gap:7px;font-size:12px;overflow-wrap:anywhere}.recipe-field input[type=checkbox]{min-height:0;accent-color:#2563eb}.recipe-field .recipe-live{font-family:monospace;color:#475569;font-size:12px;overflow-wrap:anywhere}.recipe-field .recipe-val{width:100%}.recipe-message{font-size:13px;min-height:18px;color:#0f4c81;margin:8px 0;white-space:pre-wrap}.recipe-actions{display:flex;gap:7px;flex-wrap:wrap}.recipe-actions #recipeApply{background:#2563eb;border-color:#2563eb;color:white}.recipe-actions #recipeDelete{color:#b91c1c}@media(max-width:500px){.recipe-field{grid-template-columns:1fr 1fr;gap:5px}.recipe-field .recipe-check{grid-column:span 2}.recipe-card{max-height:98dvh}.recipe-body{padding:8px}}#alarmbar{height:38px;min-width:0;flex:1 1 auto;display:flex;align-items:center;padding:0 12px;border-radius:6px;background:#7f1d1d;color:white;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;visibility:hidden}#alarmbar.show{visibility:visible;cursor:pointer}.alarm-window{position:fixed;inset:0;background:#0008;z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:64px 14px 14px}.alarm-window[hidden]{display:none}.alarm-card{width:min(760px,96vw);max-height:75vh;overflow:auto;background:white;border-radius:10px;box-shadow:0 20px 50px #0006}.alarm-title{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#111827;color:white;z-index:1}.alarm-title button{border:0;border-radius:5px;background:#374151;color:white;padding:5px 9px}.alarm-row{display:grid;grid-template-columns:82px 1fr minmax(180px,1fr);gap:8px;padding:10px 12px;border-bottom:1px solid #e5e7eb;align-items:center}.alarm-row.active{background:#fef2f2}.alarm-state{font-weight:bold}.alarm-state.on{color:#b91c1c}.alarm-cond{font-size:12px;color:#64748b}#viewport{width:100%;flex:1 1 auto;min-height:0;overflow:auto}#fit{position:relative;margin:0 auto}#stage{position:absolute;left:0;top:0;background:#f8fafc;transform-origin:top left}.o{position:absolute;overflow:hidden}.o.shape .shape-visual{width:100%;height:100%;pointer-events:none}.o.shape .shape-visual svg{display:block;width:100%;height:100%}.in{width:100%;height:100%;display:flex;align-items:center;justify-content:center}.text .in{justify-content:flex-start;text-align:left}.lamp .in{border-radius:50%;background:#94a3b8;border:3px solid #334155}.lamp.on .in{background:#22c55e}.value .in,.input .in{background:white;border:1px solid #94a3b8;border-radius:5px}.input .in{padding:5px}.input input{min-width:0;width:100%;height:100%;border:0;font-size:18px}.input input[type="number"]{-moz-appearance:textfield;appearance:textfield}.input input[type="number"]::-webkit-outer-spin-button,.input input[type="number"]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}@keyframes input-dirty-blink{0%,100%{background:#fff7cc}50%{background:#facc15}}.input button,.button .in{background:#2563eb;color:white;border:0;border-radius:6px}.button .in{font-weight:bold}.bar .track{width:100%;height:100%;background:#e5e7eb}.bar .fill{height:100%;background:#16a34a;width:0}.image img{width:100%;height:100%;object-fit:contain}.status .status-visual{height:100%;width:100%;display:flex;align-items:center;justify-content:center}.status .status-visual svg{width:90%;height:90%;display:block}.industrial .symbol{width:70%;height:70%;position:relative;border:4px solid #475569;background:#cbd5e1}.tank .symbol{height:100%;width:70%;border-radius:0 0 18px 18px;overflow:hidden;background:#e2e8f0}.tank .level{position:absolute;left:0;right:0;bottom:0;height:0;background:#38bdf8}.comm-stale .status,.comm-stale .value,.comm-stale .bar,.comm-stale .tank,.comm-stale .image{opacity:.58}.write-pending .in{outline:2px solid #f59e0b;outline-offset:-2px}.write-error .in{outline:2px solid #dc2626;outline-offset:-2px}.input.input-dirty input{animation:input-dirty-blink .85s ease-in-out infinite}.input.write-pending input{animation:none;background:#fffbeb}.input.write-error input{animation:none;background:#fef2f2}.input.input-limit-error .in{outline:2px solid #dc2626;outline-offset:-2px}:is(#stage,#popupStage) .control-panel{display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:5px;width:100%;height:100%;padding:7px;background:#fff;border:1px solid #94a3b8;border-radius:6px;font-size:14px}:is(#stage,#popupStage) .control-panel input[type=range]{width:100%;accent-color:#2563eb}:is(#stage,#popupStage) .control-panel .controls{display:flex;align-items:center;justify-content:center;gap:8px}:is(#stage,#popupStage) .control-panel .controls button{flex:0 0 36px;height:34px;border:0;border-radius:5px;background:#2563eb;color:#fff}:is(#stage,#popupStage) .control-panel select{width:100%;height:35px;border:1px solid #94a3b8;background:#fff}:is(#stage,#popupStage) .control-panel .reading{font-size:20px;font-weight:700;text-align:center}:is(#stage,#popupStage) .control-panel .limits{display:flex;justify-content:space-between;font-size:11px;color:#64748b}:is(#stage,#popupStage) .switch .control-panel{padding:4px 6px;gap:3px}:is(#stage,#popupStage) .switch .switch-title{font-size:11px;font-weight:600;line-height:1.2;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 0 auto}:is(#stage,#popupStage) .control-panel .switch-button{height:37px;border:0;border-radius:18px;background:#64748b;color:white;font-weight:700}:is(#stage,#popupStage) .control-panel .switch-button.on{background:#16a34a}:is(#stage,#popupStage) .control-panel .gauge-track{height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden}:is(#stage,#popupStage) .control-panel .gauge-ring{width:min(100%,115px);aspect-ratio:1;border-radius:50%;background:conic-gradient(var(--active-color,#16a34a) var(--pct,0%),#e2e8f0 0);margin:0 auto;display:flex;align-items:center;justify-content:center}:is(#stage,#popupStage) .control-panel .gauge-ring .reading{width:75%;height:75%;display:flex;align-items:center;justify-content:center;background:white;border-radius:50%;font-size:18px}:is(#stage,#popupStage) .control-panel .gauge-fill{height:100%;background:#16a34a;width:0}:is(#stage,#popupStage) .control-panel .caption{font-size:11px;text-align:center;color:#475569}:is(#stage,#popupStage) .control-panel button:disabled,:is(#stage,#popupStage) .control-panel select:disabled,:is(#stage,#popupStage) .control-panel input:disabled{opacity:.55;cursor:not-allowed}:is(#stage,#popupStage) .selector .control-panel{padding:5px;gap:4px;justify-content:flex-start}:is(#stage,#popupStage) .selector .control-panel .caption{flex:0 0 auto;line-height:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}:is(#stage,#popupStage) .selector .selector-buttons{display:flex;flex:1 1 auto;min-height:0;flex-wrap:wrap;align-content:flex-start;gap:4px;overflow:auto;overscroll-behavior:contain}:is(#stage,#popupStage) .selector .selector-choice{flex:1 1 65px;min-width:56px;min-height:30px;padding:4px 7px;border:1px solid #94a3b8;border-radius:5px;background:#f1f5f9;color:#334155;font-weight:600;white-space:normal;overflow-wrap:anywhere;cursor:pointer;touch-action:manipulation}:is(#stage,#popupStage) .selector .selector-choice.active{background:#2563eb;border-color:#1d4ed8;color:#fff;box-shadow:inset 0 0 0 1px #1d4ed8}:is(#stage,#popupStage) .selector .selector-choice:focus-visible{outline:2px solid #0ea5e9;outline-offset:1px}:is(#stage,#popupStage) .selector .selector-choice:disabled{opacity:.6;cursor:not-allowed}:is(#stage,#popupStage) .selector .selector-choice.active:disabled{opacity:.85}.input.input-limit-error input{animation:none;background:#fef2f2}#status.comm-online{color:#86efac}#status.comm-degraded,#status.comm-reconnecting{color:#fde68a}#status.comm-offline{color:#fca5a5}.dynamicText .in{justify-content:flex-start;padding:4px 8px;font-weight:600}.alarm-row{grid-template-columns:100px 1fr minmax(100px,1fr) 94px}.alarm-row .ack-one{padding:7px 8px;border:1px solid #93c5fd;border-radius:5px;background:#eff6ff;color:#1d4ed8;cursor:pointer}.alarm-row .ack-one:disabled{opacity:.45;cursor:default}.alarm-actions{padding:9px 12px;border-bottom:1px solid #e2e8f0}.alarm-actions button{padding:7px 10px;border:0;border-radius:5px;background:#2563eb;color:#fff;cursor:pointer}.alarm-actions button:disabled{opacity:.4;cursor:default}.popup-window{position:fixed;inset:0;z-index:1100;background:#000a;display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto}.popup-window[hidden]{display:none}.popup-card{max-width:100%;max-height:100%;overflow:auto;border-radius:10px;background:#fff;box-shadow:0 18px 55px #0008}.popup-header{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;background:#0f172a;color:#fff;font-size:14px}.popup-header button{border:0;border-radius:5px;padding:5px 10px;background:#475569;color:#fff;cursor:pointer}#popupFit{position:relative;overflow:hidden}#popupStage{position:absolute;inset:0;transform-origin:top left}@media(max-width:700px){.alarm-row{grid-template-columns:90px 1fr 88px}.alarm-cond{display:none}}'+'.o.has-widget-title{display:flex;flex-direction:column}.o.has-widget-title>.widget-title{flex:0 0 auto;max-width:100%;padding:2px 4px;font-size:13px;font-weight:600;line-height:16px;color:#334155;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.o.has-widget-title>.symbol,.o.has-widget-title>.track,.o.has-widget-title>.status-visual,.o.has-widget-title>.control-panel,.o.has-widget-title>.in,.o.has-widget-title>img{flex:1 1 auto;min-height:0;height:auto}.o.has-widget-title.tank>.symbol{margin:0 auto;width:70%}.o.has-widget-title>.control-panel{height:auto;min-height:0}.o.has-widget-title>img{width:100%;object-fit:contain}';return recipeEnabled?css:css.replace(/\.recipe-window\{[\s\S]*?(?=#alarmbar\{)/,'');}
function runtimeJS(recipeEnabled){return `
${C.defaultShapePoints.toString()}
${C.shapeCoordinates.toString()}
${C.shapeSvg.toString()}
const evaluateExpression=${root.NXExpressions?root.NXExpressions.evaluate.toString():"function(){return undefined}"};
const vals={},alarmVals={},ackVals={},internalVals=Object.create(null),pendingWrites=new Map();
const WIDGET_TITLE_KINDS=new Set(["status","tank","bar","value","input","slider","selector","multistate","gauge","stepper","counter","dropdown","image"]);
for(const tag of P.internals||[]){internalVals[tag.name]=tag.type==='BOOL'?(tag.value===true||String(tag.value)==='1'||String(tag.value).toLowerCase()==='true'):tag.type==='STRING'?String(tag.value??''):Number(tag.value)}
const internalByName=Object.fromEntries((P.internals||[]).map(v=>[v.name,v]));
const plcAlarmIds=new Set(P.alarms.filter(a=>!a.local).map(a=>a.wireId));
function localAlarmCondition(a){
 const tag=internalByName[a.binding];if(!tag)return false;
 let actual=internalVals[a.binding],threshold=a.value;
 if(tag.type==="BOOL"){actual=boolValue(actual)?1:0;threshold=boolValue(threshold)?1:0}
 else if(tag.type==="STRING"){actual=String(actual??"");threshold=String(threshold??"")}
 else{actual=Number(actual);threshold=Number(threshold);if(!Number.isFinite(actual)||!Number.isFinite(threshold))return false}
 switch(a.operator){case "eq":return actual===threshold;case "ne":return actual!==threshold;case "gt":return actual>threshold;case "ge":return actual>=threshold;case "lt":return actual<threshold;case "le":return actual<=threshold;default:return false}
}
function updateLocalAlarms(){for(const a of P.alarms)if(a.local){const active=localAlarmCondition(a);alarmVals[a.wireId]=active;if(!active)ackVals[a.wireId]=false}}

function currentValue(name){return Object.prototype.hasOwnProperty.call(internalVals,name)?internalVals[name]:vals[name]}
function localWritable(name){return Object.prototype.hasOwnProperty.call(internalByName,name)}
function widgetWritable(name){return localWritable(name)||comm.state==="ONLINE"}
function expressionValues(){return Object.assign({},vals,internalVals,{'HMI.PLCConnected':comm.state==='ONLINE','HMI.CurrentScreen':P.screens[screenIndex]?.number||0,'HMI.ActiveAlarms':P.alarms.filter(a=>alarmVals[a.wireId]).length})}
function expr(formula){try{return evaluateExpression(formula,expressionValues())}catch{return undefined}}
const byName=Object.fromEntries(P.vars.map(v=>[v.name,v])),assets=Object.fromEntries(P.assets.map(a=>[a.id,a.data]));
const viewport=document.getElementById("viewport"),fit=document.getElementById("fit"),stage=document.getElementById("stage"),screenSelect=document.getElementById("screenSelect"),alarmbar=document.getElementById("alarmbar"),recipes=document.getElementById("recipes"),alarmOpen=document.getElementById("alarmOpen"),alarmCount=document.getElementById("alarmCount"),alarmWindow=document.getElementById("alarmWindow"),alarmClose=document.getElementById("alarmClose"),alarmList=document.getElementById("alarmList"),statusEl=document.getElementById("status"),ackAll=document.getElementById("ackAll"),popupWindow=document.getElementById("popupWindow"),popupFit=document.getElementById("popupFit"),popupStage=document.getElementById("popupStage"),popupClose=document.getElementById("popupClose"),popupTitle=document.getElementById("popupTitle");
let nodes=[],popupNodes=[],screenIndex=0,pendingRecipe=null,pendingAck=null;
const comm={busy:false,failures:0,lastGoodAt:0,state:"RECONNECTING",timer:null,forceRead:false,lastSeq:null};
const READ_TIMEOUT=Math.max(1200,Math.min(5000,(Number(P.pollMs)||500)*3)),WRITE_TTL=5000,MAX_WRITE_ATTEMPTS=3;
const SNAP_KEY="hminx:runtime:v2:"+String(P.name||"HMI");
// When assigned, PLC navigation is authoritative; stale snapshots never change the screen.
screenSelect.disabled=Boolean(P.screenBinding);
if(P.screenBinding)screenSelect.title="Pantalla controlada por PLC: "+P.screenBinding;
stage.style.width=P.width+"px";stage.style.height=P.height+"px";popupStage.style.width=P.width+"px";popupStage.style.height=P.height+"px";

function E(t,c){const e=document.createElement(t);if(c)e.className=c;return e}
function applyObjectFontSize(node,o){
 if(!Number.isInteger(o.fontSize)||o.fontSize<8||o.fontSize>120)return;
 const px=o.fontSize+"px";
 node.style.fontSize=px;
 for(const el of node.querySelectorAll(".in,.label,.caption,.widget-title,.control-panel,.reading,.limits,input,select,button"))el.style.fontSize=px;
}
function calendarSeconds(type,input){
 const raw=String(input).trim().split(".")[0];
 if(type==="TIME_OF_DAY"){
  const t=raw.match(/^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/);
  if(!t)throw Error("Formato de hora HH:mm:ss (sin fracciones)");
  return String(Number(t[1])*3600+Number(t[2])*60+Number(t[3]));
 }
 const match=type==="DATE"?raw.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/):raw.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})-([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/);
 if(!match)throw Error("Formato de fecha: YYYY-MM-DD o YYYY-MM-DD-HH:mm:ss");
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
 if(year<1970||year>9999)throw Error("Fecha fuera de rango 1970..9999");
 const ms=Date.UTC(year,month-1,day,Number(match[4]||0),Number(match[5]||0),Number(match[6]||0)),dt=new Date(ms);
 if(!Number.isFinite(ms)||dt.getUTCFullYear()!==year||dt.getUTCMonth()!==month-1||dt.getUTCDate()!==day)throw Error("Fecha invalida");
 return String(Math.floor(ms/1000));
}
function boolValue(v){return v===true||v===1||v==="1"||v==="TRUE"}
function statusSvg(type,on,lampOnColor){const fill=on?"#86efac":"#e2e8f0",stroke=on?"#15803d":"#475569",accent=on?"#22c55e":"#94a3b8",common='viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';if(type==="lamp"){const lampFill=/^#[0-9a-f]{6}$/i.test(lampOnColor||"")?lampOnColor:"#86efac";return '<svg '+common+'><circle cx="50" cy="38" r="23" fill="'+(on?lampFill:"#e2e8f0")+'" stroke="#475569" stroke-width="5"/></svg>';} if(type==="motor")return '<svg '+common+'><circle cx="42" cy="39" r="25" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><text x="42" y="48" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" font-weight="700" fill="'+stroke+'">M</text><path d="M67 39h20" stroke="'+stroke+'" stroke-width="6" stroke-linecap="round"/>'+(on?'<path d="M24 13c8-7 27-8 37 1" fill="none" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/><path d="M58 8l7 7-10 2" fill="'+accent+'"/>':'')+'</svg>';if(type==="pump")return '<svg '+common+'><circle cx="38" cy="40" r="25" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><path d="M38 23l17 17-17 17z" fill="'+accent+'" stroke="'+stroke+'" stroke-width="3"/><path d="M63 40h26v-17" fill="none" stroke="'+stroke+'" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'+(on?'<path d="M72 14h17" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/><path d="M89 14l-8-5v10z" fill="'+accent+'"/>':'')+'</svg>';if(type==="valve")return '<svg '+common+'><path d="M8 40h18M74 40h18" stroke="'+stroke+'" stroke-width="6" stroke-linecap="round"/><path d="M25 20l25 20-25 20zM75 20L50 40l25 20z" fill="'+fill+'" stroke="'+stroke+'" stroke-width="4" stroke-linejoin="round"/><path d="M50 40V12M38 12h24" stroke="'+stroke+'" stroke-width="5" stroke-linecap="round"/>'+(on?'<circle cx="50" cy="40" r="8" fill="'+accent+'"/><path d="M35 68h30" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/>':'<path d="M43 33l14 14M57 33L43 47" stroke="#64748b" stroke-width="4" stroke-linecap="round"/>')+'</svg>';if(type==="conveyor")return '<svg '+common+'><rect x="8" y="25" width="84" height="30" rx="14" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><circle cx="24" cy="40" r="7" fill="white" stroke="'+stroke+'" stroke-width="3"/><circle cx="50" cy="40" r="7" fill="white" stroke="'+stroke+'" stroke-width="3"/><circle cx="76" cy="40" r="7" fill="white" stroke="'+stroke+'" stroke-width="3"/>'+(on?'<path d="M30 15h38" stroke="'+accent+'" stroke-width="5" stroke-linecap="round"/><path d="M68 15l-10-7v14z" fill="'+accent+'"/>':'<path d="M45 11v9M55 11v9" stroke="#64748b" stroke-width="5" stroke-linecap="round"/>')+'</svg>';return '<svg '+common+'><rect x="10" y="20" width="40" height="38" rx="6" fill="'+fill+'" stroke="'+stroke+'" stroke-width="5"/><circle cx="43" cy="39" r="6" fill="'+accent+'" stroke="'+stroke+'" stroke-width="3"/><path d="M10 30H3M10 48H3" stroke="'+stroke+'" stroke-width="4" stroke-linecap="round"/>'+(on?'<path d="M56 29l34-10M56 39h36M56 49l34 10" stroke="'+accent+'" stroke-width="4" stroke-linecap="round"/>':'<path d="M57 39h18" stroke="#94a3b8" stroke-width="3" stroke-dasharray="5 5"/>')+'</svg>'}
function fmt(o,v,empty=""){if(v===undefined||v===null||v==="")return empty;const tag=byName[o.binding]||internalByName[o.binding];if(tag&&(tag.type==="REAL"||tag.type==="LREAL")){const n=Number(v),d=Math.max(0,Math.min(6,Number.isFinite(Number(o.decimals))?Number(o.decimals):2));return Number.isFinite(n)?n.toFixed(d):String(v)}return String(v)}
function fitStage(){
 // Reserve the actual header, navigation and recipe bar first: the canvas
 // must fit into the remaining viewport, not into the full iframe height.
 const available=Math.max(1,viewport.clientWidth||window.innerWidth||P.width);
 const fallbackHeight=(Number(window.innerHeight)||P.height)-(document.querySelector?.("body>header")?.offsetHeight||0)-(document.getElementById("nav")?.offsetHeight||0)-(recipes.offsetHeight||0);
 const availableHeight=Math.max(1,viewport.clientHeight||fallbackHeight);
 const minW=Math.max(320,Number(P.minDisplayWidth)||480);
 const maxW=Math.max(minW,Number(P.maxDisplayWidth)||1920);
 const target=Math.max(minW,Math.min(maxW,available));
 const scale=Math.min(target/P.width,available/P.width,availableHeight/P.height);
 fit.style.width=(P.width*scale)+"px";
 fit.style.height=(P.height*scale)+"px";
 stage.style.transform="scale("+scale+")";
}
if(typeof ResizeObserver!=="undefined")new ResizeObserver(fitStage).observe(viewport);else window.addEventListener("resize",fitStage);
window.addEventListener("orientationchange",fitStage);

function makeStatus(o){const type=o.symbolType||"lamp",n=E("div","o status "+type),s=E("div","status-visual");s.innerHTML=statusSvg(type,false,o.lampOnColor);n.setAttribute("role","img");n.setAttribute("aria-label",o.text||"Estado");n.append(s);n.statusVisual=s;n.visualOn=false;return n}
function makeTank(o){const n=E("div","o industrial tank"),s=E("div","symbol"),l=E("div","level");n.setAttribute("role","img");n.setAttribute("aria-label",o.text||"Deposito");l.style.backgroundColor=o.fillColor;s.append(l);n.append(s);n.level=l;return n}
function optionsFor(o){return String(o.optionsText||'').split(/\\r?\\n/).map(x=>{const i=x.indexOf('=');return i<0?null:{value:x.slice(0,i).trim(),label:x.slice(i+1).split("|")[0].trim(),color:/^#[0-9a-fA-F]{6}$/.test(x.split("|")[1]||"")?x.split("|")[1]:""}}).filter(x=>x&&/^-?\\d+$/.test(x.value)&&x.label)}
function controlRange(o,v){const a=Number(o.min),b=Number(o.max);return Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a))}
function makeNode(o){let n;if(o.kind==="status")n=makeStatus(o);else if(o.kind==="tank")n=makeTank(o);else{n=E("div","o "+o.kind);if(o.kind==="text"||o.kind==="dynamicText"){const x=E("div","in");x.textContent=o.text;n.append(x)}else if(o.kind==="shape"){const visual=E("div","shape-visual");visual.innerHTML=shapeSvg(o.shapeType,o.shapeFill,o.shapeStroke,o.shapeStrokeWidth,o.shapePoints);n.append(visual)}else if(o.kind==="bar"){const t=E("div","track"),f=E("div","fill");f.style.backgroundColor=o.fillColor;t.append(f);n.append(t);n.fill=f}else if(o.kind==="image"){const img=E("img"),key=o.assetId||"";img.src=assets[key]||"";img.alt=o.text||"";n.append(img);n.image=img;n.imageKey=key}else if(["slider","switch","selector","multistate","gauge","stepper","counter","dropdown"].includes(o.kind)){const panel=E("div","control-panel");panel.setAttribute("role","group");panel.setAttribute("aria-label",o.text||o.kind);n.control={};const c=n.control;if(o.kind==="slider"){const reading=E("div","reading"),input=E("input"),limits=E("div","limits");input.type="range";input.min=o.min;input.max=o.max;input.step=o.step;limits.innerHTML="<span>"+o.min+"</span><span>"+o.max+"</span>";input.oninput=()=>{reading.textContent=input.value+(o.unit?" "+o.unit:"")};input.onchange=()=>{write(o.binding,input.value,{min:o.min,max:o.max,node:n})};panel.append(reading,input,limits);Object.assign(c,{reading,input})}else if(o.kind==="switch"){if(String(o.text||"").trim()){const caption=E("div","caption switch-title");caption.textContent=o.text;panel.append(caption)}const button=E("button","switch-button");button.onclick=()=>write(o.binding,boolValue(currentValue(o.binding))?"0":"1",{node:n});panel.append(button);c.button=button}else if(o.kind==="selector"){const choices=E("div","selector-buttons");choices.setAttribute("role","group");choices.setAttribute("aria-label",o.text||"Selector");c.buttons=[];for(const option of optionsFor(o)){const button=E("button","selector-choice");button.type="button";button.textContent=option.label;button.value=option.value;button.setAttribute("aria-pressed","false");button.onclick=()=>{if(String(currentValue(o.binding)??"")!==option.value)write(o.binding,option.value,{node:n})};choices.append(button);c.buttons.push({button,value:option.value})}panel.append(choices)}else if(o.kind==="dropdown"){const input=E("select");for(const option of optionsFor(o)){const el=E("option");el.value=option.value;el.textContent=option.label;input.append(el)}input.onchange=()=>write(o.binding,input.value,{node:n});panel.append(input);c.input=input}else if(o.kind==="multistate"){const reading=E("div","reading");panel.append(reading);c.reading=reading}else if(o.kind==="stepper"){const ctr=E("div","controls"),minus=E("button"),reading=E("div","reading"),plus=E("button");minus.textContent="-";plus.textContent="+";const move=delta=>write(o.binding,String(Math.max(Number(o.min),Math.min(Number(o.max),Number(currentValue(o.binding)??o.min)+delta*Number(o.step)))),{min:o.min,max:o.max,node:n});minus.onclick=()=>move(-1);plus.onclick=()=>move(1);ctr.append(minus,reading,plus);panel.append(ctr);Object.assign(c,{minus,plus,reading})}else if(o.kind==="gauge"){const reading=E("div","reading"),ring=E("div","gauge-ring"),limits=E("div","limits");ring.style.setProperty("--active-color",o.fillColor);ring.append(reading);limits.innerHTML="<span>"+o.min+"</span><span>"+o.max+"</span>";panel.append(ring,limits);Object.assign(c,{reading,ring})}else if(o.kind==="counter"){const reading=E("div","reading"),target=E("div","caption"),progress=E("div","gauge-fill"),track=E("div","gauge-track");progress.style.backgroundColor=o.fillColor;reading.style.color=o.fillColor;track.append(progress);target.textContent="Objetivo: "+o.target;panel.append(reading,target,track);Object.assign(c,{reading,target,progress})}n.append(panel)}else if(o.kind==="input"){const x=E("div","in"),i=E("input"),tag=byName[o.binding]||internalByName[o.binding];if(tag&&tag.type==="STRING"){i.type="text";i.maxLength=Math.min(512,Number(tag.stringLength)||255)}else if(tag&&["BYTE","WORD","DWORD","LWORD","LINT","ULINT","TIME","DATE","TIME_OF_DAY","DATE_AND_TIME"].includes(tag.type)){i.type="text";i.inputMode="text";i.maxLength=64}else{i.type="number";i.inputMode="decimal";i.step=tag&&(tag.type==="REAL"||tag.type==="LREAL")?"any":"1";if(o.inputMin!==null)i.min=String(o.inputMin);if(o.inputMax!==null)i.max=String(o.inputMax)}i.setAttribute("aria-label",o.text||"Entrada");n.inputDirty=false;const send=()=>{if(write(o.binding,i.value,{min:o.inputMin,max:o.inputMax,node:n})){n.inputDirty=false;paint()}};i.addEventListener("input",()=>{n.inputDirty=true;n.inputError="";paint()});if(P.keyboardMode==="webhmi"){i.readOnly=true;i.inputMode="none";i.setAttribute("aria-haspopup","dialog");const open=()=>{if(!widgetWritable(o.binding)){statusEl.textContent="ENTRADA | Variable no disponible para escritura";return}openVirtualKeyboard({title:o.text||o.binding||"Introducir valor",type:tag?.type||"STRING",value:i.value,maxLength:tag?.type==="STRING"?Math.min(512,Number(tag.stringLength)||255):64,onAccept:raw=>{if(!write(o.binding,raw,{min:o.inputMin,max:o.inputMax,node:n}))throw Error(n.inputError||"Valor no valido");i.value=raw;n.inputDirty=false;paint();}})};i.addEventListener("click",open);i.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open()}});}else{i.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();send()}})}x.append(i);n.append(x);n.entry=i}else if(o.kind==="button"){const b=E("button","in");b.textContent=o.text;b.style.backgroundColor=o.feedbackBinding?(o.feedbackColorOff||"#2563eb"):"#2563eb";if((o.actionType||"write")==="navigate"&&P.screenBinding){b.disabled=true;b.title="Navegacion controlada por PLC: "+P.screenBinding;}b.onclick=()=>{if((o.actionType||"write")==="navigate"){showScreenById(o.targetScreenId);return}if(o.actionType==="popup"){showPopup(o.targetScreenId);return}if(o.actionType==="closePopup"){hidePopup();return}if(o.confirmationText&&!confirm(o.confirmationText))return;const mode=o.actionMode||"set",next=mode==="reset"?false:mode==="toggle"?!boolValue(currentValue(o.binding)):true;write(o.binding,next?"1":"0")};n.append(b);n.button=b}else n.append(E("div","in"));}if(WIDGET_TITLE_KINDS.has(o.kind)&&String(o.text||"").trim()){const title=E("div","widget-title");title.textContent=o.text;n.classList.add("has-widget-title");n.prepend(title)}Object.assign(n.style,{left:o.x+"px",top:o.y+"px",width:o.w+"px",height:o.h+"px"});applyObjectFontSize(n,o);return n}

function showScreen(i){screenIndex=Math.max(0,Math.min(P.screens.length-1,i));stage.style.backgroundColor=P.screens[screenIndex].background||'#ffffff';stage.replaceChildren();nodes=[];for(const o of P.screens[screenIndex].objects){const n=makeNode(o);stage.append(n);nodes.push([n,o])}screenSelect.value=String(screenIndex);paint();fitStage()}
function fitPopup(){if(popupWindow.hidden)return;const scale=Math.max(.1,Math.min(1,(window.innerWidth-36)/P.width,(window.innerHeight-140)/P.height));popupFit.style.width=(P.width*scale)+"px";popupFit.style.height=(P.height*scale)+"px";popupStage.style.transform="scale("+scale+")"}
function showPopup(id){const s=P.screens.find(s=>s.id===id);if(!s)return;popupTitle.textContent=s.name;popupStage.style.backgroundColor=s.background||"#fff";popupStage.replaceChildren();popupNodes=[];for(const o of s.objects){const n=makeNode(o);popupStage.append(n);popupNodes.push([n,o])}popupWindow.hidden=false;fitPopup();paint();popupClose.focus()}
function hidePopup(){popupWindow.hidden=true;popupNodes=[];popupStage.replaceChildren()}
popupClose.onclick=hidePopup;popupWindow.onclick=e=>{if(e.target===popupWindow)hidePopup()};window.addEventListener("resize",fitPopup);window.addEventListener("keydown",e=>{if(e.key==="Escape"&&!popupWindow.hidden)hidePopup()});
function showScreenById(id){if(P.screenBinding)return;const i=P.screens.findIndex(s=>s.id===id);if(i>=0)showScreen(i)}
for(const [i,s] of P.screens.entries()){const option=E("option");option.value=String(i);option.textContent=s.name;screenSelect.append(option)}
screenSelect.onchange=()=>showScreen(P.screenBinding?screenIndex:Number(screenSelect.value));
// Las recetas se gestionan desde la ventana Recetas; no se crean botones fijos por plantilla.
alarmOpen.onclick=()=>{alarmWindow.hidden=false;paintAlarms()};alarmClose.onclick=()=>alarmWindow.hidden=true;alarmWindow.onclick=e=>{if(e.target===alarmWindow)alarmWindow.hidden=true};alarmbar.onclick=()=>{alarmWindow.hidden=false;paintAlarms()};alarmbar.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();alarmWindow.hidden=false;paintAlarms()}};

function dataAge(){return comm.lastGoodAt?Math.max(0,Math.floor((Date.now()-comm.lastGoodAt)/1000)):null}
function updateCommStatus(){const stale=comm.state!=="ONLINE",age=dataAge();stage.classList.toggle("comm-stale",stale);statusEl.className="comm-"+comm.state.toLowerCase();let txt=comm.state;if(age!==null&&stale)txt+=" | datos "+age+"s";statusEl.textContent=txt}
function setComm(state){comm.state=state;updateCommStatus()}
function schedule(delay){if(comm.timer)clearTimeout(comm.timer);comm.timer=setTimeout(commCycle,Math.max(0,delay));updateCommStatus()}
function backoff(){const a=[300,500,1000,2000,5000];return a[Math.min(a.length-1,Math.max(0,comm.failures-1))]}
async function fetchTimed(url,opt,timeout){const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),timeout||READ_TIMEOUT);try{return await fetch(url,Object.assign({},opt||{},{signal:ac.signal,cache:"no-store"}))}finally{clearTimeout(timer)}}
function failComm(){comm.failures+=1;setComm(comm.failures>=3?"OFFLINE":"DEGRADED")}

function parseSnapshot(text,expectedIds){let seq=null,end=null;const nextVals={},nextAlarms={},nextAck={};for(const line of String(text||"").split(/\\r?\\n/)){if(!line)continue;const k=line.indexOf("=");if(k<1)continue;const key=line.slice(0,k),raw=line.slice(k+1);if(key==="SEQ"){seq=raw;continue}if(key==="END"){end=raw;continue}if(key[0]==="K"){const id=Number(key.slice(1));if(Number.isInteger(id)&&plcAlarmIds.has(id))nextAck[id]=raw==="1";continue}if(key[0]==="A"){const id=Number(key.slice(1));if(Number.isInteger(id)&&plcAlarmIds.has(id))nextAlarms[id]=raw==="1";continue}const id=Number(key),tag=P.vars.find(v=>v.id===id);if(!tag)continue;let value=raw;if(tag.type==="BOOL")value=raw==="1"||raw==="TRUE";else if(["LINT","ULINT","BYTE","WORD","DWORD","LWORD","TIME","DATE","TIME_OF_DAY","DATE_AND_TIME"].includes(tag.type)){value=raw}else if(tag.type!=="STRING"){value=Number(raw);if(!Number.isFinite(value))throw Error("snapshot numerico invalido")}nextVals[tag.name]=value}if(seq===null||end===null||seq!==end)throw Error("snapshot incompleto");for(const tag of P.vars)if(expectedIds.has(tag.id)&&!Object.prototype.hasOwnProperty.call(nextVals,tag.name))throw Error("tag ausente "+tag.id);for(const a of P.alarms)if(!a.local){if(!Object.prototype.hasOwnProperty.call(nextAlarms,a.wireId))throw Error("alarma ausente "+a.wireId);if(!Object.prototype.hasOwnProperty.call(nextAck,a.wireId))nextAck[a.wireId]=false;}return{seq,vals:nextVals,alarms:nextAlarms,ack:nextAck}}

function saveGoodSnapshot(){try{const alarms={},ack={};for(const id of plcAlarmIds){alarms[id]=Boolean(alarmVals[id]);ack[id]=Boolean(ackVals[id])}localStorage.setItem(SNAP_KEY,JSON.stringify({at:comm.lastGoodAt,seq:comm.lastSeq,vals,alarms,ack}))}catch{}}
function loadCachedSnapshot(){try{const s=JSON.parse(localStorage.getItem(SNAP_KEY)||"null");if(!s||!s.vals)return;for(const tag of P.vars)if(Object.prototype.hasOwnProperty.call(s.vals,tag.name))vals[tag.name]=s.vals[tag.name];for(const a of P.alarms)if(!a.local){if(s.alarms&&Object.prototype.hasOwnProperty.call(s.alarms,a.wireId))alarmVals[a.wireId]=Boolean(s.alarms[a.wireId]);if(s.ack&&Object.prototype.hasOwnProperty.call(s.ack,a.wireId))ackVals[a.wireId]=Boolean(s.ack[a.wireId])}comm.lastGoodAt=Number(s.at)||0;comm.lastSeq=s.seq||null;setComm("RECONNECTING")}catch{}}

function sameValue(tag,actual,raw){if(tag.type==="BOOL")return boolValue(actual)===boolValue(raw);if(["DATE","TIME_OF_DAY","DATE_AND_TIME"].includes(tag.type)){try{return calendarSeconds(tag.type,actual)===String(raw)}catch{return false}}if(["STRING","LINT","ULINT","TIME"].includes(tag.type))return String(actual??"")===String(raw);if(["BYTE","WORD","DWORD","LWORD"].includes(tag.type)){const width={BYTE:2,WORD:4,DWORD:8,LWORD:16}[tag.type];return String(actual||"").toUpperCase().padStart(width,"0")===String(raw||"").toUpperCase().padStart(width,"0")}const a=Number(actual),b=Number(raw);if(!Number.isFinite(a)||!Number.isFinite(b))return false;if(tag.type==="REAL"||tag.type==="LREAL")return Math.abs(a-b)<=Math.max(1e-6,Math.abs(b)*1e-6);return a===b}
function expireWrites(){const now=Date.now();for(const item of pendingWrites.values())if(item.state!=="error"&&now>item.expires){item.state="error";item.error="No confirmado antes de caducar"}}
function confirmWrites(){for(const [name,item] of [...pendingWrites]){const tag=byName[name];if(tag&&sameValue(tag,vals[name],item.raw))pendingWrites.delete(name)}expireWrites()}
function dueWrite(){const now=Date.now();for(const item of pendingWrites.values())if((item.state==="queued"||item.state==="retry")&&item.due<=now&&now<=item.expires)return item;return null}
function nextWriteDue(){let due=Infinity;for(const item of pendingWrites.values())if((item.state==="queued"||item.state==="retry")&&item.due<due)due=item.due;return due}

function paintAlarms(){
 const active=P.alarms.filter(a=>alarmVals[a.wireId]),unacked=active.filter(a=>!ackVals[a.wireId]);
 alarmCount.textContent=String(unacked.length);
 alarmOpen.classList.toggle("active",unacked.length>0);
 ackAll.disabled=!unacked.some(a=>a.local||comm.state==="ONLINE"&&pendingAck===null);
 if(!active.length){alarmbar.classList.remove("show");alarmbar.textContent=""}
 else{alarmbar.classList.add("show");alarmbar.textContent=unacked.length?unacked.map(a=>"["+String(a.severity).toUpperCase()+"]["+(a.local?"HMI":"PLC")+"] "+a.name).join(" | "):"Alarmas activas reconocidas ("+active.length+")";if(comm.state!=="ONLINE"&&active.some(a=>!a.local))alarmbar.textContent+=" | DATOS PLC DESACTUALIZADOS"}
 const order={high:3,warning:2,info:1};
 const list=[...P.alarms].sort((a,b)=>{const d=Number(Boolean(alarmVals[b.wireId]))-Number(Boolean(alarmVals[a.wireId]));return d||((order[b.severity]||0)-(order[a.severity]||0))});
 alarmList.replaceChildren();
 for(const a of list){
  const isActive=Boolean(alarmVals[a.wireId]),isAck=Boolean(ackVals[a.wireId]);
  const row=E("div","alarm-row"+(isActive?" active":"")),state=E("span","alarm-state"+(isActive&&!isAck?" on":"")),name=E("strong"),cond=E("span","alarm-cond"),ack=E("button","ack-one");
  state.textContent=!isActive?"Normal":isAck?"ACTIVA RECONOCIDA":"ACTIVA PENDIENTE";
  name.textContent="["+String(a.severity).toUpperCase()+"]["+(a.local?"HMI local":"PLC")+"] "+a.name;
  const ops={eq:"=",ne:"!=",gt:">",ge:">=",lt:"<",le:"<="};
  cond.textContent=a.binding+" "+(ops[a.operator]||a.operator)+" "+String(a.value);
  ack.textContent=isAck?"ACK OK":"Reconocer";
  ack.disabled=!isActive||isAck||!a.local&&(comm.state!=="ONLINE"||pendingAck!==null);
  ack.onclick=()=>acknowledge(a.wireId);
  row.append(state,name,cond,ack);alarmList.append(row);
 }
}

function paint(){updateLocalAlarms();expireWrites();for(const [n,o] of [...nodes,...popupNodes]){const v=currentValue(o.binding),pending=o.binding?pendingWrites.get(o.binding):null;n.classList.toggle("write-pending",Boolean(pending&&pending.state!=="error"));n.classList.toggle("write-error",Boolean(pending&&pending.state==="error"));n.classList.toggle("input-limit-error",Boolean(n.inputError));n.classList.toggle("input-dirty",Boolean(n.inputDirty));if(n.inputError)n.title=n.inputError;else if(pending)n.title=pending.state==="error"?(pending.error||"Escritura no confirmada"):"Escritura pendiente de confirmar";else n.removeAttribute("title");if(o.kind==="status"){const visualOn=boolValue(v)===(o.stateOnWhen!=="false");if(n.statusVisual&&visualOn!==n.visualOn){n.statusVisual.innerHTML=statusSvg(o.symbolType||"lamp",visualOn,o.lampOnColor);n.visualOn=visualOn}}else if(o.kind==="text"&&o.binding&&String(o.optionsText||"").trim()){const pairs=String(o.optionsText||"").split(/\\r?\\n/).map(x=>{const i=x.indexOf("=");return i<0?null:{key:x.slice(0,i).trim(),value:x.slice(i+1).trim()}}).filter(Boolean),match=pairs.find(x=>x.key===String(v)||(typeof v==="boolean"&&((x.key==="1"&&v)||(x.key==="0"&&!v)))||((x.key==="true"||x.key==="false")&&boolValue(v)===(x.key==="true")));n.querySelector(".in").textContent=match?match.value:(o.text||"")}else if(o.kind==="value")n.querySelector(".in").textContent=fmt(o,v,"--");else if(o.kind==="bar"){const q=Math.max(0,Math.min(100,100*(Number(v)-o.min)/(o.max-o.min||1)));n.fill.style.width=q+"%"}else if(o.kind==="tank"){const q=Math.max(0,Math.min(100,100*(Number(v)-o.min)/(o.max-o.min||1)));n.level.style.height=q+"%"}else if(n.control){const c=n.control,num=Number(v),valid=Number.isFinite(num),display=fmt(o,v,"--")+(o.unit?" "+o.unit:"");if(c.reading)c.reading.textContent=display;if(o.kind==="slider"){if(!c.input.matches(":active"))c.input.value=controlRange(o,v);c.input.disabled=!widgetWritable(o.binding)||Boolean(pending)}if(o.kind==="switch"){c.button.classList.toggle("on",boolValue(v));c.button.textContent=boolValue(v)?"ON":"OFF";c.button.disabled=!widgetWritable(o.binding)||Boolean(pending)}if(o.kind==="selector"){const writable=widgetWritable(o.binding)&&!pending;for(const choice of c.buttons){const active=choice.value===String(v??"");choice.button.classList.toggle("active",active);choice.button.setAttribute("aria-pressed",String(active));choice.button.disabled=!writable}}if(o.kind==="dropdown"){if(!c.input.matches(":focus"))c.input.value=String(v??"");c.input.disabled=!widgetWritable(o.binding)||Boolean(pending)}if(o.kind==="multistate"){const opt=optionsFor(o).find(x=>x.value===String(v));c.reading.textContent=opt?opt.label:String(v??"--");c.reading.style.color=opt&&opt.color||"#182230"}if(o.kind==="counter"){c.progress.style.width=(valid&&o.target>0?Math.max(0,Math.min(100,100*num/o.target)):0)+"%";c.target.textContent="Objetivo: "+o.target+" ("+(valid&&o.target>0?Math.round(100*num/o.target):0)+"%)"}if(o.kind==="gauge")c.ring.style.setProperty("--pct",(valid?100*(controlRange(o,num)-o.min)/(o.max-o.min||1):0)+"%");if(o.kind==="stepper"){c.minus.disabled=c.plus.disabled=!widgetWritable(o.binding)||Boolean(pending);c.minus.disabled||=(num<=o.min);c.plus.disabled||=(num>=o.max)}}else if(o.kind==="input"){if(pending)n.entry.value=pending.raw;else if(!n.inputDirty&&document.activeElement!==n.entry)n.entry.value=fmt(o,v,"")}else if(o.kind==="image"&&n.image&&o.binding){const key=boolValue(v)?(o.assetOnId||o.assetId):o.assetId;if(key!==n.imageKey){n.image.src=assets[key]||"";n.imageKey=key}}else if(o.kind==="button"&&n.button&&o.feedbackBinding){const on=boolValue(currentValue(o.feedbackBinding));n.button.style.backgroundColor=on?(o.feedbackColorOn||"#16a34a"):(o.feedbackColorOff||"#2563eb");n.button.textContent=(on?o.feedbackTextOn:o.feedbackTextOff)||o.text}if(o.expressionText){const value=expr(o.expressionText);if(value!==undefined&&value!==null){const target=n.querySelector(".in")||n.querySelector(".reading")||n.querySelector(".caption");if(target)target.textContent=String(value)}}if(o.expressionColor){const color=expr(o.expressionColor);n.style.color=typeof color==="string"&&CSS.supports("color",color)?color:""}if(o.expressionBackground){const color=expr(o.expressionBackground),surface=n.querySelector(".in")||n.querySelector(".control-panel")||n.querySelector(".track")||n.querySelector(".symbol")||n;surface.style.backgroundColor=typeof color==="string"&&CSS.supports("color",color)?color:""}if(o.expressionVisible){const visible=expr(o.expressionVisible);n.style.visibility=visible===undefined?"hidden":visible?"visible":"hidden"}else n.style.visibility=""}paintAlarms();updateCommStatus();if(P.recipeEnabled)refreshRecipeActualValues()}

async function readSnapshot(){const requestedScreen=screenIndex;
 const fullRead=Boolean(!popupWindow.hidden||(P.recipeEnabled&&(typeof recipeWindow!=="undefined"&&!recipeWindow.hidden||typeof recipeApplyJob!=="undefined"&&recipeApplyJob))||[...pendingWrites.values()].some(w=>w.state!=="error"));
 const expectedIds=new Set(fullRead?P.vars.map(v=>v.id):(P.screenVars[requestedScreen]||[]));
 const url=fullRead?"/api/read":"/api/read?screen="+requestedScreen;
 const r=await fetchTimed(url,{},READ_TIMEOUT);if(!r.ok)throw Error("HTTP "+r.status);
 const snap=parseSnapshot(await r.text(),expectedIds);
 if(requestedScreen!==screenIndex){comm.forceRead=true;return}
 Object.assign(vals,snap.vals);for(const id of plcAlarmIds){delete alarmVals[id];delete ackVals[id]}Object.assign(alarmVals,snap.alarms);Object.assign(ackVals,snap.ack);comm.lastSeq=snap.seq;comm.lastGoodAt=Date.now();comm.failures=0;setComm("ONLINE");confirmWrites();if(P.recipeEnabled)checkRecipeApplyJob();saveGoodSnapshot();if(P.screenBinding){const requested=Number(vals[P.screenBinding]),match=Number.isSafeInteger(requested)?P.screens.findIndex(s=>s.number===requested):-1,next=match<0?0:match;if(next!==screenIndex){showScreen(next);comm.forceRead=true;return;}}paint()}
async function sendWrite(item){const tag=byName[item.name];if(!tag){item.state="error";item.error="Variable no disponible";return}if(Date.now()>item.expires){item.state="error";item.error="Escritura caducada";return}item.attempts+=1;item.state="sending";paint();try{const r=await fetchTimed("/api/write?id="+tag.id,{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:item.raw},READ_TIMEOUT);if(!r.ok){item.state="error";item.error="HTTP "+r.status;return}item.state="sent";comm.forceRead=true}catch(e){if(item.attempts<MAX_WRITE_ATTEMPTS&&Date.now()<item.expires){item.state="retry";item.due=Date.now()+[300,700][Math.min(1,item.attempts-1)];item.error="Reintentando"}else{item.state="error";item.error="Escritura no confirmada"}comm.forceRead=true;failComm()}paint()}
async function sendAck(id){try{const r=await fetchTimed("/api/ack?id="+id,{method:"POST"},READ_TIMEOUT);if(!r.ok)throw Error("HTTP "+r.status);pendingAck=null;comm.forceRead=true}catch(e){pendingAck=null;statusEl.textContent="ACK NO CONFIRMADO";failComm();comm.forceRead=true}}
${recipeEnabled?'async function sendRecipe(item){try{const r=await fetchTimed("/api/recipe?id="+item.id,{method:"POST"},READ_TIMEOUT);if(!r.ok)throw Error("HTTP "+r.status);pendingRecipe=null;comm.forceRead=true;statusEl.textContent="RECETA ENVIADA | confirmando"}catch(e){pendingRecipe=null;failComm();statusEl.textContent="ERROR RECETA | no reintentada"}}':''}

async function commCycle(){if(comm.busy)return;comm.busy=true;let delay=Number(P.pollMs)||500;try{expireWrites();const w=dueWrite();if(w){await sendWrite(w);delay=comm.forceRead?50:Math.max(50,nextWriteDue()-Date.now())}else if(pendingAck!==null){await sendAck(pendingAck);delay=50}else if(P.recipeEnabled&&pendingRecipe){await sendRecipe(pendingRecipe);delay=50}else{if(comm.failures>=3)setComm("RECONNECTING");await readSnapshot();delay=Number(P.pollMs)||500}}catch(e){failComm();paint();delay=backoff()}finally{comm.busy=false;if(comm.forceRead){comm.forceRead=false;delay=50}else{const d=nextWriteDue();if(Number.isFinite(d))delay=Math.min(delay,Math.max(50,d-Date.now()))}schedule(delay)}}

function write(name,value,opt){const local=internalByName[name];if(local){
 const node=opt&&opt.node;
 try{
  let next;
  if(local.type==="BOOL")next=boolValue(value);
  else if(local.type==="STRING")next=String(value);
  else{
   const raw=String(value).trim();
   if(!raw||!Number.isFinite(Number(raw)))throw Error("Valor numerico interno no valido");
   next=Number(raw);
   if(local.type==="INT"){
    if(!/^[+-]?[0-9]+$/.test(raw)||!Number.isInteger(next)||next< -32768||next>32767)throw Error("INT interno fuera de rango (-32768..32767)");
   }
   const min=opt&&opt.min!==null&&opt.min!==undefined?Number(opt.min):null;
   const max=opt&&opt.max!==null&&opt.max!==undefined?Number(opt.max):null;
   if(min!==null&&next<min)throw Error("Valor menor que limite inferior ("+min+")");
   if(max!==null&&next>max)throw Error("Valor mayor que limite superior ("+max+")");
  }
  if(node)node.inputError="";
  internalVals[name]=next;
  paint();
  return true;
 }catch(e){
  if(node)node.inputError=e.message;
  paint();
  statusEl.textContent="VARIABLE INTERNA | "+e.message;
  return false;
 }
}const tag=byName[name];if(!tag||tag.access!=="RW")return false;const node=opt&&opt.node;try{let raw=String(value).trim();
if(["BYTE","WORD","DWORD","LWORD"].includes(tag.type)){const widths={BYTE:2,WORD:4,DWORD:8,LWORD:16},width=widths[tag.type];raw=raw.replace(/^(?:0x|16#)/i,"");if(!/^[0-9a-f]+$/i.test(raw)||raw.length>width)throw Error("Escribe "+width+" digitos hexadecimales como maximo");raw=raw.toUpperCase().padStart(width,"0")}
else if(["LINT","ULINT","TIME"].includes(tag.type)){if(!/^[+-]?\\d+$/.test(raw))throw Error("Se requiere un entero exacto");const n=BigInt(raw),signed=tag.type!=="ULINT";if(signed?(n<-(1n<<63n)||n>(1n<<63n)-1n):(n<0n||n>(1n<<64n)-1n))throw Error("Entero de 64 bits fuera de rango");raw=n.toString()}
else if(["DATE","DATE_AND_TIME","TIME_OF_DAY"].includes(tag.type))raw=calendarSeconds(tag.type,raw);
else if(tag.type!=="BOOL"&&tag.type!=="STRING"&&!/^-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?$/.test(raw))throw Error("Valor numerico no valido");
if(tag.type==="STRING"&&new TextEncoder().encode(raw).length>Math.min(512,Number(tag.stringLength)||255))throw Error("STRING supera longitud permitida");if(tag.enumValues&&!Object.values(tag.enumValues).includes(Number(raw)))throw Error("Valor no definido en enumeracion "+tag.enumType);if(["SINT","USINT","INT","UINT","DINT","UDINT"].includes(tag.type)){const ranges={SINT:[-128n,127n],USINT:[0n,255n],INT:[-32768n,32767n],UINT:[0n,65535n],DINT:[-2147483648n,2147483647n],UDINT:[0n,4294967295n]};if(!/^[+-]?[0-9]+$/.test(raw))throw Error("Se requiere entero exacto");const n=BigInt(raw),limits=ranges[tag.type];if(n<limits[0]||n>limits[1])throw Error(tag.type+" fuera de rango");raw=n.toString()}
if(!["BOOL","STRING","BYTE","WORD","DWORD","LWORD","LINT","ULINT","TIME","DATE","DATE_AND_TIME","TIME_OF_DAY"].includes(tag.type)){const num=Number(raw),min=opt&&opt.min!==null&&opt.min!==undefined?Number(opt.min):null,max=opt&&opt.max!==null&&opt.max!==undefined?Number(opt.max):null;if(min!==null&&num<min)throw Error("Valor menor que limite inferior ("+min+")");if(max!==null&&num>max)throw Error("Valor mayor que limite superior ("+max+")")}if(node)node.inputError="";pendingWrites.set(name,{name,raw,attempts:0,state:"queued",due:Date.now(),expires:Date.now()+WRITE_TTL,error:""});paint();schedule(0);return true}catch(e){if(node)node.inputError=e.message;paint();statusEl.textContent="ESCRITURA RECHAZADA | "+e.message;return false}}
function acknowledge(id){
 updateLocalAlarms();
 if(id===0){let localChanged=false;for(const a of P.alarms)if(a.local&&alarmVals[a.wireId]&&!ackVals[a.wireId]){ackVals[a.wireId]=true;localChanged=true}
 const plcUnacked=P.alarms.some(a=>!a.local&&alarmVals[a.wireId]&&!ackVals[a.wireId]);
 if(comm.state==="ONLINE"&&pendingAck===null&&plcUnacked){pendingAck=0;schedule(0)}
 if(localChanged)paintAlarms();return;
 }
 const a=P.alarms.find(a=>a.wireId===id);
 if(!a||!alarmVals[id]||ackVals[id])return;
 if(a.local){ackVals[id]=true;paintAlarms();return}
 if(comm.state!=="ONLINE"||pendingAck!==null)return;
 pendingAck=id;schedule(0)
}
ackAll.onclick=()=>acknowledge(0);
${recipeEnabled?'function applyRecipe(id){if(pendingRecipe){statusEl.textContent="RECETA PENDIENTE";return}pendingRecipe={id,at:Date.now()};schedule(0)}':''}

${recipeEnabled?recipeRuntimeJS():''}
function startComm(){loadCachedSnapshot();showScreen(0);fitStage();paint();schedule(0)}
startComm();
`;}
function recipeRuntimeJS(){return String.raw`
const recipeOpen=document.getElementById("recipeOpen"),recipeWindow=document.getElementById("recipeWindow"),recipeClose=document.getElementById("recipeClose");
const recipeSelect=document.getElementById("recipeSelect"),recipeName=document.getElementById("recipeName"),recipeFieldList=document.getElementById("recipeFieldList"),recipeMessageEl=document.getElementById("recipeMessage");
const recipeFields=P.recipeFields||[],recipeFieldsByName=Object.fromEntries(recipeFields.map(f=>[f.name,f]));
const recipeSlots=new Map();
let recipeRemoteReady=false,recipeBusy=false,recipeSelected="",recipeDraft=null,recipeDirty=false,recipeApplyJob=null;
function recipeClone(o){return JSON.parse(JSON.stringify(o))}
function recipeUid(){return "r"+Date.now().toString(36)+Math.random().toString(36).slice(2,10)}
function recipeAlert(t,error){recipeMessageEl.textContent=t;recipeMessageEl.style.color=error?"#b91c1c":"#0f4c81"}
function recipeSanitize(candidate,scope){
 if(!candidate||typeof candidate!=="object"||Array.isArray(candidate))throw Error("Receta no v\u00e1lida");
 const o={id:typeof candidate.id==="string"&&candidate.id.length<=100?candidate.id:recipeUid(),name:String(candidate.name||""),scope:"shared",values:Object.create(null)};
 if(!candidate.values||typeof candidate.values!=="object"||Array.isArray(candidate.values))throw Error("La receta necesita un mapa de valores");
 for(const [name,value] of Object.entries(candidate.values)){
  if(!Object.prototype.hasOwnProperty.call(recipeFieldsByName,name))throw Error("Variable ajena a este proyecto: "+name);
  o.values[name]=recipeTypedValue(recipeFieldsByName[name],value);
 }
 if(Object.keys(o.values).length>20)throw Error("Receta con m\u00e1s de 20 variables");
 if(!o.name.trim()||o.name.length>48)throw Error("Nombre de receta obligatorio, m\u00e1ximo 48 caracteres");
 return o
}
function recipeTypedValue(field,value){
 const type=field.type,raw=String(value??"").trim();
 if(type==="BOOL"){if(!/^(true|false|0|1)$/i.test(raw))throw Error(field.name+": usa TRUE o FALSE");return raw==="1"||raw.toLowerCase()==="true"}
 if(type==="STRING"){const str=String(value??"");if(new TextEncoder().encode(str).length>Math.min(512,Number(field.stringLength)||255))throw Error(field.name+": cadena demasiado larga");return str}
 if(["INT","SINT","USINT","UINT","DINT","UDINT","LINT","ULINT"].includes(type)){
  if(!/^[+-]?\d+$/.test(raw))throw Error(field.name+": n\u00famero entero obligatorio");
  const n=BigInt(raw),bounds={SINT:[-128n,127n],USINT:[0n,255n],INT:[-32768n,32767n],UINT:[0n,65535n],DINT:[-2147483648n,2147483647n],UDINT:[0n,4294967295n],LINT:[-(1n<<63n),(1n<<63n)-1n],ULINT:[0n,(1n<<64n)-1n]};
  const lim=bounds[type];if(n<lim[0]||n>lim[1])throw Error(field.name+": entero fuera de rango");return n.toString();
 }
 if(["REAL","LREAL"].includes(type)){
  if(!raw||!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw))throw Error(field.name+": decimal no v\u00e1lido (usa punto)");
  const n=Number(raw);if(!Number.isFinite(n))throw Error(field.name+": decimal no v\u00e1lido");return n;
 }
 if(["BYTE","WORD","DWORD","LWORD"].includes(type)){
  const width={BYTE:2,WORD:4,DWORD:8,LWORD:16}[type],hex=raw.replace(/^(0x|16#)/i,"");
  if(!new RegExp("^[0-9a-f]{1,"+width+"}$","i").test(hex))throw Error(field.name+": hexadecimal no v\u00e1lido");return hex.toUpperCase().padStart(width,"0");
 }
 if(type==="TIME"&&!/^[+-]?\d+$/.test(raw))throw Error(field.name+": TIME debe ser nanosegundos enteros");
 if(type==="DATE"&&!/^\d{4}-\d{2}-\d{2}(?:-\d{2}:\d{2}:\d{2})?$/.test(raw))throw Error(field.name+": DATE no v\u00e1lida");
 if(type==="TIME_OF_DAY"&&!/^\d\d:\d\d:\d\d$/.test(raw))throw Error(field.name+": hora no v\u00e1lida");
 if(type==="DATE_AND_TIME"&&!/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}:\d{2}$/.test(raw))throw Error(field.name+": fecha y hora no v\u00e1lidas");
 return raw
}
function recipeASCII(o){return JSON.stringify({id:o.id,name:o.name,values:o.values}).replace(/[^\x00-\x7F]/g,c=>"\\u"+c.charCodeAt(0).toString(16).padStart(4,"0"))}
function recipeSeedShared(){
 let slot=1;
 for(const r of P.recipes.slice(0,P.recipeSlots)){
  try{recipeSlots.set(slot,{rev:0,data:recipeSanitize(r,"shared"),fallback:true})}catch{}
  slot++;
 }
}
function recipeListItems(){
 const items=[];
 for(const [slot,item] of [...recipeSlots].sort((a,b)=>a[0]-b[0]))if(item.data)items.push({key:"S:"+slot,data:item.data,slot,rev:item.rev});
 return items
}
function recipeSelectItem(key){
 const item=recipeListItems().find(x=>x.key===key);
 if(!item){recipeSelected="";recipeDraft=null;recipeDirty=false;renderRecipeManager();return}
 recipeSelected=key;recipeDraft=recipeClone(item.data);recipeDirty=false;renderRecipeManager();
}
function recipeCurrentString(field){
 if(field.source==="PLC"&&comm.state!=="ONLINE")return "\u2014 (NX desconectado)";
 const value=currentValue(field.name);return value===undefined?"\u2014":String(value)
}
function refreshRecipeActualValues(){
 if(recipeWindow.hidden)return;
 for(const el of recipeFieldList.querySelectorAll("[data-recipe-current]")){const f=recipeFieldsByName[el.getAttribute("data-recipe-current")];if(f)el.textContent=recipeCurrentString(f)}
}
function renderRecipeManager(){
 const items=recipeListItems();
 recipeSelect.replaceChildren();
 for(const item of items){const option=E("option");option.value=item.key;option.textContent="NX \u00b7 "+item.data.name;recipeSelect.append(option)}
 if(recipeDraft&&recipeSelected.startsWith("N:")){const option=E("option");option.value=recipeSelected;option.textContent="Sin guardar \u00b7 "+recipeDraft.name;recipeSelect.append(option)}
 if(!recipeDraft&&items.length){recipeSelected=items[0].key;recipeDraft=recipeClone(items[0].data)}
 if(recipeDraft){recipeSelect.value=recipeSelected;recipeName.value=recipeDraft.name}
 else{recipeName.value=""}
 const existing=!recipeSelected.startsWith("N:")&&Boolean(recipeDraft);
 recipeName.disabled=!recipeDraft||recipeBusy;
 recipeFieldList.replaceChildren();
 for(const f of recipeFields){
  const row=E("div","recipe-field"),label=E("label","recipe-check"),check=E("input"),title=E("span"),fieldInput=f.type==="BOOL"?E("select","recipe-val"):E("input","recipe-val"),actual=E("span","recipe-live");
  check.type="checkbox";check.checked=Boolean(recipeDraft&&Object.prototype.hasOwnProperty.call(recipeDraft.values,f.name));check.disabled=!recipeDraft||recipeBusy;
  check.setAttribute("data-recipe-included",f.name);
  title.textContent=f.name+" \u00b7 "+f.type+" \u00b7 "+f.source;
  label.append(check,title);fieldInput.setAttribute("data-recipe-value",f.name);
  if(f.type==="BOOL"){for(const b of ["false","true"]){const o=E("option");o.value=b;o.textContent=b.toUpperCase();fieldInput.append(o)}}
  else fieldInput.type="text";
  fieldInput.value=check.checked?String(recipeDraft.values[f.name]):"";
  fieldInput.disabled=!check.checked||recipeBusy;
  check.onchange=()=>{fieldInput.disabled=!check.checked||recipeBusy;if(check.checked&&!fieldInput.value)fieldInput.value=String(recipeCurrentString(f).startsWith("\u2014")?(f.type==="BOOL"?"false":f.type==="STRING"?"":"0"):currentValue(f.name));recipeDirty=true};
  fieldInput.oninput=()=>{recipeDirty=true};if(P.keyboardMode==="webhmi"&&f.type!=="BOOL"){fieldInput.readOnly=true;fieldInput.inputMode="none";fieldInput.setAttribute("aria-haspopup","dialog");fieldInput.onclick=()=>{if(fieldInput.disabled)return;openVirtualKeyboard({title:f.name+" \u00b7 "+f.type,type:f.type,value:fieldInput.value,maxLength:f.type==="STRING"?Math.min(512,Number(f.stringLength)||255):64,onAccept:raw=>{recipeTypedValue(f,raw);fieldInput.value=raw;fieldInput.dispatchEvent(new Event("input",{bubbles:true}));}})}}
  actual.setAttribute("data-recipe-current",f.name);actual.textContent=recipeCurrentString(f);
  row.append(label,fieldInput,actual);recipeFieldList.append(row);
 }
 const disable=!recipeDraft||recipeBusy;
 for(const id of ["recipeSave","recipeApply","recipeCapture","recipeDelete","recipeDuplicate"])document.getElementById(id).disabled=disable;
 document.getElementById("recipeDelete").disabled=disable||recipeSelected.startsWith("N:");
 document.getElementById("recipeApply").disabled=disable||recipeSelected.startsWith("N:")||recipeDirty;
 recipeSelect.disabled=recipeBusy;document.getElementById("recipeNew").disabled=recipeBusy;document.getElementById("recipeImport").disabled=recipeBusy;
 document.getElementById("recipeRefresh").disabled=recipeBusy;
 recipeName.oninput=()=>{recipeDirty=true;document.getElementById("recipeApply").disabled=true};
}
function recipeReadForm(){
 if(!recipeDraft)throw Error("Selecciona una receta");
 const o={id:recipeDraft.id,name:recipeName.value.trim(),scope:"shared",values:Object.create(null)};
 for(const check of recipeFieldList.querySelectorAll("[data-recipe-included]"))if(check.checked){
  const name=check.getAttribute("data-recipe-included"),field=recipeFieldsByName[name],input=Array.from(recipeFieldList.querySelectorAll("[data-recipe-value]")).find(x=>x.getAttribute("data-recipe-value")===name);
  o.values[name]=recipeTypedValue(field,input.value);
 }
 if(!o.name||o.name.length>48)throw Error("Nombre obligatorio, m\u00e1ximo 48 caracteres");
 if(!Object.keys(o.values).length)throw Error("Selecciona al menos una variable para la receta");
 if(Object.keys(o.values).length>20)throw Error("M\u00e1ximo 20 par\u00e1metros");
 if(new TextEncoder().encode(recipeASCII(o)).length>P.recipeBytes)throw Error("La receta supera los "+P.recipeBytes+" bytes del banco NX");
 if(recipeListItems().some(x=>x.key!==recipeSelected&&x.data.scope===o.scope&&x.data.name.toLowerCase()===o.name.toLowerCase()))throw Error("Ya hay otra receta con ese nombre");
 return o
}
recipeSeedShared();

async function recipeRefreshShared(silent){
 if(recipeDirty&&!silent){
  if(!confirm("Hay cambios sin guardar. \u00bfDescartarlos y actualizar las recetas NX?"))return;
  recipeDirty=false;
 }
 if(recipeBusy)return;
 recipeBusy=true;renderRecipeManager();
 try{
  const res=await fetchTimed("/api/recipes",{},READ_TIMEOUT);
  if(!res.ok)throw Error("HTTP "+res.status);
  const lines=(await res.text()).split(/\r?\n/);if(lines[0]!=="RCPV=1")throw Error("El NX no expone la versi\u00f3n de banco de recetas");
  const versions=new Map();
  for(const line of lines.slice(1)){const m=line.match(/^(\d{1,2})=(\d+)$/);if(m)versions.set(Number(m[1]),Number(m[2]))}
  if(versions.size!==P.recipeSlots)throw Error("Resumen NX incompleto");
  const next=new Map();
  for(let slot=1;slot<=P.recipeSlots;slot++){
   const rev=versions.get(slot),old=recipeSlots.get(slot);
   if(rev===0){next.set(slot,{rev:0,data:null});continue}
   if(old&&old.rev===rev&&!old.fallback){next.set(slot,old);continue}
   const r=await fetchTimed("/api/recipe?slot="+slot,{},READ_TIMEOUT);
   if(!r.ok)throw Error("Error leyendo receta NX "+slot+": HTTP "+r.status);
   const body=await r.text();let data=null;
   if(body.trim()){try{data=recipeSanitize(JSON.parse(body),"shared")}catch(e){throw Error("Ranura NX "+slot+" no compatible: "+e.message)}}
   next.set(slot,{rev,data});
  }
  recipeSlots.clear();for(const [slot,item] of next)recipeSlots.set(slot,item);
  recipeRemoteReady=true;
  if(!recipeDirty||!recipeDraft){const current=recipeListItems().find(x=>x.key===recipeSelected);recipeDraft=current?recipeClone(current.data):null;recipeDirty=false}
  recipeAlert("Recetas compartidas actualizadas desde NX");
 }catch(e){recipeRemoteReady=false;recipeAlert("No se han podido consultar las recetas compartidas: "+e.message+". Los datos precargados son solo lectura.",true)}
 finally{recipeBusy=false;renderRecipeManager()}
}
async function recipeStoreShared(rec,slot,expected){
 if(!recipeRemoteReady)throw Error("Sin banco NX accesible; no se puede guardar");
 const body=rec?recipeASCII(rec):"";
 if(new TextEncoder().encode(body).length>P.recipeBytes)throw Error("Supera el l\u00edmite de "+P.recipeBytes+" bytes por receta NX");
 const res=await fetchTimed("/api/recipe?slot="+slot+"&rev="+expected,{
  method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body
 },READ_TIMEOUT);
 if(res.status===409)throw Error("Conflicto: otro navegador modific\u00f3 esta receta. Exporta tu copia y pulsa Actualizar NX");
 if(!res.ok)throw Error("El NX rechaz\u00f3 la escritura de la receta (HTTP "+res.status+")");
 const txt=await res.text(),m=txt.match(/^REV=(\d+)/);
 if(!m)throw Error("El NX no confirm\u00f3 la nueva versi\u00f3n de la receta");
 const rev=Number(m[1]);recipeSlots.set(slot,{rev,data:rec?recipeClone(rec):null});
 return rev
}
function recipeFirstSlot(){
 for(let slot=1;slot<=P.recipeSlots;slot++){const item=recipeSlots.get(slot);if(!item||!item.data)return{slot,rev:item?.rev||0}}
 return null
}
function recipeDuplicateName(copy){
 const taken=new Set(recipeListItems().filter(x=>x.data.scope===copy.scope).map(x=>x.data.name.trim().toLowerCase()));
 for(let n=1;n<=999;n++){
  const suffix=n===1?" (copia)":" (copia "+n+")";
  const candidate=copy.name.slice(0,48-suffix.length).trimEnd()+suffix;
  if(!taken.has(candidate.trim().toLowerCase()))return candidate;
 }
 throw Error("No queda un nombre disponible para la copia")
}
function recipeNewDraft(copy){
 const o=copy?recipeClone(copy):{id:recipeUid(),name:"Nueva receta",scope:"shared",values:{}};
 o.id=recipeUid();o.scope="shared";o.name=copy?recipeDuplicateName(o):"Nueva receta";recipeSelected="N:"+o.id;recipeDraft=o;recipeDirty=true;renderRecipeManager();recipeAlert("Receta sin guardar: modifica nombre y valores y pulsa Guardar en NX")
}
async function recipeSaveDraft(){
 if(recipeBusy)return;
 let record;try{record=recipeReadForm()}catch(e){recipeAlert(e.message,true);return}
 const originalKey=recipeSelected;
 recipeDraft=recipeClone(record); // Keep unsaved edits intact even if NX save fails or returns 409.
 if(!recipeRemoteReady){recipeAlert("Conecta con el NX antes de guardar una receta compartida",true);return}
 recipeBusy=true;renderRecipeManager();
 try{
  const existing=originalKey.startsWith("S:")?Number(originalKey.slice(2)):0,free=existing?null:recipeFirstSlot();
  if(!existing&&!free)throw Error("El banco NX est\u00e1 lleno ("+P.recipeSlots+" recetas). Elimina una o aumenta su capacidad en el editor");
  const slot=existing||free.slot,rev=existing?recipeSlots.get(slot).rev:free.rev;
  await recipeStoreShared(record,slot,rev);recipeSelected="S:"+slot;
  recipeDraft=recipeClone(record);recipeDirty=false;recipeAlert("Receta guardada: "+record.name);
 }catch(e){recipeAlert("No guardada: "+e.message,true)}
 finally{recipeBusy=false;renderRecipeManager()}
}
async function recipeDeleteSelected(){
 if(recipeBusy||!recipeDraft)return;
 if(recipeSelected.startsWith("N:")){recipeSelected="";recipeDraft=null;recipeDirty=false;renderRecipeManager();return}
 if(!confirm("\u00bfEliminar definitivamente la receta '"+recipeDraft.name+"' de la memoria Retain NX?"))return;
 recipeBusy=true;renderRecipeManager();
 try{
  const slot=Number(recipeSelected.slice(2)),item=recipeSlots.get(slot);
  await recipeStoreShared(null,slot,item.rev);
  recipeDraft=null;recipeSelected="";recipeDirty=false;recipeAlert("Receta eliminada");
 }catch(e){recipeAlert("No eliminada: "+e.message,true)}
 finally{recipeBusy=false;renderRecipeManager()}
}
function recipeCaptureCurrent(){
 if(!recipeDraft)return;let captured=0,skipped=0;
 for(const field of recipeFields){
  const v=currentValue(field.name);
  if(v===undefined||field.source==="PLC"&&comm.state!=="ONLINE"){skipped++;continue}
  const included=Array.from(recipeFieldList.querySelectorAll("[data-recipe-included]")).find(x=>x.getAttribute("data-recipe-included")===field.name);
  const input=Array.from(recipeFieldList.querySelectorAll("[data-recipe-value]")).find(x=>x.getAttribute("data-recipe-value")===field.name);
  included.checked=true;input.disabled=false;input.value=String(v);captured++;
 }
 recipeDirty=true;document.getElementById("recipeApply").disabled=true;
 recipeAlert("Valores actuales capturados: "+captured+(skipped?"; omitidos sin lectura: "+skipped:"")+". Pulsa Guardar para conservarlos");
}
function recipeExportJSON(){
 const all=recipeListItems().map(x=>recipeClone(x.data));
 const data=JSON.stringify({format:"webhmi-recipes-v1",projectKey:P.recipeKey,exportedAt:new Date().toISOString(),recipes:all},null,2);
 const blob=new Blob([data],{type:"application/json"}),url=URL.createObjectURL(blob),a=E("a");
 a.href=url;a.download=(String(P.name||"WebHMI").replace(/[^a-z0-9_-]+/gi,"_"))+"_recetas.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 recipeAlert("Copia de "+all.length+" recetas exportada a JSON")
}
async function recipeImportFile(file){
 if(!file||file.size>512000){recipeAlert("JSON de recetas demasiado grande",true);return}
 let input;try{input=JSON.parse(await file.text())}catch{recipeAlert("Archivo JSON no v\u00e1lido",true);return}
 if(input?.format!=="webhmi-recipes-v1"||!Array.isArray(input.recipes)){recipeAlert("Formato de archivo de recetas no reconocido",true);return}
 if(input.projectKey!==P.recipeKey&&!confirm("Las recetas proceden de otro proyecto. \u00bfImportar \u00fanicamente los par\u00e1metros compatibles?"))return;
 if(!confirm("\u00bfImportar "+input.recipes.length+" recetas como NUEVAS, sin sobrescribir las actuales? Se grabar\u00e1n las compartidas en el NX."))return;
 recipeBusy=true;renderRecipeManager();let created=0,error="";
 try{
  for(const raw of input.recipes){
   const record=recipeSanitize(raw,"shared");record.id=recipeUid();
   if(recipeListItems().some(x=>x.data.name.toLowerCase()===record.name.toLowerCase())){error="La receta "+record.name+" ya existe";break}
   if(!recipeRemoteReady){error="NX sin conexi\u00f3n";break}
   const free=recipeFirstSlot();if(!free){error="Banco NX lleno";break}
   await recipeStoreShared(record,free.slot,free.rev);
   created++;
  }
 }catch(e){error=e.message}
 finally{recipeBusy=false;recipeDirty=false;recipeDraft=null;recipeSelected="";renderRecipeManager();
  recipeAlert("Importadas "+created+" recetas."+(error?" Interrumpida: "+error+". Las anteriores siguen guardadas.":""),Boolean(error))
 }
}
function checkRecipeApplyJob(){
 const job=recipeApplyJob;if(!job)return;
 const failed=job.plc.find(x=>pendingWrites.get(x.name)?.state==="error");
 if(failed||Date.now()-job.started>18000){
  recipeApplyJob=null;recipeBusy=false;renderRecipeManager();
  recipeAlert("Aplicaci\u00f3n PARCIAL o sin confirmar"+(failed?" ("+failed.name+")":" (plazo agotado)")+". Revisa las consignas del PLC antes de reintentar.",true);return
 }
 if(job.plc.every(x=>!pendingWrites.has(x.name)&&sameValue(byName[x.name],vals[x.name],String(x.value)))){
  recipeApplyJob=null;
  let ok=true;for(const x of job.local)if(!write(x.name,x.value))ok=false;
  recipeBusy=false;renderRecipeManager();
  recipeAlert(ok?"Receta aplicada: valores PLC verificados y variables HMI actualizadas":"Consignas PLC verificadas, pero fall\u00f3 un valor local",!ok);
 }
}
async function recipeApplySelected(){
 if(recipeBusy)return;
 if(!recipeDraft||recipeSelected.startsWith("N:")||recipeDirty){recipeAlert("Guarda antes de aplicar la receta",true);return}
 let record;
 try{record=recipeReadForm()}catch(e){recipeAlert(e.message,true);return}
 if(recipeSelected.startsWith("S:")){
  if(!recipeRemoteReady){recipeAlert("No se puede aplicar una receta NX sin leer primero el banco de recetas",true);return}
  recipeBusy=true;renderRecipeManager();
  try{
   const slot=Number(recipeSelected.slice(2)),res=await fetchTimed("/api/recipes",{},READ_TIMEOUT);
   if(!res.ok)throw Error("HTTP "+res.status);
   const txt=await res.text();
   if(!txt.startsWith("RCPV=1"))throw Error("respuesta de banco incompatible");
   const line=txt.split(/\r?\n/).find(x=>x.startsWith(slot+"="));
   if(!line||Number(line.split("=")[1])!==recipeSlots.get(slot)?.rev)
    throw Error("La receta ha cambiado en otro navegador. Actualiza NX antes de aplicarla");
  }catch(e){recipeBusy=false;renderRecipeManager();recipeAlert("Aplicaci\u00f3n bloqueada: "+e.message,true);return}
  recipeBusy=false;renderRecipeManager();
 }
 const plc=[],local=[];
 for(const [name,value] of Object.entries(record.values)){
  const field=recipeFieldsByName[name];
  (field.source==="PLC"?plc:local).push({name,value})
 }
 if(!plc.length&&!local.length){recipeAlert("La receta no contiene valores",true);return}
 if(plc.length&&comm.state!=="ONLINE"){recipeAlert("PLC sin comunicaci\u00f3n: no se aplicar\u00e1n consignas PLC",true);return}
 if(plc.length&&pendingWrites.size){recipeAlert("Hay escrituras PLC pendientes. Resu\u00e9lvelas antes de aplicar otra receta",true);return}
 if(!confirm("\u00bfAplicar "+record.name+"? Se escribir\u00e1n "+plc.length+" consignas PLC y "+local.length+" variables internas. Las consignas PLC se escriben secuencialmente (NO de forma at\u00f3mica)."))return;
 if(!plc.length){let ok=true;for(const x of local)if(!write(x.name,x.value))ok=false;
  recipeAlert(ok?"Receta HMI local aplicada correctamente":"No se pudieron aplicar todos los valores locales",!ok);renderRecipeManager();return
 }
 recipeApplyJob={plc,local,started:Date.now()};recipeBusy=true;renderRecipeManager();recipeAlert("Aplicando al PLC y comprobando valores recibidos...");
 for(const x of plc)if(!write(x.name,x.value)){
  recipeApplyJob=null;recipeBusy=false;renderRecipeManager();recipeAlert("Escritura rechazada para "+x.name+"; puede haber otras escrituras pendientes",true);return
 }
 schedule(0)
}
recipeOpen.onclick=()=>{
 recipeWindow.hidden=false;renderRecipeManager();
 if(!recipeRemoteReady)recipeRefreshShared(true);
};
recipeClose.onclick=()=>{if(recipeDirty&&!confirm("Cambios sin guardar. \u00bfCerrar el gestor?"))return;recipeWindow.hidden=true;recipeDirty=false};
recipeWindow.onclick=e=>{if(e.target===recipeWindow)recipeClose.click()};
recipeSelect.onchange=()=>{
 if(recipeDirty&&!confirm("La receta actual tiene cambios sin guardar. \u00bfDescartarlos?")){recipeSelect.value=recipeSelected;return}
 recipeSelectItem(recipeSelect.value)
};
document.getElementById("recipeRefresh").onclick=()=>recipeRefreshShared(false);
document.getElementById("recipeNew").onclick=()=>{if(recipeDirty&&!confirm("Descartar los cambios sin guardar y crear otra receta?"))return;recipeNewDraft(null)};
document.getElementById("recipeDuplicate").onclick=()=>{
 if(!recipeDraft)return;
 let source;try{source=recipeReadForm()}catch(e){recipeAlert(e.message,true);return}
 if(recipeDirty&&!confirm("Duplicar los valores visibles sin guardar los cambios en la receta original?"))return;
 try{recipeNewDraft(source)}catch(e){recipeAlert(e.message,true)}
};
document.getElementById("recipeSave").onclick=()=>recipeSaveDraft();
document.getElementById("recipeDelete").onclick=()=>recipeDeleteSelected();
document.getElementById("recipeCapture").onclick=()=>recipeCaptureCurrent();
document.getElementById("recipeApply").onclick=()=>recipeApplySelected();
document.getElementById("recipeExport").onclick=()=>recipeExportJSON();
document.getElementById("recipeImport").onclick=()=>document.getElementById("recipeImportFile").click();
document.getElementById("recipeImportFile").onchange=async e=>{try{await recipeImportFile(e.target.files[0])}finally{e.target.value=""}};

`;}

// A single browser-side, dependency-free keyboard is embedded only when the project selects WebHMI.
function virtualKeyboardMarkup(){return '<div id="virtualKeyboard" class="vk-overlay" role="dialog" aria-modal="true" aria-label="Teclado virtual" hidden><div class="vk-card"><div class="vk-head"><strong id="vkTitle">Introducir valor</strong><button type="button" id="vkClose" aria-label="Cancelar">&#215;</button></div><input id="vkValue" type="text" inputmode="none" autocomplete="off" spellcheck="false" aria-label="Valor a introducir"><p id="vkError" role="alert" aria-live="polite"></p><div id="vkKeys" class="vk-keys" role="group" aria-label="Teclas virtuales"></div><div class="vk-actions"><button type="button" id="vkCancel">Cancelar</button><button type="button" id="vkAccept">Aceptar</button></div></div></div>'}
function virtualKeyboardCSS(){return '.vk-overlay{position:fixed;inset:0;z-index:2500;background:#000b;display:flex;align-items:center;justify-content:center;padding:12px}.vk-overlay[hidden]{display:none}.vk-card{width:min(560px,100%);max-height:96dvh;overflow:auto;border-radius:12px;background:#f8fafc;color:#111827;box-shadow:0 22px 60px #0009;padding:14px;display:flex;flex-direction:column;gap:10px}.vk-head{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:16px}.vk-head button{border:0;background:#e2e8f0;padding:8px 14px;border-radius:7px;font-size:21px;color:#111827;cursor:pointer}.vk-card #vkValue{width:100%;height:52px;min-height:52px;padding:9px 12px;background:white;border:2px solid #64748b;border-radius:8px;text-align:right;font-size:25px;color:#111827}.vk-card #vkError{margin:0;min-height:0;color:#b91c1c;font-size:13px}.vk-card #vkError:empty{display:none}.vk-keys{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:5px;touch-action:manipulation}.vk-keys.numeric{grid-template-columns:repeat(3,minmax(0,1fr));max-width:330px;width:100%;align-self:center;gap:7px}.vk-keys button{min-width:0;min-height:44px;padding:7px 1px;background:#e2e8f0;color:#111827;border:1px solid #94a3b8;border-radius:6px;font-size:16px;font-weight:600;cursor:pointer;touch-action:manipulation}.vk-keys.numeric button{min-height:53px;font-size:22px}.vk-keys button.vk-wide{grid-column:span 2;font-size:13px}.vk-keys button:disabled{opacity:.32;cursor:default}.vk-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}.vk-actions button{min-height:50px;border:0;border-radius:7px;font-size:17px;font-weight:700;background:#cbd5e1;color:#111827;cursor:pointer}.vk-actions #vkAccept{background:#2563eb;color:white}@media(max-width:450px){.vk-card{padding:9px;gap:7px}.vk-keys{gap:3px}.vk-keys button{min-height:40px;font-size:13px}.vk-keys.numeric button{min-height:48px}}'}
function virtualKeyboardJS(){return String.raw`
const vkOverlay=document.getElementById("virtualKeyboard"),vkTitle=document.getElementById("vkTitle"),vkInput=document.getElementById("vkValue"),vkKeys=document.getElementById("vkKeys"),vkError=document.getElementById("vkError");
let vkSession=null,vkShift=true;
function vkKind(type){return ["SINT","USINT","INT","UINT","DINT","UDINT","LINT","ULINT","REAL","LREAL","TIME"].includes(type)?"numeric":"alpha"}
function vkKeyButton(label,value,wide,disabled){
 const button=document.createElement("button");button.type="button";button.textContent=label;button.setAttribute("aria-label",label);if(wide)button.className="vk-wide";button.disabled=!!disabled;
 button.addEventListener("click",()=>vkKey(value));vkKeys.append(button)
}
function vkRenderKeys(){
 if(!vkSession)return;
 const numeric=vkKind(vkSession.type)==="numeric",signed=["SINT","INT","DINT","LINT","REAL","LREAL","TIME"].includes(vkSession.type),decimal=["REAL","LREAL"].includes(vkSession.type);
 vkKeys.className="vk-keys"+(numeric?" numeric":"");
 vkKeys.replaceChildren();
 if(numeric){for(const k of ["7","8","9","4","5","6","1","2","3","±","0",".","⌫","Limpiar"]){vkKeyButton(k,k,false,(k==="±"&&!signed)||(k==="."&&!decimal))}}
 else {
  for(const k of "1234567890qwertyuiopasdfghjklzxcvbnm")vkKeyButton(/[a-z]/.test(k)&&vkShift?k.toUpperCase():k,k,false,false);
  for(const k of ["-","_",".","/","@",":","Espacio","Mayús","⌫","Limpiar"])vkKeyButton(k,k,k==="Espacio"||k==="Limpiar",false);
 }
}
function vkKey(key){
 if(!vkSession)return;
 const start=vkInput.selectionStart??vkInput.value.length,end=vkInput.selectionEnd??start,old=vkInput.value;
 if(key==="Mayús"){vkShift=!vkShift;vkRenderKeys();return}
 if(key==="Limpiar"){vkInput.value=""}
 else if(key==="±"){vkInput.value=old.startsWith("-")?old.slice(1):"-"+old}
 else if(key==="⌫"){vkInput.value=start===end?old.slice(0,Math.max(0,start-1))+old.slice(end):old.slice(0,start)+old.slice(end)}
 else{
  let insert=key==="Espacio"?" ":vkKind(vkSession.type)==="alpha"&&/^[a-z]$/.test(key)&&vkShift?key.toUpperCase():key;
  if(insert==="."&&vkKind(vkSession.type)==="numeric"&&old.includes("."))return;
  vkInput.value=old.slice(0,start)+insert+old.slice(end);
 }
 vkError.textContent="";
 vkInput.focus({preventScroll:true});
 let pos=key==="Limpiar"?0:key==="±"?vkInput.value.length:key==="⌫"?Math.max(0,start-(start===end?1:0)):Math.min(vkInput.value.length,start+(key==="Espacio"?1:key.length));
 vkInput.setSelectionRange(pos,pos);
}
function openVirtualKeyboard(spec){
 if(!spec||typeof spec.onAccept!=="function")return;
 vkSession={...spec,origin:document.activeElement};
 vkShift=true;vkTitle.textContent=spec.title||"Introducir valor";vkInput.maxLength=Math.max(1,Math.min(512,Number(spec.maxLength)||512));vkInput.value=String(spec.value??"");vkError.textContent="";
 vkRenderKeys();vkOverlay.hidden=false;vkInput.focus({preventScroll:true});vkInput.select();
}
function vkCloseKeyboard(){
 if(!vkSession)return;
 const origin=vkSession.origin;
 vkSession=null;vkOverlay.hidden=true;vkError.textContent="";
 if(origin&&origin.isConnected)origin.focus({preventScroll:true});
}
function vkConfirm(){
 if(!vkSession)return;
 const raw=vkInput.value;
 try{
  const spec=vkSession;
  if(vkKind(spec.type)==="numeric"){
   const pattern=["REAL","LREAL"].includes(spec.type)?/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/:/^[+-]?\d+$/;
   if(!pattern.test(raw.trim()))throw Error("Formato numérico no válido"+(["REAL","LREAL"].includes(spec.type)?" (utiliza punto decimal)":""));
  }
  spec.onAccept(raw);vkCloseKeyboard()
 }catch(e){vkError.textContent=String(e.message||e)}
}
document.getElementById("vkClose").onclick=vkCloseKeyboard;
document.getElementById("vkCancel").onclick=vkCloseKeyboard;
document.getElementById("vkAccept").onclick=vkConfirm;
vkInput.oninput=()=>{vkError.textContent=""};
window.addEventListener("keydown",e=>{if(vkOverlay.hidden)return;if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();vkCloseKeyboard()}else if(e.key==="Enter"){e.preventDefault();e.stopImmediatePropagation();vkConfirm()}},true);
if(P.recipeEnabled){
 recipeName.readOnly=true;recipeName.inputMode="none";recipeName.setAttribute("aria-haspopup","dialog");
 recipeName.onclick=()=>{if(recipeName.disabled)return;openVirtualKeyboard({title:"Nombre de receta",type:"STRING",value:recipeName.value,maxLength:48,onAccept:raw=>{if(!raw.trim())throw Error("El nombre de receta no puede estar vacío");recipeName.value=raw;recipeName.dispatchEvent(new Event("input",{bubbles:true}))}})};
}
`;}
C.buildRuntimeHTML=buildRuntimeHTML;
})(globalThis);

(function(root){'use strict';const C=root.NXST,enc=new TextEncoder();
function stLiteral(s){return String(s).replace(/\$/g,()=> '$$').replace(/'/g,()=> "$'").replace(/\r/g,()=> '$r').replace(/\n/g,()=> '$n');}
function chunks(text,max=1400){const out=[];for(let i=0;i<text.length;i+=max)out.push(text.slice(i,i+max));return out;}
function toStringExpr(v){
 if(v.type==='BOOL')return null;
 if(v.enumType)return 'DINT_TO_STRING(EnumToNum('+v.name+'))';
 if(v.type==='STRING')return v.name;
 if(v.type==='TIME')return 'LINT_TO_STRING(TimeToNanoSec('+v.name+'))';
 if(v.type==='DATE')return 'DateToString('+v.name+')';
 if(v.type==='TIME_OF_DAY')return 'TodToString('+v.name+')';
 if(v.type==='DATE_AND_TIME')return 'DtToString('+v.name+')';
 return v.type+'_TO_STRING('+v.name+')';
}
function fromStringExpr(v){
 if(v.type==='BOOL')return null;
 if(v.type==='STRING')return 'Web_ValueText';
 if(v.type==='TIME')return 'NanoSecToTime(STRING_TO_LINT(Web_ValueText))';
 if(v.type==='DATE')return 'SecToDate(STRING_TO_LINT(Web_ValueText))';
 if(v.type==='TIME_OF_DAY')return 'SecToTod(STRING_TO_LINT(Web_ValueText))';
 if(v.type==='DATE_AND_TIME')return 'SecToDt(STRING_TO_LINT(Web_ValueText))';
 return 'STRING_TO_'+v.type+'(Web_ValueText)';
}
function stTyped(v,value){
 const t=v.type,canonical=C.sysmacTypes&&C.sysmacTypes.canonicalWrite;
 if(t==='BOOL')return (value===true||String(value)==='1'||String(value).toLowerCase()==='true')?'TRUE':'FALSE';
 if(t==='STRING')return "'"+stLiteral(String(value))+"'";
 if(t==='REAL'||t==='LREAL'){const n=Number(value);if(!Number.isFinite(n))throw Error(t+': valor invalido');return t+'#'+(Number.isInteger(n)?n.toFixed(1):String(n));}
 if(['BYTE','WORD','DWORD','LWORD'].includes(t))return t+'#16#'+(canonical?canonical(t,value):String(value));
 if(t==='TIME')return 'NanoSecToTime(LINT#'+(canonical?canonical(t,value):String(value))+')';
 if(t==='DATE'){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))throw Error('DATE: formato YYYY-MM-DD');return 'D#'+value}
 if(t==='TIME_OF_DAY'){if(!/^\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/.test(String(value)))throw Error('TOD: formato HH:mm:ss');return 'TOD#'+value}
 if(t==='DATE_AND_TIME'){if(!/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/.test(String(value)))throw Error('DT: formato YYYY-MM-DD-HH:mm:ss');return 'DT#'+value}
 if(C.NUMERIC_TYPES.has(t))return t+'#'+(canonical?canonical(t,value):String(Math.trunc(Number(value))));
 throw Error('Tipo no soportado en constante ST: '+t);
}
function alarmExpr(v,a){const op={eq:'=',ne:'<>',gt:'>',ge:'>=',lt:'<',le:'<='}[a.operator]||'=';const lhs=v.enumType?'EnumToNum('+v.name+')':v.type==='TIME'?'TimeToNanoSec('+v.name+')':v.name;const rhs=v.type==='TIME'?'LINT#'+(C.sysmacTypes?C.sysmacTypes.canonicalWrite('TIME',a.value):String(a.value)):stTyped(v,a.value);return '('+lhs+' '+op+' '+rhs+')';}
function buildST(input){
 const p=C.normalize(input),html=C.buildRuntimeHTML(p),parts=chunks(html),exposed=p.variables.filter(v=>v.expose&&v.live),rw=exposed.filter(v=>v.access==='RW'&&v.writeSupported),vm=new Map(p.variables.map(v=>[v.name,v]));
 const read=[],readByName=new Map();for(const v of exposed){if(v.type==='BOOL'){read.push(`IF ${v.name} THEN\n    Web_ApiBody := CONCAT(Web_ApiBody, '${v.id}=1$n');\nELSE\n    Web_ApiBody := CONCAT(Web_ApiBody, '${v.id}=0$n');\nEND_IF;`);}else{read.push(`Web_ApiBody := CONCAT(Web_ApiBody, '${v.id}=', ${toStringExpr(v)}, '$n');`);}readByName.set(v.name,read[read.length-1]);}
 for(const [i,a] of p.alarms.entries()){const v=vm.get(a.binding);if(!v)continue;read.push(`IF ${alarmExpr(v,a)} THEN\n    Web_ApiBody := CONCAT(Web_ApiBody, 'A${i+1}=1$n');\nELSE\n    Web_ApiBody := CONCAT(Web_ApiBody, 'A${i+1}=0$n');\nEND_IF;\nIF Web_AlarmAck[${i+1}] THEN\n    Web_ApiBody := CONCAT(Web_ApiBody, 'K${i+1}=1$n');\nELSE\n    Web_ApiBody := CONCAT(Web_ApiBody, 'K${i+1}=0$n');\nEND_IF;`);}
 // Alarms are global: always append every PLC alarm and ACK, whatever the screen.
 const alarmRead=read.slice(exposed.length);
 const screenReadCases=p.screens.map((screen,i)=>`${i}:
        Web_Found := TRUE;
        ${[...C.screenReadNames(p,screen).map(name=>readByName.get(name)),...alarmRead].join('\n        ')}`).join('\n        ');
 const writes=rw.map(v=>{
 if(v.type==='BOOL')return `${v.id}:\n                ${v.name} := (Web_ValueText = '1') OR (Web_ValueText = 'TRUE') OR (Web_ValueText = 'true');\n                Web_Found := TRUE;`;
 const statement=v.enumType?'NumToEnum(STRING_TO_DINT(Web_ValueText), '+v.name+')':v.name+' := '+fromStringExpr(v);
 return `${v.id}:\n                ${statement};\n                Web_Found := TRUE;`;
 }).join('\n            ');
 const alarmReset=p.alarms.map((a,i)=>{const v=vm.get(a.binding);return v?`IF NOT ${alarmExpr(v,a)} THEN Web_AlarmAck[${i+1}] := FALSE; END_IF;`:''}).filter(Boolean).join('\n');
 const alarmAckCases=p.alarms.map((a,i)=>{const v=vm.get(a.binding);return v?`${i+1}:\n IF ${alarmExpr(v,a)} THEN Web_AlarmAck[${i+1}] := TRUE; END_IF;\n Web_Found := TRUE;`:''}).filter(Boolean).join('\n');
 const alarmAckAll=p.alarms.map((a,i)=>{const v=vm.get(a.binding);return v?`IF ${alarmExpr(v,a)} THEN Web_AlarmAck[${i+1}] := TRUE; END_IF;`:''}).filter(Boolean).join('\n');
 const recipeCases=(p.recipeEnabled?p.recipes:[]).map((r,i)=>{const assigns=[];for(const [name,value] of Object.entries(r.values||{})){const v=vm.get(name);if(v&&v.access==='RW'&&v.writeSupported)assigns.push(v.enumType?`NumToEnum(${stTyped(v,value)}, ${v.name});`:`${v.name} := ${stTyped(v,value)};`);}return `${i+1}:\n                ${assigns.join('\n                ')||';'}\n                Web_Found := TRUE;`;}).join('\n            ');
 const recipeInit=(p.recipeEnabled?p.recipes:[]).map((r,i)=>{
  const blob=C.recipeWireJSON(r);
  if(enc.encode(blob).length>p.recipeBytes)throw Error('Receta '+r.name+': exceso de capacidad NX');
  return "Web_RecipeData["+(i+1)+"] := '"+stLiteral(blob)+"'; Web_RecipeRev["+(i+1)+"] := UDINT#1;";
 }).join('\n    ');
 const chunkCases=parts.map((c,i)=>`${i}: Web_TxText := '${stLiteral(c)}';`).join('\n            ');
 let program=`(* HMI NX ST · servidor WebHMI generado
   Proyecto: ${p.name}
   Puerto: ${p.port}
   HTML embebido: ${enc.encode(html).length} bytes / ${parts.length} fragmentos
   Funciones: RW, pantallas, imágenes, widgets industriales, alarmas actuales${p.recipeEnabled?' y recetas':''}.
   Seguridad funcional e interlocks permanecen en el programa de máquina.
*)

${alarmReset}
(* Banco de recetas retenido. Validar los atributos Retain de las variables en Sysmac. *)
IF NOT Web_RecipeInit THEN
    ${recipeInit}
    Web_RecipeInit := TRUE;
END_IF;
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
        ELSIF (FIND(Web_RxText, 'GET /api/read ') = 1) OR (FIND(Web_RxText, 'GET /api/read?screen=') = 1) THEN
            Web_Request := UINT#2;
        ELSIF FIND(Web_RxText, 'POST /api/write?') = 1 THEN
            Web_Request := UINT#3;
        ELSIF FIND(Web_RxText, 'POST /api/recipe?slot=') = 1 THEN
            Web_Request := UINT#8;
        ELSIF FIND(Web_RxText, 'GET /api/recipe?slot=') = 1 THEN
            Web_Request := UINT#7;
        ELSIF FIND(Web_RxText, 'GET /api/recipes ') = 1 THEN
            Web_Request := UINT#6;
        ELSIF FIND(Web_RxText, 'POST /api/recipe?') = 1 THEN
            Web_Request := UINT#4;
         ELSIF FIND(Web_RxText, 'POST /api/ack?') = 1 THEN
             Web_Request := UINT#5;
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
        IF FIND(Web_RxText, 'GET /api/read?screen=') = 1 THEN
            Web_PosId := FIND(Web_RxText, '?screen=');
            Web_PosEnd := FIND(Web_RxText, ' HTTP/');
            IF (Web_PosId > 0) AND (Web_PosEnd > Web_PosId + UINT#8) THEN
                Web_IdText := MID(In:=Web_RxText, L:=Web_PosEnd-(Web_PosId+UINT#8), P:=Web_PosId+UINT#8);
                Web_WriteId := STRING_TO_UINT(Web_IdText);
                CASE Web_WriteId OF
                ${screenReadCases}
                ELSE
                    Web_ApiBody := CONCAT(Web_ApiBody, 'BAD SCREEN$n');
                END_CASE;
            ELSE
                Web_ApiBody := CONCAT(Web_ApiBody, 'BAD SCREEN$n');
            END_IF;
        ELSE
            (* Legacy/full snapshot: also needed while editing or applying recipes. *)
            ${read.join('\n            ')}
        END_IF;
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


    5:
        Web_PosId := FIND(Web_RxText, '?id=');
        Web_PosEnd := FIND(Web_RxText, ' HTTP/');
        Web_Found := FALSE;
        IF (Web_PosId > 0) AND (Web_PosEnd > Web_PosId) THEN
            Web_IdText := MID(In:=Web_RxText, L:=Web_PosEnd-(Web_PosId+UINT#4), P:=Web_PosId+UINT#4);
            Web_WriteId := STRING_TO_UINT(Web_IdText);
            IF Web_WriteId = UINT#0 THEN
                ${alarmAckAll}
                Web_Found := TRUE;
            ELSE
                CASE Web_WriteId OF
                ${alarmAckCases||'0: ;'}
                ELSE
                    ;
                END_CASE;
            END_IF;
        END_IF;
        IF Web_Found THEN
            Web_ApiBody := 'OK';
            Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: text/plain$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';
        ELSE
            Web_ApiBody := 'BAD ACK';
            Web_TxText := 'HTTP/1.0 400 Bad Request$r$nContent-Type: text/plain$r$nConnection: close$r$n$r$n';
        END_IF;


    6: (* Consulta ligera: version de las 12 ranuras sin cargar sus valores. *)
        Web_ApiBody := 'RCPV=1$n';
        FOR Web_RecipeIdx := UINT#1 TO UINT#12 DO
            Web_ApiBody := CONCAT(Web_ApiBody, UINT_TO_STRING(Web_RecipeIdx), '=', UDINT_TO_STRING(Web_RecipeRev[Web_RecipeIdx]), '$n');
        END_FOR;
        Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: text/plain; charset=utf-8$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';

    7: (* Obtener blob ASCII de una ranura, maximo 500 bytes. *)
        Web_PosSlot := FIND(Web_RxText, '?slot=');
        Web_PosEnd := FIND(Web_RxText, ' HTTP/');
        Web_Found := FALSE;
        IF (Web_PosSlot > 0) AND (Web_PosEnd > Web_PosSlot + UINT#6) THEN
            Web_SlotText := MID(In:=Web_RxText, L:=Web_PosEnd-(Web_PosSlot+UINT#6), P:=Web_PosSlot+UINT#6);
            Web_RecipeSlot := STRING_TO_UINT(Web_SlotText);
            IF (Web_RecipeSlot >= UINT#1) AND (Web_RecipeSlot <= UINT#12) THEN
                Web_ApiBody := Web_RecipeData[Web_RecipeSlot];
                Web_Found := TRUE;
            END_IF;
        END_IF;
        IF Web_Found THEN
            Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: application/json; charset=utf-8$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';
        ELSE
            Web_ApiBody := 'BAD SLOT';
            Web_TxText := 'HTTP/1.0 400 Bad Request$r$nContent-Type: text/plain$r$nConnection: close$r$n$r$n';
        END_IF;

    8: (* Escritura de receta atomica por ranura con revision CAS. No se interpreta el JSON en ST. *)
        Web_PosSlot := FIND(Web_RxText, '?slot=');
        Web_PosRev := FIND(Web_RxText, '&rev=');
        Web_PosEnd := FIND(Web_RxText, ' HTTP/');
        Web_PosBody := FIND(Web_RxText, '$r$n$r$n');
        Web_Found := FALSE;
        IF (Web_PosSlot > 0) AND (Web_PosRev > Web_PosSlot) AND (Web_PosEnd > Web_PosRev) AND (Web_PosBody > 0) THEN
            Web_SlotText := MID(In:=Web_RxText, L:=Web_PosRev-(Web_PosSlot+UINT#6), P:=Web_PosSlot+UINT#6);
            Web_RevText := MID(In:=Web_RxText, L:=Web_PosEnd-(Web_PosRev+UINT#5), P:=Web_PosRev+UINT#5);
            Web_RecipeSlot := STRING_TO_UINT(Web_SlotText);
            Web_RecipeExpected := STRING_TO_UDINT(Web_RevText);
            Web_BodyLen := LEN(Web_RxText)-(Web_PosBody+UINT#3);
            IF (Web_RecipeSlot >= UINT#1) AND (Web_RecipeSlot <= UINT#12) AND (Web_BodyLen <= UINT#500) THEN
                Web_Found := TRUE;
                IF Web_RecipeRev[Web_RecipeSlot] = Web_RecipeExpected THEN
                    IF Web_BodyLen = UINT#0 THEN
                        Web_ValueText := '';
                    ELSE
                        Web_ValueText := MID(In:=Web_RxText, L:=Web_BodyLen, P:=Web_PosBody+UINT#4);
                    END_IF;
                    Web_RecipeData[Web_RecipeSlot] := Web_ValueText;
                    Web_RecipeRev[Web_RecipeSlot] := Web_RecipeRev[Web_RecipeSlot] + UDINT#1;
                    IF Web_RecipeRev[Web_RecipeSlot] = UDINT#0 THEN Web_RecipeRev[Web_RecipeSlot] := UDINT#1; END_IF;
                    Web_ApiBody := CONCAT('REV=', UDINT_TO_STRING(Web_RecipeRev[Web_RecipeSlot]));
                    Web_TxText := 'HTTP/1.0 200 OK$r$nContent-Type: text/plain$r$nCache-Control: no-store$r$nConnection: close$r$n$r$n';
                ELSE
                    Web_ApiBody := CONCAT('CONFLICT REV=', UDINT_TO_STRING(Web_RecipeRev[Web_RecipeSlot]));
                    Web_TxText := 'HTTP/1.0 409 Conflict$r$nContent-Type: text/plain$r$nConnection: close$r$n$r$n';
                END_IF;
            END_IF;
        END_IF;
        IF NOT Web_Found THEN
            Web_ApiBody := 'BAD RECIPE DATA';
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
 // The server must never reference a non-existent recipe variable when disabled.
 if(!p.recipeEnabled){
  program=program.replace(/\n\(\* Banco de recetas retenido\.[\s\S]*?\nEND_IF;\n/,'\n');
  program=program.replace(/\n        ELSIF FIND\(Web_RxText, 'POST \/api\/recipe\?slot='\)[\s\S]*?(?=\n         ELSIF FIND\(Web_RxText, 'POST \/api\/ack\?')/,'');
  program=program.replace(/\n    4:[\s\S]*?(?=\n    5:)/,'');
  program=program.replace(/\n    6:[\s\S]*?(?=\n    ELSE\n        Web_ApiBody := 'NOT FOUND';)/,'');
  if(/Web_Recipe|Web_RecipeSlot|\/api\/recipes|\/api\/recipe/.test(program))throw Error('ST contiene referencias a recetas deshabilitadas');
 }else{
  program=program.replace('FOR Web_RecipeIdx := UINT#1 TO UINT#12 DO','FOR Web_RecipeIdx := UINT#1 TO UINT#'+p.recipeSlots+' DO');
  program=program.replace(/Web_RecipeSlot <= UINT#12/g,'Web_RecipeSlot <= UINT#'+p.recipeSlots);
  program=program.replace('Web_BodyLen <= UINT#500','Web_BodyLen <= UINT#'+p.recipeBytes);
  program=program.replace('de las 12 ranuras','de las '+p.recipeSlots+' ranuras').replace('maximo 500 bytes','maximo '+p.recipeBytes+' bytes');
 }
 return program;
}
function referencedVariables(p){const n=C.normalize(p),set=new Set(n.variables.filter(v=>v.expose&&v.live).map(v=>v.name));if(n.screenBinding)set.add(n.screenBinding);for(const s of n.screens)for(const o of C.screenObjects(n,s)){if(o.binding)set.add(o.binding);if(o.feedbackBinding)set.add(o.feedbackBinding);}for(const a of n.alarms)if(a.binding)set.add(a.binding);for(const r of n.recipes)for(const k of Object.keys(r.values||{}))set.add(k);return n.variables.filter(v=>set.has(v.name));}
function externalVariablesTSV(p){
 const roots=new Map();
 for(const v of referencedVariables(p)){
  const name=v.plcRoot||v.name,type=v.plcRootType||v.type;
  if(roots.has(name)&&roots.get(name)!==type)throw Error('Tipo externo conflictivo: '+name);
  roots.set(name,type);
 }
 return [...roots].map(([name,type])=>name+'\t'+type).join('\r\n');
}
function localVariablesTSV(input){const p=C.normalize(input);const rows=[
['Web_State','UINT','0','','','','Estado servidor HTTP'],
['Web_PrevState','UINT','0','','','','Estado anterior watchdog'],
['Web_StateTicks','UDINT','0','','','','Ciclos en estado actual'],
['Web_WatchdogLimit','UDINT','5000','','','','Límite ciclos watchdog'],
['Web_Seq','UDINT','0','','','','Secuencia snapshot API'],
 ['Web_AlarmAck',`ARRAY[1..${Math.max(1,p.alarms.length)}] OF BOOL`,'','','','','Alarmas reconocidas; rearme al desactivarse'],
['Web_Request','UINT','0','','','','Ruta solicitada'],
['Web_Chunk','UINT','0','','','','Fragmento HTML'],
['Web_WriteId','UINT','0','','','','ID escritura/receta'],
['Web_PosId','UINT','0','','','','Posición id'],
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
['Web_RecipeInit','BOOL','FALSE','','True','','Banco de recetas inicializado - Retain'],
 ['Web_RecipeData','ARRAY[1..12] OF STRING[512]','','','True','','Contenido ASCII del banco de recetas - Retain'],
 ['Web_RecipeRev','ARRAY[1..12] OF UDINT','','','True','','Version de recetas - Retain'],
 ['Web_RecipeSlot','UINT','0','','','','Ranura receta'],
 ['Web_RecipeIdx','UINT','0','','','','Indice de resumen'],
 ['Web_RecipeExpected','UDINT','0','','','','Version cliente CAS'],
 ['Web_PosSlot','UINT','0','','','','Posicion slot'],
 ['Web_PosRev','UINT','0','','','','Posicion rev'],
 ['Web_BodyLen','UINT','0','','','','Longitud cuerpo receta'],
 ['Web_SlotText','STRING[8]','','','','','Ranura'],
 ['Web_RevText','STRING[16]','','','','','Version cliente'],
['Web_Socket','_sSOCKET','','','','','Socket aceptado'],
['Web_Accept','SktTCPAccept','','','','','Accept TCP'],
['Web_Rcv','SktTCPRcv','','','','','Receive TCP'],
['Web_Send','SktTCPSend','','','','','Send TCP'],
['Web_Close','SktClose','','','','','Close TCP']
];
 const selected=rows.filter(r=>p.recipeEnabled||!String(r[0]).startsWith('Web_Recipe')&&!['Web_PosSlot','Web_PosRev','Web_BodyLen','Web_SlotText','Web_RevText'].includes(r[0]));
 return selected.map(r=>{
  if(r[0]==='Web_RecipeData')r[1]='ARRAY[1..'+p.recipeSlots+'] OF STRING['+(p.recipeBytes+12)+']';
  if(r[0]==='Web_RecipeRev')r[1]='ARRAY[1..'+p.recipeSlots+'] OF UDINT';
  return r.join('\t');
 }).join('\r\n');}
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
${p.recipeEnabled?'- Recetas habilitadas: importar Web_RecipeInit, Web_RecipeData y Web_RecipeRev con Retain activado.\n- Banco NX: '+p.recipeSlots+' recetas de hasta '+p.recipeBytes+' bytes JSON; STRING['+(p.recipeBytes+12)+'].\n- Las recetas iniciales se cargan una sola vez, cuando Web_RecipeInit está a FALSE. No borrar Retain sin exportar primero las recetas.':'- Recetas deshabilitadas: no importar ni crear variables Web_Recipe*. No se reserva memoria Retain para recetas.'}
- Las variables referenciadas deben existir como Global Variables con el mismo nombre/tipo.
- Si importaste una estructura, union, enumeracion o ARRAY, crea su tipo en Data Types de Sysmac y declara la raiz global. El TSV Externals contiene SOLO esa raiz, no miembros sueltos.
- Asignar el Program a una tarea y transferir al NX.
- Abrir http://IP_DEL_NX:${p.port}/

FUNCIONES
- Comunicación robusta: snapshots SEQ/END, actualización atómica y watchdog de estados.
- Lectura de los 20 tipos basicos NX, y de miembros de ARRAY/STRUCT/UNION/ENUM mediante variables raiz.
- Escritura directa BOOL, numeros, bitstrings hexadecimales, TIME como nanosegundos, STRING y enumeraciones (NumToEnum).
- DATE, TIME_OF_DAY y DATE_AND_TIME: lectura formateada y escritura con resolucion de 1 segundo usando SecToDate/SecToTod/SecToDt.
- Importante: la escritura DATE/DT/TOD trunca/substituye fracciones de segundo; DATE/DT admiten desde 1970 y se interpretan sin zona horaria.
- Botones SET/RESET/TOGGLE.
- Varias pantallas con número único, color de fondo y selección opcional por variable entera leída del PLC.
- Si se configura control PLC, el valor de esa variable gobierna siempre la pantalla; si no coincide con ningún número (o es inválido), se muestra la principal. Sin comunicación válida, se mantiene la última pantalla y se indica pérdida de comunicación.
- Imágenes embebidas como data URL, estáticas o con cambio OFF/ON gobernado por BOOL.
- Estado BOOL con símbolos SVG integrados OFF/ON: lámpara, motor, bomba, válvula, cinta y sensor; mapeo TRUE/FALSE invertible.
- Alarmas evaluadas en ST con ACK individual/total en /api/ack y estados K en /api/read.
- Recetas compiladas en ST y aplicadas en una sola ejecución del CASE de receta.

LÍMITES ACTUALES
- 1 cliente simultáneo.
- HTTP/1.0 con Connection: close.
- Petición <=1900 bytes en una recepción.
- Web_WatchdogLimit es un límite en ciclos de tarea (5000 por defecto), no tiempo absoluto.
- Alarmas: ACK en memoria PLC mientras sigan activas; no retentivas tras reinicio ni historial.
- Recetas: ${p.recipeEnabled?'banco NX Retain de '+p.recipeSlots+' ranuras y '+p.recipeBytes+' bytes por receta; CRUD desde runtime':'deshabilitadas; sin banco NX ni gestor de recetas en runtime'}.
- El botón Aplicar envía escrituras PLC secuenciales; NO es una operación atómica ni sustituye enclavamientos de máquina. Comprobar lectura posterior.
- Las recetas habilitadas usan /api/recipes, /api/recipe y /api/write; no existe almacenamiento local de recetas.
- Sin HTTPS ni gestión de usuarios todavía.
- No usar la HMI para funciones de seguridad.
`;}
Object.assign(C,{buildST,localVariablesTSV,externalVariablesTSV,readme});
})(globalThis);

(function(root){'use strict';const C=root.NXST,enc=new TextEncoder();
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function zip(files){const parts=[],central=[];let offset=0;const u16=(v,p,n)=>v.setUint16(p,n,true),u32=(v,p,n)=>v.setUint32(p,n>>>0,true);for(const [name,val] of Object.entries(files)){const nb=enc.encode(name),b=val instanceof Uint8Array?val:enc.encode(val),crc=crc32(b),h=new Uint8Array(30+nb.length),dv=new DataView(h.buffer);u32(dv,0,0x04034b50);u16(dv,4,20);u16(dv,6,0x800);u32(dv,14,crc);u32(dv,18,b.length);u32(dv,22,b.length);u16(dv,26,nb.length);h.set(nb,30);parts.push(h,b);const ch=new Uint8Array(46+nb.length),cv=new DataView(ch.buffer);u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x800);u32(cv,16,crc);u32(cv,20,b.length);u32(cv,24,b.length);u16(cv,28,nb.length);u32(cv,42,offset);ch.set(nb,46);central.push(ch);offset+=h.length+b.length;}const end=new Uint8Array(22),ev=new DataView(end.buffer),cs=central.reduce((a,b)=>a+b.length,0);u32(ev,0,0x06054b50);u16(ev,8,central.length);u16(ev,10,central.length);u32(ev,12,cs);u32(ev,16,offset);const all=[...parts,...central,end],out=new Uint8Array(all.reduce((a,b)=>a+b.length,0));let at=0;for(const b of all){out.set(b,at);at+=b.length;}return out;}
function exportPackage(p){const errors=C.validate(p);if(errors.length)throw new Error(errors.join('\n'));const html=C.buildRuntimeHTML(p);if(enc.encode(html).length>C.HTML_MAX_BYTES)throw new Error('HTML embebido supera el límite estricto de 512 KB. Reduzca imágenes, pantallas u objetos.');const st=C.buildST(p),files={'WebHMI_Server.st':st,'WebHMI_LocalVariables.tsv':C.localVariablesTSV(p),'WebHMI_ExternalVariables.tsv':C.externalVariablesTSV(p),'HMI_Embedded.html':html,'project.nxst':JSON.stringify(p,null,2)};files['README.txt']=C.readme(p,html,st);return{files,zip:zip(files),html,st};}

Object.assign(C,{zip,exportPackage});
})(globalThis);

(function(root){'use strict';
const C=root.NXST,enc=new TextEncoder();
const LITE_HTML_LIMIT=128*1024;
function htmlText(value){return C.esc(String(value==null?'':value)).replace(/[^\x00-\x7f]/g,c=>'&#'+c.codePointAt(0)+';');}
function jsJSON(value){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/[^\x00-\x7f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));}
function number(value,fallback){const n=Number(value);return Number.isFinite(n)?String(n):String(fallback);}
function liteProjection(input){
 const original=C.normalize(input),report=C.liteAnalysis(original);
 if(report.issues.length)throw Error('Extra Light no compatible:\n'+report.issues.join('\n'));
 const screen=original.screens[0],objects=C.screenObjects(original,screen).map(o=>C.copy(o));
 const used=new Set(objects.filter(o=>o.kind!=='text').map(o=>o.binding));
 const p=C.copy(original);
 p.variables=original.variables.filter(v=>used.has(v.name)).map(v=>C.copy(v));
 p.screens=[{...C.copy(screen),objects,useBase:false}];
 p.baseScreen=null;p.assets=[];p.alarms=[];p.recipes=[];p.recipeEnabled=false;p.recipeVariables=[];p.internalVariables=[];p.screenBinding='';
 if(p.variables.some(v=>!Number.isInteger(Number(v.id))||Number(v.id)<1||Number(v.id)>65535))throw Error('Extra Light requiere IDs de variables entre 1 y 65535.');
 if(new Set(p.variables.map(v=>Number(v.id))).size!==p.variables.length)throw Error('Hay IDs de variables PLC duplicados.');
 const errors=C.validate(p);
 if(errors.length)throw Error('Error en proyecto Extra Light: '+errors.join('; '));
 return p;
}
function widgetHTML(o,vars){
 const id=o.binding?Number(vars.get(o.binding).id):0,title=String(o.text||'').trim();
 const sz='left:'+number(o.x,0)+'px;top:'+number(o.y,0)+'px;width:'+number(o.w,150)+'px;height:'+number(o.h,55)+'px';
 const font=Number.isInteger(o.fontSize)&&o.fontSize>=8&&o.fontSize<=120?'font-size:'+o.fontSize+'px;':'';
 const heading=o.kind!=='text'&&title?'<div class="cap">'+htmlText(o.text)+'</div>':'';
 const divStart='<div class="w '+o.kind+'" style="'+sz+';'+font+'">';
 const divEnd='</div>';
 if(o.kind==='text')return divStart+'<div class="text-content">'+htmlText(o.text)+'</div>'+divEnd;
 if(o.kind==='status')return divStart+heading+'<div class="body"><div class="lamp" data-lamp="'+id+'" data-invert="'+(o.stateOnWhen==='false'?'1':'0')+'" style="--lamp:'+htmlText(o.lampOnColor)+'"></div></div>'+divEnd;
 if(o.kind==='button')return divStart+'<button type="button" data-set="'+id+'" data-mode="'+htmlText(o.actionMode)+'" data-confirm="'+htmlText(o.confirmationText||'')+'">'+htmlText(o.text)+'</button>'+divEnd;
 if(o.kind==='bar')return divStart+heading+'<div class="body"><div class="track"><div class="fill" data-bar="'+id+'" data-min="'+number(o.min,0)+'" data-max="'+number(o.max,100)+'" style="background:'+htmlText(o.fillColor)+'"></div></div></div>'+divEnd;
 if(o.kind==='input')return divStart+heading+'<div class="body input-row"><input type="text" inputmode="decimal" autocomplete="off" data-entry="'+id+'" data-low="'+(o.inputMin===null?'':number(o.inputMin,0))+'" data-high="'+(o.inputMax===null?'':number(o.inputMax,0))+'" aria-label="'+htmlText(o.text||o.binding)+'"><button type="button" class="apply" data-apply="'+id+'" aria-label="Aplicar">OK</button></div>'+divEnd;
 return divStart+heading+'<div class="body read" data-value="'+id+'" data-dec="'+number(o.decimals,2)+'" data-unit="'+htmlText(o.unit||'')+'">--</div>'+divEnd;
}
const liteCSS='*{box-sizing:border-box}html,body{margin:0;height:100%;font-family:Arial,sans-serif;color:#172b4d}body{background:#e2e8f0;display:flex;flex-direction:column}header{background:#0f172a;color:#fff;min-height:45px;display:flex;align-items:center;justify-content:space-between;padding:8px 14px;gap:12px;font-weight:bold}#state{font-size:12px;font-weight:normal}#viewport{position:relative;flex:1;overflow:auto}#fit{position:relative;margin:0 auto}#stage{position:absolute;left:0;top:0;transform-origin:0 0}.w{position:absolute;overflow:hidden;display:flex;flex-direction:column;align-items:stretch}.cap{flex:0 0 auto;font-size:12px;line-height:16px;font-weight:bold;text-align:center;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;padding:2px}.body{min-height:0;flex:1;display:flex;align-items:center;justify-content:center}.text-content{height:100%;display:flex;align-items:center;white-space:pre-wrap;overflow-wrap:anywhere}.read{font-size:1.4em;font-weight:bold;text-align:center;background:#fff;border:1px solid #94a3b8;border-radius:5px}.lamp{width:min(56%,44px);aspect-ratio:1;border-radius:50%;background:#94a3b8;border:3px solid #475569}.lamp.on{background:var(--lamp,#86efac);border-color:#15803d}.w.button button{width:100%;height:100%;border:0;border-radius:6px;background:#2563eb;color:#fff;font-size:inherit;font-weight:bold;cursor:pointer}.w.button button:disabled,.apply:disabled{opacity:.5}.input-row{display:flex;gap:4px}.input-row input{width:75%;min-width:0;border:1px solid #94a3b8;border-radius:5px;background:#fff;padding:5px;font-size:1.1em}.apply{min-width:32px;flex:1;border:0;border-radius:5px;background:#2563eb;color:#fff}.track{height:80%;min-height:10px;width:100%;border-radius:4px;background:#cbd5e1;overflow:hidden}.fill{height:100%;width:0}#shield{position:fixed;inset:45px 0 0;background:#11182780;z-index:100;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold}#shield[hidden]{display:none}#keyboard{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:#111a;padding:8px}#keyboard[hidden]{display:none}.kbd{background:#fff;border-radius:10px;padding:12px;width:min(355px,96vw);display:grid;gap:7px}.kbd input{height:44px;font-size:24px;width:100%;padding:8px;border:1px solid #64748b}.keys{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.keys button,.kbd-actions button{min-height:46px;border-radius:6px;border:1px solid #94a3b8;background:#e2e8f0;font-size:18px;touch-action:manipulation}.kbd-actions{display:flex;gap:8px}.kbd-actions button{flex:1;font-size:15px}.kbd-actions button:last-child{background:#2563eb;color:white}#kbError{color:#b91c1c;font-size:12px;min-height:13px}';
function liteBrowser(){
 const tags=Object.create(null),values=Object.create(null),pending=Object.create(null);
 for(const v of L.v)tags[v[0]]={type:v[1],write:v[2]===1};
 const viewport=document.getElementById('viewport'),fit=document.getElementById('fit'),stage=document.getElementById('stage'),state=document.getElementById('state'),shield=document.getElementById('shield');
 let online=false,failures=0,loop=null,lastGood=0;
 const all=(q)=>Array.from(document.querySelectorAll(q));
 const show=(s)=>{state.textContent=s};
 const format=(id,dec)=>{const v=values[id];if(v===undefined)return '--';const t=tags[id];return t&&t.type==='REAL'?Number(v).toFixed(Math.max(0,Math.min(6,Number(dec)||0))):String(v)};
 function render(){
  for(const el of all('[data-value]'))el.textContent=format(el.dataset.value,el.dataset.dec)+(el.dataset.unit?' '+el.dataset.unit:'');
  for(const el of all('[data-lamp]'))el.classList.toggle('on',(values[el.dataset.lamp]==='1')!==(el.dataset.invert==='1'));
  for(const el of all('[data-bar]')){const lo=Number(el.dataset.min),hi=Number(el.dataset.max),v=Number(values[el.dataset.bar]);el.style.width=(values[el.dataset.bar]===undefined||!Number.isFinite(v)||hi<=lo?0:Math.max(0,Math.min(100,100*(v-lo)/(hi-lo))))+'%'}
  for(const el of all('[data-entry]'))if(document.activeElement!==el&&!pending[el.dataset.entry])el.value=values[el.dataset.entry]===undefined?'':format(el.dataset.entry,tags[el.dataset.entry]?.type==='REAL'?2:0);
  for(const el of all('[data-set],[data-apply],[data-entry]'))el.disabled=!online||Boolean(pending[el.dataset.set||el.dataset.apply||el.dataset.entry]);
  shield.hidden=online;
 }
 function resize(){
  const width=viewport.clientWidth,height=viewport.clientHeight,scale=Math.max(.1,Math.min(width/L.w,height/L.h,2));
  fit.style.width=(L.w*scale)+'px';fit.style.height=(L.h*scale)+'px';stage.style.width=L.w+'px';stage.style.height=L.h+'px';stage.style.transform='scale('+scale+')';
 }
 function parse(text){
  const lines=text.trim().split(/\r?\n/),head=/^SEQ=(\d+)$/.exec(lines[0]||''),tail=/^END=(\d+)$/.exec(lines[lines.length-1]||'');
  if(!head||!tail||head[1]!==tail[1])throw Error('invalid snapshot');
  const next=Object.create(null);
  for(let i=1;i<lines.length-1;i++){const m=/^(\d+)=(.*)$/.exec(lines[i]);if(!m||!tags[m[1]])throw Error('invalid tag');next[m[1]]=m[2]}
  if(Object.keys(next).length!==L.v.length)throw Error('incomplete snapshot');
  return next;
 }
 async function timed(url,options){
  const ac=new AbortController(),timeout=setTimeout(()=>ac.abort(),2500);
  try{return await fetch(url,{...(options||{}),signal:ac.signal,cache:'no-store'})}finally{clearTimeout(timeout)}
 }
 function schedule(delay){clearTimeout(loop);loop=setTimeout(poll,delay)}
 function failed(message){online=false;failures++;show(message||'Sin conexion');render()}
 function confirmed(id,expected,actual){if(tags[id]?.type==='BOOL')return expected===actual;return Number.isFinite(Number(expected))&&Number(expected)===Number(actual)}
 async function poll(){
  try{
   const r=await timed('/api/read');if(!r.ok)throw Error('HTTP '+r.status);
   const next=parse(await r.text());
   Object.assign(values,next);online=true;lastGood=Date.now();failures=0;
   for(const id of Object.keys(pending)){
    const entry=pending[id];
    if(confirmed(id,entry.raw,values[id]))delete pending[id];
    else if(Date.now()-entry.at>5000){delete pending[id];show('Escritura sin confirmar: verificar PLC')}
   }
   if(!state.textContent.startsWith('Escritura sin confirmar'))show('Conectado');
   render();
  }catch{failed('Sin conexion con PLC')}
  finally{schedule(online?Math.max(150,Number(L.poll)||500):Math.min(5000,500*Math.pow(2,Math.min(failures,3))))}
 }
 function validate(id,raw,element){
  const tag=tags[id];if(!tag||!tag.write)throw Error('Variable no escribible');
  const txt=String(raw).trim();
  if(tag.type==='BOOL'){if(txt!=='1'&&txt!=='0')throw Error('Solo 0 o 1');return txt}
  if(tag.type==='INT'){
   if(!/^-?\d{1,6}$/.test(txt))throw Error('Entero no valido');
   const n=Number(txt);if(!Number.isInteger(n)||n< -32768||n>32767)throw Error('INT fuera de rango');return String(n)
  }
  if(!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(txt))throw Error('Usar punto decimal');
  const n=Number(txt);if(!Number.isFinite(n)||Math.abs(n)>3.402823e38)throw Error('REAL fuera de rango');
  if(element){const lo=element.dataset.low,hi=element.dataset.high;if(lo!==''&&n<Number(lo)||hi!==''&&n>Number(hi))throw Error('Fuera de limites')}
  return String(n)
 }
 async function write(id,raw,element){
  if(!online||pending[id])return;
  let value;try{value=validate(id,raw,element)}catch(e){show(e.message);throw e}
  pending[id]={raw:value,at:Date.now()};render();
  try{
   const response=await timed('/api/write?id='+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':'text/plain'},body:value});
   const text=await response.text();if(!response.ok||text.trim()!=='OK')throw Error('Escritura rechazada');
   show('Verificando escritura');schedule(0);
  }catch(e){delete pending[id];show('Escritura no confirmada; comprobar PLC');render();throw e}
 }
 for(const el of all('[data-set]'))el.addEventListener('click',()=>{if(el.dataset.confirm&&!confirm(el.dataset.confirm))return;write(el.dataset.set,el.dataset.mode==='reset'?'0':'1').catch(()=>{})});
 for(const el of all('[data-apply]'))el.addEventListener('click',()=>{const input=document.querySelector('[data-entry="'+el.dataset.apply+'"]');write(el.dataset.apply,input.value,input).catch(()=>{})});
 for(const el of all('[data-entry]'))el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();write(el.dataset.entry,el.value,el).catch(()=>{})}});
 if(L.keyboard){
  const overlay=document.getElementById('keyboard'),field=document.getElementById('kbValue'),error=document.getElementById('kbError');
  let target=null,original='';
  const dismiss=()=>{overlay.hidden=true;target=null;error.textContent=''};
  for(const btn of all('#keyboard [data-key]'))btn.addEventListener('click',()=>{
   const key=btn.dataset.key;
   if(key==='back')field.value=field.value.slice(0,-1);
   else if(key==='clear')field.value='';
   else if(key==='sign')field.value=field.value.startsWith('-')?field.value.slice(1):'-'+field.value;
   else if(key==='dot'){if(!field.value.includes('.'))field.value+='.'}
   else field.value+=key;
   error.textContent='';
  });
  document.getElementById('kbCancel').onclick=dismiss;
  document.getElementById('kbAccept').onclick=()=>{
   if(!target)return;
   try{validate(target.dataset.entry,field.value,target);target.value=field.value;dismiss();write(target.dataset.entry,target.value,target).catch(()=>{})}catch(e){error.textContent=e.message}
  };
  for(const el of all('[data-entry]')){
   el.readOnly=true;el.inputMode='none';el.addEventListener('click',()=>{if(!online)return;target=el;original=el.value;field.value=original;error.textContent='';overlay.hidden=false;field.focus()});
  }
  window.addEventListener('keydown',e=>{if(overlay.hidden)return;if(e.key==='Escape'){e.preventDefault();dismiss()}else if(e.key==='Enter'){e.preventDefault();document.getElementById('kbAccept').click()}},true);
 }
 window.addEventListener('resize',resize);
 resize();
 if(L.preview){for(const v of L.v)values[v[0]]=v[1]==='BOOL'?'0':'55';online=true;show('VISTA PREVIA');render()}
 else {render();schedule(0)}
}
function buildLiteRuntimeHTML(input,options){
 const p=liteProjection(input),view=p.screens[0],vm=new Map(p.variables.map(v=>[v.name,v]));
 const widgets=view.objects.map(o=>widgetHTML(o,vm)).join('');
 const withKeyboard=p.keyboardMode==='webhmi'&&view.objects.some(o=>o.kind==='input');
 const keypad=withKeyboard?'<div id="keyboard" hidden role="dialog" aria-modal="true" aria-label="Teclado numerico"><div class="kbd"><input id="kbValue" inputmode="none" aria-label="Valor"><div class="keys">'+['7','8','9','4','5','6','1','2','3','sign','0','dot','back','clear'].map(key=>'<button type="button" data-key="'+key+'">'+({sign:'±',dot:'.',back:'Borrar',clear:'Limpiar'}[key]||key)+'</button>').join('')+'</div><div id="kbError" role="alert"></div><div class="kbd-actions"><button id="kbCancel" type="button">Cancelar</button><button id="kbAccept" type="button">Aceptar</button></div></div></div>':'';
 const config={w:p.width,h:p.height,poll:p.pollMs,preview:Boolean(options&&options.preview),keyboard:withKeyboard,v:p.variables.map(v=>[Number(v.id),v.type,v.access==='RW'?1:0])};
 const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+htmlText(p.name)+'</title><style>'+liteCSS+'</style></head><body><header><span>'+htmlText(p.name)+'</span><span id="state">Conectando</span></header><main id="viewport"><div id="fit"><div id="stage" style="background:'+htmlText(view.background)+'">'+widgets+'</div></div></main><div id="shield">Sin conexion con PLC</div>'+keypad+'<script>const L='+jsJSON(config)+';('+liteBrowser.toString()+')();</script></body></html>';
 // The Omron ST source embeds HTML in STRING chunks; keep it 7-bit ASCII.
 return html.replace(/[^\x00-\x7f]/g,c=>'&#'+c.codePointAt(0)+';');
}
function stEscape(s){return String(s).replace(/\$/g,()=> '$$').replace(/'/g,()=> "$'").replace(/\r/g,()=> '$r').replace(/\n/g,()=> '$n');}
function buildLiteST(input){
 const p=liteProjection(input),html=buildLiteRuntimeHTML(p),parts=[];
 for(let i=0;i<html.length;i+=1400)parts.push(html.slice(i,i+1400));
 let st=C.buildST(p);
 const head='    CASE Web_Chunk OF\n',tail="\n    ELSE\n        Web_TxText := '';\n    END_CASE;";
 const a=st.indexOf(head),b=st.indexOf(tail,a);
 if(a<0||b<a)throw Error('La estructura ST de fragmentos HTTP ha cambiado.');
 const cases=parts.map((chunk,i)=>'            '+i+": Web_TxText := '"+stEscape(chunk)+"';").join('\n');
 st=st.slice(0,a)+head+cases+st.slice(b);
 st=st.replace(/HTML embebido: \d+ bytes \/ \d+ fragmentos/,'HTML embebido: '+enc.encode(html).length+' bytes / '+parts.length+' fragmentos (Extra Light)');
 st=st.replace(/IF Web_Chunk >= UINT#\d+ THEN Web_State/,'IF Web_Chunk >= UINT#'+(parts.length-1)+' THEN Web_State');
 // Prune all non-Light PLC features. This also supports older protected
 // Supabase compiler versions that unconditionally emitted recipe branches.
 st=st.replace(/\n\(\* Banco de recetas retenido\.[\s\S]*?\nEND_IF;\n/,'\n');
 st=st.replace(/\n\s*ELSIF FIND\(Web_RxText, 'POST \/api\/recipe\?slot='\)[\s\S]*?(?=\n\s*ELSIF FIND\(Web_RxText, 'POST \/api\/ack\?')/,'');
 st=st.replace(/\n\s*ELSIF FIND\(Web_RxText, 'POST \/api\/ack\?'\) = 1 THEN\s+Web_Request := UINT#5;/,'');
 st=st.replace(/\n    4:[\s\S]*?(?=\n    ELSE\n        Web_ApiBody := 'NOT FOUND';)/,'');
 if(st.includes('Web_Recipe')||st.includes('Web_AlarmAck')||st.includes('/api/ack')||st.includes('/api/recipe'))throw Error('Rutas o variables no permitidas en ST Extra Light');
 return st;
}
function liteLocalVariablesTSV(input){
 return C.localVariablesTSV(liteProjection(input)).split(/\r?\n/).filter(line=>!/^Web_(Recipe\w*|AlarmAck|PosSlot|PosRev|BodyLen|SlotText|RevText)\t/.test(line)).join('\r\n');
}
function liteReadme(input,html,st){
 const p=liteProjection(input);
 return 'WebHMI Extra Light - paquete Sysmac\nProyecto: '+p.name+'\nPantalla: '+p.screens[0].name+'\nPuerto: '+p.port+'\nVariables usadas: '+p.variables.length+' (BOOL/INT/REAL)\nHTML: '+enc.encode(html).length+' bytes\nST fuente: '+enc.encode(st).length+' bytes\n\nINSTALACION\n- WebHMI_Server.st: Program ST asignado a una tarea.\n- WebHMI_LocalVariables.tsv: variables internas de Sysmac.\n- WebHMI_ExternalVariables.tsv: enlaces a variables globales existentes.\n- Transferir a PLC y abrir http://IP_DEL_NX:'+p.port+'/\n\nLIMITACIONES\n- Solo 1 pantalla y widgets texto, valor, lampara BOOL, pulsador SET/RESET, entrada numerica y barra.\n- HTTP sin cifrado, sin login: uso solo en red industrial aislada y controlada.\n- Un cliente a la vez, peticiones en una sola recepcion <=1900 bytes.\n- Sin recetas ni alarmas, sin memoria RETAIN reservada por WebHMI.\n- Lectura por SEQ/END, reconexion y confirmacion de escritura por lectura.\n- No reenvia escrituras inciertas automaticamente.\n- Los enclavamientos y funciones de seguridad deben residir en la logica del PLC.\n- Validar memoria, tiempos y comportamiento con NX real antes de produccion.\n';
}
function exportLitePackage(input){
 const p=liteProjection(input),html=buildLiteRuntimeHTML(p);
 if(enc.encode(html).length>LITE_HTML_LIMIT)throw Error('Extra Light supera 128 KB de HTML; reduce elementos o utiliza la version completa.');
 const st=buildLiteST(p),files={
 'WebHMI_Server.st':st,
 'WebHMI_LocalVariables.tsv':liteLocalVariablesTSV(p),
 'WebHMI_ExternalVariables.tsv':C.externalVariablesTSV(p),
 'HMI_Embedded.html':html,
 'project.nxst':JSON.stringify(p,null,2),
 'README.txt':liteReadme(p,html,st)
 };
 return {files,html,st,zip:C.zip(files)};
}
Object.assign(C,{LITE_HTML_LIMIT,liteProjection,buildLiteRuntimeHTML,buildLiteST,liteLocalVariablesTSV,exportLitePackage});
})(globalThis);
