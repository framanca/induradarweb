import { minify } from "npm:terser@5.44.0";
function safeJSONStringify(o) { return JSON.stringify(o).replace(/[<>&\u2028\u2029]/g,c=>"\\u"+c.charCodeAt(0).toString(16).padStart(4,"0")); }

function reduceJpeg(b) {
 if(b.length<4||b[0]!==255||b[1]!==216)return b;
 const parts=[b.subarray(0,2)];let i=2,removed=false;
 while(i+4<=b.length&&b[i]===255) {
  const marker=b[i+1];
  if(marker===0xda){parts.push(b.subarray(i));i=b.length;break}
  if(marker===0xd9){parts.push(b.subarray(i));i=b.length;break}
  if(marker===0x00||marker===0xff||marker>=0xd0&&marker<=0xd7) return b;
  const len=(b[i+2]<<8)+b[i+3];if(len<2||i+2+len>b.length)return b;
  const raw=b.subarray(i,i+2+len);
  const xmp=marker===0xe1&&String.fromCharCode(...b.subarray(i+4,Math.min(i+50,b.length))).startsWith("http://ns.adobe.com/xap/");
  if(marker===0xfe||xmp)removed=true;else parts.push(raw);
  i+=2+len;
 }
 if(i!==b.length||!removed)return b;
 const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let pos=0;for(const p of parts){out.set(p,pos);pos+=p.length}return out;
}

function reducePng(b) {
 if(b.length<12||[137,80,78,71,13,10,26,10].some((n,i)=>b[i]!==n))return b;
 const parts=[b.subarray(0,8)];let i=8,removed=false,complete=false;
 while(i+12<=b.length){
  const len=((b[i]*16777216)+(b[i+1]<<16)+(b[i+2]<<8)+b[i+3])>>>0;
  if(len> b.length-i-12)return b;
  const type=String.fromCharCode(...b.subarray(i+4,i+8));
  if(["tEXt","zTXt","iTXt","tIME"].includes(type))removed=true;
  else parts.push(b.subarray(i,i+len+12));
  i+=len+12;
  if(type==="IEND"){complete=true;break}
 }
 if(!complete||!removed)return b;
 const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let off=0;for(const p of parts){out.set(p,off);off+=p.length}return out;
}

function readImageSize(bytes,mime){
 if(mime==="image/png"&&bytes.length>24&&bytes[0]===137) return {w:(bytes[16]*16777216+bytes[17]*65536+bytes[18]*256+bytes[19])>>>0,h:(bytes[20]*16777216+bytes[21]*65536+bytes[22]*256+bytes[23])>>>0};
 if(mime==="image/jpeg"||mime==="image/jpg"){
  if(bytes[0]!==255||bytes[1]!==216)return null;
  let i=2;while(i+10<bytes.length&&bytes[i]===255){
   const marker=bytes[i+1],len=(bytes[i+2]<<8)+bytes[i+3];
   if(len<2||i+2+len>bytes.length)break;
   if([0xc0,0xc1,0xc2,0xc3].includes(marker))return {w:(bytes[i+7]<<8)+bytes[i+8],h:(bytes[i+5]<<8)+bytes[i+6]};
   if(marker===0xda)break;i+=2+len;
  }
 }
 return null;
}

function bilinearRGBA(src,sw,sh,dw,dh){
 const dst=new Uint8Array(dw*dh*4);
 for(let y=0;y<dh;y++){
  const sy=Math.max(0,(y+.5)*sh/dh-.5),y0=Math.floor(sy),y1=Math.min(sh-1,y0+1),fy=sy-y0;
  for(let x=0;x<dw;x++){
   const sx=Math.max(0,(x+.5)*sw/dw-.5),x0=Math.floor(sx),x1=Math.min(sw-1,x0+1),fx=sx-x0;
   const p00=(y0*sw+x0)*4,p10=(y0*sw+x1)*4,p01=(y1*sw+x0)*4,p11=(y1*sw+x1)*4,q=(y*dw+x)*4;
   for(let k=0;k<4;k++){
    const top=src[p00+k]*(1-fx)+src[p10+k]*fx,bottom=src[p01+k]*(1-fx)+src[p11+k]*fx;
    dst[q+k]=Math.round(top*(1-fy)+bottom*fy);
   }
  }
 }
 return dst;
}

