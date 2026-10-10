(function(){
'use strict';const C=NXST,$=s=>document.querySelector(s);let p=C.demoProject(),selected=null,drag=null,screenId=p.screens[0].id,imageUploadTarget=null;
const NUM=v=>C.NUMERIC_TYPES.has(v.type),BOOL=v=>v.type==='BOOL';
function toast(t){const x=$('#toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),3200)}
function readAsDataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('No se pudo leer la imagen'));r.readAsDataURL(blob);})}
function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo comprimir la imagen')),type,quality));}
async function decodeLocalImage(file){const url=URL.createObjectURL(file),img=new Image();img.decoding='async';img.src=url;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Formato de imagen no compatible'));});return{img,url};}
async function optimizeImage(file,targetBytes){if(file.size<=targetBytes)return{data:await readAsDataURL(file),bytes:file.size,originalBytes:file.size,optimized:false,width:null,height:null,mime:file.type||'image'};const decoded=await decodeLocalImage(file);try{let sw=decoded.img.naturalWidth||decoded.img.width,sh=decoded.img.naturalHeight||decoded.img.height;if(!sw||!sh)throw new Error('No se pueden determinar las dimensiones de la imagen');const maxDim=C.IMAGE_OPTIMIZE_MAX_DIM||1024,scale=Math.min(1,maxDim/Math.max(sw,sh));let w=Math.max(1,Math.round(sw*scale)),h=Math.max(1,Math.round(sh*scale)),best=null;for(let pass=0;pass<9&&!best;pass++){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)throw new Error('Canvas no disponible');ctx.clearRect(0,0,w,h);ctx.drawImage(decoded.img,0,0,w,h);let low=0.28,high=0.86,fit=null;for(let i=0;i<8;i++){const q=(low+high)/2,blob=await canvasBlob(canvas,'image/webp',q);if(blob.size<=targetBytes){fit={blob,q,w,h};low=q}else high=q;}if(fit){best=fit;break}const nw=Math.max(96,Math.round(w*0.82)),nh=Math.max(96,Math.round(h*0.82));if(nw===w&&nh===h)break;w=nw;h=nh;}if(!best)throw new Error('No se puede reducir la imagen por debajo del límite sin hacerla demasiado pequeña');return{data:await readAsDataURL(best.blob),bytes:best.blob.size,originalBytes:file.size,optimized:true,width:best.w,height:best.h,mime:'image/webp'};}finally{URL.revokeObjectURL(decoded.url);}}

