'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ctx={TextEncoder};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['expressions.js','model.js','runtime.js','st.js','zip.js']){
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);
}
const C=ctx.NXST,E=ctx.NXExpressions;
test('safe expressions evaluate numeric and boolean conditions without executing JavaScript',()=>{
 assert.equal(E.evaluate('Process_Level > 80 ? "#ef4444" : "#22c55e"',{Process_Level:90}),'#ef4444');
 assert.equal(E.evaluate('Machine_Running && 2*3 == 6',{Machine_Running:true}),true);
 assert.equal(E.evaluate('HMI.PLCConnected ? "Conectado" : "Sin PLC"',{'HMI.PLCConnected':false}),'Sin PLC');
 assert.ok(E.validate('Process_Level ? "yes" :'));
 assert.ok(E.validate('constructor.constructor("return 1")()'));
 assert.ok(E.validate('Machine_Running; alert(1)'));
});
test('dynamic text and internal variables survive normalization and export',()=>{
 const p=C.demoProject(),o=C.newObject('dynamicText');p.internalVariables=[{name:'Local_Mode',type:'INT',value:2}];
 o.binding='Local_Mode';o.optionsText='0=Parado\n1=Manual\n2=Automático';o.expressionBackground='Local_Mode == 2 ? "#d1fae5" : "#fff"';
 p.screens[0].objects.push(o);
 assert.equal(C.validate(p).length,0);
 const n=C.normalize(p),html=C.buildRuntimeHTML(n);
 assert.equal(n.screens[0].objects.at(-1).expressionBackground,o.expressionBackground);
 assert.match(html,/"Local_Mode"/);assert.match(html,/"dynamicText"/);
 assert.match(html,/function currentValue\(name\)/);
 assert.doesNotThrow(()=>new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]));
});
test('popup actions do not require PLC bindings and include close action',()=>{
 const p=C.demoProject(),target=C.newScreen('Mantenimiento',2),open=C.newObject('button'),close=C.newObject('button');
 open.actionType='popup';open.targetScreenId=target.id;close.actionType='closePopup';
 p.screens[0].objects.push(open);target.objects.push(close);p.screens.push(target);
 assert.equal(C.validate(p).length,0);
 const h=C.buildRuntimeHTML(p);assert.match(h,/function showPopup\(id\)/);assert.match(h,/function hidePopup\(\)/);
 assert.match(h,/id="popupWindow"/);
});
test('alarm ACK writes and readback are generated into PLC ST and local variables',()=>{
 const p=C.demoProject(),st=C.buildST(p),locals=C.localVariablesTSV(p),html=C.buildRuntimeHTML(p);
 assert.match(st,/POST \/api\/ack\?/);assert.match(st,/Web_AlarmAck\[1\] := TRUE/);
 assert.match(st,/IF NOT \(Process_Level > REAL#90\.0\) THEN Web_AlarmAck\[1\] := FALSE/);
 assert.match(st,/K1=1\$n/);assert.match(st,/K1=0\$n/);
 assert.match(locals,/Web_AlarmAck\s+ARRAY\[1\.\.1\] OF BOOL/);
 assert.match(html,/Reconocer todas las activas/);assert.match(html,/function acknowledge\(id\)/);
 assert.match(html,/ackVals/);
 const pkg=C.exportPackage(p);assert.ok(pkg.files['WebHMI_LocalVariables.tsv'].includes('Web_AlarmAck'));
});
test('missing popup target and invalid expression block export',()=>{
 const p=C.demoProject(),button=C.newObject('button');button.actionType='popup';button.targetScreenId='missing';
 p.screens[0].objects.push(button);assert.ok(C.validate(p).some(x=>x.includes('pantalla destino')));
 button.targetScreenId=p.screens[0].id;button.expressionVisible='Machine_Running &&';
 assert.ok(C.validate(p).some(x=>x.includes('expressionVisible')));
});
