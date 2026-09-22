/* Shared renderer and runtime. nx-http-v1 is a CUSTOM adapter contract, not an Omron driver. */
(function(root){
  'use strict';
  const C=root.NXCore;
  const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
  const initial=p=>Object.fromEntries(p.variables.map(v=>[v.name,C.typed(v,v.initial)]));
  function widget(o,p){
    const n=el('div',`nx-object nx-${o.kind}`);n.dataset.id=o.id;
    Object.assign(n.style,{left:o.x+'px',top:o.y+'px',width:o.w+'px',height:o.h+'px',color:o.color,background:o.background,fontSize:o.fontSize+'px'});
    const label=()=>n.append(el('div','nx-label',o.text));
    if(o.kind==='text'||o.kind==='rectangle'){n.append(el('span','nx-copy',o.text));}
    if(o.kind==='image'){
      const a=p.assets.find(a=>a.id===o.assetId);if(a){const img=el('img');img.src=a.data;img.alt=o.text;img.draggable=false;n.append(img);}else n.append(el('span','nx-copy','＋ Imagen'));
    }
    if(o.kind==='lamp'){label();n.append(el('span','nx-lamp-dot'));}
    if(o.kind==='value'){label();n.append(el('strong','nx-number','—'));}
    if(o.kind==='bar'){label();const track=el('div','nx-track');track.append(el('div','nx-fill'));n.append(track,el('span','nx-number','—'));}
    if(o.kind==='button'){const b=el('button','nx-action',o.text);b.type='button';b.style.background=o.background;b.style.color=o.color;n.append(b);}
    if(o.kind==='input'){
      label();const wrap=el('div','nx-input-line'),v=p.variables.find(v=>v.name===o.binding);let input;
      if(v?.type==='BOOL'){input=el('select','nx-entry');for(const [value,text] of [['false','FALSE'],['true','TRUE']]){const a=el('option','',text);a.value=value;input.append(a);}}
      else {input=el('input','nx-entry');input.type=v?.type==='STRING'?'text':'number';input.step=v?.type==='DINT'?'1':'any';input.maxLength=255;}
      input.setAttribute('aria-label',o.text||o.binding);wrap.append(input,el('button','nx-apply','Aplicar'));n.append(wrap,el('small','nx-readback','Leído: —'));
    }
    if(o.kind==='alarms'){label();n.append(el('div','nx-alarm-rows'));}
    if(o.kind==='recipes'){label();n.append(el('div','nx-recipe-body'));}
    return n;
  }
  function refreshWidget(n,o,p,values,good,editing=false){
    const has=Object.hasOwn(values,o.binding),v=values[o.binding];
    n.classList.toggle('nx-stale',!!o.binding&&!good);
    if(!editing)n.style.visibility=o.visibleBinding&&values[o.visibleBinding]!==true?'hidden':'visible';
    if(!editing){n.classList.toggle('nx-blink',o.animation==='blink'&&good&&!!v);n.classList.toggle('nx-rotate',o.animation==='rotate'&&good&&!!v);}
    const digits=Math.max(0,Math.min(6,Number(o.digits)||0));
    const txt=!has?'—':typeof v==='number'?v.toFixed(digits)+(o.unit?' '+o.unit:''):String(v);
    if(o.kind==='value'||o.kind==='bar')n.querySelector('.nx-number').textContent=txt;
    if(o.kind==='lamp')n.querySelector('.nx-lamp-dot').style.background=has&&good?(v?o.onColor:o.offColor):'#778394';
    if(o.kind==='bar')n.querySelector('.nx-fill').style.width=Math.max(0,Math.min(100,100*(Number(v)-o.min)/(o.max-o.min)))+'%';
    if(o.kind==='input'){
      const input=n.querySelector('.nx-entry');if(document.activeElement!==input&&input.dataset.dirty!=='1')input.value=has?String(v):'';
      n.querySelector('.nx-readback').textContent=`Leído: ${txt}${good?'':' · dato no vigente'}`;
    }
  }
  class Runtime{
    constructor(p,container,options={}){
      this.p=C.copy(p);this.container=container;this.sim=options.simulate??p.connection.profile==='simulation';this.notify=options.onStatus||(()=>{});this.values=this.sim?initial(p):{};
      this.good=this.sim;this.commandMessage='';this.stopped=false;this.armed=false;this.busy=false;this.lastRead=0;this.roundtrip=0;this.sequence=0;this.session=C.id();this.events=[];this.alarmStates=new Map();this.currentScreen=p.screens[0].id;this.controllers=new Set();this.generation=0;
      this.root=el('div','nx-runtime');this.header=el('header','nx-runtime-header');this.title=el('strong','',p.name);this.status=el('span','nx-status');this.nav=el('nav','nx-nav');
      this.arm=el('button','nx-arm','Habilitar escritura');this.arm.hidden=this.sim;this.arm.onclick=()=>{if(!this.p.connection.allowWrites){this.message='Active permiso de escritura en la configuración del proyecto.';this.paintStatus();return;}this.armed=!this.armed;this.commandMessage='';this.paintStatus();};
      this.header.append(this.title,this.status,this.arm);this.viewport=el('div','nx-runtime-viewport');this.stage=el('div','nx-stage');this.viewport.append(this.stage);this.root.append(this.header,this.nav,this.viewport);container.replaceChildren(this.root);
      this.resizeObserver=new ResizeObserver(()=>this.fit());this.resizeObserver.observe(this.viewport);this.show(this.currentScreen);
      this.visibility=()=>{if(document.hidden&&!this.sim){this.good=false;this.armed=false;this.paint();}};document.addEventListener('visibilitychange',this.visibility);
      if(this.sim){this.message='SIMULACIÓN · sin conexión al PLC';this.timer=setInterval(()=>{this.evaluateAlarms();this.paint();},250);}else this.poll();
      this.paintStatus();
    }
    fit(){const width=this.viewport.clientWidth||this.p.width,scale=Math.min(1,width/this.p.width);this.stage.style.transform=`scale(${scale})`;this.viewport.style.height=(this.p.height*scale)+'px';}
    show(id){
      const screen=this.p.screens.find(s=>s.id===id);if(!screen)return;this.currentScreen=id;
      this.nav.replaceChildren();for(const s of this.p.screens){const b=el('button',s.id===id?'active':'',s.name);b.onclick=()=>this.show(s.id);this.nav.append(b);}
      this.stage.replaceChildren();Object.assign(this.stage.style,{width:this.p.width+'px',height:this.p.height+'px',background:screen.background});this.nodes=[];
      for(const o of screen.objects){const n=widget(o,this.p);this.stage.append(n);this.nodes.push([n,o]);
        if(o.kind==='button')n.querySelector('button').onclick=()=>o.action==='navigate'?this.show(o.targetScreen):this.write({[o.binding]:o.writeValue});
        if(o.kind==='input'){
          const entry=n.querySelector('.nx-entry');entry.oninput=()=>{entry.dataset.dirty='1';};
          n.querySelector('.nx-apply').onclick=async()=>{if(await this.write({[o.binding]:entry.value}))entry.dataset.dirty='';};
        }
        if(o.kind==='recipes')this.recipeWidget(n,o);
      }
      this.paint();this.fit();
    }
    recipeWidget(n){
      const body=n.querySelector('.nx-recipe-body'),select=el('select');select.setAttribute('aria-label','Receta');
      for(const r of this.p.recipes){const a=el('option','',r.name);a.value=r.id;select.append(a);}
      const details=el('div','nx-recipe-values'),apply=el('button','nx-recipe-apply','Aplicar lote de receta');
      const update=()=>{const r=this.p.recipes.find(r=>r.id===select.value);details.replaceChildren();for(const [key,value] of Object.entries(r?.values||{}))details.append(el('div','',`${key}: ${value}`));};
      select.onchange=update;apply.onclick=()=>{const r=this.p.recipes.find(r=>r.id===select.value);if(r)this.write(r.values);};
      body.append(select,details,apply,el('small','',this.sim?'Receta aplicada al simulador.':'Requiere aplicación atómica del lote por el servidor/PLC.'));update();
    }
    canWrite(){return this.sim||this.good&&this.armed&&this.p.connection.allowWrites&&!this.busy&&!document.hidden;}
    paintStatus(){
      this.status.textContent=(this.message||(this.sim?'SIMULACIÓN':this.good?`Conectado · ${this.roundtrip} ms`:'Sin datos válidos'))+(this.commandMessage?' · '+this.commandMessage:'');
      this.status.className='nx-status '+(this.sim?'simulation':this.good?'online':'offline');this.arm.textContent=this.armed?'Escritura habilitada · desarmar':'Habilitar escritura';
      this.notify({simulation:this.sim,good:this.good,message:this.status.textContent,roundtrip:this.roundtrip,values:{...this.values}});
    }
    paint(){
      if(!this.sim&&Date.now()-this.lastRead>Math.max(1500,this.p.connection.pollMs*3)){this.good=false;this.armed=false;}
      for(const [n,o] of this.nodes||[]){
        refreshWidget(n,o,this.p,this.values,this.good);
        for(const b of n.querySelectorAll('button'))if(!(o.kind==='button'&&o.action==='navigate')&&!b.classList.contains('nx-ack'))b.disabled=!this.canWrite()||this.busy;
        if(o.kind==='alarms')this.paintAlarms(n);
      }this.paintStatus();
    }
    evaluateAlarms(){
      if(!this.good)return;
      for(const a of this.p.alarms){const active=C.alarmOn(a,this.values,this.p.variables);if(active===null)continue;const old=this.alarmStates.get(a.id);this.alarmStates.set(a.id,active);
        if(active===old||(!active&&old===undefined))continue;
        if(active)this.events.unshift({id:C.id(),alarmId:a.id,name:a.name,severity:a.severity,active:true,ack:false,time:Date.now()});
        else {const e=this.events.find(e=>e.alarmId===a.id&&e.active);if(e){e.active=false;e.cleared=Date.now();}}
      }this.events=this.events.slice(0,200);
    }
    paintAlarms(n){
      const body=n.querySelector('.nx-alarm-rows');const key=JSON.stringify(this.events)+this.good;if(body.dataset.key===key)return;body.dataset.key=key;body.replaceChildren();
      if(!this.good)body.append(el('p','','Comunicación perdida: estado de alarmas desconocido.'));
      if(!this.events.length)body.append(el('p','','Sin eventos en esta sesión.'));
      for(const event of this.events){const row=el('div',`nx-alarm-row ${event.severity}`);row.append(el('span','',`${new Date(event.time).toLocaleTimeString()} · ${event.name} · ${event.active?'ACTIVA':'CESADA'}${event.ack?' · reconocida':''}`));
        if(!event.ack){const ack=el('button','nx-ack','Reconocer');ack.onclick=()=>{event.ack=true;this.paint();};row.append(ack);}body.append(row);
      }body.append(el('small','','Histórico y reconocimiento locales a esta sesión. No sustituye al registro/ACK del PLC.'));
    }
    setSim(name,value){if(!this.sim)return;const v=this.p.variables.find(v=>v.name===name);if(v){this.values[name]=C.typed(v,value);this.evaluateAlarms();this.paint();}}
    base(){
      const c=this.p.connection;const url=new URL(c.sameOrigin?location.origin:c.baseUrl);
      if(!['http:','https:'].includes(url.protocol))throw new Error('Abra la HMI desde un servidor HTTP(S), no como archivo.');
      if(location.protocol==='https:'&&url.protocol==='http:')throw new Error('HTTPS → HTTP bloqueado. Abra el runtime desde el NX o utilice un puente HTTPS autorizado.');
      return url.origin;
    }
    async request(path,payload){
      const controller=new AbortController();this.controllers.add(controller);const timeout=setTimeout(()=>controller.abort(),this.p.connection.timeoutMs);
      try{const response=await fetch(this.base()+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal,cache:'no-store',credentials:'same-origin',redirect:'error'});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json();
      }finally{clearTimeout(timeout);this.controllers.delete(controller);}
    }
    async poll(){
      if(this.stopped)return;
      const generation=this.generation,start=Date.now();
      if(!document.hidden){try{
        const names=this.p.variables.map(v=>v.name),data=await this.request('/api/hmi/read',{names});
        if(this.stopped||generation!==this.generation)return;
        if(!data||!data.values||typeof data.values!=='object'||Array.isArray(data.values))throw new Error('Respuesta inválida: falta values');
        const next={};for(const v of this.p.variables){if(!Object.hasOwn(data.values,v.name))throw new Error(`Falta la variable ${v.name}`);next[v.name]=C.typed({...v,min:'',max:''},data.values[v.name]);}
        this.values=next;this.lastRead=Date.now();this.roundtrip=Date.now()-start;this.good=true;this.message=`NX HTTP v1 · ${this.roundtrip} ms · lectura solicitada cada ${this.p.connection.pollMs} ms`;this.evaluateAlarms();
      }catch(e){if(this.stopped)return;this.good=false;this.armed=false;this.message=`Sin conexión: ${e.message}. No hay datos simulados de sustitución.`;}}
      this.paint();if(!this.stopped)this.timer=setTimeout(()=>this.poll(),Math.max(this.good?10:1000,this.p.connection.pollMs-(Date.now()-start)));
    }
    async write(raw){
      if(!this.canWrite()||this.busy){this.commandMessage='Escritura bloqueada: revise conexión, permisos y habilitación.';this.paint();return false;}
      try{
        const values={};for(const [name,value] of Object.entries(raw)){const v=this.p.variables.find(v=>v.name===name);if(!v||v.access!=='RW')throw new Error(`Variable sin permiso: ${name}`);values[name]=C.typed(v,value);}
        if(!Object.keys(values).length)throw new Error('Lote vacío');this.busy=true;this.paint();
        if(this.sim){Object.assign(this.values,values);this.commandMessage='Lote aplicado al simulador';this.evaluateAlarms();}
        else{
          const commandId=`${this.session}:${++this.sequence}`;
          const ack=await this.request('/api/hmi/write',{commandId,atomic:true,values});
          if(this.stopped)return false;
          if(ack.commandId!==commandId||ack.accepted!==true||ack.applied!==true)throw new Error('Falta confirmación completa del lote. Verifique el PLC; no se reintenta.');
          this.commandMessage='Lote confirmado por el adaptador; el estado se confirma en la siguiente lectura.';
        }return true;
      }catch(e){this.commandMessage=`Escritura no confirmada: ${e.message}`;if(!this.sim)this.armed=false;return false;}
      finally{this.busy=false;if(!this.stopped)this.paint();}
    }
    stop(){this.stopped=true;this.generation++;this.armed=false;clearTimeout(this.timer);clearInterval(this.timer);this.controllers.forEach(c=>c.abort());this.resizeObserver.disconnect();document.removeEventListener('visibilitychange',this.visibility);}
  }
  root.NXRuntime={Runtime,widget,refreshWidget,initial};
})(globalThis);