async function downscaleWithoutCanvas(bytes,mime,target) {
 const shape=readImageSize(bytes,mime);
 if(!shape||!Number.isFinite(shape.w*shape.h)||shape.w*shape.h>4194304||shape.w<1||shape.h<1)return bytes;
 if(Math.max(shape.w,shape.h)<=target*1.25)return bytes;
 const ratio=target/Math.max(shape.w,shape.h),w=Math.max(1,Math.round(shape.w*ratio)),h=Math.max(1,Math.round(shape.h*ratio));
 try{
  const {Buffer}=await import("node:buffer");
  let raw,encoded;
  if(mime==="image/png"){
   // Preserve embedded ICC profiles rather than silently changing industrial colors.
   const hasICC=bytes.some((b,i)=>b===105&&bytes[i+1]===67&&bytes[i+2]===67&&bytes[i+3]===80);
   if(hasICC)return bytes;
   const mod=await import("npm:pngjs@7.0.0"),PNG=mod.PNG||mod.default?.PNG;
   const decoded=PNG.sync.read(Buffer.from(bytes));
   if(decoded.width!==shape.w||decoded.height!==shape.h)return bytes;
   raw=bilinearRGBA(decoded.data,shape.w,shape.h,w,h);
   encoded=PNG.sync.write({width:w,height:h,data:Buffer.from(raw)});
  }else if(mime==="image/jpeg"||mime==="image/jpg"){
   // EXIF orientation must not be lost by re-encoding.
   for(let i=2;i+10<bytes.length&&bytes[i]===255;){
    const len=(bytes[i+2]<<8)+bytes[i+3];if(len<2||i+2+len>bytes.length)break;
    if(bytes[i+1]===0xe1&&String.fromCharCode(...bytes.subarray(i+4,i+10))==="Exif\u0000\u0000")return bytes;
    if(bytes[i+1]===0xda)break;i+=2+len;
   }
   const mod=await import("npm:jpeg-js@0.4.4"),jpeg=mod.default||mod;
   const decoded=jpeg.decode(Buffer.from(bytes),{useTArray:true,formatAsRGBA:true});
   if(decoded.width!==shape.w||decoded.height!==shape.h)return bytes;
   raw=bilinearRGBA(decoded.data,shape.w,shape.h,w,h);
   encoded=jpeg.encode({width:w,height:h,data:Buffer.from(raw)},94).data;
  }else return bytes;
  return encoded.length<bytes.length?new Uint8Array(encoded):bytes;
 }catch{return bytes}
}

async function improveImage(data,targetPixels) {
 if(typeof data!=="string"||!data.startsWith("data:"))return data;
 const m=/^data:(image\/(?:png|jpe?g|svg\+xml));base64,([\s\S]+)$/i.exec(data);
 if(!m)return data;
 const mime=m[1].toLowerCase(),binary=m[2];
 let bytes;
 try {const s=atob(binary);bytes=Uint8Array.from(s,c=>c.charCodeAt(0));}
 catch{return data}
 if(mime==="image/svg+xml"){
  try {
   let svg=new TextDecoder().decode(bytes);
   svg=svg.replace(/<\?xml[^>]*\?>\s*/g,"").replace(/<!--[\s\S]*?-->/g,"").replace(/<metadata(?:\s[^>]*)?>[\s\S]*?<\/metadata>/gi,"").replace(/>\s+</g,"><");
   const out=new TextEncoder().encode(svg);
   if(out.length<bytes.length)bytes=out;
  }catch{}
 }else{
  bytes=mime==="image/png"?reducePng(bytes):reduceJpeg(bytes);
  if(targetPixels && typeof OffscreenCanvas==="undefined") bytes=await downscaleWithoutCanvas(bytes,mime,targetPixels);
  if(targetPixels && typeof OffscreenCanvas!=="undefined" && typeof createImageBitmap==="function"){
   try {
    const bmp=await createImageBitmap(new Blob([bytes],{type:mime}));
    if(Math.max(bmp.width,bmp.height)>targetPixels*1.25){
     const ratio=targetPixels/Math.max(bmp.width,bmp.height);
     const w=Math.max(1,Math.round(bmp.width*ratio)),h=Math.max(1,Math.round(bmp.height*ratio));
     const canvas=new OffscreenCanvas(w,h);canvas.getContext("2d").drawImage(bmp,0,0,w,h);
     const blob=await canvas.convertToBlob({type:mime,quality:.94});
     const newBytes=new Uint8Array(await blob.arrayBuffer());
     if(newBytes.length<bytes.length)bytes=newBytes;
    }
    bmp.close?.();
   } catch { /* Keep the original graphic if decoding is unavailable. */ }
  }
 }
 if(bytes.length >= Math.floor(binary.length*3/4)-3) return data;
 let coded="";for(let i=0;i<bytes.length;i+=8192)coded+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return "data:"+mime+";base64,"+btoa(coded);
}

