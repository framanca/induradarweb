/* Browser-only editor. Runtime exports contain no cloud credentials or editor code. */
(function(){
'use strict';
const C=NXCore,R=NXRuntime,$=s=>document.querySelector(s),esc=C.esc;
const S={p:C.demoProject(),screen:null,selected:null,tab:'editor',zoom:.75,grid:true,history:[],future:[],recipe:null,runtime:null};
S.screen=S.p.screens[0].id;
let saveTimer,toastTimer,dbPromise;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',5500);}
function db(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('HMI_NX_Designer',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}));}
async function store(mode,work){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('projects',mode);let request;try{request=work(tx.objectStore('projects'));}catch(e){reject(e);return;}tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Guardado cancelado'));});}
async function saveNow(){clearTimeout(saveTimer);const snapshot=C.copy(S.p);try{await store('readwrite',s=>s.put({id:snapshot.id,name:snapshot.name,updated:Date.now(),project:snapshot}));localStorage.setItem('HMI_NX_active',snapshot.id);$('#save-state').textContent='✓ Guardado local';}catch(e){$('#save-state').textContent='No guardado · descargue .nxhmi';toast('No se pudo guardar en el navegador: '+e.message);}}
function autosave(){$('#save-state').textContent='Guardando…';clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,450);}
function checkpoint(){S.history.push(JSON.stringify(S.p));if(S.history.length>40)S.history.shift();S.future=[];}
function mutate(fn,redraw=true){checkpoint();fn();autosave();if(redraw)render();}
function current(){return S.p.screens.find(s=>s.id===S.screen)||S.p.screens[0];}
function selected(){return current().objects.find(o=>o.id===S.selected);}
function download(filename,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type})),a=el('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function modal(title,html,preview=false){closeModal();$('#modal-title').textContent=title;$('#modal-body').innerHTML=html;$('#modal').className=preview?'preview-dialog':'';$('#modal').showModal();}
function closeModal(){if(S.runtime){S.runtime.stop();S.runtime=null;}$('#modal').close();}
function options(values,value){return values.map(v=>{const [id,label]=Array.isArray(v)?v:[v,v];return `<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`;}).join('');}
function field(label,key,value,type='text',wide=false){return `<label class="${wide?'wide':''}">${esc(label)}<input data-prop="${key}" type="${type}" value="${esc(value)}" ${type==='number'?'step="any"':''}></label>`;}
function choose(label,key,value,values,wide=true){return `<label class="${wide?'wide':''}">${esc(label)}<select data-prop="${key}">${options(values,value)}</select></label>`;}
const labels={text:['T','Texto'],rectangle:['□','Rectángulo'],button:['▭','Botón'],lamp:['●','Lámpara'],value:['123','Valor'],input:['⌨','Entrada'],bar:['▰','Barra'],image:['▧','Imagen'],alarms:['⚠','Alarmas'],recipes:['☷','Recetas']};
function addObject(kind,x=40,y=40,assetId=''){
 if(!C.KINDS.includes(kind))return;mutate(()=>{const o=C.newObject(kind,x,y);o.w=Math.min(o.w,S.p.width);o.h=Math.min(o.h,S.p.height);o.x=Math.max(0,Math.min(x,S.p.width-o.w));o.y=Math.max(0,Math.min(y,S.p.height-o.h));
 const v=S.p.variables.find(v=>kind==='lamp'?v.type==='BOOL':kind==='bar'?['REAL','DINT'].includes(v.type):['input','button'].includes(kind)?v.access==='RW':true);
 if(v&&['lamp','bar','input','button','value'].includes(kind)){o.binding=v.name;if(kind==='button')o.writeValue=String(v.type==='BOOL'?true:v.initial);}
 o.assetId=assetId;current().objects.push(o);S.selected=o.id;});
}
function inspector(){
 const host=$('#inspector');if(!host)return;const o=selected();
 if(!o){host.innerHTML=`<div class="panel-section"><div class="section-title">Propiedades</div><h3 class="property-title">${esc(current().name)}</h3><p class="hint">Selecciona un objeto para configurar su aspecto, variable y comportamiento.</p><label class="field">Fondo de pantalla<input id="screen-bg" type="color" value="${current().background}"></label><p class="hint">Lienzo ${S.p.width} × ${S.p.height} px<br>Arrastra objetos desde la biblioteca. Usa la esquina inferior derecha para cambiar su tamaño.</p></div>`;$('#screen-bg').onchange=e=>mutate(()=>current().background=e.target.value);return;}
 const tagList=[['','— Sin variable —'],...S.p.variables.map(v=>[v.name,`${v.name} · ${v.type} · ${v.access}`])];
 let html=field('Texto / etiqueta','text',o.text,'text',true)+field('X','x',o.x,'number')+field('Y','y',o.y,'number')+field('Ancho','w',o.w,'number')+field('Alto','h',o.h,'number')+field('Texto px','fontSize',o.fontSize,'number')+field('Color texto','color',o.color,'color')+field('Fondo','background',o.background,'color');
 if(['lamp','value','input','bar','button','image','text'].includes(o.kind))html+=choose('Variable / animación','binding',o.binding,tagList);
 if(o.kind==='lamp')html+=field('Color ON','onColor',o.onColor,'color')+field('Color OFF','offColor',o.offColor,'color');
 if(['bar','value','input'].includes(o.kind))html+=field('Unidad','unit',o.unit)+field('Decimales','digits',o.digits,'number');
 if(o.kind==='bar')html+=field('Mínimo escala','min',o.min,'number')+field('Máximo escala','max',o.max,'number');
 if(o.kind==='button'){
 html+=choose('Al pulsar','action',o.action,[['write','Escribir valor'],['navigate','Cambiar pantalla']]);
 html+=o.action==='write'?field('Valor a escribir','writeValue',o.writeValue,'text',true):choose('Pantalla de destino','targetScreen',o.targetScreen,[['','— Seleccionar —'],...S.p.screens.map(s=>[s.id,s.name])]);
 }
 if(o.kind==='image')html+=choose('Imagen del proyecto','assetId',o.assetId,[['','— Seleccionar —'],...S.p.assets.map(a=>[a.id,a.name])]);
 html+=choose('Visibilidad: mostrar si BOOL = TRUE','visibleBinding',o.visibleBinding,[['','Siempre visible'],...S.p.variables.filter(v=>v.type==='BOOL').map(v=>v.name)]);
 html+=choose('Animación cuando variable ≠ 0','animation',o.animation,[['none','Ninguna'],['blink','Parpadeo'],['rotate','Rotación de imagen/lámpara']]);
 host.innerHTML=`<div class="panel-section"><div class="section-title">${esc(labels[o.kind][1])}<span>${current().objects.indexOf(o)+1}</span></div><div class="property-grid">${html}</div><p class="hint property-group">Escritura y rangos se validan antes del envío. El PLC debe validar también cada orden. No se incluyen pulsadores de jog mantenido.</p></div>`;
 host.querySelectorAll('[data-prop]').forEach(input=>input.onchange=()=>{let value=input.type==='number'?Number(input.value):input.value;if(input.type==='number'&&!Number.isFinite(value))return;mutate(()=>{o[input.dataset.prop]=value;
 o.w=Math.max(20,Math.min(S.p.width,o.w));o.h=Math.max(20,Math.min(S.p.height,o.h));o.x=Math.max(0,Math.min(S.p.width-o.w,o.x));o.y=Math.max(0,Math.min(S.p.height-o.h,o.y));o.fontSize=Math.max(8,Math.min(120,o.fontSize));o.digits=Math.max(0,Math.min(6,o.digits));});});
}
function drawStage(){
 const stage=$('#stage');if(!stage)return;const screen=current(),values=R.initial(S.p);
 Object.assign(stage.style,{width:S.p.width+'px',height:S.p.height+'px',backgroundColor:screen.background,transform:`scale(${S.zoom})`});stage.classList.toggle('grid',S.grid);
 const wrap=$('#canvas-wrap');wrap.style.width=S.p.width*S.zoom+'px';wrap.style.height=S.p.height*S.zoom+'px';stage.replaceChildren();
 for(const o of screen.objects){const n=R.widget(o,S.p);R.refreshWidget(n,o,S.p,values,true,true);if(o.id===S.selected){n.classList.add('selected');n.append(el('span','resize-handle'));}n.onpointerdown=e=>startDrag(e,o,n);stage.append(n);}
 if(!screen.objects.length){const hint=el('div','empty-canvas');hint.append(el('strong','','Tu primera pantalla'),el('span','','Arrastra un objeto desde la biblioteca'));stage.append(hint);}
 stage.onpointerdown=e=>{if(e.target===stage){S.selected=null;drawStage();inspector();}};
 stage.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';};stage.ondrop=async e=>{e.preventDefault();const rect=stage.getBoundingClientRect(),x=(e.clientX-rect.left)/S.zoom,y=(e.clientY-rect.top)/S.zoom;
 if(e.dataTransfer.files.length){await importImages(e.dataTransfer.files,x,y);return;}
 try{const data=JSON.parse(e.dataTransfer.getData('application/x-hmi-nx'));addObject(data.kind,x,y,data.assetId||'');}catch{toast('Arrastra un objeto de la biblioteca o una imagen.');}};
}
function startDrag(e,o,n){
 if(e.button!==0)return;e.preventDefault();e.stopPropagation();S.selected=o.id;$('#stage').querySelectorAll('.selected').forEach(x=>{x.classList.remove('selected');x.querySelector('.resize-handle')?.remove();});n.classList.add('selected');
 const resizing=e.target.classList.contains('resize-handle');if(!n.querySelector('.resize-handle'))n.append(el('span','resize-handle'));inspector();
 const start={x:o.x,y:o.y,w:o.w,h:o.h,cx:e.clientX,cy:e.clientY};let moved=false;
 const move=ev=>{const dx=(ev.clientX-start.cx)/S.zoom,dy=(ev.clientY-start.cy)/S.zoom;if(!moved&&Math.abs(dx)+Math.abs(dy)<2)return;if(!moved){checkpoint();moved=true;}
 const snap=v=>S.grid?Math.round(v/10)*10:Math.round(v);
 if(resizing){o.w=Math.max(20,Math.min(S.p.width-o.x,snap(start.w+dx)));o.h=Math.max(20,Math.min(S.p.height-o.y,snap(start.h+dy)));}
 else{o.x=Math.max(0,Math.min(S.p.width-o.w,snap(start.x+dx)));o.y=Math.max(0,Math.min(S.p.height-o.h,snap(start.y+dy)));}
 Object.assign(n.style,{left:o.x+'px',top:o.y+'px',width:o.w+'px',height:o.h+'px'});};
 const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);if(moved)autosave();drawStage();inspector();};
 document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
}
function designer(){
 const p=S.p,s=current();
 $('#main').innerHTML=`<div class="designer"><aside class="sidebar"><section class="panel-section"><h2 class="section-title">Pantallas <button data-action="add-screen" title="Añadir pantalla">＋</button></h2><div class="screens">${p.screens.map(a=>`<div class="screen-item"><button data-screen="${esc(a.id)}" class="${a.id===s.id?'active':''}">▣ ${esc(a.name)}</button><button class="mini" data-rename-screen="${esc(a.id)}" title="Renombrar">✎</button></div>`).join('')}</div><div class="row-actions" style="margin-top:10px"><button class="mini" data-action="duplicate-screen">Duplicar</button><button class="mini" data-action="delete-screen">−</button></div></section>
 <section class="panel-section"><h2 class="section-title">Biblioteca de objetos</h2><div class="tools">${C.KINDS.map(k=>`<button class="tool" draggable="true" data-kind="${k}"><b>${labels[k][0]}</b>${labels[k][1]}</button>`).join('')}</div><p class="hint">Arrastra al lienzo o pulsa para añadir.</p></section>
 <section class="panel-section"><h2 class="section-title">Imágenes <button data-action="add-image" title="Subir imagen">＋</button></h2><div class="asset-list">${p.assets.map(a=>`<div class="asset-card" draggable="true" data-asset="${esc(a.id)}"><img src="${a.data}" alt=""><span>${esc(a.name)}</span></div>`).join('')}</div><p class="hint">PNG, JPG, WebP y SVG convertido a PNG. Incluidas en el proyecto.</p></section>
 <section class="panel-section"><h2 class="section-title">Variables · ${p.variables.length}/100</h2>${p.variables.slice(0,8).map(v=>`<span class="tag-chip" title="${esc(v.name)}">${esc(v.name)} · ${v.type}</span>`).join('')}<button data-go="variables">Gestionar variables</button></section></aside>
 <section class="workspace"><div class="canvas-toolbar"><button data-action="undo" title="Deshacer (Ctrl+Z)" ${S.history.length?'':'disabled'}>↶</button><button data-action="redo" title="Rehacer" ${S.future.length?'':'disabled'}>↷</button><button data-action="duplicate">Duplicar</button><button data-action="delete" class="danger">Borrar</button><button data-action="front" title="Traer al frente">↑</button><button data-action="back" title="Enviar al fondo">↓</button><span class="spacer"></span><label><input id="snap" type="checkbox" ${S.grid?'checked':''}>Rejilla</label><select id="zoom" aria-label="Zoom">${options([['0.25','25 %'],['0.5','50 %'],['0.75','75 %'],['1','100 %'],['1.25','125 %']],String(S.zoom))}</select><button data-action="fit">Ajustar</button></div><div class="canvas-scroll"><div class="canvas-wrap" id="canvas-wrap"><div id="stage" class="nx-stage editor-stage"></div></div></div></section><aside class="inspector" id="inspector"></aside></div>`;
 $('#snap').onchange=e=>{S.grid=e.target.checked;drawStage();};$('#zoom').onchange=e=>{S.zoom=Number(e.target.value);drawStage();};
 $('#main').querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>{S.screen=b.dataset.screen;S.selected=null;render();});
 $('#main').querySelectorAll('[data-rename-screen]').forEach(b=>b.onclick=()=>{const s=p.screens.find(s=>s.id===b.dataset.renameScreen),name=prompt('Nombre de pantalla',s.name);if(name?.trim())mutate(()=>s.name=name.trim().slice(0,80));});
 $('#main').querySelectorAll('[data-kind]').forEach(b=>{b.onclick=()=>addObject(b.dataset.kind);b.ondragstart=e=>e.dataTransfer.setData('application/x-hmi-nx',JSON.stringify({kind:b.dataset.kind}));});
 $('#main').querySelectorAll('[data-asset]').forEach(b=>{b.ondragstart=e=>e.dataTransfer.setData('application/x-hmi-nx',JSON.stringify({kind:'image',assetId:b.dataset.asset}));b.ondblclick=()=>addObject('image',40,40,b.dataset.asset);});
 drawStage();inspector();
}
function render(){
 if(!S.p.screens.some(s=>s.id===S.screen))S.screen=S.p.screens[0].id;
 $('#project-name').value=S.p.name;$('#tag-count').textContent=S.p.variables.length;$('#project-summary').textContent=`${S.p.screens.length} pantallas · ${S.p.variables.length} variables · ${S.p.recipes.length} recetas · ${S.p.alarms.length} alarmas · ${S.p.width} × ${S.p.height}`;
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===S.tab));
 if(S.tab==='editor')designer();else NXPanels.render(S.tab,A);
}
async function useProject(p){await saveNow();S.p=p;S.screen=p.screens[0].id;S.selected=null;S.recipe=null;S.history=[];S.future=[];S.tab='editor';render();autosave();}
async function importImages(files,x=40,y=40){
 for(const f of [...files]){try{
 if(!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(f.type)||f.size>4*1024*1024)throw new Error('Imagen no compatible o mayor de 4 MB');
 if(f.type==='image/svg+xml'){
 const text=await f.text(),doc=new DOMParser().parseFromString(text,'image/svg+xml');
 if(doc.querySelector('parsererror,script,foreignObject,iframe,object,embed')||/<!ENTITY|<!DOCTYPE/i.test(text))throw new Error('SVG no permitido');
 for(const n of doc.querySelectorAll('*'))for(const a of n.attributes){if(/^on/i.test(a.name)||(/href$/i.test(a.name)&&!a.value.startsWith('#')&&!/^data:image\/(png|jpeg|webp);base64,/.test(a.value)))throw new Error('SVG con referencias externas o eventos');}
 if(/url\s*\(\s*["']?(?!#)/i.test(text))throw new Error('SVG con recursos CSS no permitidos');
 }
 const url=URL.createObjectURL(f),img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('No se pudo decodificar la imagen'));img.src=url;});
 if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>64000000)throw new Error('Dimensiones de imagen no válidas');
 const scale=Math.min(1,2048/img.naturalWidth,2048/img.naturalHeight),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
 const data=canvas.toDataURL('image/png');if(data.length>6*1024*1024||S.p.assets.reduce((n,a)=>n+a.data.length,0)+data.length>12*1024*1024)throw new Error('Límite de imágenes: 6 MB por recurso / 12 MB total');
 const a={id:C.id(),name:f.name,data,width:canvas.width,height:canvas.height};mutate(()=>S.p.assets.push(a));const o=selected();if(o?.kind==='image'&&!o.assetId)mutate(()=>o.assetId=a.id);else addObject('image',x,y,a.id);
 }finally{URL.revokeObjectURL(url);}
 }catch(e){toast(`${f.name}: ${e.message}`);}}
}
function preview(real=false){
 const errors=C.validate(S.p);if(errors.length){modal('Revisa el proyecto',`<p>Completa estos puntos antes de ejecutar:</p><div class="error-list">${esc(errors.join('\n'))}</div>`);return;}
 if(real&&S.p.connection.profile!=='nx-http-v1'){toast('Selecciona el perfil NX HTTP v1 en Conexión NX. Requiere adaptador.');return;}
 modal(real?'Runtime · prueba de adaptador NX':'Simulación · sin conexión al PLC',`<div id="preview-host"></div>${real?'':`<details><summary style="margin-top:18px;cursor:pointer">Modificar variables del simulador</summary><div class="sim-grid">${S.p.variables.map(v=>`<label>${esc(v.name)} · ${v.type}${v.type==='BOOL'?`<select data-sim="${esc(v.name)}">${options([['false','FALSE'],['true','TRUE']],String(v.initial))}</select>`:`<input data-sim="${esc(v.name)}" type="${v.type==='STRING'?'text':'number'}" step="any" value="${esc(v.initial)}">`}</label>`).join('')}</div></details>`}`,true);
 const runtimeProject=C.copy(S.p);if(real)runtimeProject.connection.sameOrigin=false;
 S.runtime=new R.Runtime(runtimeProject,$('#preview-host'),{simulate:!real});
 $('#modal-body').querySelectorAll('[data-sim]').forEach(input=>input.onchange=()=>{try{S.runtime.setSim(input.dataset.sim,input.value);}catch(e){toast(e.message);}});
}
async function exportSD(){
 const errors=C.validate(S.p);if(errors.length){modal('No se puede exportar todavía',`<div class="error-list">${esc(errors.join('\n'))}</div>`);return;}
 modal('Exportar proyecto para SD',`<p><strong>${esc(S.p.name)}</strong> · ${S.p.connection.profile==='simulation'?'runtime de SIMULACIÓN':'runtime para adaptador NX HTTP v1'}</p><div class="warning">Este exportador no instala un FB ni implementa el protocolo de WebServer_NJ_NX. El perfil NX HTTP v1 requiere el adaptador descrito en el paquete. Ninguna conexión real se considera validada por exportar.</div><p>Incluye un HTML autocontenido, el proyecto editable, la tabla de variables y el contrato de comunicaciones. No necesita Internet durante la ejecución.</p><div class="modal-actions"><button id="download-export" class="primary">Generar y descargar ZIP</button></div>`);
 $('#download-export').onclick=async()=>{
 const b=$('#download-export');b.disabled=true;b.textContent='Generando…';
 try{
 const p=C.copy(S.p),sources=await Promise.all(['style.css','core.js','runtime.js'].map(async path=>{const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error('No se pudo cargar '+path);return r.text();}));
 const safe=JSON.stringify(p).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${esc(p.name)}</title><style>${sources[0]}</style></head><body style="padding:12px"><div id="hmi"></div><script>${sources[1]}\n${sources[2]}\nconst project=${safe};new NXRuntime.Runtime(project,document.getElementById('hmi'));<\/script></body></html>`;
 const guide=`HMI NX — exportación 0.1\n\nPerfil: ${p.connection.profile}\n\nSD/index.html es autocontenido. Servir desde el servidor HTTP del NX en la ruta admitida por su FB. No existe despliegue automático ni se incluye el FB.\n\nSIMULACIÓN: las variables son locales; no se conecta al PLC.\nNX HTTP v1: contrato propio /api/hmi/read y /api/hmi/write; NO compatible por defecto con WebServer_NJ_NX v3.5. Debe implementar/validar el adaptador y mapear explícitamente variables. Importar CSV no crea vínculos mágicos con memoria PLC.\n\nNo incluye históricos/ACK de alarmas en PLC: son locales a la sesión del navegador. Recetas: lote atómico debe validarse y aplicarse en PLC; jamás aceptar lotes parciales. No usar esta preview para funciones de seguridad, parada de emergencia ni jog mantenido. No exponer el PLC a Internet. HTTPS editor -> HTTP PLC puede estar bloqueado: abra el runtime desde el NX.\n\nEl periodo configurado es un objetivo de polling, no una garantía de tiempo real. Ensayar caída de red, datos obsoletos, reconexión, rangos y latencias en NX102 real. El exportado arranca sin escrituras habilitadas; hay que habilitarlas expresamente cada sesión.\n`;
 const files={'SD/index.html':html,'project.nxhmi':JSON.stringify(p,null,2),'Sysmac/variables.csv':C.mappingCSV(p),'Sysmac/transport-contract.json':JSON.stringify(C.apiContract,null,2),'LEEME.txt':guide};
 download((p.name.replace(/[^A-Za-z0-9_-]/g,'_')||'HMI_NX')+'_SD.zip',C.zip(files),'application/zip');toast('ZIP generado: HTML + proyecto + variables + contrato.');b.textContent='Descargar de nuevo';b.disabled=false;
 }catch(e){toast(e.message);b.textContent='Reintentar';b.disabled=false;}
 };
}
const actions={
 'close-modal':closeModal,'preview':()=>preview(false),'export':exportSD,'add-image':()=>$('#image-file').click(),
 'save':()=>{saveNow();download(S.p.name.replace(/[^A-Za-z0-9_-]/g,'_')+'.nxhmi',JSON.stringify(S.p,null,2));},
 'open':()=>$('#project-file').click(),
 'new':()=>{modal('Nuevo proyecto',`<p>El proyecto actual queda guardado en este navegador.</p><div class="modal-actions"><button id="new-demo">Cargar demo</button><button id="new-empty" class="primary">Proyecto vacío</button></div>`);$('#new-demo').onclick=()=>{closeModal();useProject(C.demoProject());};$('#new-empty').onclick=()=>{closeModal();useProject(C.newProject());};},
 'add-screen':()=>{const name=prompt('Nombre de pantalla','Pantalla '+(S.p.screens.length+1));if(name?.trim()&&S.p.screens.length<50)mutate(()=>{const s={id:C.id(),name:name.trim().slice(0,80),background:'#101c2c',objects:[]};S.p.screens.push(s);S.screen=s.id;S.selected=null;});},
 'duplicate-screen':()=>mutate(()=>{const s=C.copy(current()),old=s.id;s.id=C.id();s.name+=' copia';s.objects.forEach(o=>{o.id=C.id();if(o.targetScreen===old)o.targetScreen=s.id;});S.p.screens.push(s);S.screen=s.id;S.selected=null;}),
 'delete-screen':()=>{if(S.p.screens.length===1){toast('Debe quedar una pantalla.');return;}if(confirm('¿Eliminar esta pantalla y sus objetos?'))mutate(()=>{const removed=S.screen;S.p.screens=S.p.screens.filter(s=>s.id!==removed);S.screen=S.p.screens[0].id;for(const s of S.p.screens)for(const o of s.objects)if(o.targetScreen===removed)o.targetScreen=S.screen;S.selected=null;});},
 'duplicate':()=>{const o=selected();if(o)mutate(()=>{const a=C.copy(o);a.id=C.id();a.x=Math.min(S.p.width-a.w,a.x+20);a.y=Math.min(S.p.height-a.h,a.y+20);current().objects.push(a);S.selected=a.id;});},
 'delete':()=>{if(selected())mutate(()=>{current().objects=current().objects.filter(o=>o.id!==S.selected);S.selected=null;});},
 'front':()=>{const o=selected();if(o)mutate(()=>{current().objects=current().objects.filter(a=>a!==o);current().objects.push(o);});},
 'back':()=>{const o=selected();if(o)mutate(()=>{current().objects=current().objects.filter(a=>a!==o);current().objects.unshift(o);});},
 'undo':()=>{if(S.history.length){S.future.push(JSON.stringify(S.p));S.p=JSON.parse(S.history.pop());S.selected=null;autosave();render();}},
 'redo':()=>{if(S.future.length){S.history.push(JSON.stringify(S.p));S.p=JSON.parse(S.future.pop());S.selected=null;autosave();render();}},
 'fit':()=>{S.zoom=Math.max(.15,Math.min(1,($('.canvas-scroll').clientWidth-56)/S.p.width));drawStage();}
};
const A={S,C,R,$,esc,el,toast,modal,closeModal,options,mutate,render,download,store,useProject,preview,saveNow};rootExpose();function rootExpose(){window.NXApp=A;}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&actions[b.dataset.action]){Promise.resolve(actions[b.dataset.action]()).catch(err=>toast(err.message));return;}const tab=e.target.closest('[data-tab],[data-go]');if(tab){S.tab=tab.dataset.tab||tab.dataset.go;render();}});
$('#project-name').onchange=e=>{const name=e.target.value.trim();if(name)mutate(()=>S.p.name=name.slice(0,100));};
$('#modal').addEventListener('cancel',e=>{e.preventDefault();closeModal();});
$('#project-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>20*1024*1024)throw new Error('Proyecto mayor de 20 MB');const p=C.parseProject(await f.text(),false);await useProject(p);toast('Proyecto cargado.');}catch(err){toast(err.message);}e.target.value='';};
$('#image-file').onchange=async e=>{await importImages(e.target.files);e.target.value='';};
document.addEventListener('keydown',e=>{if($('#modal').open||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;const cmd=e.ctrlKey||e.metaKey;if(cmd&&e.key.toLowerCase()==='z'){e.preventDefault();actions[e.shiftKey?'redo':'undo']();}else if(cmd&&e.key.toLowerCase()==='s'){e.preventDefault();actions.save();}else if(cmd&&e.key.toLowerCase()==='d'&&S.tab==='editor'){e.preventDefault();actions.duplicate();}else if(e.key==='Delete'&&S.tab==='editor'){e.preventDefault();actions.delete();}else if(S.tab==='editor'&&selected()&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const o=selected(),step=e.shiftKey?10:1;mutate(()=>{o.x=Math.max(0,Math.min(S.p.width-o.w,o.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0)));o.y=Math.max(0,Math.min(S.p.height-o.h,o.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)));});}});
window.addEventListener('pagehide',()=>{if(S.runtime)S.runtime.stop();});
(async()=>{try{const active=localStorage.getItem('HMI_NX_active');if(active){const row=await store('readonly',s=>s.get(active));if(row?.project){S.p=C.parseProject(JSON.stringify(row.project),false);S.screen=S.p.screens[0].id;}}}catch(e){toast('Guardado local no disponible: '+e.message);}render();})();
})();
