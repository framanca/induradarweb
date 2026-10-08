'use strict';
const assert=require('node:assert/strict');
const {create}=require('../history.js');
let tests=0;
function test(name,fn){fn();tests++;console.log('ok - '+name)}
const project=()=>({screens:[{id:'s1',objects:[{id:'b1',text:'Motor',x:10}]}],alarms:[{id:'a1'}],recipes:[{id:'r1'}]});
test('delete object and entire screen can be undone/redone',()=>{
  const h=create(),p=project(),before=h.capture(p,'s1','b1');
  p.screens[0].objects=[];assert.equal(h.commit(before,p),true);
  let undone=h.undo(h.capture(p,'s1',null));assert.equal(JSON.parse(undone.project).screens[0].objects[0].id,'b1');
  let redone=h.redo(undone);assert.deepEqual(JSON.parse(redone.project).screens[0].objects,[]);
  const again=h.capture(p,'s1',null);p.screens=[];assert.ok(h.commit(again,p));
  undone=h.undo(h.capture(p,'s1',null));assert.equal(JSON.parse(undone.project).screens[0].id,'s1');
});
test('no-op changes do not populate undo stack',()=>{
  const h=create(),p=project();assert.equal(h.commit(h.capture(p,'s1',null),p),false);assert.equal(h.canUndo,false);
});
test('editing after undo clears redo',()=>{
  const h=create(),p=project();let before=h.capture(p,'s1',null);p.screens[0].objects[0].text='A';h.commit(before,p);
  const old=h.undo(h.capture(p,'s1',null));assert.equal(h.canRedo,true);
  before=old;p.screens[0].objects[0].text='B';h.commit(before,p);assert.equal(h.canRedo,false);
});
test('history limit works and captures selection without aliasing',()=>{
  const h=create(2),p=project();for(let i=0;i<3;i++){const before=h.capture(p,'s1','b1');p.screens[0].objects[0].x++;h.commit(before,p)}
  assert.equal(h.undo(h.capture(p,'s1',null)).selected,'b1');
  assert.equal(h.undo(h.capture(p,'s1',null)).selected,'b1');
  assert.equal(h.undo(h.capture(p,'s1',null)),null);
});
test('clearing history prevents undo across loaded projects',()=>{
  const h=create(),p=project(),before=h.capture(p,'s1',null);p.alarms=[];h.commit(before,p);h.clear();assert.equal(h.canUndo,false);assert.equal(h.canRedo,false);
});
console.log(`${tests} history tests passed`);
