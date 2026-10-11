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
function project(){
 const p=C.newProject();
 const plc=C.importSysmac('Name\tData Type\nSpeedPLC\tINT')[0];plc.expose=true;plc.access='RW';
 p.variables=[plc];
 p.internalVariables=[{name:'HMIFlag',type:'BOOL',value:false},{name:'HMIName',type:'STRING',value:'P'}];
 p.recipeVariables=['SpeedPLC','HMIFlag','HMIName'];
 p.recipes=[
  {id:'shared1',name:'Formato estándar',scope:'shared',values:{SpeedPLC:60,HMIFlag:true}},
  {id:'local1',name:'Solo operador',scope:'local',values:{HMIFlag:false,HMIName:'Caja A'}}
 ];
 return p;
}
test('new project and migration retain stable namespace, editable recipe group and shared/local types',()=>{
 const p=project();assert.equal(C.validate(p).length,0);
 assert.ok(p.recipeKey.length>=4);
 const norm=C.normalize(JSON.parse(JSON.stringify(p)));
 assert.equal(norm.recipeKey,p.recipeKey);
 assert.deepEqual(Array.from(norm.recipeVariables),['SpeedPLC','HMIFlag','HMIName']);
 assert.equal(norm.recipes[0].scope,'shared');
 assert.equal(norm.recipes[1].scope,'local');
 const old=project();delete old.recipeVariables;for(const r of old.recipes)delete r.scope;
 const mig=C.normalize(old);
 assert.deepEqual(Array.from(mig.recipeVariables),['SpeedPLC','HMIFlag','HMIName']);
 assert.equal(mig.recipes[0].scope,'shared');
 assert.equal(mig.recipes[1].scope,'local');
});
test('shared initial recipes are retained on NX, read with revisions and updated with HTTP 409 CAS',()=>{
 const p=project();const st=C.buildST(p),tsv=C.localVariablesTSV(p);
 assert.match(st,/IF NOT Web_RecipeInit THEN/);
 assert.match(st,/Web_RecipeData\[1\] :=/);
 assert.match(st,/Web_RecipeRev\[1\] := UDINT#1/);
 assert.match(st,/GET \/api\/recipes/);
 assert.match(st,/GET \/api\/recipe\?slot=/);
 assert.match(st,/POST \/api\/recipe\?slot=/);
 assert.match(st,/Web_RecipeExpected/);
 assert.match(st,/Web_RecipeRev\[Web_RecipeSlot\] = Web_RecipeExpected/);
 assert.match(st,/HTTP\/1\.0 409 Conflict/);
 assert.match(st,/UINT#500/);
 assert.match(st,/FOR Web_RecipeIdx := UINT#1 TO UINT#12 DO/);
 for(const key of ['Web_RecipeInit','Web_RecipeData','Web_RecipeRev']){
  const row=tsv.split(/\r?\n/).find(line=>line.startsWith(key+'\t'));
  assert.ok(row,key);
  const cells=row.split('\t');assert.equal(cells.length,7);assert.equal(cells[4],'True');
 }
 assert.match(tsv,/ARRAY\[1\.\.12\] OF STRING\[512\]/);
 assert.match(C.readme(p,C.buildRuntimeHTML(p),st),/Web_RecipeInit/);
 // Standalone recipe values are still emitted for HTML, not converted to arbitrary ST assignments.
 assert.doesNotMatch(st,/HMIFlag\s*:=\s*TRUE/);
 // Legacy /api/recipe?id route remains for backward compatibility with generated ST seeds.
});
test('generated runtime supports recipe CRUD, comparative values, local persistence, apply read-back, backup and import',()=>{
 const p=project(),html=C.buildRuntimeHTML(p);
 assert.ok([...html].every(c=>c.charCodeAt(0)<128),'embedded runtime must stay ASCII');
 const script=html.match(/<script>([\s\S]*)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Function(script));
 for(const text of ['id="recipeWindow"','id="recipeSelect"','id="recipeName"','id="recipeSave"','id="recipeDelete"','id="recipeApply"','id="recipeNew"','id="recipeDuplicate"','id="recipeCapture"','id="recipeImport"','id="recipeExport"'])assert.ok(html.includes(text),text);
 for(const marker of ['recipeStorageSave','recipeStoreShared','recipeRefreshShared','recipeImportFile','recipeExportJSON','recipeCaptureCurrent','checkRecipeApplyJob','recipeTypedValue','recipeApplySelected'])assert.ok(html.includes(marker),marker);
 assert.match(html,/recipeAlert\("Aplicando al PLC y comprobando valores recibidos/);
 assert.match(html,/recipeApplyJob=\{plc,local,started:Date\.now\(\)\}/);
 assert.match(html,/recipeSaveDraft/);
 assert.match(html,/hminx:recipes:v1/);
 assert.match(html,/r\.scope===\\?"shared\\?"/);
 assert.ok(new TextEncoder().encode(html).length<C.HTML_MAX_BYTES);
});
test('JSON store format is ASCII and size limited; local-only recipes do not create NX seeds',()=>{
 const p=project();
 const blob=C.recipeWireJSON(p.recipes[0]);assert.equal([...blob].every(c=>c.charCodeAt(0)<128),true);
 assert.ok(blob.includes('\\u'));
 assert.equal(JSON.parse(blob).name,'Formato estándar');
 p.recipes=[p.recipes[1]];assert.equal(C.validate(p).length,0);
 const st=C.buildST(p);
 assert.doesNotMatch(st,/Web_RecipeData\[1\] := '/);
 const huge=project();huge.recipes[0].values.HMIName='X'.repeat(510);
 assert.ok(C.validate(huge).some(msg=>msg.includes('500 bytes')));
 const many=project();many.recipes=Array.from({length:13},(_,i)=>({id:'r'+i,scope:'shared',name:'R'+i,values:{SpeedPLC:i}}));
 assert.ok(C.validate(many).some(msg=>msg.includes('Máximo 12 recetas')));
});
test('editor includes shared/local defaults and explicitly whitelists internal variables',()=>{
 const editor=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'),markup=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.match(editor,/function renderRecipeVariables\(\)/);
 assert.match(editor,/recipeVariables\.includes\(name\)/);
 assert.match(editor,/p\.internalVariables\.find\(v=>v\.name===name\)/);
 assert.match(editor,/data-recipe-scope/);
 assert.match(editor,/recipeDefaultValue/);
 assert.match(markup,/id="recipeVariableEditor"/);
});
