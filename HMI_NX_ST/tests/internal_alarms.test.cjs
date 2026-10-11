'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ctx={TextEncoder,URL,console};ctx.globalThis=ctx;vm.createContext(ctx);
for(const file of ['expressions.js','model.js','sysmac-types.js','runtime.js','st.js','zip.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
const C=ctx.NXST;
const alarm=(id,binding,operator,value,name)=>({id,name:name||id,binding,operator,value,severity:'warning'});
const locals=[
 {name:'RunLocal',type:'BOOL',value:false},
 {name:'CountLocal',type:'INT',value:12},
 {name:'SpeedLocal',type:'REAL',value:8.5},
 {name:'MessageLocal',type:'STRING',value:'ERROR'},
];
function setup(){
 const p=C.newProject();
 p.internalVariables=locals.map(x=>({...x}));
 p.alarms=[
  alarm('bool','RunLocal','eq',true,'Aviso local BOOL'),
  alarm('int','CountLocal','ge',10,'Límite local INT'),
  alarm('real','SpeedLocal','lt',9.5,'Límite local REAL'),
  alarm('string','MessageLocal','eq','ERROR','Mensaje local STRING'),
 ];
 return p;
}
test('alarm validation accepts all four HMI internal types and exports without PLC variables',()=>{
 const p=setup();
 assert.deepEqual(Array.from(C.validate(p)),[]);
 const out=C.exportPackage(p);
 assert.equal(C.externalVariablesTSV(p),'');
 assert.ok(out.files['WebHMI_Server.st']);
 const html=C.buildRuntimeHTML(p);
 assert.equal((html.match(/"local":true/g)||[]).length,4);
 for(const a of p.alarms)assert.ok(html.includes('"binding":"'+a.binding+'"'));
 assert.match(html,/function localAlarmCondition\(a\)/);
 assert.match(html,/function updateLocalAlarms\(\)/);
 assert.match(html,/ackAll.disabled=!unacked.some/);
 assert.match(html,/!a\.local&&\(comm.state!=="ONLINE"/);
 assert.match(html,/if\(a\.local\)\{ackVals\[id\]=true;paintAlarms\(\);return\}/);
 assert.match(html,/for\(const a of P\.alarms\)if\(!a\.local\)/);
 assert.match(html,/const plcAlarmIds=new Set\(P\.alarms\.filter\(a=>!a\.local\)/);
 assert.match(html,/for\(const id of plcAlarmIds\)\{delete alarmVals\[id\];delete ackVals\[id\]\}/);
 assert.match(html,/for\(const id of plcAlarmIds\)\{alarms\[id\]/);
 assert.ok(new TextEncoder().encode(html).length<C.HTML_MAX_BYTES);
 assert.doesNotThrow(()=>new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]));
 const st=C.buildST(p);
 for(const a of p.alarms)assert.doesNotMatch(st,new RegExp('IF\\s+\\('+a.binding+'\\s'));
 assert.doesNotMatch(st,/A1=1\$n|A2=1\$n|A3=1\$n|A4=1\$n/);
 assert.doesNotMatch(st,/RunLocal|CountLocal|SpeedLocal|MessageLocal/);
});
test('invalid, missing, and incompatible internal alarm thresholds are rejected',()=>{
 const p=setup();
 p.alarms[0].binding='MissingLocal';
 assert.ok(C.validate(p).some(x=>x.includes('variable no válida')));
 p.alarms[0].binding='RunLocal';
 p.alarms[0].operator='gt';
 assert.ok(C.validate(p).some(x=>x.includes('BOOL sólo admite')));
 p.alarms[0].operator='eq';
 p.alarms[3].operator='ge';
 assert.ok(C.validate(p).some(x=>x.includes('STRING sólo admite')));
 p.alarms[3].operator='eq';
 p.alarms[2].value='this-is-not-a-number';
 assert.ok(C.validate(p).some(x=>x.includes('umbral no válido')));
 p.alarms[2].value=9.5;
 assert.deepEqual(Array.from(C.validate(p)),[]);
});
test('mixed PLC/internal alarm IDs are stable while ST only outputs PLC condition and ACK',()=>{
 const p=setup();
 const v=C.importSysmac('Name\tData Type\nMachine_Run\tBOOL')[0];v.expose=true;v.access='R';p.variables=[v];
 p.alarms.splice(1,0,alarm('plc','Machine_Run','eq',true,'Alarma PLC'));
 assert.deepEqual(Array.from(C.validate(p)),[]);
 const html=C.buildRuntimeHTML(p);
 assert.match(html,/"wireId":1[^}]*"local":true/);
 assert.match(html,/"wireId":2[^}]*"local":false/);
 assert.match(html,/"wireId":3[^}]*"local":true/);
 const st=C.buildST(p);
 assert.match(st,/A2=1\$n/);
 assert.match(st,/K2=1\$n/);
 assert.match(st,/Web_AlarmAck\[2\]/);
 assert.doesNotMatch(st,/A1=1\$n|K1=1\$n|A3=1\$n|K3=1\$n/);
 assert.match(html,/for\(const a of P\.alarms\)if\(!a\.local\)/);
 assert.match(html,/if\(Number\.isInteger\(id\)&&plcAlarmIds\.has\(id\)\)nextAlarms\[id\]/);
});
test('alarm editor offers PLC and HMI internal variables and preserves saved alarm data',()=>{
 const p=setup();const n=C.normalize(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(Array.from(n.alarms,x=>x.binding),p.alarms.map(x=>x.binding));
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 assert.match(app,/opts\(a\.binding,\(\)=>true,true\)/);
 assert.match(app,/Variables internas/);
 assert.match(app,/p\.variables\.find\(v=>v\.live\)\|\|p\.internalVariables\.find\(v=>v\.name\)/);
 assert.match(app,/se evalúan y reconocen solo en este navegador/);
});
