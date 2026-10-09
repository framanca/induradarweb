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
