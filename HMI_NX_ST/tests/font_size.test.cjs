'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context={TextEncoder};context.globalThis=context;vm.createContext(context);
for(const file of ['expressions.js','model.js','sysmac-types.js','runtime.js','st.js','zip.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
const C=context.NXST;
test('new and old projects keep previous font appearance until explicitly changed',()=>{
 const p=C.demoProject(),first=p.screens[0].objects[0];
 assert.equal(first.fontSize,null);
 for(const o of p.screens[0].objects)delete o.fontSize;
 const restored=C.normalize(p);
 assert.ok(restored.screens[0].objects.every(o=>o.fontSize===null));
 assert.deepEqual(Array.from(C.validate(restored)),[]);
 assert.ok(restored.screens[0].objects.every(o=>o.text));
});
test('font size persists through project normalization and protected ZIP export',()=>{
 const p=C.demoProject(),s=p.screens[0];
 const numeric=s.objects.find(o=>o.kind==='value');
 const input=s.objects.find(o=>o.kind==='input');
 const header=s.objects.find(o=>o.kind==='text');
 header.fontSize=34;numeric.fontSize=42;input.fontSize=24;
 const n=C.normalize(p);
 assert.equal(n.screens[0].objects.find(o=>o.kind==='text').fontSize,34);
 assert.equal(n.screens[0].objects.find(o=>o.kind==='value').fontSize,42);
 assert.equal(n.screens[0].objects.find(o=>o.kind==='input').fontSize,24);
 assert.deepEqual(Array.from(C.validate(p)),[]);
 const html=C.buildRuntimeHTML(p);
 assert.match(html,/"fontSize":34/);
 assert.match(html,/"fontSize":42/);
 assert.match(html,/"fontSize":24/);
 assert.match(html,/function applyObjectFontSize\(node,o\)/);
 assert.match(html,/\.in,\.label,\.caption,\.control-panel,\.reading,\.limits,input,select,button/);
 assert.doesNotThrow(()=>new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]));
 const pkg=C.exportPackage(p);
 assert.equal(JSON.parse(pkg.files['project.nxst']).screens[0].objects[0].fontSize,34);
 assert.ok(pkg.files['HMI_Embedded.html'].includes('"fontSize":42'));
});
test('font sizes outside the permitted 8-120px range block export',()=>{
 const p=C.demoProject(),o=p.screens[0].objects[0];
 for(const value of [7,121,20.4,'not-a-number']){
  o.fontSize=value;
  assert.ok(C.validate(p).some(x=>x.includes('tamaño de letra')),String(value));
 }
 for(const valid of [8,12,48,120]){
  o.fontSize=valid;
  assert.ok(!C.validate(p).some(x=>x.includes('tamaño de letra')),String(valid));
 }
 o.fontSize=null;
 assert.ok(!C.validate(p).some(x=>x.includes('tamaño de letra')));
});
test('existing popup and screen base objects preserve font sizes',()=>{
 const p=C.demoProject(),base=C.newBaseScreen();
 base.objects=[C.newObject('text'),C.newObject('value')];
 base.objects[0].fontSize=28;base.objects[1].fontSize=43;
 p.baseScreen=base;p.screens[0].useBase=true;
 const n=C.normalize(p);
 assert.equal(n.baseScreen.objects[0].fontSize,28);
 assert.equal(n.baseScreen.objects[1].fontSize,43);
 const html=C.buildRuntimeHTML(n);
 assert.match(html,/"fontSize":43/);
 assert.deepEqual(Array.from(C.validate(p)),[]);
});
