'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../model.js');
const C = globalThis.NXST;

test('editor shows separate Nueva pantalla and Copiar pantalla actions', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /id="addScreen"[^>]*>Nueva pantalla<\/button>/);
  assert.match(html, /id="copyScreen"[^>]*>Copiar pantalla<\/button>/);
  assert.doesNotMatch(html, />\+ Pantalla<\/button>/);
});

test('new screen starts blank and is independent of existing screen', () => {
  const original = C.newScreen('Plantilla');
  original.objects.push({id: 'item1', kind: 'text', text: 'Cabecera'});
  const blank = C.newScreen('Pantalla 2');
  assert.notEqual(blank.id, original.id);
  assert.deepEqual(blank.objects, []);
});

test('copy preserves widget configuration but gives screen and objects new IDs', () => {
  const original = C.newScreen('Plantilla');
  original.objects = [
    {...C.newObject('slider'), text: 'Velocidad', binding: 'Speed_Setpoint', min: -10, max: 150},
    {...C.newObject('image'), text: 'Logo', assetId: 'image-1', assetOnId: 'image-2'},
    {...C.newObject('button'), text: 'Ir a principal', actionType: 'navigate', targetScreenId: 'other-screen'}
  ];
  const clone = C.duplicateScreen(original, 'Plantilla (copia)');
  assert.equal(clone.name, 'Plantilla (copia)');
  assert.notEqual(clone.id, original.id);
  assert.equal(clone.objects.length, original.objects.length);
  for (let i = 0; i < original.objects.length; i++) {
    assert.notEqual(clone.objects[i].id, original.objects[i].id);
    assert.deepEqual({...clone.objects[i], id: original.objects[i].id}, original.objects[i]);
  }
  clone.objects[0].text = 'Editado';
  assert.equal(original.objects[0].text, 'Velocidad');
  clone.objects[1].assetId = 'otra-imagen';
  assert.equal(original.objects[1].assetId, 'image-1');
});

test('self-navigation points to copied screen; external navigation remains untouched', () => {
  const source = C.newScreen('Inicio');
  source.objects = [
    {...C.newObject('button'), actionType: 'navigate', targetScreenId: source.id},
    {...C.newObject('button'), actionType: 'navigate', targetScreenId: 'another-screen'}
  ];
  const clone = C.duplicateScreen(source, 'Inicio (copia)');
  assert.equal(clone.objects[0].targetScreenId, clone.id);
  assert.equal(clone.objects[1].targetScreenId, 'another-screen');
  assert.equal(source.objects[0].targetScreenId, source.id);
});

test('selected screen has an editable name field and a change handler', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const editor = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  assert.match(html, /<label for="screenName"[^>]*>Nombre<\/label>/);
  assert.match(html, /<input id="screenName" type="text" maxlength="80"/);
  assert.match(editor, /\$\('#screenName'\)\.onchange=/);
  assert.match(editor, /editAction\(\(\)=>\{s\.name=name;renderScreens\(\);renderDiag\(\);\},e\.target\)/);
  assert.match(editor, /el\.id==='screenName'/);
});

test('renaming a screen preserves widget IDs, bindings and navigation references after saving', () => {
  const project = C.newProject();
  const screen = project.screens[0];
  const target = C.newScreen('Ajustes');
  project.screens.push(target);
  const button = C.newObject('button');
  button.actionType = 'navigate';
  button.targetScreenId = target.id;
  screen.objects.push(button);
  const screenId = target.id, buttonId = button.id;
  target.name = 'Configuración';
  const restored = C.normalize(JSON.parse(JSON.stringify(project)));
  assert.equal(restored.screens[1].name, 'Configuración');
  assert.equal(restored.screens[1].id, screenId);
  assert.equal(restored.screens[0].objects[0].id, buttonId);
  assert.equal(restored.screens[0].objects[0].targetScreenId, screenId);
});
