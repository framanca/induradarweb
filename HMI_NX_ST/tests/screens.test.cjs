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

test('editor uses edit icon, modal metadata and PLC binding instead of inline screen name', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const editor = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  assert.match(html, /id="editScreen"[^>]*>✎<\/button>/);
  assert.match(html, /id="screenSettingsDialog"/);
  assert.match(html, /id="screenSettingsName"/);
  assert.match(html, /id="screenSettingsNumber"/);
  assert.match(html, /id="screenSettingsBackground"/);
  assert.match(html, /id="screenBinding"/);
  assert.doesNotMatch(html, /id="screenName"/);
  assert.match(editor, /\$\('#screenSettingsForm'\)\.onsubmit=/);
  assert.match(editor, /\$\('#screenBinding'\)\.onchange=/);
});

test('legacy projects receive stable unique screen numbers and white backgrounds', () => {
  const old = C.newProject();
  old.screens = [{id:'a', name:'Principal', objects:[]}, {id:'b', name:'Ajustes', objects:[]}];
  const normalized = C.normalize(old);
  assert.deepEqual(normalized.screens.map(x => x.number), [1, 2]);
  assert.deepEqual(normalized.screens.map(x => x.background), ['#ffffff', '#ffffff']);
  assert.equal(normalized.screenBinding, '');
  assert.deepEqual(C.normalize(normalized), normalized);
  assert.deepEqual(C.validate(normalized), []);
});

test('new and cloned screens receive unique numbers and preserve colors independently', () => {
  const original = C.newScreen('Principal', 3);
  original.background = '#004488';
  const next = C.nextScreenNumber([original]);
  assert.equal(next, 1);
  const duplicate = C.duplicateScreen(original, 'Copia', next);
  assert.notEqual(duplicate.id, original.id);
  assert.equal(duplicate.number, 1);
  assert.equal(duplicate.background, '#004488');
  duplicate.background = '#ffeeaa';
  assert.equal(original.background, '#004488');
});

test('validator rejects duplicated or invalid screen numbers and wrong PLC binding type', () => {
  const project = C.newProject();
  project.screens.push(C.newScreen('Segundo', 1));
  assert.match(C.validate(project).join(';'), /Número de pantalla duplicado/);
  project.screens[1].number = 0;
  assert.match(C.validate(project).join(';'), /Número de pantalla no válido/);
  project.screens[1].number = 2.5;
  assert.match(C.validate(project).join(';'), /Número de pantalla no válido/);
  project.screens[1].number = 2;
  project.screenBinding = 'NoExiste';
  assert.match(C.validate(project).join(';'), /variable no encontrada/);
  project.variables.push({id:1,name:'NoExiste',type:'REAL',access:'R',expose:true});
  assert.match(C.validate(project).join(';'), /variable entera expuesta/);
  project.variables[0].type = 'INT';
  project.variables[0].expose = false;
  assert.match(C.validate(project).join(';'), /variable entera expuesta/);
  project.variables[0].expose = true;
  assert.deepEqual(C.validate(project), []);
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
  target.number = 7;
  target.background = '#102030';
  project.screenBinding = 'CurrentScreen';
  const restored = C.normalize(JSON.parse(JSON.stringify(project)));
  assert.equal(restored.screens[1].name, 'Configuración');
  assert.equal(restored.screens[1].number, 7);
  assert.equal(restored.screens[1].background, '#102030');
  assert.equal(restored.screenBinding, 'CurrentScreen');
  assert.equal(restored.screens[1].id, screenId);
  assert.equal(restored.screens[0].objects[0].id, buttonId);
  assert.equal(restored.screens[0].objects[0].targetScreenId, screenId);
});
