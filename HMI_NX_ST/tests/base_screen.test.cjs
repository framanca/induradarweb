'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../model.js');
require('../runtime.js');
require('../st.js');
const C = globalThis.NXST;

function fixture() {
  const project = C.newProject();
  const base = C.newBaseScreen();
  base.objects.push({...C.newObject('text'), text:'Header base', x:0, y:0, w:400, h:60});
  project.baseScreen = base;
  const main = project.screens[0];
  main.objects.push({...C.newObject('text'), text:'Own screen'});
  project.screens.push(C.newScreen('Second', 2));
  return project;
}

test('legacy screens have no base unless explicitly enabled', () => {
  const legacy = C.newProject();
  delete legacy.baseScreen;
  delete legacy.screens[0].useBase;
  const normalized = C.normalize(legacy);
  assert.equal(normalized.baseScreen, null);
  assert.equal(normalized.screens[0].useBase, false);
  assert.deepEqual(C.validate(normalized), []);
});

test('a single base is not a navigation screen and has no PLC screen number', () => {
  const project = fixture();
  const normalized = C.normalize(project);
  assert.equal(normalized.baseScreen.number, null);
  assert.equal(normalized.screens.length, 2);
  assert.equal(normalized.screens[0].number, 1);
  assert.equal(normalized.screens[1].number, 2);
  assert.deepEqual(C.validate(normalized), []);
});

test('base widgets are inherited live, rendered first, and never physically copied', () => {
  const project = fixture(), normal = project.screens[0];
  assert.equal(C.screenObjects(project, normal).length, 1);
  normal.useBase = true;
  const objects = C.screenObjects(project, normal);
  assert.equal(objects.length, 2);
  assert.strictEqual(objects[0], project.baseScreen.objects[0]);
  assert.strictEqual(objects[1], normal.objects[0]);
  assert.equal(normal.objects.length, 1);
  project.baseScreen.objects[0].text = 'Updated base';
  assert.equal(C.screenObjects(project, normal)[0].text, 'Updated base');
  project.baseScreen.objects.push({...C.newObject('text'),text:'Footer base'});
  assert.equal(C.screenObjects(project, normal).length, 3);
  assert.equal(C.screenObjects(project, project.screens[1]).length, 0);
  assert.equal(normal.objects.length, 1);
});

test('HTML export composes inherited widgets only for enabled screens', () => {
  const project = fixture();
  project.screens[0].useBase = true;
  const html = C.buildRuntimeHTML(project);
  assert.equal((html.match(/"text":"Header base"/g)||[]).length, 1);
  assert.equal((html.match(/"text":"Own screen"/g)||[]).length, 1);
  assert.equal((html.match(/"number":2/g)||[]).length, 1);
  project.screens[1].useBase = true;
  const both = C.buildRuntimeHTML(project);
  assert.equal((both.match(/"text":"Header base"/g)||[]).length, 2);
  project.screens[0].useBase = false;
  project.screens[1].useBase = false;
  const none = C.buildRuntimeHTML(project);
  assert.doesNotMatch(none, /"text":"Header base"/);
});

test('persistence keeps the shared reference, checkbox and IDs intact', () => {
  const project = fixture();
  project.screens[0].useBase = true;
  const originalId = project.baseScreen.objects[0].id;
  const saved = JSON.stringify(project);
  const restored = C.normalize(JSON.parse(saved));
  assert.equal(restored.baseScreen.objects[0].id, originalId);
  assert.equal(restored.screens[0].useBase, true);
  assert.equal(restored.screens[0].objects.length, 1);
  assert.equal(C.screenObjects(restored, restored.screens[0]).length, 2);
  assert.deepEqual(C.validate(restored), []);
  const copy = C.duplicateScreen(restored.screens[0], 'Copy', 3);
  assert.equal(copy.useBase, true);
  assert.equal(copy.objects.length, 1);
});

test('base widgets are validated and can navigate only to real screens', () => {
  const project = fixture();
  project.baseScreen.objects.push({...C.newObject('button'), text:'Go', actionType:'navigate', targetScreenId:project.screens[1].id});
  assert.deepEqual(C.validate(project), []);
  project.baseScreen.objects.at(-1).targetScreenId = project.baseScreen.id;
  assert.match(C.validate(project).join('\n'), /selecciona pantalla destino/);
});

