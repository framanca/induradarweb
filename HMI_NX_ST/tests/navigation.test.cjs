'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {TextEncoder} = require('node:util');

require('../model.js');
require('../runtime.js');
const C = globalThis.NXST;

function prepare(options={}) {
  const project = C.newProject();
  project.name = 'Pantallas de prueba';
  project.screens = [
    C.newScreen('Principal'),
    C.newScreen('Configuración'),
    C.newScreen('Producción')
  ];
  if(options.plc){
    project.screenBinding='CurrentScreen';
    project.variables=[{id:1,name:'CurrentScreen',type:'UINT',access:'R',expose:true,live:true,writeSupported:true}];
    project.screens[0].number=1;
    project.screens[1].number=10;
    project.screens[2].number=20;
    project.screens[1].background='#ddeecc';
    project.screens[2].background='#112233';
  }
  project.alarms = [{
    id: C.id(), name: 'Fallo de motor', binding: 'Machine_Running',
    operator: 'eq', value: true, severity: 'high'
  }];
  const html = C.buildRuntimeHTML(project);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'La HMI debe generar JavaScript');
  class FakeElement {
    constructor(tag='div') {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.style = {};
      this.dataset = {};
      this.value = '';
      this.textContent = '';
      this.hidden = true;
      this.clientWidth = 480;
      const classes = new Set();
      this.classList = {
        toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); },
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); }
      };
    }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    querySelector() { return null; }
  }
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new FakeElement());
    return elements.get(id);
  };
  get('alarmWindow').hidden = true;
  let snapshotText='SEQ=1\n1=1\nA1=0\nEND=1\n';
  const context = {
    document: { getElementById: get, createElement: tag => new FakeElement(tag), activeElement: null },
    window: { innerWidth: 480, addEventListener() {} },
    fetch: async () => ({ ok: true, text: async () => snapshotText }),
    setTimeout() {}, clearTimeout() {}, AbortController,
    TextEncoder
  };
  vm.runInNewContext(script + ';globalThis.__ui={P,showScreen,showScreenById,alarmVals,paintAlarms,readSnapshot,failComm,comm}', context, {timeout: 2000});
  return {html, get, project, ui: context.__ui, setSnapshot: value => {snapshotText='SEQ=1\n1='+value+'\nA1=0\nEND=1\n';}};
}

test('selector único y botón Alarmas comparten la barra de navegación', () => {
  const {html, get, project} = prepare();
  assert.match(html, /<nav id="nav"[^>]*><label for="screenSelect">Pantalla<\/label><select id="screenSelect"[^>]*><\/select><button[^>]*id="alarmOpen"/);
  assert.equal(get('screenSelect').children.length, project.screens.length);
  assert.deepEqual(Array.from(get('screenSelect').children, el => el.textContent), project.screens.map(s => s.name));
  assert.equal(get('screenSelect').value, '0');
  assert.ok(html.indexOf('id="screenSelect"') < html.indexOf('id="alarmOpen"'));
  const nav = html.match(/<nav id="nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.ok(nav.indexOf('id="alarmOpen"') < nav.indexOf('id="alarmbar"'));
  assert.match(nav, /id="alarmbar"/);
  assert.doesNotMatch(html, /<\/nav><div id="alarmbar"/);
  assert.doesNotMatch(html, /<nav id="nav"><\/nav>/);
});
test('el desplegable y botones de navegación internos mantienen la selección', () => {
  const {get, project, ui} = prepare();
  const select = get('screenSelect');
  select.value = '2';
  select.onchange();
  assert.equal(select.value, '2');
  ui.showScreenById(project.screens[1].id);
  assert.equal(select.value, '1');
});
test('Alarmas se abre junto al desplegable sin modificar la pantalla activa', () => {
  const {get} = prepare();
  const select = get('screenSelect'), dialog = get('alarmWindow');
  select.value = '1';
  select.onchange();
  get('alarmOpen').onclick();
  assert.equal(dialog.hidden, false);
  assert.equal(select.value, '1');
  get('alarmClose').onclick();
  assert.equal(dialog.hidden, true);
  get('alarmbar').onclick();
  assert.equal(dialog.hidden, false);
  assert.equal(select.value, '1');
});
test('contador de alarmas permanece activo y visible en la navegación', () => {
  const {get, ui} = prepare();
  ui.alarmVals[1] = true;
  ui.paintAlarms();
  assert.equal(get('alarmCount').textContent, '1');
  assert.equal(get('alarmOpen').classList.contains('active'), true);
  ui.alarmVals[1] = false;
  ui.paintAlarms();
  assert.equal(get('alarmCount').textContent, '0');
  assert.equal(get('alarmOpen').classList.contains('active'), false);
});

test('la variable entera del PLC gobierna la navegación y actualiza el color de fondo', async () => {
  const {get, project, ui, setSnapshot} = prepare({plc:true});
  const select = get('screenSelect'), stage = get('stage');
  assert.equal(select.disabled, true);
  assert.equal(select.value, '0');
  setSnapshot(10);
  await ui.readSnapshot();
  assert.equal(select.value, '1');
  assert.equal(stage.style.backgroundColor, '#ddeecc');
  assert.equal(ui.comm.state, 'ONLINE');
  setSnapshot(20);
  await ui.readSnapshot();
  assert.equal(select.value, '2');
  assert.equal(stage.style.backgroundColor, '#112233');
  ui.showScreenById(project.screens[0].id);
  assert.equal(select.value, '2', 'la navegación manual no prevalece sobre el PLC');
  select.value = '0';
  select.onchange();
  assert.equal(select.value, '2', 'el selector manual se restaura a la pantalla PLC');
});

test('un valor PLC sin pantalla asignada vuelve a principal y conserva el color', async () => {
  const {get, ui, setSnapshot} = prepare({plc:true});
  const select = get('screenSelect');
  for(const value of [20, 999, 10, 0, -1, 1, 1.5]){
    setSnapshot(value);
    await ui.readSnapshot();
    const expected = value===20?'2':value===10?'1':'0';
    assert.equal(select.value,expected,'valor '+value);
  }
  assert.equal(get('stage').style.backgroundColor, '#ffffff');
});

test('una lectura fallida mantiene la última pantalla válida sin usar datos caducados para navegar', async () => {
  const {get, ui, setSnapshot} = prepare({plc:true});
  setSnapshot(20);
  await ui.readSnapshot();
  assert.equal(get('screenSelect').value,'2');
  ui.failComm();
  assert.equal(get('screenSelect').value,'2');
  setSnapshot('abc');
  await assert.rejects(ui.readSnapshot());
  assert.equal(get('screenSelect').value,'2');
});
