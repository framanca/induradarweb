'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../expressions.js');
require('../model.js');
require('../sysmac-types.js');
require('../runtime.js');
require('../st.js');
const C=globalThis.NXST;

function sample(){
 const p=C.newProject();
 p.variables=C.importSysmac('Name\tData Type\nTemp\tREAL\nSpeed\tINT\nMotor\tBOOL\nAlarmRaw\tBOOL\nCurrentScreen\tUINT');
 for(const v of p.variables){v.expose=true;v.live=true;v.access='RW';}
 p.screenBinding='CurrentScreen';
 p.screens[0].objects=[
  {...C.newObject('value'),binding:'Temp'},
  {...C.newObject('text'),expressionText:'PLC.Speed + 1'},
 ];
 p.screens.push(C.newScreen('Segunda',2));
 p.screens[1].objects=[{...C.newObject('status'),binding:'Motor'}];
 p.alarms=[{id:'alarm-1',name:'Fallo',binding:'AlarmRaw',operator:'eq',value:true,severity:'high'}];
 return p;
}

test('screen subscriptions include base, expressions, and PLC screen selector but not irrelevant tags',()=>{
 const p=sample();
 assert.deepEqual(C.screenReadNames(C.normalize(p),C.normalize(p).screens[0]),['Temp','Speed','CurrentScreen']);
 assert.deepEqual(C.screenReadNames(C.normalize(p),C.normalize(p).screens[1]),['Motor','CurrentScreen']);
 const base=C.newScreen('Base',3);
 base.objects=[{...C.newObject('lamp'),binding:'AlarmRaw'}];
 p.baseScreen=base;p.screens[1].useBase=true;
 const n=C.normalize(p);
 assert.ok(C.screenReadNames(n,n.screens[1]).includes('AlarmRaw'));
 assert.ok(!C.screenReadNames(n,n.screens[0]).includes('AlarmRaw'));
});

test('ST uses one selected-screen read plus global alarm and ACK state, preserving full reads',()=>{
 const p=sample(),st=C.buildST(p);
 assert.match(st,/GET \/api\/read\?screen=/);
 assert.match(st,/CASE Web_WriteId OF/);
 const scoped=st.slice(st.indexOf('CASE Web_WriteId OF'),st.indexOf("Web_ApiBody := CONCAT(Web_ApiBody, 'BAD SCREEN$n')"));
 const first=scoped.slice(scoped.indexOf('0:'),scoped.indexOf('1:'));
 const second=scoped.slice(scoped.indexOf('1:'));
 assert.match(first,/Temp/);assert.match(first,/Speed/);assert.match(first,/CurrentScreen/);
 assert.doesNotMatch(first,/Motor/);assert.doesNotMatch(first,/BOOL_TO_STRING\(AlarmRaw\)/);
 assert.match(second,/Motor/);assert.match(second,/CurrentScreen/);
 assert.doesNotMatch(second,/Temp/);
 assert.match(first,/A1=1\$n/);assert.match(second,/A1=1\$n/);
 assert.match(first,/K1=1\$n/);assert.match(second,/K1=1\$n/);
 assert.match(st,/Legacy\/full snapshot/);
 // The full snapshot still exports off-screen PLC tags when recipes need them.
 assert.match(st,/ELSE\s+\(\* Legacy\/full snapshot[\s\S]*?Temp/);
});

test('runtime validates only requested tags, merges snapshots and reads full for popups or recipes',()=>{
 const p=sample(),html=C.buildRuntimeHTML(p);
 assert.match(html,/"screenVars":\[/);
 assert.match(html,/\/api\/read\?screen=/);
 assert.match(html,/parseSnapshot\(text,expectedIds\)/);
 assert.match(html,/expectedIds\.has\(tag\.id\)/);
 assert.match(html,/Object\.assign\(vals,snap\.vals\)/);
 assert.match(html,/!popupWindow\.hidden/);
 assert.match(html,/recipeApplyJob/);
 assert.doesNotThrow(()=>new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]));
});

test('empty pages generate a valid ST CASE clause',()=>{
 const p=C.newProject();
 const st=C.buildST(p);
 assert.match(st,/CASE Web_WriteId OF\s+0:\s+Web_Found := TRUE;/);
});