const P0_LATEST='hmi-nx-st:p0:latest:v1',P0_HISTORY='hmi-nx-st:p0:history:v1',P0_HISTORY_MAX=3,P0_AUTOSAVE_MS=1500,P0_HISTORY_MS=30000;
let p0LastSavedJSON='',p0CheckpointJSON='',p0LastHistoryJSON='',p0LastHistoryAt=0,p0Healthy=true,p0Started=false,p0Warned=false;
const editorHistory=NXEditorHistory.create(100);
let editFocus=null;
let widgetClipboard=null,widgetPasteCount=0;
function copyWidget(){const o=activeScreen().objects.find(x=>x.id===selected);if(!o)return false;widgetClipboard=C.copy(o);widgetPasteCount=0;toast('Elemento copiado');return true}
function pasteWidget(){if(!widgetClipboard)return false;editAction(()=>{widgetPasteCount++;const o=C.copy(widgetClipboard);o.id=C.id();const offset=20*widgetPasteCount;o.x=Math.max(0,Math.min(Math.max(0,p.width-o.w),Number(widgetClipboard.x)+offset));o.y=Math.max(0,Math.min(Math.max(0,p.height-o.h),Number(widgetClipboard.y)+offset));activeScreen().objects.push(o);selected=o.id;render();});toast('Elemento pegado');return true}
function hideWidgetMenu(){$('#widgetMenu').hidden=true}
function showWidgetMenu(e,id){e.preventDefault();selected=id;renderProps();document.querySelectorAll('.widget').forEach(z=>z.classList.toggle('selected',z.dataset.id===id));const m=$('#widgetMenu');m.hidden=false;m.style.left=Math.max(4,Math.min(e.clientX,window.innerWidth-185))+'px';m.style.top=Math.max(4,Math.min(e.clientY,window.innerHeight-90))+'px';m.querySelector('[data-widget-action="paste"]').disabled=!widgetClipboard;}
function editState(){return editorHistory.capture(p,screenId,selected)}
function editButtons(){$('#undoBtn').disabled=!editorHistory.canUndo;$('#redoBtn').disabled=!editorHistory.canRedo}
function editCommit(before){const changed=editorHistory.commit(before,p);editFocus=null;editButtons();if(changed)p0Snapshot('edicion',false);return changed}
function editAction(fn,source){const useFocus=editFocus&&(source?editFocus.element===source:editFocus.element===document.activeElement),before=useFocus?editFocus.state:editState();const result=fn();editCommit(before);return result}
function editRestore(snapshot,reason){p=C.normalize(JSON.parse(snapshot.project));screenId=(p.baseScreen&&p.baseScreen.id===snapshot.screenId)||p.screens.some(s=>s.id===snapshot.screenId)?snapshot.screenId:p.screens[0].id;selected=activeScreen().objects.some(o=>o.id===snapshot.selected)?snapshot.selected:null;editFocus=null;render();editButtons();p0Snapshot(reason,false);toast(reason==='deshacer'?'Acción deshecha':'Acción rehecha')}
function editUndo(){const previous=editorHistory.undo(editState());if(previous)editRestore(previous,'deshacer')}
function editRedo(){const next=editorHistory.redo(editState());if(next)editRestore(next,'rehacer')}
function editReset(){editorHistory.clear();editFocus=null;editButtons()}
function deleteSafely(name,details,fn){if(!confirm('¿Eliminar '+name+'?\n'+details+'\nPodrás recuperarlo con Deshacer.'))return false;if(!p0Snapshot('antes-eliminar-'+name,true)){toast('No se pudo guardar una copia previa. Guarda el proyecto antes de eliminar.');return false}editAction(fn);return true}
function p0Status(text,kind=''){const el=$('#saveStatus');if(!el)return;el.textContent=text;el.className='save-status '+kind;}
function p0FlushFocused(){const el=document.activeElement;if(!el||!el.dataset)return;try{if(el.dataset.p&&selected){const o=activeScreen().objects.find(x=>x.id===selected);if(o){let v=el.value;if(['x','y','w','h','min','max','decimals','step','target'].includes(el.dataset.p)){const n=Number(v);if(Number.isFinite(n))v=n;else return;}o[el.dataset.p]=v;}}else if(el.dataset.alarm!==undefined&&el.dataset.k){const a=p.alarms[Number(el.dataset.alarm)];if(a)a[el.dataset.k]=el.value;}else if(el.dataset.recipeName!==undefined){const r=p.recipes[Number(el.dataset.recipeName)];if(r)r.name=el.value;}else if(el.dataset.recipeValues!==undefined){const r=p.recipes[Number(el.dataset.recipeValues)];if(r){try{r.values=parseRecipeText(el.value)}catch{}}}}catch{}}
function p0JSON(){p0FlushFocused();syncProjectInputs();return JSON.stringify(C.normalize(p));}
function p0Read(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function p0History(){const h=p0Read(P0_HISTORY,[]);return Array.isArray(h)?h:[]}
function p0WriteHistory(snapshot){try{const sig=JSON.stringify(snapshot.project);if(sig===p0LastHistoryJSON&&p0History().some(x=>JSON.stringify(x.project)===sig))return true;const h=p0History().filter(x=>x&&x.savedAt!==snapshot.savedAt);h.unshift(snapshot);localStorage.setItem(P0_HISTORY,JSON.stringify(h.slice(0,P0_HISTORY_MAX)));p0LastHistoryJSON=sig;p0LastHistoryAt=snapshot.savedAt;return true}catch{return false}}
function p0Snapshot(reason='auto',forceHistory=false){let json;try{json=p0JSON()}catch(e){p0Healthy=false;p0Status('Autosave: proyecto no serializable','error');return false}if(reason==='auto'&&json===p0LastSavedJSON){p0UpdateStatus();return true}const snap={version:1,savedAt:Date.now(),reason,screenId,project:JSON.parse(json)};try{localStorage.setItem(P0_LATEST,JSON.stringify(snap));p0LastSavedJSON=json;p0Healthy=true;if(forceHistory||(snap.savedAt-p0LastHistoryAt>=P0_HISTORY_MS&&json!==p0LastHistoryJSON)){if(!p0WriteHistory(snap)&&forceHistory){p0Healthy=false;p0Status('No se pudo guardar copia previa','error');return false}}p0UpdateStatus(snap.savedAt);return true}catch(e){if(forceHistory){p0Healthy=false;p0Status('No se pudo guardar copia previa','error');return false}try{localStorage.removeItem(P0_HISTORY);p0LastHistoryJSON='';p0LastHistoryAt=0;localStorage.setItem(P0_LATEST,JSON.stringify(snap));p0LastSavedJSON=json;p0Healthy=true;p0UpdateStatus(snap.savedAt);return true}catch{p0Healthy=false;p0Status('AUTOSAVE FALLÓ','error');if(!p0Warned){p0Warned=true;toast('No se puede guardar copia automática. Guarda el proyecto manualmente.')}return false}}}
function p0Dirty(){try{return p0JSON()!==p0CheckpointJSON}catch{return true}}
function p0UpdateStatus(at){if(!p0Healthy){p0Status('AUTOSAVE FALLÓ','error');return}const dirty=p0Dirty(),stamp=new Date(at||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});p0Status((dirty?'Guardado local · sin descargar · ':'Guardado local · ')+stamp,dirty?'dirty':'ok')}
function p0Checkpoint(){p0CheckpointJSON=p0JSON();p0UpdateStatus()}
function p0AllSnapshots(){const latest=p0Read(P0_LATEST,null),items=[];if(latest&&latest.project)items.push(latest);for(const s of p0History())if(s&&s.project)items.push(s);const seen=new Set();return items.filter(s=>{const sig=String(s.savedAt)+'|'+JSON.stringify(s.project);if(seen.has(sig))return false;seen.add(sig);return true}).sort((a,b)=>b.savedAt-a.savedAt)}
function p0RenderRecovery(){const host=$('#recoveryList'),items=p0AllSnapshots();if(!items.length){host.innerHTML='<p class="hint" style="padding:12px 14px">No hay copias locales disponibles.</p>';return}host.innerHTML=items.map((s,i)=>{const d=new Date(s.savedAt),meta=d.toLocaleString()+' · '+(s.reason||'auto')+' · '+((JSON.stringify(s.project).length/1024).toFixed(1))+' KB';return '<div class="recovery-item"><div><strong>'+C.esc(s.project.name||'Proyecto sin nombre')+'</strong><div class="recovery-meta">'+C.esc(meta)+'</div></div><div class="recovery-actions"><button data-recover="'+i+'">Recuperar</button></div></div>'}).join('');host.querySelectorAll('[data-recover]').forEach(b=>b.onclick=()=>{const s=items[Number(b.dataset.recover)];if(!s)return;p0Snapshot('antes-recuperar',true);p=C.normalize(s.project);screenId=(p.baseScreen&&p.baseScreen.id===s.screenId)||p.screens.some(x=>x.id===s.screenId)?s.screenId:p.screens[0].id;selected=null;editReset();render();p0Checkpoint();p0Snapshot('recuperado',true);$('#recoveryDialog').close();toast('Copia recuperada')});}
function p0ProtectReplace(label,fn){if(!p0Snapshot('antes-'+label,true)){toast('No se puede respaldar el proyecto actual. Descárgalo antes de continuar.');return}if(!confirm('Esta acción sustituirá el proyecto actual por '+label+'. Se ha guardado una copia local. ¿Continuar?'))return;fn();editReset();p0Checkpoint();p0Snapshot(label,true)}
function p0Boot(){const latest=p0Read(P0_LATEST,null);if(latest&&latest.project){try{p=C.normalize(latest.project);screenId=(p.baseScreen&&p.baseScreen.id===latest.screenId)||p.screens.some(x=>x.id===latest.screenId)?latest.screenId:p.screens[0].id;selected=null;toast('Último proyecto local recuperado automáticamente')}catch(err){toast('No se pudo recuperar el último proyecto. Revisa las copias automáticas.')}}render();editReset();p0Checkpoint();p0Snapshot('inicio',false);p0Started=true;setInterval(()=>p0Snapshot('auto',false),P0_AUTOSAVE_MS);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')p0Snapshot('oculto',false)});window.addEventListener('pagehide',()=>p0Snapshot('pagehide',false));window.addEventListener('beforeunload',e=>{p0Snapshot('beforeunload',false);if(p0Dirty()){e.preventDefault();e.returnValue='';}});}

function activeScreen(){return (p.baseScreen&&p.baseScreen.id===screenId?p.baseScreen:null)||p.screens.find(s=>s.id===screenId)||p.screens[0]}
function isBaseScreen(){return Boolean(p.baseScreen&&screenId===p.baseScreen.id)}
function syncProjectInputs(){p.name=$('#projectName').value.trim()||'WebHMI ST';p.port=Number($('#port').value);p.pollMs=Number($('#pollMs').value);p.width=Number($('#screenW').value);p.height=Number($('#screenH').value);p.minDisplayWidth=Number($('#minDisplayWidth').value);p.maxDisplayWidth=Number($('#maxDisplayWidth').value);}
function render(){p=C.normalize(p);if(!p.screens.some(s=>s.id===screenId)&&!(p.baseScreen&&p.baseScreen.id===screenId))screenId=p.screens[0].id;$('#projectName').value=p.name;$('#port').value=p.port;$('#pollMs').value=p.pollMs;$('#screenW').value=p.width;$('#screenH').value=p.height;$('#minDisplayWidth').value=p.minDisplayWidth;$('#maxDisplayWidth').value=p.maxDisplayWidth;renderScreens();renderVars();renderInternalVars();renderCanvas();renderProps();renderAlarms();renderRecipes();renderDiag();editButtons();}
function renderScreens(){const sel=$('#screenSelect');sel.innerHTML=(p.baseScreen?`<option value="${C.esc(p.baseScreen.id)}" ${isBaseScreen()?'selected':''}>★ ${C.esc(p.baseScreen.name)} (base)</option>`:'')+p.screens.map(s=>`<option value="${C.esc(s.id)}" ${s.id===screenId?'selected':''}>${s.number} · ${C.esc(s.name)}${s.useBase?' ◈':''}</option>`).join('');$('#deleteScreen').disabled=!isBaseScreen()&&p.screens.length<=1;$('#copyScreen').disabled=isBaseScreen();}
function renderVars(){const screenVars=p.variables.filter(v=>v.live&&C.INTEGER_TYPES.has(v.type));$('#screenBinding').innerHTML='<option value="">— Navegación manual —</option>'+screenVars.map(v=>`<option value="${C.esc(v.name)}" ${p.screenBinding===v.name?'selected':''}>${C.esc(v.name)} · ${v.type}</option>`).join('');const live=p.variables.filter(v=>v.expose&&v.live).length;$('#varSummary').textContent=`${p.variables.length} importadas · ${live} expuestas`;$('#varList').innerHTML=p.variables.map((v,i)=>`<div class="var-row ${v.live?'':'bad'}"><input type="checkbox" data-exp="${i}" ${v.expose?'checked':''} ${v.live?'':'disabled'}><code title="${C.esc(v.comment)}">${C.esc(v.name)}</code><span>${C.esc(v.type)}</span><select data-acc="${i}" ${v.writeSupported?'':'disabled'}><option value="R" ${v.access==='R'?'selected':''}>R</option><option value="RW" ${v.access==='RW'?'selected':''}>RW</option></select></div>`).join('')||'<p class="hint" style="padding:8px">Importa variables.</p>';document.querySelectorAll('[data-exp]').forEach(x=>x.onchange=()=>editAction(()=>{p.variables[+x.dataset.exp].expose=x.checked;renderDiag();},x));document.querySelectorAll('[data-acc]').forEach(x=>x.onchange=()=>editAction(()=>{p.variables[+x.dataset.acc].access=x.value;renderProps();renderRecipes();renderDiag();},x));}
function renderInternalVars(){const host=$('#internalVarList');if(!host)return;host.innerHTML=p.internalVariables.map((v,i)=>`<div class="internal-var-row"><input aria-label="Nombre" data-iv="${i}" data-key="name" value="${C.esc(v.name)}" placeholder="Nombre"><select aria-label="Tipo" data-iv="${i}" data-key="type">${['BOOL','INT','REAL','STRING'].map(t=>`<option value="${t}" ${v.type===t?'selected':''}>${t}</option>`).join('')}</select><input aria-label="Valor inicial" data-iv="${i}" data-key="value" value="${C.esc(v.value)}"><button data-del-iv="${i}" title="Eliminar variable interna">×</button></div>`).join('')||'<p class="hint">Sin variables internas.</p>';host.querySelectorAll('[data-iv]').forEach(el=>el.onchange=()=>editAction(()=>{p.internalVariables[+el.dataset.iv][el.dataset.key]=el.value;render();},el));host.querySelectorAll('[data-del-iv]').forEach(el=>el.onclick=()=>editAction(()=>{p.internalVariables.splice(+el.dataset.delIv,1);render();}));}
function previewShape(o){if(o.kind==='dynamicText')return '<div class="inner">'+C.esc(o.text||'Texto dinámico')+' ↔</div>';if(o.kind==='status')return '<div class="status-visual">'+C.statusSvg(o.symbolType,false)+'</div><div class="caption">'+C.esc(o.text||'Estado')+'</div>';if(o.kind==='tank')return '<div class="symbol"><div class="level"></div></div><div class="caption">'+C.esc(o.text||'Depósito')+'</div>';if(o.kind==='bar')return '<div class="track"><div class="fill"></div></div>';if(['slider','gauge','stepper','counter','switch','selector','multistate','dropdown'].includes(o.kind))return '<div class="inner" style="background:#eff6ff;border:1px solid #94a3b8;border-radius:5px;flex-direction:column;font-size:13px"><strong>'+C.esc(o.text)+'</strong><span>'+C.esc(({slider:'━━●━━  '+o.min+' / '+o.max,gauge:'◔  '+o.min+'–'+o.max,stepper:'−  50  +',counter:'000000',switch:'OFF / ON',selector:'◉ Modo',multistate:'● Estado',dropdown:'▾ Selección'})[o.kind])+'</span></div>';if(o.kind==='image'){const a=p.assets.find(a=>a.id===o.assetId);return a?'<img src="'+C.esc(a.data)+'" alt="" draggable="false">':'<div class="inner">Imagen</div>';}return '<div class="inner">'+C.esc(o.text||o.kind)+'</div>';}
function renderCanvas(){
 const screen=activeScreen(),base=isBaseScreen(),canvas=$('#canvas');
 canvas.className='canvas';
 canvas.style.width=p.width+'px';canvas.style.height=p.height+'px';
 canvas.style.backgroundColor=screen.background;
 const inherited=!base&&screen.useBase&&p.baseScreen?p.baseScreen.objects:[];
 $('#canvasInfo').textContent=(base?'BASE':('N.º '+screen.number))+' · '+p.width+'×'+p.height+' · '+screen.objects.length+' propios'+(inherited.length?' + '+inherited.length+' heredados':'');
 canvas.innerHTML='';
 const limit=(value,min,max)=>Math.max(min,Math.min(max,value));
 const directions=['nw','n','ne','e','se','s','sw','w'];
 for(const o of [...inherited,...screen.objects]){
  const inheritedWidget=inherited.includes(o),node=document.createElement('div');
  node.className='widget '+o.kind+(o.kind==='status'?' '+(o.symbolType||'lamp'):'')+(o.kind==='tank'?' industrial':'')+(inheritedWidget?' inherited':'')+(selected===o.id&&!inheritedWidget?' selected':'');
  node.dataset.id=o.id;
  Object.assign(node.style,{left:o.x+'px',top:o.y+'px',width:o.w+'px',height:o.h+'px'});
  node.innerHTML=previewShape(o);
  if(Number.isInteger(o.fontSize)&&o.fontSize>=8&&o.fontSize<=120){
   const px=o.fontSize+'px';
   node.style.fontSize=px;
   node.querySelectorAll('.inner,.caption,.reading,.label,.control-panel,.limits,input,select,button').forEach(el=>{el.style.fontSize=px});
  }
  if(o.kind==='button'&&o.feedbackBinding){
   const inner=node.querySelector('.inner');
   if(inner)inner.style.backgroundColor=o.feedbackColorOff||'#2563eb';
  }
  if(inheritedWidget){
   node.title='Elemento heredado · editable desde la pantalla base';
   node.setAttribute('aria-label','Elemento heredado: '+(o.text||o.kind));
  }else{
   for(const direction of directions){
    const handle=document.createElement('span');
    handle.className='resize-handle resize-'+direction;
    handle.dataset.resize=direction;
    handle.title='Redimensionar: '+direction.toUpperCase();
    handle.setAttribute('aria-label','Redimensionar '+direction.toUpperCase());
    node.append(handle);
   }
   node.oncontextmenu=e=>showWidgetMenu(e,o.id);
   node.onpointerdown=e=>{
    if(e.button!==0)return;
    e.preventDefault();
    hideWidgetMenu();
    const handle=e.target.closest('.resize-handle');
    const rect=canvas.getBoundingClientRect();
    selected=o.id;
    drag={id:o.id,pointerId:e.pointerId,mode:handle?.dataset.resize||'move',x:e.clientX,y:e.clientY,ox:o.x,oy:o.y,ow:o.w,oh:o.h,
     sx:p.width/Math.max(1,rect.width),sy:p.height/Math.max(1,rect.height),before:editState()};
    node.setPointerCapture(e.pointerId);
    renderProps();
    canvas.querySelectorAll('.widget').forEach(z=>z.classList.toggle('selected',z.dataset.id===o.id));
   };
   node.onpointermove=e=>{
    if(!drag||drag.id!==o.id||drag.pointerId!==e.pointerId)return;
    const dx=Math.round((e.clientX-drag.x)*drag.sx),dy=Math.round((e.clientY-drag.y)*drag.sy);
    const d=drag,mode=d.mode,minW=limit(20,1,p.width),minH=limit(20,1,p.height);
    if(mode==='move'){
     o.x=limit(d.ox+dx,0,Math.max(0,p.width-o.w));
     o.y=limit(d.oy+dy,0,Math.max(0,p.height-o.h));
    }else{
     // Edges opposite the dragged handle remain anchored.
     if(mode.includes('w')){
      const right=d.ox+d.ow;
      o.x=limit(d.ox+dx,0,Math.max(0,right-minW));
      o.w=right-o.x;
     }else if(mode.includes('e'))o.w=limit(d.ow+dx,minW,Math.max(minW,p.width-d.ox));
     if(mode.includes('n')){
      const bottom=d.oy+d.oh;
      o.y=limit(d.oy+dy,0,Math.max(0,bottom-minH));
      o.h=bottom-o.y;
     }else if(mode.includes('s'))o.h=limit(d.oh+dy,minH,Math.max(minH,p.height-d.oy));
    }
    Object.assign(node.style,{left:o.x+'px',top:o.y+'px',width:o.w+'px',height:o.h+'px'});
   };
   const finish=e=>{
    if(!drag||drag.id!==o.id||drag.pointerId!==e.pointerId)return;
    const before=drag.before;
    drag=null;
    editCommit(before);
    renderProps();
   };
   node.onpointerup=finish;
   node.onpointercancel=finish;
   node.onlostpointercapture=finish;
  }
  canvas.append(node);
 }
 canvas.onclick=e=>{
  if(e.target===canvas){
   selected=null;renderProps();
   canvas.querySelectorAll('.widget').forEach(z=>z.classList.remove('selected'));
  }
 };
}
function opts(value,filter=()=>true,includeInternal=true){
 const plc=p.variables.filter(v=>v.live&&filter(v));
 const locals=includeInternal?p.internalVariables.filter(v=>v.name&&filter(v)):[];
 return '<option value="">— variable —</option>'
  +(plc.length?'<optgroup label="Variables PLC">'+plc.map(v=>`<option value="${C.esc(v.name)}" ${v.name===value?'selected':''}>${C.esc(v.name)} · ${v.type} · ${v.access}</option>`).join('')+'</optgroup>':'')
  +(locals.length?'<optgroup label="Variables internas">'+locals.map(v=>`<option value="${C.esc(v.name)}" ${v.name===value?'selected':''}>${C.esc(v.name)} · ${v.type} · interna</option>`).join('')+'</optgroup>':'');
}
function renderProps(){const host=$('#properties'),o=activeScreen().objects.find(o=>o.id===selected);if(!o){host.innerHTML='<p class="hint">Selecciona un elemento.'+(!isBaseScreen()&&activeScreen().useBase?' Los elementos heredados de la pantalla base están bloqueados aquí.':'')+'</p>';return;}const filter=v=>['status','button','switch'].includes(o.kind)?BOOL(v):['bar','tank','slider','stepper','gauge','counter'].includes(o.kind)?NUM(v):['selector','dropdown','multistate'].includes(o.kind)?(NUM(v)&&!['REAL','LREAL'].includes(v.type)):o.kind==='input'?(NUM(v)||v.type==='STRING'||['BYTE','WORD','DWORD','LWORD','TIME','DATE','TIME_OF_DAY','DATE_AND_TIME'].includes(v.type)):true;let binding='';let extra='';
 if(o.kind==='status'){binding=`<label>Variable BOOL<select data-p="binding">${opts(o.binding,filter)}</select></label>`;extra+=`<label>Dibujo<select data-p="symbolType"><option value="lamp" ${o.symbolType==='lamp'?'selected':''}>Lámpara</option><option value="motor" ${o.symbolType==='motor'?'selected':''}>Motor</option><option value="pump" ${o.symbolType==='pump'?'selected':''}>Bomba</option><option value="valve" ${o.symbolType==='valve'?'selected':''}>Válvula</option><option value="conveyor" ${o.symbolType==='conveyor'?'selected':''}>Cinta</option><option value="sensor" ${o.symbolType==='sensor'?'selected':''}>Sensor</option></select></label><label>Estado ON cuando BOOL =<select data-p="stateOnWhen"><option value="true" ${o.stateOnWhen!=='false'?'selected':''}>TRUE</option><option value="false" ${o.stateOnWhen==='false'?'selected':''}>FALSE</option></select></label><div class="state-pair"><div><span>OFF</span>${C.statusSvg(o.symbolType,false)}</div><div><span>ON</span>${C.statusSvg(o.symbolType,true)}</div></div>`;}
 else if(o.kind==='text'){binding=`<label>Variable PLC o interna<select data-p="binding">${opts(o.binding,()=>true,true)}</select></label>`;extra+=`<label>Mensajes dinámicos opcionales (valor=texto, uno por línea)<textarea data-p="optionsText" rows="5" placeholder="0=Parado&#10;1=En marcha">${C.esc(o.optionsText)}</textarea></label><p class="hint">Deja la variable y los mensajes vacíos para texto fijo. Si hay mensajes, se eligen según el valor de la variable. El texto fijo se usa como mensaje predeterminado. Una expresión de texto tiene prioridad sobre ambos.</p>`;}
  else if(o.kind==='button'){o.actionType=o.actionType||'write';extra+=`<label>Tipo de acción<select data-p="actionType"><option value="write" ${o.actionType==='write'?'selected':''}>Escribir variable BOOL</option><option value="navigate" ${o.actionType==='navigate'?'selected':''}>Cambio de pantalla</option><option value="popup" ${o.actionType==='popup'?'selected':''}>Abrir ventana emergente</option><option value="closePopup" ${o.actionType==='closePopup'?'selected':''}>Cerrar ventana emergente</option></select></label>`;if(['navigate','popup'].includes(o.actionType)){extra+=`<label>Pantalla destino<select data-p="targetScreenId"><option value="">— pantalla —</option>${p.screens.map(s=>`<option value="${C.esc(s.id)}" ${s.id===o.targetScreenId?'selected':''}>${C.esc(s.name)}</option>`).join('')}</select></label>`;}else if(o.actionType!=='closePopup'){binding=`<label>Variable<select data-p="binding">${opts(o.binding,filter)}</select></label>`;extra+=`<label>Acción BOOL<select data-p="actionMode"><option value="set" ${o.actionMode==='set'?'selected':''}>SET</option><option value="reset" ${o.actionMode==='reset'?'selected':''}>RESET</option><option value="toggle" ${o.actionMode==='toggle'?'selected':''}>TOGGLE</option></select></label>`;}extra+=`<label>Feedback BOOL<select data-p="feedbackBinding">${opts(o.feedbackBinding,BOOL)}</select></label><div class="grid2"><label>Color OFF<input data-p="feedbackColorOff" type="color" value="${C.esc(o.feedbackColorOff||'#2563eb')}"></label><label>Color ON<input data-p="feedbackColorOn" type="color" value="${C.esc(o.feedbackColorOn||'#16a34a')}"></label></div>`;}
 else if(!['text','image'].includes(o.kind))binding=`<label>Variable<select data-p="binding">${opts(o.binding,filter)}</select></label>`;
 const bound=p.variables.find(v=>v.name===o.binding)||p.internalVariables.find(v=>v.name===o.binding);if(['value','input','slider','stepper','gauge','counter'].includes(o.kind)&&bound&&(bound.type==='REAL'||bound.type==='LREAL'))extra+=`<label>Decimales<input data-p="decimals" type="number" min="0" max="6" value="${o.decimals}"></label>`;if(o.kind==='input'&&bound&&NUM(bound))extra+=`<div class="grid2"><label>Límite inferior<input data-p="inputMin" type="number" step="any" placeholder="Sin límite" value="${o.inputMin??''}"></label><label>Límite superior<input data-p="inputMax" type="number" step="any" placeholder="Sin límite" value="${o.inputMax??''}"></label></div><p class="hint">Se admiten valores negativos. Fuera de rango no se envía al PLC.</p>`;
 if(['slider','stepper','gauge','counter'].includes(o.kind)){extra+=`<div class="grid2"><label>Mínimo<input data-p="min" type="number" step="any" value="${o.min}"></label><label>Máximo<input data-p="max" type="number" step="any" value="${o.max}"></label></div>`;if(['slider','stepper'].includes(o.kind))extra+=`<label>Paso<input data-p="step" type="number" min="0.000001" step="any" value="${o.step}"></label>`;extra+=`<label>Unidad<input data-p="unit" value="${C.esc(o.unit)}"></label>`;if(o.kind==='counter')extra+=`<label>Objetivo<input data-p="target" type="number" step="any" value="${o.target}"></label>`;}if(['selector','dropdown','multistate'].includes(o.kind))extra+=`<label>Opciones (valor=texto, una por línea)<textarea data-p="optionsText" rows="5">${C.esc(o.optionsText)}</textarea></label>`;
 if(['bar','tank'].includes(o.kind))extra+=`<div class="grid2"><label>Mín<input data-p="min" type="number" value="${o.min}"></label><label>Máx<input data-p="max" type="number" value="${o.max}"></label></div>`;
 if(o.kind==='button'&&o.actionType==='write')extra+=`<label>Confirmación opcional (antes de escribir)<input data-p="confirmationText" value="${C.esc(o.confirmationText||'')}" placeholder="Vacío = sin confirmación"></label>`;
  if(o.kind==='image'){const assetOpts=id=>'<option value="">— imagen —</option>'+p.assets.map(a=>`<option value="${C.esc(a.id)}" ${a.id===id?'selected':''}>${C.esc(a.name)} · ${(C.dataUrlBytes(a.data)/1024).toFixed(1)} KB</option>`).join('');extra+=`<label>Variable BOOL (opcional)<select data-p="binding">${opts(o.binding,BOOL)}</select></label><label>Imagen FALSE / OFF<select data-p="assetId">${assetOpts(o.assetId)}</select></label><button type="button" id="uploadImageOff">Subir/cambiar OFF</button>${o.binding?`<label>Imagen TRUE / ON<select data-p="assetOnId">${assetOpts(o.assetOnId)}</select></label><button type="button" id="uploadImageOn">Subir/cambiar ON</button>`:''}<p class="hint">Sin BOOL funciona como imagen estática. Con BOOL: FALSE muestra OFF y TRUE muestra ON. Ambas imágenes respetan los límites de memoria.</p>`;}
 if(!['image','bar'].includes(o.kind))extra+=`<label>Tamaño de letra (px)<input data-p="fontSize" type="number" min="8" max="120" step="1" value="${o.fontSize??''}" placeholder="Automático"></label><p class="hint">8–120 px. Vacío: tamaño original del elemento. Afecta a textos y valores numéricos; no cambia el ancho ni el alto del objeto.</p>`;
  extra+=`<fieldset class="expression-settings"><legend>Expresiones dinámicas (opcionales)</legend><p class="hint">Usa Process_Level, Machine_Running o HMI.PLCConnected. Ejemplo: Process_Level > 80 ? \"#dc2626\" : \"#16a34a\".</p><label>Texto <input data-p="expressionText" value="${C.esc(o.expressionText||'')}" placeholder='Machine_Running ? "Marcha" : "Paro"'></label><label>Color del texto <input data-p="expressionColor" value="${C.esc(o.expressionColor||'')}" placeholder='Process_Level > 80 ? "red" : "green"'></label><label>Color de fondo <input data-p="expressionBackground" value="${C.esc(o.expressionBackground||'')}" placeholder='Process_Level > 80 ? "#fecaca" : "#dcfce7"'></label><label>Visible <input data-p="expressionVisible" value="${C.esc(o.expressionVisible||'')}" placeholder="Process_Level > 0"></label></fieldset>`;
  host.innerHTML=`<label>Tipo<input value="${o.kind==='status'?'Estado':o.kind}" disabled></label><label>Texto<input data-p="text" value="${C.esc(o.text)}"></label>${binding}${extra}<p class="hint">Mueve el elemento arrastrándolo. Para cambiar su tamaño, selecciónalo y arrastra cualquiera de los ocho tiradores, o introduce las medidas aquí.</p><div class="grid2"><label>X<input data-p="x" type="number" value="${Math.round(o.x)}"></label><label>Y<input data-p="y" type="number" value="${Math.round(o.y)}"></label><label>Ancho<input data-p="w" type="number" value="${o.w}" min="1" max="${p.width}"></label><label>Alto<input data-p="h" type="number" value="${o.h}" min="1" max="${p.height}"></label></div><button id="deleteObj" class="delete">Eliminar</button>`;
 host.querySelectorAll('[data-p]').forEach(x=>x.onchange=()=>editAction(()=>{let v=x.value;if(['x','y','w','h','min','max','decimals','step','target'].includes(x.dataset.p))v=Number(v);else if(['inputMin','inputMax','fontSize'].includes(x.dataset.p))v=v===''?null:Number(v);o[x.dataset.p]=v;if(x.dataset.p==='actionType'&&['navigate','popup'].includes(v)){o.binding='';o.targetScreenId=o.targetScreenId||p.screens.find(s=>s.id!==screenId)?.id||screenId;}if((x.dataset.p==='binding'||x.dataset.p==='feedbackBinding')&&v){const tag=p.variables.find(t=>t.name===v);if(tag){tag.expose=true;if(x.dataset.p==='binding'&&tag.enumValues&&['selector','dropdown','multistate','text'].includes(o.kind))o.optionsText=Object.entries(tag.enumValues).map(([label,num])=>num+'='+label).join('\n');if(x.dataset.p==='binding'&&['button','input','slider','switch','selector','stepper','dropdown'].includes(o.kind)&&tag.writeSupported)tag.access='RW';}}render();},x));if(o.kind==='image'){const off=$('#uploadImageOff'),on=$('#uploadImageOn');if(off)off.onclick=()=>{imageUploadTarget={objectId:o.id,prop:'assetId'};$('#imageFile').click()};if(on)on.onclick=()=>{imageUploadTarget={objectId:o.id,prop:'assetOnId'};$('#imageFile').click()};}$('#deleteObj').onclick=()=>deleteSafely('el objeto «'+(o.text||o.kind)+'»','Se eliminará de la pantalla actual.',()=>{activeScreen().objects=activeScreen().objects.filter(x=>x!==o);selected=null;render();});}
function renderAlarms(){const host=$('#alarmEditor');host.innerHTML=p.alarms.map((a,i)=>`<div class="editor-card"><input data-alarm="${i}" data-k="name" value="${C.esc(a.name)}"><select data-alarm="${i}" data-k="binding">${opts(a.binding,()=>true,false)}</select><div class="grid3"><select data-alarm="${i}" data-k="operator"><option value="eq" ${a.operator==='eq'?'selected':''}>=</option><option value="ne" ${a.operator==='ne'?'selected':''}>≠</option><option value="gt" ${a.operator==='gt'?'selected':''}>&gt;</option><option value="ge" ${a.operator==='ge'?'selected':''}>≥</option><option value="lt" ${a.operator==='lt'?'selected':''}>&lt;</option><option value="le" ${a.operator==='le'?'selected':''}>≤</option></select><input data-alarm="${i}" data-k="value" value="${C.esc(a.value)}"><select data-alarm="${i}" data-k="severity"><option value="info" ${a.severity==='info'?'selected':''}>Info</option><option value="warning" ${a.severity==='warning'?'selected':''}>Aviso</option><option value="high" ${a.severity==='high'?'selected':''}>Alta</option></select></div><button data-del-alarm="${i}">Eliminar</button></div>`).join('')||'<p class="hint">Sin alarmas.</p>';host.querySelectorAll('[data-alarm]').forEach(x=>x.onchange=()=>editAction(()=>{const a=p.alarms[+x.dataset.alarm];a[x.dataset.k]=x.value;if(x.dataset.k==='binding'){const v=p.variables.find(v=>v.name===x.value);if(v)v.expose=true;}renderDiag();},x));host.querySelectorAll('[data-del-alarm]').forEach(x=>x.onclick=()=>{const i=+x.dataset.delAlarm,a=p.alarms[i];if(a)deleteSafely('la alarma «'+a.name+'»','Se eliminará su definición de la HMI.',()=>{p.alarms.splice(i,1);render();});});}
function recipeText(r){return Object.entries(r.values||{}).map(([k,v])=>k+'='+v).join('\n')}
function parseRecipeText(t){const out={};for(const line of t.split(/\r?\n/)){if(!line.trim())continue;const k=line.indexOf('=');if(k<1)continue;const name=line.slice(0,k).trim(),raw=line.slice(k+1).trim(),v=p.variables.find(v=>v.name===name);if(!v)throw new Error('Variable de receta no encontrada: '+name);if(v.access!=='RW'||!v.writeSupported)throw new Error(name+' debe ser RW');out[name]=C.typedFor(v,raw);}return out}
function renderRecipes(){const host=$('#recipeEditor');host.innerHTML=p.recipes.map((r,i)=>`<div class="editor-card"><input data-recipe-name="${i}" value="${C.esc(r.name)}"><textarea data-recipe-values="${i}" rows="4">${C.esc(recipeText(r))}</textarea><button data-del-recipe="${i}">Eliminar</button></div>`).join('')||'<p class="hint">Sin recetas.</p>';host.querySelectorAll('[data-recipe-name]').forEach(x=>x.onchange=()=>editAction(()=>{p.recipes[+x.dataset.recipeName].name=x.value;renderDiag();},x));host.querySelectorAll('[data-recipe-values]').forEach(x=>x.onchange=()=>{try{const values=parseRecipeText(x.value);editAction(()=>{p.recipes[+x.dataset.recipeValues].values=values;renderDiag();},x);}catch(e){toast(e.message)}});host.querySelectorAll('[data-del-recipe]').forEach(x=>x.onclick=()=>{const i=+x.dataset.delRecipe,r=p.recipes[i];if(r)deleteSafely('la receta «'+r.name+'»','Se eliminarán también sus consignas guardadas.',()=>{p.recipes.splice(i,1);render();});});}
function renderDiag(){syncProjectInputs();const errors=C.validate(p),html=C.buildRuntimeHTML(p),bytes=new TextEncoder().encode(html).length;let list=[`<div class="diagnostic ${errors.length?'error':'ok'}">${errors.length?'Bloqueos: '+errors.length:'Proyecto exportable'}</div>`];for(const e of errors.slice(0,7))list.push(`<div class="diagnostic error">${C.esc(e)}</div>`);const assetBytes=p.assets.reduce((n,a)=>n+C.dataUrlBytes(a.data),0);list.push(`<div class="diagnostic">HTML: ${(bytes/1024).toFixed(1)} / 512 KB · imágenes: ${(assetBytes/1024).toFixed(1)} / 256 KB · ${p.screens.length} pantallas · ${p.alarms.length} alarmas · ${p.recipes.length} recetas.</div>`);list.push('<div class="diagnostic ok">Base servidor/lectura validada en NX102 real.</div>');if(bytes>C.HTML_MAX_BYTES)list.push('<div class="diagnostic error">HTML supera 512 KB: exportación bloqueada.</div>');$('#diagnostics').innerHTML=list.join('');}
function importText(text){const old=new Map(p.variables.map(v=>[v.name,v]));const vars=C.importSysmac(text);for(const v of vars){const prev=old.get(v.name);if(prev){v.access=prev.access;v.expose=prev.expose;}}editAction(()=>{p.variables=vars;render();toast(vars.length+' variables importadas');});}
function download(name,data,type='application/octet-stream'){const a=document.createElement('a'),blob=new Blob([data],{type});a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);}

