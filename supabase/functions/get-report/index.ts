import * as XLSX from "npm:xlsx@0.18.5";
import { createClient } from "npm:@supabase/supabase-js@2";

const origins = new Set((Deno.env.get("REPORT_ALLOWED_ORIGINS") || "https://induradar.com,https://www.induradar.com").split(",").map((x)=>x.trim()).filter(Boolean));
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const SITE = (Deno.env.get("REPORT_PUBLIC_BASE_URL") || "https://induradar.com").replace(/\/+$/, "");

function headers(origin:string|null, type="application/json; charset=utf-8") {
  const h=new Headers({"Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Expose-Headers":"Content-Disposition, Content-Length","Cache-Control":"private, no-store, max-age=0","Content-Type":type,"Vary":"Origin","X-Content-Type-Options":"nosniff"});
  if(origin && origins.has(origin)) h.set("Access-Control-Allow-Origin",origin);
  return h;
}
function respond(body:Record<string,unknown>,status:number,origin:string|null){return new Response(JSON.stringify(body),{status,headers:headers(origin)});}
function obj(v:any){return v&&typeof v==="object"&&!Array.isArray(v)?v:{};}
function arr(v:any){return Array.isArray(v)?v:[];}
function txt(v:any):string{
  if(v===null||v===undefined)return "";
  if(typeof v==="string")return v.trim();
  if(typeof v==="number"||typeof v==="boolean")return String(v);
  if(Array.isArray(v))return v.map((x)=>typeof x==="string"||typeof x==="number"?String(x):String(obj(x).label||obj(x).name||obj(x).title||obj(x).value||"")).filter(Boolean).join(" · ");
  const o=obj(v); return String(o.label||o.name||o.title||o.summary||"").trim();
}
function safe(v:any):string|number|boolean{
  if(typeof v==="number"||typeof v==="boolean")return v;
  const s=txt(v); return /^[=+\-@]/.test(s)?"'"+s:s;
}
function refs(v:any){return arr(v).map((x)=>typeof x==="string"?x:String(obj(x).canonical_url||obj(x).url||"")).filter(Boolean).join("\n");}
function typeLabel(code:any){
  const m:any={industrial_manufacturer:"Fabricante industrial / planta",machine_builder_oem:"Fabricante de maquinaria / OEM",engineering_integrator_epc:"Ingeniería / integrador / EPC",component_manufacturer:"Fabricante de componentes",technology_provider:"Proveedor tecnológico",industrial_distributor:"Distribuidor industrial",industrial_services_maintenance:"Servicios / mantenimiento industrial",logistics_operator:"Operador logístico",technology_research_center:"Centro tecnológico / investigación"};
  const k=txt(code); return m[k]||k.replaceAll("_"," ");
}
function signalLabel(code:any){
  const m:any={new_factory:"Nueva fábrica",facility_expansion:"Ampliación de instalaciones",new_production_line:"Nueva línea de producción",machinery_purchase_renewal:"Compra o renovación de maquinaria",automation_robotization:"Automatización o robotización",industrial_digitalization:"Digitalización industrial",energy_decarbonization:"Energía o descarbonización",quality_inspection_traceability:"Calidad, inspección o trazabilidad",maintenance_modernization:"Modernización o mantenimiento",tender_procurement:"Licitación o compra pública",grant_public_aid:"Ayuda o subvención",international_expansion:"Expansión internacional",product_machine_redesign:"Nuevo producto o rediseño",capacity_increase:"Aumento de capacidad",key_hiring:"Contratación relevante",industrial_real_estate_move:"Nueva nave, traslado o suelo industrial",merger_acquisition_ownership_change:"Cambio corporativo / M&A",strategic_partnership:"Alianza estratégica",new_executive:"Nuevo responsable",fair_product_launch:"Feria o lanzamiento",operational_problem:"Problema operativo"};
  const k=txt(code); return m[k]||k.replaceAll("_"," ");
}
function get(root:any, keys:string[]){return keys.reduce((v,k)=>obj(v)[k],root);}
function addSheet(wb:any,name:string,rows:any[],widths:number[]){
  const clean=rows.map((r)=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,safe(v)])));
  const ws=clean.length?XLSX.utils.json_to_sheet(clean):XLSX.utils.aoa_to_sheet([["Sin datos"]]);
  ws["!cols"]=widths.map((wch)=>({wch}));
  XLSX.utils.book_append_sheet(wb,ws,name);
}
function workbook(envelope:any){
  const p=obj(envelope.payload), ref=txt(envelope.report_reference), asOf=txt(envelope.as_of);
  const opps=arr(get(p,["portfolio_summary","client_layers","signal_opportunities"]));
  const profiles=arr(get(p,["section_narratives","company_profiles_v1","items"]));
  const universe=arr(get(p,["portfolio_summary","client_layers","company_universe"]));
  const ecosystem=arr(p.ecosystem), sources=arr(p.source_index), executive=obj(p.executive_summary), scope=obj(p.scope);
  const byId=new Map(),byName=new Map();
  for(const raw of profiles){const q=obj(raw); if(q.company_id)byId.set(String(q.company_id),q); if(q.name)byName.set(String(q.name).toLocaleLowerCase("es"),q);}
  const prof=(op:any)=>byId.get(String(op.company_id||""))||byName.get(txt(op.company).toLocaleLowerCase("es"))||{};
  const wb=XLSX.utils.book_new();
  wb.Props={Title:"InduRadar "+ref,Subject:"Informe de señales y oportunidades industriales",Author:"InduRadar",Company:"InduRadar",Comments:"Proyección determinista del Report JSON aprobado. No realiza investigación.",CreatedDate:new Date("2000-01-01T00:00:00Z"),ModifiedDate:new Date("2000-01-01T00:00:00Z")};
  addSheet(wb,"Resumen",[
    {Campo:"Referencia",Valor:ref},{Campo:"Fecha de corte",Valor:asOf},{Campo:"Título",Valor:txt(obj(p.metadata).report_title||scope.title)},
    {Campo:"Objetivo",Valor:txt(scope.research_objective)},{Campo:"Oferta",Valor:txt(scope.offer)},{Campo:"Geografía",Valor:txt(scope.geographies)},
    {Campo:"Sectores",Valor:txt(scope.sectors)},{Campo:"Oportunidades visibles",Valor:opps.length},{Campo:"Universo empresarial",Valor:universe.length||profiles.length},
    {Campo:"Fuentes",Valor:sources.length},{Campo:"Conclusión ejecutiva",Valor:txt(executive.conclusion||executive.summary||executive.main_conclusion)},
    {Campo:"Opportunity Rank",Valor:"0–100, dominado por la señal principal; convergencia adicional decreciente."},
    {Campo:"Temperature",Valor:"Hot = actuar ahora; Warm = ventana próxima; Cold = distante o sin urgencia inmediata."},
    {Campo:"Inventario",Valor:txt(envelope.inventory_hash)}
  ],[30,95]);
  addSheet(wb,"Oportunidades",opps.map((raw)=>{
    const op=obj(raw),q=prof(op),loc=obj(q.primary_location),s=obj(arr(op.signals)[0]),ed=obj(op.editorial);
    return {Orden:Number(op.rank||0)||"","Opportunity Rank":Number(op.opportunity_rank_score||op.signal_score||0)||"",Temperature:txt(op.temperature),"Signal Strength":Number(op.signal_strength||s.signal_strength||0)||"",Earliness:Number(op.earliness||s.earliness||0)||"",Empresa:txt(op.company),"Razón social":txt(q.legal_name),"CIF/NIF":txt(q.tax_id),Tipo:typeLabel(op.company_type||q.company_type_code),Provincia:txt(op.province||loc.province),Población:txt(op.municipality||loc.municipality),País:txt(op.country||loc.country),Web:txt(q.website||op.website),"N.º señales":Number(op.signal_count||arr(op.signals).length),"Señal principal":txt(s.title),"Tipo señal principal":signalLabel(s.signal_type),"Razón del ranking":txt(op.ranking_reason),"Por qué ahora":txt(ed.why_now),"Necesidad probable":txt(ed.probable_need),"Siguiente acción":txt(ed.next_action||op.next_action),"Rol objetivo":txt(op.target_role),Fuentes:refs(op.source_refs)};
  }),[8,16,12,15,12,30,32,15,25,18,18,15,30,10,42,26,72,58,58,58,32,70]);
  const signalRows:any[]=[];
  for(const raw of opps){const op=obj(raw); for(const sr of arr(op.signals)){const s=obj(sr),c=obj(obj(s.signal_rank_profile).components); signalRows.push({Empresa:txt(op.company),"Opportunity Rank":Number(op.opportunity_rank_score||op.signal_score||0)||"",Temperature:txt(s.temperature),"Signal Strength":Number(s.signal_strength||0)||"",Earliness:Number(s.earliness||0)||"","Tipo de señal":signalLabel(s.signal_type),Señal:txt(s.title),Resumen:txt(s.summary),Fecha:txt(s.signal_at).slice(0,10),Materialidad:Number(c.materiality_scale||0)||"",Autoridad:Number(c.authority_quality||0)||"",Independencia:Number(c.independence_corroboration||0)||"",Concreción:Number(c.concreteness||0)||"","Valor incremental":Number(c.incremental_value||0)||"",Fuentes:refs(s.source_refs)});}}
  addSheet(wb,"Señales",signalRows,[30,16,12,15,12,28,55,75,13,13,13,15,13,18,75]);
  const uById=new Map(); for(const raw of universe){const u=obj(raw);if(u.company_id)uById.set(String(u.company_id),u);}
  const universeRows=(universe.length?universe:profiles).map((raw)=>{const u=obj(raw),q=byId.get(String(u.company_id||""))||byName.get(txt(u.company||u.name).toLocaleLowerCase("es"))||u,loc=obj(q.primary_location);return {Empresa:txt(q.name||u.company||u.name),"Razón social":txt(q.legal_name||u.legal_name),"CIF/NIF":txt(q.tax_id||u.tax_id),Tipo:typeLabel(q.company_type_code||u.company_type),Actividad:txt(q.activity_summary||u.activity),Provincia:txt(loc.province||u.province),Población:txt(loc.municipality||u.municipality),País:txt(loc.country||u.country),Web:txt(q.website||u.website),"Familias de producto":txt(q.product_family||u.product_family),"Áreas de aplicación":txt(q.application_area||u.application_area),Servicios:txt(q.service||u.service),Capacidades:txt(q.capability||u.capability),Estado:txt(u.research_status||u.review_status||u.status)};});
  addSheet(wb,"Universo",universeRows,[30,32,15,28,65,18,18,15,30,48,48,48,48,28]);
  addSheet(wb,"Ecosistema",ecosystem.map((raw)=>{const e=obj(raw);return {Actor:txt(e.actor||e.company||e.name||e.title),Rol:txt(e.role||e.type||e.classification||e.actor_role),Relevancia:txt(e.commercial_relevance||e.relevance||e.summary||e.rationale),Relación:txt(e.relationship||e.relation||e.relationship_to_opportunity||e.project_role),Trigger:txt(e.trigger||e.current_trigger||e.signal),Fuentes:refs(e.source_refs)};}),[32,26,62,52,48,70]);
  addSheet(wb,"Fuentes",sources.map((raw)=>{const s=obj(raw);return {Fuente:txt(s.source_name||s.name),Documento:txt(s.title||s.source_title),Tipo:txt(s.source_type),Dominio:txt(s.domain),URL:txt(s.canonical_url||s.url),Publicación:txt(s.published_at).slice(0,10),Verificación:txt(s.verified_at||s.last_verified_at||s.captured_at).slice(0,10)};}),[28,58,22,32,85,14,14]);
  const out=XLSX.write(wb,{type:"array",bookType:"xlsx",compression:true,bookSST:false});
  return out instanceof Uint8Array?out:new Uint8Array(out);
}
async function sha(bytes:Uint8Array){const d=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(d)).map((b)=>b.toString(16).padStart(2,"0")).join("");}
async function rpc(url:string,key:string,auth:string,name:string,body:any){return fetch(url+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:key,authorization:auth,"Content-Type":"application/json"},body:JSON.stringify(body)});}

