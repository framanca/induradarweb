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
 p.recipeEnabled=true;
 const plc=C.importSysmac('Name\tData Type\nSpeedPLC\tINT')[0];plc.expose=true;plc.access='RW';
 p.variables=[plc];
 p.internalVariables=[{name:'HMIFlag',type:'BOOL',value:false},{name:'HMIName',type:'STRING',value:'P'}];
 p.recipeVariables=['SpeedPLC','HMIFlag','HMIName'];
 p.recipes=[
  {id:'shared1',name:'Formato estándar',scope:'shared',values:{SpeedPLC:60,HMIFlag:true}},
  {id:'nx2',name:'Solo operador',scope:'shared',values:{HMIFlag:false,HMIName:'Caja A'}}
 ];
 return p;
}
test('new project starts with recipes disabled, and legacy local recipes migrate to NX',()=>{
 assert.equal(C.newProject().recipeEnabled,false);
 const p=project();assert.equal(C.validate(p).length,0);
 assert.ok(p.recipeKey.length>=4);
 const norm=C.normalize(JSON.parse(JSON.stringify(p)));
 assert.equal(norm.recipeKey,p.recipeKey);
 assert.deepEqual(Array.from(norm.recipeVariables),['SpeedPLC','HMIFlag','HMIName']);
 assert.equal(norm.recipes[0].scope,'shared');
 assert.equal(norm.recipes[1].scope,'shared');
 const old=project();delete old.recipeEnabled;delete old.recipeVariables;old.recipes[1].scope='local';for(const r of old.recipes.slice(0,1))delete r.scope;
 const mig=C.normalize(old);
 assert.deepEqual(Array.from(mig.recipeVariables),['SpeedPLC','HMIFlag','HMIName']);
 assert.equal(mig.recipes[0].scope,'shared');
 assert.equal(mig.recipes[1].scope,'shared');
 assert.equal(mig.recipeEnabled,true);
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
test('generated runtime has NX-only recipe CRUD, apply read-back, backup and import',()=>{
 const p=project(),html=C.buildRuntimeHTML(p);
 assert.ok([...html].every(c=>c.charCodeAt(0)<128),'embedded runtime must stay ASCII');
 const script=html.match(/<script>([\s\S]*)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Function(script));
 for(const text of ['id="recipeWindow"','id="recipeSelect"','id="recipeName"','id="recipeSave"','id="recipeDelete"','id="recipeApply"','id="recipeNew"','id="recipeDuplicate"','id="recipeCapture"','id="recipeImport"','id="recipeExport"'])assert.ok(html.includes(text),text);
 assert.ok(html.indexOf('id="recipeDuplicate"')<html.indexOf('id="recipeDelete"'),'runtime Duplicar before Eliminar');
 assert.match(html,/function recipeDuplicateName\(copy\)/);
 assert.match(html,/recipeNewDraft\(source\)/);
 assert.match(html,/name:\\?"Nueva receta\\?",scope:\\?"shared\\?"/);
 assert.doesNotMatch(html,/id="recipeScope"/);
 const editor=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 assert.match(editor,/scope:'shared'/);
 assert.match(editor,/p\.recipes\.push\(\{id:C\.id\(\),name:'Receta '\+i,scope:'shared',values:\{\}\}\)/);
 for(const marker of ['recipeStoreShared','recipeRefreshShared','recipeImportFile','recipeExportJSON','recipeCaptureCurrent','checkRecipeApplyJob','recipeTypedValue','recipeApplySelected'])assert.ok(html.includes(marker),marker);
 assert.match(html,/recipeAlert\("Aplicando al PLC y comprobando valores recibidos/);
 assert.match(html,/recipeApplyJob=\{plc,local,started:Date\.now\(\)\}/);
 assert.match(html,/recipeSaveDraft/);
 assert.doesNotMatch(html,/hminx:recipes:v1|recipeBrowser|recipeScope/);
 assert.match(html,/P\.recipeSlots/);
 assert.ok(new TextEncoder().encode(html).length<C.HTML_MAX_BYTES);
});
test('NX-only JSON seed is ASCII and project capacity is validated',()=>{
 const p=project();
 const blob=C.recipeWireJSON(p.recipes[0]);assert.equal([...blob].every(c=>c.charCodeAt(0)<128),true);
 assert.ok(blob.includes('\\u'));
 assert.equal(JSON.parse(blob).name,'Formato estándar');
 p.recipes=[p.recipes[1]];assert.equal(C.validate(p).length,0);
 const st=C.buildST(p);
 assert.match(st,/Web_RecipeData\[1\] := '/);
 const huge=project();huge.recipes[0].values.HMIName='X'.repeat(510);
 assert.ok(C.validate(huge).some(msg=>msg.includes('500 bytes')));
 const many=project();many.recipes=Array.from({length:13},(_,i)=>({id:'r'+i,scope:'shared',name:'R'+i,values:{SpeedPLC:i}}));
 assert.ok(C.validate(many).some(msg=>msg.includes('Máximo 12 recetas')));
});
test('editor uses per-recipe checkboxes without a global recipe variable whitelist',()=>{
 const editor=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'),markup=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.doesNotMatch(editor,/function renderRecipeVariables\(\)/);
 assert.doesNotMatch(markup,/recipeVariableEditor|Variables autorizadas para recetas/);
 assert.match(markup,/id="recipeCapacitySummary"/);
 assert.match(editor,/function updateRecipeCapacity\(\)/);
 assert.match(editor,/function recipeAvailableVariables\(\)/);
 assert.doesNotMatch(editor,/data-recipe-scope/);
 assert.match(markup,/id="recipeEnabled"/);
 assert.match(markup,/id="recipeSlots"/);
 assert.match(markup,/id="recipeBytes"/);
 assert.match(editor,/recipeDefaultValue/);
 assert.match(editor,/data-recipe-toggle/);
 assert.match(editor,/data-recipe-value/);
 assert.match(editor,/recipeTypedEditor/);
 assert.doesNotMatch(editor,/data-recipe-values=/);
 assert.match(editor,/data-recipe-capacity/);
});


test('recipe checkboxes list all writable PLC/internal variables and pre-check only recipe assignments',()=>{
 const editor=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const start=editor.indexOf('function recipeAvailableVariables()');
 const end=editor.indexOf('function updateRecipeCapacity()',start);
 assert.ok(start>=0&&end>start);
 const sandbox={p:project(),C};
 vm.createContext(sandbox);
 vm.runInContext(editor.slice(start,end),sandbox);
 const html=sandbox.recipeValueOptions(sandbox.p.recipes[0],0);
 assert.match(html,/data-recipe-toggle="0"/);
 assert.match(html,/SpeedPLC/);
 assert.match(html,/HMIFlag/);
 assert.match(html,/HMIName/);
 assert.match(html,/value="60"/);
 assert.match(html,/value="true" selected/);
 assert.match(html,/data-name="HMIName"[^>]*disabled/);
 assert.match(html,/data-name="SpeedPLC" checked/);
 assert.equal(sandbox.recipeTypedEditor(sandbox.p.variables[0],'50'),50);
 assert.throws(()=>sandbox.recipeTypedEditor(sandbox.p.variables[0],'1.5'),/entero/);
 assert.throws(()=>sandbox.recipeTypedEditor(sandbox.p.variables[0],''),/número/);
 assert.equal(sandbox.recipeTypedEditor(sandbox.p.internalVariables[0],'true'),true);
});

test('duplicating editor recipes keeps storage, deep-copies values and assigns unique names and IDs',()=>{
 const p=project();
 const original=p.recipes[0];
 const copy1=C.duplicateRecipe(original,p.recipes);
 assert.equal(copy1.scope,original.scope);
 assert.equal(copy1.name,'Formato estándar (copia)');
 assert.notEqual(copy1.id,original.id);
 assert.deepEqual(JSON.parse(JSON.stringify(copy1.values)),JSON.parse(JSON.stringify(original.values)));
 copy1.values.SpeedPLC=100;
 assert.equal(original.values.SpeedPLC,60,'copy must not mutate original values');
 p.recipes.push(copy1);
 const copy2=C.duplicateRecipe(original,p.recipes);
 assert.equal(copy2.name,'Formato estándar (copia 2)');
 assert.ok(C.validate({...p,recipes:[...p.recipes,copy2]}).length===0);
 const long={id:'long',scope:'shared',name:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKL',values:{HMIFlag:true}};
 const longCopy=C.duplicateRecipe(long,[long]);
 assert.ok(longCopy.name.length<=48);
 assert.ok(longCopy.name.endsWith(' (copia)'));
 const nxCopy=C.duplicateRecipe({...original,scope:'shared'},p.recipes);
 assert.equal(nxCopy.scope,'shared');
 const editor=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 assert.match(editor,/function duplicateEditorRecipe\(index\)/);
 assert.match(editor,/data-duplicate-recipe/);
 assert.match(editor,/p\.recipes\.splice\(index\+1,0,clone\)/);
 assert.match(editor,/p\.recipeSlots/);
});

test('runtime recipe picker offers all exposed writable PLC tags and internal HMI variables, even without seed recipes',()=>{
 const p=project();
 const external=C.importSysmac('Name\tData Type\nSpareRW\tINT')[0];
 external.access='RW';external.expose=true;
 const hidden=C.importSysmac('Name\tData Type\nHiddenRW\tINT')[0];
 hidden.access='RW';hidden.expose=false;
 p.variables.push(external,hidden);
 p.internalVariables.push({name:'NewHMI',type:'BOOL',value:false});
 assert.equal(C.validate(p).length,0);
 const html=C.buildRuntimeHTML(p);
 const payload=html.match(/<script>const P=(\{.*?\});/)?.[1];
 assert.ok(payload,'runtime includes recipe metadata');
 const names=JSON.parse(payload).recipeFields.map(f=>f.name);
 assert.ok(names.includes('SpareRW'), 'new runtime recipe can use exposed RW without any seed recipe');
 assert.ok(names.includes('NewHMI'), 'new runtime recipe can use unused internal tag');
 assert.ok(!names.includes('HiddenRW'), 'unexposed RW tags remain hidden');
});
test('more than 20 available variables is allowed while each individual recipe remains capped at 20',()=>{
 const p=project();
 for(let i=0;i<22;i++)p.internalVariables.push({name:'RecipeExtra'+i,type:'INT',value:0});
 p.recipeVariables.push(...p.internalVariables.map(v=>v.name));
 assert.equal(C.validate(p).length,0,'a removed global 20-variable whitelist must not limit runtime');
 const huge={id:'many',name:'Demasiados campos',scope:'local',values:Object.fromEntries(p.internalVariables.slice(0,21).map(v=>[v.name,1]))};
 p.recipes.push(huge);
 assert.ok(C.validate(p).some(e=>e.includes('máximo 20 valores')));
});

test('disabled recipes emit no Retain variables, recipe HTTP routes, buttons or manager JS',()=>{
 const p=C.newProject(),st=C.buildST(p),tsv=C.localVariablesTSV(p),html=C.buildRuntimeHTML(p);
 assert.equal(C.validate(p).length,0);
 assert.doesNotMatch(st,/Web_Recipe|\/api\/recipe/);
 assert.doesNotMatch(tsv,/Web_Recipe|Web_PosSlot|Web_RevText/);
 assert.doesNotMatch(html,/id="recipeOpen"|id="recipeWindow"|hminx:recipes/);
 assert.doesNotThrow(()=>new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]));
 assert.ok(C.exportPackage(p).files['README.txt'].includes('Recetas deshabilitadas'));
});
test('configurable NX capacity affects ST arrays, runtime limits, and validation',()=>{
 const p=project();p.recipeSlots=3;p.recipeBytes=180;
 assert.equal(C.validate(p).length,0);
 const st=C.buildST(p),tsv=C.localVariablesTSV(p),html=C.buildRuntimeHTML(p);
 assert.match(tsv,/ARRAY\[1\.\.3\] OF STRING\[192\]/);
 assert.match(tsv,/ARRAY\[1\.\.3\] OF UDINT/);
 assert.match(st,/FOR Web_RecipeIdx := UINT#1 TO UINT#3 DO/);
 assert.match(st,/Web_RecipeSlot <= UINT#3/);
 assert.match(st,/Web_BodyLen <= UINT#180/);
 assert.match(html,/"recipeSlots":3/);
 assert.match(html,/"recipeBytes":180/);
 const tooMany=C.copy(p);tooMany.recipes.push({id:'third',name:'Third',scope:'shared',values:{}},{id:'fourth',name:'Fourth',scope:'shared',values:{}});
 assert.ok(C.validate(tooMany).some(x=>x.includes('máximo 3 recetas')));
 const tooLong=C.copy(p);tooLong.recipes[0].values.HMIName='X'.repeat(180);
 assert.ok(C.validate(tooLong).some(x=>x.includes('180 bytes')));
 for(const [k,val] of [['recipeSlots',0],['recipeSlots',33],['recipeBytes',63],['recipeBytes',501]]){
  const invalid=C.copy(p);invalid[k]=val;
  assert.ok(C.validate(invalid).length>0,k+'='+val);
 }
 const disabled=C.copy(tooLong);disabled.recipeEnabled=false;
 assert.equal(C.validate(disabled).length,0,'parked recipes must not block export');
});