test('editor contains one base editor and per-screen layer toggle', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  assert.doesNotMatch(html, /id="baseScreenBtn"/);
  assert.match(html, /id="screenSettingsIsBase" type="checkbox"> Convertir en pantalla base/);
  assert.match(html, /id="screenSettingsUseBase" type="checkbox"> Utilizar pantalla base/);
  assert.match(app, /refreshScreenSettingsMode\('convert'\)/);
  assert.match(app, /refreshScreenSettingsMode\('use'\)/);
  assert.match(app, /function isBaseScreen\(\)/);
  assert.match(app, /inheritedWidget/);
  assert.match(app, /p\.screens\.forEach\(s=>\{s\.useBase=false\}\)/);
});

test('converting an existing screen to base preserves its widgets and creates a safe navigable fallback', () => {
 const project = C.newProject(), original = project.screens[0];
 const text = {...C.newObject('text'), text:'Top navigation'};
 const self = {...C.newObject('button'),text:'Home',actionType:'navigate',targetScreenId:original.id};
 original.objects.push(text,self);
 const id=original.id, number=original.number;
 const base=C.setScreenMode(project,id,'base');
 assert.equal(base.id,id);
 assert.equal(project.baseScreen, original);
 assert.equal(project.baseScreen.number,null);
 assert.equal(project.baseScreen.previousNumber,number);
 assert.equal(project.baseScreen.objects[0].id,text.id);
 assert.equal(project.screens.length,1);
 assert.notEqual(project.screens[0].id,id);
 assert.equal(self.targetScreenId,project.screens[0].id);
 assert.equal(project.screens[0].useBase,false);
 assert.deepEqual(C.validate(project),[]);
});

test('only one base can exist and no screen can use itself as base', () => {
 const project = C.newProject(),a=project.screens[0],b=C.newScreen('B',2);
 project.screens.push(b);
 C.setScreenMode(project,a.id,'base');
 assert.throws(()=>C.setScreenMode(project,b.id,'base'),/Ya hay una pantalla base/);
 assert.throws(()=>C.setScreenMode(project,a.id,'useBase'),/no puede heredarse/);
 assert.equal(project.baseScreen.id,a.id);
 assert.equal(project.screens[0].id,b.id);
});

test('converting back to normal clears inheritance but preserves all widgets',()=>{
 const project=fixture(), main=project.screens[0],other=project.screens[1],base=project.baseScreen;
 main.useBase=true;other.useBase=true;
 assert.equal(C.screenObjects(project,main).length,2);
 const baseWidget=base.objects[0].id;
 C.setScreenMode(project,base.id,'normal');
 assert.equal(project.baseScreen,null);
 assert.equal(base.useBase,false);
 assert.equal(main.useBase,false);
 assert.equal(other.useBase,false);
 assert.equal(project.screens.length,3);
 assert.ok(project.screens.some(s=>s.id===base.id&&s.objects[0].id===baseWidget));
 assert.equal(C.screenObjects(project,main).length,1);
 assert.deepEqual(C.validate(project),[]);
});

test('explicit normal, base and inherited states retain unique numbers after undo-like JSON restore',()=>{
 const project=C.newProject();
 const shared=C.newScreen('Shared',3);
 project.screens.push(shared);
 const originalId=shared.id;
 C.setScreenMode(project,originalId,'base');
 C.setScreenMode(project,project.screens[0].id,'useBase');
 assert.equal(project.screens[0].useBase,true);
 const roundtrip=C.normalize(JSON.parse(JSON.stringify(project)));
 assert.equal(roundtrip.baseScreen.id,originalId);
 assert.equal(roundtrip.screens[0].useBase,true);
 C.setScreenMode(roundtrip,originalId,'normal');
 assert.equal(roundtrip.screens.find(s=>s.id===originalId).number,3);
 assert.deepEqual(C.validate(roundtrip),[]);
});

test('inheritance cannot activate without a base, and any screen can remain independent',()=>{
 const project=C.newProject(),s=project.screens[0];
 assert.throws(()=>C.setScreenMode(project,s.id,'useBase'),/Primero convierte/);
 C.setScreenMode(project,s.id,'normal');
 assert.equal(s.useBase,false);
});
