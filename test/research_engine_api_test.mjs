// Execute actual Edge handlers in an isolated Node shim, without Supabase/network.
// Deno deployment and native staging acceptance remain separate checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import * as XLSX from 'xlsx';
import {normalizeEngineRequest,contractFromLead} from '../site/engine-contract.mjs';
import {workbookFromApprovedJson} from '../site/report/engine-report.mjs';

function load(name,values={},suffix='') {
  const source=fs.readFileSync(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8')
    .replace(/^import .*;\s*$/gm,'');
  let handler;
  const context=vm.createContext({Response,Headers,Request,URL,Date,crypto,console,
    normalizeEngineRequest,contractFromLead,workbookFromApprovedJson,XLSX,...values,
    Deno:{env:{get:key=>values.env?.[key]},serve:fn=>{handler=fn;}}});
  vm.runInContext(stripTypeScriptTypes(source+suffix),context);
  return {handler,context};
}

const contract={policy_version:'RE1.0.0',mode:'signal_discovery',scope:'open_market',
  offer:'Automatización',target_company_types:['machine_builder_oem'],territories:[{country:'España',province:'Albacete'}]};
const lead={contact:{email:'fixture@example.invalid',company_name:'Fixture'},privacy:{privacy_notice_accepted:true},
  seller_profile:{offer:contract.offer},request:{research_objective:'signal_discovery',
    target_company_types:contract.target_company_types,geographies:contract.territories},engine_contract:contract};
function request(body){return new Request('http://fixture.invalid',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer fixture-token'},body:JSON.stringify(body)});}

test('actual intake handler fails closed before any write when RE1 policy/authentication is unavailable',async()=>{
  let writes=0;
  const env={SUPABASE_URL:'http://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-only',LEADS_ACCOUNT_ID:'server-account'};
  const db={auth:{getUser:async()=>({data:{user:{id:'operator'}},error:null})},rpc:async()=>({data:{ready:false},error:null}),
    from:()=>({insert:async()=>{writes++;return {};}})};
  const createClient=()=>db;
  assert.equal((await load('submit-lead',{env,createClient}).handler(request(lead))).status,503);
  env.RESEARCH_ENGINE_ENABLED='true';
  assert.equal((await load('submit-lead',{env,createClient}).handler(request(lead))).status,503);
  db.auth.getUser=async()=>({data:{user:null},error:{message:'fixture invalid'}});
  assert.equal((await load('submit-lead',{env,createClient}).handler(request(lead))).status,401);
  const historical=structuredClone(lead);historical.request.research_objective='balanced';
  assert.equal((await load('submit-lead',{env,createClient}).handler(request(historical))).status,400);
  assert.equal(writes,0);
});

test('accepted intake uses server account, stable submission and exact native documentary versions',async()=>{
  let inserted;
  const versions={contract_version:'1.5.0',execution_contract_version:'1.14.0',manifest_version:'1.13.0'};
  const db={auth:{getUser:async()=>({data:{user:{id:'operator'}},error:null})},
    rpc:async()=>({data:{version:'RE1.0.0',ready:true,operator_user_ids:['operator'],expected_versions:versions},error:null}),
    from:()=>({insert:async row=>{inserted=row;return {};}})};
  const {handler}=load('submit-lead',{env:{SUPABASE_URL:'http://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-only',
    LEADS_ACCOUNT_ID:'server-account',RESEARCH_ENGINE_ENABLED:'true'},createClient:()=>db});
  const body=structuredClone(lead);body.submission_id='11111111-1111-4111-8111-111111111111';
  body.engine_contract.account_id='attacker-assigned';body.engine_contract.extension_authorization='fake';
  const result=await handler(request(body));assert.equal(result.status,200);
  assert.equal(inserted.account_id,'server-account');assert.equal(inserted.submission_id,body.submission_id);
  assert.equal(inserted.normalized_scope.engine_contract.account_id,'server-account');
  assert.equal(inserted.normalized_scope.engine_contract.extension_authorization,null);
  assert.equal(inserted.form_payload.engine_contract.account_id,'server-account');
  assert.equal(inserted.contract_version,'1.5.0');
  assert.deepEqual(JSON.parse(JSON.stringify(inserted.form_payload.stack_configuration.expected_versions)),versions);
  inserted=null;body.engine_contract.offer='Otra oferta incompatible con el formulario';
  assert.equal((await handler(request(body))).status,400);
  assert.equal(inserted,null,'material scope differences must be resolved before persistence');
});

test('actual report exporter refuses fixture approval and reuses the complete approved JSON',()=>{
  const {context}=load('get-report',{},'\nglobalThis.exportWorkbook=workbook;');
  const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/research-engine-approved.json',import.meta.url)));
  assert.throws(()=>context.exportWorkbook({payload:fixture}),/native_research_engine_acceptance_required/);
  fixture.metadata.research_engine.approval.native_release_accepted=true;
  fixture.metadata.research_engine.approval.production_publication_authorized=true;
  const bytes=context.exportWorkbook({payload:fixture});
  const wb=XLSX.read(bytes,{type:'buffer'});
  assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Universo).length,fixture.companies.length);
  assert.deepEqual(Buffer.from(bytes),Buffer.from(workbookFromApprovedJson(XLSX,fixture)));
});
