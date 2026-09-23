/* HMI NX 0.1.0 — standalone project model; no external dependencies. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const TYPES = ['BOOL','DINT','REAL','STRING'];
  const KINDS = ['text','rectangle','button','lamp','value','input','bar','image','alarms','recipes'];
  const FORBIDDEN = /(^|\.)(__proto__|prototype|constructor)($|\.)/;
  const copy = value => JSON.parse(JSON.stringify(value));
  const id = () => globalThis.crypto?.randomUUID?.() || `nx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nameOK = value => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.\[\]]{0,119}$/.test(value) && !FORBIDDEN.test(value);
  const typeOf = value => String(value || '').trim().toUpperCase().replace(/^STRING\s*\[\s*\d+\s*\]$/, 'STRING');
  function typed(variable, raw) {
    const type = typeOf(variable.type);
    if (type === 'BOOL') {
      if ([true,1,'1','true','TRUE'].includes(raw)) return true;
      if ([false,0,'0','false','FALSE'].includes(raw)) return false;
      throw new Error(`${variable.name}: use TRUE/FALSE o 1/0`);
    }
    if (type === 'STRING') {
      if (raw == null || typeof raw === 'object') throw new Error(`${variable.name}: texto no válido`);
      const text = String(raw);
      if (text.length > 255) throw new Error(`${variable.name}: máximo 255 caracteres`);
      return text;
    }
    if (!['REAL','DINT'].includes(type)) throw new Error(`${variable.name}: tipo no soportado (${type})`);
    if (raw === '' || raw == null || typeof raw === 'boolean' || typeof raw === 'object') throw new Error(`${variable.name}: número requerido`);
    const n = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(n)) throw new Error(`${variable.name}: número no válido`);
    if (type === 'DINT' && (!Number.isInteger(n) || n < -2147483648 || n > 2147483647)) throw new Error(`${variable.name}: fuera del rango DINT`);
    if (type === 'REAL' && !Number.isFinite(Math.fround(n))) throw new Error(`${variable.name}: fuera del rango REAL`);
    if (variable.min !== '' && variable.min != null && n < Number(variable.min)) throw new Error(`${variable.name}: menor que ${variable.min}`);
    if (variable.max !== '' && variable.max != null && n > Number(variable.max)) throw new Error(`${variable.name}: mayor que ${variable.max}`);
    return n;
  }
  function newProject() {
    return {schemaVersion:VERSION,id:id(),name:'Mi proyecto NX102',width:1024,height:600,
      connection:{profile:'simulation',baseUrl:'http://192.168.250.1:81',sameOrigin:true,pollMs:250,timeoutMs:2500,allowWrites:false},
      variables:[],screens:[{id:id(),name:'Principal',background:'#101c2c',objects:[]}],assets:[],recipes:[],alarms:[]};
  }
  function newObject(kind, x=40, y=40) {
    const big = ['alarms','recipes'].includes(kind);
    return {id:id(),kind,x,y,w:big?460:kind==='lamp'?80:180,h:big?240:kind==='lamp'?80:56,
      text:({text:'Texto',rectangle:'',button:'Botón',lamp:'Estado',value:'Valor',input:'Consigna',bar:'Nivel',image:'Imagen',alarms:'Alarmas',recipes:'Recetas'})[kind] || kind,
      color:'#e8f1fb',background:kind==='button'?'#246cdb':'#1b2c42',onColor:'#2ed39a',offColor:'#4b596c',fontSize:18,
      binding:'',visibleBinding:'',animation:'none',min:0,max:100,unit:'',digits:1,action:'write',writeValue:'true',targetScreen:'',assetId:''};
  }
  function demoProject() {
    const p=newProject();p.name='Demo · estación NX102';
    p.variables=[
      {name:'Machine.Running',type:'BOOL',access:'RW',initial:false,comment:'Demo: estado conmutable'},
      {name:'Process.Level',type:'REAL',access:'RW',initial:42,min:0,max:100,comment:'Nivel del depósito'},
      {name:'Process.Setpoint',type:'REAL',access:'RW',initial:55,min:0,max:100,comment:'Consigna'},
      {name:'Machine.Fault',type:'BOOL',access:'RW',initial:false,comment:'Alarma de prueba'},
      {name:'Production.Count',type:'DINT',access:'R',initial:1204,comment:'Contador'},
      {name:'Product.Name',type:'STRING',access:'RW',initial:'Formato A',comment:'Producto'}];
    const main=p.screens[0], service={id:id(),name:'Ajustes y alarmas',background:'#101c2c',objects:[]};p.screens.push(service);
    const add=(s,k,props)=>{const o=Object.assign(newObject(k),props);s.objects.push(o);return o;};
    add(main,'text',{x:40,y:28,w:700,h:52,text:'ESTACIÓN DE PROCESO',fontSize:30,background:'#101c2c'});
    add(main,'text',{x:42,y:88,w:850,h:38,text:'NX102 · proyecto de demostración · datos simulados',fontSize:16,color:'#9caec5',background:'#101c2c'});
    add(main,'lamp',{x:42,y:160,w:180,h:96,binding:'Machine.Running',text:'EN MARCHA'});
    add(main,'value',{x:250,y:160,w:220,h:96,binding:'Production.Count',text:'PRODUCCIÓN',digits:0,unit:'uds'});
    add(main,'bar',{x:42,y:292,w:428,h:100,binding:'Process.Level',text:'NIVEL DEL DEPÓSITO',unit:'%'});
    add(main,'button',{x:42,y:434,w:200,h:60,binding:'Machine.Running',text:'MARCHA',writeValue:'true'});
    add(main,'button',{x:266,y:434,w:200,h:60,binding:'Machine.Running',text:'PARO normal',writeValue:'false',background:'#703741'});
    add(main,'input',{x:525,y:160,w:400,h:100,binding:'Process.Setpoint',text:'CONSIGNA',unit:'%'});
    add(main,'input',{x:525,y:292,w:400,h:100,binding:'Product.Name',text:'NOMBRE DEL PRODUCTO'});
    add(main,'button',{x:525,y:434,w:400,h:60,action:'navigate',targetScreen:service.id,text:'Recetas y alarmas →'});
    add(service,'text',{x:40,y:24,w:800,h:50,text:'RECETAS Y DIAGNÓSTICO',fontSize:30,background:'#101c2c'});
    add(service,'recipes',{x:40,y:108,w:435,h:330});
    add(service,'alarms',{x:500,y:108,w:480,h:330});
    add(service,'button',{x:40,y:486,w:250,action:'navigate',targetScreen:main.id,text:'← Principal'});
    add(service,'button',{x:500,y:486,w:225,binding:'Machine.Fault',writeValue:'true',text:'Activar alarma'});
    add(service,'button',{x:745,y:486,w:235,binding:'Machine.Fault',writeValue:'false',text:'Quitar alarma'});
    p.recipes=[{id:id(),name:'Formato A',values:{'Process.Setpoint':55,'Product.Name':'Formato A'}},{id:id(),name:'Formato B',values:{'Process.Setpoint':75,'Product.Name':'Formato B'}}];
    p.alarms=[{id:id(),name:'Fallo de máquina',binding:'Machine.Fault',operator:'eq',value:'true',severity:'high'},
      {id:id(),name:'Nivel alto',binding:'Process.Level',operator:'gt',value:80,severity:'warning'}];return p;
  }
  function validate(p, complete=true) {
    const errors=[];const fail=s=>errors.push(s);
    if (!p || p.schemaVersion!==VERSION) return ['Versión de proyecto no soportada'];
    if (typeof p.id!=='string'||typeof p.name!=='string'||!p.name.trim()) fail('Proyecto sin identidad/nombre');
    if (![p.width,p.height].every(n=>Number.isInteger(n)&&n>=240&&n<=3840)) fail('Resolución: entre 240 y 3840 px');
    for (const key of ['variables','screens','assets','recipes','alarms']) if (!Array.isArray(p[key])) fail(`Falta la lista ${key}`);
    if(errors.length) return errors;
    if(p.variables.length>100) fail('V1: máximo 100 variables');
    if(!p.screens.length||p.screens.length>50) fail('Debe haber entre 1 y 50 pantallas');
    if(JSON.stringify(p).length>20*1024*1024) fail('Proyecto demasiado grande (20 MB)');
    const names=new Set(), identifiers=new Set();
    const checkId=(v,label)=>{if(!v||typeof v.id!=='string'||!v.id||identifiers.has(v.id)) fail(`ID ausente/duplicado: ${label}`);else identifiers.add(v.id);};
    p.variables.forEach(v=>{
      if(!nameOK(v.name)||names.has(v.name)) fail(`Variable no válida/duplicada: ${v.name}`);names.add(v.name);
      if(!TYPES.includes(v.type)||!['R','RW'].includes(v.access)) fail(`Tipo/acceso no soportado: ${v.name}`);
      if(v.min!==''&&v.min!=null&&!Number.isFinite(Number(v.min))) fail(`Mínimo no válido: ${v.name}`);
      if(v.max!==''&&v.max!=null&&!Number.isFinite(Number(v.max))) fail(`Máximo no válido: ${v.name}`);
      if(v.min!==''&&v.min!=null&&v.max!==''&&v.max!=null&&Number(v.min)>Number(v.max)) fail(`Rango invertido: ${v.name}`);
      try{typed(v,v.initial);}catch(e){fail(e.message);}
    });
    const varFor=n=>p.variables.find(v=>v.name===n);
    p.assets.forEach(a=>{checkId(a,'imagen');if(typeof a.data!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.data)||a.data.length>6*1024*1024)fail(`Imagen no segura o demasiado grande: ${a.name}`);});
    const color=v=>typeof v==='string'&&/^#[a-fA-F0-9]{6}$/.test(v);
    p.screens.forEach(s=>{
      checkId(s,'pantalla');if(typeof s.name!=='string'||!color(s.background)||!Array.isArray(s.objects)||s.objects.length>500){fail('Pantalla no válida');return;}
      s.objects.forEach(o=>{
        checkId(o,'objeto');if(!KINDS.includes(o.kind))fail('Objeto desconocido');
        if(![o.x,o.y,o.w,o.h].every(Number.isFinite)||o.w<20||o.h<20||o.x<0||o.y<0||o.x+o.w>p.width+1||o.y+o.h>p.height+1)fail(`Objeto fuera del lienzo: ${o.text||o.id}`);
        if(![o.color,o.background,o.onColor,o.offColor].every(color)) fail(`Color no válido: ${o.text}`);
        if(!Number.isFinite(o.fontSize)||o.fontSize<8||o.fontSize>120)fail('Tamaño de texto no válido');
        if(!['none','blink','rotate'].includes(o.animation))fail('Animación no válida');
        if(complete){
        if(o.binding&&!names.has(o.binding))fail(`Variable no encontrada: ${o.binding}`);
        if(o.visibleBinding&&varFor(o.visibleBinding)?.type!=='BOOL')fail(`Visibilidad requiere BOOL: ${o.text}`);
        if(['lamp','bar','value','input'].includes(o.kind)&&!o.binding)fail(`Asigna una variable a ${o.text||o.kind}`);
        if(o.kind==='lamp'&&o.binding&&varFor(o.binding)?.type!=='BOOL')fail(`La lámpara requiere BOOL: ${o.text}`);
        if(o.kind==='bar'&&(!['DINT','REAL'].includes(varFor(o.binding)?.type)||!Number.isFinite(o.min)||!Number.isFinite(o.max)||o.max<=o.min))fail(`Barra/rango no válido: ${o.text}`);
        if(o.kind==='input'&&o.binding&&varFor(o.binding)?.access!=='RW')fail(`Entrada requiere RW: ${o.text}`);
        if(o.kind==='button'){
          if(!['navigate','write'].includes(o.action))fail('Acción no soportada');
          else if(o.action==='navigate'&&!p.screens.some(s2=>s2.id===o.targetScreen))fail(`Destino no encontrado: ${o.text}`);
          else if(o.action==='write'){
            const v=varFor(o.binding);if(!v||v.access!=='RW')fail(`Botón requiere variable RW: ${o.text}`);
            else try{typed(v,o.writeValue);}catch(e){fail(e.message);}
          }
        }
        if(o.kind==='image'&&!p.assets.some(a=>a.id===o.assetId))fail(`Selecciona imagen: ${o.text}`);
        }
      });
    });
    p.recipes.forEach(r=>{checkId(r,'receta');if(typeof r.name!=='string'||!r.values||Array.isArray(r.values)||typeof r.values!=='object'){fail('Receta no válida');return;}
      for(const [name,value] of Object.entries(r.values)){const v=varFor(name);if(!v||v.access!=='RW')fail(`Receta: ${name} no es RW`);else try{typed(v,value);}catch(e){fail(e.message);}}
    });
    p.alarms.forEach(a=>{checkId(a,'alarma');const v=varFor(a.binding);if(!v||!['eq','gt','ge','lt','le'].includes(a.operator)||!['info','warning','high'].includes(a.severity))fail(`Alarma no válida: ${a.name}`);else try{typed({...v,min:'',max:''},a.value);}catch(e){fail(e.message);}});
    const c=p.connection;
    if(!c||!['simulation','nx-http-v1'].includes(c.profile)||!Number.isInteger(c.pollMs)||c.pollMs<100||c.pollMs>10000||!Number.isInteger(c.timeoutMs)||c.timeoutMs<300||c.timeoutMs>30000||typeof c.allowWrites!=='boolean'||typeof c.sameOrigin!=='boolean')fail('Configuración de conexión no válida');
    else try{const u=new URL(c.baseUrl);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||u.pathname!=='/')fail('Use un origen HTTP(S) sin claves ni rutas');}catch{fail('IP/URL del NX no válida');}
    return [...new Set(errors)];
  }
  function parseProject(text, complete=true) {
    const p=JSON.parse(text,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw new Error('Clave no permitida');return v;});
    const errors=validate(p,complete);if(errors.length)throw new Error(errors.slice(0,12).join('\n'));return p;
  }
  function parseDelimited(text) {
    text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0];
    const sep=first.includes('\t')?'\t':first.includes(';')?';':',';
    let row=[],field='',quoted=false,rows=[];
    for(let i=0;i<text.length;i++){
      const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
      else if(c===sep&&!quoted){row.push(field.trim());field='';}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field='';}
      else field+=c;
    }
    if(quoted)throw new Error('CSV: comillas sin cerrar');row.push(field.trim());if(row.some(Boolean))rows.push(row);return rows;
  }
  function importVariables(text,existing=[]) {
    const rows=parseDelimited(text);if(!rows.length)throw new Error('La tabla está vacía');
    const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_]/g,'');
    const head=rows[0].map(norm);let ni=head.findIndex(s=>['name','nombre','variablename'].includes(s));
    let ti=head.findIndex(s=>['datatype','type','tipo','tipodedatos'].includes(s));
    let ci=head.findIndex(s=>['comment','comentario','comments','description'].includes(s));
    const hasHeader=ni>=0&&ti>=0;if(!hasHeader){ni=0;ti=1;ci=2;}
    const vars=copy(existing),errors=[],seen=new Set(existing.map(v=>v.name));
    (hasHeader?rows.slice(1):rows).forEach((row,i)=>{
      const name=row[ni],type=typeOf(row[ti]);
      if(!nameOK(name)||!TYPES.includes(type))errors.push(`Fila ${i+(hasHeader?2:1)}: ${name||'(sin nombre)'} / ${row[ti]||'(sin tipo)'} no compatible. Use variables puente BOOL/DINT/REAL/STRING.`);
      else if(seen.has(name))errors.push(`Variable duplicada: ${name}`);
      else {seen.add(name);vars.push({name,type,access:'R',initial:type==='BOOL'?false:type==='STRING'?'':0,comment:row[ci]||''});}
    });
    if(vars.length>100)errors.push('V1: máximo 100 variables');
    if(errors.length)throw new Error(errors.join('\n'));return vars;
  }
  function alarmOn(a,values,variables) {
    if(!Object.hasOwn(values,a.binding))return null;
    const v=variables.find(v=>v.name===a.binding);if(!v)return null;
    let threshold;try{threshold=typed({...v,min:'',max:''},a.value);}catch{return null;}
    const value=values[a.binding];return ({eq:()=>value===threshold,gt:()=>value>threshold,ge:()=>value>=threshold,lt:()=>value<threshold,le:()=>value<=threshold})[a.operator]?.() ?? null;
  }
  function mappingCSV(p) {
    const q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
    return '\uFEFF'+[['Name','Data Type','Access','Initial value','Comment'],...p.variables.map(v=>[v.name,v.type,v.access,v.initial,v.comment])].map(row=>row.map(q).join(';')).join('\r\n');
  }
  const apiContract={protocol:'nx-http-v1',version:1,notice:'Contrato PROPIO. No es el protocolo de WebServer_NJ_NX v3.5. Requiere servidor/adaptador implementado y validado.',
    read:{method:'POST',path:'/api/hmi/read',request:{names:['Machine.Running']},response:{values:{'Machine.Running':true}}},
    write:{method:'POST',path:'/api/hmi/write',request:{commandId:'uuid',atomic:true,values:{'Process.Setpoint':55}},response:{commandId:'same-uuid',accepted:true,applied:true}},
    requirements:['Lista blanca y permisos en servidor','Validación de tipos y rangos en PLC','Idempotencia por commandId','Atomicidad de todo el lote o rechazo completo','Sin reintento automático de escrituras','Auth/CSRF/red industrial en adaptador','HTTP 2xx no sustituye el estado real de la máquina']};
  function zip(files) {
    const enc=new TextEncoder(),parts=[],central=[];let offset=0;
    const u16=(v,n,p)=>v.setUint16(p,n,true),u32=(v,n,p)=>v.setUint32(p,n>>>0,true);
    const crc=b=>{let c=0xffffffff;for(const x of b){c^=x;for(let k=0;k<8;k++)c=(c>>>1)^(c&1?0xedb88320:0);}return(c^0xffffffff)>>>0;};
    for(const [name,content] of Object.entries(files)){
      const n=enc.encode(name),b=content instanceof Uint8Array?content:enc.encode(content),sum=crc(b),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);
      u32(v,0x04034b50,0);u16(v,20,4);u16(v,0x800,6);u16(v,33,12);u32(v,sum,14);u32(v,b.length,18);u32(v,b.length,22);u16(v,n.length,26);h.set(n,30);parts.push(h,b);
      const ch=new Uint8Array(46+n.length),cv=new DataView(ch.buffer);u32(cv,0x02014b50,0);u16(cv,20,4);u16(cv,20,6);u16(cv,0x800,8);u16(cv,33,14);u32(cv,sum,16);u32(cv,b.length,20);u32(cv,b.length,24);u16(cv,n.length,28);u32(cv,offset,42);ch.set(n,46);central.push(ch);offset+=h.length+b.length;
    }
    const end=new Uint8Array(22),ev=new DataView(end.buffer),size=central.reduce((a,b)=>a+b.length,0);u32(ev,0x06054b50,0);u16(ev,central.length,8);u16(ev,central.length,10);u32(ev,size,12);u32(ev,offset,16);
    const all=[...parts,...central,end],out=new Uint8Array(all.reduce((a,b)=>a+b.length,0));let at=0;all.forEach(b=>{out.set(b,at);at+=b.length;});return out;
  }
  root.NXCore={VERSION,TYPES,KINDS,copy,id,esc,nameOK,typeOf,typed,newProject,newObject,demoProject,validate,parseProject,importVariables,parseDelimited,alarmOn,mappingCSV,apiContract,zip};
})(globalThis);