async function compactPayload(P,p) {
 const screens=P.screens||[];
 // Compact the common inherited base prefix only if at least two screens benefit.
 let best=null;
 const serial=screens.map(s=>s.objects.map(x=>JSON.stringify(x)));
 for(let i=0;i<screens.length;i++)for(let j=i+1;j<screens.length;j++){
  let n=0;while(n<serial[i].length&&n<serial[j].length&&serial[i][n]===serial[j][n])n++;
  if(!n)continue;
  const group=[];for(let k=0;k<screens.length;k++)if(serial[k].length>=n&&serial[i].slice(0,n).every((v,t)=>serial[k][t]===v))group.push(k);
  if(group.length<2)continue;
  const size=serial[i].slice(0,n).reduce((sum,v)=>sum+v.length+1,0);
  const gain=(group.length-1)*size-70;
  if(gain>30&&(!best||gain>best.gain))best={n,group,i,gain};
 }
 if(best){
  P.baseObjects=screens[best.i].objects.slice(0,best.n);
  for(const idx of best.group){screens[idx].objects=screens[idx].objects.slice(best.n);screens[idx]._base=1;}
 }
 // Pool identical style/property sets, without losing any original object fields.
 const styleKeys=new Set(["fontSize","symbolType","lampOnColor","stateOnWhen","actionType","actionMode","confirmationText","expressionColor","expressionBackground","expressionVisible","feedbackColorOff","feedbackColorOn","feedbackTextOff","feedbackTextOn","decimals","shapeType","shapeFill","shapeStroke","shapeStrokeWidth","shapePoints","inputMin","inputMax","min","max","step","optionsText","unit","target"]);
 const list=[...(P.baseObjects||[]),...screens.flatMap(s=>s.objects)];
 const counts=new Map(),defs=new Map();
 for(const o of list){
  const style={};for(const [k,v] of Object.entries(o))if(styleKeys.has(k))style[k]=v;
  const key=JSON.stringify(style);if(key==="{}")continue;
  counts.set(key,(counts.get(key)||0)+1);defs.set(key,style);
 }
 const chosen=[...counts.entries()].filter(([k,n])=>(n-1)*k.length>n*9+15).sort((a,b)=>b[1]*b[0].length-a[1]*a[0].length);
 if(chosen.length){
  P.styles=chosen.map(([k])=>defs.get(k));
  const refs=new Map(chosen.map(([k],i)=>[k,i]));
  for(const o of list){
   const style={};for(const [k,v] of Object.entries(o))if(styleKeys.has(k))style[k]=v;
   const idx=refs.get(JSON.stringify(style));if(idx===undefined)continue;
   for(const k of Object.keys(style))delete o[k];
   o.$s=idx;
  }
 }
 // Strip nonvisual metadata and optionally downscale sufficiently over-sized images.
 const used=new Map();const scale=Math.max(1,Number(p?.maxDisplayWidth||1920)/Math.max(1,Number(p?.width||1024)));
 const originals=[...screens.flatMap(s=>s.objects),...(P.baseObjects||[])];
 for(const o of originals)if(o.kind==="image"){
  for(const id of [o.assetId,o.assetOnId])if(id)used.set(id,Math.max(used.get(id)||0,Math.ceil(Math.max(Number(o.w)||0,Number(o.h)||0)*scale*2)));
 }
 for(const a of P.assets||[])a.data=await improveImage(a.data,used.get(a.id)||0);
 const repeated=new Map();for(const a of P.assets||[])if(typeof a.data==="string")repeated.set(a.data,(repeated.get(a.data)||0)+1);
 const pool=[],index=new Map();
 for(const a of P.assets||[])if(repeated.get(a.data)>1){
  let i=index.get(a.data);if(i===undefined){i=pool.length;pool.push(a.data);index.set(a.data,i)}
  delete a.data;a.$a=i;
 }
 if(pool.length)P.assetPool=pool;
 return P;
}

