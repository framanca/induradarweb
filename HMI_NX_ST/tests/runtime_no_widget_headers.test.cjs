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

test('runtime omits automatic widget titles while retaining meaningful contents',()=>{
 const p=C.newProject();
 p.internalVariables=[{name:'Run_Local',type:'BOOL',value:true},{name:'Mode_Local',type:'INT',value:1}];
 const specs=[
  ['status','Run_Local','Estado'],['tank','Mode_Local','Depósito'],['value','Mode_Local','Producción'],
  ['input','Mode_Local','Entrada de ajuste'],['slider','Mode_Local','Ajuste'],
  ['switch','Run_Local','Interruptor'],['multistate','Mode_Local','Estado del modo'],
  ['gauge','Mode_Local','Indicador'],['stepper','Mode_Local','Ajuste +/-'],
  ['counter','Mode_Local','Contador'],['dropdown','Mode_Local','Selección'],
  ['bar','Mode_Local','Barra'],['text','','Texto importante'],['button','Run_Local','Arrancar']
 ];
 for(const [kind,binding,text] of specs){
  const o=C.newObject(kind);
  o.binding=binding;o.text=text;
  p.screens[0].objects.push(o);
 }
 assert.deepEqual(Array.from(C.validate(p)),[]);
 const html=C.buildRuntimeHTML(p);
 // No top captions for controls (Producción, Estado, Ajuste, etc.).
 assert.doesNotMatch(html,/title\.textContent=o\.text\|\|o\.kind/);
 assert.doesNotMatch(html,/panel\.append\(title\)/);
 assert.doesNotMatch(html,/cap\.textContent=o\.text\|\|"Estado"/);
 assert.doesNotMatch(html,/cap\.textContent=o\.text\|\|"Deposito"/);
 assert.doesNotMatch(html,/l\.textContent=o\.text;n\.append\(l\)/);
 // Value, name and binding remain in the editable project and the runtime's data model.
 assert.match(html,/"text":"Producci\\u00f3n"/);
 assert.match(html,/"text":"Ajuste"/);
 assert.match(html,/x\.textContent=o\.text/); // standalone text intentionally stays visible
 assert.match(html,/b\.textContent=o\.text/); // command buttons keep their useful captions
 assert.match(html,/target\.textContent="Objetivo: "\+o\.target/); // actual counter information remains
 assert.match(html,/panel\.setAttribute\("aria-label",o\.text\|\|o\.kind\)/);
 assert.match(html,/i\.setAttribute\("aria-label",o\.text\|\|"Entrada"\)/);
 assert.match(html,/n\.setAttribute\("role","img"\)/);
 assert.ok(html.length<C.HTML_MAX_BYTES);
 const embedded=html.match(/<script>([\s\S]*)<\/script>/)[1];
 assert.doesNotThrow(()=>new Function(embedded));
});