function clampPreviewDialog(){
 const dialog=$('#previewDialog');
 if(!dialog.open)return;
 const r=dialog.getBoundingClientRect(),edge=8;
 const width=Math.min(r.width,Math.max(1,window.innerWidth-2*edge));
 const height=Math.min(r.height,Math.max(1,window.innerHeight-2*edge));
 if(r.width>width||r.height>height){dialog.style.width=Math.floor(width)+'px';dialog.style.height=Math.floor(height)+'px'}
 if(dialog.style.left||dialog.style.top){
  dialog.style.left=Math.max(edge,Math.min(window.innerWidth-width-edge,r.left))+'px';
  dialog.style.top=Math.max(edge,Math.min(window.innerHeight-height-edge,r.top))+'px';
 }
}
function previewResizeStart(){
 const dialog=$('#previewDialog'),rect=dialog.getBoundingClientRect();
 dialog.style.inset='auto';dialog.style.margin='0';
 dialog.style.left=Math.round(rect.left)+'px';dialog.style.top=Math.round(rect.top)+'px';
 return{w:rect.width,h:rect.height};
}
function previewResizeTo(width,height){
 const dialog=$('#previewDialog'),rect=dialog.getBoundingClientRect(),edge=8;
 const minWidth=Math.min(420,window.innerWidth-edge*2),minHeight=Math.min(280,window.innerHeight-edge*2);
 const maxWidth=Math.max(minWidth,window.innerWidth-rect.left-edge),maxHeight=Math.max(minHeight,window.innerHeight-rect.top-edge);
 dialog.style.width=Math.round(Math.max(minWidth,Math.min(maxWidth,width)))+'px';
 dialog.style.height=Math.round(Math.max(minHeight,Math.min(maxHeight,height)))+'px';
}
function preview(){
 syncProjectInputs();
 const errors=C.validate(p);
 if(errors.length){toast('Corrige bloqueos antes de previsualizar');return;}
 let html=C.buildRuntimeHTML(p);
 html=html.replace('startComm();</script>','for(const v of P.vars)vals[v.name]=v.type==="BOOL"?false:v.type==="STRING"?"DEMO":55;document.getElementById("status").textContent="PREVIEW local";comm.state="ONLINE";comm.lastGoodAt=Date.now();showScreen(0);fitStage();paint();</script>');
 $('#previewFrame').srcdoc=html;
 $('#previewDialog').showModal();
 clampPreviewDialog();
}
{
 const handle=$('#previewResizeHandle');
 let initial=null;
 handle.onpointerdown=e=>{
  if(e.button!==0||!$('#previewDialog').open)return;
  e.preventDefault();
  const size=previewResizeStart();
  initial={pointerId:e.pointerId,x:e.clientX,y:e.clientY,...size};
  handle.setPointerCapture(e.pointerId);
 };
 handle.onpointermove=e=>{
  if(!initial||initial.pointerId!==e.pointerId)return;
  previewResizeTo(initial.w+(e.clientX-initial.x),initial.h+(e.clientY-initial.y));
 };
 const finish=e=>{if(initial&&initial.pointerId===e.pointerId)initial=null};
 handle.onpointerup=finish;
 handle.onpointercancel=finish;
 handle.onlostpointercapture=finish;
 handle.onkeydown=e=>{
  const delta=e.shiftKey?50:20;
  const offsets={ArrowRight:[delta,0],ArrowLeft:[-delta,0],ArrowDown:[0,delta],ArrowUp:[0,-delta]};
  if(!offsets[e.key])return;
  e.preventDefault();
  const size=previewResizeStart(),[dx,dy]=offsets[e.key];
  previewResizeTo(size.w+dx,size.h+dy);
 };
 window.addEventListener('resize',clampPreviewDialog);
}
const sidebarTabs=[...document.querySelectorAll('[data-sidebar-tab]')];
function showSidebarTab(name,focus=false){
 const current=sidebarTabs.find(b=>b.dataset.sidebarTab===name);if(!current)return;
 for(const b of sidebarTabs){const active=b===current;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;b.classList.toggle('is-active',active);document.getElementById(b.getAttribute('aria-controls')).hidden=!active;}
 $('.left-panels').scrollTop=0;if(focus)current.focus();
}
sidebarTabs.forEach((tab,index)=>{
 tab.onclick=()=>showSidebarTab(tab.dataset.sidebarTab);
 tab.onkeydown=e=>{let next;
  if(e.key==='ArrowRight')next=sidebarTabs[(index+1)%sidebarTabs.length];
  else if(e.key==='ArrowLeft')next=sidebarTabs[(index+sidebarTabs.length-1)%sidebarTabs.length];
  else if(e.key==='Home')next=sidebarTabs[0];
  else if(e.key==='End')next=sidebarTabs[sidebarTabs.length-1];
  else return;
  e.preventDefault();showSidebarTab(next.dataset.sidebarTab,true);
 };
});
document.querySelectorAll('.tool-grid [data-kind]').forEach(b=>b.onclick=()=>editAction(()=>{const o=C.newObject(b.dataset.kind);activeScreen().objects.push(o);selected=o.id;render();}));
['projectName','port','pollMs','screenW','screenH','minDisplayWidth','maxDisplayWidth'].forEach(id=>{const input=$('#'+id);input.onchange=()=>editAction(()=>{syncProjectInputs();renderCanvas();renderDiag();},input);});
function uniqueScreenName(base){const names=new Set([...p.screens,...(p.baseScreen?[p.baseScreen]:[])].map(s=>s.name));if(!names.has(base))return base;for(let i=2;;i++){const name=base+' '+i;if(!names.has(name))return name;}}
function canAddScreen(){if(p.screens.length<20)return true;toast('Máximo 20 pantallas por proyecto');return false;}
$('#screenSelect').onchange=e=>{screenId=e.target.value;selected=null;render();};
function refreshScreenSettingsMode(source=''){
 const ownBase=isBaseScreen(),convert=$('#screenSettingsIsBase'),use=$('#screenSettingsUseBase');
 if(source==='convert'&&convert.checked)use.checked=false;
 if(source==='use'&&use.checked)convert.checked=false;
 convert.disabled=Boolean(p.baseScreen)&&!ownBase;
 use.disabled=!p.baseScreen||ownBase;
 if(use.disabled)use.checked=false;
 $('#screenSettingsNumberRow').hidden=convert.checked;
 $('#screenSettingsNumber').required=!convert.checked;
 const note=$('#screenSettingsNote');
 if(convert.checked)note.textContent='Esta pantalla será la única base compartida; no tendrá número de navegación PLC. Sus elementos se conservarán.';
 else if(ownBase)note.textContent='Al quitar la condición de base se conservan sus elementos, pero las demás pantallas dejarán de heredarlos.';
 else if(p.baseScreen)note.textContent=use.checked?'Los elementos de la base aparecerán detrás de los propios y se actualizarán automáticamente.':'Puedes activar la herencia de la pantalla base existente.';
 else note.textContent='Marca «Convertir en pantalla base» para crear la única pantalla base del proyecto.';
 if(convert.disabled)note.textContent='Ya existe una pantalla base. Para cambiarla, primero desmarca «Convertir en pantalla base» en la pantalla base actual.';
}
$('#editScreen').onclick=()=>{
 const s=activeScreen(),base=isBaseScreen();
 $('#screenSettingsName').value=s.name;
 const previous=Number(s.previousNumber);const available=Number.isInteger(previous)&&previous>=1&&previous<=C.MAX_SCREEN_NUMBER&&!p.screens.some(x=>x.number===previous)?previous:C.nextScreenNumber(p.screens);$('#screenSettingsNumber').value=String(base?available:s.number);
 $('#screenSettingsBackground').value=s.background;
 $('#screenSettingsIsBase').checked=base;
 $('#screenSettingsUseBase').checked=!base&&s.useBase===true;
 $('#screenSettingsError').textContent='';
 refreshScreenSettingsMode();
 $('#screenSettingsDialog').showModal();
};
$('#screenSettingsIsBase').onchange=()=>refreshScreenSettingsMode('convert');
$('#screenSettingsUseBase').onchange=()=>refreshScreenSettingsMode('use');
$('#screenSettingsCancel').onclick=()=>$('#screenSettingsDialog').close();
$('#screenSettingsForm').onsubmit=e=>{
 e.preventDefault();
 const s=activeScreen(),wasBase=isBaseScreen(),name=$('#screenSettingsName').value.trim(),
  toBase=$('#screenSettingsIsBase').checked,useBase=$('#screenSettingsUseBase').checked,
  background=$('#screenSettingsBackground').value,
  number=toBase?null:Number($('#screenSettingsNumber').value),
  mode=toBase?'base':useBase?'useBase':'normal';
 let error='';
 if(!name)error='Introduce un nombre de pantalla.';
 else if([...p.screens,...(p.baseScreen?[p.baseScreen]:[])].some(x=>x.id!==s.id&&x.name.toLocaleLowerCase('es')===name.toLocaleLowerCase('es')))error='Ya existe una pantalla con ese nombre.';
 else if(toBase&&p.baseScreen&&!wasBase)error='Ya existe una pantalla base. Desmarca primero la pantalla base anterior.';
 else if(useBase&&(!p.baseScreen||wasBase))error='No es posible utilizar la base en esa pantalla.';
 else if(!toBase&&(!Number.isSafeInteger(number)||number<1||number>C.MAX_SCREEN_NUMBER))error='El número debe ser un entero entre 1 y '+C.MAX_SCREEN_NUMBER+'.';
 else if(!toBase&&p.screens.some(x=>x.id!==s.id&&x.number===number))error='El número '+number+' ya pertenece a otra pantalla.';
 else if(!/^#[0-9a-f]{6}$/i.test(background))error='Selecciona un color de fondo válido.';
 if(error){$('#screenSettingsError').textContent=error;return;}
 const changeMode=(wasBase!==toBase)||(!wasBase&&s.useBase!==useBase);
 const changed=s.name!==name||s.background!==background||(!toBase&&s.number!==number)||changeMode;
 if(!changed){$('#screenSettingsDialog').close();return;}
 if(wasBase&&!toBase){
  const count=p.screens.filter(x=>x.useBase).length;
  if(!confirm('Esta pantalla dejará de ser la base. '+count+' pantalla(s) dejarán de heredar sus elementos. No se eliminarán los elementos originales. ¿Continuar?'))return;
 }
 if(wasBase!==toBase&&!p0Snapshot('antes-cambiar-tipo-pantalla',true)){
  $('#screenSettingsError').textContent='No se pudo realizar una copia de seguridad local. Guarda el proyecto antes de convertir la pantalla.';
  return;
 }
 editAction(()=>{
  if(changeMode)C.setScreenMode(p,s.id,mode);
  s.name=name;s.background=background;
  if(!toBase)s.number=number;
  selected=null;render();
 });
 $('#screenSettingsDialog').close();
};
$('#screenBinding').onchange=e=>editAction(()=>{p.screenBinding=e.target.value;const variable=p.variables.find(v=>v.name===p.screenBinding);if(variable)variable.expose=true;renderVars();renderDiag();});
$('#addScreen').onclick=()=>{if(!canAddScreen())return;editAction(()=>{const s=C.newScreen(uniqueScreenName('Pantalla '+(p.screens.length+1)),C.nextScreenNumber(p.screens));p.screens.push(s);screenId=s.id;selected=null;render();});};$('#copyScreen').onclick=()=>{if(isBaseScreen()||!canAddScreen())return;editAction(()=>{const original=activeScreen(),s=C.duplicateScreen(original,uniqueScreenName(original.name+' (copia)'),C.nextScreenNumber(p.screens));p.screens.push(s);screenId=s.id;selected=null;render();});toast('Pantalla copiada: puedes editarla sin modificar la original');};$('#deleteScreen').onclick=()=>{if(isBaseScreen()){deleteSafely('la pantalla base','Se perderán sus '+p.baseScreen.objects.length+' objetos y se desactivará su uso en todas las pantallas.',()=>{p.baseScreen=null;p.screens.forEach(s=>{s.useBase=false});screenId=p.screens[0].id;selected=null;render();});return;}if(p.screens.length<=1)return;const s=activeScreen();deleteSafely('la pantalla «'+s.name+'»','Se eliminará la pantalla completa y sus '+s.objects.length+' objetos.',()=>{p.screens=p.screens.filter(x=>x.id!==s.id);screenId=p.screens[0].id;selected=null;render();});};
$('#imageBtn').onclick=()=>{imageUploadTarget=null;$('#imageFile').click()};$('#imageFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;const uploadTarget=imageUploadTarget;try{const current=p.assets.reduce((n,a)=>n+C.dataUrlBytes(a.data),0),remaining=C.IMAGE_TOTAL_MAX_BYTES-current;if(remaining<=1024)throw new Error('No queda presupuesto de imágenes en el proyecto (256 KB total)');const proceed=confirm('La imagen se incrusta dentro del programa del NX. Límite: 64 KB por imagen y 256 KB total. Si es necesario se redimensionará y convertirá a WebP (máximo 1024 px) para reducir memoria y tiempo de carga. ¿Continuar?');if(!proceed)return;const target=Math.min(C.IMAGE_MAX_BYTES,remaining),result=await optimizeImage(file,target);if(result.bytes>C.IMAGE_MAX_BYTES||result.bytes>remaining)throw new Error('La imagen optimizada sigue superando el presupuesto permitido');const finalName=result.optimized?file.name.replace(/\.[^.]+$/,'')+'.webp':file.name;const asset={id:C.id(),name:finalName,data:result.data,optimized:result.optimized,sourceBytes:result.originalBytes,bytes:result.bytes,width:result.width,height:result.height};editAction(()=>{p.assets.push(asset);if(uploadTarget){const targetObj=[...p.screens,...(p.baseScreen?[p.baseScreen]:[])].flatMap(s=>s.objects).find(o=>o.id===uploadTarget.objectId);if(!targetObj||targetObj.kind!=='image')throw new Error('El objeto de imagen ya no existe');targetObj[uploadTarget.prop]=asset.id;selected=targetObj.id;}else{const o=C.newObject('image');o.assetId=asset.id;o.text=finalName;activeScreen().objects.push(o);selected=o.id;}render();});if(result.optimized)toast('Imagen optimizada: '+(result.originalBytes/1024).toFixed(1)+' → '+(result.bytes/1024).toFixed(1)+' KB'+(result.width?' · '+result.width+'×'+result.height+' WebP':''));else toast('Imagen añadida sin reducción: '+(result.bytes/1024).toFixed(1)+' KB');}catch(err){toast('Imagen rechazada: '+err.message)}finally{imageUploadTarget=null;e.target.value='';}};
$('#addInternalVar').onclick=()=>editAction(()=>{const names=new Set([...p.variables,...p.internalVariables].map(v=>v.name));let i=1;while(names.has('Internal_'+i))i++;p.internalVariables.push({name:'Internal_'+i,type:'BOOL',value:false});render();});
$('#addAlarm').onclick=()=>editAction(()=>{const v=p.variables.find(v=>v.live);p.alarms.push({id:C.id(),name:'Nueva alarma',binding:v?.name||'',operator:v?.type==='BOOL'?'eq':'gt',value:v?.type==='BOOL'?true:0,severity:'warning'});if(v)v.expose=true;render();});$('#addRecipe').onclick=()=>editAction(()=>{p.recipes.push({id:C.id(),name:'Nueva receta',values:{}});render();});
$('#demoBtn').onclick=()=>p0ProtectReplace('cargar demo',()=>{p=C.demoProject();screenId=p.screens[0].id;selected=null;render()});$('#newBtn').onclick=()=>p0ProtectReplace('crear proyecto nuevo',()=>{p=C.newProject();screenId=p.screens[0].id;selected=null;render()});
$('#importFileBtn').onclick=()=>$('#varsFile').click();$('#varsFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{importText(await file.text())}catch(err){toast(err.message)}e.target.value='';};$('#pasteBtn').onclick=()=>{$('#pasteText').value='';$('#pasteError').textContent='';$('#pasteDialog').showModal()};$('#pasteImport').onclick=()=>{try{importText($('#pasteText').value);$('#pasteDialog').close()}catch(e){$('#pasteError').textContent=e.message}};
$('#previewBtn').onclick=preview;$('#closePreview').onclick=()=>$('#previewDialog').close();$('#recoveryBtn').onclick=()=>{p0RenderRecovery();$('#recoveryDialog').showModal()};$('#closeRecovery').onclick=$('#closeRecovery2').onclick=()=>$('#recoveryDialog').close();$('#discardDrafts').onclick=()=>{if(confirm('¿Borrar todas las copias automáticas locales de HMI NX ST?')){localStorage.removeItem(P0_LATEST);localStorage.removeItem(P0_HISTORY);p0LastSavedJSON='';p0LastHistoryJSON='';p0RenderRecovery();p0Status('Copias locales borradas','dirty')}};$('#saveBtn').onclick=()=>{syncProjectInputs();const data=JSON.stringify(C.normalize(p),null,2);download((p.name||'project').replace(/[^A-Za-z0-9_-]+/g,'_')+'.nxst',data,'application/json');p0Checkpoint();p0Snapshot('guardado-manual',true);toast('Proyecto guardado y copia local actualizada')};$('#loadBtn').onclick=()=>$('#projectFile').click();$('#projectFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const q=C.normalize(JSON.parse(await file.text()));p0Snapshot('antes-abrir-archivo',true);if(p0Dirty()&&!confirm('Hay cambios no descargados. Se ha creado una copia automática. ¿Abrir el archivo y sustituir el proyecto actual?')){e.target.value='';return}p=q;screenId=p.screens[0].id;selected=null;editReset();render();p0Checkpoint();p0Snapshot('archivo-abierto',true);toast('Proyecto abierto')}catch(err){toast('Proyecto no válido: '+err.message)}e.target.value='';};$('#exportBtn').onclick=()=>{syncProjectInputs();try{const out=C.exportPackage(p),name=(p.name||'WebHMI_ST').replace(/[^A-Za-z0-9_-]+/g,'_')+'_Sysmac.zip';download(name,out.zip,'application/zip');p0Checkpoint();p0Snapshot('exportado-sysmac',true);toast('Paquete Sysmac generado')}catch(e){toast(e.message)}};
$('#undoBtn').onclick=editUndo;$('#redoBtn').onclick=editRedo;
$('#widgetMenu').addEventListener('click',e=>{const action=e.target.closest('[data-widget-action]')?.dataset.widgetAction;hideWidgetMenu();if(action==='copy')copyWidget();if(action==='paste')pasteWidget();});
document.addEventListener('pointerdown',e=>{if(!e.target.closest?.('#widgetMenu'))hideWidgetMenu()});document.addEventListener('scroll',hideWidgetMenu,true);
document.addEventListener('focusin',e=>{const el=e.target;if(el.matches?.('#projectName,#port,#pollMs,#screenW,#screenH,#minDisplayWidth,#maxDisplayWidth,[data-p],[data-alarm],[data-recipe-name],[data-recipe-values],[data-exp],[data-acc]'))editFocus={element:el,state:editState()};});
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||e.target.closest?.('input,textarea,select,[contenteditable]'))return;const key=e.key.toLowerCase();if(key==='c'&&!e.shiftKey){if(selected&&activeScreen().objects.some(o=>o.id===selected)){e.preventDefault();copyWidget()}}else if(key==='v'&&!e.shiftKey){if(widgetClipboard){e.preventDefault();pasteWidget()}}else if(key==='z'||key==='y'){e.preventDefault();if(key==='y'||e.shiftKey)editRedo();else editUndo();}});
p0Boot();
})();
