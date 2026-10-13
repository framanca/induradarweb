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
 // No route or protocol handling for alarm acknowledgements in Extra Light.
 st=st.replace(/\n\s*ELSIF FIND\(Web_RxText, 'POST \/api\/ack\?'\) = 1 THEN\s+Web_Request := UINT#5;/,'');
 st=st.replace(/\n    5:[\s\S]*?(?=\n    ELSE\n        Web_ApiBody := 'NOT FOUND';)/,'');
 if(st.includes('Web_Recipe')||st.includes('Web_AlarmAck')||st.includes('/api/ack')||st.includes('/api/recipe'))throw Error('Rutas o variables no permitidas en ST Extra Light');
 return st;
}
function liteLocalVariablesTSV(input){
 return C.localVariablesTSV(liteProjection(input)).split(/\r?\n/).filter(line=>!line.startsWith('Web_AlarmAck\t')).join('\r\n');
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
").replace(/\r/g,()=> '$r').replace(/\n/g,()=> '$n');}
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
 // No route or protocol handling for alarm acknowledgements in Extra Light.
 st=st.replace(/\n\s*ELSIF FIND\(Web_RxText, 'POST \/api\/ack\?'\) = 1 THEN\s+Web_Request := UINT#5;/,'');
 st=st.replace(/\n    5:[\s\S]*?(?=\n    ELSE\n        Web_ApiBody := 'NOT FOUND';)/,'');
 if(st.includes('Web_Recipe')||st.includes('Web_AlarmAck')||st.includes('/api/ack')||st.includes('/api/recipe'))throw Error('Rutas o variables no permitidas en ST Extra Light');
 return st;
}
function liteLocalVariablesTSV(input){
 return C.localVariablesTSV(liteProjection(input)).split(/\r?\n/).filter(line=>!line.startsWith('Web_AlarmAck\t')).join('\r\n');
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
