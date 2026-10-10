'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context={TextEncoder};context.globalThis=context;vm.createContext(context);
for(const file of ['expressions.js','model.js','sysmac-types.js','runtime.js','st.js','zip.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
const C=context.NXST;
function internals(){return [
 {name:'Run_Local',type:'BOOL',value:false},
 {name:'Count_Local',type:'INT',value:2},
 {name:'Speed_Local',type:'REAL',value:12.5},
 {name:'Title_Local',type:'STRING',value:'LISTO'}
]}
function setup(){
 const p=C.newProject();p.internalVariables=internals();
 function add(kind,binding){const o=C.newObject(kind);o.binding=binding;p.screens[0].objects.push(o);return o}
 add('status','Run_Local');add('button','Run_Local');add('switch','Run_Local');
 add('value','Count_Local');add('value','Title_Local');
 add('input','Count_Local');add('input','Speed_Local');add('input','Title_Local');
 add('bar','Speed_Local');add('tank','Speed_Local');add('slider','Speed_Local');add('gauge','Speed_Local');
 add('stepper','Count_Local');add('counter','Count_Local');
 add('selector','Count_Local');add('dropdown','Count_Local');add('multistate','Count_Local');
 const text=add('text','Title_Local');text.optionsText='LISTO=Preparado\nPARO=Detenido';
 const btn=p.screens[0].objects.find(o=>o.kind==='button');btn.feedbackBinding='Run_Local';
 return p;
}
test('every widget class can select a matching internal variable without PLC RW permissions',()=>{
 const p=setup();
 assert.deepEqual(Array.from(C.validate(p)),[]);
 assert.ok(p.screens[0].objects.every(o=>p.internalVariables.some(v=>v.name===o.binding)));
 assert.equal(p.variables.length,0);
 const output=C.exportPackage(p);
 assert.ok(output.files['HMI_Embedded.html']);
 assert.equal(C.externalVariablesTSV(p),'');
 const browser=C.buildRuntimeHTML(p);
 assert.match(browser,/"Run_Local"/);
 assert.match(browser,/"Title_Local"/);
 assert.match(browser,/"Count_Local"/);
 assert.doesNotThrow(()=>new Function(browser.match(/<script>([\s\S]*?)<\/script>/)[1]));
});
test('internal BOOL image and local button feedback do not require exposing PLC variables',()=>{
 const p=setup();
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6M9sAAAAASUVORK5CYII=';
 p.assets=[{id:'off',name:'OFF.png',data:png},{id:'on',name:'ON.png',data:png}];
 const img=C.newObject('image');img.binding='Run_Local';img.assetId='off';img.assetOnId='on';p.screens[0].objects.push(img);
 assert.deepEqual(Array.from(C.validate(p)),[]);
 assert.equal(p.variables.length,0);
 assert.match(C.buildRuntimeHTML(p),/Run_Local/);
});
test('wrong internal variable type is still rejected for status, numeric controls and selectors',()=>{
 const p=setup();const first=p.screens[0].objects[0];first.binding='Count_Local';
 assert.ok(C.validate(p).some(msg=>msg.includes('requiere BOOL')));
 first.binding='Run_Local';
 const slider=p.screens[0].objects.find(o=>o.kind==='slider');
 slider.binding='Title_Local';
 assert.ok(C.validate(p).some(msg=>msg.includes('requiere tipo numérico')));
 slider.binding='Speed_Local';
 const selector=p.screens[0].objects.find(o=>o.kind==='selector');
 selector.binding='Speed_Local';
 assert.ok(C.validate(p).some(msg=>msg.includes('requiere variable entera')));
});
test('PLC bindings still require RW while local write widgets are always locally writable',()=>{
 const p=setup();p.variables=[{id:1,name:'PLC_ReadOnly',type:'REAL',access:'R',expose:true,live:true,writeSupported:true}];
 const slider=p.screens[0].objects.find(o=>o.kind==='slider');
 assert.deepEqual(Array.from(C.validate(p)),[]);
 slider.binding='PLC_ReadOnly';
 assert.ok(C.validate(p).some(x=>x.includes('requiere variable RW')));
 slider.binding='Speed_Local';
 assert.deepEqual(Array.from(C.validate(p)),[]);
});
test('editor lists both namespaces and runtime switches/stepper use local values offline',()=>{
 const editor=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const runtime=fs.readFileSync(path.join(__dirname,'..','runtime.js'),'utf8');
 assert.match(editor,/function opts\(value,filter=\(\)=>true,includeInternal=true\)/);
 assert.match(editor,/optgroup label="Variables internas"/);
 assert.match(editor,/opts\(o\.binding,BOOL\)/);
 assert.match(editor,/opts\(o\.feedbackBinding,BOOL\)/);
 assert.match(editor,/opts\(a\.binding,\(\)=>true,false\)/); // Alarm definitions remain PLC-only.
 assert.match(runtime,/function widgetWritable\(name\)/);
 assert.match(runtime,/localWritable\(name\)\|\|comm\.state==="ONLINE"/);
 assert.match(runtime,/boolValue\(currentValue\(o\.binding\)\)/);
 assert.match(runtime,/Number\(currentValue\(o\.binding\)\?\?o\.min\)/);
 assert.match(runtime,/c\.input\.disabled=!widgetWritable\(o\.binding\)/);
 assert.match(runtime,/c\.button\.disabled=!widgetWritable\(o\.binding\)/);
});