function hydrateSource(){
 return `if(P.styles||P.baseObjects){const rev=o=>{if(o.$s===undefined)return o;const {$s,...rest}=o;return {...P.styles[$s],...rest}};if(P.baseObjects)P.baseObjects=P.baseObjects.map(rev);for(const s of P.screens){s.objects=s.objects.map(rev);if(s._base){s.objects=[...P.baseObjects,...s.objects];delete s._base}}}if(P.assetPool)for(const a of P.assets)if(a.$a!==undefined){a.data=P.assetPool[a.$a];delete a.$a}`;
}

async function optimizeEmbeddedHTML(html,project) {
 const marker="<script>const P=",a=html.indexOf(marker),b=html.lastIndexOf("</script>");
 if(a<0||b<a)throw Error("Formato HTML incompatible con optimizador");
 const start=a+marker.length,separator=html.indexOf(";\n",start);
 if(separator<start||separator>b)throw Error("Datos HTML incorrectos");
 const payloadText=html.slice(start,separator),original=P=>P;
 const P=await compactPayload(JSON.parse(payloadText),project);
 let prefix=html.slice(0,a);
 if(!(project.recipes?.length||project.recipeVariables?.length)){
  prefix=prefix.replace(/<button type="button" id="recipeOpen"[^>]*>Recetas<\/button>/,"");
  const k=prefix.indexOf('<div id="recipeWindow"'),end=prefix.indexOf('<div id="popupWindow"',k);
  if(k>=0&&end>k)prefix=prefix.slice(0,k)+prefix.slice(end);
 }
 prefix=prefix.replace(/<style>([\s\S]*?)<\/style>/,(_,css)=>{
  const compact=css.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\s*([{};])\s*/g,"$1").replace(/;}/g,"}");
  return "<style>"+compact+"</style>";
 });
 let runtime=html.slice(separator+1,b);
 const kinds=new Set((project.screens||[]).flatMap(s=>(s.objects||[]).map(o=>o.kind)));
 if(project.baseScreen)for(const o of project.baseScreen.objects||[])kinds.add(o.kind);
 const allKinds=new Set(["bar","button","counter","dropdown","gauge","image","input","multistate","selector","shape","slider","status","stepper","switch","tank","text","value"]);
 runtime=runtime.replace(/o\.kind===["']([A-Za-z]+)["']/g,(raw,kind)=>allKinds.has(kind)&&!kinds.has(kind)?"false":raw);
 const controls=["slider","switch","selector","multistate","gauge","stepper","counter","dropdown"];
 if(!controls.some(x=>kinds.has(x)))runtime=runtime.replace('["slider","switch","selector","multistate","gauge","stepper","counter","dropdown"].includes(o.kind)',"false");
 const input="const P="+safeJSONStringify(P)+";"+hydrateSource()+runtime;
 let minimized;
 try {
  minimized=await minify(input,{compress:{defaults:true,passes:2,toplevel:true},mangle:{toplevel:false},format:{comments:false,ascii_only:true,inline_script:true}});
  if(!minimized.code)throw Error("Minification returned empty code");
 }catch(e){throw Error("No se pudo minificar JS: "+String(e))}
 return prefix+"<script>"+minimized.code+"</script>"+html.slice(b+"</script>".length);
}
export {optimizeEmbeddedHTML};
