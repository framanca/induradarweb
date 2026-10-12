(function(root){'use strict';const C=root.NXST;
function htmlEscapeText(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\$/g,'&#36;').replace(/[^\x00-\x7F]/g,c=>'&#'+c.codePointAt(0)+';');}
function asciiJSON(x){return JSON.stringify(x).replace(/</g,'\\u003c').replace(/'/g,'\\u0027').replace(/\$/g,'\\u0024').replace(/[^\x00-\x7F]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));}
function buildRuntimeHTML(input){
 const p=C.normalize(input),vars=p.variables.filter(v=>v.expose&&v.live).map(v=>({id:v.id,name:v.name,type:v.type,access:v.access,stringLength:v.stringLength||255,enumType:v.enumType||'',enumValues:v.enumValues||null}));
 const screens=p.screens.map(s=>({id:s.id,name:s.name,number:s.number,background:s.background,objects:C.screenObjects(p,s).map(o=>({kind:o.kind,x:o.x,y:o.y,w:o.w,h:o.h,text:o.text,fontSize:o.fontSize??null,binding:o.binding,assetId:o.assetId||'',assetOnId:o.assetOnId||'',symbolType:o.symbolType||'lamp',...(o.kind==='status'?{lampOnColor:o.lampOnColor||'#86efac'}:{}),stateOnWhen:o.stateOnWhen||'true',actionType:o.actionType||'write',targetScreenId:o.targetScreenId||'',actionMode:o.actionMode||'set',confirmationText:o.confirmationText||'',expressionText:o.expressionText||'',expressionColor:o.expressionColor||'',expressionBackground:o.expressionBackground||'',expressionVisible:o.expressionVisible||'',feedbackBinding:o.feedbackBinding||'',feedbackColorOff:o.feedbackColorOff||'#2563eb',feedbackColorOn:o.feedbackColorOn||'#16a34a',...(o.kind==='button'?{feedbackTextOff:o.feedbackTextOff||'',feedbackTextOn:o.feedbackTextOn||''}:{}),...(o.kind==='shape'?{shapeType:o.shapeType||'rect',shapeFill:o.shapeFill||'#bfdbfe',shapeStroke:o.shapeStroke||'#1e40af',shapeStrokeWidth:o.shapeStrokeWidth??3,shapePoints:o.shapePoints||''}:{}),decimals:Number.isInteger(Number(o.decimals))?Number(o.decimals):2,inputMin:o.inputMin??null,inputMax:o.inputMax??null,min:o.min,max:o.max,step:o.step,optionsText:o.optionsText,unit:o.unit,target:o.target}))}));
 const assets=p.assets.map(a=>({id:a.id,name:a.name,data:a.data}));
 const internalAlarmNames=new Set(p.internalVariables.map(v=>v.name));
 const alarms=p.alarms.map((a,i)=>({wireId:i+1,id:a.id,name:a.name,binding:a.binding,operator:a.operator,value:a.value,severity:a.severity||'warning',local:internalAlarmNames.has(a.binding)}));
 const recipes=p.recipes.map(r=>({id:r.id,name:r.name,scope:r.scope,values:r.values}));
 // All exposed writable PLC tags and HMI internals are selectable in runtime,
 // even if no initial recipe references them.
 const recipeFields=[
  ...p.variables.filter(v=>v.expose&&v.live&&v.access==='RW'&&v.writeSupported).map(v=>({name:v.name,type:v.type,source:'PLC',stringLength:v.stringLength||255})),
  ...p.internalVariables.filter(v=>v.name).map(v=>({name:v.name,type:v.type,source:'HMI',stringLength:v.stringLength||255}))
 ];
 const payload=asciiJSON({name:p.name,pollMs:+p.pollMs,keyboardMode:p.keyboardMode,screenBinding:p.screenBinding,width:+p.width,height:+p.height,minDisplayWidth:Number(p.minDisplayWidth??480),maxDisplayWidth:Number(p.maxDisplayWidth??1920),vars,internals:p.internalVariables.map(v=>({name:v.name,type:v.type,value:v.value})),screens,assets,alarms,recipes,recipeFields,recipeKey:p.recipeKey});
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+htmlEscapeText(p.name)+'</title><style>'+runtimeCSS()+(p.keyboardMode==='webhmi'?virtualKeyboardCSS():'')+'</style></head><body><header><strong>'+htmlEscapeText(p.name)+'</strong><div class="head-actions"><span id="status">Conectando</span></div></header><nav id="nav" aria-label="Navegaci&#243;n HMI"><label for="screenSelect">Pantalla</label><select id="screenSelect" aria-label="Seleccionar pantalla"></select><button type="button" id="recipeOpen" aria-haspopup="dialog" aria-controls="recipeWindow">Recetas</button><button type="button" id="alarmOpen" aria-haspopup="dialog" aria-controls="alarmWindow">Alarmas <span id="alarmCount">0</span></button><div id="alarmbar" role="button" tabindex="0" aria-label="Alarmas activas"></div></nav><div id="recipes"></div><main id="viewport"><div id="fit"><div id="stage"></div></div></main><div id="alarmWindow" class="alarm-window" hidden><div class="alarm-card"><div class="alarm-title"><strong>Alarmas</strong><button id="alarmClose">X</button></div><div class="alarm-actions"><button type="button" id="ackAll">Reconocer todas las activas</button></div><div id="alarmList"></div></div></div><div id="recipeWindow" class="recipe-window" role="dialog" aria-modal="true" aria-label="Gestor de recetas" hidden><div class="recipe-card"><div class="recipe-head"><strong>Gestor de recetas</strong><button id="recipeClose" aria-label="Cerrar recetas">X</button></div><div class="recipe-body"><div class="recipe-toolbar"><label>Receta<select id="recipeSelect" aria-label="Seleccionar receta"></select></label><button id="recipeRefresh" type="button">Actualizar NX</button></div><div class="recipe-grid"><label>Nombre<input id="recipeName" maxlength="48" placeholder="Nombre de receta"></label><label>Almacenamiento<select id="recipeScope"><option value="shared">Compartida NX (Retain)</option><option value="local">Solo este navegador</option></select></label></div><p class="recipe-help">Marca las variables incluidas. Los valores de la derecha son los actuales; guardar no modifica la m&#225;quina. Las variables HMI son locales al navegador.</p><div id="recipeFieldList" class="recipe-fields" role="group" aria-label="Par&#225;metros de receta"></div><p id="recipeMessage" class="recipe-message" role="status" aria-live="polite"></p><div class="recipe-actions"><button id="recipeApply" type="button">Aplicar</button><button id="recipeSave" type="button">Guardar</button><button id="recipeNew" type="button">Nueva</button><button id="recipeCapture" type="button">Capturar valores actuales</button><button id="recipeDuplicate" type="button">Duplicar</button><button id="recipeDelete" type="button">Eliminar</button><button id="recipeExport" type="button">Exportar JSON</button><button id="recipeImport" type="button">Importar JSON</button><input id="recipeImportFile" type="file" accept=".json,application/json" hidden></div><p class="recipe-help">Guardar compartidas modifica el banco Retain del NX. Aplicar escribe consignas secuencialmente; no garantiza cambio simult&#225;neo. Requiere el mismo control de acceso de red que las escrituras PLC.</p></div></div></div><div id="popupWindow" class="popup-window" role="dialog" aria-modal="true" aria-label="Ventana HMI" hidden><div class="popup-card"><div class="popup-header"><strong id="popupTitle">Detalles</strong><button id="popupClose" aria-label="Cerrar ventana">X</button></div><div id="popupFit"><div id="popupStage"></div></div></div></div>'+(p.keyboardMode==='webhmi'?virtualKeyboardMarkup():'')+'<script>const P='+payload+';'+runtimeJS()+(p.keyboardMode==='webhmi'?virtualKeyboardJS().replace(/[^\x00-\x7F]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')):'')+'</script></body></html>';
}
function runtimeCSS(){return '*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#111827;font-family:Arial,sans-serif;color:#111}body{height:100dvh;min-height:0;overflow:hidden;display:flex;flex-direction:column}body>header,#nav,#recipes{flex-shrink:0}header{height:46px;background:#101828;color:white;display:flex;align-items:center;justify-content:space-between;padding:0 14px}header span{font-size:12px}.head-actions{display:flex;align-items:center;gap:10px}#nav,#recipes{display:flex;gap:8px;align-items:center;padding:8px 12px;background:#1f2937;overflow-x:auto}#nav{overflow-x:visible;flex-wrap:nowrap}#nav label{font-size:13px;color:#e5e7eb;white-space:nowrap}#screenSelect{min-width:180px;max-width:min(55vw,360px);height:38px;border:1px solid #64748b;border-radius:6px;padding:5px 10px;background:#374151;color:#fff;font-size:14px;cursor:pointer}#nav button,#recipes button{border:0;border-radius:6px;padding:7px 11px;min-height:38px;background:#374151;color:white;white-space:nowrap;cursor:pointer}#nav button.active{background:#b91c1c}#nav button:disabled,#stage .button .in:disabled{opacity:.55;cursor:not-allowed}@media(max-width:520px){#nav{gap:6px;padding:8px}#screenSelect{min-width:0;max-width:none;flex:0 1 150px;width:120px}#nav button{flex-shrink:0}#alarmbar{padding:0 8px;font-size:11px}}#recipes{background:#0f172a}#recipes:empty{display:none}.recipe-window{position:fixed;inset:0;background:#0009;z-index:1100;display:flex;align-items:center;justify-content:center;padding:12px}.recipe-window[hidden]{display:none}.recipe-card{display:flex;flex-direction:column;background:#fff;border-radius:10px;width:min(900px,98vw);max-height:94dvh;overflow:hidden;box-shadow:0 20px 48px #0007}.recipe-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#111827;color:#fff}.recipe-head button{background:#374151;color:#fff;border:0;border-radius:5px;padding:6px 10px}.recipe-body{overflow:auto;min-height:0;padding:13px 16px}.recipe-body button{padding:8px 10px;border-radius:5px;border:1px solid #cbd5e1;cursor:pointer;background:#e2e8f0;color:#111827}.recipe-body button:disabled{opacity:.45;cursor:not-allowed}.recipe-body input,.recipe-body select{box-sizing:border-box;min-height:37px;padding:7px;border:1px solid #94a3b8;border-radius:5px;background:white;color:#111827;max-width:100%}.recipe-body label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;min-width:0}.recipe-toolbar,.recipe-grid{display:flex;gap:9px;margin:9px 0;align-items:end;flex-wrap:wrap}.recipe-toolbar label,.recipe-grid label{flex:1 1 190px}.recipe-help{font-size:12px;color:#475569;margin:7px 0}.recipe-fields{border:1px solid #cbd5e1;border-radius:6px;overflow:auto;max-height:min(46vh,420px)}.recipe-field{display:grid;grid-template-columns:minmax(150px,1.6fr) minmax(115px,1fr) minmax(105px,1fr);align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #e2e8f0}.recipe-field:last-child{border-bottom:0}.recipe-field .recipe-check{display:flex;flex-direction:row;align-items:center;gap:7px;font-size:12px;overflow-wrap:anywhere}.recipe-field input[type=checkbox]{min-height:0;accent-color:#2563eb}.recipe-field .recipe-live{font-family:monospace;color:#475569;font-size:12px;overflow-wrap:anywhere}.recipe-field .recipe-val{width:100%}.recipe-message{font-size:13px;min-height:18px;color:#0f4c81;margin:8px 0;white-space:pre-wrap}.recipe-actions{display:flex;gap:7px;flex-wrap:wrap}.recipe-actions #recipeApply{background:#2563eb;border-color:#2563eb;color:white}.recipe-actions #recipeDelete{color:#b91c1c}@media(max-width:500px){.recipe-field{grid-template-columns:1fr 1fr;gap:5px}.recipe-field .recipe-check{grid-column:span 2}.recipe-card{max-height:98dvh}.recipe-body{padding:8px}}#alarmbar{height:38px;min-width:0;flex:1 1 auto;display:flex;align-items:center;padding:0 12px;border-radius:6px;background:#7f1d1d;color:white;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;visibility:hidden}#alarmbar.show{visibility:visible;cursor:pointer}.alarm-window{position:fixed;inset:0;background:#0008;z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:64px 14px 14px}.alarm-window[hidden]{display:none}.alarm-card{width:min(760px,96vw);max-height:75vh;overflow:auto;background:white;border-radius:10px;box-shadow:0 20px 50px #0006}.alarm-title{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#111827;color:white;z-index:1}.alarm-title button{border:0;border-radius:5px;background:#374151;color:white;padding:5px 9px}.alarm-row{display:grid;grid-template-columns:82px 1fr minmax(180px,1fr);gap:8px;padding:10px 12px;border-bottom:1px solid #e5e7eb;align-items:center}.alarm-row.active{background:#fef2f2}.alarm-state{font-weight:bold}.alarm-state.on{color:#b91c1c}.alarm-cond{font-size:12px;color:#64748b}#viewport{width:100%;flex:1 1 auto;min-height:0;overflow:auto}#fit{position:relative;margin:0 auto}#stage{position:absolute;left:0;top:0;background:#f8fafc;transform-origin:top left}.o{position:absolute;overflow:hidden}.o.shape .shape-visual{width:100%;height:100%;pointer-events:none}.o.shape .shape-visual svg{display:block;width:100%;height:100%}.in{width:100%;height:100%;display:flex;align-items:center;justify-content:center}.text .in{justify-content:flex-start;text-align:left}.lamp .in{border-radius:50%;background:#94a3b8;border:3px solid #334155}.lamp.on .in{background:#22c55e}.value .in,.input .in{background:white;border:1px solid #94a3b8;border-radius:5px}.input .in{padding:5px}.input input{min-width:0;width:100%;height:100%;border:0;font-size:18px}.input input[type="number"]{-moz-appearance:textfield;appearance:textfield}.input input[type="number"]::-webkit-outer-spin-button,.input input[type="number"]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}@keyframes input-dirty-blink{0%,100%{background:#fff7cc}50%{background:#facc15}}.input button,.button .in{background:#2563eb;color:white;border:0;border-radius:6px}.button .in{font-weight:bold}.bar .track{width:100%;height:100%;background:#e5e7eb}.bar .fill{height:100%;background:#16a34a;width:0}.image img{width:100%;height:100%;object-fit:contain}.status .status-visual{height:100%;width:100%;display:flex;align-items:center;justify-content:center}.status .status-visual svg{width:90%;height:90%;display:block}.industrial .symbol{width:70%;height:70%;position:relative;border:4px solid #475569;background:#cbd5e1}.tank .symbol{height:100%;width:70%;border-radius:0 0 18px 18px;overflow:hidden;background:#e2e8f0}.tank .level{position:absolute;left:0;right:0;bottom:0;height:0;background:#38bdf8}.comm-stale .status,.comm-stale .value,.comm-stale .bar,.comm-stale .tank,.comm-stale .image{opacity:.58}.write-pending .in{outline:2px solid #f59e0b;outline-offset:-2px}.write-error .in{outline:2px solid #dc2626;outline-offset:-2px}.input.input-dirty input{animation:input-dirty-blink .85s ease-in-out infinite}.input.write-pending input{animation:none;background:#fffbeb}.input.write-error input{animation:none;background:#fef2f2}.input.input-limit-error .in{outline:2px solid #dc2626;outline-offset:-2px}:is(#stage,#popupStage) .control-panel{display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:5px;width:100%;height:100%;padding:7px;background:#fff;border:1px solid #94a3b8;border-radius:6px;font-size:14px}:is(#stage,#popupStage) .control-panel input[type=range]{width:100%;accent-color:#2563eb}:is(#stage,#popupStage) .control-panel .controls{display:flex;align-items:center;justify-content:center;gap:8px}:is(#stage,#popupStage) .control-panel .controls button{flex:0 0 36px;height:34px;border:0;border-radius:5px;background:#2563eb;color:#fff}:is(#stage,#popupStage) .control-panel select{width:100%;height:35px;border:1px solid #94a3b8;background:#fff}:is(#stage,#popupStage) .control-panel .reading{font-size:20px;font-weight:700;text-align:center}:is(#stage,#popupStage) .control-panel .limits{display:flex;justify-content:space-between;font-size:11px;color:#64748b}:is(#stage,#popupStage) .control-panel .switch-button{height:37px;border:0;border-radius:18px;background:#64748b;color:white;font-weight:700}:is(#stage,#popupStage) .control-panel .switch-button.on{background:#16a34a}:is(#stage,#popupStage) .control-panel .gauge-track{height:10px;background:#e2e8f0;border-radius:6px;overflow:hidden}:is(#stage,#popupStage) .control-panel .gauge-ring{width:min(100%,115px);aspect-ratio:1;border-radius:50%;background:conic-gradient(#16a34a var(--pct,0%),#e2e8f0 0);margin:0 auto;display:flex;align-items:center;justify-content:center}:is(#stage,#popupStage) .control-panel .gauge-ring .reading{width:75%;height:75%;display:flex;align-items:center;justify-content:center;background:white;border-radius:50%;font-size:18px}:is(#stage,#popupStage) .control-panel .gauge-fill{height:100%;background:#16a34a;width:0}:is(#stage,#popupStage) .control-panel .caption{font-size:11px;text-align:center;color:#475569}:is(#stage,#popupStage) .control-panel button:disabled,:is(#stage,#popupStage) .control-panel select:disabled,:is(#stage,#popupStage) .control-panel input:disabled{opacity:.55;cursor:not-allowed}:is(#stage,#popupStage) .selector .control-panel{padding:5px;gap:4px;justify-content:flex-start}:is(#stage,#popupStage) .selector .control-panel .caption{flex:0 0 auto;line-height:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}:is(#stage,#popupStage) .selector .selector-buttons{display:flex;flex:1 1 auto;min-height:0;flex-wrap:wrap;align-content:flex-start;gap:4px;overflow:auto;overscroll-behavior:contain}:is(#stage,#popupStage) .selector .selector-choice{flex:1 1 65px;min-width:56px;min-height:30px;padding:4px 7px;border:1px solid #94a3b8;border-radius:5px;background:#f1f5f9;color:#334155;font-weight:600;white-space:normal;overflow-wrap:anywhere;cursor:pointer;touch-action:manipulation}:is(#stage,#popupStage) .selector .selector-choice.active{background:#2563eb;border-color:#1d4ed8;color:#fff;box-shadow:inset 0 0 0 1px #1d4ed8}:is(#stage,#popupStage) .selector .selector-choice:focus-visible{outline:2px solid #0ea5e9;outline-offset:1px}:is(#stage,#popupStage) .selector .selector-choice:disabled{opacity:.6;cursor:not-allowed}:is(#stage,#popupStage) .selector .selector-choice.active:disabled{opacity:.85}.input.input-limit-error input{animation:none;background:#fef2f2}#status.comm-online{color:#86efac}#status.comm-degraded,#status.comm-reconnecting{color:#fde68a}#status.comm-offline{color:#fca5a5}.dynamicText .in{justify-content:flex-start;padding:4px 8px;font-weight:600}.alarm-row{grid-template-columns:100px 1fr minmax(100px,1fr) 94px}.alarm-row .ack-one{padding:7px 8px;border:1px solid #93c5fd;border-radius:5px;background:#eff6ff;color:#1d4ed8;cursor:pointer}.alarm-row .ack-one:disabled{opacity:.45;cursor:default}.alarm-actions{padding:9px 12px;border-bottom:1px solid #e2e8f0}.alarm-actions button{padding:7px 10px;border:0;border-radius:5px;background:#2563eb;color:#fff;cursor:pointer}.alarm-actions button:disabled{opacity:.4;cursor:default}.popup-window{position:fixed;inset:0;z-index:1100;background:#000a;display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto}.popup-window[hidden]{display:none}.popup-card{max-width:100%;max-height:100%;overflow:auto;border-radius:10px;background:#fff;box-shadow:0 18px 55px #0008}.popup-header{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;background:#0f172a;color:#fff;font-size:14px}.popup-header button{border:0;border-radius:5px;padding:5px 10px;background:#475569;color:#fff;cursor:pointer}#popupFit{position:relative;overflow:hidden}#popupStage{position:absolute;inset:0;transform-origin:top left}@media(max-width:700px){.alarm-row{grid-template-columns:90px 1fr 88px}.alarm-cond{display:none}}';}
function runtimeJS(){return `
${C.defaultShapePoints.toString()}
${C.shapeCoordinates.toString()}
${C.shapeSvg.toString()}
const evaluateExpression=${root.NXExpressions?root.NXExpressions.evaluate.toString():"function(){return undefined}"};
const vals={},alarmVals={},ackVals={},internalVals=Object.create(null),pendingWrites=new Map();
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
 for(const el of node.querySelectorAll(".in,.label,.caption,.control-panel,.reading,.limits,input,select,button"))el.style.fontSize=px;
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
function makeTank(o){const n=E("div","o industrial tank"),s=E("div","symbol"),l=E("div","level");n.setAttribute("role","img");n.setAttribute("aria-label",o.text||"Deposito");s.append(l);n.append(s);n.level=l;return n}
function optionsFor(o){return String(o.optionsText||'').split(/\\r?\\n/).map(x=>{const i=x.indexOf('=');return i<0?null:{value:x.slice(0,i).trim(),label:x.slice(i+1).split("|")[0].trim(),color:/^#[0-9a-fA-F]{6}$/.test(x.split("|")[1]||"")?x.split("|")[1]:""}}).filter(x=>x&&/^-?\\d+$/.test(x.value)&&x.label)}
function controlRange(o,v){const a=Number(o.min),b=Number(o.max);return Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a))}
function makeNode(o){let n;if(o.kind==="status")n=makeStatus(o);else if(o.kind==="tank")n=makeTank(o);else{n=E("div","o "+o.kind);if(o.kind==="text"||o.kind==="dynamicText"){const x=E("div","in");x.textContent=o.text;n.append(x)}else if(o.kind==="shape"){const visual=E("div","shape-visual");visual.innerHTML=shapeSvg(o.shapeType,o.shapeFill,o.shapeStroke,o.shapeStrokeWidth,o.shapePoints);n.append(visual)}else if(o.kind==="bar"){const t=E("div","track"),f=E("div","fill");t.append(f);n.append(t);n.fill=f}else if(o.kind==="image"){const img=E("img"),key=o.assetId||"";img.src=assets[key]||"";img.alt=o.text||"";n.append(img);n.image=img;n.imageKey=key}else if(["slider","switch","selector","multistate","gauge","stepper","counter","dropdown"].includes(o.kind)){const panel=E("div","control-panel");panel.setAttribute("role","group");panel.setAttribute("aria-label",o.text||o.kind);n.control={};const c=n.control;if(o.kind==="slider"){const reading=E("div","reading"),input=E("input"),limits=E("div","limits");input.type="range";input.min=o.min;input.max=o.max;input.step=o.step;limits.innerHTML="<span>"+o.min+"</span><span>"+o.max+"</span>";input.oninput=()=>{reading.textContent=input.value+(o.unit?" "+o.unit:"")};input.onchange=()=>{write(o.binding,input.value,{min:o.min,max:o.max,node:n})};panel.append(reading,input,limits);Object.assign(c,{reading,input})}else if(o.kind==="switch"){const button=E("button","switch-button");button.onclick=()=>write(o.binding,boolValue(currentValue(o.binding))?"0":"1",{node:n});panel.append(button);c.button=button}else if(o.kind==="selector"){const choices=E("div","selector-buttons");choices.setAttribute("role","group");choices.setAttribute("aria-label",o.text||"Selector");c.buttons=[];for(const option of optionsFor(o)){const button=E("button","selector-choice");button.type="button";button.textContent=option.label;button.value=option.value;button.setAttribute("aria-pressed","false");button.onclick=()=>{if(String(currentValue(o.binding)??"")!==option.value)write(o.binding,option.value,{node:n})};choices.append(button);c.buttons.push({button,value:option.value})}panel.append(choices)}else if(o.kind==="dropdown"){const input=E("select");for(const option of optionsFor(o)){const el=E("option");el.value=option.value;el.textContent=option.label;input.append(el)}input.onchange=()=>write(o.binding,input.value,{node:n});panel.append(input);c.input=input}else if(o.kind==="multistate"){const reading=E("div","reading");panel.append(reading);c.reading=reading}else if(o.kind==="stepper"){const ctr=E("div","controls"),minus=E("button"),reading=E("div","reading"),plus=E("button");minus.textContent="-";plus.textContent="+";const move=delta=>write(o.binding,String(Math.max(Number(o.min),Math.min(Number(o.max),Number(currentValue(o.binding)??o.min)+delta*Number(o.step)))),{min:o.min,max:o.max,node:n});minus.onclick=()=>move(-1);plus.onclick=()=>move(1);ctr.append(minus,reading,plus);panel.append(ctr);Object.assign(c,{minus,plus,reading})}else if(o.kind==="gauge"){const reading=E("div","reading"),ring=E("div","gauge-ring"),limits=E("div","limits");ring.append(reading);limits.innerHTML="<span>"+o.min+"</span><span>"+o.max+"</span>";panel.append(ring,limits);Object.assign(c,{reading,ring})}else if(o.kind==="counter"){const reading=E("div","reading"),target=E("div","caption"),progress=E("div","gauge-fill"),track=E("div","gauge-track");track.append(progress);target.textContent="Objetivo: "+o.target;panel.append(reading,target,track);Object.assign(c,{reading,target,progress})}n.append(panel)}else if(o.kind==="input"){const x=E("div","in"),i=E("input"),tag=byName[o.binding]||internalByName[o.binding];if(tag&&tag.type==="STRING"){i.type="text";i.maxLength=Math.min(512,Number(tag.stringLength)||255)}else if(tag&&["BYTE","WORD","DWORD","LWORD","LINT","ULINT","TIME","DATE","TIME_OF_DAY","DATE_AND_TIME"].includes(tag.type)){i.type="text";i.inputMode="text";i.maxLength=64}else{i.type="number";i.inputMode="decimal";i.step=tag&&(tag.type==="REAL"||tag.type==="LREAL")?"any":"1";if(o.inputMin!==null)i.min=String(o.inputMin);if(o.inputMax!==null)i.max=String(o.inputMax)}i.setAttribute("aria-label",o.text||"Entrada");n.inputDirty=false;const send=()=>{if(write(o.binding,i.value,{min:o.inputMin,max:o.inputMax,node:n})){n.inputDirty=false;paint()}};i.addEventListener("input",()=>{n.inputDirty=true;n.inputError="";paint()});if(P.keyboardMode==="webhmi"){i.readOnly=true;i.inputMode="none";i.setAttribute("aria-haspopup","dialog");const open=()=>{if(!widgetWritable(o.binding)){statusEl.textContent="ENTRADA | Variable no disponible para escritura";return}openVirtualKeyboard({title:o.text||o.binding||"Introducir valor",type:tag?.type||"STRING",value:i.value,maxLength:tag?.type==="STRING"?Math.min(512,Number(tag.stringLength)||255):64,onAccept:raw=>{if(!write(o.binding,raw,{min:o.inputMin,max:o.inputMax,node:n}))throw Error(n.inputError||"Valor no valido");i.value=raw;n.inputDirty=false;paint();}})};i.addEventListener("click",open);i.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open()}});}else{i.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();send()}})}x.append(i);n.append(x);n.entry=i}else if(o.kind==="button"){const b=E("button","in");b.textContent=o.text;b.style.backgroundColor=o.feedbackBinding?(o.feedbackColorOff||"#2563eb"):"#2563eb";if((o.actionType||"write")==="navigate"&&P.screenBinding){b.disabled=true;b.title="Navegacion controlada por PLC: "+P.screenBinding;}b.onclick=()=>{if((o.actionType||"write")==="navigate"){showScreenById(o.targetScreenId);return}if(o.actionType==="popup"){showPopup(o.targetScreenId);return}if(o.actionType==="closePopup"){hidePopup();return}if(o.confirmationText&&!confirm(o.confirmationText))return;const mode=o.actionMode||"set",next=mode==="reset"?false:mode==="toggle"?!boolValue(currentValue(o.binding)):true;write(o.binding,next?"1":"0")};n.append(b);n.button=b}else n.append(E("div","in"));}Object.assign(n.style,{left:o.x+"px",top:o.y+"px",width:o.w+"px",height:o.h+"px"});applyObjectFontSize(n,o);return n}

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

function parseSnapshot(text){let seq=null,end=null;const nextVals={},nextAlarms={},nextAck={};for(const line of String(text||"").split(/\\r?\\n/)){if(!line)continue;const k=line.indexOf("=");if(k<1)continue;const key=line.slice(0,k),raw=line.slice(k+1);if(key==="SEQ"){seq=raw;continue}if(key==="END"){end=raw;continue}if(key[0]==="K"){const id=Number(key.slice(1));if(Number.isInteger(id)&&plcAlarmIds.has(id))nextAck[id]=raw==="1";continue}if(key[0]==="A"){const id=Number(key.slice(1));if(Number.isInteger(id)&&plcAlarmIds.has(id))nextAlarms[id]=raw==="1";continue}const id=Number(key),tag=P.vars.find(v=>v.id===id);if(!tag)continue;let value=raw;if(tag.type==="BOOL")value=raw==="1"||raw==="TRUE";else if(["LINT","ULINT","BYTE","WORD","DWORD","LWORD","TIME","DATE","TIME_OF_DAY","DATE_AND_TIME"].includes(tag.type)){value=raw}else if(tag.type!=="STRING"){value=Number(raw);if(!Number.isFinite(value))throw Error("snapshot numerico invalido")}nextVals[tag.name]=value}if(seq===null||end===null||seq!==end)throw Error("snapshot incompleto");for(const tag of P.vars)if(!Object.prototype.hasOwnProperty.call(nextVals,tag.name))throw Error("tag ausente "+tag.id);for(const a of P.alarms)if(!a.local){if(!Object.prototype.hasOwnProperty.call(nextAlarms,a.wireId))throw Error("alarma ausente "+a.wireId);if(!Object.prototype.hasOwnProperty.call(nextAck,a.wireId))nextAck[a.wireId]=false;}return{seq,vals:nextVals,alarms:nextAlarms,ack:nextAck}}

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

function paint(){updateLocalAlarms();expireWrites();for(const [n,o] of [...nodes,...popupNodes]){const v=currentValue(o.binding),pending=o.binding?pendingWrites.get(o.binding):null;n.classList.toggle("write-pending",Boolean(pending&&pending.state!=="error"));n.classList.toggle("write-error",Boolean(pending&&pending.state==="error"));n.classList.toggle("input-limit-error",Boolean(n.inputError));n.classList.toggle("input-dirty",Boolean(n.inputDirty));if(n.inputError)n.title=n.inputError;else if(pending)n.title=pending.state==="error"?(pending.error||"Escritura no confirmada"):"Escritura pendiente de confirmar";else n.removeAttribute("title");if(o.kind==="status"){const visualOn=boolValue(v)===(o.stateOnWhen!=="false");if(n.statusVisual&&visualOn!==n.visualOn){n.statusVisual.innerHTML=statusSvg(o.symbolType||"lamp",visualOn,o.lampOnColor);n.visualOn=visualOn}}else if(o.kind==="text"&&o.binding&&String(o.optionsText||"").trim()){const pairs=String(o.optionsText||"").split(/\\r?\\n/).map(x=>{const i=x.indexOf("=");return i<0?null:{key:x.slice(0,i).trim(),value:x.slice(i+1).trim()}}).filter(Boolean),match=pairs.find(x=>x.key===String(v)||(typeof v==="boolean"&&((x.key==="1"&&v)||(x.key==="0"&&!v)))||((x.key==="true"||x.key==="false")&&boolValue(v)===(x.key==="true")));n.querySelector(".in").textContent=match?match.value:(o.text||"--")}else if(o.kind==="value")n.querySelector(".in").textContent=fmt(o,v,"--");else if(o.kind==="bar"){const q=Math.max(0,Math.min(100,100*(Number(v)-o.min)/(o.max-o.min||1)));n.fill.style.width=q+"%"}else if(o.kind==="tank"){const q=Math.max(0,Math.min(100,100*(Number(v)-o.min)/(o.max-o.min||1)));n.level.style.height=q+"%"}else if(n.control){const c=n.control,num=Number(v),valid=Number.isFinite(num),display=fmt(o,v,"--")+(o.unit?" "+o.unit:"");if(c.reading)c.reading.textContent=display;if(o.kind==="slider"){if(!c.input.matches(":active"))c.input.value=controlRange(o,v);c.input.disabled=!widgetWritable(o.binding)||Boolean(pending)}if(o.kind==="switch"){c.button.classList.toggle("on",boolValue(v));c.button.textContent=boolValue(v)?"ON":"OFF";c.button.disabled=!widgetWritable(o.binding)||Boolean(pending)}if(o.kind==="selector"){const writable=widgetWritable(o.binding)&&!pending;for(const choice of c.buttons){const active=choice.value===String(v??"");choice.button.classList.toggle("active",active);choice.button.setAttribute("aria-pressed",String(active));choice.button.disabled=!writable}}if(o.kind==="dropdown"){if(!c.input.matches(":focus"))c.input.value=String(v??"");c.input.disabled=!widgetWritable(o.binding)||Boolean(pending)}if(o.kind==="multistate"){const opt=optionsFor(o).find(x=>x.value===String(v));c.reading.textContent=opt?opt.label:"Estado: "+String(v??"--");c.reading.style.color=opt&&opt.color||"#182230"}if(o.kind==="counter"){c.progress.style.width=(valid&&o.target>0?Math.max(0,Math.min(100,100*num/o.target)):0)+"%";c.target.textContent="Objetivo: "+o.target+" ("+(valid&&o.target>0?Math.round(100*num/o.target):0)+"%)"}if(o.kind==="gauge")c.ring.style.setProperty("--pct",(valid?100*(controlRange(o,num)-o.min)/(o.max-o.min||1):0)+"%");if(o.kind==="stepper"){c.minus.disabled=c.plus.disabled=!widgetWritable(o.binding)||Boolean(pending);c.minus.disabled||=(num<=o.min);c.plus.disabled||=(num>=o.max)}}else if(o.kind==="input"){if(pending)n.entry.value=pending.raw;else if(!n.inputDirty&&document.activeElement!==n.entry)n.entry.value=fmt(o,v,"")}else if(o.kind==="image"&&n.image&&o.binding){const key=boolValue(v)?(o.assetOnId||o.assetId):o.assetId;if(key!==n.imageKey){n.image.src=assets[key]||"";n.imageKey=key}}else if(o.kind==="button"&&n.button&&o.feedbackBinding){const on=boolValue(currentValue(o.feedbackBinding));n.button.style.backgroundColor=on?(o.feedbackColorOn||"#16a34a"):(o.feedbackColorOff||"#2563eb");n.button.textContent=(on?o.feedbackTextOn:o.feedbackTextOff)||o.text}if(o.expressionText){const value=expr(o.expressionText);if(value!==undefined&&value!==null){const target=n.querySelector(".in")||n.querySelector(".reading")||n.querySelector(".caption");if(target)target.textContent=String(value)}}if(o.expressionColor){const color=expr(o.expressionColor);n.style.color=typeof color==="string"&&CSS.supports("color",color)?color:""}if(o.expressionBackground){const color=expr(o.expressionBackground),surface=n.querySelector(".in")||n.querySelector(".control-panel")||n.querySelector(".track")||n.querySelector(".symbol")||n;surface.style.backgroundColor=typeof color==="string"&&CSS.supports("color",color)?color:""}if(o.expressionVisible){const visible=expr(o.expressionVisible);n.style.visibility=visible===undefined?"hidden":visible?"visible":"hidden"}else n.style.visibility=""}paintAlarms();updateCommStatus();refreshRecipeActualValues()}

async function readSnapshot(){const r=await fetchTimed("/api/read",{},READ_TIMEOUT);if(!r.ok)throw Error("HTTP "+r.status);const snap=parseSnapshot(await r.text());for(const k of Object.keys(vals))delete vals[k];Object.assign(vals,snap.vals);for(const id of plcAlarmIds){delete alarmVals[id];delete ackVals[id]}Object.assign(alarmVals,snap.alarms);Object.assign(ackVals,snap.ack);comm.lastSeq=snap.seq;comm.lastGoodAt=Date.now();comm.failures=0;setComm("ONLINE");confirmWrites();checkRecipeApplyJob();saveGoodSnapshot();if(P.screenBinding){const requested=Number(vals[P.screenBinding]),match=Number.isSafeInteger(requested)?P.screens.findIndex(s=>s.number===requested):-1,next=match<0?0:match;if(next!==screenIndex){showScreen(next);return;}}paint()}
async function sendWrite(item){const tag=byName[item.name];if(!tag){item.state="error";item.error="Variable no disponible";return}if(Date.now()>item.expires){item.state="error";item.error="Escritura caducada";return}item.attempts+=1;item.state="sending";paint();try{const r=await fetchTimed("/api/write?id="+tag.id,{method:"POST",headers:{"Content-Type":"text/plain;charset=UTF-8"},body:item.raw},READ_TIMEOUT);if(!r.ok){item.state="error";item.error="HTTP "+r.status;return}item.state="sent";comm.forceRead=true}catch(e){if(item.attempts<MAX_WRITE_ATTEMPTS&&Date.now()<item.expires){item.state="retry";item.due=Date.now()+[300,700][Math.min(1,item.attempts-1)];item.error="Reintentando"}else{item.state="error";item.error="Escritura no confirmada"}comm.forceRead=true;failComm()}paint()}
async function sendAck(id){try{const r=await fetchTimed("/api/ack?id="+id,{method:"POST"},READ_TIMEOUT);if(!r.ok)throw Error("HTTP "+r.status);pendingAck=null;comm.forceRead=true}catch(e){pendingAck=null;statusEl.textContent="ACK NO CONFIRMADO";failComm();comm.forceRead=true}}
async function sendRecipe(item){try{const r=await fetchTimed("/api/recipe?id="+item.id,{method:"POST"},READ_TIMEOUT);if(!r.ok)throw Error("HTTP "+r.status);pendingRecipe=null;comm.forceRead=true;statusEl.textContent="RECETA ENVIADA | confirmando"}catch(e){pendingRecipe=null;failComm();statusEl.textContent="ERROR RECETA | no reintentada"}}

async function commCycle(){if(comm.busy)return;comm.busy=true;let delay=Number(P.pollMs)||500;try{expireWrites();const w=dueWrite();if(w){await sendWrite(w);delay=comm.forceRead?50:Math.max(50,nextWriteDue()-Date.now())}else if(pendingAck!==null){await sendAck(pendingAck);delay=50}else if(pendingRecipe){await sendRecipe(pendingRecipe);delay=50}else{if(comm.failures>=3)setComm("RECONNECTING");await readSnapshot();delay=Number(P.pollMs)||500}}catch(e){failComm();paint();delay=backoff()}finally{comm.busy=false;if(comm.forceRead){comm.forceRead=false;delay=50}else{const d=nextWriteDue();if(Number.isFinite(d))delay=Math.min(delay,Math.max(50,d-Date.now()))}schedule(delay)}}

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
function applyRecipe(id){if(pendingRecipe){statusEl.textContent="RECETA PENDIENTE";return}pendingRecipe={id,at:Date.now()};schedule(0)}

${recipeRuntimeJS()}
function startComm(){loadCachedSnapshot();showScreen(0);fitStage();paint();schedule(0)}
startComm();
`;}
function recipeRuntimeJS(){return String.raw`
const recipeOpen=document.getElementById("recipeOpen"),recipeWindow=document.getElementById("recipeWindow"),recipeClose=document.getElementById("recipeClose");
const recipeSelect=document.getElementById("recipeSelect"),recipeName=document.getElementById("recipeName"),recipeScope=document.getElementById("recipeScope"),recipeFieldList=document.getElementById("recipeFieldList"),recipeMessageEl=document.getElementById("recipeMessage");
const recipeFields=P.recipeFields||[],recipeFieldsByName=Object.fromEntries(recipeFields.map(f=>[f.name,f]));
const recipeBrowserKey="hminx:recipes:v1:"+String(P.recipeKey||P.name);
const recipeSlots=new Map(),recipeBrowser=[];
let recipeRemoteReady=false,recipeBusy=false,recipeSelected="",recipeDraft=null,recipeDirty=false,recipeApplyJob=null;
function recipeClone(o){return JSON.parse(JSON.stringify(o))}
function recipeUid(){return "r"+Date.now().toString(36)+Math.random().toString(36).slice(2,10)}
function recipeAlert(t,error){recipeMessageEl.textContent=t;recipeMessageEl.style.color=error?"#b91c1c":"#0f4c81"}
function recipeStorageSave(){
 try{localStorage.setItem(recipeBrowserKey,JSON.stringify({version:1,recipes:recipeBrowser}));return true}
 catch(e){recipeAlert("No se pudieron conservar las recetas en el navegador: "+e.message,true);return false}
}
function recipeSanitize(candidate,scope){
 if(!candidate||typeof candidate!=="object"||Array.isArray(candidate))throw Error("Receta no v\u00e1lida");
 const o={id:typeof candidate.id==="string"&&candidate.id.length<=100?candidate.id:recipeUid(),name:String(candidate.name||""),scope,values:Object.create(null)};
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
function recipeLoadBrowser(){
 let saved=null;
 try{const raw=localStorage.getItem(recipeBrowserKey);if(raw!==null){const o=JSON.parse(raw);if(o&&o.version===1&&Array.isArray(o.recipes))saved=o.recipes}}
 catch(e){recipeAlert("Error leyendo recetas locales: "+e.message,true)}
 const list=saved===null?P.recipes.filter(r=>r.scope==="local"):saved;
 for(const r of list){try{if(recipeBrowser.length<24)recipeBrowser.push(recipeSanitize(r,"local"))}catch(e){recipeAlert("Receta local omitida: "+e.message,true)}}
}
function recipeSeedShared(){
 let slot=1;
 for(const r of P.recipes.filter(r=>r.scope==="shared").slice(0,12)){
  try{recipeSlots.set(slot,{rev:0,data:recipeSanitize(r,"shared"),fallback:true})}catch{}
  slot++;
 }
}
function recipeListItems(){
 const items=[];
 for(const [slot,item] of [...recipeSlots].sort((a,b)=>a[0]-b[0]))if(item.data)items.push({key:"S:"+slot,data:item.data,slot,rev:item.rev});
 for(const r of recipeBrowser)items.push({key:"L:"+r.id,data:r});
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
 for(const item of items){const option=E("option");option.value=item.key;option.textContent=(item.key.startsWith("S:")?"NX \u00b7 ":"Local \u00b7 ")+item.data.name;recipeSelect.append(option)}
 if(recipeDraft&&recipeSelected.startsWith("N:")){const option=E("option");option.value=recipeSelected;option.textContent="Sin guardar \u00b7 "+recipeDraft.name;recipeSelect.append(option)}
 if(!recipeDraft&&items.length){recipeSelected=items[0].key;recipeDraft=recipeClone(items[0].data)}
 if(recipeDraft){recipeSelect.value=recipeSelected;recipeName.value=recipeDraft.name;recipeScope.value=recipeDraft.scope||"local"}
 else{recipeName.value="";recipeScope.value="local"}
 const existing=!recipeSelected.startsWith("N:")&&Boolean(recipeDraft);
 recipeName.disabled=!recipeDraft||recipeBusy;
 recipeScope.disabled=!recipeDraft||existing||recipeBusy;
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
 recipeScope.onchange=()=>{recipeDirty=true;document.getElementById("recipeApply").disabled=true};
}
function recipeReadForm(){
 if(!recipeDraft)throw Error("Selecciona una receta");
 const o={id:recipeDraft.id,name:recipeName.value.trim(),scope:recipeScope.value,values:Object.create(null)};
 for(const check of recipeFieldList.querySelectorAll("[data-recipe-included]"))if(check.checked){
  const name=check.getAttribute("data-recipe-included"),field=recipeFieldsByName[name],input=Array.from(recipeFieldList.querySelectorAll("[data-recipe-value]")).find(x=>x.getAttribute("data-recipe-value")===name);
  o.values[name]=recipeTypedValue(field,input.value);
 }
 if(!o.name||o.name.length>48)throw Error("Nombre obligatorio, m\u00e1ximo 48 caracteres");
 if(!Object.keys(o.values).length)throw Error("Selecciona al menos una variable para la receta");
 if(Object.keys(o.values).length>20)throw Error("M\u00e1ximo 20 par\u00e1metros");
 if(o.scope==="shared"&&new TextEncoder().encode(recipeASCII(o)).length>500)throw Error("La receta supera los 500 bytes del banco NX");
 if(recipeListItems().some(x=>x.key!==recipeSelected&&x.data.scope===o.scope&&x.data.name.toLowerCase()===o.name.toLowerCase()))throw Error("Ya hay otra receta con ese nombre");
 return o
}
recipeLoadBrowser();recipeSeedShared();

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
  if(versions.size!==12)throw Error("Resumen NX incompleto");
  const next=new Map();
  for(let slot=1;slot<=12;slot++){
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
 if(new TextEncoder().encode(body).length>500)throw Error("Supera el l\u00edmite de 500 bytes por receta NX");
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
 for(let slot=1;slot<=12;slot++){const item=recipeSlots.get(slot);if(!item||!item.data)return{slot,rev:item?.rev||0}}
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
 const o=copy?recipeClone(copy):{id:recipeUid(),name:"Nueva receta",scope:"local",values:{}};
 o.id=recipeUid();o.name=copy?recipeDuplicateName(o):"Nueva receta";recipeSelected="N:"+o.id;recipeDraft=o;recipeDirty=true;renderRecipeManager();recipeAlert("Receta sin guardar: modifica nombre, valores y destino, despu\u00e9s pulsa Guardar")
}
async function recipeSaveDraft(){
 if(recipeBusy)return;
 let record;try{record=recipeReadForm()}catch(e){recipeAlert(e.message,true);return}
 const originalKey=recipeSelected;
 recipeDraft=recipeClone(record); // Keep unsaved edits intact even if NX save fails or returns 409.
 if(record.scope==="shared"&&!recipeRemoteReady){recipeAlert("Conecta con el NX antes de guardar una receta compartida",true);return}
 recipeBusy=true;renderRecipeManager();
 try{
  if(record.scope==="local"){
   const i=recipeBrowser.findIndex(x=>x.id===record.id);
   if(i<0&&recipeBrowser.length>=24)throw Error("L\u00edmite de 24 recetas locales");
   const previous=recipeBrowser.slice();if(i>=0)recipeBrowser[i]=record;else recipeBrowser.push(record);
   if(!recipeStorageSave()){recipeBrowser.splice(0,recipeBrowser.length,...previous);throw Error("La receta no ha quedado guardada en el navegador")}
   recipeSelected="L:"+record.id
  }else{
   const existing=originalKey.startsWith("S:")?Number(originalKey.slice(2)):0,free=existing?null:recipeFirstSlot();
   if(!existing&&!free)throw Error("El banco NX est\u00e1 lleno (12 recetas). Elimina una o exporta y depura el banco");
   const slot=existing||free.slot,rev=existing?recipeSlots.get(slot).rev:free.rev;
   await recipeStoreShared(record,slot,rev);recipeSelected="S:"+slot;
  }
  recipeDraft=recipeClone(record);recipeDirty=false;recipeAlert("Receta guardada: "+record.name);
 }catch(e){recipeAlert("No guardada: "+e.message,true)}
 finally{recipeBusy=false;renderRecipeManager()}
}
async function recipeDeleteSelected(){
 if(recipeBusy||!recipeDraft)return;
 if(recipeSelected.startsWith("N:")){recipeSelected="";recipeDraft=null;recipeDirty=false;renderRecipeManager();return}
 if(!confirm("\u00bfEliminar definitivamente la receta '"+recipeDraft.name+"' de "+(recipeSelected.startsWith("S:")?"la memoria del NX":"este navegador")+"?"))return;
 recipeBusy=true;renderRecipeManager();
 try{
  if(recipeSelected.startsWith("S:")){const slot=Number(recipeSelected.slice(2)),item=recipeSlots.get(slot);await recipeStoreShared(null,slot,item.rev)}
  else{
   const i=recipeBrowser.findIndex(x=>x.id===recipeDraft.id),prev=recipeBrowser.slice();if(i>=0)recipeBrowser.splice(i,1);
   if(!recipeStorageSave()){recipeBrowser.splice(0,recipeBrowser.length,...prev);throw Error("Fallo al eliminar en almacenamiento local")}
  }
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
   const scope=raw.scope==="shared"?"shared":"local";
   const record=recipeSanitize(raw,scope);record.id=recipeUid();
   if(recipeListItems().some(x=>x.data.scope===scope&&x.data.name.toLowerCase()===record.name.toLowerCase())){error="La receta "+record.name+" ya existe";break}
   if(scope==="shared"){
    if(!recipeRemoteReady){error="NX sin conexi\u00f3n";break}
    const free=recipeFirstSlot();if(!free){error="Banco NX lleno";break}
    await recipeStoreShared(record,free.slot,free.rev)
   }else{
    if(recipeBrowser.length>=24){error="M\u00e1ximo de recetas locales";break}
    recipeBrowser.push(record);
    if(!recipeStorageSave()){recipeBrowser.pop();error="No se pudo persistir la receta local";break}
   }
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
recipeName.readOnly=true;recipeName.inputMode="none";recipeName.setAttribute("aria-haspopup","dialog");
recipeName.onclick=()=>{if(recipeName.disabled)return;openVirtualKeyboard({title:"Nombre de receta",type:"STRING",value:recipeName.value,maxLength:48,onAccept:raw=>{if(!raw.trim())throw Error("El nombre de receta no puede estar vacío");recipeName.value=raw;recipeName.dispatchEvent(new Event("input",{bubbles:true}))}})};
`;}
C.buildRuntimeHTML=buildRuntimeHTML;
})(globalThis);
