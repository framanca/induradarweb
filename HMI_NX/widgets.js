/* Shared DOM/SVG widget renderer. Imported images never execute embedded SVG code. */
(function(root){
'use strict';const C=root.NXCore;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const symbols={
 motor:'<rect x="22" y="38" width="118" height="66" rx="12"/><path d="M43 32v79m15-79v79m15-79v79m15-79v79m15-79v79M140 57h28v27h-28M18 116h130"/><g class="nx-rotor"><circle cx="79" cy="70" r="23"/><path d="M79 47v46M56 70h46"/></g>',
 pump:'<path d="M17 59h41m65-6V18h32M80 112v14M54 130h62"/><circle cx="86" cy="74" r="41"/><g class="nx-rotor"><path d="M86 41v65M54 74h64M64 51l44 45"/></g>',
 valve:'<path d="M18 41l65 43-65 42zM148 41L83 84l65 42zM83 84V23M58 22h52"/><circle cx="83" cy="23" r="8"/>',
 cylinder:'<rect x="14" y="44" width="100" height="57" rx="6"/><path d="M35 44v57M112 56h15v34h-15"/><g class="nx-arm"><path d="M127 74h44"/><rect x="161" y="48" width="10" height="54"/></g>',
 tank:'<path d="M38 26Q85 2 132 26v103H38z"/><rect class="nx-fluid" x="41" y="62" width="88" height="63"/><path d="M70 129v15h65M57 20v-9"/>',
 sensor:'<rect x="18" y="54" width="67" height="57" rx="8"/><path d="M18 81H2M95 61q27 18 0 38M113 48q42 31 0 66M130 34q58 46 0 94"/><circle cx="52" cy="73" r="7"/>',
 conveyor:'<rect x="10" y="73" width="159" height="29" rx="14"/><circle cx="28" cy="88" r="8"/><circle cx="151" cy="88" r="8"/><path d="M26 104v30m126-30v30"/><g class="nx-flow"><path d="M41 88h94" stroke-dasharray="9 10"/></g><rect x="61" y="39" width="42" height="31" rx="3"/>'
};
function widget(o,p){
 const n=el('div',`nx-object nx-${o.kind}`);n.dataset.id=o.id;n.dataset.element=o.elementId||o.id;
 Object.assign(n.style,{left:o.x+'px',top:o.y+'px',width:o.w+'px',height:o.h+'px',color:o.color,background:o.background,fontSize:o.fontSize+'px'});
 const label=()=>n.append(el('div','nx-label',o.text));
 if(['text','rectangle','circle','line'].includes(o.kind))n.append(el('span','nx-copy',o.text));
 if(o.kind==='image'){const a=p.assets.find(a=>a.id===o.assetId);if(a){const img=el('img');img.src=a.data||a.url;img.alt=o.text;img.draggable=false;img.loading='eager';n.append(img);}else n.append(el('span','nx-copy','＋ Imagen'));}
 if(o.kind==='lamp'){label();n.append(el('span','nx-lamp-dot'),el('small','nx-state-label','—'));}
 if(o.kind==='value'){label();n.append(el('strong','nx-number','—'));}
 if(o.kind==='bar'||o.kind==='level'){label();const track=el('div','nx-track');track.append(el('div','nx-fill'));if(o.kind==='level'||o.orientation==='vertical')n.classList.add('vertical');n.append(track,el('span','nx-number','—'));}
 if(o.kind==='button'){const b=el('button','nx-action',o.text);b.type='button';b.style.background=o.background;b.style.color=o.color;n.append(b);}
 if(o.kind==='input'){
  label();const wrap=el('div','nx-input-line'),v=p.variables.find(v=>v.name===(o.writeBinding||o.binding));let input;
  if(v?.type==='BOOL'){input=el('select','nx-entry');for(const [value,text]of [['false','FALSE'],['true','TRUE']]){const option=el('option','',text);option.value=value;input.append(option);}}
  else {input=el('input','nx-entry');input.type=v?.type==='STRING'?'text':'number';input.step=v?.type==='DINT'?'1':'any';input.maxLength=v?.maxLength||255;if(v?.min!==undefined&&v.min!=='')input.min=v.min;if(v?.max!==undefined&&v.max!=='')input.max=v.max;}
  input.setAttribute('aria-label',o.text||o.binding);wrap.append(input);if(o.keyboard)wrap.append(el('button','nx-keyboard-open','⌨'));wrap.append(el('button','nx-apply','Aplicar'));n.append(wrap,el('small','nx-readback','Leído: —'));
 }
 if(o.kind==='switch'){label();const b=el('button','nx-switch-button','—');b.type='button';b.setAttribute('role','switch');n.append(b,el('small','nx-readback','Leído: —'));}
 if(o.kind==='selector'){label();const select=el('select','nx-select-value');select.setAttribute('aria-label',o.text);for(const a of o.options){const option=el('option','',a.label);option.value=String(a.value);select.append(option);}n.append(select,el('small','nx-readback','Leído: —'));}
 if(o.kind==='slider'){if(o.orientation==='vertical')n.classList.add('vertical');label();const slider=el('input','nx-slider');slider.type='range';slider.min=o.min;slider.max=o.max;slider.step=o.step;slider.setAttribute('aria-label',o.text);n.append(slider,el('small','nx-slider-value','—'));if(o.writeMode==='apply')n.append(el('button','nx-slider-apply','Aplicar'));n.append(el('small','nx-readback','Leído: —'));}
 if(o.kind==='symbol'){label();const svg=el('div','nx-symbol');svg.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 150" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[o.symbol]||symbols.motor}</svg>`;n.append(svg);}
 if(o.kind==='alarms'||o.kind==='banner'){
  label();if(o.kind==='alarms'){const tools=el('div','nx-record-filters');const filter=el('select','nx-alarm-filter');for(const [value,name]of [['all','Todas'],['active','Activas'],['unacked','Sin reconocer']]){const option=el('option','',name);option.value=value;filter.append(option);}const search=el('input','nx-record-search');search.placeholder='Buscar código o mensaje';tools.append(filter,search);const severity=el('select','nx-alarm-severity');for(const [value,name]of [['','Prioridad: todas'],['high','Alta'],['warning','Aviso'],['info','Información']]){const opt=el('option','',name);opt.value=value;severity.append(opt);}tools.append(severity);n.append(tools);}
  n.append(el('div','nx-alarm-rows'));if(o.kind==='alarms')n.append(recordFooter());
 }
 if(o.kind==='audit'){label();const search=el('input','nx-record-search');search.placeholder='Filtrar usuario / operación';n.append(search,el('div','nx-audit-rows'),recordFooter());}
 if(o.kind==='recipes'){label();n.append(el('div','nx-recipe-body'));}
 if(o.kind==='clock'){n.append(el('span','nx-clock-value','—'));}
 if(o.kind==='user'){n.append(el('span','nx-user-name','Sin identificar'),el('button','nx-login','Identificarse'));}
 if(o.kind==='navigation'){const nav=el('nav','nx-nav');for(const s of p.screens){const b=el('button','',s.name);b.dataset.screen=s.id;nav.append(b);}n.append(nav);}
 return n;
}
function recordFooter(){const footer=el('div','nx-export-row');footer.append(el('button','nx-export-csv','CSV'),el('button','nx-export-xlsx','Excel'),el('small','nx-record-scope','Retenido en el servicio; puede haber huecos'));return footer;}
function refresh(n,o,p,values,quality,editing=false,session=null){
 const good=typeof quality==='boolean'?quality:quality[o.binding]===true,has=Object.hasOwn(values,o.binding),value=values[o.binding];
 n.classList.toggle('nx-stale',!!o.binding&&(!good||!has));
 n.style.background=o.background;n.style.color=o.color;n.style.transform='';n.style.width=o.w+'px';n.style.height=o.h+'px';
 let visible=!o.visibleBinding||values[o.visibleBinding]===true,transform=[];
 n.classList.toggle('nx-blink',!editing&&o.animation==='blink'&&good&&!!value);n.classList.toggle('nx-rotate',!editing&&o.animation==='rotate'&&good&&!!value);
 n.classList.remove('nx-flowing');
 const baseText=n.querySelector('.nx-copy,.nx-label');if(baseText)baseText.textContent=o.text;
 if(o.kind==='symbol')n.style.color=good&&value?o.onColor:o.offColor;
 if(!editing){for(const r of o.rules){const rg=typeof quality==='boolean'?quality:quality[r.variable]===true;if(!rg||!C.ruleMatch(r,values[r.variable]))continue;const v=C.ruleValue(r,values[r.variable]);
  if(r.property==='color')n.style.color=v;
  if(r.property==='text'){const t=n.querySelector('.nx-copy,.nx-label');if(t)t.textContent=String(v);}
  if(r.property==='visible')visible=visible&&['true',true,1,'1'].includes(v);
  if(r.property==='x')transform.push(`translateX(${Math.max(-p.width,Math.min(p.width,Number(v)||0))}px)`);
  if(r.property==='y')transform.push(`translateY(${Math.max(-p.height,Math.min(p.height,Number(v)||0))}px)`);
  if(r.property==='rotate')transform.push(`rotate(${Number(v)||0}deg)`);
  if(r.property==='width')n.style.width=Math.max(1,Math.min(p.width,Number(v)||1))+'px';
  if(r.property==='height')n.style.height=Math.max(1,Math.min(p.height,Number(v)||1))+'px';
  if(r.property==='flow')n.classList.add('nx-flowing');
 }}
 n.style.transform=transform.join(' ');if(!editing)n.style.visibility=visible?'visible':'hidden';
 const txt=!has?'—':typeof value==='number'?value.toFixed(Math.max(0,Math.min(6,o.digits)))+(o.unit?' '+o.unit:''):String(value);
 if(['value','bar','level'].includes(o.kind))n.querySelector('.nx-number').textContent=txt;
 if(o.kind==='lamp'){n.querySelector('.nx-lamp-dot').style.background=has&&good?(value?o.onColor:o.offColor):'#778394';n.querySelector('.nx-state-label').textContent=has&&good?(value?'ON':'OFF'):'DESCONOCIDO';}
 if(o.kind==='symbol'){const fill=n.querySelector('.nx-fluid');if(fill&&has)fill.style.opacity=Math.max(0,Math.min(1,Number(value)/100));}
 if(['bar','level'].includes(o.kind)){const fraction=Math.max(0,Math.min(100,100*(Number(value)-o.min)/(o.max-o.min)))||0;const f=n.querySelector('.nx-fill');if(n.classList.contains('vertical'))f.style.height=fraction+'%';else f.style.width=fraction+'%';}
 const readback=n.querySelector('.nx-readback');if(readback)readback.textContent=`Leído: ${txt}${good?'':' · dato no vigente'}`;
 if(o.kind==='input'){const input=n.querySelector('.nx-entry');if(document.activeElement!==input&&input.dataset.dirty!=='1')input.value=has?String(value):'';}
 if(o.kind==='switch'){const b=n.querySelector('.nx-switch-button');b.textContent=has?(value?'ON → apagar':'OFF → encender'):'—';b.setAttribute('aria-checked',value?'true':'false');}
 if(o.kind==='selector'){const select=n.querySelector('.nx-select-value');if(document.activeElement!==select)select.value=has?String(value):'';}
 if(o.kind==='slider'){const slider=n.querySelector('.nx-slider');if(slider.dataset.dirty!=='1')slider.value=has?value:o.min;n.querySelector('.nx-slider-value').textContent=slider.value+(o.unit?' '+o.unit:'');}
 if(o.kind==='clock')n.querySelector('.nx-clock-value').textContent=new Date().toLocaleString();
 if(o.kind==='user'){n.querySelector('.nx-user-name').textContent=session?`${session.name} · ${session.role}`:'Sin identificar';n.querySelector('.nx-login').textContent=session?'Cambiar usuario':'Identificarse';}
}
root.NXWidgets={el,widget,refresh,symbols};
})(globalThis);
