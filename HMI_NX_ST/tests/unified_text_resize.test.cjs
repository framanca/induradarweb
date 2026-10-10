'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ctx={TextEncoder};
ctx.globalThis=ctx;
vm.createContext(ctx);
for(const file of ['expressions.js','model.js','sysmac-types.js','runtime.js','st.js','zip.js']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
}
const C=ctx.NXST;
test('the unified text element starts static but supports mappings and expressions',()=>{
  const text=C.newObject('text');
  assert.equal(text.kind,'text');
  assert.equal(text.optionsText,'');
  assert.equal(text.binding,'');
  const project=C.newProject();
  project.screens[0].objects.push(text);
  assert.equal(C.validate(project).length,0);
  const page=C.buildRuntimeHTML(project);
  assert.match(page,/"kind":"text"/);
  assert.ok(!page.includes('"kind":"dynamicText"'));
  assert.match(page,/o\.kind==="text"&&o\.binding&&String\(o\.optionsText\|\|""\)\.trim\(\)/);
});
test('old dynamic text project migrates without dropping ids, mapping or expressions',()=>{
  const p=C.newProject();
  p.internalVariables=[{name:'Status',type:'INT',value:1}];
  const old=C.newObject('text');
  old.kind='dynamicText';
  old.binding='Status';
  old.optionsText='0=Parada\n1=Marcha';
  old.expressionText='Status == 1 ? "En marcha" : "Parada"';
  old.expressionColor='Status == 1 ? "#16a34a" : "#dc2626"';
  old.expressionVisible='true';
  p.screens[0].objects.push(old);
  const recovered=C.normalize(JSON.parse(JSON.stringify(p))),newWidget=recovered.screens[0].objects[0];
  assert.equal(newWidget.kind,'text');
  for(const key of ['id','binding','optionsText','expressionText','expressionColor','expressionVisible']){
    assert.equal(newWidget[key],old[key],key+' must survive');
  }
  assert.equal(C.validate(recovered).length,0);
  const pkg=C.exportPackage(recovered);
  assert.ok(pkg.files['HMI_Embedded.html'].includes('"kind":"text"'));
  assert.ok(!pkg.files['HMI_Embedded.html'].includes('"kind":"dynamicText"'));
});
test('legacy static text drops only the legacy irrelevant mode-default mapping',()=>{
  const p=C.newProject(),staticText=C.newObject('text');
  staticText.optionsText='0=Paro\n1=Manual\n2=Automático';
  staticText.text='Línea de producción';
  p.screens[0].objects.push(staticText);
  const n=C.normalize(p).screens[0].objects[0];
  assert.equal(n.optionsText,'');
  assert.equal(n.text,'Línea de producción');
  assert.equal(C.validate(p).length,0);
});
test('mapped text validates missing bindings and invalid label definitions',()=>{
  const p=C.newProject(),o=C.newObject('text');
  o.optionsText='0=Parado\n1=Marcha';
  p.screens[0].objects.push(o);
  assert.ok(C.validate(p).some(message=>message.includes('asocia una variable')));
  p.internalVariables=[{name:'Estado',type:'BOOL',value:false}];
  o.binding='Estado';
  assert.equal(C.validate(p).length,0);
  o.optionsText='sin separador';
  assert.ok(C.validate(p).some(message=>message.includes('valor=texto')));
});
test('unified text accepts a PLC BOOL as dynamic source and does not require RW',()=>{
  const p=C.demoProject(),o=C.newObject('text');
  o.text='Estado desconocido';
  o.binding='Machine_Running';
  o.optionsText='false=Parada\ntrue=Marcha';
  o.expressionBackground='Machine_Running ? "#a7f3d0" : "#fee2e2"';
  p.screens[0].objects.push(o);
  assert.equal(C.validate(p).length,0);
  const html=C.buildRuntimeHTML(p),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(()=>new Function(script));
  assert.match(html,/match\?match\.value/);
});