'use strict';const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const ctx={TextEncoder,URL,console};ctx.globalThis=ctx;vm.createContext(ctx);for(const f of ['model.js','runtime.js','st.js','zip.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);const C=ctx.NXST;
test('imports Sysmac TSV headers and string size',()=>{const v=C.importSysmac('Name\tData Type\tComment\nRun\tBOOL\tEstado\nBatch\tSTRING[80]\tLote');assert.equal(v.length,2);assert.equal(v[1].type,'STRING');assert.equal(v[1].stringLength,80);});
test('imports simple ST declarations',()=>{const v=C.importSysmac('Run : BOOL;\nSpeed : REAL;');assert.equal(Array.from(v,x=>x.name).join(','),'Run,Speed');});
test('unsupported variables remain imported but disabled',()=>{const v=C.importSysmac('Name;Data Type\nA;ARRAY[0..2] OF BOOL');assert.equal(v[0].expose,false);});
test('demo validates and HTML is self contained',()=>{const p=C.demoProject();assert.equal(C.validate(p).length,0);const h=C.buildRuntimeHTML(p);assert.match(h,/<!doctype html>/);assert.match(h,/\/api\/read/);assert.ok(!h.includes('<script src='));assert.ok([...h].every(ch=>ch.charCodeAt(0)<128));const script=h.match(/<script>([\s\S]*)<\/script>/)[1];assert.doesNotThrow(()=>new Function(script));});
test('ST contains standard Omron socket blocks and embedded chunks',()=>{const s=C.buildST(C.demoProject());for(const x of ['StringToAry','AryToString'])assert.match(s,new RegExp(x));const locals=C.localVariablesTSV();for(const x of ['SktTCPAccept','SktTCPRcv','SktTCPSend','SktClose'])assert.match(locals,new RegExp(x));assert.match(s,/GET \/api\/read/);assert.match(s,/POST \/api\/write/);});
test('package zip starts with local header and contains project',()=>{const o=C.exportPackage(C.demoProject());assert.equal(o.zip[0],0x50);assert.ok(o.files['WebHMI_Server.st']);assert.ok(o.files['project.nxst']);});

test('POC limits exposed variables to 32',()=>{const p=C.newProject();p.variables=Array.from({length:33},(_,i)=>({id:i+1,name:'V'+i,type:'BOOL',stringLength:255,comment:'',access:'R',expose:true,live:true,writeSupported:true}));assert.ok(C.validate(p).some(x=>x.includes('máximo 32')));});

test('local variable TSV matches Sysmac Internals column order without a header',()=>{const lines=C.localVariablesTSV().split(/\r?\n/);assert.ok(!lines[0].startsWith('Name\t'));for(const line of lines){const cols=line.split('\t');assert.equal(cols.length,7);assert.ok(cols[0]);assert.ok(cols[1]);}const first=lines[0].split('\t');assert.equal(first[0],'Web_State');assert.equal(first[1],'UINT');assert.equal(first[2],'0');assert.equal(first[3],'');assert.equal(first[4],'');assert.equal(first[5],'');assert.equal(first[6],'Estado servidor HTTP');});

test('Sysmac literals escape JavaScript dollar signs',()=>{const p=C.demoProject();const s=C.buildST(p);assert.match(s,/\?\$\$\//);assert.ok(!s.includes('?$/'));});

test('generated ST uses CONCAT for STRING assembly',()=>{const p=C.demoProject();const s=C.buildST(p);assert.match(s,/Web_ApiBody := CONCAT\(Web_ApiBody,/);assert.ok(!/Web_ApiBody := Web_ApiBody &/.test(s));});

test('external variable TSV references exposed global variables',()=>{const p=C.demoProject();const x=C.externalVariablesTSV(p).split(/\r?\n/);assert.equal(x.length,4);assert.equal(x[0],'Machine_Running\tBOOL');assert.ok(x.some(line=>line==='Process_Setpoint\tREAL'));const o=C.exportPackage(p);assert.ok(o.files['WebHMI_ExternalVariables.tsv']);});

test('button modes and REAL precision are exported to runtime',()=>{const p=C.demoProject();const h=C.buildRuntimeHTML(p);assert.match(h,/"actionMode":"set"/);assert.match(h,/"decimals":2/);assert.match(h,/mode==="toggle"/);assert.match(h,/toFixed\(d\)/);});

test('button binding requires BOOL and decimals stay within range',()=>{const p=C.demoProject();const button=p.screens[0].objects.find(o=>o.kind==='button');button.binding='Process_Setpoint';assert.ok(C.validate(p).some(x=>x.includes('requiere BOOL')));button.binding='Start_Request';const value=p.screens[0].objects.find(o=>o.kind==='value');value.decimals=7;assert.ok(C.validate(p).some(x=>x.includes('decimales')));});

test('responsive width defaults and validation are stable',()=>{const p=C.newProject();assert.equal(p.minDisplayWidth,480);assert.equal(p.maxDisplayWidth,1920);assert.equal(C.validate(p).filter(x=>x.includes('ancho mínimo')||x.includes('ancho máximo')).length,0);p.minDisplayWidth=2000;p.maxDisplayWidth=1000;assert.ok(C.validate(p).some(x=>x.includes('mínimo no puede superar')));});

test('runtime fits stage to browser width with min and max limits',()=>{const p=C.demoProject();p.minDisplayWidth=480;p.maxDisplayWidth=1600;const h=C.buildRuntimeHTML(p);assert.match(h,/"minDisplayWidth":480/);assert.match(h,/"maxDisplayWidth":1600/);assert.match(h,/id="viewport"/);assert.match(h,/function fitStage\(\)/);assert.match(h,/ResizeObserver/);assert.match(h,/target=Math\.max\(minW,Math\.min\(maxW,available\)\)/);});

test('multi-screen projects are embedded with navigation',()=>{const p=C.demoProject();const s=C.newScreen('Mantenimiento');s.objects.push(Object.assign(C.newObject('lamp'),{binding:'Machine_Running'}));p.screens.push(s);const h=C.buildRuntimeHTML(p);assert.match(h,/Mantenimiento/);assert.match(h,/showScreen/);assert.equal(C.validate(p).length,0);});

test('industrial widgets and images are supported',()=>{const p=C.demoProject();p.assets.push({id:'img1',name:'logo.png',data:'data:image/png;base64,AA=='});p.screens[0].objects.push(Object.assign(C.newObject('image'),{assetId:'img1'}));p.screens[0].objects.push(Object.assign(C.newObject('pump'),{binding:'Machine_Running'}));const h=C.buildRuntimeHTML(p);assert.match(h,/data:image\/png;base64,AA==/);assert.match(h,/industrial/);assert.equal(C.validate(p).length,0);});

test('alarms are evaluated in generated ST and returned by api read',()=>{const p=C.demoProject();const s=C.buildST(p);assert.match(s,/A1=1\$n/);assert.match(s,/Process_Level > REAL#90\.0/);assert.match(s,/A1=0\$n/);});

test('recipes compile into one PLC recipe CASE route',()=>{const p=C.demoProject();const s=C.buildST(p);assert.match(s,/POST \/api\/recipe\?/);assert.match(s,/Process_Setpoint := REAL#50\.0/);assert.match(s,/BAD RECIPE/);const h=C.buildRuntimeHTML(p);assert.match(h,/applyRecipe/);});

test('old one-screen object projects migrate',()=>{const p=C.newProject();const old={...p,objects:[C.newObject('text')]};delete old.screens;const n=C.normalize(old);assert.equal(n.screens.length,1);assert.equal(n.screens[0].objects.length,1);});

test('button can navigate to another screen without PLC variable',()=>{const p=C.demoProject();const second=C.newScreen('Manual');p.screens.push(second);const b=C.newObject('button');b.text='Ir Manual';b.actionType='navigate';b.targetScreenId=second.id;b.binding='';p.screens[0].objects.push(b);assert.equal(C.validate(p).filter(x=>x.includes('Ir Manual')).length,0);const h=C.buildRuntimeHTML(p);assert.match(h,/"actionType":"navigate"/);assert.match(h,new RegExp(second.id));assert.match(h,/showScreenById/);});

test('navigation button rejects missing target screen',()=>{const p=C.demoProject();const b=C.newObject('button');b.text='Ir';b.actionType='navigate';b.targetScreenId='missing';p.screens[0].objects.push(b);assert.ok(C.validate(p).some(x=>x.includes('pantalla destino')));});

test('image budgets are strict per image and project total',()=>{const p=C.demoProject();const mk=n=>'data:image/png;base64,'+Buffer.alloc(n).toString('base64');p.assets=[{id:'big',name:'big.png',data:mk(C.IMAGE_MAX_BYTES+1)}];assert.ok(C.validate(p).some(x=>x.includes('64 KB')));p.assets=Array.from({length:5},(_,i)=>({id:'i'+i,name:'i'+i+'.png',data:mk(60*1024)}));assert.ok(C.validate(p).some(x=>x.includes('256 KB')));});

test('export hard-blocks embedded HTML above 512 KB',()=>{const p=C.demoProject();p.screens[0].objects.push(Object.assign(C.newObject('text'),{text:'X'.repeat(C.HTML_MAX_BYTES)}));assert.throws(()=>C.exportPackage(p),/512 KB/);});

test('editor warns before image embedding and auto-optimizes to WebP',()=>{const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');assert.match(app,/confirm\('La imagen se incrusta dentro del programa del NX/);assert.match(app,/async function optimizeImage/);assert.match(app,/image\/webp/);assert.match(app,/IMAGE_OPTIMIZE_MAX_DIM/);assert.match(app,/Imagen optimizada:/);});

test('image optimizer keeps conservative 1024 px ceiling',()=>{assert.equal(C.IMAGE_OPTIMIZE_MAX_DIM,1024);});

test('STRING can be RW input up to 512 bytes',()=>{const v=C.importSysmac('Name\tData Type\nText\tSTRING[80]')[0];assert.equal(v.writeSupported,true);v.access='RW';const p=C.newProject();p.variables=[v];const o=C.newObject('input');o.binding='Text';p.screens[0].objects.push(o);assert.equal(C.validate(p).length,0);const tooLong=C.importSysmac('Name\tData Type\nBig\tSTRING[600]')[0];assert.equal(tooLong.writeSupported,false);});

test('STRING write uses raw POST body and ST direct assignment',()=>{const p=C.newProject();const v=C.importSysmac('Name\tData Type\nText\tSTRING[80]')[0];v.access='RW';v.expose=true;p.variables=[v];const o=C.newObject('input');o.binding='Text';p.screens[0].objects.push(o);const h=C.buildRuntimeHTML(p);assert.match(h,/body:raw/);assert.match(h,/Content-Type":"text\/plain;charset=UTF-8"/);assert.ok(!h.includes('&v="+encodeURIComponent'));const s=C.buildST(p);assert.match(s,/Text := Web_ValueText;/);assert.match(s,/Web_PosBody := FIND\(Web_RxText, '\$r\$n\$r\$n'\)/);assert.match(C.localVariablesTSV(),/Web_ValueText\tSTRING\[512\]/);});

test('runtime exposes alarm window with active count and list',()=>{const p=C.demoProject();const h=C.buildRuntimeHTML(p);assert.match(h,/id="alarmOpen"/);assert.match(h,/id="alarmWindow"/);assert.match(h,/id="alarmList"/);assert.match(h,/alarmCount\.textContent/);assert.match(h,/alarmbar\.onclick/);assert.match(h,/ACTIVA/);});

test('STRING recipes compile to escaped ST literals',()=>{const p=C.newProject();const v=C.importSysmac('Name\tData Type\nProduct\tSTRING[80]')[0];v.access='RW';v.expose=true;p.variables=[v];p.recipes=[{id:'r',name:'R',values:{Product:"Lote A"}}];const s=C.buildST(p);assert.match(s,/Product := 'Lote A';/);});

test('runtime text widgets keep editor left alignment',()=>{const h=C.buildRuntimeHTML(C.demoProject());assert.match(h,/\.text \.in\{justify-content:flex-start;text-align:left\}/);});

test('P0 editor includes local autosave and recovery protections',()=>{const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');assert.match(app,/hmi-nx-st:p0:latest:v1/);assert.match(app,/P0_AUTOSAVE_MS=1500/);assert.match(app,/visibilitychange/);assert.match(app,/beforeunload/);assert.match(app,/pagehide/);assert.match(app,/p0ProtectReplace/);assert.match(app,/antes-abrir-archivo/);assert.match(app,/guardado-manual/);assert.match(app,/exportado-sysmac/);assert.match(html,/id="saveStatus"/);assert.match(html,/id="recoveryDialog"/);assert.match(html,/id="recoveryList"/);});

test('P0 keeps rolling local history and quota fallback',()=>{const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');assert.match(app,/P0_HISTORY_MAX=3/);assert.match(app,/P0_HISTORY_MS=30000/);assert.match(app,/localStorage\.removeItem\(P0_HISTORY\)/);assert.match(app,/AUTOSAVE FALLÓ/);assert.match(app,/antes-recuperar/);});
