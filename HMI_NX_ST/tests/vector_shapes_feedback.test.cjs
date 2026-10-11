'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('../expressions.js');
require('../model.js');
require('../runtime.js');
const C=globalThis.NXST;

test('all five geometric elements are native inline SVGs without images or foreign objects',()=>{
 for(const kind of ['rect','ellipse','line','arrow','triangle']){
  const o=C.newObject('shape');
  o.shapeType=kind;
  o.shapePoints=C.defaultShapePoints(kind);
  const s=C.shapeSvg(o.shapeType,o.shapeFill,o.shapeStroke,o.shapeStrokeWidth,o.shapePoints);
  assert.match(s,/^<svg viewBox="0 0 100 100" preserveAspectRatio="none"/);
  assert.ok(!s.includes('<img')&&!s.includes('<image')&&!s.includes('<foreignObject')&&!s.includes('<script'));
  assert.ok(s.length<650,'compact SVG for '+kind+': '+s.length);
  assert.ok(s.includes(kind==='rect'?'<rect':kind==='ellipse'?'<ellipse':kind==='triangle'?'<polygon':kind==='line'?'<line':'<polygon'));
 }
});
test('free triangle supports arbitrary independent vertices and stretched proportions',()=>{
 const o=C.newObject('shape');o.shapeType='triangle';o.shapePoints='3,7 98,39 15,99';
 const svg=C.shapeSvg(o.shapeType,'#123456','#fedcba',4,o.shapePoints);
 assert.match(svg,/3,7 98,39 15,99/);
 assert.match(svg,/fill="#123456"/);
 assert.match(svg,/stroke="#fedcba"/);
 assert.deepEqual(C.shapeCoordinates('triangle',o.shapePoints),[[3,7],[98,39],[15,99]]);
 assert.equal(C.shapeCoordinates('triangle','0,0 50,50 100,100'),null);
 assert.equal(C.shapeCoordinates('triangle','0,0 99,9 <script>'),null);
 assert.equal(C.shapeCoordinates('arrow','20,20 20,20'),null);
});
test('standalone geometry needs no PLC tag, assets or fonts and preserves saved project',()=>{
 const p=C.newProject();for(const shapeType of C.SHAPE_TYPES){const o=C.newObject('shape');o.shapeType=shapeType;o.shapePoints=C.defaultShapePoints(shapeType);p.screens[0].objects.push(o);}
 assert.deepEqual(C.validate(p),[]);
 const clone=C.normalize(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(C.validate(clone),[]);
 const html=C.buildRuntimeHTML(clone);
 assert.match(html,/"kind":"shape"/);
 assert.match(html,/"shapeType":"triangle"/);
 assert.match(html,/function shapeSvg\(type,fill,stroke,width,points\)/);
 assert.match(html,/\.o\.shape \.shape-visual svg/);
 assert.ok(html.length<C.HTML_MAX_BYTES);
 const bad=C.copy(p);bad.screens[0].objects[4].shapePoints='0,0 40,40 80,80';
 assert.ok(C.validate(bad).some(x=>x.includes('vértices')));
});
test('button feedback has independent OFF and ON captions with backwards-compatible fallback',()=>{
 const p=C.newProject();
 p.internalVariables=[{name:'HMI_FB',type:'BOOL',value:false}];
 const b=C.newObject('button');b.text='Abrir';b.binding='HMI_FB';b.feedbackBinding='HMI_FB';b.feedbackTextOff='Arrancar';b.feedbackTextOn='Parar';b.actionMode='toggle';p.screens[0].objects.push(b);
 assert.deepEqual(C.validate(p),[]);
 const html=C.buildRuntimeHTML(p);
 assert.match(html,/"feedbackTextOff":"Arrancar"/);
 assert.match(html,/"feedbackTextOn":"Parar"/);
 assert.match(html,/n\.button\.textContent=\(on\?o\.feedbackTextOn:o\.feedbackTextOff\)\|\|o\.text/);
 const legacy=C.copy(p);delete legacy.screens[0].objects[0].feedbackTextOff;delete legacy.screens[0].objects[0].feedbackTextOn;
 const normalized=C.normalize(legacy);
 assert.equal(normalized.screens[0].objects[0].feedbackTextOff,'');
 assert.equal(normalized.screens[0].objects[0].feedbackTextOn,'');
 assert.deepEqual(C.validate(normalized),[]);
});
test('editor lists shape tools and properties and pointer vertex handling',()=>{
 const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
 for(const kind of ['rect','ellipse','line','arrow','triangle'])assert.match(index,new RegExp('data-kind="shape" data-shape="'+kind+'"'));
 for(const prop of ['shapeType','shapeFill','shapeStroke','shapeStrokeWidth','shapePoints','feedbackTextOff','feedbackTextOn'])assert.match(app,new RegExp('data-p="'+prop+'"'));
 assert.match(app,/pointIndex:point\?Number\(point\.dataset\.point\):-1/);
 assert.match(css,/#canvas \.widget\.shape \.shape-point/);
 assert.doesNotThrow(()=>new Function(app));
});
