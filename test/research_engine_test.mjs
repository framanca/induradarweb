import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import XLSX from 'xlsx';
import {parseHTML} from 'linkedom';
import {normalizeEngineRequest,parsePortfolio} from '../site/engine-contract.mjs';
import {reportRows,workbookFromApprovedJson,renderEngineDetails,engineMetadata} from '../site/report/engine-report.mjs';
import {buildReportViewModel,renderReport} from '../site/report/renderer.js';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/research-engine-approved.json',import.meta.url),'utf8'));
const context={account_id:'account-from-server',submission_id:'stable-submission',as_of:'2026-11-13'};
const raw={policy_version:'RE1.0.0',mode:'signal_discovery',scope:'open_market',offer:'Automatización',
 target_company_types:['machine_builder_oem'],territories:[{country:'España',province:'Albacete'}]};

test('only two new modes; company sweep is explicit and opportunity sweep is mandatory',()=>{
 assert.equal(normalizeEngineRequest(raw,context).signal_sweep,true);
 assert.equal(normalizeEngineRequest({...raw,territories:[{country:'ES',province:'Albacete'}]},context).territories[0].country,'España');
 assert.equal(normalizeEngineRequest({...raw,mode:'universe_discovery'},context).signal_sweep,false);
 assert.throws(()=>normalizeEngineRequest({...raw,mode:'balanced'},context));
 assert.throws(()=>normalizeEngineRequest({...raw,signal_sweep:false},context));
});
test('pasted portfolio retains unresolved and duplicate-looking members',()=>{
 const members=parsePortfolio('Empresa A | a.example\nEmpresa A | subsidiary.example\nEmpresa pendiente');
 assert.equal(members.length,3);assert.notEqual(members[0].member_key,members[1].member_key);
 assert.equal(members[2].company_id,null);
 assert.throws(()=>normalizeEngineRequest({...raw,scope:'exclusive_portfolio'},context));
});
test('client cannot assign its own account, nominal-people permission or extension authority',()=>{
 const req=normalizeEngineRequest({...raw,account_id:'victim',extension_authorization:'planner-flag'},context);
 assert.equal(req.account_id,context.account_id);assert.equal(req.extension_authorization,null);
 assert.throws(()=>normalizeEngineRequest({...raw,named_contacts_authorized:true},context));
});
test('JSON, web and workbook preserve the complete inventory, signals, sources, states and deltas',()=>{
 assert.equal(Object.keys(fixture).length,36);
 assert.equal(fixture.report_schema_version,'2.0.0');
 assert.ok(!('approval' in fixture),'RE1 retains the closed native root contract');
 const original=JSON.stringify(fixture),rows=reportRows(fixture);
 const bytes=workbookFromApprovedJson(XLSX,fixture),wb=XLSX.read(bytes,{type:'buffer'});
 for(const [name,records] of Object.entries(rows)) {
   const actual=XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:null});
   assert.equal(actual.length,records.length,name);
 }
 const {document}=parseHTML('<html><body><main></main><section></section></body></html>');
 globalThis.document=document;
 renderReport(document.querySelector('main'),buildReportViewModel(fixture));
 renderEngineDetails(document.querySelector('section'),fixture);
 assert.equal(document.querySelectorAll('.universe-table tbody tr').length,
   fixture.portfolio_summary.client_layers.company_universe.length);
 assert.match(document.body.textContent,/Opportunity Rank/);
 assert.match(document.body.textContent,/Signal Strength/);
 for(const c of fixture.portfolio_summary.client_layers.company_universe) assert.ok(document.body.textContent.includes(c.company));
 for(const s of engineMetadata(fixture).signal_dispositions) assert.ok(document.body.textContent.includes(s.title));
 for(const s of fixture.source_index) assert.ok(document.body.textContent.includes(s.url));
 assert.equal(JSON.stringify(fixture),original,'renderers cannot mutate canonical JSON');
});
test('frozen report renders deterministically and spreadsheet strings cannot inject formulas',()=>{
 const a=workbookFromApprovedJson(XLSX,fixture),b=workbookFromApprovedJson(XLSX,fixture);
 assert.deepEqual(a,b);
 const OriginalDate=globalThis.Date;
 try {
   globalThis.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:['2035-01-01T00:00:00Z']));}static now(){return 2051222400000;}};
   assert.deepEqual(a,workbookFromApprovedJson(XLSX,fixture),'changing the render clock cannot change bytes');
 } finally {globalThis.Date=OriginalDate;}
 const altered=structuredClone(fixture);altered.portfolio_summary.client_layers.company_universe[0].company='=HYPERLINK("malicious")';
 const wb=XLSX.read(workbookFromApprovedJson(XLSX,altered));
 assert.equal(wb.Sheets.Universo.A2.f,undefined);assert.ok(wb.Sheets.Universo.A2.v.startsWith("'="));
 const partial=structuredClone(fixture);engineMetadata(partial).approval.status='partial';
 assert.throws(()=>workbookFromApprovedJson(XLSX,partial));
});
test('rendering more than one thousand companies does not truncate rows or create artificial ranks',()=>{
 const large=structuredClone(fixture),base=large.portfolio_summary.client_layers.company_universe[0];
 large.portfolio_summary.client_layers.company_universe=Array.from({length:1100},(_,i)=>({...base,company:'Company '+i,company_id:'company-'+i}));
 const wb=XLSX.read(workbookFromApprovedJson(XLSX,large));
 assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Universo).length,1100);
 assert.ok(!('Opportunity Rank' in XLSX.utils.sheet_to_json(wb.Sheets.Universo)[0]));
});
