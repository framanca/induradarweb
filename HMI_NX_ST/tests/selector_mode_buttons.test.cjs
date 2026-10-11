'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context={TextEncoder,URL,console};
context.globalThis=context;
vm.createContext(context);
for(const name of ['expressions.js','model.js','runtime.js','st.js','zip.js']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),context,{filename:name});
}
const C=context.NXST;
const editor=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');

test('selector has a readable default canvas size and persists options',()=>{
 const p=C.newProject();
 const o=C.newObject('selector');
 assert.equal(o.w,320);
 assert.equal(o.h,95);
 o.binding='LocalMode';
 o.optionsText='0=Parado\n1=Manual\n2=Automático';
 p.internalVariables.push({name:'LocalMode',type:'INT',value:1});
 p.screens[0].objects.push(o);
 assert.deepEqual(Array.from(C.validate(p)),[]);
 const saved=JSON.parse(JSON.stringify(p));
 const restored=C.normalize(saved);
 assert.equal(restored.screens[0].objects[0].optionsText,o.optionsText);
 assert.equal(restored.screens[0].objects[0].w,320);
});

test('selector exports native HTML mode buttons and PLC-feedback active highlight',()=>{
 const p=C.newProject();
 p.internalVariables=[{name:'LocalMode',type:'INT',value:1}];
 const selector=C.newObject('selector');
 selector.binding='LocalMode';
 selector.optionsText='0=Parado\n1=Manual\n2=Automático';
 const dropdown=C.newObject('dropdown');
 dropdown.binding='LocalMode';
 dropdown.optionsText=selector.optionsText;
 p.screens[0].objects.push(selector,dropdown);
 assert.deepEqual(Array.from(C.validate(p)),[]);
 const html=C.buildRuntimeHTML(p);
 assert.match(html,/else if\(o\.kind==="selector"\)\{const choices=E\("div","selector-buttons"\)/);
 assert.match(html,/button\.setAttribute\("aria-pressed","false"\)/);
 assert.match(html,/button\.onclick=\(\)=>\{if\(String\(currentValue\(o\.binding\)\?\?""\)!==option\.value\)write\(o\.binding,option\.value,\{node:n\}\)\}/);
 assert.match(html,/choice\.button\.classList\.toggle\("active",active\)/);
 assert.match(html,/choice\.button\.setAttribute\("aria-pressed",String\(active\)\)/);
 assert.match(html,/choice\.button\.disabled=!writable/);
 assert.match(html,/else if\(o\.kind==="dropdown"\)\{const input=E\("select"\)/);
 assert.match(html,/\.selector-choice\.active\{background:#2563eb/);
 assert.ok([...html].every(c=>c.charCodeAt(0)<128),'embedded runtime must remain ASCII');
 assert.ok(html.length<C.HTML_MAX_BYTES,'small enough for embedded HTML');
 const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
 assert.doesNotThrow(()=>new Function(script));
});

test('PLC integer selector remains RW and keeps current options and value protocol',()=>{
 const p=C.newProject();
 p.variables=C.importSysmac('Name\tData Type\nMachine_Mode\tINT');
 p.variables[0].access='RW';
 const sel=C.newObject('selector');
 sel.binding='Machine_Mode';
 sel.optionsText='-1=Error\n0=Parada\n1=Manual\n2=Automático';
 p.screens[0].objects.push(sel);
 assert.deepEqual(Array.from(C.validate(p)),[]);
 assert.match(C.externalVariablesTSV(p),/Machine_Mode\tINT/);
 const html=C.buildRuntimeHTML(p);
 assert.match(html,/"kind":"selector"/);
 assert.match(html,/"binding":"Machine_Mode"/);
 assert.match(html,/"optionsText":"-1=Error\\n0=Parada\\n1=Manual\\n2=Autom/);
 assert.match(html,/widgetWritable\(o\.binding\)&&!pending/);
 assert.match(html,/pendingWrites\.get\(o\.binding\)/);
 const st=C.buildST(p);
 assert.match(st,/Machine_Mode/);
});

test('editor shows all selector modes without exposing a dropdown in canvas',()=>{
 assert.match(editor,/if\(o\.kind==='selector'\)\{const options=String\(o\.optionsText/);
 assert.match(editor,/class="selector-mock-options"/);
 assert.match(editor,/class="selector-mock-choice"/);
 assert.match(editor,/Cada opción aparece como un botón visible/);
 assert.match(css,/\.widget\.selector \.selector-mock-options/);
 assert.match(css,/\.widget\.selector \.selector-mock-choice/);
 assert.doesNotThrow(()=>new Function(editor));
});