Deno.serve(async(req)=>{
  const origin=req.headers.get("origin"), allowed=origin!==null&&origins.has(origin);
  if(req.method==="OPTIONS")return allowed?new Response(null,{status:204,headers:headers(origin)}):respond({success:false,error:"origin_not_allowed"},403,origin);
  if(!allowed)return respond({success:false,error:"origin_not_allowed"},403,origin);
  if(req.method!=="GET"&&req.method!=="POST")return respond({success:false,error:"method_not_allowed"},405,origin);
  const auth=req.headers.get("authorization")?.trim()||"";
  if(!auth.toLowerCase().startsWith("bearer "))return respond({success:false,error:"authentication_required"},401,origin);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon)return respond({success:false,error:"service_unavailable"},503,origin);
  let ref="",format="json",action="";
  if(req.method==="GET"){const u=new URL(req.url);ref=(u.searchParams.get("ref")||"").trim().toUpperCase();format=(u.searchParams.get("format")||"json").trim().toLowerCase();}
  else{let b:any;try{b=obj(await req.json());}catch{return respond({success:false,error:"invalid_json"},400,origin);}ref=String(b.ref||"").trim().toUpperCase();format=String(b.format||"xlsx").trim().toLowerCase();action=String(b.action||"").trim().toLowerCase();}
  if(!/^IR-[0-9]{8}-[0-9A-HJKMNP-TV-Z]{6}$/.test(ref))return respond({success:false,error:"invalid_reference"},400,origin);

  if(req.method==="POST"){
    if(action!=="email_download_link"||format!=="xlsx")return respond({success:false,error:"invalid_action"},400,origin);
    const chk=await rpc(url,anon,auth,"get_xlsx_export_payload_by_reference_v1",{p_report_reference:ref});
    if(chk.status===401||chk.status===403)return respond({success:false,error:"authentication_required"},403,origin);
    if(!chk.ok)return respond({success:false,error:"report_not_available"},404,origin);
    const ur=await fetch(url+"/auth/v1/user",{headers:{apikey:anon,authorization:auth}});
    if(!ur.ok)return respond({success:false,error:"authentication_required"},403,origin);
    const email=txt(obj(await ur.json()).email);if(!email)return respond({success:false,error:"email_not_available"},400,origin);
    const rk=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("REPORT_DELIVERY_FROM_EMAIL")||Deno.env.get("REQUEST_NOTIFICATION_FROM_EMAIL")||"InduRadar <onboarding@resend.dev>";
    if(!rk)return respond({success:false,error:"email_not_configured"},503,origin);
    const dl=SITE+"/report/?ref="+encodeURIComponent(ref)+"&download=xlsx";
    const er=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+rk,"Content-Type":"application/json"},body:JSON.stringify({from,to:[email],subject:"InduRadar "+ref+" — descargar Excel",text:"Tu Excel de InduRadar está disponible en este enlace seguro:\n"+dl+"\n\nEl acceso requiere iniciar sesión en InduRadar.",html:"<h2>"+ref+"</h2><p>Tu Excel de InduRadar está disponible.</p><p><a href=\""+dl+"\">Descargar Excel</a></p><p>El acceso requiere iniciar sesión en InduRadar.</p>"})});
    if(!er.ok)return respond({success:false,error:"email_delivery_failed"},502,origin);
    const ep=obj(await er.json());return respond({success:true,report_reference:ref,recipient:email,provider_message_id:ep.id||null},200,origin);
  }

  if(!["json","html","xlsx"].includes(format))return respond({success:false,error:"invalid_format"},400,origin);
  if(format==="xlsx"){
    const pr=await rpc(url,anon,auth,"get_xlsx_export_payload_by_reference_v1",{p_report_reference:ref});
    if(pr.status===401||pr.status===403)return respond({success:false,error:"authentication_required"},403,origin);
    if(!pr.ok){
      let detail:any=null;try{detail=await pr.json();}catch{}
      return respond({success:false,error:"xlsx_payload_unavailable",detail:obj(detail)},503,origin);
    }
    let env:any;
    try{env=obj(await pr.json());}catch{return respond({success:false,error:"xlsx_payload_invalid"},503,origin);}
    let bytes:Uint8Array;
    try{bytes=workbook(env);}catch(e){
      return respond({success:false,error:"xlsx_render_failed",detail:String(e?.message||e||"render_failed")},503,origin);
    }
    const filename=txt(env.artifact_filename)||("InduRadar_Datos_"+ref+".xlsx");
    const h=headers(origin,XLSX_MIME);
    h.set("Content-Disposition","attachment; filename=\""+filename.replaceAll("\"","")+"\"");
    h.set("Content-Length",String(bytes.byteLength));
    h.set("X-InduRadar-XLSX-Mode","direct-deterministic-v2");
    return new Response(bytes,{status:200,headers:h});
  }

  const name=format==="html"?"get_web_report_html_delivery_by_reference_v1":"get_web_report_payload_by_reference_v1";
  let up:Response;try{up=await rpc(url,anon,auth,name,{p_report_reference:ref});}catch{return respond({success:false,error:"service_unavailable"},503,origin);}
  if(up.status===401||up.status===403)return respond({success:false,error:"authentication_required"},403,origin);
  if(!up.ok)return respond({success:false,error:"report_not_available"},404,origin);
  let p:any;try{p=await up.json();}catch{return respond({success:false,error:"service_unavailable"},503,origin);}
  if(format==="html"){
    const d=obj(p);if(d.mode==="legacy")return respond({success:false,error:"legacy_report"},409,origin);
    if(d.mode==="blocked")return respond({success:false,error:"canonical_html_required"},503,origin);
    if(d.mode!=="canonical"||typeof d.html!=="string"||!d.html.trim())return respond({success:false,error:"invalid_canonical_html"},503,origin);
    return new Response(d.html,{status:200,headers:headers(origin,"text/html; charset=utf-8")});
  }
  if(!p||typeof p!=="object"||Array.isArray(p))return respond({success:false,error:"invalid_report_payload"},503,origin);
  return new Response(JSON.stringify(p),{status:200,headers:headers(origin)});
});